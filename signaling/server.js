/**
 * WebRTC Signaling Server
 * 
 * Minimal WebSocket server for WebRTC peer discovery and SDP/ICE exchange.
 * Handles:
 * - Peer registration and discovery
 * - SDP offer/answer exchange
 * - ICE candidate exchange
 * - Connection lifecycle management
 */

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

// Create HTTP server (required by WebSocket)
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  } else if (req.url === '/' || req.url === '') {
    // Serve mobile receiver interface
    const filePath = path.join(__dirname, '../phone/index.html');
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error loading page');
        console.error('[ERROR] Failed to load phone/index.html:', err.message);
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
  } else if (req.url.startsWith('/phone/')) {
    // Serve phone assets (CSS, JS)
    const filePath = path.join(__dirname, '../' + req.url);
    const ext = path.extname(filePath);
    
    let contentType = 'text/plain';
    if (ext === '.css') contentType = 'text/css';
    if (ext === '.js') contentType = 'application/javascript';
    if (ext === '.html') contentType = 'text/html';
    
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store active peer sessions
// Key: peerId, Value: { ws, role, connectedTo }
const peers = new Map();

// Session management
const sessions = new Map(); // Key: sessionId, Value: { sender, receiver }

/**
 * Generate a unique peer ID
 */
function generatePeerId() {
  return `peer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique session ID
 */
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

wss.on('connection', (ws) => {
  const peerId = generatePeerId();
  console.log(`\n[✅ NEW CONNECTION] Peer connected: ${peerId}`);
  console.log(`[📊 STATS] Total connections: ${wss.clients.size}\n`);

  let peerRole = null;
  let connectedSessionId = null;

  // Send peer ID to the client
  ws.send(JSON.stringify({
    type: 'peer-id',
    peerId
  }));
  console.log(`[📤 SENT] Peer ID to ${peerId}`);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log(`[📨 RECEIVED] From ${peerId}: ${message.type}`);
      handleMessage(ws, peerId, peerRole, message, (role, sessionId) => {
        peerRole = role;
        connectedSessionId = sessionId;
      });
    } catch (error) {
      console.error(`[❌ ERROR] Invalid message from ${peerId}:`, error.message);
    }
  });

  ws.on('close', () => {
    console.log(`[👋 DISCONNECTED] Peer ${peerId}`);
    console.log(`[📊 STATS] Total connections: ${wss.clients.size - 1}\n`);
    peers.delete(peerId);

    // Cleanup session if peer was part of one
    if (connectedSessionId) {
      const session = sessions.get(connectedSessionId);
      if (session) {
        if (session.sender?.peerId === peerId) {
          session.sender = null;
        }
        if (session.receiver?.peerId === peerId) {
          session.receiver = null;
        }

        // Delete session if both peers disconnected
        if (!session.sender && !session.receiver) {
          sessions.delete(connectedSessionId);
        } else {
          // Notify remaining peer
          const remainingPeer = session.sender || session.receiver;
          if (remainingPeer && remainingPeer.ws.readyState === WebSocket.OPEN) {
            remainingPeer.ws.send(JSON.stringify({
              type: 'peer-disconnected'
            }));
          }
        }
      }
    }
  });

  ws.on('error', (error) => {
    console.error(`[❌ WEBSOCKET ERROR] From ${peerId}:`, error.message);
  });
});

/**
 * Handle incoming messages from peers
 */
function handleMessage(ws, peerId, currentRole, message, updateRole) {
  const { type, sessionId, role, offer, answer, candidate } = message;

  switch (type) {
    case 'register':
      handleRegister(ws, peerId, role, updateRole);
      break;

    case 'discover':
      handleDiscover(ws, peerId);
      break;

    case 'offer':
      handleOffer(ws, peerId, sessionId, offer, updateRole);
      break;

    case 'answer':
      handleAnswer(ws, peerId, sessionId, answer, updateRole);
      break;

    case 'ice-candidate':
      handleIceCandidate(ws, peerId, sessionId, candidate);
      break;

    default:
      console.warn(`[WARN] Unknown message type: ${type}`);
  }
}

/**
 * Handle peer registration (sender or receiver)
 */
function registerPeer(ws, peerId, role) {
  peers.set(peerId, {
    ws,
    role,
    connectedTo: null
  });
  console.log(`[INFO] Peer ${peerId} registered as ${role}`);
}

function handleRegister(ws, peerId, role, updateRole) {
  if (!['sender', 'receiver'].includes(role)) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Invalid role. Must be "sender" or "receiver"'
    }));
    return;
  }

  registerPeer(ws, peerId, role);
  updateRole(role, null);

  ws.send(JSON.stringify({
    type: 'registered',
    peerId,
    role
  }));

  console.log(`[INFO] Registered: ${peerId} as ${role}`);
}

/**
 * Handle discovery request to find available peers
 */
function handleDiscover(ws, peerId) {
  const availablePeers = Array.from(peers.values())
    .filter(p => p.ws !== ws && p.connectedTo === null)
    .map(p => ({
      peerId: p.connectedTo || 'unknown',
      role: p.role
    }));

  ws.send(JSON.stringify({
    type: 'peers-available',
    peers: availablePeers
  }));
}

/**
 * Handle SDP offer from sender
 */
function handleOffer(ws, peerId, sessionId, offer, updateRole) {
  // Create or get session
  let session = sessions.get(sessionId);
  
  if (!session) {
    session = {
      id: sessionId || generateSessionId(),
      sender: null,
      receiver: null
    };
    sessions.set(session.id, session);
  }

  const peerInfo = peers.get(peerId) || {};
  const role = peerInfo.role || 'sender';

  session.sender = {
    peerId,
    ws,
    role: 'sender'
  };

  updateRole('sender', session.id);

  peers.set(peerId, { ...peerInfo, connectedTo: sessionId });

  // If receiver exists, forward the offer
  if (session.receiver && session.receiver.ws.readyState === WebSocket.OPEN) {
    session.receiver.ws.send(JSON.stringify({
      type: 'offer',
      from: peerId,
      sessionId: session.id,
      offer
    }));
    console.log(`[INFO] Forwarded offer from ${peerId} to receiver`);
  } else {
    console.log(`[INFO] Offer from ${peerId} stored, waiting for receiver`);
  }
}

/**
 * Handle SDP answer from receiver
 */
function handleAnswer(ws, peerId, sessionId, answer, updateRole) {
  const session = sessions.get(sessionId);

  if (!session) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Session not found'
    }));
    return;
  }

  const peerInfo = peers.get(peerId) || {};
  session.receiver = {
    peerId,
    ws,
    role: 'receiver'
  };

  updateRole('receiver', sessionId);
  peers.set(peerId, { ...peerInfo, connectedTo: sessionId });

  // Forward answer to sender
  if (session.sender && session.sender.ws.readyState === WebSocket.OPEN) {
    session.sender.ws.send(JSON.stringify({
      type: 'answer',
      from: peerId,
      sessionId,
      answer
    }));
    console.log(`[INFO] Forwarded answer from ${peerId} to sender`);
  }
}

/**
 * Handle ICE candidate exchange
 */
function handleIceCandidate(ws, peerId, sessionId, candidate) {
  const session = sessions.get(sessionId);

  if (!session) {
    console.warn(`[WARN] Session ${sessionId} not found for ICE candidate`);
    return;
  }

  // Determine target peer
  const targetPeer = session.sender?.peerId === peerId ? session.receiver : session.sender;

  if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
    targetPeer.ws.send(JSON.stringify({
      type: 'ice-candidate',
      from: peerId,
      sessionId,
      candidate
    }));
  }
}

// Get local IP address for display
function getLocalIP() {
  const os = require('os');
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Start server on all interfaces (0.0.0.0)
server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log(`\n✅ WebRTC Signaling Server running on ALL interfaces`);
  console.log(`📡 WebSocket URL: ws://${localIP}:${PORT}`);
  console.log(`📋 Health check: http://${localIP}:${PORT}/health`);
  console.log(`💻 Laptop: file:///path/to/laptop/index.html`);
  console.log(`📱 Mobile: http://${localIP}:${PORT}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[INFO] SIGTERM received, shutting down gracefully...');
  wss.clients.forEach((ws) => {
    ws.close(1000, 'Server shutdown');
  });
  server.close(() => {
    console.log('[INFO] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n[INFO] SIGINT received, shutting down gracefully...');
  wss.clients.forEach((ws) => {
    ws.close(1000, 'Server shutdown');
  });
  server.close(() => {
    console.log('[INFO] Server closed');
    process.exit(0);
  });
});
