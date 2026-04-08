const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const { pool, withTransaction } = require('../db/pool');
const AppError = require('../utils/appError');

dayjs.extend(customParseFormat);

const REQUEST_STATUSES = {
  PENDING_DEAN: 'PENDING_DEAN',
  PENDING_ADMIN: 'PENDING_ADMIN',
  CONFIRMED: 'CONFIRMED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED'
};

const BOOKING_STATUSES = {
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  OVERRIDDEN: 'OVERRIDDEN'
};

function toDateString(value) {
  return dayjs(value).format('YYYY-MM-DD');
}

function parseDate(dateString) {
  const parsed = dayjs(dateString, 'YYYY-MM-DD', true);
  if (!parsed.isValid()) {
    throw new AppError(400, 'requestDate must be YYYY-MM-DD.');
  }

  return parsed;
}

function normalizeSlotIds(slotIds) {
  if (!Array.isArray(slotIds) || slotIds.length === 0) {
    throw new AppError(400, 'slotIds is required and must be a non-empty array.');
  }

  const parsed = slotIds.map((value) => Number(value));
  if (parsed.some((value) => !Number.isInteger(value) || value <= 0)) {
    throw new AppError(400, 'slotIds must contain positive integer values.');
  }

  return [...new Set(parsed)].sort((a, b) => a - b);
}

function parseOptionalText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function toBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function ensurePositiveInteger(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(400, `${fieldName} must be a positive integer.`);
  }

  return parsed;
}

async function writeAction(executor, payload) {
  const metadata = payload.metadata ? JSON.stringify(payload.metadata) : null;

  await executor.execute(
    `INSERT INTO action_logs
      (actor_user_id, actor_role_code, action_type, target_type, target_id, reason_text, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)` ,
    [
      payload.actorUserId,
      payload.actorRoleCode,
      payload.actionType,
      payload.targetType,
      payload.targetId,
      payload.reasonText || null,
      metadata
    ]
  );
}

async function getRooms() {
  const [rows] = await pool.execute(
    `SELECT
      r.id,
      r.name,
      r.building,
      r.capacity,
      d.id AS department_id,
      d.name AS department_name,
      rp.min_notice_minutes,
      rp.allow_emergency_override
    FROM rooms r
    INNER JOIN departments d ON d.id = r.department_id
    INNER JOIN room_policies rp ON rp.room_id = r.id
    WHERE r.is_active = 1
    ORDER BY r.building ASC, r.name ASC`
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    building: row.building,
    capacity: row.capacity,
    department: {
      id: row.department_id,
      name: row.department_name
    },
    policy: {
      minNoticeMinutes: row.min_notice_minutes,
      allowEmergencyOverride: Boolean(row.allow_emergency_override)
    }
  }));
}

