CREATE DATABASE IF NOT EXISTS smart_campus_reservation;
USE smart_campus_reservation;

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_code (code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS departments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  department_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_id (role_id),
  KEY idx_users_department_id (department_id),
  CONSTRAINT fk_users_role_id FOREIGN KEY (role_id) REFERENCES roles (id),
  CONSTRAINT fk_users_department_id FOREIGN KEY (department_id) REFERENCES departments (id)
) ENGINE=InnoDB;

ALTER TABLE departments
ADD COLUMN dean_user_id BIGINT UNSIGNED NULL,
ADD KEY idx_departments_dean_user_id (dean_user_id),
ADD CONSTRAINT fk_departments_dean_user_id FOREIGN KEY (dean_user_id) REFERENCES users (id);

CREATE TABLE IF NOT EXISTS rooms (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  building VARCHAR(120) NOT NULL,
  capacity INT NOT NULL,
  department_id BIGINT UNSIGNED NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rooms_name_building (name, building),
  KEY idx_rooms_department_id (department_id),
  CONSTRAINT fk_rooms_department_id FOREIGN KEY (department_id) REFERENCES departments (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS room_policies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id BIGINT UNSIGNED NOT NULL,
  min_notice_minutes INT NOT NULL DEFAULT 30,
  allow_emergency_override TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_room_policies_room_id (room_id),
  CONSTRAINT fk_room_policies_room_id FOREIGN KEY (room_id) REFERENCES rooms (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS time_slots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  label VARCHAR(50) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_time_slots_label (label),
  UNIQUE KEY uq_time_slots_window (start_time, end_time)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS booking_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  requester_user_id BIGINT UNSIGNED NOT NULL,
  room_id BIGINT UNSIGNED NOT NULL,
  request_date DATE NOT NULL,
  status ENUM('PENDING_DEAN', 'PENDING_ADMIN', 'CONFIRMED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_DEAN',
  emergency_override_requested TINYINT(1) NOT NULL DEFAULT 0,
  override_reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_booking_requests_requester_user_id (requester_user_id),
  KEY idx_booking_requests_room_date_status (room_id, request_date, status),
  CONSTRAINT fk_booking_requests_requester_user_id FOREIGN KEY (requester_user_id) REFERENCES users (id),
  CONSTRAINT fk_booking_requests_room_id FOREIGN KEY (room_id) REFERENCES rooms (id),
  CONSTRAINT chk_booking_requests_override_reason
    CHECK (
      emergency_override_requested = 0 OR
      (override_reason IS NOT NULL AND CHAR_LENGTH(TRIM(override_reason)) > 0)
    )
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS booking_request_slots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_request_id BIGINT UNSIGNED NOT NULL,
  time_slot_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_booking_request_slots_req_slot (booking_request_id, time_slot_id),
  KEY idx_booking_request_slots_slot_id (time_slot_id),
  CONSTRAINT fk_booking_request_slots_booking_request_id FOREIGN KEY (booking_request_id) REFERENCES booking_requests (id),
  CONSTRAINT fk_booking_request_slots_time_slot_id FOREIGN KEY (time_slot_id) REFERENCES time_slots (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS approvals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_request_id BIGINT UNSIGNED NOT NULL,
  stage ENUM('DEAN', 'ADMIN') NOT NULL,
  approver_user_id BIGINT UNSIGNED NOT NULL,
  decision ENUM('APPROVED', 'REJECTED', 'OVERRIDDEN') NOT NULL,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_approvals_request_stage (booking_request_id, stage),
  KEY idx_approvals_approver_user_id (approver_user_id),
  CONSTRAINT fk_approvals_booking_request_id FOREIGN KEY (booking_request_id) REFERENCES booking_requests (id),
  CONSTRAINT fk_approvals_approver_user_id FOREIGN KEY (approver_user_id) REFERENCES users (id),
  CONSTRAINT chk_approvals_rejection_note
    CHECK (
      decision <> 'REJECTED' OR
      (note IS NOT NULL AND CHAR_LENGTH(TRIM(note)) > 0)
    )
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bookings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_request_id BIGINT UNSIGNED NOT NULL,
  room_id BIGINT UNSIGNED NOT NULL,
  requester_user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('CONFIRMED', 'CANCELLED', 'OVERRIDDEN') NOT NULL DEFAULT 'CONFIRMED',
  confirmed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at DATETIME NULL,
  cancelled_reason TEXT NULL,
  overridden_at DATETIME NULL,
  override_reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bookings_booking_request_id (booking_request_id),
  KEY idx_bookings_room_id_status (room_id, status),
  CONSTRAINT fk_bookings_booking_request_id FOREIGN KEY (booking_request_id) REFERENCES booking_requests (id),
  CONSTRAINT fk_bookings_room_id FOREIGN KEY (room_id) REFERENCES rooms (id),
  CONSTRAINT fk_bookings_requester_user_id FOREIGN KEY (requester_user_id) REFERENCES users (id),
  CONSTRAINT chk_bookings_cancel_reason
    CHECK (
      status <> 'CANCELLED' OR
      (cancelled_reason IS NOT NULL AND CHAR_LENGTH(TRIM(cancelled_reason)) > 0)
    ),
  CONSTRAINT chk_bookings_override_reason
    CHECK (
      status <> 'OVERRIDDEN' OR
      (override_reason IS NOT NULL AND CHAR_LENGTH(TRIM(override_reason)) > 0)
    )
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS booking_slots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id BIGINT UNSIGNED NOT NULL,
  room_id BIGINT UNSIGNED NOT NULL,
  booking_date DATE NOT NULL,
  time_slot_id BIGINT UNSIGNED NOT NULL,
  status ENUM('CONFIRMED', 'CANCELLED', 'OVERRIDDEN') NOT NULL DEFAULT 'CONFIRMED',
  occupancy_key VARCHAR(128)
    GENERATED ALWAYS AS (
      CASE
        WHEN status = 'CONFIRMED' THEN CONCAT(room_id, ':', booking_date, ':', time_slot_id)
        ELSE NULL
      END
    ) STORED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_confirmed_occupancy (occupancy_key),
  UNIQUE KEY uq_booking_slots_booking_slot (booking_id, time_slot_id),
  KEY idx_booking_slots_room_date_status (room_id, booking_date, status),
  CONSTRAINT fk_booking_slots_booking_id FOREIGN KEY (booking_id) REFERENCES bookings (id),
  CONSTRAINT fk_booking_slots_room_id FOREIGN KEY (room_id) REFERENCES rooms (id),
  CONSTRAINT fk_booking_slots_time_slot_id FOREIGN KEY (time_slot_id) REFERENCES time_slots (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS action_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id BIGINT UNSIGNED NULL,
  actor_role_code VARCHAR(50) NOT NULL,
  action_type VARCHAR(60) NOT NULL,
  target_type VARCHAR(60) NOT NULL,
  target_id BIGINT UNSIGNED NULL,
  reason_text TEXT NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_action_logs_actor_user_id (actor_user_id),
  KEY idx_action_logs_target (target_type, target_id),
  CONSTRAINT fk_action_logs_actor_user_id FOREIGN KEY (actor_user_id) REFERENCES users (id)
) ENGINE=InnoDB;
