/**
 * Remote Screen Receiver (Mobile Controller)
 * 
 * Responsibilities:
 * - Connect to signaling server and establish WebRTC connection
 * - Receive video stream from laptop sender
 * - Display video fullscreen on mobile
 * - Capture touch gestures (drag up/down/left/right)
 * - Compute scroll deltas from touch movements
 * - Send scroll commands to sender via DataChannel
 * - Handle connection state and reconnection
 */

class RemoteScreenReceiver {
  constructor() {
    // Configuration - Auto-detect signaling server URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = window.location.port ? window.location.port : (window.location.protocol === 'https:' ? 443 : 80);
    this.signalingUrl = `${protocol}//${host}:${port}`;
    
    console.log(`🔧 AUTO-DETECTED CONFIG:`);
    console.log(`   Protocol: ${protocol}`);
    console.log(`   Host: ${host}`);
    console.log(`   Port: ${port}`);
    console.log(`   Signaling URL: ${this.signalingUrl}`);
    
    // Immediately try to update the config display
    const configText = document.getElementById('configText');
    if (configText) {
      configText.textContent = `WS: ${protocol} | Host: ${host} | Port: ${port}`;
      console.log('✅ Config text updated');
    } else {
      console.error('❌ configText element not found');
    }
    
    const urlField = document.getElementById('signalingUrl');
    if (urlField) {
      urlField.value = this.signalingUrl;
      console.log('✅ URL field updated');
    } else {
      console.error('❌ signalingUrl field not found');
    }
    
    this.sessionId = null;
    this.peerConnection = null;
    this.signalingSocket = null;
    this.dataChannel = null;
    this.peerId = null;

    // Touch handling
    this.touchState = {
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      isActive: false
    };

    // Settings
    this.scrollSensitivity = 1.0;
    this.enableDebugStats = false;

    // Statistics
    this.stats = {
      scrollEventsSent: 0,
      lastPingTime: Date.now()
    };

    // DOM Elements
    this.elements = {
      mainContainer: document.getElementById('mainContainer'),
      setupPanel: document.getElementById('setupPanel'),
      videoContainer: document.getElementById('videoContainer'),
      signalingUrl: document.getElementById('signalingUrl'),
      sessionIdInput: document.getElementById('sessionIdInput'),
      connectBtn: document.getElementById('connectBtn'),
      setupStatus: document.getElementById('setupStatus'),
      remoteVideo: document.getElementById('remoteVideo'),
      disconnectBtn: document.getElementById('disconnectBtn'),
      connectionStatusText: document.getElementById('connectionStatusText'),
      settingsBtn: document.getElementById('settingsBtn'),
      settingsPanel: document.getElementById('settingsPanel'),
      closeSettingsBtn: document.getElementById('closeSettingsBtn'),
      sensitivitySlider: document.getElementById('sensitivitySlider'),
      sensitivityValue: document.getElementById('sensitivityValue'),
      fullscreenToggle: document.getElementById('fullscreenToggle'),
      touchFeedback: document.getElementById('touchFeedback'),
      debugStats: document.getElementById('debugStats'),
      scrollEventCount: document.getElementById('scrollEventCount'),
      pingMs: document.getElementById('pingMs'),
      debugConnectionState: document.getElementById('debugConnectionState')
    };

    this.initializeEventListeners();
    this.log('Receiver initialized and ready');
  }

