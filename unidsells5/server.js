const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '20mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '20mb' }));
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/unidsells';
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err.message));

// API Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/listings', require('./routes/listingRoutes'));
app.use('/api/chats', require('./routes/chatRoutes'));

// Socket.io
const activeUsers = new Map();
io.on('connection', (socket) => {
  socket.on('join', (userId) => { activeUsers.set(userId, socket.id); socket.userId = userId; });
  socket.on('joinChat', (chatId) => socket.join(chatId));
  socket.on('sendMessage', async ({ chatId, senderId, text }) => {
    try {
      const Chat = require('./models/Chat');
      const chat = await Chat.findById(chatId);
      if (!chat) return;
      chat.messages.push({ sender: senderId, text, read: false, createdAt: new Date() });
      chat.updatedAt = new Date();
      await chat.save();
      const msg = chat.messages[chat.messages.length - 1];
      io.to(chatId).emit('newMessage', { chatId, message: msg });
      const recipientId = chat.buyer.toString() === senderId ? chat.seller.toString() : chat.buyer.toString();
      const recipSocket = activeUsers.get(recipientId);
      if (recipSocket) io.to(recipSocket).emit('notification', { chatId, senderId });
    } catch (e) { console.error('Socket error:', e.message); }
  });
  socket.on('disconnect', () => { if (socket.userId) activeUsers.delete(socket.userId); });
});

// Serve HTML pages
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 UnidSells v3 running → http://localhost:${PORT}`));
