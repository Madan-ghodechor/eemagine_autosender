const mongoose = require('mongoose');
const logger = require('../utils/logger');

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/eemagine';
  await mongoose.connect(uri);
  logger.success(`MongoDB connected → ${uri}`);
}

module.exports = { connectDB };
