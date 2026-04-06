const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');

router.post('/start', async (req, res) => {
  try {
    const { listingId, buyerId, sellerId } = req.body;
    if (!listingId || !buyerId || !sellerId) return res.status(400).json({ error: 'Missing fields.' });
    if (buyerId === sellerId) return res.status(400).json({ error: 'Cannot chat with yourself.' });
    let chat = await Chat.findOne({ listing: listingId, buyer: buyerId, seller: sellerId });
    if (!chat) {
      chat = new Chat({ listing: listingId, buyer: buyerId, seller: sellerId, messages: [] });
      await chat.save();
    }
    await chat.populate('listing', 'title images price status');
    await chat.populate('buyer', 'name avatar');
    await chat.populate('seller', 'name avatar');
    res.json(chat);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id)
      .populate('listing', 'title images price status')
      .populate('buyer', 'name avatar')
      .populate('seller', 'name avatar');
    if (!chat) return res.status(404).json({ error: 'Chat not found.' });
    res.json(chat);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const chats = await Chat.find({ $or: [{ buyer: req.params.userId }, { seller: req.params.userId }] })
      .populate('listing', 'title images price status')
      .populate('buyer', 'name avatar')
      .populate('seller', 'name avatar')
      .sort({ updatedAt: -1 });
    res.json(chats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/message', async (req, res) => {
  try {
    const { senderId, text } = req.body;
    if (!senderId || !text) return res.status(400).json({ error: 'Sender and text required.' });
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found.' });
    chat.messages.push({ sender: senderId, text });
    chat.updatedAt = new Date();
    await chat.save();
    res.json({ message: 'Sent.', chat });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/read', async (req, res) => {
  try {
    const { userId } = req.body;
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found.' });
    chat.messages.forEach(m => { if (m.sender.toString() !== userId) m.read = true; });
    await chat.save();
    res.json({ message: 'Marked as read.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/unread/:userId', async (req, res) => {
  try {
    const chats = await Chat.find({ $or: [{ buyer: req.params.userId }, { seller: req.params.userId }] });
    let count = 0;
    chats.forEach(c => c.messages.forEach(m => { if (m.sender.toString() !== req.params.userId && !m.read) count++; }));
    res.json({ unreadCount: count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: get all chats
router.get('/', async (req, res) => {
  try {
    const chats = await Chat.find()
      .populate('listing', 'title')
      .populate('buyer', 'name')
      .populate('seller', 'name')
      .sort({ updatedAt: -1 });
    res.json(chats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
