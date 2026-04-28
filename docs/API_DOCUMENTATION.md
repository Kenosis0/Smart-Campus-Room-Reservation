# Smart Campus Room Reservation - API Documentation

**Base URL:** `http://localhost:4000`

**Authentication:** All endpoints require `x-user-id` header (demo user ID)

**Response Format:** All responses follow standard JSON with `success`, `data`, and optional `error` fields

---

## Authentication & Authorization

### User Roles
- **REQUESTER** (roleCode: `REQUESTER`): Can create booking requests
- **DEAN** (roleCode: `DEAN`): Can approve Stage 1 (Dean) approvals
- **BOOKING_ADMIN** (roleCode: `BOOKING_ADMIN`): Can approve Stage 2 (Admin) approvals
- **SYSTEM_ADMIN** (roleCode: `SYSTEM_ADMIN`): Full access, can override decisions

### Demo Users
```
x-user-id: 1  → Alice (REQUESTER)
x-user-id: 2  → Bob (DEAN - Engineering)
x-user-id: 3  → Carla (DEAN - Science)
x-user-id: 4  → Dan (BOOKING_ADMIN)
x-user-id: 5  → Eve (SYSTEM_ADMIN)
x-user-id: 6  → Frank (REQUESTER)
```

---

## Rooms API

### GET /api/rooms
Retrieve all active rooms with capacity and department info.

**Headers:**
```
x-user-id: <user-id>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Auditorium A",
      "building": "Central Complex",
      "capacity": 300,
      "department": {
        "id": 1,
        "name": "Engineering"
      }
    },
    {
      "id": 2,
      "name": "Lab 101",
      "building": "Engineering Building",
      "capacity": 45,
      "department": {
        "id": 1,
        "name": "Engineering"
      }
    }
  ]
}
```

**Use Case:** Display available rooms on the Availability page

---

### GET /api/rooms/:roomId/availability
Get time slot availability for a specific room on a given date.

**Headers:**
```
x-user-id: <user-id>
```

**Query Parameters:**
```
date=YYYY-MM-DD  (required) - Date to check availability
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "roomId": 1,
    "roomName": "Auditorium A",
    "requestDate": "2026-04-28",
    "slots": [
      {
        "slotId": 1,
        "label": "08:00-10:00",
        "status": "CONFIRMED",
        "requesterName": "Alice Requester",
        "bookingDate": "2026-04-28"
      },
      {
        "slotId": 2,
        "label": "10:00-12:00",
        "status": "AVAILABLE"
      },
      {
        "slotId": 3,
        "label": "13:00-15:00",
        "status": "PENDING"
      }
    ]
  }
}
```

**Slot Status:**
- `AVAILABLE`: No bookings
- `CONFIRMED`: Booked and approved
- `PENDING`: Booking request pending approval

**Use Case:** Show which time slots are available when creating a booking request

---

## Booking Requests API

### POST /api/booking-requests
Create a new booking request (multi-slot support).

**Headers:**
```
x-user-id: <user-id>
Content-Type: application/json
```

**Request Body:**
```json
{
  "roomId": 1,
  "requestDate": "2026-04-28",
  "slotIds": [1, 2, 3]
}
```

**Validation:**
- `roomId`: Must exist and be active
- `requestDate`: Must be today or later
- `slotIds`: Must be valid time slots (not already confirmed for this room/date)
- Multiple slots can be requested in one request

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "bookingRequestId": 42,
    "roomId": 1,
    "requesterName": "Alice Requester",
    "requestDate": "2026-04-28",
    "status": "PENDING_DEAN",
    "slots": [
      {"slotId": 1, "label": "08:00-10:00"},
      {"slotId": 2, "label": "10:00-12:00"}
    ],
    "createdAt": "2026-04-28T10:30:00Z"
  }
}
```

**Status After Creation:** `PENDING_DEAN` (waiting for Dean approval)

**Error Cases:**
```
400 Bad Request
- Missing required fields
- Invalid slot IDs
- Request date in the past
- Slot already confirmed

