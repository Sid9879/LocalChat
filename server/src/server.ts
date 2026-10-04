import express from 'express';
import cors from 'cors';
import https from 'https';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import { connectDB } from './config/db';
import { setupSocketIO } from './socket';
import { getOrCreateCertificates } from './utils/ssl';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import groupRoutes from './routes/group.routes';
import chatRoutes from './routes/chat.routes';
import { UPLOAD_DIR } from './middleware/upload';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const useHttps = process.env.USE_HTTPS === 'true';

// CORS configuration allowing LAN origins
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      // Allow localhost and private LAN IPs (192.168.*, 10.*, 172.16-31.*)
      const isAllowed =
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(
          origin
        );
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive for local dev
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static uploads directory
app.use('/uploads', express.static(UPLOAD_DIR));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    protocol: useHttps ? 'https' : 'http',
    timestamp: new Date().toISOString(),
    service: 'LocalChat Core',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/chat', chatRoutes);

// Create HTTP or HTTPS server
let server: http.Server | https.Server;
if (useHttps) {
  const credentials = getOrCreateCertificates();
  server = https.createServer(credentials, app);
  console.log('[Security] Running in HTTPS mode (Required for LAN WebRTC Media Access)');
} else {
  server = http.createServer(app);
  console.log('[Security] Running in HTTP mode');
}

// Socket.IO setup
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 1e8, // 100MB for file chunks
});

setupSocketIO(io);

// Start server
async function startServer() {
  await connectDB();

  server.listen(Number(PORT), '0.0.0.0', () => {
    const proto = useHttps ? 'https' : 'http';
    console.log(`\n======================================================`);
    console.log(`🚀 LocalChat Server is running on port ${PORT}!`);
    console.log(`📡 Local Access:    ${proto}://localhost:${PORT}`);
    console.log(`🌐 LAN Access:      ${proto}://10.175.128.58:${PORT}`);
    console.log(`======================================================\n`);
  });
}

startServer().catch((err) => {
  console.error('Fatal startup error:', err);
});