async function getRoomAvailability(roomIdInput, requestDateInput) {
  const roomId = ensurePositiveInteger(roomIdInput, 'roomId');
  const requestDate = parseDate(requestDateInput).format('YYYY-MM-DD');

  const [roomRows] = await pool.execute(
    `SELECT id, name, building
    FROM rooms
    WHERE id = ? AND is_active = 1`,
    [roomId]
  );

  if (roomRows.length === 0) {
    throw new AppError(404, 'Room not found.');
  }

  const [slotRows] = await pool.execute(
    `SELECT id, label, start_time, end_time
    FROM time_slots
    ORDER BY start_time ASC`
  );

  const [confirmedRows] = await pool.execute(
    `SELECT
      bs.time_slot_id,
      bs.booking_id,
      b.booking_request_id,
      u.full_name AS requester_name
    FROM booking_slots bs
    INNER JOIN bookings b ON b.id = bs.booking_id
    INNER JOIN users u ON u.id = b.requester_user_id
    WHERE bs.room_id = ?
      AND bs.booking_date = ?
      AND bs.status = 'CONFIRMED'`,
    [roomId, requestDate]
  );

  const [pendingRows] = await pool.execute(
    `SELECT
      brs.time_slot_id,
      br.id AS request_id,
      br.status,
      br.created_at,
      br.emergency_override_requested,
      u.full_name AS requester_name
    FROM booking_requests br
    INNER JOIN booking_request_slots brs ON brs.booking_request_id = br.id
    INNER JOIN users u ON u.id = br.requester_user_id
    WHERE br.room_id = ?
      AND br.request_date = ?
      AND br.status IN ('PENDING_DEAN', 'PENDING_ADMIN')
    ORDER BY brs.time_slot_id ASC, br.created_at ASC, br.id ASC`,
    [roomId, requestDate]
  );

  const confirmedBySlot = new Map();
  confirmedRows.forEach((row) => {
    confirmedBySlot.set(row.time_slot_id, {
      bookingId: row.booking_id,
      requestId: row.booking_request_id,
      requesterName: row.requester_name
    });
  });

  const pendingBySlot = new Map();
  pendingRows.forEach((row) => {
    if (!pendingBySlot.has(row.time_slot_id)) {
      pendingBySlot.set(row.time_slot_id, []);
    }

    pendingBySlot.get(row.time_slot_id).push({
      requestId: row.request_id,
      requesterName: row.requester_name,
      status: row.status,
      requestedAt: row.created_at,
      emergencyOverrideRequested: Boolean(row.emergency_override_requested)
    });
  });

  const slots = slotRows.map((slot) => {
    const confirmed = confirmedBySlot.get(slot.id) || null;
    const pendingQueue = pendingBySlot.get(slot.id) || [];

    return {
      slotId: slot.id,
      label: slot.label,
      startTime: slot.start_time,
      endTime: slot.end_time,
      status: confirmed ? 'CONFIRMED' : pendingQueue.length > 0 ? 'PENDING' : 'AVAILABLE',
      confirmedBooking: confirmed,
      pendingQueue,
      priorityState: pendingQueue.some((item) => item.emergencyOverrideRequested) ? 'YELLOW' : null
    };
  });

  return {
    room: {
      id: roomRows[0].id,
      name: roomRows[0].name,
      building: roomRows[0].building
    },
    requestDate,
    slots
  };
}

