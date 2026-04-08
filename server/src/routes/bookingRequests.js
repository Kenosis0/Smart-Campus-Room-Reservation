const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { sendSuccess } = require('../utils/response');
const {
  createBookingRequest,
  getMyBookingRequests,
  approveBookingRequest
} = require('../services/reservationService');
const {
  emitAvailabilityChanged,
  emitApprovalQueueChanged,
  emitBookingChanged
} = require('../socket/events');

const router = express.Router();

router.use(requireAuth);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const created = await createBookingRequest(req.body, req.user);

    emitAvailabilityChanged({
      roomId: created.roomId,
      requestDate: created.requestDate,
      requestId: created.bookingRequestId,
      status: created.status
    });

    emitApprovalQueueChanged({
      roomId: created.roomId,
      requestDate: created.requestDate,
      requestId: created.bookingRequestId,
      status: created.status
    });

    sendSuccess(res, created, undefined, 201);
  })
);

router.get(
  '/my',
  asyncHandler(async (req, res) => {
    const requests = await getMyBookingRequests(req.user);
    sendSuccess(res, requests);
  })
);

router.post(
  '/:requestId/approvals',
  asyncHandler(async (req, res) => {
    const approvalResult = await approveBookingRequest(req.params.requestId, req.body, req.user);

    emitApprovalQueueChanged({
      requestId: approvalResult.requestId,
      stage: approvalResult.stage,
      decision: approvalResult.decision,
      status: approvalResult.status
    });

    emitAvailabilityChanged({
      roomId: approvalResult.roomId,
      requestDate: approvalResult.requestDate,
      requestId: approvalResult.requestId,
      status: approvalResult.status
    });

    if (approvalResult.bookingId) {
      emitBookingChanged({
        bookingId: approvalResult.bookingId,
        status: approvalResult.status,
        requestId: approvalResult.requestId
      });
    }

    sendSuccess(res, approvalResult);
  })
);

module.exports = router;
