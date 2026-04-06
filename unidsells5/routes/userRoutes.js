const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');

// Sign Up
router.post('/signup', async (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;
    if (!name || !password || (!email && !mobile))
      return res.status(400).json({ error: 'Name, password, and email or mobile are required.' });
    const existing = await User.findOne({
      $or: [email && { email }, mobile && { mobile }].filter(Boolean)
    });
    if (existing) return res.status(409).json({ error: 'User already exists with this email or mobile.' });
    const user = new User({ name, email: email || undefined, mobile: mobile || undefined, password });
    await user.save();
    const u = user.toObject(); delete u.password; delete u.resetToken;
    res.status(201).json({ message: 'Account created!', user: u });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: 'Credentials required.' });
    const user = await User.findOne({ $or: [{ email: identifier.toLowerCase() }, { mobile: identifier }] });
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
    if (user.blocked) return res.status(403).json({ error: 'Your account has been blocked. Contact support.' });
    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials.' });
    const u = user.toObject(); delete u.password; delete u.resetToken;
    res.json({ message: 'Login successful!', user: u });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Forgot Password — generate reset token
router.post('/forgot-password', async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ error: 'Email or mobile required.' });
    const user = await User.findOne({ $or: [{ email: identifier.toLowerCase() }, { mobile: identifier }] });
    if (!user) return res.status(404).json({ error: 'No account found with this email/mobile.' });
    const token = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6-char OTP
    user.resetToken = token;
    user.resetExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await user.save();
    // In production: send via email/SMS. Here we return it directly for demo.
    res.json({ message: 'Reset code generated.', token, userId: user._id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Reset Password using token
router.post('/reset-password', async (req, res) => {
  try {
    const { userId, token, newPassword } = req.body;
    if (!userId || !token || !newPassword) return res.status(400).json({ error: 'All fields required.' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.resetToken !== token.toUpperCase()) return res.status(400).json({ error: 'Invalid reset code.' });
    if (new Date() > user.resetExpiry) return res.status(400).json({ error: 'Reset code expired. Try again.' });
    user.password = newPassword;
    user.resetToken = '';
    user.resetExpiry = null;
    await user.save();
    res.json({ message: 'Password reset successfully! You can now login.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get all users (admin)
router.get('/', async (req, res) => {
  try {
    const users = await User.find({}, '-password -resetToken').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id, '-password -resetToken');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update user
router.put('/:id', async (req, res) => {
  try {
    const { name, email, mobile, avatar } = req.body;
    const update = {};
    if (name) update.name = name;
    if (email) update.email = email;
    if (mobile) update.mobile = mobile;
    if (avatar !== undefined) update.avatar = avatar;
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, select: '-password -resetToken' });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'Profile updated.', user });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Change password
router.put('/:id/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const match = await user.comparePassword(currentPassword);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect.' });
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password changed successfully.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Block / unblock user (admin)
router.put('/:id/block', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    user.blocked = !user.blocked;
    await user.save();
    res.json({ message: user.blocked ? 'User blocked.' : 'User unblocked.', blocked: user.blocked });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete user (admin)
router.delete('/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