async function createBookingRequest(payload, actor) {
  const roomId = ensurePositiveInteger(payload.roomId, 'roomId');
  const requestDate = parseDate(payload.requestDate).format('YYYY-MM-DD');
  const slotIds = normalizeSlotIds(payload.slotIds);
  const emergencyOverrideRequested = toBoolean(payload.emergencyOverrideRequested);
  const overrideReason = parseOptionalText(payload.overrideReason);

  if (emergencyOverrideRequested && overrideReason.length === 0) {
    throw new AppError(400, 'overrideReason is required when emergencyOverrideRequested is true.');
  }

  if (dayjs(requestDate).isBefore(dayjs().startOf('day'))) {
    throw new AppError(400, 'requestDate cannot be in the past.');
  }

  return withTransaction(async (connection) => {
    const [roomRows] = await connection.execute(
      `SELECT
        r.id,
        r.department_id,
        rp.min_notice_minutes,
        d.dean_user_id
      FROM rooms r
      INNER JOIN room_policies rp ON rp.room_id = r.id
      INNER JOIN departments d ON d.id = r.department_id
      WHERE r.id = ? AND r.is_active = 1
      FOR UPDATE`,
      [roomId]
    );

    if (roomRows.length === 0) {
      throw new AppError(404, 'Room not found.');
    }

    if (!roomRows[0].dean_user_id) {
      throw new AppError(409, 'Room department has no dean assigned.');
    }

    const placeholders = slotIds.map(() => '?').join(', ');
    const [slotRows] = await connection.execute(
      `SELECT id, start_time
      FROM time_slots
      WHERE id IN (${placeholders})
      ORDER BY start_time ASC`,
      slotIds
    );

    if (slotRows.length !== slotIds.length) {
      throw new AppError(400, 'One or more slotIds are invalid.');
    }

    const firstSlotStart = dayjs(`${requestDate} ${slotRows[0].start_time}`, 'YYYY-MM-DD HH:mm:ss');
    if (firstSlotStart.diff(dayjs(), 'minute') < roomRows[0].min_notice_minutes) {
      throw new AppError(400, `Room requires at least ${roomRows[0].min_notice_minutes} minutes notice.`);
    }

    const [conflicts] = await connection.execute(
      `SELECT id
      FROM booking_slots
      WHERE room_id = ?
        AND booking_date = ?
        AND status = 'CONFIRMED'
        AND time_slot_id IN (${placeholders})`,
      [roomId, requestDate, ...slotIds]
    );

    if (conflicts.length > 0) {
      throw new AppError(409, 'One or more selected slots are already confirmed for this room and date.');
    }

    const [insertResult] = await connection.execute(
      `INSERT INTO booking_requests
        (requester_user_id, room_id, request_date, status, emergency_override_requested, override_reason)
      VALUES (?, ?, ?, 'PENDING_DEAN', ?, ?)`,
      [actor.id, roomId, requestDate, emergencyOverrideRequested ? 1 : 0, overrideReason || null]
    );

    const bookingRequestId = insertResult.insertId;

    for (const slotId of slotIds) {
      await connection.execute(
        `INSERT INTO booking_request_slots (booking_request_id, time_slot_id)
        VALUES (?, ?)`,
        [bookingRequestId, slotId]
      );
    }

    await writeAction(connection, {
      actorUserId: actor.id,
      actorRoleCode: actor.roleCode,
      actionType: 'BOOKING_REQUEST_CREATED',
      targetType: 'BOOKING_REQUEST',
      targetId: bookingRequestId,
      reasonText: emergencyOverrideRequested ? overrideReason : null,
      metadata: {
        roomId,
        requestDate,
        slotIds,
        emergencyOverrideRequested
      }
    });

    return {
      bookingRequestId,
      status: REQUEST_STATUSES.PENDING_DEAN,
      roomId,
      requestDate,
      slotIds,
      emergencyOverrideRequested
    };
  });
}

async function getMyBookingRequests(actor) {
  const [rows] = await pool.execute(
    `SELECT
      br.id,
      br.room_id,
      r.name AS room_name,
      r.building,
      br.request_date,
      br.status,
      br.emergency_override_requested,
      br.created_at,
      GROUP_CONCAT(ts.label ORDER BY ts.start_time ASC SEPARATOR ', ') AS slot_labels
    FROM booking_requests br
    INNER JOIN rooms r ON r.id = br.room_id
    INNER JOIN booking_request_slots brs ON brs.booking_request_id = br.id
    INNER JOIN time_slots ts ON ts.id = brs.time_slot_id
    WHERE br.requester_user_id = ?
    GROUP BY br.id
    ORDER BY br.created_at DESC, br.id DESC`,
    [actor.id]
  );

  return rows.map((row) => ({
    requestId: row.id,
    room: {
      id: row.room_id,
      name: row.room_name,
      building: row.building
    },
    requestDate: toDateString(row.request_date),
    status: row.status,
    emergencyOverrideRequested: Boolean(row.emergency_override_requested),
    slotLabels: row.slot_labels,
    createdAt: row.created_at
  }));
}

