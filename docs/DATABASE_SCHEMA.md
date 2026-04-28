# Smart Campus Room Reservation - Database Schema Documentation

## Overview

**Database:** `smart_campus_reservation` (MySQL 8.0+)

**Design Pattern:** Third Normal Form (3NF) with enforced constraints

**Key Features:**
- 12 normalized tables with referential integrity
- Temporal tracking (created_at, updated_at)
- Role-based access control via users and roles tables
- Two-stage approval workflow tracking
- Audit logging for all actions
- Double-booking prevention via unique occupancy_key constraint

---

## Table Reference

### 1. **roles** - User Role Definitions
Stores role types for role-based access control (RBAC).

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | Role identifier |
| code | VARCHAR(50) | UNIQUE, NOT NULL | Unique role code (e.g., REQUESTER, DEAN, BOOKING_ADMIN, SYSTEM_ADMIN) |
| name | VARCHAR(100) | NOT NULL | Human-readable role name |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Data:**
```sql
INSERT INTO roles (code, name) VALUES
('REQUESTER', 'Room Requester'),
('DEAN', 'Department Dean'),
('BOOKING_ADMIN', 'Booking Administrator'),
('SYSTEM_ADMIN', 'System Administrator');
```

**Relationships:** Referenced by `users.role_id`

---

### 2. **departments** - Campus Departments
Stores department information and department-dean relationships.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | Department identifier |
| name | VARCHAR(120) | UNIQUE, NOT NULL | Department name (e.g., Engineering, Science) |
| dean_user_id | BIGINT UNSIGNED | FK → users.id, NULL | Dean who approves Stage 1 requests for this department's rooms |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Data Example:**
```sql
INSERT INTO departments (name, dean_user_id) VALUES
('Engineering', 2),      -- Bob Dean
('Science', 3);          -- Carla Dean
```

**Relationships:**
- Has many `users` (via department_id)
- Has many `rooms` (via department_id)
- References `users.id` for dean_user_id

**Key Constraint:**
- `fk_departments_dean_user_id`: Ensures dean_user_id is a valid user

---

### 3. **users** - System Users
Stores all user accounts with role and department assignments.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | User identifier |
| full_name | VARCHAR(120) | NOT NULL | User's full name |
| email | VARCHAR(190) | UNIQUE, NOT NULL | User's email (unique) |
| role_id | BIGINT UNSIGNED | FK → roles.id, NOT NULL | User's role |
| department_id | BIGINT UNSIGNED | FK → departments.id, NULL | User's department (NULL for admins) |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Data Example:**
```sql
INSERT INTO users (full_name, email, role_id, department_id) VALUES
('Alice Requester', 'alice@campus.edu', 1, NULL),
('Bob Dean', 'bob@campus.edu', 2, 1),        -- Dean of Engineering
('Carla Dean', 'carla@campus.edu', 2, 2),   -- Dean of Science
('Dan Booking Admin', 'dan@campus.edu', 3, NULL),
('Eve System Admin', 'eve@campus.edu', 4, NULL),
('Frank Requester', 'frank@campus.edu', 1, NULL);
```

**Relationships:**
- Has many `booking_requests` (via requester_user_id)
- Has many `approvals` (via approver_user_id)
- Has many `bookings` (via requester_user_id)
- Has many `action_logs` (via actor_user_id)

**Indexes:**
- `idx_users_role_id`: For role-based queries
- `idx_users_department_id`: For department-based queries

---

### 4. **rooms** - Campus Rooms
Stores room information with capacity and department ownership.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | Room identifier |
| name | VARCHAR(120) | UNIQUE with building, NOT NULL | Room name (e.g., Auditorium A, Lab 101) |
| building | VARCHAR(120) | UNIQUE with name, NOT NULL | Building name |
| capacity | INT | NOT NULL | Room capacity (number of seats/people) |
| department_id | BIGINT UNSIGNED | FK → departments.id, NOT NULL | Department that owns this room |
| is_active | TINYINT(1) | DEFAULT 1 | Soft delete flag (1 = active, 0 = inactive) |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Data Example:**
```sql
INSERT INTO rooms (name, building, capacity, department_id, is_active) VALUES
('Auditorium A', 'Central Complex', 300, 1, 1),    -- Engineering
('Lab 101', 'Engineering Building', 45, 1, 1),    -- Engineering
('Hall 201', 'Science Building', 120, 2, 1);      -- Science
```

