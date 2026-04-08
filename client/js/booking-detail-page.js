(function initBookingDetailPage() {
  const params = new URLSearchParams(window.location.search);

  const elements = {
    userSelect: document.getElementById('demoUserSelect'),
    notice: document.getElementById('pageNotice'),
    bookingIdInput: document.getElementById('bookingIdInput'),
    loadButton: document.getElementById('loadBookingDetail'),
    detailRoot: document.getElementById('bookingDetailRoot'),
    cancelReason: document.getElementById('cancelReason'),
    cancelButton: document.getElementById('cancelBookingBtn')
  };

  let activeBookingId = null;

  function setNotice(text, type = 'info') {
    window.UIComponents.setNotice(elements.notice, text, type);
  }

  function renderDetail(detail) {
    const booking = detail.booking;

    elements.detailRoot.innerHTML = `
      <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 class="mb-2 text-lg font-bold text-slate-800">Booking #${booking.id}</h3>
        <p class="text-sm text-slate-600">Status: <span class="font-semibold">${booking.status}</span></p>
        <p class="text-sm text-slate-600">Room: ${booking.room.name} (${booking.room.building})</p>
        <p class="text-sm text-slate-600">Requester: ${booking.requester.name}</p>
        <p class="text-sm text-slate-600">Date: ${booking.request.date}</p>
      </section>

      <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h4 class="mb-2 font-semibold text-slate-800">Slots</h4>
        <div class="flex flex-wrap gap-2">
          ${detail.slots
            .map((slot) => `<span class="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">${slot.label} (${slot.status})</span>`)
            .join('')}
        </div>
      </section>

      <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h4 class="mb-2 font-semibold text-slate-800">Approvals</h4>
        <div class="space-y-2">
          ${detail.approvals
            .map(
              (approval) => `<div class="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">${approval.stage}: ${approval.decision} by ${approval.approverName}${approval.note ? ` - ${approval.note}` : ''}</div>`
            )
            .join('')}
        </div>
      </section>

      <section class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h4 class="mb-2 font-semibold text-slate-800">Action Log</h4>
        <div class="space-y-2">
          ${detail.actionLogs
            .map(
              (log) => `<div class="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">${log.actionType} (${log.actorRoleCode})${log.reasonText ? ` - ${log.reasonText}` : ''}</div>`
            )
            .join('')}
        </div>
      </section>
    `;
  }

  async function loadDetail() {
    const bookingId = Number(elements.bookingIdInput.value);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      setNotice('Enter a valid booking ID.', 'error');
      return;
    }

    setNotice('Loading booking detail...', 'info');
    const detail = await window.API.request(`/api/bookings/${bookingId}`);
    activeBookingId = bookingId;
    renderDetail(detail);
    setNotice('Booking detail loaded.', 'success');
  }

  async function cancelBooking() {
    if (!activeBookingId) {
      setNotice('Load a booking before cancelling.', 'error');
      return;
    }

    const reason = elements.cancelReason.value.trim();
    if (!reason) {
      setNotice('Cancellation reason is required.', 'error');
      return;
    }

    await window.API.request(`/api/bookings/${activeBookingId}/cancel`, {
      method: 'POST',
      body: { reason }
    });

    setNotice('Booking cancelled.', 'success');
    await loadDetail();
  }

  function bindRealtime() {
    window.Realtime.connect(async (eventName, payload) => {
      if (eventName !== 'booking:changed' || !activeBookingId) {
        return;
      }

      if (!payload || Number(payload.bookingId) !== activeBookingId) {
        return;
      }

      try {
        await loadDetail();
        setNotice('Live booking update received.', 'info');
      } catch (error) {
        setNotice(error.message, 'error');
      }
    });
  }

  async function bootstrap() {
    window.UIComponents.mountDemoUserSelect(elements.userSelect, async () => {
      if (activeBookingId) {
        await loadDetail();
      }
    });

    elements.bookingIdInput.value = params.get('id') || '';
    elements.loadButton.addEventListener('click', () => loadDetail().catch((error) => setNotice(error.message, 'error')));
    elements.cancelButton.addEventListener('click', () => cancelBooking().catch((error) => setNotice(error.message, 'error')));

    bindRealtime();

    if (elements.bookingIdInput.value) {
      await loadDetail();
    }
  }

  bootstrap().catch((error) => setNotice(error.message, 'error'));
})();
