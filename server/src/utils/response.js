function sendSuccess(res, data, meta = undefined, statusCode = 200) {
  const payload = {
    success: true,
    data
  };

  if (meta !== undefined) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
}

function sendError(res, statusCode, message, details = undefined) {
  const payload = {
    success: false,
    error: {
      message
    }
  };

  if (details !== undefined && details !== null) {
    payload.error.details = details;
  }

  return res.status(statusCode).json(payload);
}

module.exports = {
  sendSuccess,
  sendError
};
