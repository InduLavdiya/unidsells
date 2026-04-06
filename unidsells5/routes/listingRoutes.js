const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Listing = require('../models/Listing');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) =>
    cb(null, 'img_' + Date.now() + '_' + Math.floor(Math.random() * 99999) + path.extname(file.originalname).toLowerCase())
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed.'));
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 6 }
});

// GET all listings
router.get('/', async (req, res) => {
  try {
    const { search, category, status, seller, minPrice, maxPrice } = req.query;
    const query = {};
    if (search) query.$or = [
      { title: new RegExp(search, 'i') },
      { description: new RegExp(search, 'i') },
      { location: new RegExp(search, 'i') }
    ];
    if (category && category !== 'All') query.category = category;
    if (status) query.status = status;
    else query.status = 'active';
    if (seller) query.seller = seller;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    const listings = await Listing.find(query).populate('seller', 'name avatar').sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET single listing
router.get('/:id', async (req, res) => {
  try {
    const listing = await Listing.findByIdAndUpdate(
      req.params.id, { $inc: { views: 1 } }, { new: true }
    ).populate('seller', 'name avatar mobile email createdAt');
    if (!listing) return res.status(404).json({ error: 'Listing not found.' });
    res.json(listing);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create listing
router.post('/', (req, res) => {
  upload.array('images', 6)(req, res, async (uploadErr) => {
    if (uploadErr) {
      console.error('Upload error:', uploadErr.message);
      return res.status(400).json({ error: uploadErr.message });
    }
    try {
      const { title, price, category, description, location, seller, imageUrls } = req.body;
      if (!title || !price || !category || !description || !location || !seller)
        return res.status(400).json({ error: 'All fields are required.' });

      const uploadedFiles = req.files ? req.files.map(f => '/uploads/' + f.filename) : [];

      let urlImages = [];
      if (imageUrls) {
        try { urlImages = JSON.parse(imageUrls); } catch { urlImages = [imageUrls]; }
        urlImages = Array.isArray(urlImages)
          ? urlImages.filter(u => typeof u === 'string' && u.startsWith('http'))
          : [];
      }

      const images = [...uploadedFiles, ...urlImages];
      console.log('Creating listing, images:', images.length, images);

      const listing = new Listing({ title, price: Number(price), category, description, location, images, seller });
      await listing.save();
      await listing.populate('seller', 'name avatar');
      res.status(201).json({ message: 'Listing posted!', listing });
    } catch (err) {
      console.error('Create error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });
});

// PUT update listing — FIXED: always updates images from keepImages + new files + URLs
router.put('/:id', (req, res) => {
  upload.array('images', 6)(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.message });
    try {
      const { title, price, category, description, location, status, imageUrls, keepImages } = req.body;
      const update = {};
      if (title) update.title = title;
      if (price) update.price = Number(price);
      if (category) update.category = category;
      if (description) update.description = description;
      if (location) update.location = location;
      if (status) update.status = status;

      const newFiles = req.files ? req.files.map(f => '/uploads/' + f.filename) : [];

      let existingKept = [];
      if (keepImages) {
        try { existingKept = JSON.parse(keepImages); } catch { existingKept = []; }
        existingKept = Array.isArray(existingKept) ? existingKept : [];
      }

      let urlImages = [];
      if (imageUrls) {
        try { urlImages = JSON.parse(imageUrls); } catch { urlImages = [imageUrls]; }
        urlImages = Array.isArray(urlImages)
          ? urlImages.filter(u => typeof u === 'string' && u.startsWith('http'))
          : [];
      }

      // Always set images = kept existing + new uploads + new URLs
      update.images = [...existingKept, ...newFiles, ...urlImages];
      console.log('Updating listing images:', update.images.length, update.images);

      const listing = await Listing.findByIdAndUpdate(req.params.id, update, { new: true });
      if (!listing) return res.status(404).json({ error: 'Listing not found.' });
      res.json({ message: 'Listing updated.', listing });
    } catch (err) {
      console.error('Update error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });
});

// PUT flag listing (admin)
router.put('/:id/flag', async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found.' });
    listing.status = listing.status === 'flagged' ? 'active' : 'flagged';
    await listing.save();
    res.json({ message: listing.status === 'flagged' ? 'Listing flagged.' : 'Unflagged.', listing });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE listing
router.delete('/:id', async (req, res) => {
  try {
    const listing = await Listing.findByIdAndDelete(req.params.id);
    if (listing?.images) {
      listing.images.forEach(img => {
        if (img.startsWith('/uploads/')) {
          try { const fp = path.join(__dirname, '..', img); if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {}
        }
      });
    }
    res.json({ message: 'Listing deleted.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
