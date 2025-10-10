# QOLAE READERS DASHBOARD - HR COMPLIANCE IMPLEMENTATION CHECKLIST
**Author:** Liz & Claude  
**Date:** October 10, 2025  
**Purpose:** Complete implementation checklist for Readers Dashboard with HR Compliance workflow

---

## ✅ PHASE 0: PLANNING & DOCUMENTATION (COMPLETED)

- [x] 1. Design Readers Dashboard workflow (using existing technology from Lawyers Dashboard)
- [x] 2. Design Case Managers Dashboard workflow for Readers management
- [x] 3. Document ReadersWorkflow.md with HR Compliance Gate
- [x] 4. Document CaseManagersWorkflow.md with Compliance Review process
- [x] 5. Add TemplateReadersNDA.pdf to `/QOLAE-API-Dashboard/central-repository/original/` folder

---

## 📊 PHASE 1: DATABASE SETUP

### Database Schema Files:
- [x] 6. Create `setup_qolae_readers.sql` (already exists)
- [x] 7. Create `setup_qolae_casemanagers.sql` (already exists)
- [x] 8. Create `setup_qolae_hrcompliance.sql` in `/QOLAE-CaseManagers-Dashboard/CaseManagersDashboard/database/`
- [ ] 9. Decide on migration strategy for `compliance_submitted` columns in `readers` table

### Run Database Scripts:
- [ ] 10. Run `setup_qolae_hrcompliance.sql` to create HR compliance database
  - [ ] Creates `reader_compliance` table (CV + references data)
  - [ ] Creates `compliance_access_log` table (GDPR audit trail)
  - [ ] Creates `reference_forms` table (signed reference forms)
- [ ] 11. Run migration `add_compliance_flags_to_readers.sql` to add compliance columns to `readers` table
  - [ ] Adds `compliance_submitted` BOOLEAN column
  - [ ] Adds `compliance_submitted_at` TIMESTAMP column

### Database Connections:
- [ ] 12. Add `qolae_hrcompliance` connection config to Case Managers backend
- [ ] 13. Test cross-database queries (readers in `qolae_readers`, compliance in `qolae_hrcompliance`)

---

## 👥 PHASE 2: CASE MANAGERS DASHBOARD - READER REGISTRATION

### Reader Registration Card (in CM Dashboard):
- [ ] 14. Create or update `readers-registration-card.ejs` in `/QOLAE-CaseManagers-Dashboard/CaseManagersDashboard/views/`
  - [ ] Reader name field
  - [ ] Email field (unique, required)
  - [ ] Phone field
  - [ ] Reader type dropdown: "First Reader" or "Second Reader"
  - [ ] **Conditional fields for Second Readers (medical professionals):**
    - [ ] Specialization field (e.g., "Registered Nurse", "Physician")
    - [ ] Registration body dropdown: NMC, GMC, Other
    - [ ] Registration number field (e.g., "12A3456E")
    - [ ] "Verify" button to check registration
  - [ ] Payment rate field (£50 for first, £75-100 for second)
  - [ ] "Generate PIN" button (auto-generates reader-specific PIN like `RDR-SM123456`)
  - [ ] Display generated PIN prominently
  - [ ] "Generate NDA" checkbox (triggers customized NDA creation)
  - [ ] "Send Invitation Email" button (with hyperlinked PIN + NDA attachment)

### Backend - Reader Registration:
- [ ] 15. Create or update `/QOLAE-CaseManagers-Dashboard/CaseManagersDashboard/controllers/ReadersController.js`
  - [ ] `registerReader()` - Create new reader in `qolae_readers.readers` table
  - [ ] `generateReaderPIN()` - Auto-generate unique PIN (RDR-XX123456)
  - [ ] `verifyMedicalRegistration()` - Verify NMC/GMC registration (for second readers)
  - [ ] `getAllReaders()` - Fetch all readers for CM dashboard
  - [ ] `getReaderByPin()` - Fetch specific reader details
  - [ ] `updateReaderStatus()` - Update portal_access_status
  - [ ] `deleteReader()` - Soft delete/suspend reader

