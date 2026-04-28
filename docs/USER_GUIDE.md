# Smart Campus Room Reservation - User Guide

## Quick Start

1. **Open:** http://localhost:4000
2. **Select User:** Choose your role from the dropdown
3. **Navigate:** Use the menu to access your workflows

---

## User Roles

### 👤 Requester (Alice, Frank)
**Permissions:**
- Create booking requests for any room
- View own requests
- Cancel confirmed bookings

**Workflow:** Make Request → Wait for Dean → Wait for Admin → Confirmed or Rejected

---

### 👨‍🏫 Dean (Bob, Carla)
**Permissions:**
- Approve/reject booking requests for their department's rooms
- View pending approvals queue

**Workflow:** Review Queue → Approve/Reject → Move to Admin Stage

**Department Assignments:**
- Bob Dean: Engineering department
- Carla Dean: Science department

---

### 👔 Booking Admin (Dan)
**Permissions:**
- Approve/reject booking requests that Dean approved
- Handle final conflicts
- View all pending approvals

**Workflow:** Review Queue → Approve/Reject → Booking Confirmed or Rejected

---

### 🔑 System Admin (Eve)
**Permissions:**
- **All** permissions from other roles
- Generate full system reports
- Emergency override bookings (resolve conflicts)
- Cancel any booking

**Workflow:** Full system access + special powers

---

## Page-by-Page Workflows

### 1️⃣ **Availability Board** (Main Page)

**Purpose:** Browse rooms and create booking requests

**Steps:**

#### For Requesters:
1. **Select User:** Choose your name from dropdown
2. **Select Date:** Pick date you want to book
3. **Click Refresh:** Load availability for that date
4. **View Rooms:** See all rooms with:
   - Room name & capacity
   - Building location
   - Department
   - Time slot availability (color-coded)
   - Booking counts (Confirmed/Pending)

5. **Book a Room:**
   - Click **"Request Booking"** on any room card
   - Modal opens to select time slots
   - Can select multiple consecutive time slots
   - Click **"Create Request"** to submit
   - See confirmation with request ID

**Color Coding:**
```
🟢 Green (08:00-10:00, 17:00-19:00)  = AVAILABLE (can book)
🔴 Red (10:00-12:00, 13:00-15:00)   = CONFIRMED (already booked)
🟡 Yellow (13:00-15:00)              = PENDING (awaiting approval)
```

**Real-Time Updates:** Board updates automatically when approvals happen

---

### 2️⃣ **My Requests** (For Requesters)

**Purpose:** Track your booking requests through approval stages

**What You See:**
```
Request #42 for Lab 101
├─ Status: PENDING_ADMIN (waiting for admin approval)
├─ Date: April 28, 2026
├─ Time Slots: 08:00-10:00, 10:00-12:00
├─ Approval History:
│  ✓ Dean (Bob) - APPROVED "Approved for engineering team"
│  ⏳ Admin - PENDING
└─ Created: Apr 28 10:30 AM
```

**Actions Available:**
- View approval chain (who approved/rejected and why)
- Cancel request if still pending
- See when/if it's approved

**Status Meanings:**
```
PENDING_DEAN   → Waiting for department dean
PENDING_ADMIN  → Dean approved, waiting for admin
CONFIRMED      → All approvals done! Your booking is confirmed
REJECTED       → Someone rejected it (see reason)
CANCELLED      → You cancelled it or admin overrode it
```

---

### 3️⃣ **Dean Queue** (For Department Deans)

**Purpose:** Review and approve/reject Stage 1 requests

**What You See:**
```
Pending Approvals for Engineering Department (5 requests)

Request #42
├─ Requester: Alice Requester
├─ Room: Lab 101
├─ Date: April 28, 2026
├─ Time Slots: 08:00-10:00, 10:00-12:00
├─ Requested On: Apr 28 10:30 AM
└─ [APPROVE] [REJECT]

Request #45
├─ Requester: Frank Requester
├─ Room: Auditorium A
├─ ...
```

