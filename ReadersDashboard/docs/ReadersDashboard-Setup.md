# 📖 READERS DASHBOARD - SETUP & DEPLOYMENT GUIDE

**Date**: October 7, 2025 (Updated: October 11, 2025)
**Author**: Liz & Claude
**System**: Secure workspace for readers to review and correct INA reports
**Database**: qolae_readers + qolae_casemanagers + qolae_hrcompliance (PostgreSQL)

---

## 📚 **WHICH DOCUMENT TO USE?**

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **DailyWorkingDocument.md** | Master checklist (200 tasks, all dashboards) | Daily progress tracking |
| **READERS_DASHBOARD_SETUP.md** (this file) | Technical deployment guide | Server setup, routes, configs |
| **READERS_COMPLIANCE_IMPLEMENTATION_CHECKLIST.md** | Detailed implementation tasks (67 items) | Building features step-by-step |
| **ReadersWorkflow.md** | User-facing workflow narrative | Understanding user experience |

---

## 🎯 SYSTEM OVERVIEW

The Readers Dashboard is a **secure, in-workspace-only** portal where readers:
- ✅ Login with 2FA (PIN + email verification)
- ✅ Review and sign NDA (no download)
- ✅ **View reports in workspace** (no download - GDPR compliant)
- ✅ **Edit and correct reports in workspace** (no download)
- ✅ Submit corrections for review
- ✅ Track payment status

**Security Model**: All work done in-browser workspace. No downloads allowed.

---

## 📂 FILES CREATED

### **1. Server Infrastructure**
**Location**: `/QOLAE-Readers-Dashboard/ReadersDashboard/`

```
ReadersDashboard/
├── server.js              # Fastify server (port 3008)
├── package.json           # Dependencies
├── routes/
│   ├── authRoutes.js      # 2FA authentication
│   └── readerRoutes.js    # Dashboard, NDA, reports, corrections
├── views/
│   ├── readers-login.ejs  # 2FA login page
│   └── readers-dashboard.ejs  # Main workspace (existing)
└── database/
    ├── setup_qolae_readers.sql
    └── DEPLOY_DATABASE.md
```

### **2. Authentication System (2FA)**
**Location**: `routes/authRoutes.js`

**Flow**:
1. Reader enters PIN + email
2. System sends 6-digit verification code to email
3. Reader enters code (10-minute expiry, 3 attempts max)
4. JWT token issued (8-hour session)
5. Redirect to NDA (if not signed) or Dashboard (if signed)

**Endpoints**:
- `POST /api/readers/request-email-code` - Send verification code
- `POST /api/readers/verify-email-code` - Verify code & login
- `POST /api/readers/logout` - Clear session

### **3. Reader Routes**
**Location**: `routes/readerRoutes.js`

**Endpoints**:
- `GET /readers-dashboard` - Main workspace (protected)
- `GET /nda-review` - NDA review page (protected)
- `POST /api/readers/sign-nda` - Sign NDA
- `GET /report-viewer/:assignmentId` - View report in-workspace (protected)
- `GET /corrections-editor/:assignmentId` - Edit corrections in-workspace (protected)
- `POST /api/readers/save-corrections` - Save corrections
- `POST /api/readers/submit-corrections` - Submit for review
- `GET /payment-status` - Payment tracking (protected)

### **4. Database Integration**
**Two Databases Connected**:

1. **qolae_readers** - Reader authentication & assignments
   - `readers` table (authentication, NDA status)
   - `reader_assignments` table (report assignments)
   - `reader_activity_log` table (GDPR audit trail)

2. **qolae_casemanagers** - Case management data
   - `ina_reports` table (links to reader assignments)

---

## 🚀 DEPLOYMENT STEPS

### **Step 1: Copy Files to Server**
```bash
# From your Mac
scp -r /Users/lizchukwu_1/QOLAE-Online-Portal/QOLAE-Readers-Dashboard/ReadersDashboard root@91.99.184.77:/var/www/readers.qolae.com/
```

