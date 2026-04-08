let ioInstance = null;

function setSocketServer(io) {
  ioInstance = io;
}

function emitAvailabilityChanged(payload) {
  if (!ioInstance) {
    return;
  }

  ioInstance.emit('availability:changed', payload);
}

function emitBookingChanged(payload) {
  if (!ioInstance) {
    return;
  }

  ioInstance.emit('booking:changed', payload);
}

function emitApprovalQueueChanged(payload) {
  if (!ioInstance) {
    return;
  }

  ioInstance.emit('approval:queue:changed', payload);
}

module.exports = {
  setSocketServer,
  emitAvailabilityChanged,
  emitBookingChanged,
  emitApprovalQueueChanged
};
