# Smart Campus Room Reservation - Testing Scenarios

## Test Environment Setup

**Prerequisites:**
- MySQL 8.0+ running with smart_campus_reservation database
- Node.js server running on http://localhost:4000
- Browser with developer console access

**Demo Users:**
```
User ID 1: Alice (REQUESTER)
User ID 2: Bob (DEAN - Engineering)
User ID 3: Carla (DEAN - Science)
User ID 4: Dan (BOOKING_ADMIN)
User ID 5: Eve (SYSTEM_ADMIN)
User ID 6: Frank (REQUESTER)
```

**Demo Rooms:**
```
Room 1: Auditorium A (300 seats, Engineering)
Room 2: Lab 101 (45 seats, Engineering)
Room 3: Hall 201 (120 seats, Science)
```

**Time Slots:**
```
Slot 1: 08:00-10:00
Slot 2: 10:00-12:00
Slot 3: 13:00-15:00
Slot 4: 15:00-17:00
Slot 5: 17:00-19:00
```

---

## Priority 1: Core Workflow Tests

### Test 1.1: Happy Path - Complete Approval Flow

**Objective:** Verify booking request succeeds through all approval stages

**Steps:**
1. **Create Request (Alice as Requester)**
   - Go to Availability Board
   - Select Alice (User 1)
   - Pick a future date
   - Select Room 1 (Auditorium A)
   - Select 2 consecutive time slots (e.g., Slot 1 & 2)
   - Click "Request Booking"
   - Save request ID (e.g., #42)

   **Expected:** Request created, status = PENDING_DEAN

2. **Dean Approval (Bob)**
   - Switch to Bob (User 2)
   - Go to Dean Queue
   - Find Alice's request (#42)
   - Click Approve
   - Add note: "Approved for team meeting"
   - Click Confirm

   **Expected:** Status changes to PENDING_ADMIN, Bob shows as approver

3. **Admin Approval (Dan)**
   - Switch to Dan (User 4)
   - Go to Admin Queue
   - Find Alice's request (#42)
   - Click Approve
   - Click Confirm

   **Expected:** Status = CONFIRMED, booking is finalized

4. **Verification**
   - Switch back to Alice
   - Go to "My Requests"
   - Verify request #42 shows CONFIRMED
   - Click "View Details"
   - Verify both approval stages are marked APPROVED
   - Check Availability Board - Room 1 shows as BOOKED for those slots

**Result:** ✅ PASS / ❌ FAIL

---

### Test 1.2: Rejection at Dean Stage

**Objective:** Verify dean can reject request and return it to requester

**Steps:**
1. **Create Request (Alice)**
   - Create booking request for Room 2 (Lab 101)
   - Select time Slot 3 (13:00-15:00)
   - Save request ID (e.g., #43)

2. **Dean Rejection (Bob)**
   - Switch to Bob
   - Go to Dean Queue
   - Find request #43
   - Click Reject
   - Enter reason: "Insufficient notice required"
   - Click Confirm

   **Expected:** Status = REJECTED, reason is saved

3. **Verification**
   - Switch to Alice
   - Check "My Requests"
   - Request #43 shows REJECTED
   - Reason visible: "Insufficient notice required"
   - Room 2 Slot 3 shows AVAILABLE again on Availability Board

**Result:** ✅ PASS / ❌ FAIL

---

### Test 1.3: Cancel Confirmed Booking

**Objective:** Verify requester can cancel confirmed booking

**Steps:**
1. **Get Confirmed Booking**
   - Complete Test 1.1 or use existing confirmed booking

2. **Cancel Booking (Alice)**
   - Switch to Alice
   - Go to "My Requests"
   - Find confirmed booking #42
   - Click "View Details"
   - Click "Cancel Booking"
   - Enter reason: "Meeting moved to virtual"
   - Click Confirm

   **Expected:** Status = CANCELLED, reason recorded

3. **Verification**
   - Status shows CANCELLED
   - Time slots show AVAILABLE on Availability Board
   - New request can be created for same slot

**Result:** ✅ PASS / ❌ FAIL

---

## Priority 2: Role-Based Authorization Tests

### Test 2.1: Dean Can Only See Own Department

**Objective:** Verify deans only see requests for their department's rooms

**Steps:**
1. **Create Multiple Requests**
   - Request for Room 1 (Engineering, Bob's dept) by Alice
   - Request for Room 3 (Science, Carla's dept) by Frank

2. **Check Bob's Queue**
   - Switch to Bob
   - Go to Dean Queue
   - Should see only Room 1 request

3. **Check Carla's Queue**
   - Switch to Carla (User 3)
   - Go to Dean Queue
   - Should see only Room 3 request

**Expected:** Each dean sees only their department's requests

**Result:** ✅ PASS / ❌ FAIL

---

### Test 2.2: Admin Cannot Approve Before Dean

**Objective:** Verify admin can't approve if dean hasn't approved yet

**Steps:**
1. **Create Request (Alice)**
   - Request for Room 1, Slot 1
   - Status = PENDING_DEAN (not approved by dean yet)

2. **Try Admin Approval (Dan)**
   - Switch to Dan
   - Try to find request in Admin Queue
   - Request should NOT appear

**Expected:** Request not visible to admin until dean approves

**Result:** ✅ PASS / ❌ FAIL

---

### Test 2.3: System Admin Can Override

**Objective:** Verify only System Admin can use emergency override

**Steps:**
1. **Try Override as Dean (Bob)**
   - Create pending request
   - Switch to Bob
   - Look for override option
   - Should not be available

2. **Use Override as System Admin (Eve)**
   - Switch to Eve (User 5)
   - Should see override button/option
   - Can use emergency override feature

**Expected:** Override only available to System Admin

**Result:** ✅ PASS / ❌ FAIL

---

### Test 2.4: Requester Can't Access Admin Queue

**Objective:** Verify requesters cannot see admin-only pages

**Steps:**
1. **Try Access as Alice (Requester)**
   - Switch to Alice
   - Try to access Admin Queue directly via URL
   - Should be blocked or show no data

2. **Access as Dan (Admin)**
   - Switch to Dan
   - Access Admin Queue
   - Should work normally

**Expected:** Requesters cannot access restricted pages

**Result:** ✅ PASS / ❌ FAIL

---

## Priority 3: Validation & Constraint Tests

### Test 3.1: Prevent Double-Booking (Database Level)

**Objective:** Verify database prevents double-booking of same slot

**Steps:**
1. **Create and Approve First Request**
   - Alice requests Room 1, Slot 1 for April 30
   - Get it approved through both stages
   - Status = CONFIRMED

2. **Try to Create Overlapping Request**
   - Frank requests Room 1, Slot 1 for April 30
   - Get through dean approval
   - When admin tries to approve...

   **Expected:** Approval fails with "occupancy conflict" error
   OR Frank's request rejected due to conflict

3. **Verify Availability Board**
   - Room 1, Slot 1 shows as BOOKED
   - Cannot select it for new booking

**Result:** ✅ PASS / ❌ FAIL

---

### Test 3.2: Validate Time Slot Selection

**Objective:** Verify non-consecutive or invalid slots are caught

**Steps:**
1. **Try Request with Gap**
   - Try to select Slot 1 (08:00-10:00) and Slot 3 (13:00-15:00) in same request
   - Should only allow consecutive time slots

2. **Try Invalid Slot**
   - Try to double-select same slot
   - Should prevent duplicate selection

**Expected:** Form validation prevents invalid selections

**Result:** ✅ PASS / ❌ FAIL

---

### Test 3.3: Require Cancellation Reason

**Objective:** Verify cancellation reason is mandatory

**Steps:**
1. **Get Confirmed Booking**
   - Use existing confirmed booking

2. **Try Cancel Without Reason**
   - Click Cancel
   - Leave reason blank
   - Try to submit
   - Should be blocked

3. **Cancel With Reason**
   - Enter valid reason
   - Submit successfully

**Expected:** Cancellation reason is required field

**Result:** ✅ PASS / ❌ FAIL

---

### Test 3.4: Require Rejection Reason

**Objective:** Verify rejection reason is mandatory

**Steps:**
1. **Create Request**
   - Alice creates request

2. **Try Reject Without Reason (Bob)**
   - Switch to Bob
   - Go to Dean Queue
   - Click Reject
   - Try to submit without entering reason
   - Should be blocked

3. **Reject With Reason**
   - Enter valid rejection reason
   - Submit successfully

**Expected:** Rejection reason is required field

**Result:** ✅ PASS / ❌ FAIL

---

## Priority 4: Edge Cases & Error Handling

### Test 4.1: Past Date Booking Attempt

**Objective:** Verify cannot book rooms in the past

**Steps:**
1. **Try Book Past Date**
   - Go to Availability Board
   - Select yesterday's date
   - Try to create request
   - Should be blocked or show no availability

**Expected:** Past dates cannot be booked

**Result:** ✅ PASS / ❌ FAIL

---

### Test 4.2: Same User Multiple Requests

**Objective:** Verify user can have multiple concurrent requests

**Steps:**
1. **Create First Request**
   - Alice creates request for Room 1, April 30

2. **Create Second Request**
   - Alice creates request for Room 2, April 30
   - Different room, same day

3. **Verify Both Exist**
   - Go to "My Requests"
   - Should see both requests

**Expected:** User can have multiple requests simultaneously

**Result:** ✅ PASS / ❌ FAIL

---

### Test 4.3: Real-Time Updates

**Objective:** Verify Socket.io broadcasts work

**Steps:**
1. **Open Two Browsers**
   - Browser 1: Alice on Availability Board
   - Browser 2: Dan in Admin Queue

2. **Create and Approve Request**
   - Browser 1: Alice creates request
   - Browser 2: Dan approves it

3. **Check Updates**
   - Browser 1 availability should update
   - Should NOT need to refresh to see changes

**Expected:** Real-time updates without page refresh

**Result:** ✅ PASS / ❌ FAIL

---

### Test 4.4: Duplicate Approval Prevention

**Objective:** Verify can't approve same request twice

**Steps:**
1. **Get Request to PENDING_ADMIN**
   - Request is approved by dean

2. **First Admin Approval**
   - Dan approves it
   - Status = CONFIRMED

3. **Try Second Approval**
   - Try to approve same request again
   - Should be blocked or already show CONFIRMED

**Expected:** Can only approve once per stage

**Result:** ✅ PASS / ❌ FAIL

---

## Priority 5: Reports & Analytics Tests

### Test 5.1: Summary Report Access (All Users)

**Objective:** Verify all users can generate summary reports

**Steps:**
1. **Generate as Requester (Alice)**
   - Go to Reports page
   - Leave type as "Summary"
   - Click Generate
   - Report displays with metrics

2. **Generate as Dean (Bob)**
   - Same process - should work

3. **Generate as System Admin (Eve)**
   - Same process - should work

**Expected:** Summary reports visible to all roles

**Result:** ✅ PASS / ❌ FAIL

---

### Test 5.2: Full Report Access (System Admin Only)

**Objective:** Verify full reports only accessible to System Admin

**Steps:**
1. **Try as Requester (Alice)**
   - Go to Reports
   - Select "Full Report (Admin Only)"
   - Click Generate
   - Should show permission error

2. **Try as System Admin (Eve)**
   - Select "Full Report (Admin Only)"
   - Click Generate
   - Full report displays with all tables

**Expected:** Full reports require System Admin role

**Result:** ✅ PASS / ❌ FAIL

---

### Test 5.3: Report Metrics Accuracy

**Objective:** Verify report statistics match actual data

**Steps:**
1. **Count Actual Bookings**
   - Go to database or check all bookings via API

2. **Generate Summary Report**
   - Note "Total Bookings" count

3. **Verify Match**
   - Count should match database

**Expected:** Report metrics are accurate

**Result:** ✅ PASS / ❌ FAIL

---

### Test 5.4: JSON Download

**Objective:** Verify can download report as JSON

**Steps:**
1. **Generate Report**
   - Create and display report

2. **Click Download JSON**
   - File downloads to browser

3. **Verify JSON**
   - Open downloaded file
   - Verify it's valid JSON
   - Contains report data

**Expected:** JSON download works correctly

**Result:** ✅ PASS / ❌ FAIL

---

## Priority 6: API Tests (Optional - for developers)

### Test 6.1: POST /api/booking-requests

**Test Command:**
```bash
curl -X POST http://localhost:4000/api/booking-requests \
  -H "x-user-id: 1" \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": 1,
    "requestDate": "2026-04-30",
    "slotIds": [1, 2]
  }'
```

**Expected Response:** `201 Created` with request object

**Result:** ✅ PASS / ❌ FAIL

---

### Test 6.2: GET /api/rooms/1/availability

**Test Command:**
```bash
curl http://localhost:4000/api/rooms/1/availability?date=2026-04-30 \
  -H "x-user-id: 1"
```

**Expected Response:** `200 OK` with slots array

**Result:** ✅ PASS / ❌ FAIL

---

### Test 6.3: POST /api/booking-requests/42/approvals

**Test Command:**
```bash
curl -X POST http://localhost:4000/api/booking-requests/42/approvals \
  -H "x-user-id: 2" \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "APPROVED",
    "note": "Approved"
  }'
```

**Expected Response:** `200 OK` with approval result

**Result:** ✅ PASS / ❌ FAIL

---

### Test 6.4: Missing Authorization Header

**Test Command:**
```bash
curl http://localhost:4000/api/rooms
```

**Expected Response:** `401 Unauthorized`

**Result:** ✅ PASS / ❌ FAIL

---

## Test Summary Template

### Overall Test Results

| Test Category | Total | Passed | Failed | Notes |
|---------------|-------|--------|--------|-------|
| Core Workflow | 3 | — | — | |
| Authorization | 4 | — | — | |
| Validation | 4 | — | — | |
| Edge Cases | 4 | — | — | |
| Reports | 4 | — | — | |
| API | 4 | — | — | |
| **TOTAL** | **23** | **—** | **—** | |

---

## Test Execution Checklist

- [ ] Environment setup complete
- [ ] Demo users confirmed
- [ ] Database seeded
- [ ] Server running (no errors)
- [ ] Browser developer console open
- [ ] All Priority 1 tests pass
- [ ] All Priority 2 tests pass
- [ ] All Priority 3 tests pass
- [ ] All Priority 4 tests pass
- [ ] All Priority 5 tests pass
- [ ] All Priority 6 tests pass (optional)
- [ ] No console errors
- [ ] No database errors
- [ ] Performance acceptable (< 2s response time)

---

## Known Limitations

1. **No email notifications** - Approvers won't be notified via email
2. **No two-factor auth** - x-user-id header for demo only
3. **No rate limiting** - Can hammer API repeatedly
4. **No complex recurring bookings** - Can't book repeating times
5. **No room capacity conflict** - If 200 people book a 300-seat room, allows it (policy check missing)

---

## Regression Test (After Changes)

If code is modified, re-run:
1. Test 1.1 (Happy path)
2. Test 1.2 (Rejection)
3. Test 3.1 (Double-booking prevention)
4. Test 4.3 (Real-time updates)

These core tests catch most breaking changes.