### **Step 2: Install Dependencies**
```bash
# SSH into server
ssh root@91.99.184.77

# Navigate to directory
cd /var/www/readers.qolae.com/ReadersDashboard

# Install dependencies
yarn install
```

**Dependencies installed**:
- `fastify` - Web server
- `@fastify/jwt` - JWT authentication
- `@fastify/cookie` - Cookie management
- `@fastify/view` + `ejs` - Templating
- `@fastify/cors` - CORS support
- `pg` - PostgreSQL client
- `bcrypt` - Password hashing (future use)
- `pino-pretty` - Logging

### **Step 3: Configure Environment Variables**
**Location**: `/var/www/readers.qolae.com/.env`

```env
PORT=3008
READERS_DATABASE_URL=postgresql://readers_user:Rqolae25@localhost:5432/qolae_readers
CASEMANAGERS_DATABASE_URL=postgresql://casemanagers_user:your-password@localhost:5432/qolae_casemanagers
JWT_SECRET=your-super-secure-jwt-secret-key-2025
```

### **Step 4: Add to PM2 Ecosystem**
**Location**: `/root/ecosystem.config.js`

Add this entry:

```javascript
{
  name: 'qolae-readers-dashboard',
  script: '/var/www/readers.qolae.com/ReadersDashboard/server.js',
  cwd: '/var/www/readers.qolae.com/ReadersDashboard',
  instances: 1,
  exec_mode: 'fork',
  env: {
    NODE_ENV: 'production',
    PORT: 3008
  },
  watch: false,
  ignore_watch: ['node_modules', 'logs', '*.log'],
  max_memory_restart: '200M',
  restart_delay: 1000,
  exp_backoff_restart_delay: 100,
  min_uptime: '10s',
  max_restarts: 10,
  error_file: '/var/log/pm2/qolae-readers-dashboard-error.log',
  out_file: '/var/log/pm2/qolae-readers-dashboard-out.log',
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
}
```

### **Step 5: Start PM2 Service**
```bash
# Reload ecosystem configuration
pm2 reload ecosystem.config.js --update-env

# Check status
pm2 list

# View logs
pm2 logs qolae-readers-dashboard
```

**Expected Output**:
```
╔══════════════════════════════════════════════════╗
║   📖 QOLAE READERS DASHBOARD STARTED           ║
╚══════════════════════════════════════════════════╝

📍 Server running at: http://0.0.0.0:3008
🌍 Environment: production
📊 Database: qolae_readers

Available Routes:
  🔐 Login: /readers-login
  🏠 Dashboard: /readers-dashboard
  📝 NDA Workflow: /nda-review
  📄 Report Viewer: /report-viewer
  ✏️ Corrections Editor: /corrections-editor
  💰 Payment Tracking: /payment-status
  ❤️ Health Check: /health

Ready for readers to access their workspace! 🚀
```

---

## 🔒 SECURITY FEATURES

### **1. 2FA Authentication**
- PIN validation against database
- Email verification with 6-digit code
- Code expiry (10 minutes)
- Attempt limiting (3 max)
- JWT session tokens (8 hours)
- HttpOnly cookies (XSS protection)

### **2. GDPR Compliance**
- All actions logged in `reader_activity_log`
- IP address tracking
- User agent tracking
- Audit trail for all report access
- **No downloads** - reports viewed/edited in-workspace only

### **3. Access Control**
- JWT middleware on all protected routes
- Role verification (reader role required)
- Assignment ownership verification
- Status-based access (completed assignments locked)

---

## 📋 WORKFLOW INTEGRATION

### **Reader Registration → Login Flow**:

1. **Liz registers reader** (Case Managers Dashboard)
   - Reader PIN generated (e.g., RDR-JS123456)
   - Email invitation sent with PIN

2. **Reader receives email** with PIN link

3. **Reader clicks link** → Lands on `/readers-login`