  /**
   * Initialize all UI event listeners
   */
  initializeEventListeners() {
    // Connection setup
    this.elements.connectBtn.addEventListener('click', () => this.connect());
    this.elements.sessionIdInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.connect();
    });

    // Disconnect
    this.elements.disconnectBtn.addEventListener('click', () => this.disconnect());

    // Settings
    this.elements.settingsBtn.addEventListener('click', () => {
      this.elements.settingsPanel.style.display = 'block';
    });

    this.elements.closeSettingsBtn.addEventListener('click', () => {
      this.elements.settingsPanel.style.display = 'none';
    });

    // Sensitivity
    this.elements.sensitivitySlider.addEventListener('input', (e) => {
      this.scrollSensitivity = parseFloat(e.target.value);
      this.elements.sensitivityValue.textContent = this.scrollSensitivity.toFixed(1) + 'x';
    });

    // Fullscreen
    this.elements.fullscreenToggle.addEventListener('change', () => {
      this.toggleFullscreen();
    });

    // Touch events
    this.elements.videoContainer.addEventListener('touchstart', (e) => this.handleTouchStart(e), false);
    this.elements.videoContainer.addEventListener('touchmove', (e) => this.handleTouchMove(e), false);
    this.elements.videoContainer.addEventListener('touchend', (e) => this.handleTouchEnd(e), false);

    // Prevent default scrolling on mobile
    document.addEventListener('touchmove', (e) => {
      if (this.elements.videoContainer.style.display !== 'none') {
        e.preventDefault();
      }
    }, { passive: false });
  }

  /**
   * Connect to sender via signaling server
   */
  async connect() {
    try {
      const sessionId = this.elements.sessionIdInput.value.trim();
      if (!sessionId) {
        this.showStatus('Please enter a session ID', 'error');
        return;
      }

      this.sessionId = sessionId;
      
      // Use manual URL if provided, otherwise use auto-detected
      const manualUrl = this.elements.signalingUrl.value.trim();
      if (manualUrl) {
        this.signalingUrl = manualUrl;
      }

      this.showStatus('Connecting...', '');
      this.elements.connectBtn.disabled = true;

      this.log(`Connecting to signaling server: ${this.signalingUrl}`);

      // Connect to signaling server
      await this.connectToSignaling();

      // Create WebRTC peer connection
      this.createPeerConnection();

      // Register as receiver
      this.registerAsReceiver();

      this.log('Connected to signaling server');

    } catch (error) {
      this.showStatus(`Connection failed: ${error.message}`, 'error');
      this.elements.connectBtn.disabled = false;
      this.log(`Connection error: ${error.message}`);
    }
  }

  /**
   * Connect to WebSocket signaling server
   */
  connectToSignaling() {
    return new Promise((resolve, reject) => {
      try {
        console.log(`📡 Attempting WebSocket connection to: ${this.signalingUrl}`);
        this.log(`Connecting to: ${this.signalingUrl}`);
        
        this.signalingSocket = new WebSocket(this.signalingUrl);

        this.signalingSocket.onopen = () => {
          console.log('✅ WebSocket OPEN - Connected to signaling server');
          this.log('✅ WebSocket connected to signaling server');
          resolve();
        };

        this.signalingSocket.onmessage = (event) => {
          console.log('📩 Received message:', event.data);
          this.handleSignalingMessage(JSON.parse(event.data));
        };

        this.signalingSocket.onerror = (error) => {
          console.error('❌ WebSocket ERROR:', error);
          this.log(`❌ WebSocket error: ${error.message || error}`);
          const message = `Connection failed. Server: ${this.signalingUrl}`;
          this.showStatus(message, 'error');
          reject(new Error('WebSocket connection failed'));
        };

        this.signalingSocket.onclose = (event) => {
          console.log('❌ WebSocket CLOSED:', event.code, event.reason);
          this.log(`WebSocket connection closed (code: ${event.code})`);
          this.updateConnectionStatus('disconnected');
        };

        // Timeout after 10 seconds
        setTimeout(() => {
          if (this.signalingSocket.readyState !== WebSocket.OPEN) {
            console.error('⏱️ WebSocket timeout - connection took too long');
            this.showStatus(`Connection timeout after 10s. URL: ${this.signalingUrl}`, 'error');
            reject(new Error('Signaling connection timeout'));
          }
        }, 10000);

      } catch (error) {
        console.error('💥 Exception:', error);
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
        this.log(`Assigned peer ID: ${peerId}`);
        break;

      case 'registered':
        this.log('Registered as receiver');
        break;

      case 'offer':
        this.handleOffer(offer);
        break;

      case 'ice-candidate':
        if (candidate) {
          this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
            .catch(e => this.log(`Failed to add ICE candidate: ${e.message}`));
        }
        break;

      case 'peer-disconnected':
        this.log('Sender disconnected');
        this.showStatus('Sender disconnected', 'error');
        this.updateConnectionStatus('disconnected');
        break;

      case 'error':
        this.log(`Signaling error: ${message.message}`);
        this.showStatus(`Signaling error: ${message.message}`, 'error');
        break;
    }
  }

  /**
   * Register as receiver on signaling server
   */
  registerAsReceiver() {
    if (this.signalingSocket && this.signalingSocket.readyState === WebSocket.OPEN) {
      this.signalingSocket.send(JSON.stringify({
        type: 'register',
        role: 'receiver'
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
      iceServers
    });

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      this.log(`Received remote track: ${event.track.kind}`);
      this.elements.remoteVideo.srcObject = event.streams[0];
      this.showVideo();
      this.updateConnectionStatus('connected');
    };

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
      this.log(`Connection state: ${state}`);
      this.updateDebugConnectionState(state);

      if (state === 'failed' || state === 'disconnected') {
        this.updateConnectionStatus('disconnected');
      }
    };

    // Data channel for receiving scroll commands
    this.peerConnection.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };
  }

  /**
   * Handle incoming offer from sender
   */
  async handleOffer(offer) {
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      this.log('Offer received and set');

      // Create and send answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.sendSignalingMessage({
        type: 'answer',
        sessionId: this.sessionId,
        answer: answer
      });

      this.log('Answer sent to sender');

    } catch (error) {
      this.log(`Failed to handle offer: ${error.message}`);
    }
  }

  /**
   * Setup data channel for sending scroll commands
   */
  setupDataChannel(channel) {
    this.dataChannel = channel;

    channel.onopen = () => {
      this.log('Data channel opened');
      this.updateConnectionStatus('connected');
    };

    channel.onclose = () => {
      this.log('Data channel closed');
      this.updateConnectionStatus('disconnected');
    };

    channel.onerror = (error) => {
      this.log(`Data channel error: ${error.message}`);
    };
  }

  /**
   * Send signaling message to sender
   */
  sendSignalingMessage(message) {
    if (this.signalingSocket && this.signalingSocket.readyState === WebSocket.OPEN) {
      this.signalingSocket.send(JSON.stringify(message));
    }
  }

  /**
   * Handle touch start event
   */
  handleTouchStart(e) {
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    this.touchState.startX = touch.clientX;
    this.touchState.startY = touch.clientY;
    this.touchState.lastX = touch.clientX;
    this.touchState.lastY = touch.clientY;
    this.touchState.isActive = true;

    this.showTouchFeedback(touch.clientX, touch.clientY);
  }

  /**
   * Handle touch move event (scrolling)
   */
  handleTouchMove(e) {
    if (!this.touchState.isActive || e.touches.length !== 1) return;

    e.preventDefault();

    const touch = e.touches[0];
    const dx = touch.clientX - this.touchState.lastX;
    const dy = touch.clientY - this.touchState.lastY;

    // Update last position
    this.touchState.lastX = touch.clientX;
    this.touchState.lastY = touch.clientY;

    // Only send if movement is significant (avoid noise)
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      this.sendScrollCommand(dx, dy);
      this.showTouchFeedback(touch.clientX, touch.clientY);
    }
  }

  /**
   * Handle touch end event
   */
  handleTouchEnd(e) {
    this.touchState.isActive = false;
    this.elements.touchFeedback.classList.remove('active');
  }

  /**
   * Send scroll command to sender via data channel
   */
  sendScrollCommand(dx, dy) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      return;
    }

    try {
      // Apply sensitivity scaling and invert for natural scrolling direction
      const scrollDx = -dx * this.scrollSensitivity;
      const scrollDy = -dy * this.scrollSensitivity;

      this.dataChannel.send(JSON.stringify({
        dx: scrollDx,
        dy: scrollDy
      }));

      this.stats.scrollEventsSent++;
      this.elements.scrollEventCount.textContent = this.stats.scrollEventsSent;

    } catch (error) {
      this.log(`Failed to send scroll command: ${error.message}`);
    }
  }

  /**
   * Show touch feedback on screen
   */
  showTouchFeedback(x, y) {
    const feedback = this.elements.touchFeedback;
    feedback.style.left = (x - 25) + 'px';
    feedback.style.top = (y - 25) + 'px';
    feedback.classList.add('active');
  }

  /**
   * Show video and hide setup panel
   */
  showVideo() {
    this.elements.setupPanel.style.display = 'none';
    this.elements.videoContainer.style.display = 'block';
    this.showStatus('', '');

    // Apply fullscreen if enabled
    if (this.elements.fullscreenToggle.checked) {
      this.toggleFullscreen();
    }
  }

  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen() {
    const videoContainer = this.elements.videoContainer;

    if (this.elements.fullscreenToggle.checked) {
      if (videoContainer.requestFullscreen) {
        videoContainer.requestFullscreen().catch(err => {
          this.log(`Fullscreen request failed: ${err.message}`);
        });
      } else if (videoContainer.webkitRequestFullscreen) {
        videoContainer.webkitRequestFullscreen();
      } else if (videoContainer.mozRequestFullScreen) {
        videoContainer.mozRequestFullScreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => {
          this.log(`Exit fullscreen failed: ${err.message}`);
        });
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      }
    }
  }

  /**
   * Show setup status message
   */
  showStatus(message, className) {
    this.elements.setupStatus.textContent = message;
    this.elements.setupStatus.className = 'status-message ' + className;
  }

  /**
   * Update connection status indicator
   */
  updateConnectionStatus(status) {
    const statusBadge = document.querySelector('.status-badge');
    const statusDot = document.querySelector('.status-dot');

    if (status === 'connected') {
      this.elements.connectionStatusText.textContent = 'Connected';
      if (statusDot) {
        statusDot.style.background = '#4ade80';
      }
    } else {
      this.elements.connectionStatusText.textContent = 'Disconnected';
      if (statusDot) {
        statusDot.style.background = '#ef4444';
      }
    }

    this.updateDebugConnectionState(status);
  }

  /**
   * Update debug connection state display
   */
  updateDebugConnectionState(state) {
    if (this.enableDebugStats) {
      this.elements.debugConnectionState.textContent = state || '-';
    }
  }

  /**
   * Disconnect from sender
   */
  async disconnect() {
    try {
      this.log('Disconnecting...');

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

      // Close video stream
      if (this.elements.remoteVideo.srcObject) {
        this.elements.remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        this.elements.remoteVideo.srcObject = null;
      }

      // Close signaling connection
      if (this.signalingSocket) {
        this.signalingSocket.close();
        this.signalingSocket = null;
      }

      // Reset UI
      this.elements.videoContainer.style.display = 'none';
      this.elements.setupPanel.style.display = 'flex';
      this.elements.connectBtn.disabled = false;
      this.elements.sessionIdInput.value = '';
      this.elements.settingsPanel.style.display = 'none';

      this.updateConnectionStatus('disconnected');
      this.showStatus('Disconnected', '');
      this.log('Disconnected successfully');

    } catch (error) {
      this.log(`Disconnect error: ${error.message}`);
    }
  }

  /**
   * Log message to console
   */
  log(message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.remoteScreenReceiver = new RemoteScreenReceiver();
});
