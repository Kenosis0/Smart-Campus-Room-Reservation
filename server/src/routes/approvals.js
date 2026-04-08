const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { sendSuccess } = require('../utils/response');
const { getPendingApprovals } = require('../services/reservationService');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/pending',
  asyncHandler(async (req, res) => {
    const pendingApprovals = await getPendingApprovals(req.user);
    sendSuccess(res, pendingApprovals);
  })
);

module.exports = router;
