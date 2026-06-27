const express  = require('express');
const router   = express.Router();
const Booking  = require('../models/Booking');
const { generatePDF } = require('../services/generateVoucher');
const { uploadToS3 }  = require('../services/s3Service');
const { sendEmail }       = require('../services/emailService');
const { sendWhatsAppVoucher } = require('../services/whatsappService');
const logger   = require('../utils/logger');

async function dispatchVoucher(booking) {
  const row       = booking.data;
  const guestName = row['Primary Guest Name'] || 'Guest';
  const hotelName = row['Hotel Name']         || 'Hotel';
  const checkIn   = row['Check -In Date']     || row['Check-In Date'] || '';
  const checkOut  = row['Check-Out Date']     || '';
  const to        = row['Primary Guest Email'];
  const phone     = row['Primary Guest Contact'] || row['Contact'] || '';
  const contact   = row['Hotel Support Contact'] || row['Contact'] || '';
  const stayDate  = checkIn && checkOut ? `${checkIn} – ${checkOut}` : (checkIn || checkOut);

  logger.info(`[${booking.bookingId}] Generating PDF for ${guestName}…`);
  const { buffer, fileName } = await generatePDF(row, booking.bookingId);

  // Email only needs the buffer — run in parallel with S3 upload
  logger.info(`[${booking.bookingId}] Email + S3 upload in parallel…`);
  const [emailResult, s3Result] = await Promise.allSettled([
    to ? sendEmail({
      to,
      subject: `Booking Confirmed – EEMAgine 2026 x CoTrav at ${hotelName}`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#1a202c;line-height:1.8;font-size:15px;">
          <p>Hi ${guestName},</p>
          <p>We're pleased to inform you that your payment for the <strong>EEMAgine 2026</strong> has been successfully processed.</p>
          <p>Your stay at <strong>${hotelName}</strong> on <strong>${stayDate}</strong> is now confirmed.</p>
          <p>Should you require any assistance, please reach out to <strong>${process.env.CONTACT_NAME}</strong>, EEMA, at <strong>${process.env.CONTACT_NUMBER}</strong>.</p>
          <p>We look forward to hosting you and wish you a wonderful stay.</p>
          <br/>
          <p style="margin:0">Warm regards,</p>
          <p style="margin:4px 0 0;font-weight:600;">Team CoTrav</p>
        </div>
      `,
      attachments: [{ filename: fileName, content: buffer, contentType: 'application/pdf' }],
    }) : Promise.resolve('no-email'),
    uploadToS3(buffer, fileName),
  ]);

  if (to) {
    if (emailResult.status === 'fulfilled') logger.success(`[${booking.bookingId}] Email sent to ${to}`);
    else logger.error(`[${booking.bookingId}] Email failed`, emailResult.reason);
  }

  // WhatsApp needs S3 URL — runs after S3 upload resolves
  if (phone) {
    if (s3Result.status === 'fulfilled') {
      try {
        await sendWhatsAppVoucher({ to: phone, guestName, hotelName, stayDate, s3Url: s3Result.value, fileName });
        logger.success(`[${booking.bookingId}] WhatsApp sent to ${phone}`);
      } catch (err) {
        logger.error(`[${booking.bookingId}] WhatsApp failed`, err);
      }
    } else {
      logger.error(`[${booking.bookingId}] S3 upload failed — WhatsApp skipped`, s3Result.reason);
    }
  }

  await Booking.findByIdAndUpdate(booking._id, { voucherSend: true });
}

// GET /bookings — show all bookings from MongoDB
router.get('/', async (req, res) => {
  try {
    const { search = '', batch = '', page = '1' } = req.query;
    const limit  = 50;
    const skip   = (parseInt(page) - 1) * limit;

    const filter = {};
    if (batch) filter.batchId = batch;
    if (search) {
      // text search across all `data` fields via regex on JSON string
      // we'll fetch and filter in JS for simplicity (small dataset)
    }

    const total    = await Booking.countDocuments(filter);
    let bookings   = await Booking.find(filter).sort({ uploadedAt: -1, rowIndex: 1 }).skip(skip).limit(limit).lean();

    // client-side search filter applied server-side
    if (search) {
      const q = search.toLowerCase();
      bookings = bookings.filter(b =>
        JSON.stringify(b.data).toLowerCase().includes(q)
      );
    }

    // Collect unique batches for filter dropdown
    const batches = await Booking.distinct('batchId');

    res.render('bookings', {
      title: 'Bookings',
      page:  'bookings',
      bookings,
      total,
      currentPage: parseInt(page),
      totalPages:  Math.ceil(total / limit),
      search,
      batch,
      batches,
    });
  } catch (err) {
    logger.error('Bookings fetch error', err);
    res.status(500).render('error', { status: '500', message: err.message });
  }
});

// In-memory job store — survives browser close, lost on server restart
const bulkJobs = new Map();

// POST /bookings/send-all — start bulk job, returns jobId immediately
router.post('/send-all', async (req, res) => {
  const { batch } = req.body;

  const filter = { voucherSend: false };
  if (batch) filter.batchId = batch;

  const pending = await Booking.find(filter).sort({ uploadedAt: -1, rowIndex: 1 }).lean();
  const total   = pending.length;

  if (total === 0) return res.json({ success: true, jobId: null, total: 0, message: 'No pending bookings.' });

  const jobId = Date.now().toString(36);
  bulkJobs.set(jobId, { total, sent: 0, status: 'running', error: null });

  res.json({ success: true, jobId, total });

  // Fire-and-forget — runs independently of this HTTP connection
  ;(async () => {
    logger.info(`[BulkSend:${jobId}] Starting — ${total} pending bookings`);
    const job = bulkJobs.get(jobId);

    for (let i = 0; i < pending.length; i += 10) {
      const chunk   = pending.slice(i, i + 10);
      const results = await Promise.allSettled(chunk.map(b => dispatchVoucher(b)));
      results.forEach((r, idx) => {
        if (r.status === 'rejected')
          logger.error(`[BulkSend:${jobId}] Booking ${chunk[idx].bookingId} failed`, r.reason);
      });
      job.sent += chunk.length;
      logger.info(`[BulkSend:${jobId}] Chunk done — ${job.sent}/${total}`);
    }

    job.status = 'done';
    logger.success(`[BulkSend:${jobId}] Complete — ${job.sent} vouchers dispatched`);

    // Clean up after 10 min
    setTimeout(() => bulkJobs.delete(jobId), 10 * 60 * 1000);
  })().catch(err => {
    const job = bulkJobs.get(jobId);
    if (job) { job.status = 'error'; job.error = err.message; }
    logger.error(`[BulkSend:${jobId}] Fatal error`, err);
  });
});

// GET /bookings/send-all/:jobId — poll for progress
router.get('/send-all/:jobId', (req, res) => {
  const job = bulkJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found.' });
  res.json({ success: true, ...job });
});

// POST /bookings/:id/send-email — respond immediately, send email in background
router.post('/:id/send-email', async (req, res) => {
  const booking = await Booking.findById(req.params.id).lean();
  if (!booking) return res.status(404).json({ success: false, error: 'Booking not found.' });

  const to = booking.data['Primary Guest Email'];
  if (!to) return res.status(400).json({ success: false, error: 'No Primary Guest Email on this booking.' });

  res.json({ success: true, message: `Sending voucher to ${to}…` });

  dispatchVoucher(booking).catch(err => logger.error(`Voucher dispatch failed for ${booking.bookingId}`, err));
});

// DELETE /bookings/:id — delete a single booking
router.delete('/:id', async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