### Backend - NDA Generation:
- [ ] 16. Create `/QOLAE-CaseManagers-Dashboard/CaseManagersDashboard/utils/generateCustomizedReadersNDA.js`
  - [ ] Load TemplateReadersNDA.pdf from `/central-repository/original/`
  - [ ] Populate reader name, PIN, date
  - [ ] Save to `/central-repository/readers-nda/NDA_{READER_PIN}_Customized.pdf`
  - [ ] Return file path for email attachment

### Backend - Invitation Email:
- [ ] 17. Create `/QOLAE-CaseManagers-Dashboard/CaseManagersDashboard/emails/sendReaderInvitation.js`
  - [ ] Email subject: "Welcome to QOLAE - Your Secure Reader Portal Access"
  - [ ] Email body with:
    - [ ] Personal greeting with reader name
    - [ ] Explanation of role (first reader or second reader)
    - [ ] **Hyperlinked PIN** that directs to `readers.qolae.com?pin={READER_PIN}`
    - [ ] Attached customized NDA PDF
    - [ ] Instructions for 2FA setup
    - [ ] Instructions for HR compliance submission (CV + references)
    - [ ] Contact details for Liz
  - [ ] Send via existing email service (Fastify/Nodemailer)

### Routes:
- [ ] 18. Create or update `/QOLAE-CaseManagers-Dashboard/CaseManagersDashboard/routes/readersRoutes.js`
  - [ ] `POST /api/readers/register` - Register new reader
  - [ ] `POST /api/readers/generate-pin` - Generate PIN
  - [ ] `POST /api/readers/generate-nda` - Generate customized NDA
  - [ ] `POST /api/readers/send-invitation` - Send email with PIN + NDA
  - [ ] `GET /api/readers` - Get all readers
  - [ ] `GET /api/readers/:pin` - Get reader by PIN
  - [ ] `PUT /api/readers/:pin` - Update reader details
  - [ ] `DELETE /api/readers/:pin` - Delete/suspend reader

---

## 🔐 PHASE 3: READERS DASHBOARD - LOGIN & 2FA

### Reader Login Page:
- [ ] 19. Create or update `readers-login.ejs` in `/QOLAE-Readers-Dashboard/ReadersDashboard/views/`
  - [ ] PIN field (auto-populated from URL param `?pin=RDR-XX123456`)
  - [ ] Email field
  - [ ] "Continue" button
  - [ ] Password creation flow (first-time login only)
  - [ ] 2FA code input field
  - [ ] "Verify & Login" button
  - [ ] Error handling for invalid PIN/email
  - [ ] Session token storage (JWT)

### Backend - Authentication:
- [ ] 20. Create or update `/QOLAE-Readers-Dashboard/ReadersDashboard/controllers/AuthController.js`
  - [ ] `initiateLogin()` - Validate PIN + email
  - [ ] `sendVerificationCode()` - Generate 6-digit 2FA code, send via email
  - [ ] `verifyCode()` - Check 2FA code, handle attempts limit
  - [ ] `createPassword()` - Hash password (bcrypt), save to `readers` table
  - [ ] `generateJWT()` - Create session token
  - [ ] `logout()` - Invalidate session

### Routes:
- [ ] 21. Create `/QOLAE-Readers-Dashboard/ReadersDashboard/routes/authRoutes.js`
  - [ ] `POST /api/auth/login` - Initiate login with PIN + email
  - [ ] `POST /api/auth/send-code` - Send 2FA code
  - [ ] `POST /api/auth/verify-code` - Verify 2FA code
  - [ ] `POST /api/auth/create-password` - First-time password creation
  - [ ] `POST /api/auth/logout` - Logout and clear session

---

## 📋 PHASE 4: HR COMPLIANCE GATE (READERS SIDE)