**Approval Process:**

**To APPROVE:**
1. Review request details
2. Click **"Approve"** button
3. (Optional) Enter approval note
4. Click **"Confirm Approval"**
5. Request moves to Admin for Stage 2
6. Requester notified (if email enabled)

**To REJECT:**
1. Click **"Reject"** button
2. **REQUIRED:** Enter reason (e.g., "Insufficient notice")
3. Click **"Confirm Rejection"**
4. Requester notified of rejection
5. Request status becomes REJECTED

**Rules:**
- ✅ Can only approve requests for your department's rooms
- ✅ Can see all other deans' approvals (for context)
- ❌ Cannot approve requests for other departments
- ⏰ Real-time: Queue updates when new requests arrive

**Keyboard Shortcuts:** None (future enhancement)

---

### 4️⃣ **Admin Queue** (For Booking Admin)

**Purpose:** Review and approve/reject Stage 2 requests (final stage)

**What You See:**
```
Pending Approvals (7 requests)

Request #42 for Lab 101 (PENDING_ADMIN)
├─ Requester: Alice Requester
├─ Department: Engineering
├─ Room: Lab 101
├─ Date: April 28, 2026
├─ Time Slots: 08:00-10:00, 10:00-12:00
├─ Dean Status: ✓ APPROVED (Bob Dean)
└─ [APPROVE] [REJECT]
```

**Approval Process:**

**To APPROVE:**
1. Click **"Approve"** button
2. (Optional) Enter confirmation note
3. Click **"Confirm Approval"**
4. ✅ Request becomes CONFIRMED
5. Booking is created and locked in
6. Requester notified
7. Room now shows as booked on Availability Board

**To REJECT:**
1. Click **"Reject"** button
2. **REQUIRED:** Enter reason
3. Click **"Confirm Rejection"**
4. Request marked as REJECTED
5. Time slots become available again for other requesters