**Relationships:**
- Belongs to `departments` (via department_id)
- Has one `room_policies` (via room_id)
- Has many `bookings` (via room_id)
- Has many `booking_slots` (via room_id)

**Unique Constraint:**
- `uq_rooms_name_building`: Ensures (name, building) is unique

**Indexes:**
- `idx_rooms_department_id`: For department-based queries

---

### 5. **room_policies** - Room-Specific Policies
Stores policies for each room (notice requirements, emergency override permission).

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | Policy identifier |
| room_id | BIGINT UNSIGNED | FK → rooms.id, UNIQUE, NOT NULL | Room this policy applies to |
| min_notice_minutes | INT | DEFAULT 30 | Minimum advance notice required (in minutes) |
| allow_emergency_override | TINYINT(1) | DEFAULT 1 | Whether System Admin can override double-bookings (1 = yes) |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Data Example:**
```sql
INSERT INTO room_policies (room_id, min_notice_minutes, allow_emergency_override) VALUES
(1, 30, 1),    -- Auditorium A: 30 min notice, emergency override allowed
(2, 60, 0),    -- Lab 101: 60 min notice, no emergency override
(3, 30, 1);    -- Hall 201: 30 min notice, emergency override allowed
```

**Relationships:**
- Belongs to `rooms` (via room_id)

**Unique Constraint:**
- `uq_room_policies_room_id`: One policy per room

---

### 6. **time_slots** - Daily Time Slots
Stores predefined time slots for room bookings (e.g., 08:00-10:00).

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | Slot identifier |
| label | VARCHAR(50) | UNIQUE, NOT NULL | Slot label (e.g., "08:00-10:00") |
| start_time | TIME | UNIQUE with end_time, NOT NULL | Slot start time |
| end_time | TIME | UNIQUE with start_time, NOT NULL | Slot end time |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Data Example:**
```sql
INSERT INTO time_slots (label, start_time, end_time) VALUES
('08:00-10:00', '08:00:00', '10:00:00'),
('10:00-12:00', '10:00:00', '12:00:00'),
('13:00-15:00', '13:00:00', '15:00:00'),
('15:00-17:00', '15:00:00', '17:00:00'),
('17:00-19:00', '17:00:00', '19:00:00');
```

**Relationships:**
- Has many `booking_request_slots` (via time_slot_id)
- Has many `booking_slots` (via time_slot_id)

**Unique Constraints:**
- `uq_time_slots_label`: Unique label
- `uq_time_slots_window`: Unique (start_time, end_time) pair

---

### 7. **booking_requests** - Room Booking Requests
Central table tracking all booking requests through approval workflow.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | Request identifier |
| requester_user_id | BIGINT UNSIGNED | FK → users.id, NOT NULL | User who created request |
| room_id | BIGINT UNSIGNED | FK → rooms.id, NOT NULL | Room being requested |
| request_date | DATE | NOT NULL | Date of requested booking |
| status | ENUM(...) | DEFAULT 'PENDING_DEAN', NOT NULL | Current workflow status |
| emergency_override_requested | TINYINT(1) | DEFAULT 0 | Whether System Admin override was requested (1 = yes) |
| override_reason | TEXT | NULL | Reason for emergency override request |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last modification timestamp |

**Status Values:**
```
PENDING_DEAN    → Waiting for Department Dean approval
PENDING_ADMIN   → Waiting for Booking Admin approval (Dean approved)
CONFIRMED       → Fully approved and confirmed
REJECTED        → Rejected at any stage
CANCELLED       → User cancelled the request
```

**Data Example:**
```sql
INSERT INTO booking_requests 
  (requester_user_id, room_id, request_date, status, emergency_override_requested, override_reason)
VALUES
(1, 1, '2026-04-28', 'CONFIRMED', 0, NULL),
(1, 2, '2026-04-29', 'PENDING_ADMIN', 0, NULL),
(6, 1, '2026-04-30', 'PENDING_DEAN', 0, NULL);
```

**Relationships:**
- Belongs to `users` (via requester_user_id)
- Belongs to `rooms` (via room_id)
- Has many `booking_request_slots` (via booking_request_id)
- Has one `bookings` (via booking_request_id, 1:1 relationship)
- Has many `approvals` (via booking_request_id)

**Indexes:**
- `idx_booking_requests_requester_user_id`: For user's request history
- `idx_booking_requests_room_date_status`: For availability queries

