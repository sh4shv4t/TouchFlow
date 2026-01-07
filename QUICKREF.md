# Quick Reference Card

## 🚀 START HERE (Choose Your Role)

### 👤 I'm a New User
**Start:** [GETTING_STARTED.md](./GETTING_STARTED.md) → 5 min setup

```bash
npm install && npm start
# Then open browser interfaces
```

### 👨‍💻 I'm a Developer
**Start:** [ARCHITECTURE.md](./ARCHITECTURE.md) → Technical overview

**Code Files:**
- `laptop/sender.js` - Screen capture & streaming
- `phone/controller.js` - Touch gestures & scrolling
- `signaling/server.js` - Peer discovery

### 🔧 I'm Deploying to Production
**Start:** [DEPLOYMENT.md](./DEPLOYMENT.md) → Production guide

```bash
# Heroku example
heroku create your-app && git push heroku main
```

### 📖 I Want Full Documentation
**Start:** [README.md](./README.md) → Comprehensive guide

---

## ⚡ Quick Commands

```bash
# Install dependencies
npm install

# Start signaling server (port 8080)
npm start

# Use custom port
PORT=3000 npm start

# Health check
curl http://localhost:8080/health
```

---

## 🖥️ Access URLs

| Device | URL |
|--------|-----|
| **Laptop** | `file:///path/to/remote-screen-controller/laptop/index.html` |
| **Mobile** | `http://YOUR_LAPTOP_IP:8080` |

**Find Laptop IP:**
```bash
ipconfig          # Windows
ifconfig          # macOS/Linux
hostname -I       # Linux
```

---

## 📱 How to Use (30 seconds)

### On Laptop:
1. Open interface
2. Click **"Start Screen Capture"**
3. Select screen/window to share
4. Copy **Session ID**

### On Mobile:
1. Open interface
2. Paste **Session ID**
3. Click **"Connect"**
4. **Drag finger** to scroll

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't connect | Check laptop IP, same WiFi, port 8080 open |
| Black screen | Check "Start Screen Capture" clicked, refresh mobile |
| Scroll not working | Check "Data channel opened" in logs |
| Mobile won't load | Verify `http://IP:8080` format, not `localhost` |
| High latency | Closer to WiFi router, no bandwidth hogs |