404 Not Found
- Room doesn't exist
```

**Use Case:** User creates a booking request from the Availability page

---

### GET /api/booking-requests/my
Get all booking requests created by the current user.

**Headers:**
```
x-user-id: <user-id>
```

**Query Parameters:**
```
status=PENDING_DEAN|PENDING_ADMIN|CONFIRMED|REJECTED|CANCELLED  (optional)
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "requestId": 42,
      "roomName": "Auditorium A",
      "building": "Central Complex",
      "requestDate": "2026-04-28",
      "status": "PENDING_DEAN",
      "slots": [
        {"slotId": 1, "label": "08:00-10:00"},
        {"slotId": 2, "label": "10:00-12:00"}
      ],
      "approvalHistory": [
        {
          "stage": "DEAN",
          "approverName": "Bob Dean",
          "decision": "APPROVED",
          "note": "Approved for engineering meeting"
        }
      ],
      "createdAt": "2026-04-28T10:30:00Z"
    }
  ]
}
```

**Use Case:** Show user's booking history on "My Requests" page

---

### POST /api/booking-requests/:requestId/approvals
Approve or reject a booking request at current stage.

**Headers:**
```
x-user-id: <user-id>
Content-Type: application/json
```

**Request Body:**
```json
{
  "decision": "APPROVED",
  "note": "Approved for department meeting",
  "emergencyOverride": false
}
```

**Parameters:**
- `decision`: `APPROVED`, `REJECTED`, or `OVERRIDDEN` (SYSTEM_ADMIN only)
- `note`: Reason text (required for REJECTED or OVERRIDDEN)
- `emergencyOverride`: Boolean (SYSTEM_ADMIN only, handles conflicts)

**Authorization Rules:**
- **Stage 1 (PENDING_DEAN)**: Only room's department Dean
- **Stage 2 (PENDING_ADMIN)**: Only BOOKING_ADMIN or SYSTEM_ADMIN
- **Override**: Only SYSTEM_ADMIN, requires reason

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "requestId": 42,
    "bookingId": 15,
    "stage": "DEAN",
    "decision": "APPROVED",
    "status": "PENDING_ADMIN",
    "roomName": "Auditorium A",
    "requestDate": "2026-04-28",
    "note": "Approved for department meeting",
    "approvedAt": "2026-04-28T11:00:00Z"
  }
}
```

**Status Progression:**
```
PENDING_DEAN → (APPROVED) → PENDING_ADMIN → (APPROVED) → CONFIRMED
                 ↓                            ↓
            REJECTED                    REJECTED
```

**Error Cases:**
```
403 Forbidden
- User is not authorized to approve this request
- User is not the Dean for this room

404 Not Found
- Request doesn't exist

409 Conflict
- Request already approved/rejected
- Slots are now booked by another request
```

**Use Case:** Dean or Admin approves/rejects booking requests from their queue page

---

## Bookings API

### GET /api/bookings/:bookingId
Get details of a confirmed booking.

**Headers:**
```
x-user-id: <user-id>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "bookingId": 15,
    "roomName": "Auditorium A",
    "building": "Central Complex",
    "capacity": 300,
    "bookingDate": "2026-04-28",
    "requesterName": "Alice Requester",
    "slots": [
      {"slotId": 1, "label": "08:00-10:00"},
      {"slotId": 2, "label": "10:00-12:00"}
    ],
    "status": "CONFIRMED",
    "confirmedAt": "2026-04-28T11:15:00Z",
    "approvalChain": [
      {
        "stage": "DEAN",
        "approverName": "Bob Dean",
        "decision": "APPROVED"
      },
      {
        "stage": "ADMIN",
        "approverName": "Dan Booking Admin",
        "decision": "APPROVED"
      }
    ]
  }
}
```

**Use Case:** Show booking details on "Booking Detail" page

---

### POST /api/bookings/:bookingId/cancel
Cancel a confirmed booking.

**Headers:**
```
x-user-id: <user-id>
Content-Type: application/json
```

**Request Body:**
```json
{
  "reason": "Meeting cancelled due to emergencies"
}
```

**Validation:**
- `reason`: Required, must be non-empty
- Only the requester or SYSTEM_ADMIN can cancel

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "bookingId": 15,
    "status": "CANCELLED",
    "reason": "Meeting cancelled due to emergencies",
    "cancelledAt": "2026-04-28T14:00:00Z"
  }
}
```

**Error Cases:**
```
400 Bad Request
- Missing cancellation reason

403 Forbidden
- User is not the requester or System Admin

404 Not Found
- Booking doesn't exist

