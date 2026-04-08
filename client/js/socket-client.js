(function initSocketClient() {
  let socket = null;

  function connect(onEvent) {
    if (typeof io === 'undefined') {
      return null;
    }

    socket = io();

    ['availability:changed', 'booking:changed', 'approval:queue:changed'].forEach((eventName) => {
      socket.on(eventName, (payload) => {
        if (typeof onEvent === 'function') {
          onEvent(eventName, payload);
        }
      });
    });

    return socket;
  }

  function disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  }

  window.Realtime = {
    connect,
    disconnect
  };
})();
