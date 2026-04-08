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
      if (state.modal.selectedSlotIds.length === 0) {
        throw new Error('Select at least one available slot.');
      }

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
      setNotice('Booking request created and queued for dean approval.', 'success');
    } catch (error) {
      setNotice(error.message, 'error');
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
