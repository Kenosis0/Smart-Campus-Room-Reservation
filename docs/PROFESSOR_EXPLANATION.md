# Smart Campus Room Reservation System
## Professor Explanation Guide

**Course:** BSCSIT 2207 Database System 1 - Lab  
**Project:** Lesson 9 - Final Project (Group Assignment)  
**Date:** April 27, 2026

---

## 📋 Project Overview

The **Smart Campus Room Reservation System** is a full-stack web application that manages university room bookings with automated approval workflows and real-time conflict prevention.

### Core Purpose
- Allow faculty and students to request room bookings
- Enforce a two-stage approval process (Dean → Admin)
- Prevent double-booking through database constraints
- Provide real-time updates via WebSockets

---

## 🗄️ Database Design (3NF Normalization)

### 12 Core Tables

```
1. roles               → User roles (Requester, Dean, Admin, System Admin)
2. departments        → Campus departments with dean assignments
3. users              → Faculty/staff/student accounts
4. rooms              → Physical rooms available for booking
5. room_policies      → Per-room settings (notice time, override permissions)
6. time_slots         → Predefined time blocks (08:00-10:00, etc.)
7. booking_requests   → User requests (PENDING → CONFIRMED)
8. booking_request_slots → Which slots user requested
9. approvals          → Two-stage approval records
10. bookings          → Final confirmed bookings
11. booking_slots     → Occupancy records (prevents conflicts)
12. action_logs       → Audit trail for all sensitive actions
```

### Key Integrity Feature: Occupancy Key

```sql
-- Prevents double-booking using unique constraint:
occupancy_key = room_id + ':' + booking_date + ':' + time_slot_id

-- NULL when cancelled/overridden (allows rebooking)
-- UNIQUE constraint ensures no two confirmed bookings overlap
```

**Result:** Impossible to double-book a room for the same time slot.

---

## 🔄 Workflow Example

### Scenario: Faculty books a lab for tomorrow

**Step 1: Request Creation**
```
Alice (Requester) selects:
- Room: Lab 101
- Date: Tomorrow (April 28)
- Time Slots: 08:00-10:00, 10:00-12:00
→ Status: PENDING_DEAN
```

**Step 2: Dean Review**
```
Bob (Engineering Dean) reviews Alice's request
- Checks: Is Alice in my department? Is the room available?
→ Decision: APPROVED
→ Status: PENDING_ADMIN
```

**Step 3: Admin Approval**
```
Dan (Booking Admin) checks for conflicts
- Database constraint: occupancy_key must be unique
- If any slot conflicts: Request is REJECTED
- If all clear: Creates booking record
→ Status: CONFIRMED
→ Booking created in bookings table
```

**Step 4: Real-time Notification**
```
WebSocket broadcasts "availability:changed"
→ All users' screens update in real-time
→ Lab 101 shows as "CONFIRMED" for those slots
```

---

## 💻 Technology Stack

### Backend
- **Node.js + Express.js** - HTTP API server
- **MySQL 8.0** - Database with InnoDB transactions
- **Socket.io** - Real-time WebSocket communication

### Frontend
- **HTML5** - Structure
- **Tailwind CSS** - Styling (CDN)
- **Vanilla JavaScript** - No framework dependency

### Why This Stack?
- ✅ Meets course requirements (MySQL + Web + Backend)
- ✅ Demonstrates database constraints in action
- ✅ Shows transaction handling with conflict prevention
- ✅ Beginner-friendly implementation
- ✅ Clear separation of concerns

---

## 🔐 Security & Governance Features

### Authentication
- ✅ Role-based access control (RBAC)
- ✅ Four role types with specific permissions
- ✅ Header-based user identification (development)

### Authorization
- ✅ Deans can only approve their department's requests
- ✅ Admins can only do final approval
- ✅ System Admins can override with mandatory reason
- ✅ Requesters can only see/manage their own bookings

### Audit Trail
```sql
action_logs table records:
- WHO performed the action (actor_user_id, actor_role_code)
- WHAT action (BOOKING_REQUEST_CREATED, APPROVAL_GRANTED, etc.)
- WHEN (created_at timestamp)
- WHY (reason_text - mandatory for cancellations/overrides)
- CONTEXT (metadata_json - extra info like room capacity)
```

**Result:** Complete accountability for all decisions.

---

## 📊 Data Integrity Constraints

### Business Rules Enforced at Database Level

| Rule | Implementation | Example |
|------|---|---|
| No double-booking | Unique occupancy_key | Two bookings for same room/date/slot rejected |
| Reason required on cancel | CHECK constraint | UPDATE rejected if reason is empty |
| One approval per stage | Unique (request_id, stage) | Can't have 2 DEAN approvals for same request |
| Mandatory override reason | CHECK constraint | Override without reason fails |
| Room ownership | Foreign key | Can only book rooms in valid departments |

---

## 🎯 Core Functionality Demonstrated

### 1. CRUD Operations
- ✅ **CREATE:** Users submit booking requests
- ✅ **READ:** View rooms, pending approvals, booking history
- ✅ **UPDATE:** Approvals change request status
- ✅ **DELETE:** Logical deletion (status = CANCELLED)

### 2. Transaction Management
- ✅ Two-stage approval is atomic (all-or-nothing)
- ✅ Conflict detection before final confirmation
- ✅ Rollback on validation failure

### 3. Complex Queries
- ✅ FCFS ordering via `ORDER BY created_at`
- ✅ Multi-table JOINs for availability calculation
- ✅ Conflict detection with subqueries
- ✅ Audit trail aggregation

