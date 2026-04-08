(function initDeanQueuePage() {
  const elements = {
    userSelect: document.getElementById('demoUserSelect'),
    notice: document.getElementById('pageNotice'),
    queue: document.getElementById('deanQueue')
  };

  function setNotice(text, type = 'info') {
    window.UIComponents.setNotice(elements.notice, text, type);
  }

  function cardMarkup(item) {
    return `
      <article class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" data-request-id="${item.requestId}">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="font-semibold text-slate-800">Request #${item.requestId}</h3>
          <span class="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-700">${item.status}</span>
        </div>
        <p class="text-sm text-slate-600">Requester: ${item.requesterName}</p>
        <p class="text-sm text-slate-600">Room: ${item.room.name} (${item.room.building})</p>
        <p class="text-sm text-slate-600">Date: ${item.requestDate}</p>
        <p class="mb-3 text-sm text-slate-600">Slots: ${item.slotLabels}</p>
        <textarea class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" rows="2" placeholder="Approval note (required for reject)" data-note></textarea>
        <div class="mt-3 flex gap-2">
          <button type="button" class="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white" data-action="APPROVE">Approve</button>
          <button type="button" class="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white" data-action="REJECT">Reject</button>
        </div>
      </article>
    `;
  }

  function bindActions() {
    elements.queue.querySelectorAll('article[data-request-id]').forEach((card) => {
      const requestId = Number(card.dataset.requestId);
      const noteInput = card.querySelector('[data-note]');

      card.querySelectorAll('button[data-action]').forEach((button) => {
        button.addEventListener('click', async () => {
          const action = button.dataset.action;
          const note = noteInput.value.trim();

          if (action === 'REJECT' && !note) {
            setNotice('Reject requires a note.', 'error');
            return;
          }

          try {
            await window.API.request(`/api/booking-requests/${requestId}/approvals`, {
              method: 'POST',
              body: {
                decision: action,
                note
              }
            });

            setNotice(`Request #${requestId} ${action === 'APPROVE' ? 'approved' : 'rejected'}.`, 'success');
            await loadQueue();
          } catch (error) {
            setNotice(error.message, 'error');
          }
        });
      });
    });
  }

  async function loadQueue() {
    setNotice('Loading dean approval queue...', 'info');

    const queue = await window.API.request('/api/approvals/pending');

    if (queue.length === 0) {
      elements.queue.innerHTML = '<p class="rounded-md bg-slate-100 px-4 py-8 text-center text-slate-500">No pending dean approvals.</p>';
      setNotice('Dean queue is empty.', 'success');
      return;
    }

    elements.queue.innerHTML = queue.map(cardMarkup).join('');
    bindActions();
    setNotice('Dean queue updated.', 'success');
  }

  function bindRealtime() {
    window.Realtime.connect(async (eventName) => {
      if (eventName === 'approval:queue:changed') {
        try {
          await loadQueue();
        } catch (error) {
          setNotice(error.message, 'error');
        }
      }
    });
  }

  async function bootstrap() {
    window.UIComponents.mountDemoUserSelect(elements.userSelect, async () => {
      await loadQueue();
    });

    bindRealtime();
    await loadQueue();
  }

  bootstrap().catch((error) => setNotice(error.message, 'error'));
})();
