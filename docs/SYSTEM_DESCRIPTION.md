# System Description

## Project Title
Smart Campus Room Reservation

## Snapshot Date
2026-04-09

## 1. Repository Scope

This document describes the system exactly as implemented in this repository.

## 2. Purpose

Smart Campus Room Reservation is a governance-focused room booking platform for campus facilities.

Primary goals:
1. Prevent double booking.
2. Enforce two-stage manual approvals.
3. Preserve FCFS ordering for pending overlaps.
4. Keep auditable records of sensitive actions.

## 3. System Overview

End-to-end flow:
1. Requester submits booking request with room, date, and slot IDs.
2. Department dean handles stage-1 approval.
3. Booking Admin or System Admin handles stage-2 approval.
4. On successful final approval, booking and slot occupancy are created.
5. Cancellation and override actions require reason text and produce audit logs.
6. Socket.io updates connected clients on changes.

Workflow states in use:
1. booking_requests.status: PENDING_DEAN, PENDING_ADMIN, CONFIRMED, REJECTED, CANCELLED.
2. bookings.status: CONFIRMED, CANCELLED, OVERRIDDEN.
3. booking_slots.status: CONFIRMED, CANCELLED, OVERRIDDEN.

## 4. Runtime Architecture

1. Frontend runtime:
   - Static pages in client/ using Tailwind CDN and vanilla JavaScript modules.
2. Backend runtime:
   - Express app in server/src/app.js and server/src/server.js.
3. Data runtime:
   - MySQL via mysql2 connection pool and explicit transactions.
4. Real-time runtime:
   - Socket.io events emitted after state-changing API actions.

## 5. Repository Layout

1. client/
   - index.html, request-history.html, dean-queue.html, admin-queue.html, booking-detail.html.
   - JS modules under client/js/.
2. server/src/
   - routes/: rooms, bookingRequests, approvals, bookings.
   - services/: reservationService business logic.
   - db/: schema.sql, seed.sql, pool.js.
   - middleware/: auth, requireRoles, asyncHandler, errorHandler.
   - socket/events.js for emit helpers.
3. docs/
   - SYSTEM_PLAN.md, SYSTEM_DESCRIPTION.md, CURRENT_PROGRESS_REPORT.md.

## 6. Tech Stack and Justification

1. Node.js + Express.js:
   - Clear route/service separation, lightweight API layer, straightforward middleware.
2. MySQL + raw SQL:
   - Explicit transaction control and direct visibility of constraints.
3. mysql2:
   - Promise API with pooled connections and transaction support.
4. Socket.io:
   - Real-time broadcast channel for availability and queue updates.
5. HTML + Tailwind + vanilla JavaScript:
   - Beginner-friendly implementation and low overhead UI delivery.
6. dayjs:
   - Consistent date parsing/validation and formatting.
7. dotenv:
   - Environment-based configuration for local/deployment parity.
8. cors:
   - Controlled cross-origin API access from configured client origin.

## 7. API Surface (Current)

Implemented endpoints:
1. POST /api/booking-requests
2. POST /api/booking-requests/:requestId/approvals
3. POST /api/bookings/:bookingId/cancel
4. GET /api/rooms/:roomId/availability?date=YYYY-MM-DD
5. GET /api/booking-requests/my
6. GET /api/approvals/pending
7. GET /api/bookings/:bookingId
8. GET /api/rooms

## 8. Data Dictionary

### 8.1 roles
Purpose: role catalog for authorization.

Columns:
1. id: primary key.
2. code: unique role code.
3. name: role display name.
4. created_at: creation timestamp.

### 8.2 departments
Purpose: owning unit for rooms and dean mapping.

Columns:
1. id: primary key.
2. name: unique department name.
3. dean_user_id: nullable FK to users.id.
4. created_at: creation timestamp.

### 8.3 users
Purpose: actors in booking and approval workflows.

Columns:
1. id: primary key.
2. full_name: user display name.
3. email: unique email.
4. role_id: FK to roles.id.
5. department_id: nullable FK to departments.id.
6. created_at: creation timestamp.

### 8.4 rooms
Purpose: reservable room inventory.

