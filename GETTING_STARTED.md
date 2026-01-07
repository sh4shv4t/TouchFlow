# Getting Started - Quick Guide

## 🚀 Start in 5 Minutes

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Signaling Server
```bash
npm start
```
You should see:
```
✅ WebRTC Signaling Server running on ws://localhost:8080
```

### 3. Open Laptop Interface
Navigate to:
```
file:///path/to/remote-screen-controller/laptop/index.html
```

Or use live server:
```bash
# Using Python 3
python -m http.server 8000
# Then visit: http://localhost:8000/laptop/index.html
```

### 4. Open Mobile Interface

**Find your laptop IP:**
```bash
# Windows
ipconfig

# macOS/Linux
ifconfig
```

Look for IPv4 address (usually `192.168.x.x` or `10.x.x.x`)

**On your mobile, navigate to:**
```
http://YOUR_LAPTOP_IP:8080
```

Example: `http://192.168.1.100:8080`

---

## 📋 Using the System

### On Laptop:
1. Click **"Start Screen Capture"**
2. Select which screen to share
3. Copy the generated **Session ID**

### On Mobile:
1. Paste the **Session ID**
2. Click **"Connect to Sender"**
3. **Drag your finger** up/down/left/right to scroll

---

## 🔧 Troubleshooting

### "Can't connect on mobile"
- Check laptop IP is correct
- Both devices must be on same WiFi
- Ensure port 8080 is not blocked

### "Scroll not working"
- Check "Data channel opened" in logs
- Verify sender page is scrollable
- Adjust sensitivity slider

### "Black video on mobile"
- Ensure you clicked "Start Screen Capture" on laptop
- Try refreshing mobile page
- Check browser logs for errors (press F12)

---

## 📊 Monitoring Connection

**Laptop:**
- Watch "Connection Status" panel
- Check "Statistics" for bitrate/frames
- Review "Event Log" for detailed info

**Mobile:**
- Status badge shows connection state
- Green dot = Connected, Red dot = Disconnected

---

## ⚙️ Advanced Configuration

### Change Signaling Server Port
```bash
PORT=3000 npm start
```

### Enable Mobile Debug Stats
In `phone/controller.js`, line ~50:
```javascript
this.enableDebugStats = true;  // Shows FPS, latency
```

### Adjust Scroll Sensitivity
Use the slider on mobile (⚙️ button) - range 0.5x to 3x

### Change Screen Capture Options
Edit `laptop/sender.js`:
```javascript
video: {
  cursor: 'always',
  frameRate: { ideal: 30 }  // Adjust FPS here
}
```

---

## 🌐 Network Connectivity

### Local Network (Recommended)
- **Best performance**: < 50ms latency
- **Setup**: Share laptop IP with mobile
- **Example**: `http://192.168.1.100:8080`

### Over Internet (Advanced)
1. Deploy signaling server to cloud (AWS, Heroku, etc.)
2. Use public IP address instead of localhost
3. Install TURN server for P2P relay (optional)

---

## 📱 Mobile Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | ✅ Yes |
| Safari | ✅ Yes |
| Firefox | ✅ Yes |
| Edge | ✅ Yes |
| Samsung Internet | ✅ Yes |
| Opera | ✅ Yes |

---

## 🎯 Next Steps

1. **Read Full Documentation**: See [README.md](./README.md)
2. **Customize**: Modify colors, settings, or features
3. **Deploy**: Host on your own server
4. **Contribute**: Submit PRs on GitHub

---

## 💡 Common Use Cases

### Presentation Mode
- Share laptop to projector
- Control slides from mobile
- Move around the room freely

### Remote Control
- Mirror to tablet on desk
- Control web content without touching laptop
- Useful for kiosk-style applications

### Accessibility
- Alternative input method
- Large touch targets vs. small mouse
- Useful for touch-friendly interfaces

### Demo Sessions
- Show your screen to multiple people
- Control presentation from mobile
- Professional appearance

---

## 🆘 Need Help?

1. **Check the logs**: Browser console (F12) shows detailed errors
2. **Read troubleshooting**: See [README.md - Troubleshooting](./README.md#troubleshooting)
3. **File an issue**: GitHub Issues for bug reports
4. **Check FAQ**: See [README.md - FAQ](./README.md#frequently-asked-questions)

---

**Quick Links:**
- [Full Documentation](./README.md)
- [Architecture Details](./README.md#webrtc-architecture)
- [API Reference](./README.md#api-reference)
- [Security Guide](./README.md#security-considerations)
