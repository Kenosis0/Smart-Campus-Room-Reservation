const path = require('path');
const express = require('express');
const cors = require('cors');
const { clientOrigin } = require('./config/env');
const { attachRequestUser } = require('./middleware/auth');
const { sendError } = require('./utils/response');
const errorHandler = require('./middleware/errorHandler');

const roomsRouter = require('./routes/rooms');
const bookingRequestsRouter = require('./routes/bookingRequests');
const approvalsRouter = require('./routes/approvals');
const bookingsRouter = require('./routes/bookings');
const reportsRouter = require('./routes/reports');

function createApp() {
  const app = express();

  app.use(
    cors({
      origin: clientOrigin,
      credentials: false
    })
  );

  app.use(express.json());
  app.use(attachRequestUser);

  app.use('/api/rooms', roomsRouter);
  app.use('/api/booking-requests', bookingRequestsRouter);
  app.use('/api/approvals', approvalsRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/reports', reportsRouter);

  const clientPath = path.resolve(__dirname, '../../client');
  app.use(express.static(clientPath));

  app.get('/', (_req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });

  app.use('/api/*', (_req, res) => {
    sendError(res, 404, 'API route not found.');
  });

  app.use(errorHandler);

  return app;
}

module.exports = createApp;