async function getPendingApprovals(actor) {
  let query = '';
  let params = [];

  if (actor.roleCode === 'DEAN') {
    query =
      `SELECT
        br.id,
        br.request_date,
        br.status,
        br.created_at,
        u.full_name AS requester_name,
        r.id AS room_id,
        r.name AS room_name,
        r.building,
        GROUP_CONCAT(ts.label ORDER BY ts.start_time ASC SEPARATOR ', ') AS slot_labels,
        br.emergency_override_requested
      FROM booking_requests br
      INNER JOIN users u ON u.id = br.requester_user_id
      INNER JOIN rooms r ON r.id = br.room_id
      INNER JOIN departments d ON d.id = r.department_id
      INNER JOIN booking_request_slots brs ON brs.booking_request_id = br.id
      INNER JOIN time_slots ts ON ts.id = brs.time_slot_id
      WHERE br.status = 'PENDING_DEAN'
        AND d.dean_user_id = ?
      GROUP BY br.id
      ORDER BY br.created_at ASC, br.id ASC`;
    params = [actor.id];
  } else if (actor.roleCode === 'BOOKING_ADMIN' || actor.roleCode === 'SYSTEM_ADMIN') {
    query =
      `SELECT
        br.id,
        br.request_date,
        br.status,
        br.created_at,
        u.full_name AS requester_name,
        r.id AS room_id,
        r.name AS room_name,
        r.building,
        GROUP_CONCAT(ts.label ORDER BY ts.start_time ASC SEPARATOR ', ') AS slot_labels,
        br.emergency_override_requested
      FROM booking_requests br
      INNER JOIN users u ON u.id = br.requester_user_id
      INNER JOIN rooms r ON r.id = br.room_id
      INNER JOIN booking_request_slots brs ON brs.booking_request_id = br.id
      INNER JOIN time_slots ts ON ts.id = brs.time_slot_id
      WHERE br.status = 'PENDING_ADMIN'
      GROUP BY br.id
      ORDER BY br.created_at ASC, br.id ASC`;
  } else {
    throw new AppError(403, 'This user role does not have an approval queue.');
  }

  const [rows] = await pool.execute(query, params);

  return rows.map((row) => ({
    requestId: row.id,
    requestDate: toDateString(row.request_date),
    status: row.status,
    requesterName: row.requester_name,
    room: {
      id: row.room_id,
      name: row.room_name,
      building: row.building
    },
    slotLabels: row.slot_labels,
    emergencyOverrideRequested: Boolean(row.emergency_override_requested),
    createdAt: row.created_at
  }));
}