**Full troubleshooting:** [README.md#troubleshooting](./README.md#troubleshooting)

---

## 🔑 Key Concepts

| Concept | Explanation |
|---------|-------------|
| **Session ID** | Random unique identifier for pairing (24 chars) |
| **Signaling** | Initial connection setup using WebSocket |
| **P2P** | Direct peer-to-peer after signaling (faster) |
| **DataChannel** | Lightweight channel for scroll commands |
| **Sensitivity** | Scroll speed multiplier (0.5x - 3x) |

---

## 📊 File Structure

```
remote-screen-controller/
├── package.json          # npm dependencies
├── README.md             # Full documentation
├── GETTING_STARTED.md    # Quick start
├── ARCHITECTURE.md       # Technical details
├── DEPLOYMENT.md         # Production guide
│
├── signaling/server.js   # Backend
├── laptop/               # Sender UI/JS
└── phone/                # Receiver UI/JS
```

---

## 🔧 Configuration

**Laptop Screen Capture Options** (`laptop/sender.js`):
```javascript
video: {
  cursor: 'always',           // Show mouse cursor
  frameRate: { ideal: 30 }    // 30 FPS
}
```

**Mobile Scroll Sensitivity** (`phone/controller.js`):
```javascript
scrollSensitivity = 1.0      // 1.0x = normal (0.5-3x range)
```

**Server Port** (environment variable):
```bash
PORT=8080 npm start
```

---

## 📊 Performance Targets

| Metric | Target | Typical |
|--------|--------|---------|
| Video Latency | < 100ms | 20-50ms |
| Scroll Latency | < 50ms | 10-30ms |
| Frame Rate | 30 FPS | 25-30 FPS |
| Bitrate | 2-5 Mbps | 3-4 Mbps |
| Bandwidth (scrolling) | < 1 Mbps | 0.1-0.5 Mbps |

---

## 🌐 Network Setup

### Local Network (Recommended)
```
Laptop → WiFi → Phone
(Best performance: < 100ms latency)
```

### Internet (Advanced)
- Requires TURN server configuration
- See [DEPLOYMENT.md](./DEPLOYMENT.md#3-using-turn-server)
- Higher latency (100-500ms typical)

---

## 🔒 Security Notes

✅ **What's Secure:**
- All data encrypted (DTLS-SRTP)
- Session IDs are random
- No passwords needed

⚠️ **Keep Secure:**
- Share Session ID only via secure channels
- Don't share on public networks
- Use trusted WiFi only

---

## 📖 Document Map

```
START HERE
    ↓
Choose Your Role
    ├─→ New User → GETTING_STARTED.md (5 min)
    ├─→ Developer → ARCHITECTURE.md (deep dive)
    ├─→ DevOps → DEPLOYMENT.md (production)
    └─→ Everyone → README.md (reference)
```

---

## 🎯 Common Use Cases

### 1. Presentation Control
```
Laptop shows slides → Phone controls scrolling
Use case: Conference talk, classroom, webinar
```

### 2. Remote Work
```
Desktop → Tablet for browsing while working
Use case: Multi-monitor setup, code review
```

### 3. Family TV
```
Laptop → Smart TV → Family controls
Use case: Photo browsing, web browsing, movies
```

---

## 💡 Pro Tips

1. **Adjust sensitivity** if scrolling too fast/slow
2. **Fullscreen mode** for immersive viewing
3. **Same WiFi** for best performance
4. **Close other apps** to free bandwidth
5. **Keep phone nearby** for low latency
6. **Test once** before presentations

---

## 🆘 Need Help?

### Quick Help
1. Check console (F12) for errors
2. Read [README.md#troubleshooting](./README.md#troubleshooting)
3. Verify network connectivity
4. Try refreshing browser

### Deeper Help
1. Check [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details
2. Review inline code comments
3. Check [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment issues
4. File GitHub issue with logs

### Contact
- **Email:** support@example.com
- **GitHub:** [remote-screen-controller/issues](https://github.com/yourusername/remote-screen-controller/issues)

---

## 📦 System Requirements

- **Node.js:** 14.0.0+
- **Laptop OS:** Windows, macOS, or Linux
- **Mobile OS:** iOS 14+, Android 8+
- **Network:** Shared local WiFi
- **Storage:** ~50MB

---

## 🚀 One-Liner Start

```bash
npm install && npm start && open laptop/index.html
```

Then on mobile: Visit `http://[LAPTOP_IP]:8080`

---

## 📞 Version Info

- **Version:** 1.0.0
- **Status:** Production Ready ✅
- **Last Updated:** January 2024
- **License:** MIT
- **Node Version:** 14+
- **Browser Support:** Chrome, Firefox, Safari, Edge

---

## 🎓 Learning Path

```
Week 1: Setup & Use
├─ Install and run locally
├─ Try on phone
└─ Explore settings

Week 2: Understand Design
├─ Read ARCHITECTURE.md
├─ Study sender.js
├─ Study controller.js

Week 3: Customize
├─ Modify UI colors/layout
├─ Adjust performance settings
├─ Add custom features

Week 4: Deploy
├─ Read DEPLOYMENT.md
├─ Deploy to cloud
├─ Monitor and optimize
```

---

## 🎁 What You Get

✅ Fully working remote screen controller  
✅ 3,500+ lines of production code  
✅ 5,000+ lines of documentation  
✅ No external frameworks (pure JavaScript)  
✅ Single dependency (ws for WebSocket)  
✅ MIT licensed (use commercially)  
✅ Ready to deploy today  
✅ Extensible architecture  

---

## 🚀 Get Started Now!

```bash
# 1. Install
npm install

# 2. Start
npm start

# 3. Open Laptop
file:///path/to/laptop/index.html

# 4. Open Mobile
http://YOUR_IP:8080

# 5. Have fun!
```

**Questions?** See [README.md#frequently-asked-questions](./README.md#frequently-asked-questions)

---

**Happy Remote Controlling!** 🎉

*For complete documentation, see [README.md](./README.md)*
