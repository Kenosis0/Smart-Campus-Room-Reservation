# Smart Campus Room Reservation - Security Guide

## Security Overview

This document outlines all security measures implemented in the Smart Campus Room Reservation system.

---

## 1. Authentication & Authorization

### Current Implementation (Development)
```javascript
// Demo authentication using x-user-id header
const userId = req.headers['x-user-id'];
```

**Note:** This is for development/demo purposes only. Production must use proper authentication.

### Recommended Production Implementation
```javascript
// Use JWT tokens or session-based auth
// 1. JWT (Stateless, scalable)
const token = req.headers.authorization?.split(' ')[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = decoded;

// 2. Session-based (Traditional)
// Using express-session + Redis
// Session stored server-side, cookie sent to client
```

### Role-Based Access Control (RBAC)
```javascript
// Middleware enforcement
const requireRoles = (allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.user.roleCode)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

// Usage:
router.post('/approvals/:id', requireRoles(['DEAN', 'BOOKING_ADMIN', 'SYSTEM_ADMIN']), handler);
```

**Access Matrix:**
```
Endpoint                              REQUESTER  DEAN  ADMIN  SYS_ADMIN
GET /api/rooms                         ✅        ✅     ✅      ✅
GET /api/rooms/:id/availability        ✅        ✅     ✅      ✅
POST /api/booking-requests             ✅        ❌     ❌      ✅
GET /api/booking-requests/my           ✅        ✅     ✅      ✅
POST /booking-requests/:id/approvals   ❌       DEAN   ADMIN    ✅
GET /api/approvals/pending             ❌        ✅     ✅      ✅
POST /api/bookings/:id/cancel          ✅*       ❌     ❌      ✅
GET /api/reports/summary               ✅        ✅     ✅      ✅
GET /api/reports/utilization           ❌        ❌    ❌*      ✅

✅ = Allowed
❌ = Forbidden
* = Only if requester/SYSTEM_ADMIN
DEAN = Only for own department
ADMIN = Booking administrators only
SYS_ADMIN = System administrators only
```

---

## 2. Input Validation

### Client-Side Validation
```javascript
// Before form submission
✅ Required field checks
✅ Length constraints (min/max)
✅ Date validation (not in past)
✅ Time slot validation (consecutive, not booked)
✅ Email format validation
```

### Server-Side Validation (Always Required)
```javascript
// NEVER trust client-side validation
// Always validate on backend:

POST /api/booking-requests
✅ roomId must exist and be active
✅ requestDate must not be in past
✅ requestDate must be within 365 days
✅ slotIds must be valid and unique
✅ slotIds must not already be confirmed for this room/date
✅ User must have REQUESTER role

POST /booking-requests/:id/approvals
✅ requestId must exist
✅ Decision must be APPROVED, REJECTED, or OVERRIDDEN
✅ If REJECTED: note must be non-empty
✅ If OVERRIDDEN: only SYSTEM_ADMIN and reason required
✅ User must have appropriate role for this stage
```

### Implementation Example
```javascript
async function createBookingRequest(body, user) {
  // Validate input
  if (!body.roomId || typeof body.roomId !== 'number') {
    throw new AppError('Invalid roomId', 400);
  }
  
  if (!Array.isArray(body.slotIds) || body.slotIds.length === 0) {
    throw new AppError('slotIds must be non-empty array', 400);
  }
  
  // Validate business logic
  const room = await getRoom(body.roomId);
  if (!room || !room.is_active) {
    throw new AppError('Room not found or inactive', 404);
  }
  
  // Check for conflicts
  const conflicts = await checkOccupancy(body.roomId, body.requestDate, body.slotIds);
  if (conflicts.length > 0) {
    throw new AppError('Some slots are already booked', 409);
  }
  
  // User can only request, not approve
  if (user.roleCode !== 'REQUESTER' && user.roleCode !== 'SYSTEM_ADMIN') {
    throw new AppError('Only requesters can create booking requests', 403);
  }
  
  // Proceed with creation
  return createRequest(body, user);
}
```

---

## 3. SQL Injection Prevention

### Current Implementation ✅
```javascript
// Using parameterized queries (mysql2/promise)
const result = await pool.query(
  'SELECT * FROM users WHERE id = ?',
  [userId]  // Parameter, never concatenated
);
```

### ❌ NEVER Do This
```javascript
// VULNERABLE - DO NOT USE
const query = `SELECT * FROM users WHERE id = ${userId}`;
const result = await pool.query(query);
```

### All Queries Use Parameters
```javascript
// ✅ Always parameterized
INSERT INTO bookings (booking_request_id, room_id, requester_user_id, status)
  VALUES (?, ?, ?, ?)

SELECT * FROM time_slots 
  WHERE id IN (?, ?, ?, ?)

UPDATE booking_requests 
  SET status = ? WHERE id = ? AND requester_user_id = ?
```

