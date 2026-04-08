const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { sendSuccess } = require('../utils/response');
const { getBookingDetail, cancelBooking } = require('../services/reservationService');
const { emitAvailabilityChanged, emitBookingChanged } = require('../socket/events');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/:bookingId',
  asyncHandler(async (req, res) => {
    const bookingDetail = await getBookingDetail(req.params.bookingId);
    sendSuccess(res, bookingDetail);
  })
);

router.post(
  '/:bookingId/cancel',
  asyncHandler(async (req, res) => {
    const cancelled = await cancelBooking(req.params.bookingId, req.body, req.user);

    emitBookingChanged({
      bookingId: cancelled.bookingId,
      status: cancelled.status,
      reason: cancelled.reason
    });

    emitAvailabilityChanged({
      roomId: cancelled.roomId,
      requestDate: cancelled.requestDate,
      bookingId: cancelled.bookingId,
      status: cancelled.status
    });

    sendSuccess(res, cancelled);
  })
);

module.exports = router;
