/**
 * Drawser Backend – Entry Point
 * Express + Socket.IO server with CORS, rate limiting, and modular socket handlers.
 */
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { RateLimiterMemory } = require('rate-limiter-flexible');

const registerRoomHandlers = require('./socket/rooms');
const registerGameHandlers = require('./socket/gameLogic');
const registerDrawingHandlers = require('./socket/drawing');
const registerChatHandlers = require('./socket/chat');

const app = express();
const server = http.createServer(app);

// ── CORS ───────────────────────────────────────────────────────────────────────
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

// ── Socket.IO ───────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: FRONTEND_URL, methods: ['GET', 'POST'], credentials: true },
  transports: ['websocket', 'polling'],
});

// ── Global Socket Rate Limiter (connection-level spam guard) ────────────────────
const connectionLimiter = new RateLimiterMemory({
  points: 100,        // max 100 events
  duration: 10,       // per 10 seconds per socket
});

// ── Shared In-Memory Room Store ────────────────────────────────────────────────
// roomId -> roomState object (see rooms.js for shape)
const rooms = new Map();

// ── Socket Connection Handler ──────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  // Per-socket rate limiter middleware
  socket.use(async ([event], next) => {
    try {
      await connectionLimiter.consume(socket.id);
      next();
    } catch {
      socket.emit('error', { message: 'Too many events. Slow down!' });
    }
  });

  // Register modular handlers
  registerRoomHandlers(io, socket, rooms);
  registerGameHandlers(io, socket, rooms);
  registerDrawingHandlers(io, socket, rooms);
  registerChatHandlers(io, socket, rooms);

  socket.on('disconnect', (reason) => {
    console.log(`[-] Socket disconnected: ${socket.id} (${reason})`);
    // Cleanup is handled inside rooms.js on 'leave_room' / disconnect
  });
});

// ── Health Check ───────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// ── Start ───────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎨 Drawser backend running on port ${PORT}`);
});

module.exports = { io, rooms };