---

## 4. Cross-Site Scripting (XSS) Prevention

### HTML Escaping
```javascript
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;  // textContent doesn't interpret HTML
  return div.innerHTML;
}

// Usage:
const name = escapeHtml(userInput);  // Safe to insert into DOM
element.innerHTML = `<h3>${name}</h3>`;
```

### Safe DOM Methods
```javascript
// ✅ SAFE - Uses textContent
element.textContent = userInput;

// ✅ SAFE - innerHTML with already-escaped content
element.innerHTML = `<p>${escapeHtml(userInput)}</p>`;

// ❌ UNSAFE - Direct innerHTML with user input
element.innerHTML = userInput;

// ❌ UNSAFE - eval() or new Function()
eval(userInput);
```

### Content Security Policy (CSP)
```
Recommended CSP header:
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' https://cdn.tailwindcss.com https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com;
  img-src 'self' data:;
```

---

## 5. Cross-Site Request Forgery (CSRF) Prevention

### Current Status
```
Demo: No CSRF protection (acceptable for local development)
Production: Must implement CSRF tokens
```

### Recommended Implementation
```javascript
// 1. Generate CSRF token for each session
const csrfToken = generateToken();
req.session.csrfToken = csrfToken;

// 2. Send token to client
res.json({ csrfToken });

// 3. Client includes token in POST requests
fetch('/api/booking-requests', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify(data)
});

// 4. Server validates token
if (req.headers['x-csrf-token'] !== req.session.csrfToken) {
  throw new AppError('CSRF token validation failed', 403);
}
```

---

## 6. Data Encryption

### At-Rest Encryption (Database)
```
Recommended for production:
- MySQL: Transparent Data Encryption (TDE)
- Sensitive fields: AES-256 encryption before storage

Example:
CREATE TABLE users (
  password_hash VARCHAR(255),  -- Hashed, never plain text
  ssn VARBINARY(255)  -- Encrypted with AES
);
```

### In-Transit Encryption
```
Must use HTTPS in production:
- TLS 1.3+ required
- Valid SSL certificate (Let's Encrypt free)
- HSTS header to enforce HTTPS

app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

### Password Security
```
Never store plain passwords:
✅ Use bcrypt for hashing
✅ Minimum 10 salt rounds
✅ Never log passwords

Example:
const hashedPassword = await bcrypt.hash(plainPassword, 10);
await validatePassword(plainPassword, hashedPassword);
```

---

## 7. Database Security

### Constraint Enforcement
```sql
-- Prevents double-booking
UNIQUE KEY uq_confirmed_occupancy (occupancy_key)

-- Ensures required reasons
CHECK (status = 'REJECTED' OR note IS NOT NULL)

-- Prevents orphaned records
FOREIGN KEY REFERENCES users(id) ON DELETE RESTRICT
```

### Principle of Least Privilege
```sql
-- Create separate database users for different apps
CREATE USER 'app_read'@'localhost' IDENTIFIED BY 'password';
GRANT SELECT ON smart_campus_reservation.* TO 'app_read'@'localhost';

CREATE USER 'app_write'@'localhost' IDENTIFIED BY 'password';
GRANT SELECT, INSERT, UPDATE ON smart_campus_reservation.* TO 'app_write'@'localhost';

-- Application connects with appropriate user
// For read operations: app_read
// For write operations: app_write
```

### Connection Security
```javascript
// Secure pool configuration
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelayMs: 0
});

// SSL connection for remote databases
ssl: {
  rejectUnauthorized: true,
  ca: fs.readFileSync('/path/to/ca.pem'),
  key: fs.readFileSync('/path/to/client-key.pem'),
  cert: fs.readFileSync('/path/to/client-cert.pem')
}
```

---

## 8. Rate Limiting

### Recommended Implementation
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  message: 'Too many requests from this IP, please try again later.'
});

// Apply to all requests
app.use('/api/', limiter);

// Stricter limit for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,  // 5 attempts per 15 minutes
  skipSuccessfulRequests: true
});

app.post('/api/login', loginLimiter, loginHandler);
```

---

## 9. CORS Configuration

### Current Configuration
```javascript
app.use(cors({ origin: 'localhost' }));
```

### Production Configuration
```javascript
app.use(cors({
  origin: ['https://example.com', 'https://app.example.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));
```

---

## 10. Error Handling & Logging

### Sensitive Information
```javascript
// ❌ DON'T: Expose internal details to users
res.status(500).json({ error: 'Database connection failed on server.local' });

// ✅ DO: Generic message to user, log details server-side
res.status(500).json({ error: 'An unexpected error occurred' });
logger.error('Database error:', {
  code: error.code,
  errno: error.errno,
  address: error.address,
  timestamp: new Date()
});
```

