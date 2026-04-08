const http = require('http');
const { Server } = require('socket.io');
const createApp = require('./app');
const { port, clientOrigin } = require('./config/env');
const { setSocketServer } = require('./socket/events');

const app = createApp();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: clientOrigin,
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  socket.emit('server:ready', {
    connectedAt: new Date().toISOString()
  });
});

setSocketServer(io);

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Smart Campus server running on http://localhost:${port}`);
});