**Check Constraint:**
- `chk_booking_requests_override_reason`: If emergency_override_requested=1, override_reason must be non-empty

---

### 8. **booking_request_slots** - Request's Time Slots
Join table linking booking requests to time slots (many-to-many).

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | Relation identifier |
| booking_request_id | BIGINT UNSIGNED | FK → booking_requests.id, NOT NULL | Request this slot belongs to |
| time_slot_id | BIGINT UNSIGNED | FK → time_slots.id, NOT NULL | Time slot being requested |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Data Example:**
```sql
INSERT INTO booking_request_slots (booking_request_id, time_slot_id) VALUES
(1, 1),  -- Request 1 includes 08:00-10:00
(1, 2),  -- Request 1 includes 10:00-12:00
(2, 3),  -- Request 2 includes 13:00-15:00
(3, 1);  -- Request 3 includes 08:00-10:00
```

**Relationships:**
- Belongs to `booking_requests` (via booking_request_id)
- Belongs to `time_slots` (via time_slot_id)

**Unique Constraint:**
- `uq_booking_request_slots_req_slot`: One entry per (request, slot) pair

---

### 9. **approvals** - Approval Decisions
Tracks approval decisions at each workflow stage.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | Approval record identifier |
| booking_request_id | BIGINT UNSIGNED | FK → booking_requests.id, NOT NULL | Request being approved |
| stage | ENUM('DEAN', 'ADMIN') | NOT NULL | Which stage of workflow |
| approver_user_id | BIGINT UNSIGNED | FK → users.id, NOT NULL | User who made the decision |
| decision | ENUM(...) | NOT NULL | Decision made |
| note | TEXT | NULL | Reason/notes for decision |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Decision timestamp |

**Decision Values:**
```
APPROVED    → Request approved at this stage
REJECTED    → Request rejected at this stage
OVERRIDDEN  → System Admin overrode previous decision (conflict resolution)
```

**Data Example:**
```sql
INSERT INTO approvals 
  (booking_request_id, stage, approver_user_id, decision, note)
VALUES
(1, 'DEAN', 2, 'APPROVED', 'Approved for department meeting'),
(1, 'ADMIN', 4, 'APPROVED', 'Scheduling confirmed'),
(2, 'DEAN', 2, 'REJECTED', 'Insufficient notice');
```

**Relationships:**
- Belongs to `booking_requests` (via booking_request_id)
- Belongs to `users` (via approver_user_id)

**Unique Constraint:**
- `uq_approvals_request_stage`: One approval record per (request, stage) pair

**Check Constraint:**
- `chk_approvals_rejection_note`: If decision='REJECTED', note must be non-empty

---

### 10. **bookings** - Confirmed Bookings
Created after both approval stages complete. Immutable in practice.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | Booking identifier |
| booking_request_id | BIGINT UNSIGNED | FK → booking_requests.id, UNIQUE, NOT NULL | Associated request (1:1) |
| room_id | BIGINT UNSIGNED | FK → rooms.id, NOT NULL | Room being booked |
| requester_user_id | BIGINT UNSIGNED | FK → users.id, NOT NULL | Person who made the booking |
| status | ENUM(...) | DEFAULT 'CONFIRMED', NOT NULL | Booking status |
| confirmed_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | When booking was confirmed |
| cancelled_at | DATETIME | NULL | When booking was cancelled |
| cancelled_reason | TEXT | NULL | Why booking was cancelled |
| overridden_at | DATETIME | NULL | When booking was overridden |
| override_reason | TEXT | NULL | Why booking was overridden |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last modification timestamp |

**Status Values:**
```
CONFIRMED   → Booking is active and reserved
CANCELLED   → User cancelled the booking
OVERRIDDEN  → System Admin overrode this booking (resolved conflict)
```

**Data Example:**
```sql
INSERT INTO bookings 
  (booking_request_id, room_id, requester_user_id, status, confirmed_at)
VALUES
(1, 1, 1, 'CONFIRMED', CURRENT_TIMESTAMP),
(2, 2, 1, 'CANCELLED', CURRENT_TIMESTAMP);
```

**Relationships:**
- Belongs to `booking_requests` (via booking_request_id)
- Belongs to `rooms` (via room_id)
- Belongs to `users` (via requester_user_id)
- Has many `booking_slots` (via booking_id)

**Indexes:**
- `idx_bookings_room_id_status`: For room availability queries