### 4. Real-time Communication
- ✅ WebSocket events on booking changes
- ✅ Clients receive instant updates
- ✅ No page refresh needed

---

## 🚀 How We Got It Running

### Setup Summary

1. **Database Creation**
   - Executed `schema.sql` to create 12 normalized tables
   - Executed `seed.sql` to populate demo data
   - Verified 3NF compliance

2. **Configuration**
   - Changed MySQL port from 3307 → 3306 (standard port)
   - Set credentials in `.env` file
   - Verified database connectivity

3. **Application Launch**
   - Started Node.js server on port 4000
   - Server connected to MySQL on port 3306
   - Socket.io initialized for real-time updates

4. **Testing**
   - Server accessible at `http://localhost:4000`
   - Demo users pre-seeded in database
   - Ready for live demonstration

---

## 📈 What This Project Demonstrates

### Database Concepts (Lesson 1-8)
- ✅ 3NF Normalization
- ✅ Referential integrity (Foreign Keys)
- ✅ Constraint design (UNIQUE, CHECK, PRIMARY KEY)
- ✅ Transaction safety
- ✅ Query optimization with indexes

### Lesson 9 Integration
- ✅ **MySQL:** Full schema with normalized design
- ✅ **Web:** HTML/CSS/JavaScript frontend
- ✅ **Backend:** Node.js/Express business logic
- ✅ **Python:** (Optional - could add Python scripts for reporting)

### Professional Skills
- ✅ Requirements analysis and design
- ✅ Full-stack development
- ✅ Testing and debugging
- ✅ Documentation
- ✅ Version control ready

---

## 📱 User Interface Features

### Pages Implemented

| Page | Purpose | Users |
|------|---------|-------|
| **Availability Board** | Browse rooms and book | All |
| **Request History** | View past requests | Requesters |
| **Dean Queue** | Review pending requests | Deans |
| **Admin Queue** | Final approval/conflict handling | Admins |
| **Booking Detail** | View/cancel confirmed booking | Requesters |

### Real-time Features
- ✅ Availability updates instantly when booking confirmed
- ✅ Queue refreshes when new request arrives
- ✅ Conflict notifications in real-time

---

## 💾 Database Analysis Results

**Overall Database Quality: 8.2/10 (Proficient)**

### Strengths
- ✅ Excellent 3NF normalization
- ✅ Strong constraint design prevents errors
- ✅ Comprehensive audit trail
- ✅ Scalable schema design
- ✅ Conflict prevention via occupancy_key

### Demonstration Value
This project successfully shows:
1. How to design databases to prevent invalid states
2. How constraints enforce business rules automatically
3. How transactions ensure data consistency
4. How audit trails provide accountability
5. How integration with web/backend creates complete systems

---

## 🎓 Learning Outcomes Achieved

By completing this project, students have demonstrated:

1. **Database Design**
   - Can identify entities and relationships
   - Can normalize to 3NF
   - Can apply appropriate constraints

2. **Implementation**
   - Can write complex SQL queries
   - Can use transactions safely
   - Can integrate database with application

3. **Full-Stack Development**
   - Can build web UI
   - Can connect frontend to backend
   - Can implement real-time features

4. **Professional Practices**
   - Can audit and document systems
   - Can troubleshoot integration issues
   - Can present technical concepts clearly

---

## 🔧 System Architecture

```
┌─────────────────────────────────────────────────────┐
│              Browser (Client)                        │
│  - HTML/Tailwind UI                                 │
│  - Vanilla JavaScript                               │
│  - WebSocket connection                             │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ HTTP + WebSocket
                   │
┌──────────────────▼──────────────────────────────────┐
│         Node.js + Express (Server)                   │
│  - REST API endpoints                               │
│  - Socket.io handlers                               │
│  - Business logic (reservationService.js)           │
│  - Authentication middleware                        │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ mysql2 driver
                   │ (SSL, pooling, transactions)
                   │
┌──────────────────▼──────────────────────────────────┐
│      MySQL 8.0 Database (Port 3306)                 │
│  - 12 normalized tables                             │
│  - Stored constraints                               │
│  - InnoDB transactions                              │
│  - Action audit logs                                │
└─────────────────────────────────────────────────────┘
```

---

## 📚 Documentation Provided

1. **DATABASE_ANALYSIS_REPORT.md** - Comprehensive audit findings
2. **SCHEMA_ENHANCEMENT_SCRIPTS.sql** - Recommended improvements
3. **SYSTEM_PLAN.md** - Business requirements and design
4. **SYSTEM_DESCRIPTION.md** - Technical architecture
5. **This Document** - Professor-friendly overview

---

## ✅ Deliverables Checklist

| Item | Status | Location |
|------|--------|----------|
| Database schema (3NF) | ✅ Complete | `server/src/db/schema.sql` |
| Seed data | ✅ Complete | `server/src/db/seed.sql` |
| Source code | ✅ Complete | `server/src/` & `client/` |
| Running application | ✅ Complete | `http://localhost:4000` |
| Technical documentation | ✅ Complete | `docs/` folder |
| Database analysis | ✅ Complete | `DATABASE_ANALYSIS_REPORT.md` |

---

## 🎯 Conclusion

This Smart Campus Room Reservation system successfully integrates:
- ✅ Normalized MySQL database with 3NF compliance
- ✅ Web-based user interface with real-time updates
- ✅ Backend business logic with transaction safety
- ✅ Professional audit trails and constraint design

**The project demonstrates mastery of Database Systems 1 concepts through a working, production-like application that prevents real-world data corruption scenarios.**

---

**Ready for demonstration on April 28, 2026 at 8:00 AM**