### Compliance Submission Form:
- [ ] 22. Create `readers-compliance.ejs` in `/QOLAE-Readers-Dashboard/ReadersDashboard/views/`
  - [ ] **Header:** "Welcome! Before accessing your dashboard, please submit your HR compliance documents"
  - [ ] **Section 1: Upload CV**
    - [ ] File upload input (accept PDF only, max 5MB)
    - [ ] File name preview
    - [ ] Validation: required, PDF format
  - [ ] **Section 2: Professional Reference**
    - [ ] Referee name (text input, required)
    - [ ] Referee title/position (text input, required)
    - [ ] Organisation (text input, required)
    - [ ] Email (email input, required, validated)
    - [ ] Phone (tel input, required, validated)
    - [ ] Relationship to you (textarea, required, e.g., "Former supervisor at X Hospital 2018-2022")
  - [ ] **Section 3: Character Reference**
    - [ ] Referee name (text input, required)
    - [ ] Relationship (text input, required, e.g., "Academic supervisor", "Colleague")
    - [ ] Email (email input, required, validated)
    - [ ] Phone (tel input, required, validated)
    - [ ] How long have they known you? (text input, required, e.g., "5 years")
  - [ ] **Submit button:** "Submit Compliance Documents"
  - [ ] **Success message:** "Thank you! Your compliance documents are being reviewed. You'll receive dashboard access shortly."
  - [ ] **Styling:** Match Readers Dashboard theme (similar to Lawyers Dashboard)

### Backend - Compliance Submission:
- [ ] 23. Create `/QOLAE-Readers-Dashboard/ReadersDashboard/controllers/ComplianceController.js`
  - [ ] `uploadCV()` - Handle CV file upload, validate, save to `/central-repository/hr-compliance/cv/`
  - [ ] `submitCompliance()` - Save compliance data to `qolae_hrcompliance.reader_compliance` table
  - [ ] `updateReaderFlag()` - Set `compliance_submitted = TRUE` in `qolae_readers.readers` table
  - [ ] `getComplianceStatus()` - Check if reader has submitted compliance

### File Storage:
- [ ] 24. Create directory structure for HR compliance files:
  - [ ] `/central-repository/hr-compliance/cv/` (CV files)
  - [ ] `/central-repository/hr-compliance/references/` (signed reference forms)
  - [ ] `/central-repository/hr-compliance/signatures/` (referee signatures)

### Routes:
- [ ] 25. Create `/QOLAE-Readers-Dashboard/ReadersDashboard/routes/complianceRoutes.js`
  - [ ] `POST /api/compliance/upload-cv` - Upload CV file
  - [ ] `POST /api/compliance/submit` - Submit full compliance data
  - [ ] `GET /api/compliance/status` - Check compliance status

### Middleware - Compliance Gate:
- [ ] 26. Create `/QOLAE-Readers-Dashboard/ReadersDashboard/middleware/checkCompliance.js`
  - [ ] Check `readers.compliance_submitted` flag
  - [ ] If `FALSE` → redirect to `/compliance`
  - [ ] If `TRUE` → allow access to dashboard
  - [ ] Apply middleware to all dashboard routes EXCEPT `/compliance`

---

## 🔍 PHASE 5: CASE MANAGERS DASHBOARD - COMPLIANCE REVIEW

### Compliance Review UI:
- [ ] 27. Update `casemanagers-dashboard.ejs` to show compliance notifications
  - [ ] **Pending Compliance Section** (similar to existing workflow cards)
    - [ ] List all readers with `compliance_submitted = TRUE` but `approved = FALSE`
    - [ ] Display: Reader name, Reader type, Submission date
    - [ ] Status badge: "Compliance Submitted - Pending Review"
    - [ ] "Review" button for each reader
  - [ ] **Compliance Review Modal** (opens on "Review" click)
    - [ ] Reader details (name, PIN, email, reader type)
    - [ ] CV download button + file details (filename, size, upload date)
    - [ ] **Professional Reference Details:**
      - [ ] Name, Title, Organisation
      - [ ] Email, Phone
      - [ ] Relationship description
      - [ ] Status: Pending/In Progress/Received
      - [ ] "Call Referee" button → opens reference form
      - [ ] "Email Reference Form" button
    - [ ] **Character Reference Details:**
      - [ ] Name, Relationship
      - [ ] Email, Phone
      - [ ] Duration known
      - [ ] Status: Pending/In Progress/Received
      - [ ] "Call Referee" button → opens reference form
      - [ ] "Email Reference Form" button
    - [ ] **Approval Section** (only shown when both references received)
      - [ ] Notes textarea (optional)
      - [ ] "Approve Compliance" button (green, prominent)
      - [ ] "Request Changes" button (yellow)

