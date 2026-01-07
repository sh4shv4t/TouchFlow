# Deployment Guide

## Overview

This guide covers deploying Remote Screen Controller for production use, including local network, cloud deployment, and security considerations.

---

## 1. Local Network Deployment (Home/Office)

### Simplest Setup

This is the recommended approach for most users.

#### Step 1: Server Setup

```bash
# On your main computer/server
git clone https://github.com/yourusername/remote-screen-controller.git
cd remote-screen-controller
npm install
npm start
```

Server will run on: `ws://localhost:8080`

#### Step 2: Access from Mobile

1. Find server IP address:
   ```bash
   ipconfig          # Windows
   ifconfig          # macOS/Linux
   hostname -I       # Linux
   ```

2. On mobile, navigate to:
   ```
   http://YOUR_SERVER_IP:8080
   ```

   Example: `http://192.168.1.50:8080`

#### Step 3: Security (Optional)

For added security on trusted networks:

```bash
# Use a random signaling port (instead of default 8080)
PORT=49152 npm start

# Tell users the custom port
# Access: http://YOUR_SERVER_IP:49152
```

---

## 2. Cloud Deployment (Heroku, AWS, etc.)

### Deploy Signaling Server Only

The sender and receiver HTML/JS remain local and access a remote signaling server.

#### Heroku Deployment (Free/Paid Tiers)

