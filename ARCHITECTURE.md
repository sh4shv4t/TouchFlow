# Architecture Documentation

## System Design Overview

This document provides a deep dive into the Remote Screen Controller architecture, suitable for developers and contributors.

---

## Table of Contents

1. [System Components](#system-components)
2. [Data Flow](#data-flow)
3. [Class Structure](#class-structure)
4. [Communication Protocols](#communication-protocols)
5. [State Management](#state-management)
6. [Error Handling](#error-handling)
7. [Extension Points](#extension-points)

---

## System Components

### 1. Signaling Server (`signaling/server.js`)

**Purpose:** Facilitate initial WebRTC peer discovery and SDP/ICE exchange.

**Key Responsibilities:**
- Accept WebSocket connections from sender and receiver peers
- Maintain peer registry with roles and session mapping
- Route SDP offers/answers between peers
- Forward ICE candidates for NAT traversal
- Manage session lifecycle
- Handle disconnections and cleanup

**Architecture:**

```
WebSocket Server
    ├── Peer Registry (Map<peerId, PeerInfo>)
    ├── Session Manager (Map<sessionId, SessionInfo>)
    └── Message Router
        ├── register → authenticate and register peer
        ├── offer → route to receiver
        ├── answer → route to sender
        └── ice-candidate → route bidirectionally
```

**Data Structures:**

```javascript
// Peer registry entry
{
  peerId: "peer_TIMESTAMP_RANDOM",
  ws: WebSocket,           // Connection to peer
  role: "sender|receiver", // Peer role
  connectedTo: sessionId   // Current session (null if not connected)
}

// Session entry
{
  id: "session_TIMESTAMP_RANDOM",
  sender: { peerId, ws, role },   // Sender peer info
  receiver: { peerId, ws, role }  // Receiver peer info
}
```

**Key Methods:**

- `generatePeerId()` - Create unique peer identifier
- `registerPeer()` - Add peer to registry
- `handleMessage()` - Dispatcher for incoming messages
- `handleOffer()` - Route SDP offer to receiver
- `handleAnswer()` - Route SDP answer to sender
- `handleIceCandidate()` - Forward ICE candidates

---

### 2. Laptop Sender (`laptop/sender.js`)

**Purpose:** Capture screen, stream via WebRTC, receive scroll commands.

**Key Responsibilities:**
- Request screen capture via `getDisplayMedia()`
- Create WebRTC peer connection
- Add screen stream as video track
- Create data channel for receiving scroll commands
- Execute scroll commands on page
- Maintain connection state and statistics
- Handle graceful shutdown

**Architecture:**

```
RemoteScreenSender Class
    ├── Connection Management
    │   ├── connectToSignaling() - WebSocket setup
    │   ├── createPeerConnection() - WebRTC setup
    │   └── createOffer() - Initiate P2P connection
    ├── Media Handling
    │   ├── start() - Request screen capture
    │   ├── addScreenStream() - Add to peer connection
    │   └── stop() - Cleanup media resources
    ├── Command Handling
    │   └── handleScrollCommand() - Execute window.scrollBy()
    ├── Statistics
    │   └── collectStats() - Get connection metrics
    └── UI Management
        ├── updateConnectionStatus()
        ├── log() - Add to event log
        └── updateStats() - Display metrics
```

**Lifecycle States:**

```
Initial → Connected to Signaling → WebRTC Peer Created → Offer Sent
    ↓                                                        ↓
Waiting for Receiver ← Answer Received ← ICE Candidates Exchanged
    ↓
Ready to Receive Commands → Scroll Events Processed
    ↓
Disconnected (user clicks Stop or connection fails)
```

**Key Methods:**

- `start()` - Initiate screen capture and connection
- `stop()` - Cleanup all resources
- `createPeerConnection()` - Setup WebRTC peer
- `handleScrollCommand(dx, dy)` - Execute scroll
- `sendSignalingMessage()` - Send to server
- `collectStats()` - Gather connection statistics

**Statistics Tracked:**

- `frameCount` - Video frames sent
- `bitrate` - Current bitrate (Mbps)
- `scrollCount` - Scroll events received
- `totalBytesSent` - Total bytes transmitted

---

### 3. Mobile Receiver (`phone/controller.js`)

**Purpose:** Receive video stream, capture gestures, send scroll commands.

**Key Responsibilities:**
- Connect to signaling server
- Create WebRTC peer connection
- Receive video stream from sender
- Capture touch gestures on screen
- Calculate scroll deltas from drag movements
- Send scroll commands via data channel
- Maintain connection state
- Provide touch feedback UI

**Architecture:**

```
RemoteScreenReceiver Class
    ├── Connection Management
    │   ├── connectToSignaling() - WebSocket setup
    │   ├── createPeerConnection() - WebRTC setup
    │   └── handleOffer() - Respond to sender's offer
    ├── Media Handling
    │   ├── ontrack event - Receive video stream
    │   └── setupDataChannel() - Prepare scroll channel
    ├── Touch Handling
    │   ├── handleTouchStart() - Capture initial contact
    │   ├── handleTouchMove() - Track dragging
    │   ├── handleTouchEnd() - Finish gesture
    │   └── sendScrollCommand() - Send deltas via channel
    ├── Settings Management
    │   ├── scrollSensitivity - Scroll multiplier
    │   ├── fullscreenToggle - Fullscreen mode
    │   └── showTouchFeedback() - Visual feedback
    └── UI Management
        ├── showVideo() - Transition to video view
        ├── updateConnectionStatus()
        └── showStatus() - Display messages
```

**Lifecycle States:**

```
Initial → Setup Panel Shown → Waiting for Session ID Input
    ↓
Connect Clicked → WebSocket Connected → Registered as Receiver
    ↓
Waiting for Offer ← Offer Received ← Create Answer
    ↓
Answer Sent ← ICE Candidates Exchanged
    ↓
Remote Track Received → Video Displayed Fullscreen
    ↓
Ready for Touch Input → Processing Scroll Gestures
    ↓
Disconnected (disconnect button or connection lost)
```

**Touch Event Processing:**

```
1. touchstart: Record initial position (startX, startY)
2. touchmove: 
   - Calculate delta: (currentX - lastX, currentY - lastY)
   - Apply sensitivity: delta * scrollSensitivity
   - Send command: { dx, dy }
   - Update last position
3. touchend: Reset active flag
```

**Key Methods:**

- `connect()` - Initiate connection sequence
- `disconnect()` - Cleanup and reset
- `createPeerConnection()` - Setup WebRTC
- `handleTouchMove()` - Process drag gestures
- `sendScrollCommand()` - Send to data channel
- `showTouchFeedback()` - Visual indicator

**Settings:**

- `scrollSensitivity` - 0.5x to 3x multiplier
- `enableDebugStats` - Show connection metrics
- `fullscreenMode` - Fullscreen on/off

---

## Data Flow

### Connection Establishment Flow

```
┌─ SIGNALING PHASE (WebSocket) ─┐

Sender Browser:
1. Create PeerConnection with ICE servers
2. Add screen stream as track
3. Create offer: await pc.createOffer()
4. Set local description
5. Send via WebSocket: { type: 'offer', offer: sdpOffer }

Server (signaling/server.js):
1. Receive offer from sender
2. Store sender peer info
3. Wait for receiver to connect
4. Route offer to receiver when available

Receiver Browser:
1. Receive offer via WebSocket
2. Create PeerConnection with ICE servers
3. Set remote description with offer
4. Create answer: await pc.createAnswer()
5. Set local description
6. Send via WebSocket: { type: 'answer', answer: sdpAnswer }

Server:
1. Receive answer from receiver
2. Route answer to sender

Sender Browser:
1. Receive answer via WebSocket
2. Set remote description with answer

└─ OFFERS/ANSWERS COMPLETE ─┘

┌─ ICE CANDIDATE EXCHANGE (WebSocket) ─┐

Sender & Receiver:
1. onicecandidate event fires
2. Send via WebSocket: { type: 'ice-candidate', candidate }
3. Receive candidates from other peer
4. Add with: pc.addIceCandidate(candidate)

└─ ICE GATHERING COMPLETE ─┘

┌─ P2P CONNECTION ESTABLISHED ─┐

Direct UDP connection established between sender and receiver
WebSocket can now be idle (but remains open for cleanup)

Sender → Receiver: Video stream (SRTP encrypted)
Receiver → Sender: Data channel for scroll commands

└─────────────────────────┘
```

### Scroll Command Flow

```
User Action (Mobile):
1. User touches screen: touchstart event
2. User drags finger: touchmove events (multiple)
   - Calculate position delta: (currX - lastX, currY - lastY)
   - Apply sensitivity: delta * scrollSensitivity
3. User releases: touchend event

Touch to Scroll Command:
handleTouchMove(e)
  ├─ Get touch position
  ├─ Calculate delta (dx, dy)
  ├─ Check threshold (avoid noise)
  ├─ Apply sensitivity scaling
  ├─ Serialize: JSON.stringify({ dx, dy })
  └─ Send via dataChannel.send()

Network Transmission:
Data Channel (SCTP/DTLS)
  ├─ Serialization: { dx, dy }
  ├─ Encryption: DTLS
  ├─ Transport: SCTP (ordered, reliable)
  └─ Latency: < 50ms typical

Laptop Receives:
onmessage(event)
  ├─ Parse: JSON.parse(event.data)
  ├─ Extract: dx, dy values
  ├─ Call: window.scrollBy({ left: dx, top: dy, behavior: 'auto' })
  ├─ Update stats
  └─ UI feedback

Page Scroll:
Browser engine scrolls viewport
  ├─ Recalculates layout
  ├─ Redraws visible content
  └─ Next screen capture includes new content
```

---

## Class Structure

### RemoteScreenSender

**Properties:**

```javascript
// Configuration
signalingUrl: string
sessionId: string
peerId: string

// Connection objects
peerConnection: RTCPeerConnection
signalingSocket: WebSocket
dataChannel: RTCDataChannel
screenStream: MediaStream

// Statistics
stats: {
  frameCount: number,
  scrollCount: number,
  totalBytesSent: number,
  lastBytesCount: number
}

// DOM references
elements: {
  startBtn: HTMLElement,
  stopBtn: HTMLElement,
  screenPreview: HTMLVideoElement,
  // ... more UI elements
}
```

**Methods:**

```javascript
// Public API
start(): Promise<void>
stop(): Promise<void>
copySessionId(): void

// Connection setup
connectToSignaling(): Promise<void>
createPeerConnection(): void
createOffer(): Promise<void>
handleAnswer(answer: RTCSessionDescription): Promise<void>

// Message handling
handleSignalingMessage(message: Object): void
handleScrollCommand(command: { dx, dy }): void
sendSignalingMessage(message: Object): void

// Media handling
initializeWebRTC(): Promise<void>
handleStreamEnded(): void

// Data channel
setupDataChannel(channel: RTCDataChannel): void

// Statistics
startStatsCollection(): void
collectStats(): Promise<void>

// UI
updateConnectionStatus(status: string, message: string): void
log(level: string, message: string): void

// Utilities
generateSessionId(): string
```

### RemoteScreenReceiver

**Properties:**

```javascript
// Configuration
signalingUrl: string
sessionId: string
peerId: string

// Connection objects
peerConnection: RTCPeerConnection
signalingSocket: WebSocket
dataChannel: RTCDataChannel

// Touch state
touchState: {
  startX: number,
  startY: number,
  lastX: number,
  lastY: number,
  isActive: boolean
}

// Settings
scrollSensitivity: number
enableDebugStats: boolean

// Statistics
stats: {
  scrollEventsSent: number,
  lastPingTime: number
}

// DOM references
elements: {
  setupPanel: HTMLElement,
  videoContainer: HTMLElement,
  remoteVideo: HTMLVideoElement,
  // ... more UI elements
}
```

**Methods:**

```javascript
// Public API
connect(): Promise<void>
disconnect(): Promise<void>

// Connection setup
connectToSignaling(): Promise<void>
createPeerConnection(): void
registerAsReceiver(): void
handleOffer(offer: RTCSessionDescription): Promise<void>

// Message handling
handleSignalingMessage(message: Object): void
sendSignalingMessage(message: Object): void
sendScrollCommand(dx: number, dy: number): void

// Data channel
setupDataChannel(channel: RTCDataChannel): void

// Touch events
handleTouchStart(e: TouchEvent): void
handleTouchMove(e: TouchEvent): void
handleTouchEnd(e: TouchEvent): void

// UI
showVideo(): void
showStatus(message: string, className: string): void
updateConnectionStatus(status: string): void
toggleFullscreen(): void
showTouchFeedback(x: number, y: number): void

// Utilities
log(message: string): void
```

---

## Communication Protocols

### WebSocket Signaling Protocol

**Session Lifecycle Messages:**

```javascript
// Sender Registration
{
  type: 'register',
  role: 'sender'
}

// Response
{
  type: 'registered',
  peerId: 'peer_xxx',
  role: 'sender'
}

// SDP Offer (Sender → Server → Receiver)
{
  type: 'offer',
  sessionId: 'session_xxx',
  offer: {
    type: 'offer',
    sdp: '...'  // SDP offer string
  }
}

// SDP Answer (Receiver → Server → Sender)
{
  type: 'answer',
  sessionId: 'session_xxx',
  answer: {
    type: 'answer',
    sdp: '...'  // SDP answer string
  }
}

// ICE Candidate Exchange
{
  type: 'ice-candidate',
  sessionId: 'session_xxx',
  candidate: {
    candidate: '...',
    sdpMLineIndex: 0,
    sdpMid: 'video'
  }
}

// Peer Disconnected Notification
{
  type: 'peer-disconnected'
}

// Error Message
{
  type: 'error',
  message: 'Error description'
}
```

### DataChannel Protocol

**Scroll Command Format:**

```javascript
// Message sent from receiver to sender
{
  dx: -45,     // Horizontal scroll delta (pixels)
  dy: -120     // Vertical scroll delta (pixels)
}

// Interpretation:
// - Positive dx: Scroll right
// - Negative dx: Scroll left
// - Positive dy: Scroll down
// - Negative dy: Scroll up
```

**Channel Properties:**

- **Type:** Reliable, ordered (SCTP)
- **Buffering:** Automatic queueing when channel busy
- **Retransmission:** Enabled (guaranteed delivery)
- **MTU:** 16 KB (typically)
- **Latency:** < 50ms (local network)

---

## State Management

### Sender Connection States

```javascript
enum SenderState {
  IDLE = 'idle',                          // Initial state
  CONNECTING = 'connecting',              // Signaling connection
  PEER_CREATED = 'peer_created',          // PeerConnection created
  OFFER_SENT = 'offer_sent',              // SDP offer sent
  ANSWER_RECEIVED = 'answer_received',    // SDP answer received
  ICE_GATHERING = 'ice_gathering',        // ICE candidates being gathered
  CONNECTED = 'connected',                // Ready to stream/receive commands
  DISCONNECTED = 'disconnected'           // Connection closed
}
```

### Receiver Connection States

```javascript
enum ReceiverState {
  IDLE = 'idle',                          // Initial state
  SETUP = 'setup',                        // Waiting for session ID
  CONNECTING = 'connecting',              // Signaling connection
  PEER_CREATED = 'peer_created',          // PeerConnection created
  OFFER_RECEIVED = 'offer_received',      // SDP offer received
  ANSWER_SENT = 'answer_sent',            // SDP answer sent
  WAITING_STREAM = 'waiting_stream',      // Waiting for video track
  CONNECTED = 'connected',                // Video received, ready for touch
  DISCONNECTED = 'disconnected'           // Connection closed
}
```

### Connection State Transitions

```
Sender:
IDLE 
  → CONNECTING (connectToSignaling)
  → PEER_CREATED (createPeerConnection)
  → OFFER_SENT (createOffer)
  → ANSWER_RECEIVED (handleAnswer)
  → ICE_GATHERING (onicecandidate)
  → CONNECTED (onconnectionstatechange)
  → DISCONNECTED (disconnect or error)

Receiver:
IDLE 
  → SETUP (UI shown)
  → CONNECTING (connect clicked)
  → PEER_CREATED (createPeerConnection)
  → OFFER_RECEIVED (handleOffer)
  → ANSWER_SENT (handleOffer completes)
  → ICE_GATHERING (onicecandidate)
  → WAITING_STREAM (peer connection open)
  → CONNECTED (ontrack received)
  → DISCONNECTED (disconnect or error)
```

---

## Error Handling

### Error Categories

**1. Signaling Errors**
```javascript
// WebSocket connection failed
catch (e) {
  updateUI('Signaling connection failed');
  // Retry with exponential backoff
}

// Invalid session ID
if (!sessionId.match(/^sess_/)) {
  showError('Invalid session ID format');
}

// Peer not found
if (!session.receiver) {
  log('warning', 'Receiver not yet connected');
}
```

**2. WebRTC Errors**
```javascript
// No display available
try {
  stream = await getDisplayMedia();
} catch (err) {
  if (err.name === 'NotAllowedError') {
    showError('Permission denied. Please share your screen.');
  }
}

// Codec not supported
try {
  offer = await pc.createOffer();
} catch (err) {
  showError('Browser does not support required codecs');
}

// ICE candidate error
pc.onicecandidate = (event) => {
  if (event.candidate === null) {
    // ICE gathering complete
  } else {
    addIceCandidate(event.candidate)
      .catch(err => log('warning', `Failed to add ICE: ${err}`));
  }
};
```

**3. Network Errors**
```javascript
// Connection timeout
setTimeout(() => {
  if (pc.connectionState !== 'connected') {
    showError('Connection timeout. Check network.');
    reconnect();
  }
}, 10000);

// Data channel failure
try {
  dataChannel.send(JSON.stringify(command));
} catch (err) {
  log('error', `Send failed: ${err.message}`);
}

// Stream interrupted
stream.getTracks().forEach(track => {
  track.addEventListener('ended', () => {
    handleStreamEnded();
  });
});
```

### Recovery Strategies

```javascript
// Exponential backoff retry
async function retryConnection(fn, maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const delayMs = Math.pow(2, i) * 1000;
      log(`Retry in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('Failed after max retries');
}

// Graceful degradation
if (pc.connectionState === 'disconnected') {
  // Stop trying to send scroll commands
  dataChannel = null;
  showWarning('Connection unstable. Scrolling may not work.');
}

// Auto-reconnect
function setupAutoReconnect() {
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') {
      setTimeout(() => connect(), 5000);
    }
  };
}
```

---

## Extension Points

### Adding New Gesture Types

To add gesture support beyond scrolling:

**1. Extend Touch Handler:**
```javascript
// In phone/controller.js
handleTouchMove(e) {
  const touch = e.touches[0];
  const dx = touch.clientX - this.touchState.lastX;
  const dy = touch.clientY - this.touchState.lastY;

  // Detect gesture type
  if (e.touches.length === 2) {
    handlePinch(e.touches);
  } else if (Math.abs(dx) > Math.abs(dy)) {
    handleHorizontalScroll(dx);
  } else {
    handleVerticalScroll(dy);
  }
}
```

**2. Define Command Format:**
```javascript
// Extend data channel protocol
{
  type: 'scroll' | 'pinch' | 'rotate' | 'click',
  dx: number,
  dy: number,
  scale: number,      // for pinch
  rotation: number,   // for rotate
  x: number, y: number // for click
}
```

**3. Handle on Sender:**
```javascript
// In laptop/sender.js
handleRemoteCommand(command) {
  switch (command.type) {
    case 'scroll':
      window.scrollBy(command.dx, command.dy);
      break;
    case 'pinch':
      document.dispatchEvent(new CustomEvent('pinch', { detail: command }));
      break;
    case 'click':
      const element = document.elementFromPoint(command.x, command.y);
      element?.click();
      break;
  }
}
```

### Adding Custom Codecs

```javascript
// In sender.js
createPeerConnection() {
  this.peerConnection = new RTCPeerConnection({
    iceServers,
    // Custom codec preferences
    encodedInsertableStreams: true
  });

  // Force H.264
  const capabilities = RTCRtpSender.getCapabilities('video');
  const h264Codec = capabilities.codecs.find(c => c.mimeType === 'video/H264');
  
  // Configure transceiver
  const transceiver = pc.getTransceivers()[0];
  if (h264Codec) {
    transceiver.sender.setParameters({
      codecs: [h264Codec]
    });
  }
}
```

### Adding Logging Backend

```javascript
// Send logs to remote server
class RemoteLogger {
  constructor(endpoint) {
    this.endpoint = endpoint;
    this.queue = [];
  }

  log(level, message) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message
    };

    this.queue.push(entry);

    if (this.queue.length >= 10) {
      this.flush();
    }
  }

  async flush() {
    if (this.queue.length === 0) return;
    
    try {
      await fetch(this.endpoint, {
        method: 'POST',
        body: JSON.stringify(this.queue)
      });
      this.queue = [];
    } catch (err) {
      console.error('Failed to send logs:', err);
    }
  }
}
```

---

## Performance Optimizations

### Screen Capture Optimization

```javascript
// Reduce resolution for lower bandwidth
const options = {
  video: {
    width: { ideal: 1280 },    // Instead of 1920
    height: { ideal: 720 },
    frameRate: { ideal: 24 }   // Instead of 30
  }
};
```

### Scroll Command Batching

```javascript
// Batch scroll commands to reduce overhead
class ScrollBatcher {
  constructor(flushInterval = 50) {
    this.dx = 0;
    this.dy = 0;
    this.flushInterval = flushInterval;
    this.timer = null;
  }

  add(dx, dy) {
    this.dx += dx;
    this.dy += dy;

    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  flush() {
    if (this.dx !== 0 || this.dy !== 0) {
      dataChannel.send(JSON.stringify({ dx: this.dx, dy: this.dy }));
    }
    this.dx = 0;
    this.dy = 0;
    this.timer = null;
  }
}
```

### Memory Management

```javascript
// Clean up event listeners
function cleanup() {
  elements.startBtn.removeEventListener('click', startHandler);
  pc.ontrack = null;
  dc.onmessage = null;
  ws.close();
}

// Limit history log size
const MAX_LOG_ENTRIES = 100;
if (logContainer.children.length > MAX_LOG_ENTRIES) {
  logContainer.removeChild(logContainer.firstChild);
}
```

---

## Testing Guide

### Unit Tests Example

```javascript
// Test scroll command calculation
describe('ScrollCommand', () => {
  it('should calculate delta correctly', () => {
    const touch1 = { clientX: 100, clientY: 200 };
    const touch2 = { clientX: 130, clientY: 170 };
    
    const dx = touch2.clientX - touch1.clientX;  // 30
    const dy = touch2.clientY - touch1.clientY;  // -30
    
    expect(dx).toBe(30);
    expect(dy).toBe(-30);
  });

  it('should apply sensitivity scaling', () => {
    const dx = 30;
    const sensitivity = 1.5;
    const scaled = dx * sensitivity;
    
    expect(scaled).toBe(45);
  });
});
```

### Integration Tests Example

```javascript
// Test full connection flow
describe('ConnectionFlow', () => {
  it('should establish peer connection', async () => {
    const sender = new RemoteScreenSender();
    const receiver = new RemoteScreenReceiver();
    
    await sender.start();
    const sessionId = sender.sessionId;
    
    receiver.sessionId = sessionId;
    await receiver.connect();
    
    // Wait for connection
    await new Promise(r => setTimeout(r, 5000));
    
    expect(receiver.peerConnection.connectionState).toBe('connected');
  });
});
```

---

## Future Architecture Improvements

1. **State Machine Pattern**: Explicit state transitions with guards
2. **Message Queue**: Buffer messages during connection setup
3. **Codec Negotiation**: Automatic codec selection based on platform
4. **TURN Support**: Seamless internet connectivity
5. **Multi-device**: Support multiple receivers per sender
6. **Persistence**: Resume interrupted sessions

---

**Last Updated:** January 2024  
**Architecture Version:** 1.0.0  
**Maintainer:** Remote Screen Controller Team
