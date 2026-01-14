-- ==============================================
-- MIGRATION: Snake_case to camelCase
-- ==============================================
-- Purpose: Convert all column names from snake_case to camelCase
-- Author: Liz
-- Date: January 14, 2026
-- Database: qolae_readers
-- IMPORTANT: Run this on your LIVE server via psql
-- Convention: camelCase is one of Liz's 4 absolutes!
-- ==============================================

-- Connect to the database
\c qolae_readers;

BEGIN;

-- ==============================================
-- TABLE 1: READERS - Column Renames
-- ==============================================

-- Personal Information
ALTER TABLE readers RENAME COLUMN reader_pin TO "readerPin";
ALTER TABLE readers RENAME COLUMN reader_name TO "readerName";
ALTER TABLE readers RENAME COLUMN reader_type TO "readerType";

-- Medical Professional Verification
ALTER TABLE readers RENAME COLUMN registration_body TO "registrationBody";
ALTER TABLE readers RENAME COLUMN registration_number TO "registrationNumber";
ALTER TABLE readers RENAME COLUMN registration_verified TO "registrationVerified";
ALTER TABLE readers RENAME COLUMN registration_verified_at TO "registrationVerifiedAt";
ALTER TABLE readers RENAME COLUMN registration_verified_by TO "registrationVerifiedBy";

-- Payment Configuration
ALTER TABLE readers RENAME COLUMN payment_rate TO "paymentRate";

-- Authentication & Security
ALTER TABLE readers RENAME COLUMN password_hash TO "passwordHash";
ALTER TABLE readers RENAME COLUMN pin_access_token_status TO "pinAccessTokenStatus";
ALTER TABLE readers RENAME COLUMN password_setup_completed TO "passwordSetupCompleted";
ALTER TABLE readers RENAME COLUMN jwt_session_token TO "jwtSessionToken";

-- 2FA Verification
ALTER TABLE readers RENAME COLUMN email_verification_code TO "emailVerificationCode";
ALTER TABLE readers RENAME COLUMN email_verification_code_expires_at TO "emailVerificationCodeExpiresAt";
ALTER TABLE readers RENAME COLUMN email_verification_code_attempts TO "emailVerificationCodeAttempts";

-- NDA Workflow Status
ALTER TABLE readers RENAME COLUMN nda_signed TO "ndaSigned";
ALTER TABLE readers RENAME COLUMN nda_signed_at TO "ndaSignedAt";
ALTER TABLE readers RENAME COLUMN nda_pdf_path TO "ndaPdfPath";

-- Portal Access Control
ALTER TABLE readers RENAME COLUMN portal_access_status TO "portalAccessStatus";

-- Performance Tracking
ALTER TABLE readers RENAME COLUMN total_assignments_completed TO "totalAssignmentsCompleted";
ALTER TABLE readers RENAME COLUMN average_turnaround_hours TO "averageTurnaroundHours";
ALTER TABLE readers RENAME COLUMN total_earnings TO "totalEarnings";

-- GDPR & Audit Trail
ALTER TABLE readers RENAME COLUMN created_at TO "createdAt";
ALTER TABLE readers RENAME COLUMN created_by TO "createdBy";
ALTER TABLE readers RENAME COLUMN updated_at TO "updatedAt";
ALTER TABLE readers RENAME COLUMN last_login TO "lastLogin";
ALTER TABLE readers RENAME COLUMN last_login_ip TO "lastLoginIp";

-- ==============================================
-- TABLE 1: READERS - Update Constraints
-- ==============================================

-- Drop old constraints
ALTER TABLE readers DROP CONSTRAINT IF EXISTS readers_reader_pin_key;

-- Add new constraints
ALTER TABLE readers ADD CONSTRAINT "readersReaderPinKey" UNIQUE ("readerPin");

-- Drop old indexes
DROP INDEX IF EXISTS idx_readers_reader_pin;
DROP INDEX IF EXISTS idx_readers_reader_type;
DROP INDEX IF EXISTS idx_readers_portal_access_status;
DROP INDEX IF EXISTS idx_readers_nda_signed;

