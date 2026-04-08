USE smart_campus_reservation;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE action_logs;
TRUNCATE TABLE booking_slots;
TRUNCATE TABLE bookings;
TRUNCATE TABLE approvals;
TRUNCATE TABLE booking_request_slots;
TRUNCATE TABLE booking_requests;
TRUNCATE TABLE room_policies;
TRUNCATE TABLE rooms;
TRUNCATE TABLE time_slots;
TRUNCATE TABLE users;
TRUNCATE TABLE departments;
TRUNCATE TABLE roles;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO roles (id, code, name) VALUES
  (1, 'REQUESTER', 'Requester'),
  (2, 'DEAN', 'Dean'),
  (3, 'BOOKING_ADMIN', 'Booking Admin'),
  (4, 'SYSTEM_ADMIN', 'System Admin');

INSERT INTO departments (id, name) VALUES
  (1, 'Engineering'),
  (2, 'Science');

INSERT INTO users (id, full_name, email, role_id, department_id) VALUES
  (1, 'Alice Requester', 'alice.requester@campus.edu', 1, 1),
  (2, 'Bob Dean', 'bob.dean@campus.edu', 2, 1),
  (3, 'Carla Dean', 'carla.dean@campus.edu', 2, 2),
  (4, 'Dan Booking Admin', 'dan.admin@campus.edu', 3, NULL),
  (5, 'Eve System Admin', 'eve.sysadmin@campus.edu', 4, NULL),
  (6, 'Frank Requester', 'frank.requester@campus.edu', 1, 2);

UPDATE departments SET dean_user_id = 2 WHERE id = 1;
UPDATE departments SET dean_user_id = 3 WHERE id = 2;

INSERT INTO rooms (id, name, building, capacity, department_id, is_active) VALUES
  (1, 'Lab 101', 'Engineering Building', 45, 1, 1),
  (2, 'Hall 201', 'Science Building', 120, 2, 1),
  (3, 'Auditorium A', 'Central Complex', 300, 1, 1);

INSERT INTO room_policies (room_id, min_notice_minutes, allow_emergency_override) VALUES
  (1, 30, 1),
  (2, 60, 1),
  (3, 120, 1);

INSERT INTO time_slots (id, label, start_time, end_time) VALUES
  (1, '08:00-10:00', '08:00:00', '10:00:00'),
  (2, '10:00-12:00', '10:00:00', '12:00:00'),
  (3, '13:00-15:00', '13:00:00', '15:00:00'),
  (4, '15:00-17:00', '15:00:00', '17:00:00'),
  (5, '17:00-19:00', '17:00:00', '19:00:00');

INSERT INTO booking_requests (id, requester_user_id, room_id, request_date, status, emergency_override_requested, override_reason)
VALUES
  (1, 1, 1, DATE_ADD(CURDATE(), INTERVAL 1 DAY), 'PENDING_DEAN', 0, NULL),
  (2, 6, 1, DATE_ADD(CURDATE(), INTERVAL 1 DAY), 'CONFIRMED', 0, NULL);

INSERT INTO booking_request_slots (booking_request_id, time_slot_id) VALUES
  (1, 1),
  (1, 2),
  (2, 3);

INSERT INTO approvals (booking_request_id, stage, approver_user_id, decision, note)
VALUES
  (2, 'DEAN', 2, 'APPROVED', 'Approved for campus seminar'),
  (2, 'ADMIN', 4, 'APPROVED', 'Confirmed by booking admin');

INSERT INTO bookings (id, booking_request_id, room_id, requester_user_id, status)
VALUES
  (1, 2, 1, 6, 'CONFIRMED');

INSERT INTO booking_slots (booking_id, room_id, booking_date, time_slot_id, status)
VALUES
  (1, 1, DATE_ADD(CURDATE(), INTERVAL 1 DAY), 3, 'CONFIRMED');

INSERT INTO action_logs (actor_user_id, actor_role_code, action_type, target_type, target_id, reason_text, metadata_json)
VALUES
  (1, 'REQUESTER', 'BOOKING_REQUEST_CREATED', 'BOOKING_REQUEST', 1, NULL, JSON_OBJECT('roomId', 1, 'slotCount', 2)),
  (4, 'BOOKING_ADMIN', 'BOOKING_CONFIRMED', 'BOOKING', 1, NULL, JSON_OBJECT('requestId', 2));