### Reference Form (for Liz to fill during phone call):
- [ ] 28. Create `reference-form.ejs` in `/QOLAE-CaseManagers-Dashboard/CaseManagersDashboard/views/`
  - [ ] **Header:** "Reference Form - [Reader Name]"
  - [ ] **Reference Type:** Professional or Character (auto-populated)
  - [ ] **Referee Details:** (pre-filled from compliance submission)
    - [ ] Name
    - [ ] Email
    - [ ] Phone
    - [ ] Organisation (if professional)
  - [ ] **Reference Questions:**
    - [ ] How long have you known the candidate? (text)
    - [ ] In what capacity? (text)
    - [ ] Please describe the candidate's professional skills/character (textarea)
    - [ ] Strengths (textarea)
    - [ ] Areas for development (optional, textarea)
    - [ ] Would you recommend this candidate? (Yes/No radio)
    - [ ] Additional comments (textarea, optional)
  - [ ] **Form Method Tracking:**
    - [ ] "Filled by phone call with Liz" (auto-set)
    - [ ] Date/time stamp
  - [ ] **Actions:**
    - [ ] "Save Draft" button
    - [ ] "Save & Email to Referee for Signature" button (primary action)
  - [ ] **After save:** System generates PDF and emails to referee

### Referee Signature Form (public-facing):
- [ ] 29. Create `referee-signature.ejs` in `/QOLAE-CaseManagers-Dashboard/CaseManagersDashboard/views/`
  - [ ] **Public route** (no login required, secured by unique token)
  - [ ] **Header:** "Reference Confirmation - QOLAE"
  - [ ] **Display pre-filled reference** (read-only)
    - [ ] Show all filled answers
    - [ ] "Edit" option (if referee wants to change answers)
  - [ ] **Digital Signature Section:**
    - [ ] Signature pad (canvas-based, like NDA/TOB signature)
    - [ ] "Clear" button
    - [ ] Name confirmation field
    - [ ] Date (auto-populated)
    - [ ] Checkbox: "I confirm this reference is accurate"
  - [ ] **Submit button:** "Sign & Submit Reference"
  - [ ] **Success message:** "Thank you! Your reference has been submitted."
  - [ ] **Email confirmation** sent to referee and Liz

### Backend - Compliance Review:
- [ ] 30. Create `/QOLAE-CaseManagers-Dashboard/CaseManagersDashboard/controllers/HRComplianceController.js`
  - [ ] `getPendingCompliance()` - Fetch all pending compliance submissions
  - [ ] `getComplianceDetails()` - Get full compliance record by reader_pin
  - [ ] `downloadCV()` - Download CV file, log access in `compliance_access_log`
  - [ ] `createReferenceForm()` - Create new reference form (phone call method)
  - [ ] `saveReferenceDraft()` - Save reference form as draft
  - [ ] `sendReferenceFormToReferee()` - Generate PDF, create unique token, email to referee
  - [ ] `submitRefereeSignature()` - Referee submits signed reference
  - [ ] `approveCompliance()` - Approve compliance, lock record, activate reader account
  - [ ] `requestChanges()` - Request changes from reader
  - [ ] `logAccess()` - Log all access to compliance records (GDPR audit)

### Backend - Email Notifications:
- [ ] 31. Create `/QOLAE-CaseManagers-Dashboard/CaseManagersDashboard/emails/complianceEmails.js`
  - [ ] `sendReferenceFormToReferee()` - Email with pre-filled form + signature link
    - [ ] Subject: "Reference Request for [Reader Name] - QOLAE"
    - [ ] Attached pre-filled PDF
    - [ ] Unique signature link: `casemanagers.qolae.com/referee/sign?token={UNIQUE_TOKEN}`
    - [ ] Estimated time: "This will take approximately 30 seconds"
  - [ ] `sendComplianceApprovalToReader()` - Email reader when approved
    - [ ] Subject: "Welcome to QOLAE - Dashboard Access Activated"
    - [ ] Login link
    - [ ] Next steps (sign NDA)
  - [ ] `sendReferenceReceivedToLiz()` - Notify Liz when referee signs
    - [ ] Subject: "Reference Received - [Reader Name]"
    - [ ] Link to review in dashboard