Columns:
1. id: primary key.
2. name: room name.
3. building: building label.
4. capacity: seat capacity.
5. department_id: FK to departments.id.
6. is_active: active flag.
7. created_at: creation timestamp.

### 8.5 room_policies
Purpose: per-room booking policy values.

Columns:
1. id: primary key.
2. room_id: unique FK to rooms.id.
3. min_notice_minutes: lead-time requirement.
4. allow_emergency_override: room-level override policy flag.
5. created_at: creation timestamp.

### 8.6 time_slots
Purpose: reusable slot definitions.

Columns:
1. id: primary key.
2. label: slot label.
3. start_time: slot start.
4. end_time: slot end.
5. created_at: creation timestamp.

### 8.7 booking_requests
Purpose: request lifecycle before final booking.

Columns:
1. id: primary key.
2. requester_user_id: FK to users.id.
3. room_id: FK to rooms.id.
4. request_date: requested calendar date.
5. status: request workflow state.
6. emergency_override_requested: priority intent flag.
7. override_reason: required when emergency_override_requested is true.
8. created_at: creation timestamp.
9. updated_at: update timestamp.

### 8.8 booking_request_slots
Purpose: mapping from request to selected slots.

Columns:
1. id: primary key.
2. booking_request_id: FK to booking_requests.id.
3. time_slot_id: FK to time_slots.id.
4. created_at: creation timestamp.

Constraint:
1. Unique booking_request_id + time_slot_id.

### 8.9 approvals
Purpose: stage decisions by dean/admin actors.

Columns:
1. id: primary key.
2. booking_request_id: FK to booking_requests.id.
3. stage: DEAN or ADMIN.
4. approver_user_id: FK to users.id.
5. decision: APPROVED, REJECTED, OVERRIDDEN.
6. note: rejection/decision note.
7. created_at: creation timestamp.

Constraint:
1. Unique booking_request_id + stage.

### 8.10 bookings
Purpose: final booking records after stage-2 completion.

Columns:
1. id: primary key.
2. booking_request_id: unique FK to booking_requests.id.
3. room_id: FK to rooms.id.
4. requester_user_id: FK to users.id.
5. status: CONFIRMED, CANCELLED, OVERRIDDEN.
6. confirmed_at: confirmation timestamp.
7. cancelled_at: cancellation timestamp.
8. cancelled_reason: required when status is CANCELLED.
9. overridden_at: override timestamp.
10. override_reason: required when status is OVERRIDDEN.
11. created_at: creation timestamp.
12. updated_at: update timestamp.

### 8.11 booking_slots
Purpose: slot-level occupancy records associated with bookings.

Columns:
1. id: primary key.
2. booking_id: FK to bookings.id.
3. room_id: FK to rooms.id.
4. booking_date: occupied date.
5. time_slot_id: FK to time_slots.id.
6. status: CONFIRMED, CANCELLED, OVERRIDDEN.
7. occupancy_key: generated key used for unique confirmed occupancy.
8. created_at: creation timestamp.
9. updated_at: update timestamp.

Constraints:
1. Unique confirmed occupancy via occupancy_key.
2. Unique booking_id + time_slot_id per booking.

### 8.12 action_logs
Purpose: audit history for sensitive operations.

Columns:
1. id: primary key.
2. actor_user_id: nullable FK to users.id.
3. actor_role_code: role code at action time.
4. action_type: action identifier.
5. target_type: target entity type.
6. target_id: target entity id.
7. reason_text: reason text when provided/required.
8. metadata_json: structured metadata payload.
9. created_at: event timestamp.

## 9. Governance and Integrity Controls

1. Two-stage approval path is required before confirmation.
2. Unique confirmed slot occupancy prevents double-booking.
3. Cancellation and override paths require reasons.
4. Action logs provide audit traceability.
5. Role checks enforce stage ownership and action authority.

## 10. Current Limitations

1. Authentication is temporary and header-based (x-user-id).
2. Automated test suites are not yet committed.
3. room_policies.allow_emergency_override is not yet applied in final override gate logic.

## 11. Planned Repository Evolution

1. Add session-based auth with role claims.
2. Add unit, integration, and E2E test suites.
3. Harden validation and role edge-case handling.
4. Enforce room-level allow_emergency_override in final override checks.
