(function initAvailabilityPage() {
  const state = {
    rooms: [],
    availabilityByRoom: new Map(),
    selectedDate: dayjs().format('YYYY-MM-DD'),
    modal: {
      roomId: null,
      selectedSlotIds: [],
      emergencyOverrideRequested: false,
      overrideReason: ''
    }
  };

  const elements = {
    userSelect: document.getElementById('demoUserSelect'),
    selectedDate: document.getElementById('selectedDate'),
    refreshButton: document.getElementById('refreshRooms'),
    notice: document.getElementById('pageNotice'),
    roomGrid: document.getElementById('roomGrid'),
    modalRoot: document.getElementById('bookingModal'),
    modalContent: document.getElementById('bookingModalContent'),
    modalClose: document.getElementById('closeBookingModal'),
    submitBookingRequest: document.getElementById('submitBookingRequest')
  };

  function setNotice(text, type = 'info') {
    window.UIComponents.setNotice(elements.notice, text, type);
  }

  function closeModal() {
    elements.modalRoot.classList.add('hidden');
    state.modal = {
      roomId: null,
      selectedSlotIds: [],
      emergencyOverrideRequested: false,
      overrideReason: ''
    };
  }

  function getRoomAvailability(roomId) {
    return state.availabilityByRoom.get(roomId) || { slots: [] };
  }

  function renderRoomGrid() {
    elements.roomGrid.innerHTML = state.rooms
      .map((room) => window.UIComponents.renderRoomCard(room, getRoomAvailability(room.id)))
      .join('');

    elements.roomGrid.querySelectorAll('button[data-room-id]').forEach((button) => {
      button.addEventListener('click', () => {
        openBookingModal(Number(button.dataset.roomId));
      });
    });
  }

  async function loadRoomsAndAvailability() {
    const selectedDate = elements.selectedDate.value || state.selectedDate;
    state.selectedDate = selectedDate;

    setNotice('Loading room availability...', 'info');

    const rooms = await window.API.request('/api/rooms');
    state.rooms = rooms;

    const availabilityPairs = await Promise.all(
      rooms.map(async (room) => {
        const data = await window.API.request(`/api/rooms/${room.id}/availability?date=${selectedDate}`);
        return [room.id, data];
      })
    );

    state.availabilityByRoom = new Map(availabilityPairs);
    renderRoomGrid();
    setNotice('Availability board is up to date.', 'success');
  }

  function bindModalSlotSelection() {
    elements.modalContent.querySelectorAll('input[name="slotId"]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const slotId = Number(checkbox.value);
        if (checkbox.checked) {
          if (!state.modal.selectedSlotIds.includes(slotId)) {
            state.modal.selectedSlotIds.push(slotId);
          }
        } else {
          state.modal.selectedSlotIds = state.modal.selectedSlotIds.filter((value) => value !== slotId);
        }
      });
    });

    const emergencyCheckbox = elements.modalContent.querySelector('#emergencyOverrideRequested');
    const reasonInput = elements.modalContent.querySelector('#overrideReason');

    emergencyCheckbox.addEventListener('change', () => {
      state.modal.emergencyOverrideRequested = emergencyCheckbox.checked;
    });

    reasonInput.addEventListener('input', () => {
      state.modal.overrideReason = reasonInput.value;
    });
  }

  function openBookingModal(roomId) {
    const room = state.rooms.find((item) => item.id === roomId);
    const availability = getRoomAvailability(roomId);

    state.modal.roomId = roomId;
    state.modal.selectedSlotIds = [];
    state.modal.emergencyOverrideRequested = false;
    state.modal.overrideReason = '';

    elements.modalContent.innerHTML = window.UIComponents.createBookingModalMarkup({
      room,
      date: state.selectedDate,
      slots: availability.slots,
      selectedSlotIds: state.modal.selectedSlotIds,
      emergencyOverrideRequested: state.modal.emergencyOverrideRequested,
      overrideReason: state.modal.overrideReason
    });

    bindModalSlotSelection();
    elements.modalRoot.classList.remove('hidden');
  }

  async function submitBookingRequest() {
    if (!state.modal.roomId) {
      return;
    }

    try {
      // Validate date is not in past
      const dateValidation = window.FormValidation.validateFutureDate(state.selectedDate);
      if (!dateValidation.valid) {
        throw new Error(dateValidation.error);
      }

      // Validate slots
      const availability = getRoomAvailability(state.modal.roomId);
      const slotValidation = window.FormValidation.validateConsecutiveSlots(
        state.modal.selectedSlotIds,
        availability.slots
      );
      if (!slotValidation.valid) {
        throw new Error(slotValidation.error);
      }

      // Get room name for confirmation
      const room = state.rooms.find(r => r.id === state.modal.roomId);
      const slotLabels = availability.slots
        .filter(s => state.modal.selectedSlotIds.includes(s.slotId))
        .map(s => s.label)
        .join(', ');

      // Show confirmation dialog
      const confirmed = await window.FormValidation.confirm(
        'Confirm Booking Request',
        `You are requesting ${room.name} on ${state.selectedDate} for:\n${slotLabels}\n\nThis requires approval by your department dean and booking administrator.`,
        'Create Request'
      );

      if (!confirmed) {
        setNotice('Booking request cancelled', 'info');
        return;
      }

      setNotice('Creating booking request...', 'info');

      await window.API.request('/api/booking-requests', {
        method: 'POST',
        body: {
          roomId: state.modal.roomId,
          requestDate: state.selectedDate,
          slotIds: state.modal.selectedSlotIds,
          emergencyOverrideRequested: state.modal.emergencyOverrideRequested,
          overrideReason: state.modal.overrideReason
        }
      });

      closeModal();
      await loadRoomsAndAvailability();
      setNotice('✓ Booking request created successfully. Waiting for dean approval.', 'success');
    } catch (error) {
      setNotice(error.message || 'Failed to create booking request', 'error');
    }
  }

  function bindPageEvents() {
    window.UIComponents.mountDemoUserSelect(elements.userSelect, async () => {
      await loadRoomsAndAvailability();
      setNotice('Changed active demo user.', 'info');
    });

    elements.selectedDate.value = state.selectedDate;
    elements.selectedDate.addEventListener('change', async () => {
      try {
        await loadRoomsAndAvailability();
      } catch (error) {
        setNotice(error.message, 'error');
      }
    });

    elements.refreshButton.addEventListener('click', async () => {
      try {
        await loadRoomsAndAvailability();
      } catch (error) {
        setNotice(error.message, 'error');
      }
    });

    elements.modalClose.addEventListener('click', closeModal);
    elements.submitBookingRequest.addEventListener('click', submitBookingRequest);
  }

  function bindRealtime() {
    window.Realtime.connect(async (eventName, payload) => {
      if (eventName !== 'availability:changed') {
        return;
      }

      if (!payload || payload.requestDate !== state.selectedDate) {
        return;
      }

      try {
        await loadRoomsAndAvailability();
        setNotice('Live update received from another user.', 'info');
      } catch (error) {
        setNotice(error.message, 'error');
      }
    });
  }

  async function bootstrap() {
    try {
      bindPageEvents();
      bindRealtime();
      await loadRoomsAndAvailability();
    } catch (error) {
      setNotice(error.message, 'error');
    }
  }

  bootstrap();
})();