### Routes:
- [ ] 32. Create `/QOLAE-CaseManagers-Dashboard/CaseManagersDashboard/routes/hrComplianceRoutes.js`
  - [ ] `GET /api/hr-compliance/pending` - Get pending compliance submissions
  - [ ] `GET /api/hr-compliance/:readerPin` - Get compliance details
  - [ ] `GET /api/hr-compliance/:readerPin/cv` - Download CV
  - [ ] `POST /api/hr-compliance/reference/create` - Create reference form
  - [ ] `POST /api/hr-compliance/reference/save-draft` - Save reference draft
  - [ ] `POST /api/hr-compliance/reference/send-to-referee` - Email reference form
  - [ ] `POST /api/hr-compliance/approve/:readerPin` - Approve compliance
  - [ ] `POST /api/hr-compliance/request-changes/:readerPin` - Request changes
  - [ ] **Public routes:**
    - [ ] `GET /referee/sign?token={TOKEN}` - Referee signature page
    - [ ] `POST /api/referee/submit-signature` - Submit signed reference

---

## 🖥️ PHASE 6: READERS DASHBOARD - MAIN WORKSPACE

### Main Dashboard (after compliance approved):
- [ ] 33. Create or update `readers-dashboard.ejs` in `/QOLAE-Readers-Dashboard/ReadersDashboard/views/`
  - [ ] **Welcome Panel:**
    - [ ] "Welcome back, [Reader Name]!"
    - [ ] Reader type badge (First Reader / Second Reader)
    - [ ] Last login timestamp
  - [ ] **Workflow Progress Panel:**
    - [ ] NDA Status (Pending/Signed)
    - [ ] Current Assignments count
    - [ ] Completed Assignments count
    - [ ] Total earnings
  - [ ] **Modal Workflow Cards:**
    - [ ] **Card 1: Non-Disclosure Agreement (NDA)**
      - [ ] "Review & Sign" button (opens NDA modal)
      - [ ] Status: Pending → Signed
      - [ ] After signing: "View Summary" button
    - [ ] **Card 2: Current Assignments**
      - [ ] List of assigned reports (redacted)
      - [ ] Assignment number (visible to reader)
      - [ ] Deadline countdown
      - [ ] "View Report" button
      - [ ] "Submit Corrections" button
    - [ ] **Card 3: Payment Details**
      - [ ] Banking details form
      - [ ] Payment history
      - [ ] Pending payments
    - [ ] **Card 4: Readers Management Hub**
      - [ ] Documents Library (redacted INA reports)
      - [ ] Assignment history
      - [ ] Performance stats (turnaround time, earnings)

### NDA Signature Workflow:
- [ ] 34. Create `nda-modal.ejs` or integrate into dashboard
  - [ ] **Step 1:** Display customized NDA PDF (pull from `/central-repository/readers-nda/`)
  - [ ] **Step 2:** Signature workflow (similar to Lawyers TOB signature)
    - [ ] Draw signature on canvas
    - [ ] Add signature to NDA
    - [ ] Liz's signature auto-applied (checkbox to trigger)
  - [ ] **Step 3:** Preview signed NDA
  - [ ] **Step 4:** Download & save to database
    - [ ] Save to `/central-repository/signed-readers-nda/NDA_{READER_PIN}_Signed.pdf`
    - [ ] Update `readers.nda_signed = TRUE` in database
    - [ ] Make available in Documents Library

### Backend - NDA Workflow:
- [ ] 35. Create `/QOLAE-Readers-Dashboard/ReadersDashboard/controllers/NDAController.js`
  - [ ] `getCustomizedNDA()` - Fetch reader's customized NDA
  - [ ] `applySignature()` - Apply reader's signature + Liz's signature to NDA
  - [ ] `saveSignedNDA()` - Save signed NDA, update database
  - [ ] `downloadNDA()` - Download signed NDA

