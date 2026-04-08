# System Plan

## Audience
Human developers, reviewers, and AI coding assistants.

## Scope of This Document
This document is the current-state plan for this repository as implemented on 2026-04-09. It describes what exists now, what policies are enforced, and what remains next.

## Project Goal
Build a reliable room reservation system for campus use with strict conflict prevention, clear governance, and auditable decisions.

## Policy Rules (Repository-Enforced)
1. Equal rules for all requesters.
2. First-come first-served (FCFS) ordering for pending overlaps.
3. All bookings require manual approval.
4. Two-stage approval is mandatory:
   - Stage 1: Dean of room-owning department.
   - Stage 2: Booking Admin or System Admin.
5. Confirmed bookings are immutable in practice (no edit endpoint is exposed).
6. Any cancellation or override must include reason text.
7. Emergency override is allowed only during stage-2 conflict handling and only by SYSTEM_ADMIN, with mandatory reason and audit logging.

## Architecture Overview (Current)
1. Frontend: Static HTML pages with Tailwind CSS and vanilla JavaScript.
2. Backend: Node.js + Express.js route handlers and service logic.
3. Database: MySQL using raw SQL only (no ORM), accessed through mysql2.
4. Real-time: Socket.io broadcasts for live synchronization.
5. Data integrity: transaction-based writes plus uniqueness and check constraints in schema.

## Repository Structure Overview
1. client/
   - HTML pages for availability, request history, dean queue, admin queue, and booking detail.
   - Reusable JS modules for API calls, sockets, and UI components.
2. server/src/
   - app.js and server.js bootstrap.
   - routes/ for API endpoints.
   - services/reservationService.js for transactional booking logic.
   - db/schema.sql and db/seed.sql for schema and seed data.
   - middleware/ for auth, role checks, async handling, and error handling.
3. docs/
   - This plan, system description, and current progress report.

## Module Map and Status
1. Auth module
   - Implemented baseline: temporary x-user-id header auth.
   - Planned: session-based auth with role claims.
2. Room module
   - Implemented: room metadata, department ownership, dean mapping, room policy fields.
3. Booking Request module
   - Implemented: request creation, slot validation, FCFS metadata ordering.
4. Approval module
   - Implemented: stage transitions PENDING_DEAN -> PENDING_ADMIN -> CONFIRMED.
   - Implemented: rejection requires notes.
5. Booking module
   - Implemented: final booking creation, cancellation with reason, emergency override with reason.
6. Availability module
   - Implemented: slot projection with AVAILABLE, PENDING, CONFIRMED and pending queue context.
7. Audit module
   - Implemented: action logging for sensitive operations.
8. Real-time module
   - Implemented: booking, availability, and approval queue events via Socket.io.

## Data Model Summary (Current Schema)
Core table names:
1. roles
2. departments
3. users
4. rooms
5. room_policies
6. time_slots
7. booking_requests
8. booking_request_slots
9. approvals
10. bookings
11. booking_slots
12. action_logs

Key integrity constraints:
1. One approval per request stage via unique booking_request_id + stage.
2. Unique confirmed occupancy by room/date/slot through generated occupancy_key uniqueness.
3. Reason checks for override and cancellation states.
4. Request and booking state transitions are enforced in API service logic.

## API Surface (Current)
Implemented routes:
1. POST /api/booking-requests
2. POST /api/booking-requests/:requestId/approvals
3. POST /api/bookings/:bookingId/cancel
4. GET /api/rooms/:roomId/availability?date=YYYY-MM-DD
5. GET /api/booking-requests/my
6. GET /api/approvals/pending
7. GET /api/bookings/:bookingId
8. GET /api/rooms

Planned route work:
1. Authentication/session endpoints once session auth is introduced.
2. Additional routes only when aligned to policy rules and response contract consistency.

## Frontend Surface (Current)
Implemented pages:
1. / (availability board + booking modal)
2. /request-history.html
3. /dean-queue.html
4. /admin-queue.html
5. /booking-detail.html

Implemented UX requirements:
1. Clear slot status indicators (available, pending, confirmed).
2. Clear pending vs confirmed separation.
3. Reason-required inputs for cancellation and override flows.

## Security Plan
Current state:
1. Temporary x-user-id header auth for development/testing.
2. Role checks on protected actions.
3. Action logging for sensitive operations.
4. Payload validation in service layer with explicit error responses.

Next state:
1. Replace header auth with real session-based auth.
2. Expand validation coverage and harden authorization edge cases.

## Testing Plan
Current verification completed:
1. Dependency install smoke check.
2. Server startup smoke check.
3. Manual workflow sanity checks through implemented pages and routes.

Planned automated testing:
1. Unit tests for transition logic, permissions, and FCFS behavior.
2. Integration tests for full approval chain and conflict handling.
3. E2E tests for full UI flow from request to confirmation/cancellation.

## Known Gaps
1. Session authentication is not yet implemented.
2. Automated test suites are not yet in repository.
3. room_policies.allow_emergency_override exists in schema but is not yet enforced in final override decision gate.

## Working Agreements
1. Use small pull requests focused on one feature area.
2. Update DB schema with migration notes and compatibility notes when needed.
3. Keep API response format consistent.
4. Update DEVELOPMENT_PROGRESS_REPORT.md after each completed milestone.

## Documentation References (As of 2026-04-09)
1. docs/CURRENT_PROGRESS_REPORT.md
2. docs/SYSTEM_DESCRIPTION.md
3. DEVELOPMENT_PROGRESS_REPORT.md
4. README.md
