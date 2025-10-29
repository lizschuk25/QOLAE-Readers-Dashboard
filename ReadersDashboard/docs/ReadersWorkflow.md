READERS WORKFLOW
**Last Updated:** October 28, 2025
**Status:** ✅ PRODUCTION READY

---

## STEP 1: INVITATION EMAIL

The reader receives an introductory email with a reader-specific clickable PIN/ID number (e.g., `RDR-JS123456`). 

When they click the hyperlinked PIN, they are directed to: **`readers.qolae.com/login`**

The workflow process is similar to the LawyersLoginPortal (the Bridge).

---

## STEP 2: 2FA AUTHENTICATION

**Location:** `readers.qolae.com/login`

**Database:** `qolae_readers` (secure readers database)

The reader completes 2FA authentication:
1. Enter PIN + Email
2. Receive 6-digit OTP code via email
3. Verify OTP code
4. **First-time login:** Create password
5. **Returning login:** Enter existing password
6. JWT token issued, secure session established

Once authenticated, they are redirected to the **HR Compliance Gate** (mandatory step before dashboard access).

---

## STEP 3: HR COMPLIANCE GATE (Initial Login Only)

**Purpose:** Collect CV, references, and payment details for audit-ready compliance records before granting access to the Readers Dashboard.

**Location:** `hrcompliance.qolae.com/readers-compliance`

**Database:** `qolae_hrcompliance` (separate secure HR database)

### Reader's Compliance Submission:

The reader must complete the following **once** at initial login:

**a) Upload CV (PDF)** ✅ MANDATORY
- Required field
- Stored securely in HR compliance database
- File size limit: 10MB

**b) Provide 2 References:** ✅ MANDATORY

**Reference 1: Professional Reference**
- Name
- Title/Position
- Organisation
- Email
- Phone
- Relationship to reader (e.g., "Former supervisor at X Hospital")

**Reference 2: Character Reference**
- Name
- Relationship (e.g., "Colleague", "Academic supervisor")
- Email
- Phone
- How long they've known the reader

