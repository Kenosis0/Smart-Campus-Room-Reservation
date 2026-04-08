# Smart Campus Room Reservation (Express + MySQL + Socket.io)

This implementation follows the governance and workflow requirements from `docs/SYSTEM_PLAN.md` using the requested stack:

- Frontend: HTML + Tailwind CSS + Vanilla JavaScript
- Backend: Node.js + Express.js
- Database: MySQL (raw SQL only)
- Real-time: Socket.io

## 1. Setup

1. Copy `.env.example` to `.env` and adjust values.
2. Ensure MySQL 8+ is running.
3. Run SQL scripts in order:
   - `server/src/db/schema.sql`
   - `server/src/db/seed.sql`
4. Install dependencies:
   - `npm install`
5. Start server:
   - `npm start`

Server starts at `http://localhost:4000`.

## 2. Demo User IDs (x-user-id header)

The UI includes a selector for these seeded users:

- `1` Alice Requester
- `2` Bob Dean (Engineering)
- `3` Carla Dean (Science)
- `4` Dan Booking Admin
- `5` Eve System Admin
- `6` Frank Requester

## 3. Implemented APIs

- `POST /api/booking-requests`
- `POST /api/booking-requests/:requestId/approvals`
- `POST /api/bookings/:bookingId/cancel`
- `GET /api/rooms/:roomId/availability?date=YYYY-MM-DD`
- `GET /api/booking-requests/my`
- `GET /api/approvals/pending`
- `GET /api/bookings/:bookingId`
- `GET /api/rooms`

## 4. Policy Enforcement Included

- FCFS pending order via `created_at` and deterministic ordering
- Two-stage approval flow:
  - Stage 1: Dean of room-owning department
  - Stage 2: Booking Admin/System Admin
- Confirmed booking immutability (no edit path)
- Mandatory reason for cancellation/override
- Conflict detection before final confirmation
- Emergency override limited to System Admin with mandatory reason
- Audit logging for sensitive actions

## 5. Frontend Pages

- `/` Availability board + booking request modal
- `/request-history.html` Request history
- `/dean-queue.html` Dean queue
- `/admin-queue.html` Admin queue
- `/booking-detail.html` Booking detail + cancellation

## 6. Real-time Events

Socket.io events emitted after committed writes:

- `availability:changed`
- `booking:changed`
- `approval:queue:changed`

Clients listen and refresh views automatically.