### Audit Logging
```javascript
// Log all security-relevant events
action_logs table tracks:
- WHO (actor_user_id, actor_role_code)
- WHAT (action_type: APPROVE, REJECT, CANCEL, OVERRIDE)
- WHEN (created_at timestamp)
- WHERE (target_type, target_id)
- WHY (reason_text for decisions)

// Production: Send logs to:
// - Centralized logging (ELK, Splunk, etc.)
// - Security monitoring system (SIEM)
```

---

## 11. Security Checklist for Production

### Before Going Live
```
Authentication & Authorization:
  [ ] Replace x-user-id with JWT or session-based auth
  [ ] Implement proper password hashing (bcrypt)
  [ ] Set up two-factor authentication (2FA)
  [ ] Implement account lockout after failed attempts

Input & Output:
  [ ] Validate ALL inputs on server side
  [ ] HTML-escape all user output
  [ ] Implement content security policy (CSP)
  [ ] Set security headers (X-Frame-Options, X-Content-Type-Options)

Data Security:
  [ ] Use HTTPS/TLS for all communication
  [ ] Encrypt sensitive data at rest
  [ ] Implement database encryption (TDE)
  [ ] Secure API keys and credentials (env vars, vault)

API Security:
  [ ] Implement rate limiting
  [ ] Add request size limits
  [ ] Implement CORS properly
  [ ] Add CSRF token validation

Monitoring & Logging:
  [ ] Set up centralized logging
  [ ] Monitor for suspicious activity
  [ ] Alert on security events
  [ ] Regular security audits

Infrastructure:
  [ ] Enable firewall
  [ ] Use network segmentation
  [ ] Regular security patches
  [ ] Backup and disaster recovery plan
  [ ] Security incident response plan
```

---

## 12. Compliance & Standards

### OWASP Top 10 Coverage
```
A1: Broken Access Control          ✅ RBAC implemented
A2: Cryptographic Failures         ⚠️  Todo: HTTPS, encryption
A3: Injection                       ✅ Parameterized queries
A4: Insecure Design                ✅ Constraint-based prevention
A5: Security Misconfiguration      ⚠️  Todo: Security headers
A6: Vulnerable Components          ✅ Dependencies up-to-date
A7: Authentication Failures        ⚠️  Todo: Proper auth mechanism
A8: Data Integrity Failures        ✅ Database constraints
A9: Logging Failures               ✅ Audit logging
A10: SSRF                           ✅ No external requests
```

### Data Protection
```
GDPR Compliance:
- [ ] User consent for data collection
- [ ] Right to access personal data
- [ ] Right to erasure ("right to be forgotten")
- [ ] Data breach notification procedure
- [ ] Privacy policy and terms of service

Recommendation:
- Add data retention policy
- Implement data anonymization
- Create privacy impact assessment
```

---

## 13. Incident Response

### Security Incident Procedure
```
1. Detect: Monitor logs and alerts for anomalies
2. Contain: Disable affected accounts/resources
3. Investigate: Analyze logs to determine scope
4. Eradicate: Remove malicious code/access
5. Recover: Restore from clean backups
6. Document: Log all findings and actions
7. Notify: Inform affected users/stakeholders
```

### Emergency Procedures
```
SQL Injection Attack:
1. Block malicious IP addresses
2. Review query logs for evidence
3. Patch vulnerable queries
4. Change database credentials
5. Audit all data access

Brute Force Attack:
1. Enable account lockout
2. Increase rate limiting
3. Review failed login logs
4. Reset passwords for compromised accounts
5. Implement 2FA

Data Breach:
1. Isolate affected systems
2. Preserve evidence
3. Notify stakeholders
4. Assess data exposed
5. Determine notification requirement
```

---

## 14. Security Testing

### Automated Testing
```bash
# Dependency vulnerability scanning
npm audit

# SAST (Static Application Security Testing)
# Use tools: SonarQube, ESLint with security plugins

# DAST (Dynamic Application Security Testing)
# Use tools: Burp Suite, OWASP ZAP

# SQL Injection testing
# Try: ' OR '1'='1 --, etc.

# XSS testing
# Try: <script>alert('XSS')</script>

# CSRF testing
# Submit forms without CSRF tokens
```

### Manual Security Review
```
- [ ] Code review for security issues
- [ ] Architecture review for design flaws
- [ ] Penetration testing by security professional
- [ ] Red team exercise
- [ ] Security awareness training
```

---

## Conclusion

This system implements **solid security foundations** for a demo/academic project. **Production deployment must** implement the recommended enhancements listed in this guide, particularly:

1. **Proper authentication** (JWT or sessions instead of x-user-id)
2. **HTTPS/TLS** encryption
3. **CSRF token** validation
4. **Rate limiting**
5. **Centralized logging** and monitoring
6. **Security headers** (CSP, X-Frame-Options, etc.)

**Security is a continuous process**, not a one-time fix. Regular security audits, updates, and team training are essential for maintaining security posture.