**Unique Constraint:**
- `uq_bookings_booking_request_id`: One booking per request

**Check Constraints:**
- `chk_bookings_cancel_reason`: If status='CANCELLED', cancelled_reason must be non-empty
- `chk_bookings_override_reason`: If status='OVERRIDDEN', override_reason must be non-empty

---

### 11. **booking_slots** - Confirmed Slots
Individual time slots for confirmed bookings. Contains the critical occupancy_key for conflict prevention.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | Slot record identifier |
| booking_id | BIGINT UNSIGNED | FK → bookings.id, NOT NULL | Booking this slot belongs to |
| room_id | BIGINT UNSIGNED | FK → rooms.id, NOT NULL | Room (denormalized for performance) |
| booking_date | DATE | NOT NULL | Date of the booking |
| time_slot_id | BIGINT UNSIGNED | FK → time_slots.id, NOT NULL | Time slot |
| status | ENUM(...) | DEFAULT 'CONFIRMED', NOT NULL | Slot status |
| occupancy_key | VARCHAR(128) | GENERATED STORED, UNIQUE | Auto-generated unique key for confirmed slots |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last modification timestamp |

**Status Values:**
```
CONFIRMED   → Slot is reserved
CANCELLED   → Slot was cancelled
OVERRIDDEN  → Slot was overridden
```

**occupancy_key Generation:**
```
IF status = 'CONFIRMED' THEN
  occupancy_key = CONCAT(room_id, ':', booking_date, ':', time_slot_id)
ELSE
  occupancy_key = NULL
END
```

**Example occupancy_key:** `1:2026-04-28:1` (Room 1, April 28, Slot 1)

**Data Example:**
```sql
INSERT INTO booking_slots 
  (booking_id, room_id, booking_date, time_slot_id, status)
VALUES
(1, 1, '2026-04-28', 1, 'CONFIRMED'),  -- occupancy_key = '1:2026-04-28:1'
(1, 1, '2026-04-28', 2, 'CONFIRMED'),  -- occupancy_key = '1:2026-04-28:2'
(2, 2, '2026-04-29', 3, 'CONFIRMED');  -- occupancy_key = '2:2026-04-29:3'
```

**Relationships:**
- Belongs to `bookings` (via booking_id)
- Belongs to `rooms` (via room_id)
- Belongs to `time_slots` (via time_slot_id)

**Unique Constraint (Critical):**
- `uq_confirmed_occupancy`: Ensures occupancy_key is unique (PREVENTS DOUBLE-BOOKING)

**Index:**
- `idx_booking_slots_room_date_status`: For availability queries

**How It Prevents Double-Booking:**
If two bookings try to reserve Room 1 on April 28 at Slot 1:
- First booking: occupancy_key = '1:2026-04-28:1' ✅ Inserted
- Second booking: occupancy_key = '1:2026-04-28:1' ❌ UNIQUE constraint violation

---

### 12. **action_logs** - Audit Trail
Logs all significant actions for audit and accountability.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | Log entry identifier |
| actor_user_id | BIGINT UNSIGNED | FK → users.id, NULL | User who performed action |
| actor_role_code | VARCHAR(50) | NOT NULL | Role of the actor at time of action |
| action_type | VARCHAR(60) | NOT NULL | Type of action (e.g., CREATE_REQUEST, APPROVE_REQUEST) |
| target_type | VARCHAR(60) | NOT NULL | Type of entity affected (e.g., BOOKING_REQUEST, BOOKING) |
| target_id | BIGINT UNSIGNED | NULL | ID of affected entity |
| reason_text | TEXT | NULL | Reason provided by actor (rejections, cancellations) |
| metadata_json | JSON | NULL | Additional structured data |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Action timestamp |

**Data Example:**
```sql
INSERT INTO action_logs 
  (actor_user_id, actor_role_code, action_type, target_type, target_id, reason_text)
VALUES
(1, 'REQUESTER', 'CREATE_REQUEST', 'BOOKING_REQUEST', 1, NULL),
(2, 'DEAN', 'APPROVE_REQUEST', 'BOOKING_REQUEST', 1, 'Approved for department meeting'),
(4, 'BOOKING_ADMIN', 'APPROVE_REQUEST', 'BOOKING_REQUEST', 1, NULL),
(1, 'REQUESTER', 'CANCEL_BOOKING', 'BOOKING', 2, 'Meeting cancelled');
```