**1. Create Heroku Account**
- Visit [heroku.com](https://heroku.com)
- Sign up and download Heroku CLI

**2. Create App**
```bash
heroku login
heroku create your-app-name
```

**3. Deploy**
```bash
git push heroku main
```

**4. Access**
```
Signaling Server: ws://your-app-name.herokuapp.com
Mobile URL: http://localhost:8080
```

**5. In browser, configure:**
```javascript
// laptop/sender.js
this.signalingUrl = 'ws://your-app-name.herokuapp.com';

// phone/controller.js
this.signalingUrl = 'ws://your-app-name.herokuapp.com';
```

#### AWS EC2 Deployment

**1. Launch EC2 Instance**
```bash
# Choose Ubuntu 20.04 LTS, t2.micro (eligible for free tier)
# Create security group with inbound rules:
# - Port 8080 (WebSocket)
# - Port 22 (SSH)
```

**2. Connect and Setup**
```bash
ssh -i your-key.pem ubuntu@your-instance-ip
sudo apt update
sudo apt install nodejs npm
git clone https://github.com/yourusername/remote-screen-controller.git
cd remote-screen-controller
npm install
```

**3. Run with PM2 (Process Manager)**
```bash
npm install -g pm2
pm2 start signaling/server.js --name "webrtc-signaling"
pm2 startup
pm2 save
```

**4. Configure Signaling URL**
```javascript
// Use your EC2 public IP or domain
this.signalingUrl = 'ws://your-ec2-ip:8080';
```

---

## 3. Using TURN Server (For P2P Over Internet)

When deploying over the internet (not local network), you may need a TURN server for NAT traversal.

### Why TURN?

- **P2P Limitation**: WebRTC can't connect through many firewalls/NATs
- **Solution**: TURN relay server acts as intermediary
- **Cost**: Bandwidth-based billing (can be expensive)

### Adding TURN Configuration

**Update sender.js:**
```javascript
createPeerConnection() {
  const iceServers = [
    { urls: ['stun:stun.l.google.com:19302'] },
    {
      urls: ['turn:your-turn-server.com'],
      username: 'user',
      credential: 'pass'
    }
  ];
  
  this.peerConnection = new RTCPeerConnection({ iceServers });
}
```

### Free TURN Servers (Limited)

- **Xirsys**: [xirsys.com](https://xirsys.com) - Free tier available
- **Twilio**: [twilio.com/webrtc](https://twilio.com/webrtc) - Pay-as-you-go
- **Self-hosted**: [coturn](https://github.com/coturn/coturn) - Open source

---

## 4. Docker Deployment

### Create Dockerfile

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 8080

CMD ["node", "signaling/server.js"]
```

### Build and Run

```bash
docker build -t remote-screen-controller .
docker run -p 8080:8080 remote-screen-controller
```

### Docker Compose (with TURN)

```yaml
version: '3'
services:
  signaling:
    build: .
    ports:
      - "8080:8080"
    environment:
      PORT: 8080
    restart: unless-stopped
  
  turn:
    image: coturn/coturn:latest
    ports:
      - "3478:3478/tcp"
      - "3478:3478/udp"
    volumes:
      - ./turnserver.conf:/etc/coturn/turnserver.conf:ro
```

---

## 5. Nginx Reverse Proxy

### For HTTPS and Load Balancing

**nginx.conf:**
```nginx
upstream websocket_backend {
    server localhost:8080;
}

server {
    listen 443 ssl http2;
    server_name remote-screen.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass ws://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name remote-screen.example.com;
    return 301 https://$server_name$request_uri;
}
```

**Reload:**
```bash
sudo nginx -s reload
```

---

## 6. SSL/HTTPS Setup

### Self-Signed Certificate (Testing)

```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

### Let's Encrypt (Production)

```bash
# Using certbot
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com

# Certificate location:
# /etc/letsencrypt/live/your-domain.com/
```

---

## 7. Environment Variables

### Configure via .env

Create `.env`:
```bash
PORT=8080
NODE_ENV=production
LOG_LEVEL=info
MAX_SESSIONS=100
SESSION_TIMEOUT=3600000
```

Update `signaling/server.js`:
```javascript
require('dotenv').config();

const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';
```

---

## 8. Monitoring and Logging

### PM2 Monitoring

```bash
npm install -g pm2
pm2 start signaling/server.js --name "webrtc-sig"
pm2 logs webrtc-sig
pm2 monit
```

### Logging to File

Update `signaling/server.js`:
```javascript
const fs = require('fs');
const logStream = fs.createWriteStream('signaling.log', { flags: 'a' });

console.log = (...args) => {
  const msg = args.join(' ');
  logStream.write(`[${new Date().toISOString()}] ${msg}\n`);
  process.stdout.write(`${msg}\n`);
};
```

### Health Check Endpoint

```bash
# Check server status
curl http://localhost:8080/health

# Response: OK (200)
```

---

## 9. Load Balancing

### Multiple Signaling Servers

```
┌─────────────────────┐
│  Load Balancer      │
│  (HAProxy/Nginx)    │
└──────────┬──────────┘
           │
    ┌──────┼──────┐
    │      │      │
┌───▼─┐ ┌──▼──┐ ┌─▼───┐
│ Sig │ │ Sig │ │ Sig │
│ S1  │ │ S2  │ │ S3  │
└─────┘ └─────┘ └─────┘
```

**HAProxy Config:**
```
global
    log stdout local0
    log stdout local1 notice

defaults
    log     global
    mode    tcp
    timeout connect 5s
    timeout client 50s
    timeout server 50s

listen webrtc_signaling
    bind *:8080
    mode tcp
    balance roundrobin
    server sig1 127.0.0.1:8081 check
    server sig2 127.0.0.1:8082 check
    server sig3 127.0.0.1:8083 check
```

---

## 10. Security Checklist

- [ ] Firewall configured (only necessary ports open)
- [ ] WebSocket secured with SSL/TLS (wss://)
- [ ] Signaling server runs as non-root user
- [ ] No sensitive data in logs
- [ ] Rate limiting enabled (prevent abuse)
- [ ] Auto-scaling configured (if cloud provider)
- [ ] Backups scheduled
- [ ] Monitoring alerts set up
- [ ] SSL certificates auto-renewed
- [ ] Dependencies regularly updated

---

## 11. Performance Optimization

### Server-Side

```javascript
// signaling/server.js

// Connection pooling
const MAX_CONNECTIONS = 1000;

// Message queue
const messageQueue = [];

// Rate limiting per peer
const rateLimiter = new Map();

// Cleanup stale sessions
setInterval(() => {
  const now = Date.now();
  sessions.forEach((session, id) => {
    if (now - session.lastActivity > 3600000) {
      sessions.delete(id);
    }
  });
}, 60000);
```

### Client-Side

```javascript
// Reduce log spam
const LOG_THROTTLE_MS = 100;
let lastLogTime = 0;

function throttledLog(msg) {
  const now = Date.now();
  if (now - lastLogTime > LOG_THROTTLE_MS) {
    console.log(msg);
    lastLogTime = now;
  }
}
```

---

## 12. Troubleshooting Deployment

### Server Won't Start
```bash
# Check port is available
lsof -i :8080  # macOS/Linux
netstat -ano | findstr :8080  # Windows

# Use different port
PORT=3000 npm start
```

### Connection Timeout
- Verify firewall allows port 8080
- Check security groups (AWS EC2)
- Ensure signaling server is running

### High Memory Usage
- Monitor with `pm2 monit`
- Reduce MAX_SESSIONS if needed
- Implement session cleanup

### WebSocket Disconnect
- Check network stability
- Verify proxy supports WebSocket
- Enable heartbeat/ping-pong

---

## 13. Scaling Strategies

### Horizontal Scaling
1. Multiple signaling servers
2. Load balancer (HAProxy, Nginx, or cloud native)
3. Session persistence (optional, not needed for stateless design)
4. TURN servers for media relay

### Vertical Scaling
1. Increase server resources (CPU, RAM)
2. Use faster network (dedicated connection)
3. Optimize Node.js (clustering)

### Example: Node.js Clustering

```javascript
const cluster = require('cluster');
const os = require('os');

if (cluster.isMaster) {
  const numCPUs = os.cpus().length;
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  // Start server
  server.listen(PORT);
}
```

---

## 14. Disaster Recovery

### Backup Strategy
```bash
# Backup logs daily
0 2 * * * tar -czf /backups/signaling-$(date +\%Y\%m\%d).tar.gz /var/log/signaling/
```

### Health Checks
```bash
# Monitor server availability
* * * * * curl -f http://localhost:8080/health || systemctl restart signaling
```

### Failover Setup
1. Primary and secondary servers
2. DNS failover or load balancer health checks
3. Automatic restart on crash

---

## Quick Reference

### Local Network (Fastest)
```bash
npm install && npm start
# Access: http://YOUR_IP:8080
```

### Cloud (Heroku)
```bash
heroku create your-app
git push heroku main
# Access: http://YOUR_APP.herokuapp.com
```

### Docker (Production)
```bash
docker build -t remote-screen .
docker run -p 8080:8080 remote-screen
```

### With TURN (Internet P2P)
```bash
# Add TURN server config to sender.js/controller.js
# Update ICE servers list
npm start
```

---

## Support

For deployment issues:
1. Check [GETTING_STARTED.md](./GETTING_STARTED.md)
2. Review [README.md - Troubleshooting](./README.md#troubleshooting)
3. Check server logs: `pm2 logs`
4. Verify network connectivity: `ping`, `netstat`
5. File issue on GitHub with logs and configuration

---

**Last Updated:** January 2024  
**Maintained By:** Remote Screen Controller Contributors