async function approveBookingRequest(requestIdInput, payload, actor) {
  const requestId = ensurePositiveInteger(requestIdInput, 'requestId');
  const decision = String(payload.decision || '').trim().toUpperCase();
  const note = parseOptionalText(payload.note);
  const emergencyOverride = toBoolean(payload.emergencyOverride);
  const overrideReason = parseOptionalText(payload.overrideReason);

  if (!['APPROVE', 'REJECT'].includes(decision)) {
    throw new AppError(400, "decision must be 'APPROVE' or 'REJECT'.");
  }

  if (decision === 'REJECT' && note.length === 0) {
    throw new AppError(400, 'note is required when rejecting a request.');
  }

  return withTransaction(async (connection) => {
    const [requestRows] = await connection.execute(
      `SELECT
        br.id,
        br.requester_user_id,
        br.room_id,
        br.request_date,
        br.status,
        r.department_id,
        d.dean_user_id
      FROM booking_requests br
      INNER JOIN rooms r ON r.id = br.room_id
      INNER JOIN departments d ON d.id = r.department_id
      WHERE br.id = ?
      FOR UPDATE`,
      [requestId]
    );

    if (requestRows.length === 0) {
      throw new AppError(404, 'Booking request not found.');
    }

    const request = requestRows[0];

    if (![REQUEST_STATUSES.PENDING_DEAN, REQUEST_STATUSES.PENDING_ADMIN].includes(request.status)) {
      throw new AppError(409, 'This request is no longer pending approval.');
    }

    const stage = request.status === REQUEST_STATUSES.PENDING_DEAN ? 'DEAN' : 'ADMIN';

    if (stage === 'DEAN') {
      if (!request.dean_user_id || actor.id !== request.dean_user_id) {
        throw new AppError(403, 'Only the owning department dean can perform stage-1 approval.');
      }
    }

    if (stage === 'ADMIN') {
      if (!['BOOKING_ADMIN', 'SYSTEM_ADMIN'].includes(actor.roleCode)) {
        throw new AppError(403, 'Only booking admin or system admin can perform stage-2 approval.');
      }
    }

    if (decision === 'REJECT') {
      await connection.execute(
        `INSERT INTO approvals (booking_request_id, stage, approver_user_id, decision, note)
        VALUES (?, ?, ?, 'REJECTED', ?)`,
        [requestId, stage, actor.id, note]
      );

      await connection.execute(
        `UPDATE booking_requests
        SET status = 'REJECTED'
        WHERE id = ?`,
        [requestId]
      );

      await writeAction(connection, {
        actorUserId: actor.id,
        actorRoleCode: actor.roleCode,
        actionType: 'BOOKING_REQUEST_REJECTED',
        targetType: 'BOOKING_REQUEST',
        targetId: requestId,
        reasonText: note,
        metadata: {
          stage
        }
      });

      return {
        requestId,
        stage,
        decision: 'REJECTED',
        status: REQUEST_STATUSES.REJECTED,
        roomId: request.room_id,
        requestDate: toDateString(request.request_date)
      };
    }

    if (stage === 'DEAN') {
      await connection.execute(
        `INSERT INTO approvals (booking_request_id, stage, approver_user_id, decision, note)
        VALUES (?, 'DEAN', ?, 'APPROVED', ?)`,
        [requestId, actor.id, note || null]
      );

      await connection.execute(
        `UPDATE booking_requests
        SET status = 'PENDING_ADMIN'
        WHERE id = ?`,
        [requestId]
      );

      await writeAction(connection, {
        actorUserId: actor.id,
        actorRoleCode: actor.roleCode,
        actionType: 'BOOKING_REQUEST_DEAN_APPROVED',
        targetType: 'BOOKING_REQUEST',
        targetId: requestId,
        reasonText: note || null,
        metadata: null
      });

      return {
        requestId,
        stage: 'DEAN',
        decision: 'APPROVED',
        status: REQUEST_STATUSES.PENDING_ADMIN,
        roomId: request.room_id,
        requestDate: toDateString(request.request_date)
      };
    }

    const [slotRows] = await connection.execute(
      `SELECT time_slot_id
      FROM booking_request_slots
      WHERE booking_request_id = ?
      ORDER BY time_slot_id ASC`,
      [requestId]
    );

    if (slotRows.length === 0) {
      throw new AppError(409, 'Request has no slots to approve.');
    }

    const slotIds = slotRows.map((row) => row.time_slot_id);
    const placeholders = slotIds.map(() => '?').join(', ');

    const [conflictRows] = await connection.execute(
      `SELECT
        bs.booking_id,
        b.booking_request_id AS conflicting_request_id,
        bs.time_slot_id
      FROM booking_slots bs
      INNER JOIN bookings b ON b.id = bs.booking_id
      WHERE bs.room_id = ?
        AND bs.booking_date = ?
        AND bs.status = 'CONFIRMED'
        AND bs.time_slot_id IN (${placeholders})
      FOR UPDATE`,
      [request.room_id, request.request_date, ...slotIds]
    );

    let overrideApplied = false;

    if (conflictRows.length > 0) {
      const canOverride = emergencyOverride && actor.roleCode === 'SYSTEM_ADMIN';

      if (!canOverride) {
        const conflictNote = note || 'Rejected due to confirmed booking conflict at final approval.';

        await connection.execute(
          `INSERT INTO approvals (booking_request_id, stage, approver_user_id, decision, note)
          VALUES (?, 'ADMIN', ?, 'REJECTED', ?)`,
          [requestId, actor.id, conflictNote]
        );

        await connection.execute(
          `UPDATE booking_requests
          SET status = 'REJECTED'
          WHERE id = ?`,
          [requestId]
        );

        await writeAction(connection, {
          actorUserId: actor.id,
          actorRoleCode: actor.roleCode,
          actionType: 'BOOKING_REQUEST_REJECTED',
          targetType: 'BOOKING_REQUEST',
          targetId: requestId,
          reasonText: conflictNote,
          metadata: {
            stage: 'ADMIN',
            reason: 'FINAL_CONFLICT'
          }
        });

        return {
          requestId,
          stage: 'ADMIN',
          decision: 'REJECTED',
          status: REQUEST_STATUSES.REJECTED,
          roomId: request.room_id,
          requestDate: toDateString(request.request_date)
        };
      }

      if (overrideReason.length === 0) {
        throw new AppError(400, 'overrideReason is required for emergency override.');
      }

      overrideApplied = true;
      const conflictingBookingIds = [...new Set(conflictRows.map((row) => row.booking_id))];
      const conflictingRequestIds = [...new Set(conflictRows.map((row) => row.conflicting_request_id))];

      const bookingPlaceholders = conflictingBookingIds.map(() => '?').join(', ');
      await connection.execute(
        `UPDATE bookings
        SET status = 'OVERRIDDEN', overridden_at = NOW(), override_reason = ?
        WHERE status = 'CONFIRMED'
          AND id IN (${bookingPlaceholders})`,
        [overrideReason, ...conflictingBookingIds]
      );

      await connection.execute(
        `UPDATE booking_slots
        SET status = 'OVERRIDDEN'
        WHERE status = 'CONFIRMED'
          AND booking_id IN (${bookingPlaceholders})`,
        conflictingBookingIds
      );

      if (conflictingRequestIds.length > 0) {
        const requestPlaceholders = conflictingRequestIds.map(() => '?').join(', ');
        await connection.execute(
          `UPDATE booking_requests
          SET status = 'CANCELLED'
          WHERE status = 'CONFIRMED'
            AND id IN (${requestPlaceholders})`,
          conflictingRequestIds
        );
      }

      for (const bookingId of conflictingBookingIds) {
        await writeAction(connection, {
          actorUserId: actor.id,
          actorRoleCode: actor.roleCode,
          actionType: 'BOOKING_OVERRIDDEN',
          targetType: 'BOOKING',
          targetId: bookingId,
          reasonText: overrideReason,
          metadata: {
            replacedByRequestId: requestId
          }
        });
      }
    }

    let bookingId = null;

    try {
      const [bookingInsert] = await connection.execute(
        `INSERT INTO bookings (booking_request_id, room_id, requester_user_id, status)
        VALUES (?, ?, ?, 'CONFIRMED')`,
        [requestId, request.room_id, request.requester_user_id]
      );
      bookingId = bookingInsert.insertId;

      for (const slotId of slotIds) {
        await connection.execute(
          `INSERT INTO booking_slots (booking_id, room_id, booking_date, time_slot_id, status)
          VALUES (?, ?, ?, ?, 'CONFIRMED')`,
          [bookingId, request.room_id, request.request_date, slotId]
        );
      }
    } catch (error) {
      if (bookingId) {
        await connection.execute('DELETE FROM bookings WHERE id = ?', [bookingId]);
      }

      if (error.code === 'ER_DUP_ENTRY') {
        const conflictNote = 'Rejected due to race-condition conflict during final confirmation.';

        await connection.execute(
          `INSERT INTO approvals (booking_request_id, stage, approver_user_id, decision, note)
          VALUES (?, 'ADMIN', ?, 'REJECTED', ?)`,
          [requestId, actor.id, conflictNote]
        );

        await connection.execute(
          `UPDATE booking_requests
          SET status = 'REJECTED'
          WHERE id = ?`,
          [requestId]
        );

        await writeAction(connection, {
          actorUserId: actor.id,
          actorRoleCode: actor.roleCode,
          actionType: 'BOOKING_REQUEST_REJECTED',
          targetType: 'BOOKING_REQUEST',
          targetId: requestId,
          reasonText: conflictNote,
          metadata: {
            stage: 'ADMIN',
            reason: 'RACE_CONFLICT'
          }
        });

        return {
          requestId,
          stage: 'ADMIN',
          decision: 'REJECTED',
          status: REQUEST_STATUSES.REJECTED,
          roomId: request.room_id,
          requestDate: toDateString(request.request_date)
        };
      }

      throw error;
    }

    const approvalDecision = overrideApplied ? 'OVERRIDDEN' : 'APPROVED';
    const approvalNote = overrideApplied ? overrideReason : note || null;

    await connection.execute(
      `INSERT INTO approvals (booking_request_id, stage, approver_user_id, decision, note)
      VALUES (?, 'ADMIN', ?, ?, ?)`,
      [requestId, actor.id, approvalDecision, approvalNote]
    );

    await connection.execute(
      `UPDATE booking_requests
      SET status = 'CONFIRMED'
      WHERE id = ?`,
      [requestId]
    );

    await writeAction(connection, {
      actorUserId: actor.id,
      actorRoleCode: actor.roleCode,
      actionType: 'BOOKING_CONFIRMED',
      targetType: 'BOOKING',
      targetId: bookingId,
      reasonText: overrideApplied ? overrideReason : null,
      metadata: {
        requestId,
        overrideApplied
      }
    });

    return {
      requestId,
      bookingId,
      stage: 'ADMIN',
      decision: approvalDecision,
      status: REQUEST_STATUSES.CONFIRMED,
      roomId: request.room_id,
      requestDate: toDateString(request.request_date),
      overrideApplied
    };
  });
}

