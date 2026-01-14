-- ==============================================
-- QOLAE READERS DATABASE SCHEMA
-- ==============================================
-- Purpose: Manages reader registration, authentication, NDA tracking,
--          report assignments, and payment workflows
-- Author: Liz
-- Date: October 7, 2025
-- Updated: January 14, 2026 - Full camelCase conversion
-- Database: qolae_readers (separate from lawyers and admin)
-- Convention: camelCase with double quotes (Liz's absolute)
-- ==============================================

-- Create database (run this first if needed)
-- CREATE DATABASE qolae_readers;

-- Connect to database
-- \c qolae_readers;

-- ==============================================
-- TABLE 1: READERS (Master Registry)
-- ==============================================
-- Stores reader identity, authentication, NDA status and payment rates
-- Reader PIN is their unique identifier (e.g., JS-123456)
-- NO case information stored here (confidentiality/GDPR)
-- ==============================================

CREATE TABLE IF NOT EXISTS readers (
  -- Primary Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "readerPin" VARCHAR(20) UNIQUE NOT NULL, -- e.g., "JS-123456"

  -- Personal Information
  "readerName" VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),

  -- Reader Classification
  "readerType" VARCHAR(50) NOT NULL CHECK ("readerType" IN ('firstReader', 'secondReader')),
  specialization VARCHAR(255), -- For medical readers (e.g., "Registered Nurse", "Physician")

  -- Medical Professional Verification (for second readers only)
  "registrationBody" VARCHAR(50), -- 'NMC', 'GMC', 'Other'
  "registrationNumber" VARCHAR(50), -- e.g., '12A3456E'
  "registrationVerified" BOOLEAN DEFAULT FALSE,
  "registrationVerifiedAt" TIMESTAMP,
  "registrationVerifiedBy" VARCHAR(255), -- 'Liz' or case manager who verified

  -- Payment Configuration
  "paymentRate" DECIMAL(10, 2) DEFAULT 50.00, -- £50.00 for first reader, £75-100 for second

  -- Authentication & Security
  "passwordHash" TEXT, -- Bcrypt hashed password
  "pinAccessTokenStatus" VARCHAR(20) DEFAULT 'pending' CHECK ("pinAccessTokenStatus" IN ('pending', 'active', 'expired')),
  "passwordSetupCompleted" BOOLEAN DEFAULT FALSE,
  "jwtSessionToken" TEXT, -- Current JWT token

  -- 2FA Verification
  "emailVerificationCode" VARCHAR(6), -- 6-digit code
  "emailVerificationCodeExpiresAt" TIMESTAMP,
  "emailVerificationCodeAttempts" INT DEFAULT 0,

  -- NDA Workflow Status
  "ndaSigned" BOOLEAN DEFAULT FALSE,
  "ndaSignedAt" TIMESTAMP,
  "ndaPdfPath" VARCHAR(500), -- Path to signed NDA: /central-repository/signed-nda/NDA_{READER_PIN}_Signed.pdf

  -- Portal Access Control
  "portalAccessStatus" VARCHAR(50) DEFAULT 'pending' CHECK ("portalAccessStatus" IN ('pending', 'active', 'onHold', 'suspended')),

  -- Performance Tracking
  "totalAssignmentsCompleted" INT DEFAULT 0,
  "averageTurnaroundHours" DECIMAL(5, 2), -- Average time to submit corrections
  "totalEarnings" DECIMAL(10, 2) DEFAULT 0.00,

  -- GDPR & Audit Trail
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "createdBy" VARCHAR(255) NOT NULL, -- 'Liz' or other case manager name
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "lastLogin" TIMESTAMP,
  "lastLoginIp" VARCHAR(50),

  -- Indexes for performance
  CONSTRAINT "readersEmailKey" UNIQUE (email),
  CONSTRAINT "readersReaderPinKey" UNIQUE ("readerPin")
);

-- Indexes for readers table
CREATE INDEX "idxReadersReaderPin" ON readers("readerPin");
CREATE INDEX "idxReadersEmail" ON readers(email);
CREATE INDEX "idxReadersReaderType" ON readers("readerType");
CREATE INDEX "idxReadersPortalAccessStatus" ON readers("portalAccessStatus");
CREATE INDEX "idxReadersNdaSigned" ON readers("ndaSigned");

-- ==============================================
-- TABLE 2: READER_ASSIGNMENTS (Report Tracking)
-- ==============================================
-- Links readers to report assignments while maintaining confidentiality
-- Assignment number is visible to reader (e.g., "Assignment #47")
-- Internal case PIN stays hidden from reader (GDPR compliance)
-- ==============================================