**Relationships:**
- References `users` (via actor_user_id)

**Indexes:**
- `idx_action_logs_actor_user_id`: For user action history
- `idx_action_logs_target`: For entity-based audit queries

---

## Workflow State Diagram

```
Booking Request Lifecycle:

┌─────────────────────────────────────────────────────┐
│ CREATE REQUEST (status = PENDING_DEAN)              │
│ → Insert booking_requests record                    │
│ → Insert N booking_request_slots records            │
│ → Log action                                        │
└─────────────────────────────────────────────────────┘
                    ↓
        ┌───────────────────────┐
        │ DEAN REVIEW           │
        │ (PENDING_DEAN stage)  │
        └───────────────────────┘
        ↓                        ↓
    APPROVED              REJECTED
    Status→PENDING_ADMIN  Status→REJECTED
    ↓                     ↓
    ┌────────────────────┐ End
    │ ADMIN REVIEW       │
    │ (PENDING_ADMIN)    │
    └────────────────────┘
    ↓                    ↓
  APPROVED          REJECTED
  Status→CONFIRMED  Status→REJECTED
  Create booking    ↓
  Create booking_   End
  slots records
  ↓
┌──────────────────────────────────┐
│ CONFIRMED BOOKING                │
│ Status = CONFIRMED               │
│ User can now cancel              │
└──────────────────────────────────┘
  ↓
  CANCEL → Status = CANCELLED
           Cancel booking_slots
```

---

## Key Constraints Summary

| Constraint | Table | Purpose |
|-----------|-------|---------|
| PK | All | Ensure unique record identity |
| FK | All related | Maintain referential integrity |
| UNIQUE (occupancy_key) | booking_slots | **Prevent double-booking** |
| UNIQUE (name, building) | rooms | No duplicate rooms |
| UNIQUE (label) | time_slots | No duplicate slots |
| UNIQUE (email) | users | No duplicate users |
| UNIQUE (code, stage) | approvals | One approval per stage per request |
| CHECK (override_reason) | booking_requests | Emergency override must have reason |
| CHECK (note) | approvals | Rejection must have reason |
| CHECK (cancelled_reason) | bookings | Cancellation must have reason |

---

## Normalization Analysis (3NF)

**First Normal Form (1NF):**
- All columns contain atomic values (no repeating groups)
- Many-to-many relationships normalized with junction tables (booking_request_slots, booking_slots)

**Second Normal Form (2NF):**
- Non-key attributes fully depend on primary key, not partial keys
- No partial dependencies on composite keys

**Third Normal Form (3NF):**
- No transitive dependencies between non-key attributes
- All attributes either identify the entity or describe it directly
- No multi-valued dependencies outside of 1:N relationships

**Example - No Transitive Dependency:**
- `booking_requests` has `requester_user_id`, not `requester_name` (name is property of users, not booking)

---

## Performance Indexes

**Hot Query Paths:**
1. Get room availability on a date
   - Index: `idx_booking_slots_room_date_status`
   
2. Get user's requests
   - Index: `idx_booking_requests_requester_user_id`

3. Get dean's pending approvals
   - Index: `idx_approvals_approver_user_id`

4. Prevent double-booking
   - Index: `uq_confirmed_occupancy` (UNIQUE constraint)

---

## Security Features

1. **Foreign Keys:** Referential integrity prevents orphaned records
2. **Check Constraints:** Enforces required reasons for rejections/cancellations
3. **Unique Constraints:** Prevents data duplication
4. **Audit Logging:** action_logs table tracks all changes
5. **Role-Based:** Users table links to roles for permission checking
6. **Temporal Tracking:** created_at and updated_at on all business tables

---

## Seed Data Summary

**Departments:** Engineering, Science

**Users (6 total):**
- Alice (Requester)
- Bob (Dean - Engineering)
- Carla (Dean - Science)
- Dan (Booking Admin)
- Eve (System Admin)
- Frank (Requester)

**Rooms (3 total):**
- Auditorium A (300 seats, Engineering)
- Lab 101 (45 seats, Engineering)
- Hall 201 (120 seats, Science)

**Time Slots (5 total):**
- 08:00-10:00, 10:00-12:00, 13:00-15:00, 15:00-17:00, 17:00-19:00

**Sample Bookings (created via seed.sql):**
- Various confirmed, pending, and rejected bookings for demonstration
