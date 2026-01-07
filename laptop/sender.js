/**
 * Remote Screen Sender (Laptop)
 * 
 * Responsibilities:
 * - Capture screen using getDisplayMedia API
 * - Stream video via WebRTC PeerConnection
 * - Receive scroll command events from mobile receiver via DataChannel
 * - Execute scroll commands on the current page
 * - Manage WebRTC lifecycle and connection state
 */

class RemoteScreenSender {
  constructor() {
    // Configuration
    this.signalingUrl = 'ws://localhost:8080';
    this.peerConnection = null;
    this.signalingSocket = null;
    this.dataChannel = null;
    this.screenStream = null;
    this.sessionId = null;
    this.peerId = null;
    
    // Statistics
    this.stats = {
      frameCount: 0,
      scrollCount: 0,
      totalBytesSent: 0,
      lastBytesCount: 0
    };

    // DOM Elements
    this.elements = {
      signalingUrl: document.getElementById('signalingUrl'),
      sessionId: document.getElementById('sessionId'),
      startBtn: document.getElementById('startBtn'),
      stopBtn: document.getElementById('stopBtn'),
      copySessionBtn: document.getElementById('copySessionBtn'),
      screenPreview: document.getElementById('screenPreview'),
      connectionStatus: document.getElementById('connectionStatus'),
      statusText: document.getElementById('statusText'),
      statusDetails: document.getElementById('statusDetails'),
      frameCount: document.getElementById('frameCount'),
      bitrate: document.getElementById('bitrate'),
      scrollCount: document.getElementById('scrollCount'),
      connectionState: document.getElementById('connectionState'),
      logContainer: document.getElementById('logContainer'),
      previewPlaceholder: document.getElementById('previewPlaceholder')
    };

    this.initializeEventListeners();
    this.log('info', 'Sender initialized and ready');
  }

  /**
   * Initialize UI event listeners
   */
  initializeEventListeners() {
    this.elements.startBtn.addEventListener('click', () => this.start());
    this.elements.stopBtn.addEventListener('click', () => this.stop());
    this.elements.copySessionBtn.addEventListener('click', () => this.copySessionId());
  }