**Conflict Handling (System Admin Only):**
If a double-booking is detected (shouldn't happen due to database constraints):
- System Admin can **"Override"** to resolve
- Must provide override reason
- Creates audit trail entry
- Previous booking may be cancelled

---

### 5️⃣ **Booking Detail** (Information Page)

**Purpose:** View full details of a specific booking

**What You See:**
```
Booking #15 - CONFIRMED ✓

Room Information:
├─ Name: Auditorium A
├─ Building: Central Complex
├─ Capacity: 300 seats
└─ Department: Engineering

Booking Details:
├─ Date: April 28, 2026
├─ Time Slots: 
│  ├─ 08:00-10:00 ✓ CONFIRMED
│  ├─ 10:00-12:00 ✓ CONFIRMED
│  └─ (2 time slots total)
├─ Requester: Alice Requester
└─ Confirmed On: Apr 28 11:15 AM

Approval Chain:
├─ Stage 1 (DEAN): ✓ Bob Dean - APPROVED
│  └─ Note: "Approved for department meeting"
└─ Stage 2 (ADMIN): ✓ Dan Admin - APPROVED

Actions:
└─ [CANCEL BOOKING]  (if you're the requester or System Admin)
```

**Cancellation:**
1. Click **"Cancel Booking"** button
2. **REQUIRED:** Enter cancellation reason
3. Click **"Confirm Cancellation"**
4. Status becomes CANCELLED
5. Time slots freed up for others
6. Audit log created

---

### 6️⃣ **Reports** (Analytics Dashboard)

**Purpose:** View system usage and analytics

**Access:**
- Summary Report: All roles
- Full Report: System Admin only

#### Summary Report (Visible to All):
```
Quick Overview

Total Rooms: 3
Total Bookings: 5
Confirmed: 3
Cancelled: 0
Cancellation Rate: 0.00%

Most Booked Room: Auditorium A (2 bookings)
Peak Usage Time: 10:00-12:00 (3 uses)
```

**Use Cases:**
- See system utilization at a glance
- Understand demand patterns
- Quick statistics

#### Full Report (System Admin Only):
```
Comprehensive Analysis

Room Statistics:
├─ Auditorium A: 2 bookings, 50% utilization
├─ Lab 101: 1 booking, 25% utilization
└─ Hall 201: 2 bookings, 75% utilization

Department Usage:
├─ Engineering: 3 bookings
└─ Science: 2 bookings

Peak Hours Analysis:
├─ 10:00-12:00: 3 uses (most popular)
├─ 13:00-15:00: 2 uses
└─ 08:00-10:00: 1 use

Approval Statistics:
├─ Total Requests: 8
├─ Approved: 5
├─ Rejected: 2
├─ Pending: 1
└─ Average approval time: 2.3 hours

Request Statistics:
├─ By Day: Chart showing booking patterns
└─ By Department: Usage breakdown

Cancellation Analysis:
├─ Total Cancelled: 0
├─ Cancellation Rate: 0.00%
└─ Reasons: (if any)

Recent Activity:
└─ Detailed audit log of all actions

User Activity:
└─ Breakdown of who booked what
```

**Report Download:**
1. Choose Report Type (Summary/Full)
2. Click "Generate"
3. Report displays in table format
4. Click "Download JSON" to export as JSON file

---

## Common Workflows

### Workflow A: Create & Get Approved Booking (3 steps)

**Scenario:** Alice wants to book Lab 101 for April 28, 08:00-12:00

**Step 1 - Alice (Requester):**
1. Go to Availability Board
2. Select Alice from dropdown
3. Pick April 28
4. Click "Refresh"
5. Find Lab 101
6. Click "Request Booking"
7. Select 08:00-10:00 and 10:00-12:00
8. Click "Create Request"
9. ✅ Request created with ID #42
10. Status = PENDING_DEAN

**Step 2 - Bob (Dean of Engineering):**
1. Go to Dean Queue
2. See Alice's request #42 for Lab 101
3. Review: "Yes, this is for a legitimate engineering team meeting"
4. Click "Approve"
5. Add note: "Approved for engineering team"
6. Click "Confirm Approval"
7. ✅ Request moves to admin
8. Status = PENDING_ADMIN

**Step 3 - Dan (Booking Admin):**
1. Go to Admin Queue
2. See Alice's request #42
3. Verify: No conflicts, dean approved
4. Click "Approve"
5. Click "Confirm Approval"
6. ✅ Booking confirmed!
7. Status = CONFIRMED
8. Alice's booking is locked in

**Result:** Alice sees her booking as CONFIRMED on "My Requests" page
Lab 101 shows as "CONFIRMED" on Availability Board for those slots

---

### Workflow B: Reject a Request (Dean)

**Scenario:** Bob needs to reject Frank's request for short notice

**Step 1 - Frank (Requester):**
- Creates request for April 27 (tomorrow) at 08:00-10:00
- Status = PENDING_DEAN

**Step 2 - Bob (Dean):**
1. Go to Dean Queue
2. See Frank's request
3. Notice: Requested for tomorrow (less than 24 hours)
4. Click "Reject"
5. Enter reason: "Insufficient notice - room policy requires 24 hour notice"
6. Click "Confirm Rejection"
7. ✅ Request rejected

**Result:**
- Frank's request status = REJECTED
- Time slot becomes AVAILABLE for others
- Frank can try again with more notice
- Audit log records Bob's rejection

---

### Workflow C: Cancel a Confirmed Booking

**Scenario:** Alice's meeting was cancelled, she needs to free up Lab 101

**Step 1 - Alice (Requester):**
1. Go to "My Requests"
2. Find Lab 101 booking (CONFIRMED)
3. Click "View Details"
4. Click "Cancel Booking"
5. Enter reason: "Meeting moved to virtual format"
6. Click "Confirm Cancellation"
7. ✅ Booking cancelled

**Result:**
- Booking status = CANCELLED
- Time slots 08:00-10:00 and 10:00-12:00 now AVAILABLE on Lab 101
- Other requesters can now book those slots
- Audit log records cancellation

---

### Workflow D: Emergency Override (System Admin Only)

**Scenario:** Eve (System Admin) detects a double-booking error (shouldn't happen, but for demonstration)

**Step 1 - Eve (System Admin):**
1. Access Admin Queue (can see all)
2. Notice two confirmations for same room/time (theoretical)
3. Click "Override" on the newer one
4. Enter reason: "Conflict resolution - newer request denied"
5. Click "Confirm Override"
6. ✅ Override recorded

**Result:**
- Earlier booking kept
- Newer booking cancelled with override status
- Audit log shows emergency action
- Affected requester notified

---

## Tips & Best Practices

### For Requesters:
- ✅ Plan ahead (give deans and admins time to review)
- ✅ Provide clear purpose in approvals (helps deans decide)
- ✅ Check room capacity before booking
- ✅ Cancel early if plans change
- ❌ Don't expect approval within minutes
- ❌ Don't request with insufficient notice

### For Deans:
- ✅ Review requests daily
- ✅ Provide clear rejection reasons
- ✅ Verify requester has right to book (department, status)
- ✅ Check room policies (notice requirements)
- ❌ Don't approve without thinking
- ❌ Leave rejections without reasons

### For Booking Admin:
- ✅ Trust dean approvals, do spot-checks
- ✅ Catch approval conflicts
- ✅ Process queue regularly
- ❌ Don't delay approvals unnecessarily

### For System Admin:
- ✅ Monitor system health
- ✅ Use reports to spot problems
- ✅ Override only when necessary
- ✅ Document all overrides
- ❌ Don't abuse emergency override
- ❌ Don't delete data without reason

---

## Troubleshooting

### Q: I can't see other users' queues
**A:** You need the right role. Only DEAN can see Dean Queue, only ADMIN/SYSTEM_ADMIN can see Admin Queue.

### Q: Booking request disappeared
**A:** Check "My Requests" page and filter by status. It might be REJECTED. See the rejection reason.

### Q: Time slot shows AVAILABLE but I can't book it
**A:** 
- Refresh the page
- Check room policies (minimum notice requirement)
- Try a different time slot
- Contact System Admin if issue persists

### Q: I approved a request but it doesn't show as CONFIRMED
**A:** It needs approval at both stages. Check Admin Queue or view booking detail to see if admin approved yet.

### Q: My booking was cancelled without my action
**A:** 
- A System Admin may have overridden it due to conflict
- Check booking detail for reason
- Contact your dean or system admin for explanation

### Q: Reports page shows "ready" but no report
**A:** Click "Generate Report" first. Make sure you're System Admin for full reports.

---

## FAQ

**Q: Can I book the same room for multiple days in one request?**
A: No - each request is for a single date. Create separate requests for different dates.

**Q: Can I modify a booking after it's confirmed?**
A: No - you must cancel it and create a new request. This keeps the audit trail clean.

**Q: What happens if I request a time slot that someone else requests at the same time?**
A: First approval wins. Database prevents double-booking with occupancy constraint. If both are approved, one gets overridden.

**Q: How long does approval take?**
A: Depends on dean/admin speed. Could be minutes or hours. Check back periodically or enable notifications (future feature).

**Q: Can students book rooms?**
A: Only if they're given a requester account and added to the system.

**Q: Is there a mobile app?**
A: No - currently web-only, but mobile-responsive design is in progress.

**Q: Can I see availability for rooms in other buildings?**
A: Yes - all rooms are shown on the Availability Board regardless of building.

**Q: What's the cancellation rate metric?**
A: (Cancelled bookings / Total bookings) * 100%. Used to identify abuse or inefficiencies.

---

## Keyboard Shortcuts

Coming in future versions - for now use mouse and touchscreen.

---

## Getting Help

- **Technical Issues:** Contact System Admin (Eve)
- **Room Availability:** See Availability Board
- **Booking Status:** Check "My Requests" page
- **System Reports:** Contact System Admin for Full Report

**System Admin Dashboard:** Eve can access all pages and features
