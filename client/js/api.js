(function initApiModule() {
  const USER_KEY = 'smart-campus-user-id';

  function getUserId() {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? Number(stored) : 1;
  }

  function setUserId(userId) {
    localStorage.setItem(USER_KEY, String(userId));
  }

  async function request(path, options = {}) {
    const { method = 'GET', body } = options;
    const headers = {
      'Content-Type': 'application/json',
      'x-user-id': String(getUserId())
    };

    const response = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.success) {
      const message = payload?.error?.message || 'Request failed.';
      throw new Error(message);
    }

    return payload.data;
  }

  window.API = {
    getUserId,
    setUserId,
    request
  };
})();
