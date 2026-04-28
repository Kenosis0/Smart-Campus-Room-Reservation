# Smart Campus - Python Reporting Component Setup

## Quick Setup Guide

### 1. Install Python Dependencies

Before using the reporting feature, install the required Python packages:

```bash
cd server/scripts
pip install -r requirements.txt
```

**What gets installed:**
- `mysql-connector-python==8.2.0` - MySQL database connector
- `python-dotenv==1.0.0` - Environment variable loader

### 2. Verify Installation

Test that Python can run the report generator:

```bash
# From the project root directory
python server/scripts/generate_report.py summary
```

Expected output: JSON report with system totals (rooms, bookings, confirmed, cancelled, etc.)

### 3. Access Reports in the Web Application

1. Start the server: `npm start`
2. Navigate to: `http://localhost:4000/reports.html`
3. Select report type:
   - **Summary**: Available to all users - quick overview of system statistics
   - **Full**: System Admin only - comprehensive multi-section report with detailed tables
4. Click "Generate Report" to fetch data
5. Click "Download JSON" to save the report as JSON file

### 4. Available Report Data

#### Summary Report (All Users)
- Total rooms, bookings, confirmed, cancelled counts
- Cancellation rate percentage
- Most booked room
- Peak usage time slot

#### Full Report (System Admin Only)
- **Room Statistics**: Bookings per room, confirma vs cancelled counts
- **Peak Hours**: Time slot usage analysis
- **Department Usage**: Metrics per department
- **Approval Statistics**: Dean and Admin approval decisions
- **Request Status**: Pending, confirmed, rejected distribution
- **Cancellation Analysis**: Which rooms have highest cancellation rates
- **Recent Activity**: 7-day booking trends
- **User Activity**: Top users by booking requests

### 5. Troubleshooting

**Error: "python: command not found"**
- Install Python 3.8+ from https://www.python.org/downloads/
- Ensure Python is added to PATH

**Error: "No module named mysql"**
```bash
pip install --upgrade mysql-connector-python
```

**Error: Connection refused to database**
- Ensure MySQL is running (check with `netstat -an | findstr 3306`)
- Verify .env file has correct DB credentials
- Default: `DB_PASSWORD=chenchoichu2.` `DB_PORT=3306`

**Error: "python-dotenv not found"**
```bash
pip install python-dotenv
```

### 6. Report Output Format

Reports are returned as JSON with the following structure:

```json
{
  "generated_at": "2026-04-28T10:30:45.123456",
  "report_type": "summary|full",
  "totals": { ... },
  "sections": {
    "room_statistics": { "title": "...", "data": [...] },
    "peak_hours": { "title": "...", "data": [...] },
    ...
  }
}
```

### 7. API Endpoints

- `GET /api/reports/summary` - Quick summary (all users)
- `GET /api/reports/utilization?type=summary` - Main endpoint with type parameter
- `GET /api/reports/utilization?type=full` - Full report (System Admin only)
- `GET /api/reports/full` - Full report direct (System Admin only)

### 8. Demo Users for Testing

- **User 1**: Alice Requester (Can see summary reports)
- **User 4**: Dan Booking Admin (Can see summary reports)
- **User 5**: Eve System Admin (Can see full reports)

Send requests with header: `x-user-id: 5` (for Eve System Admin)