async function getBookingDetail(bookingIdInput) {
  const bookingId = ensurePositiveInteger(bookingIdInput, 'bookingId');

  const [bookingRows] = await pool.execute(
    `SELECT
      b.id,
      b.status,
      b.confirmed_at,
      b.cancelled_at,
      b.cancelled_reason,
      b.overridden_at,
      b.override_reason,
      br.id AS request_id,
      br.request_date,
      br.status AS request_status,
      r.id AS room_id,
      r.name AS room_name,
      r.building,
      u.id AS requester_user_id,
      u.full_name AS requester_name,
      u.email AS requester_email
    FROM bookings b
    INNER JOIN booking_requests br ON br.id = b.booking_request_id
    INNER JOIN rooms r ON r.id = b.room_id
    INNER JOIN users u ON u.id = b.requester_user_id
    WHERE b.id = ?`,
    [bookingId]
  );

  if (bookingRows.length === 0) {
    throw new AppError(404, 'Booking not found.');
  }

  const booking = bookingRows[0];

  const [slotRows] = await pool.execute(
    `SELECT
      bs.time_slot_id,
      ts.label,
      ts.start_time,
      ts.end_time,
      bs.booking_date,
      bs.status
    FROM booking_slots bs
    INNER JOIN time_slots ts ON ts.id = bs.time_slot_id
    WHERE bs.booking_id = ?
    ORDER BY ts.start_time ASC`,
    [bookingId]
  );

  const [approvalRows] = await pool.execute(
    `SELECT
      a.stage,
      a.decision,
      a.note,
      a.created_at,
      u.full_name AS approver_name,
      r.code AS approver_role
    FROM approvals a
    INNER JOIN users u ON u.id = a.approver_user_id
    INNER JOIN roles r ON r.id = u.role_id
    WHERE a.booking_request_id = ?
    ORDER BY a.created_at ASC`,
    [booking.request_id]
  );

  const [actionRows] = await pool.execute(
    `SELECT
      id,
      actor_user_id,
      actor_role_code,
      action_type,
      target_type,
      target_id,
      reason_text,
      metadata_json,
      created_at
    FROM action_logs
    WHERE (target_type = 'BOOKING' AND target_id = ?)
       OR (target_type = 'BOOKING_REQUEST' AND target_id = ?)
    ORDER BY created_at DESC, id DESC`,
    [bookingId, booking.request_id]
  );

  return {
    booking: {
      id: booking.id,
      status: booking.status,
      confirmedAt: booking.confirmed_at,
      cancelledAt: booking.cancelled_at,
      cancelledReason: booking.cancelled_reason,
      overriddenAt: booking.overridden_at,
      overrideReason: booking.override_reason,
      room: {
        id: booking.room_id,
        name: booking.room_name,
        building: booking.building
      },
      requester: {
        id: booking.requester_user_id,
        name: booking.requester_name,
        email: booking.requester_email
      },
      request: {
        id: booking.request_id,
        date: toDateString(booking.request_date),
        status: booking.request_status
      }
    },
    slots: slotRows.map((row) => ({
      slotId: row.time_slot_id,
      label: row.label,
      startTime: row.start_time,
      endTime: row.end_time,
      bookingDate: toDateString(row.booking_date),
      status: row.status
    })),
    approvals: approvalRows.map((row) => ({
      stage: row.stage,
      decision: row.decision,
      note: row.note,
      approverName: row.approver_name,
      approverRole: row.approver_role,
      createdAt: row.created_at
    })),
    actionLogs: actionRows.map((row) => ({
      id: row.id,
      actorUserId: row.actor_user_id,
      actorRoleCode: row.actor_role_code,
      actionType: row.action_type,
      targetType: row.target_type,
      targetId: row.target_id,
      reasonText: row.reason_text,
      metadata: row.metadata_json,
      createdAt: row.created_at
    }))
  };
}