-- Create new indexes
CREATE INDEX "idxReadersReaderPin" ON readers("readerPin");
CREATE INDEX "idxReadersReaderType" ON readers("readerType");
CREATE INDEX "idxReadersPortalAccessStatus" ON readers("portalAccessStatus");
CREATE INDEX "idxReadersNdaSigned" ON readers("ndaSigned");

-- ==============================================
-- TABLE 2: READER_ASSIGNMENTS - Rename Table & Columns
-- ==============================================

-- Rename table
ALTER TABLE reader_assignments RENAME TO "readerAssignments";

-- Rename columns
ALTER TABLE "readerAssignments" RENAME COLUMN assignment_number TO "assignmentNumber";
ALTER TABLE "readerAssignments" RENAME COLUMN reader_pin TO "readerPin";
ALTER TABLE "readerAssignments" RENAME COLUMN reader_type TO "readerType";
ALTER TABLE "readerAssignments" RENAME COLUMN internal_case_pin TO "internalCasePin";
ALTER TABLE "readerAssignments" RENAME COLUMN internal_case_description TO "internalCaseDescription";
ALTER TABLE "readerAssignments" RENAME COLUMN report_pdf_path TO "reportPdfPath";
ALTER TABLE "readerAssignments" RENAME COLUMN report_assigned_at TO "reportAssignedAt";
ALTER TABLE "readerAssignments" RENAME COLUMN corrections_submitted TO "correctionsSubmitted";
ALTER TABLE "readerAssignments" RENAME COLUMN corrections_submitted_at TO "correctionsSubmittedAt";
ALTER TABLE "readerAssignments" RENAME COLUMN corrections_file_path TO "correctionsFilePath";
ALTER TABLE "readerAssignments" RENAME COLUMN corrections_notes TO "correctionsNotes";
ALTER TABLE "readerAssignments" RENAME COLUMN turnaround_hours TO "turnaroundHours";
ALTER TABLE "readerAssignments" RENAME COLUMN corrections_reviewed_by_cm TO "correctionsReviewedByCm";
ALTER TABLE "readerAssignments" RENAME COLUMN corrections_reviewed_at TO "correctionsReviewedAt";
ALTER TABLE "readerAssignments" RENAME COLUMN corrections_reviewed_by TO "correctionsReviewedBy";
ALTER TABLE "readerAssignments" RENAME COLUMN corrections_approved TO "correctionsApproved";
ALTER TABLE "readerAssignments" RENAME COLUMN cm_feedback TO "cmFeedback";
ALTER TABLE "readerAssignments" RENAME COLUMN payment_approved TO "paymentApproved";
ALTER TABLE "readerAssignments" RENAME COLUMN payment_approved_by TO "paymentApprovedBy";
ALTER TABLE "readerAssignments" RENAME COLUMN payment_approved_at TO "paymentApprovedAt";
ALTER TABLE "readerAssignments" RENAME COLUMN payment_status TO "paymentStatus";
ALTER TABLE "readerAssignments" RENAME COLUMN payment_amount TO "paymentAmount";
ALTER TABLE "readerAssignments" RENAME COLUMN payment_method TO "paymentMethod";
ALTER TABLE "readerAssignments" RENAME COLUMN payment_reference TO "paymentReference";
ALTER TABLE "readerAssignments" RENAME COLUMN payment_processed_at TO "paymentProcessedAt";
ALTER TABLE "readerAssignments" RENAME COLUMN deadline_reminder_sent TO "deadlineReminderSent";
ALTER TABLE "readerAssignments" RENAME COLUMN deadline_reminder_sent_at TO "deadlineReminderSentAt";
ALTER TABLE "readerAssignments" RENAME COLUMN deadline_exceeded TO "deadlineExceeded";
ALTER TABLE "readerAssignments" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "readerAssignments" RENAME COLUMN assigned_by TO "assignedBy";
ALTER TABLE "readerAssignments" RENAME COLUMN updated_at TO "updatedAt";

