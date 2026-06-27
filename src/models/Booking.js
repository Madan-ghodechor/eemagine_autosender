const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema(
  {
    bookingId:   { type: String, required: true, unique: true, index: true },
    batchId:     { type: String, required: true, index: true },
    fileName:    { type: String, required: true },
    rowIndex:    { type: Number, required: true },
    data:        { type: mongoose.Schema.Types.Mixed, required: true },
    voucherSend: { type: Boolean, default: false },
    uploadedAt:  { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

module.exports = mongoose.model('Booking', BookingSchema);
