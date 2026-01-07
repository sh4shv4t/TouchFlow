# Troubleshooting Guide - Remote Screen Controller

## Connection Failed - Common Issues & Solutions

### Quick Diagnosis

**Step 1:** Check if signaling is working
- Look at server terminal output
- Should see: `[INFO] Sent stored offer from ... to receiver`
- **If present**: Signaling works, P2P connectivity is the issue
- **If missing**: Mobile didn't connect to server at all

**Step 2:** Check browser console (Laptop)
- Press F12 → Console tab
- Look for ICE candidates
- **If you see**: `📡 ICE Candidate: candidate:xxxx...` - ICE is trying
- **If connection fails after**: Network/NAT is blocking P2P

---

## Issue: "Connection failed" Status

### Symptoms
- Laptop shows: "Connection failed" and "Connection state: failed"
- Server logs show: Offer sent, Answer received, but no connection
- Mobile shows: "Waiting for video stream" then times out

### Root Causes & Solutions

#### **Cause #1: WSL2 Network Isolation** ⭐ Most Likely

**Problem**: You're running the server in Windows Subsystem for Linux (WSL2), and your mobile/laptop accessing from Windows has network isolation issues.

**Solution**:
1. Install Node.js natively on Windows
2. Stop WSL server: Kill the terminal or Ctrl+C
3. Open PowerShell (native Windows, not WSL)
4. Navigate to project: `cd "C:\Users\Shashvat Singh\Desktop\projects\RemoteController"`
5. Run: `npm start`
6. Now access both with same IP: `http://172.22.195.183:8080`

**Verify**: Check server output shows:
```
📡 WebSocket URL: ws://172.22.195.183:8080
💻 Laptop: http://172.22.195.183:8080/laptop
📱 Mobile: http://172.22.195.183:8080
```

---

#### **Cause #2: Different Networks**

**Problem**: Laptop and mobile are on different networks (different WiFi, cellular vs WiFi, different subnets).

**Symptoms**: 
- Server works fine
- WebSocket connects
- ICE fails to find common path

**Solution**:
1. Open mobile WiFi settings
2. Connect to same network as laptop
3. Verify by opening: `http://172.22.195.183:8080/health`
4. Should see: "OK"
5. Retry connection

---

#### **Cause #3: Firewall Blocking UDP**

**Problem**: Firewall blocks UDP traffic needed for WebRTC.

**Symptoms**:
- ICE candidates are generated
- But connection goes immediately to "failed"
- No TURN candidates appear

**Solution for Home Network**:
1. Open router admin (usually 192.168.1.1)
2. Find UPnP/NAT-PMP settings
3. Enable "UPnP" for automatic port mapping
4. Retry connection

**Solution for Corporate Network**:
- Contact IT/Network team
- Request opening UDP 5000-65535
- Or request TURN server access
- Or use VPN that supports WebRTC

---

#### **Cause #4: STUN/TURN Servers Not Responding**

**Problem**: Public STUN/TURN servers are down, blocked, or rate-limited.

**Symptoms**:
- ICE gathering takes 30+ seconds
- Few or no candidates generated
- "ICE gathering complete" appears late

**Solution - Try Manual Server**:

Create `turn-server.js`:
```bash
npm install coturn
```

Or use Docker:
```bash
docker run -d --name coturn \
  -p 3478:3478/tcp -p 3478:3478/udp \
  instrumentisto/coturn
```

Then update `laptop/sender.js` and `phone/controller.js`:
```javascript
const iceServers = [
  { urls: ['stun:stun.l.google.com:19302'] },
  {
    urls: ['turn:localhost:3478'],
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];
```

---

### Advanced Diagnostics

#### **Check WebSocket Connection**

```javascript
// Run in browser console (F12):
// If this shows "open", signaling is working
console.log('WebSocket state:', 
  window.remoteScreenReceiver?.signalingSocket?.readyState
);
// 1 = OPEN (good), 2/3 = CLOSED (bad)
```

#### **Check ICE Candidates**

```javascript
// Run in browser console (F12):
// Get detailed ICE info
window.remoteScreenReceiver?.peerConnection?.getStats()
  .then(stats => {
    stats.forEach(report => {
      if (report.type === 'candidate-pair') {
        console.log('Candidate Pair:', {
          state: report.state,
          currentRoundTripTime: report.currentRoundTripTime,
          availableOutgoingBitrate: report.availableOutgoingBitrate
        });
      }
    });
  });
```

#### **Monitor Connection State**

```javascript
// Run in browser console to watch connection states
const peer = window.remoteScreenReceiver?.peerConnection;
peer?.onconnectionstatechange = () => {
  console.log(`State: ${peer.connectionState}`);
};
peer?.oniceconnectionstatechange = () => {
  console.log(`ICE: ${peer.iceConnectionState}`);
};
```

---

## Network Requirements Checklist