-- Drop old indexes
DROP INDEX IF EXISTS idx_assignments_reader_pin;
DROP INDEX IF EXISTS idx_assignments_assignment_number;
DROP INDEX IF EXISTS idx_assignments_internal_case_pin;
DROP INDEX IF EXISTS idx_assignments_corrections_submitted;
DROP INDEX IF EXISTS idx_assignments_payment_status;
DROP INDEX IF EXISTS idx_assignments_deadline;

-- Create new indexes
CREATE INDEX "idxAssignmentsReaderPin" ON "readerAssignments"("readerPin");
CREATE INDEX "idxAssignmentsAssignmentNumber" ON "readerAssignments"("assignmentNumber");
CREATE INDEX "idxAssignmentsInternalCasePin" ON "readerAssignments"("internalCasePin");
CREATE INDEX "idxAssignmentsCorrectionsSubmitted" ON "readerAssignments"("correctionsSubmitted");
CREATE INDEX "idxAssignmentsPaymentStatus" ON "readerAssignments"("paymentStatus");
CREATE INDEX "idxAssignmentsDeadline" ON "readerAssignments"(deadline);

-- ==============================================
-- TABLE 3: READER_ACTIVITY_LOG - Rename Table & Columns
-- ==============================================

-- Rename table
ALTER TABLE reader_activity_log RENAME TO "readerActivityLog";

-- Rename columns
ALTER TABLE "readerActivityLog" RENAME COLUMN reader_pin TO "readerPin";
ALTER TABLE "readerActivityLog" RENAME COLUMN activity_type TO "activityType";
ALTER TABLE "readerActivityLog" RENAME COLUMN activity_description TO "activityDescription";
ALTER TABLE "readerActivityLog" RENAME COLUMN ip_address TO "ipAddress";
ALTER TABLE "readerActivityLog" RENAME COLUMN user_agent TO "userAgent";
ALTER TABLE "readerActivityLog" RENAME COLUMN related_assignment_id TO "relatedAssignmentId";
ALTER TABLE "readerActivityLog" RENAME COLUMN created_at TO "createdAt";

-- Drop old indexes
DROP INDEX IF EXISTS idx_activity_log_reader_pin;
DROP INDEX IF EXISTS idx_activity_log_activity_type;
DROP INDEX IF EXISTS idx_activity_log_created_at;

-- Create new indexes
CREATE INDEX "idxActivityLogReaderPin" ON "readerActivityLog"("readerPin");
CREATE INDEX "idxActivityLogActivityType" ON "readerActivityLog"("activityType");
CREATE INDEX "idxActivityLogCreatedAt" ON "readerActivityLog"("createdAt");

-- ==============================================
-- TABLE 4: READER_NDA_VERSIONS - Rename Table & Columns
-- ==============================================

-- Rename table
ALTER TABLE reader_nda_versions RENAME TO "readerNdaVersions";

-- Rename columns
ALTER TABLE "readerNdaVersions" RENAME COLUMN version_number TO "versionNumber";
ALTER TABLE "readerNdaVersions" RENAME COLUMN nda_template_path TO "ndaTemplatePath";
ALTER TABLE "readerNdaVersions" RENAME COLUMN effective_date TO "effectiveDate";
ALTER TABLE "readerNdaVersions" RENAME COLUMN is_current TO "isCurrent";
ALTER TABLE "readerNdaVersions" RENAME COLUMN created_at TO "createdAt";
ALTER TABLE "readerNdaVersions" RENAME COLUMN created_by TO "createdBy";

-- Drop old index
DROP INDEX IF EXISTS idx_nda_current_version;

-- Create new index
CREATE UNIQUE INDEX "idxNdaCurrentVersion" ON "readerNdaVersions"("isCurrent") WHERE "isCurrent" = TRUE;

-- ==============================================
-- UPDATE CHECK CONSTRAINTS
-- ==============================================

-- Drop old CHECK constraints and create new ones with camelCase

-- readers table
ALTER TABLE readers DROP CONSTRAINT IF EXISTS readers_reader_type_check;
ALTER TABLE readers ADD CONSTRAINT "readersReaderTypeCheck" CHECK ("readerType" IN ('firstReader', 'secondReader'));

