(function initUiComponents() {
  const demoUsers = [
    { id: 1, label: '1 - Alice Requester' },
    { id: 2, label: '2 - Bob Dean (Engineering)' },
    { id: 3, label: '3 - Carla Dean (Science)' },
    { id: 4, label: '4 - Dan Booking Admin' },
    { id: 5, label: '5 - Eve System Admin' },
    { id: 6, label: '6 - Frank Requester' }
  ];

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getStatusChip(status, priorityState) {
    if (status === 'CONFIRMED') {
      return '<span class="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">Booked</span>';
    }

    if (status === 'PENDING') {
      const pendingLabel = priorityState === 'YELLOW' ? 'Priority Pending' : 'Pending';
      return `<span class="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-700">${pendingLabel}</span>`;
    }

    return '<span class="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">Available</span>';
  }

  function getSlotBadge(slot) {
    if (slot.status === 'CONFIRMED') {
      return `<span class="rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700">${escapeHtml(slot.label)}</span>`;
    }

    if (slot.status === 'PENDING') {
      const cls = slot.priorityState === 'YELLOW' ? 'bg-yellow-200 text-yellow-900' : 'bg-yellow-100 text-yellow-800';
      return `<span class="rounded-md ${cls} px-2 py-1 text-xs font-medium">${escapeHtml(slot.label)}</span>`;
    }

    return `<span class="rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-700">${escapeHtml(slot.label)}</span>`;
  }

  function renderRoomCard(room, availability) {
    const confirmedCount = availability.slots.filter((slot) => slot.status === 'CONFIRMED').length;
    const pendingCount = availability.slots.filter((slot) => slot.status === 'PENDING').length;

    return `
      <article class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 class="text-lg font-bold text-slate-800">${escapeHtml(room.name)}</h3>
            <p class="text-sm text-slate-500">${escapeHtml(room.building)} · ${room.capacity} seats</p>
            <p class="mt-1 text-xs uppercase tracking-wide text-slate-400">${escapeHtml(room.department.name)}</p>
          </div>
          ${getStatusChip(confirmedCount > 0 ? 'CONFIRMED' : pendingCount > 0 ? 'PENDING' : 'AVAILABLE', pendingCount > 0 ? 'YELLOW' : null)}
        </div>

        <div class="mb-4 flex flex-wrap gap-2">
          ${availability.slots.map((slot) => getSlotBadge(slot)).join('')}
        </div>

        <div class="flex items-center justify-between text-xs text-slate-500">
          <span>Confirmed: ${confirmedCount}</span>
          <span>Pending: ${pendingCount}</span>
        </div>

        <button
          type="button"
          data-room-id="${room.id}"
          class="mt-4 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Create Booking Request
        </button>
      </article>
    `;
  }

  function renderTimeSlotSelector(slots, selectedSlotIds) {
    return slots
      .map((slot) => {
        const disabled = slot.status === 'CONFIRMED';
        const checked = selectedSlotIds.includes(slot.slotId);
        const labelClass = disabled
          ? 'cursor-not-allowed border-red-200 bg-red-50 text-red-500'
          : checked
            ? 'border-slate-900 bg-slate-900 text-white'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400';

        return `
          <label class="flex items-center justify-between rounded-lg border px-3 py-2 ${labelClass}">
            <span class="text-sm font-medium">${escapeHtml(slot.label)}</span>
            <input
              type="checkbox"
              name="slotId"
              value="${slot.slotId}"
              ${checked ? 'checked' : ''}
              ${disabled ? 'disabled' : ''}
              class="h-4 w-4"
            />
          </label>
        `;
      })
      .join('');
  }

  function createBookingModalMarkup(context) {
    const { room, date, slots, selectedSlotIds, emergencyOverrideRequested, overrideReason } = context;

    return `
      <div class="space-y-4">
        <header>
          <h3 class="text-lg font-bold text-slate-800">Request ${escapeHtml(room.name)}</h3>
          <p class="text-sm text-slate-500">${escapeHtml(room.building)} · ${escapeHtml(date)}</p>
        </header>

        <section class="space-y-2">
          <h4 class="text-sm font-semibold text-slate-700">Select Time Slots</h4>
          <div class="grid gap-2">${renderTimeSlotSelector(slots, selectedSlotIds)}</div>
        </section>

        <section class="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
          <label class="mb-2 flex items-center gap-2 text-sm font-medium text-yellow-800">
            <input id="emergencyOverrideRequested" type="checkbox" class="h-4 w-4" ${emergencyOverrideRequested ? 'checked' : ''} />
            Emergency Override Request (priority)
          </label>
          <textarea
            id="overrideReason"
            rows="3"
            placeholder="Required when emergency override is checked"
            class="w-full rounded-md border border-yellow-300 px-3 py-2 text-sm"
          >${escapeHtml(overrideReason || '')}</textarea>
        </section>
      </div>
    `;
  }

  function mountDemoUserSelect(selectElement, onChange) {
    selectElement.innerHTML = demoUsers
      .map((user) => `<option value="${user.id}">${escapeHtml(user.label)}</option>`)
      .join('');

    selectElement.value = String(window.API.getUserId());
    selectElement.addEventListener('change', () => {
      const userId = Number(selectElement.value);
      window.API.setUserId(userId);
      if (typeof onChange === 'function') {
        onChange(userId);
      }
    });
  }

  function setNotice(element, text, type = 'info') {
    const palette = {
      info: 'bg-slate-100 text-slate-700',
      success: 'bg-green-100 text-green-700',
      error: 'bg-red-100 text-red-700'
    };

    element.className = `rounded-md px-3 py-2 text-sm ${palette[type] || palette.info}`;
    element.textContent = text;
  }

  window.UIComponents = {
    renderRoomCard,
    renderTimeSlotSelector,
    createBookingModalMarkup,
    mountDemoUserSelect,
    setNotice
  };
})();
