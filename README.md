# 💬 LocalChat — Self-Hosted Private LAN Communication Platform

**LocalChat** is a local-first, self-hosted communication system designed for high privacy and zero third-party dependencies. Run it on your PC or local server, and everyone connected to the same Wi-Fi / LAN can securely chat, share files, and hold real-time voice and video calls.

---

## 🌟 Key Features

1. **Zero Third-Party Dependencies**
   - No external paid services, no Twilio, no Cloudflare, no Firebase.
   - Everything runs directly on your local machine and private network.

2. **Strict Admin Approval Gate (Zero Trust)**
   - Simply connecting to the Wi-Fi does **not** grant access to chat.
   - When a user registers, their account is placed in `PENDING` status.
   - An **Administrator** must explicitly review and approve their account before they can log in.

3. **Private, Admin-Controlled Groups**
   - All groups are strictly private and invite-only.
   - Group messages are never broadcast; access is verified server-side on every request and socket event.

4. **Real-Time Direct & Group Messaging**
   - Instant messaging powered by **Socket.IO** and **MongoDB**.
   - Read receipts (`SENT`, `DELIVERED`, `READ`), live typing indicators, and online presence indicators.

5. **Local File & Media Sharing**
   - Send images, audio, video, and documents up to 100MB over high-speed LAN.
   - Protected streaming via authenticated backend routes.

6. **WebRTC Voice & Video Calling (LAN P2P)**
   - High-definition 1:1 and group audio/video calls using WebRTC peer-to-peer.
   - Includes in-call screen sharing, microphone mute, and camera toggle.
   - Signaling managed by the local Node.js server.

---

## 🏗️ Architecture

```text
                           CLIENT LAYER (Browser / Device)
               ┌──────────────────────────────────────────────────┐
               │         React (Vite) + TypeScript + Tailwind     │
               │  - Direct & Group Chat UI                        │
               │  - WebRTC Video & Audio Controls (P2P)           │
               │  - Attachment Upload & Media Player              │
               │  - Admin Approval & User Management Dashboard    │
               └────────────────────────┬─────────────────────────┘
                                        │
                               HTTPS / WSS (LAN IP)
                                        │
                                        ▼
               ┌──────────────────────────────────────────────────┐
               │             Node.js / Express Server             │
               │  - JWT & Password Hashing (bcrypt)               │
               │  - Admin Authorization Middleware                │
               │  - Socket.IO Messaging & WebRTC Signaling        │
               │  - Local HTTPS with auto-generated SSL certs     │
               └────────────────────────┬─────────────────────────┘
                                        │
                     ┌──────────────────┴──────────────────┐
                     ▼                                     ▼
           ┌───────────────────┐                 ┌───────────────────┐
           │   MongoDB Server  │                 │Local File Storage │
           │ - Users & Roles   │                 │ - Uploaded media  │
           │ - Groups & Members│                 │ - Attachments     │
           │ - Message History │                 └───────────────────┘
           └───────────────────┘
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** (v18+)
- **MongoDB** running locally on port `27017`

### 2. Launch with One Click (Windows)
Double-click `start-localchat.bat` in this directory, or run:
```bash
# Terminal 1 (Backend Server)
cd server
npm run dev

# Terminal 2 (Frontend Client)
cd client
npm run dev
```

### 3. Open in Browser
- **On Host PC**: [http://localhost:5173](http://localhost:5173) or [https://localhost:5173](https://localhost:5173)
- **On Other LAN Devices (Phones, Laptops)**: Open `http://<YOUR-HOST-IP>:5173` (e.g. `http://10.175.128.58:5173`)

---

## 🔑 Initial Admin Account

LocalChat automatically creates a default Administrator account upon initial startup:
- **Username**: `admin`
- **Password**: `admin123`

Log in with this account to:
- Review and approve new user registrations (`PENDING` -> `ACTIVE`).
- Block or unblock users.
- Create private groups and assign members.

---

## 🛡️ Note on Camera & Microphone Access (WebRTC)

Browsers (Chrome, Edge, Safari, Firefox) require a **Secure Context** (`https://` or `localhost`) to grant camera and microphone access (`getUserMedia`).
- When accessing from `localhost`, voice & video calls work out of the box.
- When accessing from other devices over Wi-Fi (`https://10.175.128.58`), accept the self-signed local certificate prompt in your browser to allow full audio/video permissions.

---

## 📁 Project Structure

```text
D:\LocalChat/
├── server/                    # Node.js + Express + TypeScript + Socket.IO
│   ├── src/
│   │   ├── config/            # MongoDB connection & Admin seeder
│   │   ├── middleware/        # Auth, Admin role verification, Multer upload
│   │   ├── models/            # User, Group, GroupMember, Conversation, Message
│   │   ├── routes/            # /auth, /admin, /groups, /chat endpoints
│   │   ├── socket/            # Realtime messaging, presence & WebRTC signaling
│   │   ├── utils/             # JWT tokens, Local SSL certificate generator
│   │   └── server.ts          # Express & Socket.IO server initialization
│   ├── certs/                 # Auto-generated local SSL certificates
│   └── uploads/               # Storage directory for shared files and media
│
├── client/                    # React (Vite) + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── api/               # Dynamic API client resolving to Host LAN IP
│   │   ├── components/        # Sidebar, ChatArea, VideoCall, AdminPanel, Modals
│   │   ├── context/           # AuthContext, SocketContext, CallContext (WebRTC)
│   │   ├── types/             # TypeScript interfaces for models & sessions
│   │   ├── App.tsx            # Main application coordinator
│   │   └── main.tsx           # React entry point
│   └── vite.config.ts         # Vite server listening on 0.0.0.0
│
├── start-localchat.bat        # Windows one-click launch script
└── package.json               # Root scripts
```