4. **2FA Login**:
   - Enter PIN + email
   - Receive 6-digit code
   - Enter code → Logged in

5. **First-time user**: Redirect to `/nda-review`

6. **Sign NDA** → Portal access activated

7. **Redirect to** `/readers-dashboard` → Workspace ready

### **Report Review Flow**:

1. **Liz assigns report** (Case Managers Dashboard)
   - Creates entry in `reader_assignments`
   - Reader notified via email

2. **Reader logs in** → Sees assignment on dashboard

3. **Click assignment** → Opens `/report-viewer/:assignmentId`
   - Report displayed in iframe/viewer
   - **No download button** - view only

4. **Click "Edit Corrections"** → Opens `/corrections-editor/:assignmentId`
   - In-browser editor (rich text or structured form)
   - Auto-save functionality

5. **Submit corrections** → Sent to Liz for review

6. **Liz approves** → Payment marked for processing

7. **Reader sees payment** in `/payment-status`

---

## ⏳ NEXT STEPS (TO BE BUILT)

### **1. NDA View Files**
- `views/nda-review.ejs` - NDA review and signature page
- NDA PDF generation (Liz will handle this separately)

### **2. Report Viewer**
- `views/report-viewer.ejs` - In-workspace PDF/document viewer
- No download functionality
- Zoom, pan, search capabilities

### **3. Corrections Editor**
- `views/corrections-editor.ejs` - In-workspace editor
- Rich text editor or structured form
- Auto-save every 30 seconds
- Character count, spell check

### **4. Payment Status Page**
- `views/payment-status.ejs` - Payment history and earnings tracker

### **5. Email Integration**
- Email verification codes (currently logged only)
- Assignment notifications
- Payment confirmation emails

---

## 🧪 TESTING

### **Test 1: Health Check**
```bash
curl http://91.99.184.77:3008/health
```

**Expected**:
```json
{
  "status": "healthy",
  "service": "qolae-readers-dashboard",
  "timestamp": "2025-10-07T...",
  "uptime": 123.45,
  "environment": "production"
}
```

### **Test 2: Request Verification Code**
```bash
curl -X POST http://91.99.184.77:3008/api/readers/request-email-code \
  -H "Content-Type: application/json" \
  -d '{"pin":"RDR-JS123456","email":"reader@email.com"}'
```

### **Test 3: Login with Code**
```bash
curl -X POST http://91.99.184.77:3008/api/readers/verify-email-code \
  -H "Content-Type: application/json" \
  -d '{"pin":"RDR-JS123456","email":"reader@email.com","code":"123456"}'
```

---

## ✅ CURRENT STATUS

**✅ Deployed on Live Server (91.99.184.77)**:
- ✅ Server infrastructure (server.js, package.json) - **RUNNING ON PORT 3008**
- ✅ 2FA authentication system (PIN + email verification)
- ✅ Login view (readers-login.ejs)
- ✅ Reader routes (dashboard, NDA, reports, corrections, payment)
- ✅ Database schemas created (qolae_readers, qolae_casemanagers)
- ✅ JWT middleware and security
- ✅ GDPR audit logging structure
- ✅ PM2 ecosystem configuration with cache prevention

**⏳ Pending (Not Yet Built)**:
- HR Compliance Gate view (readers-compliance.ejs)
- NDA review view (nda-review.ejs)
- Report viewer view (report-viewer.ejs)
- Corrections editor view (corrections-editor.ejs)
- Payment status view (payment-status.ejs)
- Email integration (verification codes, invitations)
- Reference forms (reference-form.ejs, referee-signature.ejs)

---

**Port Allocation**:
- 3006: Case Managers Dashboard ✅
- 3007: Case Managers WebSocket (future)
- 3008: Readers Dashboard ✅
- 3009: Readers WebSocket (future)
- 3010: Clients Dashboard
- 3011: Clients WebSocket (future)

---

**Ready for deployment!** 🚀

**Next**: Liz handles NDA PDF setup, then we build the remaining view files.
