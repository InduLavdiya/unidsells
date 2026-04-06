const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  price: { type: Number, required: true },
  category: {
    type: String, required: true,
    enum: ['Electronics','Vehicles','Furniture','Fashion','Books','Sports','Home & Garden','Jobs','Services','Other']
  },
  description: { type: String, required: true },
  location: { type: String, required: true },
  images: [{ type: String }],
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['active','sold','flagged'], default: 'active' },
  views: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Listing', listingSchema);
