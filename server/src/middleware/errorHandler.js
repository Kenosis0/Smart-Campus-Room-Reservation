const { sendError } = require('../utils/response');

function errorHandler(error, _req, res, _next) {
  if (error && error.code === 'ER_DUP_ENTRY') {
    return sendError(res, 409, 'Data conflict detected.', { sqlCode: error.code });
  }

  if (error && error.statusCode) {
    return sendError(res, error.statusCode, error.message, error.details);
  }

  // Log server-side for debugging without leaking internals to clients.
  // eslint-disable-next-line no-console
  console.error(error);
  return sendError(res, 500, 'Unexpected server error.');
}

module.exports = errorHandler;
