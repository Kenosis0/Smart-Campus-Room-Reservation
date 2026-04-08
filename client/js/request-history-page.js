(function initRequestHistoryPage() {
  const elements = {
    userSelect: document.getElementById('demoUserSelect'),
    notice: document.getElementById('pageNotice'),
    historyBody: document.getElementById('historyTableBody')
  };

  function setNotice(text, type = 'info') {
    window.UIComponents.setNotice(elements.notice, text, type);
  }

  function rowMarkup(item) {
    return `
      <tr class="border-b border-slate-100">
        <td class="px-3 py-2 font-semibold text-slate-700">#${item.requestId}</td>
        <td class="px-3 py-2">${item.room.name} (${item.room.building})</td>
        <td class="px-3 py-2">${item.requestDate}</td>
        <td class="px-3 py-2">${item.slotLabels}</td>
        <td class="px-3 py-2">
          <span class="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">${item.status}</span>
        </td>
      </tr>
    `;
  }

  async function loadHistory() {
    setNotice('Loading request history...', 'info');

    const history = await window.API.request('/api/booking-requests/my');
    elements.historyBody.innerHTML = history.map(rowMarkup).join('');

    if (history.length === 0) {
      elements.historyBody.innerHTML = '<tr><td colspan="5" class="px-3 py-8 text-center text-slate-500">No booking requests yet.</td></tr>';
    }

    setNotice('Request history updated.', 'success');
  }

  function bindRealtime() {
    window.Realtime.connect(async (eventName) => {
      if (eventName === 'approval:queue:changed' || eventName === 'booking:changed') {
        try {
          await loadHistory();
        } catch (error) {
          setNotice(error.message, 'error');
        }
      }
    });
  }

  async function bootstrap() {
    window.UIComponents.mountDemoUserSelect(elements.userSelect, async () => {
      await loadHistory();
    });

    bindRealtime();
    await loadHistory();
  }

  bootstrap().catch((error) => setNotice(error.message, 'error'));
})();