409 Conflict
- Booking is already cancelled
```

**Use Case:** User cancels their confirmed booking

---

## Approvals Queue API

### GET /api/approvals/pending
Get pending approval requests for current user.

**Headers:**
```
x-user-id: <user-id>
```

**Query Parameters:**
```
stage=DEAN|ADMIN  (optional) - Filter by stage
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "currentUserStage": "DEAN",
    "departmentName": "Engineering",
    "pending": [
      {
        "requestId": 42,
        "requesterName": "Alice Requester",
        "roomName": "Lab 101",
        "building": "Engineering Building",
        "requestDate": "2026-04-28",
        "slots": [
          {"slotId": 1, "label": "08:00-10:00"},
          {"slotId": 2, "label": "10:00-12:00"}
        ],
        "status": "PENDING_DEAN",
        "createdAt": "2026-04-28T10:30:00Z",
        "stage": "DEAN"
      }
    ]
  }
}
```

**Authorization:** Only shows requests relevant to current user's role

**Use Case:** Show queue of pending approvals on Dean/Admin queue pages

---

## Reports API

### GET /api/reports/summary
Generate summary room utilization report (accessible to all).

**Headers:**
```
x-user-id: <user-id>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "totals": {
      "rooms": 3,
      "bookings": 5,
      "confirmed": 3,
      "cancelled": 0,
      "cancellation_rate": "0.00%"
    },
    "top_room": {
      "room_name": "Auditorium A",
      "booking_count": 2
    },
    "peak_time": {
      "start_time": "10:00",
      "end_time": "12:00",
      "usage_count": 3
    }
  }
}
```

**Use Case:** Quick overview of system usage for any user

---

### GET /api/reports/utilization
Generate detailed room utilization report (Admin/System Admin only).

**Headers:**
```
x-user-id: <user-id>
```

**Query Parameters:**
```
type=summary|full  (optional, default: summary)
```

**Authorization:** 
- `summary`: All users
- `full`: SYSTEM_ADMIN only

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "summary": {
      "totals": {...},
      "top_room": {...},
      "peak_time": {...}
    },
    "full": {
      "room_statistics": [
        {
          "room_name": "Auditorium A",
          "department": "Engineering",
          "capacity": 300,
          "total_bookings": 2,
          "confirmed": 2,
          "cancelled": 0,
          "utilization_rate": "50%"
        }
      ],
      "department_usage": [...],
      "approval_statistics": [...],
      "request_statistics": [...]
    }
  }
}
```

**Use Case:** System Admin views comprehensive utilization reports

---

## Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "message": "Description of what went wrong",
    "code": "ERROR_CODE",
    "statusCode": 400
  }
}
```

**Common Error Codes:**
```
AUTH_REQUIRED        - Missing x-user-id header
AUTH_FAILED          - User not found
FORBIDDEN            - Insufficient permissions
NOT_FOUND            - Resource doesn't exist
BAD_REQUEST          - Invalid input
CONFLICT             - Business logic conflict
SERVER_ERROR         - Unexpected error
```

---

## Real-time Events (Socket.io)

The system broadcasts real-time updates to all connected clients:

### availability_updated
```json
{
  "type": "availability_updated",
  "roomId": 1,
  "requestDate": "2026-04-28"
}
```

### approval_queue_changed
```json
{
  "type": "approval_queue_changed",
  "requestId": 42,
  "status": "PENDING_ADMIN"
}
```

### booking_changed
```json
{
  "type": "booking_changed",
  "bookingId": 15,
  "status": "CONFIRMED"
}
```

---

## Rate Limiting & Security

- No hard rate limits implemented (consider adding in production)
- Input validation on all endpoints
- SQL injection prevention via parameterized queries
- CORS enabled for localhost development

---

## Response Status Codes

```
200 OK              - Successful GET/POST/PUT request
201 Created         - Resource successfully created
400 Bad Request     - Invalid input or validation error
401 Unauthorized    - Authentication required
403 Forbidden       - Insufficient permissions
404 Not Found       - Resource doesn't exist
409 Conflict        - Business logic conflict
500 Server Error    - Unexpected error
```

---

## Testing with cURL

### Create a booking request:
```bash
curl -X POST http://localhost:4000/api/booking-requests \
  -H "x-user-id: 1" \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": 1,
    "requestDate": "2026-04-28",
    "slotIds": [1, 2]
  }'
```

### Get availability:
```bash
curl http://localhost:4000/api/rooms/1/availability?date=2026-04-28 \
  -H "x-user-id: 1"
```

### Approve a request:
```bash
curl -X POST http://localhost:4000/api/booking-requests/42/approvals \
  -H "x-user-id: 2" \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "APPROVED",
    "note": "Approved"
  }'
```

### Get reports:
```bash
curl http://localhost:4000/api/reports/summary \
  -H "x-user-id: 5"
```