CREATE TABLE IF NOT EXISTS "readerAssignments" (
  -- Primary Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "assignmentNumber" SERIAL UNIQUE, -- Auto-incrementing: 1, 2, 3... (visible to reader as "Assignment #47")

  -- Reader Information (by PIN only, no personal data)
  "readerPin" VARCHAR(20) NOT NULL REFERENCES readers("readerPin") ON DELETE CASCADE,
  "readerType" VARCHAR(50) NOT NULL CHECK ("readerType" IN ('firstReader', 'secondReader')),

  -- Internal Case Tracking (NOT visible to reader)
  "internalCasePin" VARCHAR(20), -- e.g., "CM-123456" (Case Manager sees this, reader doesn't)
  "internalCaseDescription" TEXT, -- Internal notes for case manager

  -- Report Assignment Details
  "reportPdfPath" VARCHAR(500), -- Path to redacted report
  "reportAssignedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deadline TIMESTAMP, -- 24 hours from assignment (auto-calculated)

  -- Reader Submission
  "correctionsSubmitted" BOOLEAN DEFAULT FALSE,
  "correctionsSubmittedAt" TIMESTAMP,
  "correctionsFilePath" VARCHAR(500), -- Path to reader's corrected file
  "correctionsNotes" TEXT, -- Reader's notes about corrections
  "turnaroundHours" DECIMAL(5, 2), -- Calculated: submitted_at - assigned_at

  -- Case Manager Review (Manual Approval)
  "correctionsReviewedByCm" BOOLEAN DEFAULT FALSE,
  "correctionsReviewedAt" TIMESTAMP,
  "correctionsReviewedBy" VARCHAR(255), -- 'Liz' or other CM
  "correctionsApproved" BOOLEAN DEFAULT FALSE, -- TRUE = quality approved, FALSE = needs revision
  "cmFeedback" TEXT, -- Case manager's feedback to reader

  -- Payment Workflow (After CM Approval)
  "paymentApproved" BOOLEAN DEFAULT FALSE,
  "paymentApprovedBy" VARCHAR(255), -- 'Liz'
  "paymentApprovedAt" TIMESTAMP,
  "paymentStatus" VARCHAR(50) DEFAULT 'pending' CHECK ("paymentStatus" IN ('pending', 'approved', 'processing', 'paid', 'onHold')),
  "paymentAmount" DECIMAL(10, 2), -- £50.00 or £75-100
  "paymentMethod" VARCHAR(50), -- 'bankTransfer', 'paypal', etc.
  "paymentReference" VARCHAR(100), -- Payment transaction reference
  "paymentProcessedAt" TIMESTAMP,

  -- Deadline Tracking
  "deadlineReminderSent" BOOLEAN DEFAULT FALSE,
  "deadlineReminderSentAt" TIMESTAMP,
  "deadlineExceeded" BOOLEAN DEFAULT FALSE,

  -- Audit Trail
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "assignedBy" VARCHAR(255) NOT NULL, -- 'Liz'
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for readerAssignments table
CREATE INDEX "idxAssignmentsReaderPin" ON "readerAssignments"("readerPin");
CREATE INDEX "idxAssignmentsAssignmentNumber" ON "readerAssignments"("assignmentNumber");
CREATE INDEX "idxAssignmentsInternalCasePin" ON "readerAssignments"("internalCasePin");
CREATE INDEX "idxAssignmentsCorrectionsSubmitted" ON "readerAssignments"("correctionsSubmitted");
CREATE INDEX "idxAssignmentsPaymentStatus" ON "readerAssignments"("paymentStatus");
CREATE INDEX "idxAssignmentsDeadline" ON "readerAssignments"(deadline);

-- ==============================================
-- TABLE 3: READER_ACTIVITY_LOG (GDPR Audit Trail)
-- ==============================================
-- Tracks all reader actions for security and compliance
-- Required for GDPR audit trails
-- ==============================================

CREATE TABLE IF NOT EXISTS "readerActivityLog" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "readerPin" VARCHAR(20) NOT NULL REFERENCES readers("readerPin") ON DELETE CASCADE,

  -- Activity Details
  "activityType" VARCHAR(100) NOT NULL, -- 'login', 'ndaSigned', 'reportDownloaded', 'correctionsSubmitted', etc.
  "activityDescription" TEXT,
  "ipAddress" VARCHAR(50),
  "userAgent" TEXT,

  -- Context
  "relatedAssignmentId" UUID REFERENCES "readerAssignments"(id) ON DELETE SET NULL,

  -- Timestamp
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for activity log
CREATE INDEX "idxActivityLogReaderPin" ON "readerActivityLog"("readerPin");
CREATE INDEX "idxActivityLogActivityType" ON "readerActivityLog"("activityType");
CREATE INDEX "idxActivityLogCreatedAt" ON "readerActivityLog"("createdAt");

-- ==============================================
-- TABLE 4: READER_NDA_VERSIONS (NDA Template Tracking)
-- ==============================================
-- Tracks different versions of NDA template
-- Ensures readers sign current version
-- ==============================================

CREATE TABLE IF NOT EXISTS "readerNdaVersions" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "versionNumber" VARCHAR(20) NOT NULL UNIQUE, -- e.g., "v1.0", "v2.0"
  "ndaTemplatePath" VARCHAR(500) NOT NULL, -- Path to NDA template PDF
  "effectiveDate" DATE NOT NULL,
  "isCurrent" BOOLEAN DEFAULT TRUE,

  -- Audit
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "createdBy" VARCHAR(255) NOT NULL -- 'Liz'
);

-- Only one current version allowed
CREATE UNIQUE INDEX "idxNdaCurrentVersion" ON "readerNdaVersions"("isCurrent") WHERE "isCurrent" = TRUE;

-- ==============================================
-- FUNCTIONS & TRIGGERS
-- ==============================================

-- Auto-update updatedAt timestamp
CREATE OR REPLACE FUNCTION "updateUpdatedAtColumn"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for readers table
CREATE TRIGGER "updateReadersUpdatedAt"
    BEFORE UPDATE ON readers
    FOR EACH ROW
    EXECUTE FUNCTION "updateUpdatedAtColumn"();

-- Trigger for readerAssignments table
CREATE TRIGGER "updateAssignmentsUpdatedAt"
    BEFORE UPDATE ON "readerAssignments"
    FOR EACH ROW
    EXECUTE FUNCTION "updateUpdatedAtColumn"();

-- Auto-calculate deadline (24 hours from assignment)
CREATE OR REPLACE FUNCTION "setAssignmentDeadline"()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deadline IS NULL THEN
        NEW.deadline = NEW."reportAssignedAt" + INTERVAL '24 hours';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set deadline automatically
CREATE TRIGGER "setDeadlineOnAssignment"
    BEFORE INSERT ON "readerAssignments"
    FOR EACH ROW
    EXECUTE FUNCTION "setAssignmentDeadline"();

-- Auto-calculate turnaround hours when corrections submitted
CREATE OR REPLACE FUNCTION "calculateTurnaroundHours"()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."correctionsSubmitted" = TRUE AND OLD."correctionsSubmitted" = FALSE THEN
        NEW."turnaroundHours" = EXTRACT(EPOCH FROM (NEW."correctionsSubmittedAt" - NEW."reportAssignedAt")) / 3600;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to calculate turnaround
CREATE TRIGGER "calculateTurnaroundOnSubmission"
    BEFORE UPDATE ON "readerAssignments"
    FOR EACH ROW
    EXECUTE FUNCTION "calculateTurnaroundHours"();

-- ==============================================
-- INITIAL DATA
-- ==============================================

-- Insert current NDA version
INSERT INTO "readerNdaVersions" ("versionNumber", "ndaTemplatePath", "effectiveDate", "isCurrent", "createdBy")
VALUES ('v1.0', '/central-repository/public/original/TemplateReadersNDA.pdf', CURRENT_DATE, TRUE, 'Liz')
ON CONFLICT ("versionNumber") DO NOTHING;

-- ==============================================
-- USEFUL QUERIES FOR CASE MANAGERS DASHBOARD
-- ==============================================

-- View all active readers
-- SELECT "readerPin", "readerName", "readerType", "portalAccessStatus", "ndaSigned", "totalAssignmentsCompleted"
-- FROM readers
-- WHERE "portalAccessStatus" = 'active'
-- ORDER BY "readerType", "readerName";

-- View pending payment approvals
-- SELECT
--   ra."assignmentNumber",
--   ra."readerPin",
--   r."readerName",
--   ra."correctionsSubmittedAt",
--   ra."paymentAmount",
--   ra."internalCasePin"
-- FROM "readerAssignments" ra
-- JOIN readers r ON ra."readerPin" = r."readerPin"
-- WHERE ra."correctionsSubmitted" = TRUE
--   AND ra."correctionsApproved" = FALSE
-- ORDER BY ra."correctionsSubmittedAt" ASC;

-- View reader performance stats
-- SELECT
--   "readerPin",
--   "readerName",
--   "readerType",
--   "totalAssignmentsCompleted",
--   "averageTurnaroundHours",
--   "totalEarnings"
-- FROM readers
-- WHERE "totalAssignmentsCompleted" > 0
-- ORDER BY "totalAssignmentsCompleted" DESC;

-- ==============================================
-- SCHEMA COMPLETE ✅
-- ==============================================
-- Convention: camelCase with double quotes (Liz's absolute)
-- NO snake_case allowed!
-- Next Steps:
-- 1. Run migration script on live server (see migration file)
-- 2. Test all queries
-- 3. Verify sync with qolae_hrcompliance
-- ==============================================