async function cancelBooking(bookingIdInput, payload, actor) {
  const bookingId = ensurePositiveInteger(bookingIdInput, 'bookingId');
  const reason = parseOptionalText(payload.reason);

  if (reason.length === 0) {
    throw new AppError(400, 'reason is required when cancelling a booking.');
  }

  return withTransaction(async (connection) => {
    const [bookingRows] = await connection.execute(
      `SELECT
        b.id,
        b.status,
        b.booking_request_id,
        b.requester_user_id,
        b.room_id,
        br.request_date
      FROM bookings b
      INNER JOIN booking_requests br ON br.id = b.booking_request_id
      WHERE b.id = ?
      FOR UPDATE`,
      [bookingId]
    );

    if (bookingRows.length === 0) {
      throw new AppError(404, 'Booking not found.');
    }

    const booking = bookingRows[0];

    if (booking.status !== BOOKING_STATUSES.CONFIRMED) {
      throw new AppError(409, 'Only confirmed bookings can be cancelled.');
    }

    const isOwner = actor.id === booking.requester_user_id;
    const isAdmin = ['BOOKING_ADMIN', 'SYSTEM_ADMIN'].includes(actor.roleCode);

    if (!isOwner && !isAdmin) {
      throw new AppError(403, 'Only booking owner or admin role can cancel this booking.');
    }

    await connection.execute(
      `UPDATE bookings
      SET status = 'CANCELLED', cancelled_at = NOW(), cancelled_reason = ?
      WHERE id = ?`,
      [reason, bookingId]
    );

    await connection.execute(
      `UPDATE booking_slots
      SET status = 'CANCELLED'
      WHERE booking_id = ? AND status = 'CONFIRMED'`,
      [bookingId]
    );

    await connection.execute(
      `UPDATE booking_requests
      SET status = 'CANCELLED'
      WHERE id = ? AND status = 'CONFIRMED'`,
      [booking.booking_request_id]
    );

    await writeAction(connection, {
      actorUserId: actor.id,
      actorRoleCode: actor.roleCode,
      actionType: 'BOOKING_CANCELLED',
      targetType: 'BOOKING',
      targetId: bookingId,
      reasonText: reason,
      metadata: {
        bookingRequestId: booking.booking_request_id
      }
    });

    return {
      bookingId,
      status: BOOKING_STATUSES.CANCELLED,
      reason,
      roomId: booking.room_id,
      requestDate: toDateString(booking.request_date)
    };
  });
}

module.exports = {
  getRooms,
  getRoomAvailability,
  createBookingRequest,
  getMyBookingRequests,
  getPendingApprovals,
  approveBookingRequest,
  getBookingDetail,
  cancelBooking
};