  /**
   * Start the remote screen sharing
   */
  async start() {
    try {
      this.signalingUrl = this.elements.signalingUrl.value;
      this.log('info', 'Starting remote screen sharing...');
      
      // Request screen capture
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
          frameRate: { ideal: 30 }
        },
        audio: false
      });

      this.log('success', 'Screen captured successfully');

      // Display preview
      this.elements.screenPreview.srcObject = this.screenStream;
      this.elements.previewPlaceholder.style.display = 'none';

      // Handle stream stop (user clicked browser's stop button)
      this.screenStream.getTracks().forEach(track => {
        track.addEventListener('ended', () => this.handleStreamEnded());
      });

      // Initialize WebRTC
      await this.initializeWebRTC();

      // Update UI
      this.elements.startBtn.disabled = true;
      this.elements.stopBtn.disabled = false;
      
    } catch (error) {
      this.log('error', `Failed to start: ${error.message}`);
      this.updateConnectionStatus('disconnected', error.message);
    }
  }

  /**
   * Handle stream ended (user clicked stop on browser dialog)
   */
  handleStreamEnded() {
    this.log('warning', 'Screen capture ended by user');
    this.stop();
  }

  /**
   * Initialize WebRTC connection
   */
  async initializeWebRTC() {
    try {
      // Connect to signaling server
      await this.connectToSignaling();
      
      // Generate or use provided session ID
      if (!this.sessionId) {
        this.sessionId = this.generateSessionId();
      }
      this.elements.sessionId.value = this.sessionId;

      // Create peer connection
      this.createPeerConnection();

      // Add screen stream to peer connection
      this.screenStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.screenStream);
      });

      // Create data channel for receiving scroll commands
      this.dataChannel = this.peerConnection.createDataChannel('scroll-commands', {
        ordered: true
      });
      this.setupDataChannel(this.dataChannel);

      // Handle incoming data channels (if receiver initiates)
      this.peerConnection.ondatachannel = (event) => {
        this.setupDataChannel(event.channel);
      };

      this.log('success', 'WebRTC peer connection created');

      // Update UI
      this.elements.copySessionBtn.disabled = false;

    } catch (error) {
      this.log('error', `WebRTC initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Connect to WebSocket signaling server
   */
  connectToSignaling() {
    return new Promise((resolve, reject) => {
      try {
        this.signalingSocket = new WebSocket(this.signalingUrl);

        this.signalingSocket.onopen = () => {
          this.log('success', 'Connected to signaling server');
          this.updateConnectionStatus('connected', 'Waiting for receiver...');
          resolve();
        };

        this.signalingSocket.onmessage = (event) => {
          this.handleSignalingMessage(JSON.parse(event.data));
        };

        this.signalingSocket.onerror = (error) => {
          this.log('error', `Signaling error: ${error}`);
          reject(new Error('Signaling connection failed'));
        };

        this.signalingSocket.onclose = () => {
          this.log('warning', 'Signaling connection closed');
          this.updateConnectionStatus('disconnected', 'Signaling connection closed');
        };

        // Timeout after 5 seconds
        setTimeout(() => {
          if (this.signalingSocket.readyState !== WebSocket.OPEN) {
            reject(new Error('Signaling connection timeout'));
          }
        }, 5000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming signaling messages
   */
  handleSignalingMessage(message) {
    const { type, peerId, sessionId, offer, answer, candidate } = message;

    switch (type) {
      case 'peer-id':
        this.peerId = peerId;
        this.log('info', `Assigned peer ID: ${peerId}`);
        this.registerAsSender();
        break;

      case 'registered':
        this.log('success', `Registered as sender`);
        break;

      case 'answer':
        this.handleAnswer(answer);
        break;

      case 'ice-candidate':
        if (candidate) {
          this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
            .catch(e => this.log('warning', `Failed to add ICE candidate: ${e.message}`));
        }
        break;

      case 'peer-disconnected':
        this.log('warning', 'Receiver disconnected');
        this.updateConnectionStatus('disconnected', 'Receiver disconnected');
        break;

      case 'error':
        this.log('error', `Signaling error: ${message.message}`);
        break;
    }
  }

  /**
   * Register as sender on signaling server
   */
  registerAsSender() {
    if (this.signalingSocket && this.signalingSocket.readyState === WebSocket.OPEN) {
      this.signalingSocket.send(JSON.stringify({
        type: 'register',
        role: 'sender'
      }));
    }
  }

  /**
   * Create WebRTC peer connection
   */
  createPeerConnection() {
    const iceServers = [
      { urls: ['stun:stun.l.google.com:19302'] },
      { urls: ['stun:stun1.l.google.com:19302'] }
    ];

    this.peerConnection = new RTCPeerConnection({
      iceServers,
      encodedInsertableStreams: true,
      maxPacketLifeTime: 3000
    });

    // ICE candidate handling
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: 'ice-candidate',
          sessionId: this.sessionId,
          candidate: event.candidate
        });
      }
    };

    // Connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      this.elements.connectionState.textContent = state;
      this.log('info', `Connection state: ${state}`);

      if (state === 'connected' || state === 'completed') {
        this.updateConnectionStatus('connected', 'Connected to receiver');
        this.startStatsCollection();
      } else if (state === 'failed' || state === 'disconnected') {
        this.updateConnectionStatus('disconnected', `Connection ${state}`);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      this.log('info', `ICE connection state: ${this.peerConnection.iceConnectionState}`);
    };

    // Create and send offer
    this.createOffer();
  }

  /**
   * Create and send WebRTC offer
   */
  async createOffer() {
    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: true
      });

      await this.peerConnection.setLocalDescription(offer);

      this.sendSignalingMessage({
        type: 'offer',
        sessionId: this.sessionId,
        offer: offer
      });

      this.log('success', 'Offer sent to receiver');

    } catch (error) {
      this.log('error', `Failed to create offer: ${error.message}`);
    }
  }

  /**
   * Handle answer from receiver
   */
  async handleAnswer(answer) {
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      this.log('success', 'Answer received and set');
    } catch (error) {
      this.log('error', `Failed to handle answer: ${error.message}`);
    }
  }

  /**
   * Setup data channel for scroll commands
   */
  setupDataChannel(channel) {
    channel.onopen = () => {
      this.log('success', 'Data channel opened');
      this.dataChannel = channel;
    };

    channel.onclose = () => {
      this.log('warning', 'Data channel closed');
    };

    channel.onmessage = (event) => {
      this.handleScrollCommand(JSON.parse(event.data));
    };

    channel.onerror = (error) => {
      this.log('error', `Data channel error: ${error.message}`);
    };
  }

  /**
   * Handle scroll command from mobile receiver
   */
  handleScrollCommand(command) {
    const { dx, dy } = command;
    
    // Execute scroll with some smoothing
    window.scrollBy({
      left: dx,
      top: dy,
      behavior: 'auto' // Use auto for immediate response
    });

    this.stats.scrollCount++;
    this.elements.scrollCount.textContent = this.stats.scrollCount;

    // Optional: Log every nth scroll to reduce spam
    if (this.stats.scrollCount % 10 === 0) {
      this.log('info', `Scrolled: dx=${dx}, dy=${dy}`);
    }
  }

  /**
   * Send signaling message to receiver
   */
  sendSignalingMessage(message) {
    if (this.signalingSocket && this.signalingSocket.readyState === WebSocket.OPEN) {
      this.signalingSocket.send(JSON.stringify(message));
    }
  }

  /**
   * Start collecting WebRTC statistics
   */
  startStatsCollection() {
    setInterval(() => {
      this.collectStats();
    }, 2000); // Update every 2 seconds
  }

  /**
   * Collect and display WebRTC statistics
   */
  async collectStats() {
    if (!this.peerConnection) return;

    try {
      const stats = await this.peerConnection.getStats();

      stats.forEach(report => {
        // Video outbound stats
        if (report.type === 'outbound-rtp' && report.kind === 'video') {
          if (report.framesSent !== undefined) {
            this.elements.frameCount.textContent = report.framesSent;
          }

          if (report.bytesSent !== undefined) {
            const bytesSent = report.bytesSent;
            const bytesDiff = bytesSent - this.stats.lastBytesCount;
            this.stats.lastBytesCount = bytesSent;

            // Calculate bitrate (bytes to bits, scale to Mbps)
            const bitrate = (bytesDiff * 8) / 2000000; // Divide by 2M for 2-second interval
            this.elements.bitrate.textContent = bitrate.toFixed(2);
          }
        }
      });
    } catch (error) {
      this.log('warning', `Failed to collect stats: ${error.message}`);
    }
  }

  /**
   * Stop screen sharing
   */
  async stop() {
    try {
      this.log('info', 'Stopping screen sharing...');

      // Stop screen stream
      if (this.screenStream) {
        this.screenStream.getTracks().forEach(track => track.stop());
        this.screenStream = null;
      }

      // Close data channel
      if (this.dataChannel) {
        this.dataChannel.close();
        this.dataChannel = null;
      }

      // Close peer connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      // Close signaling connection
      if (this.signalingSocket) {
        this.signalingSocket.close();
        this.signalingSocket = null;
      }

      // Update UI
      this.elements.screenPreview.srcObject = null;
      this.elements.previewPlaceholder.style.display = 'block';
      this.elements.startBtn.disabled = false;
      this.elements.stopBtn.disabled = true;
      this.elements.copySessionBtn.disabled = true;

      this.updateConnectionStatus('disconnected', 'Stopped');
      this.log('success', 'Screen sharing stopped');

    } catch (error) {
      this.log('error', `Failed to stop: ${error.message}`);
    }
  }

  /**
   * Copy session ID to clipboard
   */
  copySessionId() {
    if (this.sessionId) {
      navigator.clipboard.writeText(this.sessionId).then(() => {
        this.log('success', `Session ID copied: ${this.sessionId}`);
      }).catch(() => {
        this.log('error', 'Failed to copy session ID');
      });
    }
  }

  /**
   * Update connection status UI
   */
  updateConnectionStatus(status, message) {
    this.elements.connectionStatus.className = `status-indicator ${status}`;
    this.elements.statusText.textContent = message;
    
    const details = [
      `Status: ${status}`,
      `Peer ID: ${this.peerId || 'N/A'}`,
      `Session: ${this.sessionId || 'N/A'}`,
      `Time: ${new Date().toLocaleTimeString()}`
    ];
    
    this.elements.statusDetails.textContent = details.join('\n');
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log message to console and UI
   */
  log(level, message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${level.toUpperCase()}] ${message}`);

    // Add to log container
    const entry = document.createElement('div');
    entry.className = `log-entry ${level}`;
    entry.innerHTML = `<span class="log-timestamp">[${timestamp}]</span> ${message}`;
    
    this.elements.logContainer.appendChild(entry);
    
    // Keep only last 50 entries
    const entries = this.elements.logContainer.querySelectorAll('.log-entry');
    if (entries.length > 50) {
      entries[0].remove();
    }

    // Auto-scroll to bottom
    this.elements.logContainer.scrollTop = this.elements.logContainer.scrollHeight;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.remoteScreenSender = new RemoteScreenSender();
});
