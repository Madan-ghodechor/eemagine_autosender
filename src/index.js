require('dotenv').config();
const express = require('express');
const path    = require('path');
const config  = require('./config/config');
const logger  = require('./utils/logger');
const { connectDB } = require('./config/db');
const voucherRoutes       = require('./routes/voucherRoutes');
const uploadRoutes        = require('./routes/uploadRoutes');
const hotelVoucherRoutes  = require('./routes/hotelVoucherRoutes');
const bookingRoutes          = require('./routes/bookingRoutes');
const inconvenienceRoutes    = require('./routes/inconvenienceRoutes');

const app = express();

// ── View engine ──
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Static assets ──
app.use(express.static(path.join(__dirname, '../public')));

// ── Body parsers ──
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── File upload ──
const fileUpload = require('express-fileupload');
app.use(fileUpload({
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  abortOnLimit: true,
  useTempFiles: true,
  tempFileDir: require('path').join(__dirname, '../uploads/tmp'),
}));

// ── Routes ──
app.use('/upload',           uploadRoutes);
app.use('/api/voucher',      voucherRoutes);
app.use('/vouchers/hotel',   hotelVoucherRoutes);
app.use('/bookings',         bookingRoutes);
app.use('/inconvenience',    inconvenienceRoutes);

// Home → upload page
app.get('/', (req, res) => {
  res.render('index', { title: 'Upload Excel', page: 'home', error: null });
});

// Health
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404
app.use((req, res) => {
  res.status(404).render('error', { status: '404', message: `Page not found: ${req.path}` });
});

connectDB().catch(err => logger.error('MongoDB connection failed', err));

app.listen(config.port, () => {
  logger.success(`Server running → http://localhost:${config.port}`);
  logger.info('Pages:');
  logger.info(`  GET  /                         Upload page`);
  logger.info(`  POST /upload                   Parse uploaded Excel file`);
  logger.info(`  GET  /upload/preview/:token    Data preview (table + JSON)`);
  logger.info(`  GET  /upload/history           Recent uploads`);
  logger.info(`  GET  /upload/json/:token       Raw JSON API`);
  logger.info(`  GET  /upload/download-json     Download JSON file`);
  logger.info('Hotel Vouchers:');
  logger.info(`  POST /vouchers/hotel/generate-pdf  Generate + stream single PDF (Postman/API)`);
  logger.info(`  POST /vouchers/hotel/generate     Generate PDFs from rows JSON`);
  logger.info(`  GET  /vouchers/hotel/results/:t   View generated vouchers`);
  logger.info(`  GET  /vouchers/hotel/download/:f  Download a voucher PDF`);
  logger.info('API:');
  logger.info(`  POST /api/voucher/send-email`);
  logger.info(`  POST /api/voucher/send-whatsapp`);
  logger.info(`  POST /api/voucher/send-both`);
});