### Routes:
- [ ] 36. Create `/QOLAE-Readers-Dashboard/ReadersDashboard/routes/ndaRoutes.js`
  - [ ] `GET /api/nda/customized` - Get customized NDA
  - [ ] `POST /api/nda/sign` - Apply signatures
  - [ ] `POST /api/nda/save` - Save signed NDA
  - [ ] `GET /api/nda/download` - Download signed NDA

---

## 📝 PHASE 7: REPORT ASSIGNMENT WORKFLOW (Future)

### Case Manager - Assign Report to Reader:
- [ ] 37. Create report assignment UI in CM Dashboard
  - [ ] Select reader from dropdown (filter by type, availability)
  - [ ] Upload redacted INA report
  - [ ] Set deadline (default 24 hours)
  - [ ] Internal case notes (not visible to reader)
  - [ ] "Assign Report" button

### Reader - View & Submit Corrections:
- [ ] 38. Create report editing interface in Readers Dashboard
  - [ ] View redacted report in modal
  - [ ] In-browser editing tools (annotations, comments)
  - [ ] Upload corrected version
  - [ ] Add notes for CM
  - [ ] "Submit Corrections" button
  - [ ] Deadline countdown reminder

### Case Manager - Review Corrections:
- [ ] 39. Create corrections review UI in CM Dashboard
  - [ ] Compare original vs corrected version
  - [ ] Approve or request revisions
  - [ ] Approve payment
  - [ ] Download corrected version

---

## 🎨 PHASE 8: FRONTEND STYLING & UX

- [ ] 40. Bootstrap Readers Dashboard workspace
  - [ ] Apply QOLAE brand colors (different from Lawyers, but cohesive)
  - [ ] Consistent typography and spacing
  - [ ] Responsive design (mobile, tablet, desktop)
  - [ ] Accessibility (ARIA labels, keyboard navigation)
  - [ ] Loading states and error handling
  - [ ] Success/error toasts for user feedback

- [ ] 41. Bootstrap Case Managers Dashboard workspace
  - [ ] Integrate Readers management section
  - [ ] Compliance review cards styling
  - [ ] Modal designs
  - [ ] Notification badges
  - [ ] Status colors (pending = yellow, approved = green, etc.)

---

## 🔒 PHASE 9: SECURITY & PERMISSIONS

- [ ] 42. Implement JWT authentication for Readers Dashboard
  - [ ] Token generation on login
  - [ ] Token validation middleware on all protected routes
  - [ ] Token refresh mechanism
  - [ ] Logout token invalidation

- [ ] 43. Implement role-based access control
  - [ ] Case Managers can access HR compliance database
  - [ ] Readers can only access their own data
  - [ ] Referees can only access their specific reference form (via token)

- [ ] 44. Secure file uploads
  - [ ] File type validation (PDF only for CVs)
  - [ ] File size limits
  - [ ] Virus scanning (optional but recommended)
  - [ ] Sanitize filenames

- [ ] 45. GDPR compliance
  - [ ] Log all access to HR compliance data
  - [ ] Implement data retention policies
  - [ ] Allow readers to request their data
  - [ ] Allow readers to delete their account (with cascading rules)

---

## 📧 PHASE 10: EMAIL & NOTIFICATIONS

- [ ] 46. Set up email service (Fastify + Nodemailer or similar)
- [ ] 47. Create email templates:
  - [ ] Reader invitation email (with hyperlinked PIN + NDA attachment)
  - [ ] 2FA verification code email
  - [ ] Compliance submitted confirmation (to reader)
  - [ ] Compliance approved email (to reader)
  - [ ] Reference request email (to referee, with pre-filled form)
  - [ ] Reference received notification (to Liz)
  - [ ] Report assigned email (to reader)
  - [ ] Deadline reminder email (to reader)
  - [ ] Payment processed email (to reader)

- [ ] 48. Test all email flows end-to-end

---

## 🧪 PHASE 11: TESTING