ALTER TABLE readers DROP CONSTRAINT IF EXISTS readers_pin_access_token_status_check;
ALTER TABLE readers ADD CONSTRAINT "readersPinAccessTokenStatusCheck" CHECK ("pinAccessTokenStatus" IN ('pending', 'active', 'expired'));

ALTER TABLE readers DROP CONSTRAINT IF EXISTS readers_portal_access_status_check;
ALTER TABLE readers ADD CONSTRAINT "readersPortalAccessStatusCheck" CHECK ("portalAccessStatus" IN ('pending', 'active', 'onHold', 'suspended'));

-- readerAssignments table
ALTER TABLE "readerAssignments" DROP CONSTRAINT IF EXISTS reader_assignments_reader_type_check;
ALTER TABLE "readerAssignments" ADD CONSTRAINT "readerAssignmentsReaderTypeCheck" CHECK ("readerType" IN ('firstReader', 'secondReader'));

ALTER TABLE "readerAssignments" DROP CONSTRAINT IF EXISTS reader_assignments_payment_status_check;
ALTER TABLE "readerAssignments" ADD CONSTRAINT "readerAssignmentsPaymentStatusCheck" CHECK ("paymentStatus" IN ('pending', 'approved', 'processing', 'paid', 'onHold'));

-- ==============================================
-- UPDATE FUNCTIONS & TRIGGERS
-- ==============================================

-- Drop old triggers
DROP TRIGGER IF EXISTS update_readers_updated_at ON readers;
DROP TRIGGER IF EXISTS update_assignments_updated_at ON "readerAssignments";
DROP TRIGGER IF EXISTS set_deadline_on_assignment ON "readerAssignments";
DROP TRIGGER IF EXISTS calculate_turnaround_on_submission ON "readerAssignments";

-- Drop old functions
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS set_assignment_deadline();
DROP FUNCTION IF EXISTS calculate_turnaround_hours();

-- Create new functions with camelCase
CREATE OR REPLACE FUNCTION "updateUpdatedAtColumn"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "setAssignmentDeadline"()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deadline IS NULL THEN
        NEW.deadline = NEW."reportAssignedAt" + INTERVAL '24 hours';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "calculateTurnaroundHours"()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."correctionsSubmitted" = TRUE AND OLD."correctionsSubmitted" = FALSE THEN
        NEW."turnaroundHours" = EXTRACT(EPOCH FROM (NEW."correctionsSubmittedAt" - NEW."reportAssignedAt")) / 3600;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create new triggers
CREATE TRIGGER "updateReadersUpdatedAt"
    BEFORE UPDATE ON readers
    FOR EACH ROW
    EXECUTE FUNCTION "updateUpdatedAtColumn"();

CREATE TRIGGER "updateAssignmentsUpdatedAt"
    BEFORE UPDATE ON "readerAssignments"
    FOR EACH ROW
    EXECUTE FUNCTION "updateUpdatedAtColumn"();

CREATE TRIGGER "setDeadlineOnAssignment"
    BEFORE INSERT ON "readerAssignments"
    FOR EACH ROW
    EXECUTE FUNCTION "setAssignmentDeadline"();

CREATE TRIGGER "calculateTurnaroundOnSubmission"
    BEFORE UPDATE ON "readerAssignments"
    FOR EACH ROW
    EXECUTE FUNCTION "calculateTurnaroundHours"();

-- ==============================================
-- VERIFICATION QUERIES
-- ==============================================

-- Check that all tables exist with correct names
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('readers', 'readerAssignments', 'readerActivityLog', 'readerNdaVersions');

-- Check column names for readers table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'readers' 
ORDER BY ordinal_position;

COMMIT;

-- ==============================================
-- SUCCESS MESSAGE
-- ==============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration complete: snake_case → camelCase';
  RAISE NOTICE '📊 Tables migrated: readers, readerAssignments, readerActivityLog, readerNdaVersions';
  RAISE NOTICE '🔐 All constraints, indexes, and triggers updated';
  RAISE NOTICE '🎯 Convention: camelCase (Liz''s absolute)';
  RAISE NOTICE '⚠️  IMPORTANT: Restart PM2 servers after this migration!';
END $$;