**c) Submit Payment Details** ✅ MANDATORY *(Added October 28, 2025)*
- Bank Name
- Account Holder Name (must match reader's legal name)
- Account Number
- **UK Domestic Accounts:**
  - Sort Code (format: XX-XX-XX)
- **International Accounts:**
  - IBAN (International Bank Account Number)
  - SWIFT/BIC Code
  - Routing Number (US accounts, optional)
- Account Type: UK Domestic or International

**Security Note:** All payment details are encrypted and stored securely. Only authorized case managers can access this information for payment processing.

**Submission:**
- On submit, compliance data is saved to `qolae_hrcompliance` database
- Reader's portal_access_status remains 'pending' until Liz approves
- ✅ **Note:** The `qolae_readers` database is ESSENTIAL for:
  - Reader authentication (PIN, password, JWT tokens)
  - NDA signing workflow
  - Report assignments
  - Payment tracking
  - Performance metrics
- Case Manager (Liz) receives notification in HR Compliance Dashboard
- Reader sees: "Thank you! Your compliance documents are being reviewed. You'll receive dashboard access shortly."

### Case Manager's Review Process:

**On Case Managers Dashboard:**
- Status badge appears: "Sarah Mitchell - Compliance Submitted" (pending status)
- Liz clicks "Review" → Modal opens showing CV + referee details
- Liz can download/view CV

**Reference Collection (Flexible Process):**

**Option A - Phone Reference (Preferred):**
1. Liz calls referee
2. Liz fills out `reference-form.ejs` with referee's answers during call
3. System emails pre-filled form to referee for review and digital signature
4. Referee reviews (already filled), signs digitally (30 seconds)
5. Signed reference saved to `qolae_hrcompliance` database

**Option B - Email Reference:**
1. Referee prefers not to have phone call
2. System emails blank `reference-form.ejs` to referee
3. Referee fills out form themselves and signs digitally
4. Signed reference saved to `qolae_hrcompliance` database

**Approval:**
- Once both references are signed and saved
- Liz reviews payment details and verifies banking information
- Liz clicks "Approve Compliance"
- Compliance record is locked in HR database
- Reader's `portal_access_status` updated to 'active' in `qolae_readers` database
- Workspace access granted
- Reader receives email: "Your compliance has been approved. You can now access your dashboard."

**Next Login:**
- Reader logs in at `readers.qolae.com/login`
- Completes 2FA authentication
- Automatically redirected to their customized Readers Dashboard at `readers.qolae.com/readers-dashboard`
- HR Compliance gate is no longer shown (compliance completed)

---

## STEP 4: READERS DASHBOARD

**Location:** `readers.qolae.com/readers-dashboard`

**Database:** `qolae_readers`

The Readers Dashboard has a similar layout to the Lawyers Dashboard - though the colours are slightly different. Brand Colours and Logo are the same. 

**Dashboard Components:**
- **Header:** QOLAE branding + security badges (SSL Encrypted, NDA Required)
- **Welcome Section:** Personalized greeting, session info, reader type display
- **Workflow Progress Tracker:** 3-step visual progress bar (NDA → Report Review → Payment)
- **Modal Workflow Cards:** Four interactive cards for main workflows

### Modal Workflow Cards:

---

### **a) NON-DISCLOSURE AGREEMENT (NDA) MODAL** ✅ COMPLETE

**File:** `nda.ejs` (1262 lines) | **Status:** Production Ready

Accessed via "Review and Sign" button (similar to Terms Of Business workflow on Lawyers Dashboard).

**4-Step Workflow:**

**Step 1: Review NDA**
- Customized NDA.pdf displayed in embedded PDF viewer
- Reader scrolls to review full document
- Email notification preferences (optional)
- "Next" button to proceed

**Step 2: Signature Workflow**
- Canvas-based signature drawing (similar to Lawyers Dashboard)
- Draw signature with mouse/touch
- Option to clear and redraw
- Reader confirms signature
- Liz's signature automatically applied when reader submits
- Signatures inserted into NDA PDF

**Step 3: Preview Signed NDA**
- Preview NDA with both signatures applied
- PDF flattening occurs before final step
- Option to go back and redraw signature
- "Confirm" button to finalize

**Step 4: Completion**
- ✅ Download NDA.pdf button
- ✅ View NDA.pdf button
- NDA saved to multiple locations:
  - `qolae_readers` database
  - `/central-repository/signed-nda/NDA_{READER_PIN}_Signed.pdf`
  - Readers Management Hub (My Documents section)
- Workflow summary displayed
- Communication sent to Case Managers Dashboard (workflow completed)
- Email sent to reader with attached signed NDA
- 🎉 Confetti celebration
- "Return to Dashboard" button

**Post-Completion:**
- "Review & Sign" button changes to "✅ NDA Signed"
- Workflow Progress tracker updated (Step 1 complete)
- `nda_signed` flag set to `true` in database
- Next gate (Report Review) opens only when INA report is ready

**Notification:** Once INA Report is ready, email sent to reader and redacted copy made available in Report Review Modal. Notification flags display status updates.

---

### **b) REPORT REVIEW MODAL** ✅ COMPLETE

**File:** `inaReportReview.ejs` (1183 lines) | **Status:** Production Ready

Accessed via "Start Review" button. Opens modal with redacted INA report copy.

**4-Step Workflow:**

**Step 1: View Redacted Report**
- Redacted INA report allocated from Case Managers workspace
- PDF viewer with zoom/navigation controls
- Report assigned to reader's workspace
- "Edit" button to proceed to corrections

**Step 2: Edit Within Modal**
- In-line editing capabilities
- Corrections made directly in modal interface
- "Save" button to preserve changes
- Real-time preview of edits
- Auto-save functionality

**Step 3: Preview Changes**
- Review all corrections made
- Side-by-side comparison view (optional)
- Option to go back and make additional changes
- "Confirm" button to finalize corrections

**Step 4: Completion**
- "View" completed edit phase (Stage 1)
- Workflow updates saved to `qolae_readers` database
- Assignment status updated to 'corrections_submitted'
- Corrections timestamp recorded
- Workflow summary displayed
- Communication sent to Case Managers Dashboard (workflow completed)
- 🎉 Confetti celebration
- "Return to Dashboard" button

**Post-Completion:**
- Workflow sealed (report no longer editable)
- "Start Review" button changes to "✅ Review Submitted"
- Workflow Progress tracker updated (Step 2 complete)
- Next gate (Payment Processing) opens
- Workflow progress updated in database
- Document saved to Readers Management Hub (Client Documents - marked completed with strikethrough)

--- 

### **c) PAYMENT PROCESSING MODAL** ✅ COMPLETE

**File:** `paymentProcessing.ejs` (821 lines) | **Status:** Production Ready

Accessed via "View Payment Info" button.

**Important:** Banking details are NOT collected here - they were already collected during HR Compliance Gate (Step 3).

**Payment Workflow:**

**After Corrections Submitted:**
1. Reader submits corrected INA report (Step 4 of Report Review Modal)
2. Payment status automatically set to **"Pending"**
3. Liz receives notification in Case Managers workspace

**Liz's Review Process:**
1. Liz reviews corrected draft (INA Report Draft Stage 1)
2. If approved → Liz clicks "Approve Payment"
3. Payment status changes to **"Approved"**
4. Notification sent to reader

**Finance Processing:**
1. Finance department receives approval
2. Payment status changes to **"Processing"**
3. Payment sent to reader's bank account (details from HR Compliance)
4. Payment status changes to **"Paid"**
5. Payment reference generated (e.g., PAY-2025-10-ABC123)
6. Email confirmation sent to reader

**Modal Features:**
- ✅ **Payment Timeline Tracker** - Visual progress indicator (4 steps)
  - Step 1: Report Submitted ✅
  - Step 2: Under Review by Liz (current/pending)
  - Step 3: Payment Processing
  - Step 4: Payment Complete
- ✅ **Payment Status Display** - Real-time status (Pending/Approved/Processing/Paid)
- ✅ **Banking Details (Read-Only)** - Displays masked account info from HR Compliance
  - Bank name
  - Account holder name
  - Last 4 digits of account number
  - Sort code or IBAN (partially masked)
- ✅ **Payment Amount** - £50.00 (first reader) or £75-100 (second reader)
- ✅ **Payment Reference** - Transaction ID when paid
- ✅ **Payment History** - All past assignments & payment status
- ✅ **Auto-Refresh** - Every 30 seconds to check for status updates
- ✅ **Support Contact** - Easy access to email support for payment inquiries

**Notification System:**
- Notification flags/bells communicate status updates throughout the workflow
- Email notifications sent at each status change
- Dashboard badge updates in real-time

---

### **d) READERS MANAGEMENT HUB** ✅ COMPLETE

**File:** `readersManagementHub.ejs` (1804 lines) | **Status:** Production Ready

Accessed via "Readers Management Hub" card on main dashboard.

**Purpose:** Centralized document library for all reader documents and completed assignments.

**Tab 1: My Documents**

Holds reader's personal and compliance documents:

1. **📋 Legal Documents Section**
   - Signed NDA copy (downloadable)
   - Date signed displayed

2. **🎓 Certifications & Licenses Section**
   - Professional certifications (e.g., Medical License)
   - Upload new certifications
   - View/delete existing documents
   - Expiry dates tracked

3. **🛡️ Insurance Documents Section**
   - Liability insurance certificates
   - Upload functionality
   - View/delete options

4. **💰 Tax & Payment Documents Section**
   - Payment method on file (read-only, from HR Compliance)
   - Last 4 digits displayed, verified status shown
   - W-9 or tax documents upload
   - Empty state prompts for document upload

**Tab 2: Client Documents**

Holds all assigned INA reports:

1. **Completed Assignments**
   - Redacted INA reports marked with strikethrough
   - No longer accessible (sealed after completion)
   - Completion date displayed
   - "Completed" badge shown

2. **Active Assignments**
   - Current reports being reviewed
   - "Open" button to access Report Review Modal
   - Assignment number displayed (e.g., "Assignment #47")
   - Deadline displayed

**Upload Functionality:**
- Document type selector dropdown (Certification, Insurance, Tax, Other)
- Drag-and-drop file upload area
- Click to upload option
- File validation: PDF, JPG, PNG only, 10MB max
- Category-based organization
- Immediate feedback on upload success/failure

**Features:**
- Clean, intuitive tab-based navigation
- Empty state messaging for sections with no documents
- Document categorization for easy retrieval
- View and delete functionality for user-uploaded documents
- Read-only display for compliance documents (NDA, payment details)

**Returning Readers:**
When a reader returns to access the workspace in future, they are automatically directed to the Readers Management Hub as their primary landing page. They can access all workflows and documents directly from here. 


---

## STEP 5: SECOND READER WORKFLOW

**Note:** Second readers (medical professionals) follow the EXACT same workflow as first readers, with these differences:

**Key Differences:**
1. **Reader Type:** Second Reader (medical professional)
2. **Payment Rate:** £75-100 (higher than first reader's £50)
3. **Report Version:** Receives second redacted draft (already reviewed by first reader)
4. **Compliance:** Additional medical registration verification required during HR Compliance Gate
   - Registration body: NMC (Nursing and Midwifery Council), GMC (General Medical Council), or Other
   - Registration number verified
   - Specialization recorded

**Workflow Steps (Identical to First Reader):**
1. Invitation email with PIN → `readers.qolae.com/login`
2. 2FA authentication
3. HR Compliance Gate (CV + References + Payment Details + Medical Registration)
4. Readers Dashboard access
5. NDA Modal (4-step workflow)
6. Report Review Modal (second redacted draft - post first reader review)
7. Payment Processing Modal (£75-100 payment)
8. Readers Management Hub

**Payment Timing:**
- Payment made after Liz/Case Manager reviews and approves second reader's corrected draft
- Same payment workflow: Pending → Approved → Processing → Paid

---

## STEP 6: WORKFLOW COMPLETION & SEALED REPORTS

Once a reader's workflow is completed:

1. ✅ NDA signed and stored
2. ✅ Report corrections submitted and approved
3. ✅ Payment processed
4. Redacted reports are **sealed off** in the Readers Management Hub
5. Reports displayed with strikethrough in "Client Documents" tab
6. Reports marked as "Completed" with completion date
7. Reports no longer accessible/editable (workflow locked)
8. Reader can view completion status but cannot reopen sealed reports

**Future Assignments:**
- Reader receives new email notification when new report is assigned
- New assignment appears in "Client Documents" tab (Active Assignments section)
- Reader clicks "Open" to access new Report Review Modal
- Payment workflow repeats for each new assignment

---

## 📊 TECHNICAL SUMMARY

**Databases Used:**
1. **`qolae_hrcompliance`** - CV, references, payment details (collected once)
2. **`qolae_readers`** - Authentication, NDA status, assignments, payment tracking (ongoing)

**Key Files:**
- `readers-login.ejs` (368 lines) - 2FA authentication
- `readers-dashboard.ejs` (1338 lines) - Main workspace
- `nda.ejs` (1262 lines) - NDA workflow
- `inaReportReview.ejs` (1183 lines) - Report corrections
- `paymentProcessing.ejs` (821 lines) - Payment status tracking
- `readersManagementHub.ejs` (1804 lines) - Document library

**Total Lines of Code:** 6,776 lines across 6 views

**Infrastructure:**
- Fastify server (Port 3008)
- PostgreSQL databases (qolae_hrcompliance, qolae_readers)
- Nginx reverse proxy with SSL
- JWT authentication
- Email notification system
- WebSocket support (Port 3009)

---

## ✅ WORKFLOW STATUS: PRODUCTION READY

All components built and tested. Ready for integration with live Case Managers Dashboard.

**Last Updated:** October 28, 2025  
**Author:** Liz Chukwu  
**Status:** ✅ Complete - Awaiting Backend Integration