Use this checklist to verify your network is compatible:

- [ ] Both devices on same WiFi network
- [ ] Can access `http://serverIP:8080/health` from mobile (shows "OK")
- [ ] Server running on native OS (not WSL2)
- [ ] Both devices using modern browsers (Chrome 90+, Firefox 88+, Safari 14.1+)
- [ ] Server machine has stable local IP (not changing)
- [ ] Firewall allows UDP traffic on port 5000-65535
- [ ] No restrictive proxy/firewall between devices
- [ ] ISP allows P2P connections (not carrier-grade NAT on mobile)

**Failed checklist items = Likely causes of failure**

---

## Network Diagnostic Commands

### Verify Network Connectivity

```bash
# From mobile, test server reachability:
curl http://172.22.195.183:8080/health
# Expected output: OK

# Check IP address:
ipconfig /all  # Windows
ifconfig       # Linux/Mac

# Look for: Same subnet (first 3 octets should match)
# Example: Both on 172.22.195.x = Good
```

### Check Firewall (Windows)

```powershell
# Check if port 8080 is open
Test-NetConnection -ComputerName 172.22.195.183 -Port 8080
# Should show: TcpTestSucceeded : True

# Check if UDP is possible
netsh advfirewall show allprofiles
```

### Monitor Server

```bash
# Watch server logs in real-time
npm start

# In another terminal, watch for connections:
netstat -an | findstr ESTABLISHED  # Windows
lsof -i :8080                       # Mac/Linux
```

---

## Still Not Working?

### Try These in Order

1. **Restart Everything**
   - Kill server (Ctrl+C)
   - Close browser on both devices
   - Restart router/WiFi
   - Run `npm start` again
   - Open fresh browser tabs

2. **Check Exact Error Messages**
   - Take screenshot of laptop console
   - Share terminal output with server logs
   - These help identify specific issue

3. **Verify Server Binary Path**
   - Ensure Node.js is installed: `node --version`
   - Should show v16+ or later
   - Run: `npm list ws` to verify WebSocket library installed

4. **Use Simple Network Test**
   - From Windows PowerShell:
     ```powershell
     $web = New-Object System.Net.WebClient
     $web.DownloadString("http://172.22.195.183:8080/health")
     # Should output: OK
     ```

5. **Try Different Laptop**
   - If available, test on another Windows/Mac machine
   - This rules out device-specific network issues

---

## Performance Issues (Connection Works But Slow)

### Symptoms
- Video appears but is choppy/laggy
- Scrolling commands delayed
- High latency (> 500ms)

### Causes & Solutions

| Symptom | Cause | Fix |
|---------|-------|-----|
| **Choppy Video** | Network congestion | Reduce video quality in settings, or move closer to router |
| **Scroll Lag** | Wireless interference | Switch to 5GHz WiFi, move away from other devices |
| **Delay** | WiFi weak | Check WiFi strength (should be -60dBm or better) |
| **Frame Drops** | CPU overload | Close other programs, reduce screen resolution |

### Network Bandwidth Test

```bash
# Test WiFi speed:
# Use app like "Speedtest" on mobile
# Should have: 
#   - Download: > 10 Mbps
#   - Upload: > 5 Mbps  
#   - Latency: < 50ms

# If slower, move closer to router or check for interference
```

---

## Getting Help

If the issue persists, please provide:

1. **Server Terminal Output** (first 30 lines):
   ```
   ✅ WebRTC Signaling Server running...
   [✅ NEW CONNECTION] Peer connected: peer_xxx
   ...
   ```

2. **Laptop Browser Console** (F12 → Console):
   - Any error messages (red text)
   - ICE candidate logs
   - Connection state changes

3. **Your Network Setup**:
   - OS (Windows/Mac/Linux, WSL or native?)
   - Network type (home WiFi, corporate, cellular?)
   - Any proxies or VPNs?

4. **Device Info**:
   - Laptop: OS version, browser name/version
   - Mobile: iOS/Android, browser name/version

---

## Quick Reference: Common Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| `Cannot read properties of undefined (reading 'getDisplayMedia')` | Browser doesn't support WebRTC | Update browser, or use HTTPS instead of HTTP |
| `Error: Controller not initialized` | JavaScript file not loading | Hard refresh (Ctrl+Shift+R), clear cache |
| `WebSocket connection failed` | Can't reach signaling server | Check IP address, ensure server is running |
| `Connection timeout after 10s` | Server unreachable | Verify firewall allows TCP 8080 |
| `ICE connection state: disconnected` | P2P failed | See [Root Causes & Solutions](#root-causes--solutions) above |
| `No suitable candidate found` | Network incompatible | Check NAT type, enable UPnP, or set up TURN server |

---

**Last Updated:** January 7, 2026  
**Tested On:** Windows 11, Node.js 18+, Chrome 120+, Safari 17+