- [ ] 49. Unit tests for backend controllers
- [ ] 50. Integration tests for API routes
- [ ] 51. End-to-end tests for key workflows:
  - [ ] Reader registration → invitation → login → compliance → approval
  - [ ] Reference collection (phone call method)
  - [ ] Reference collection (email self-filled method)
  - [ ] NDA signature workflow
  - [ ] Report assignment and submission

- [ ] 52. Manual testing checklist:
  - [ ] Test as First Reader
  - [ ] Test as Second Reader (with medical verification)
  - [ ] Test as Case Manager (Liz)
  - [ ] Test as Referee (signature flow)
  - [ ] Test error scenarios (invalid PIN, expired 2FA, file upload errors)

---

## 🚀 PHASE 12: DEPLOYMENT

- [ ] 53. Set up production databases:
  - [ ] `qolae_readers` (if not already live)
  - [ ] `qolae_hrcompliance` (new)
  - [ ] Run migrations

- [ ] 54. Configure environment variables:
  - [ ] Database connection strings
  - [ ] JWT secret keys
  - [ ] Email service credentials
  - [ ] File upload paths
  - [ ] API URLs

- [ ] 55. Deploy Readers Dashboard backend
  - [ ] Configure Nginx for `readers.qolae.com`
  - [ ] SSL certificates
  - [ ] PM2 or similar process manager

- [ ] 56. Deploy Case Managers Dashboard updates
  - [ ] Add HR compliance routes
  - [ ] Update Nginx config if needed

- [ ] 57. Deploy public referee signature page
  - [ ] Public route accessible without login
  - [ ] Token-based security

- [ ] 58. Test live deployment:
  - [ ] Full workflow test in production
  - [ ] Check email delivery
  - [ ] Check file uploads/downloads
  - [ ] Check database connections

---

## 📚 PHASE 13: DOCUMENTATION & TRAINING

- [ ] 59. Create user guides:
  - [ ] Reader onboarding guide
  - [ ] Case Manager guide for reader management
  - [ ] Compliance review workflow guide
  - [ ] Troubleshooting guide

- [ ] 60. Create API documentation
- [ ] 61. Update main README with Readers Dashboard info
- [ ] 62. Train other Case Managers (if applicable)

---

## 🔧 PHASE 14: MAINTENANCE & ITERATION

- [ ] 63. Monitor database performance
- [ ] 64. Monitor email delivery rates
- [ ] 65. Collect user feedback from readers
- [ ] 66. Iterate on UX improvements
- [ ] 67. Add analytics/reporting for compliance metrics

---

## 📊 CURRENT STATUS SUMMARY

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 0: Planning & Documentation | ✅ Complete | 100% |
| Phase 1: Database Setup | 🟡 In Progress | 80% |
| Phase 2: CM Dashboard - Reader Registration | ⏳ Not Started | 0% |
| Phase 3: Readers Dashboard - Login & 2FA | ⏳ Not Started | 0% |
| Phase 4: HR Compliance Gate (Readers) | ⏳ Not Started | 0% |
| Phase 5: CM Dashboard - Compliance Review | ⏳ Not Started | 0% |
| Phase 6: Readers Dashboard - Main Workspace | ⏳ Not Started | 0% |
| Phase 7: Report Assignment Workflow | ⏳ Future | 0% |
| Phase 8: Frontend Styling & UX | ⏳ Not Started | 0% |
| Phase 9: Security & Permissions | ⏳ Not Started | 0% |
| Phase 10: Email & Notifications | ⏳ Not Started | 0% |
| Phase 11: Testing | ⏳ Not Started | 0% |
| Phase 12: Deployment | ⏳ Not Started | 0% |
| Phase 13: Documentation & Training | ⏳ Not Started | 0% |
| Phase 14: Maintenance & Iteration | ⏳ Future | 0% |

---

## 🎯 NEXT IMMEDIATE STEPS

1. **Decide on migration strategy** for `compliance_submitted` columns
2. **Run database scripts** to create `qolae_hrcompliance` and update `qolae_readers`
3. **Start Phase 2:** Build Reader Registration Card in Case Managers Dashboard

---

**Total Tasks:** 67  
**Completed:** 5  
**In Progress:** 4  
**Remaining:** 58  

---

*This checklist will be updated as we progress through implementation.*

