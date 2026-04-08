const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { sendSuccess } = require('../utils/response');
const { getRooms, getRoomAvailability } = require('../services/reservationService');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rooms = await getRooms();
    sendSuccess(res, rooms);
  })
);

router.get(
  '/:roomId/availability',
  asyncHandler(async (req, res) => {
    const date = req.query.date;
    const availability = await getRoomAvailability(req.params.roomId, date);
    sendSuccess(res, availability);
  })
);

module.exports = router;
