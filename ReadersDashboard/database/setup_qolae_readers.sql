-- ==============================================
-- QOLAE READERS DATABASE SCHEMA
-- ==============================================
-- Purpose: Manages reader registration, authentication, NDA tracking,
--          report assignments, and payment workflows
-- Author: Liz
-- Date: October 7, 2025
-- Database: qolae_readers (separate from lawyers and admin)
-- ==============================================

-- Create database (run this first if needed)
-- CREATE DATABASE qolae_readers;

-- Connect to database
-- \c qolae_readers;

-- ==============================================
-- TABLE 1: READERS (Master Registry)
-- ==============================================
-- Stores reader identity, authentication, NDA status, and payment rates
-- Reader PIN is their unique identifier (e.g., RDR-JS123456)
-- NO case information stored here (confidentiality/GDPR)
-- ==============================================

CREATE TABLE IF NOT EXISTS readers (
  -- Primary Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reader_pin VARCHAR(20) UNIQUE NOT NULL, -- e.g., "RDR-JS123456"

  -- Personal Information
  reader_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),

  -- Reader Classification
  reader_type VARCHAR(50) NOT NULL CHECK (reader_type IN ('first_reader', 'second_reader')),
  specialization VARCHAR(255), -- For medical readers (e.g., "Registered Nurse", "Physician")

  -- Medical Professional Verification (for second readers only)
  registration_body VARCHAR(50), -- 'NMC', 'GMC', 'Other'
  registration_number VARCHAR(50), -- e.g., '12A3456E'
  registration_verified BOOLEAN DEFAULT FALSE,
  registration_verified_at TIMESTAMP,
  registration_verified_by VARCHAR(255), -- 'Liz' or case manager who verified

  -- Payment Configuration
  payment_rate DECIMAL(10, 2) DEFAULT 50.00, -- £50.00 for first reader, £75-100 for second

  -- Authentication & Security
  password_hash TEXT, -- Bcrypt hashed password
  pin_access_token_status VARCHAR(20) DEFAULT 'pending' CHECK (pin_access_token_status IN ('pending', 'active', 'expired')),
  password_setup_completed BOOLEAN DEFAULT FALSE,
  jwt_session_token TEXT, -- Current JWT token

  -- 2FA Verification
  email_verification_code VARCHAR(6), -- 6-digit code
  email_verification_code_expires_at TIMESTAMP,
  email_verification_code_attempts INT DEFAULT 0,

  -- NDA Workflow Status
  nda_signed BOOLEAN DEFAULT FALSE,
  nda_signed_at TIMESTAMP,
  nda_pdf_path VARCHAR(500), -- Path to signed NDA: /central-repository/signed-nda/NDA_{READER_PIN}_Signed.pdf

  -- Portal Access Control
  portal_access_status VARCHAR(50) DEFAULT 'pending' CHECK (portal_access_status IN ('pending', 'active', 'on_hold', 'suspended')),

  -- Performance Tracking
  total_assignments_completed INT DEFAULT 0,
  average_turnaround_hours DECIMAL(5, 2), -- Average time to submit corrections
  total_earnings DECIMAL(10, 2) DEFAULT 0.00,

  -- GDPR & Audit Trail
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NOT NULL, -- 'Liz' or other case manager name
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  last_login_ip VARCHAR(50),

  -- Indexes for performance
  CONSTRAINT readers_email_key UNIQUE (email),
  CONSTRAINT readers_reader_pin_key UNIQUE (reader_pin)
);

-- Indexes for readers table
CREATE INDEX idx_readers_reader_pin ON readers(reader_pin);
CREATE INDEX idx_readers_email ON readers(email);
CREATE INDEX idx_readers_reader_type ON readers(reader_type);
CREATE INDEX idx_readers_portal_access_status ON readers(portal_access_status);
CREATE INDEX idx_readers_nda_signed ON readers(nda_signed);

-- ==============================================
-- TABLE 2: READER_ASSIGNMENTS (Report Tracking)
-- ==============================================
-- Links readers to report assignments while maintaining confidentiality
-- Assignment number is visible to reader (e.g., "Assignment #47")
-- Internal case PIN stays hidden from reader (GDPR compliance)
-- ==============================================

CREATE TABLE IF NOT EXISTS reader_assignments (
  -- Primary Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_number SERIAL UNIQUE, -- Auto-incrementing: 1, 2, 3... (visible to reader as "Assignment #47")

  -- Reader Information (by PIN only, no personal data)
  reader_pin VARCHAR(20) NOT NULL REFERENCES readers(reader_pin) ON DELETE CASCADE,
  reader_type VARCHAR(50) NOT NULL CHECK (reader_type IN ('first_reader', 'second_reader')),

  -- Internal Case Tracking (NOT visible to reader)
  internal_case_pin VARCHAR(20), -- e.g., "MT-123456" (Case Manager sees this, reader doesn't)
  internal_case_description TEXT, -- Internal notes for case manager

  -- Report Assignment Details
  report_pdf_path VARCHAR(500), -- Path to redacted report
  report_assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deadline TIMESTAMP, -- 24 hours from assignment (auto-calculated)

  -- Reader Submission
  corrections_submitted BOOLEAN DEFAULT FALSE,
  corrections_submitted_at TIMESTAMP,
  corrections_file_path VARCHAR(500), -- Path to reader's corrected file
  corrections_notes TEXT, -- Reader's notes about corrections
  turnaround_hours DECIMAL(5, 2), -- Calculated: submitted_at - assigned_at

  -- Case Manager Review (Manual Approval)
  corrections_reviewed_by_cm BOOLEAN DEFAULT FALSE,
  corrections_reviewed_at TIMESTAMP,
  corrections_reviewed_by VARCHAR(255), -- 'Liz' or other CM
  corrections_approved BOOLEAN DEFAULT FALSE, -- TRUE = quality approved, FALSE = needs revision
  cm_feedback TEXT, -- Case manager's feedback to reader

  -- Payment Workflow (After CM Approval)
  payment_approved BOOLEAN DEFAULT FALSE,
  payment_approved_by VARCHAR(255), -- 'Liz'
  payment_approved_at TIMESTAMP,
  payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'approved', 'processing', 'paid', 'on_hold')),
  payment_amount DECIMAL(10, 2), -- £50.00 or £75-100
  payment_method VARCHAR(50), -- 'bank_transfer', 'paypal', etc.
  payment_reference VARCHAR(100), -- Payment transaction reference
  payment_processed_at TIMESTAMP,

  -- Deadline Tracking
  deadline_reminder_sent BOOLEAN DEFAULT FALSE,
  deadline_reminder_sent_at TIMESTAMP,
  deadline_exceeded BOOLEAN DEFAULT FALSE,

  -- Audit Trail
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by VARCHAR(255) NOT NULL, -- 'Liz'
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for reader_assignments table
CREATE INDEX idx_assignments_reader_pin ON reader_assignments(reader_pin);
CREATE INDEX idx_assignments_assignment_number ON reader_assignments(assignment_number);
CREATE INDEX idx_assignments_internal_case_pin ON reader_assignments(internal_case_pin);
CREATE INDEX idx_assignments_corrections_submitted ON reader_assignments(corrections_submitted);
CREATE INDEX idx_assignments_payment_status ON reader_assignments(payment_status);
CREATE INDEX idx_assignments_deadline ON reader_assignments(deadline);

-- ==============================================
-- TABLE 3: READER_ACTIVITY_LOG (GDPR Audit Trail)
-- ==============================================
-- Tracks all reader actions for security and compliance
-- Required for GDPR audit trails
-- ==============================================

CREATE TABLE IF NOT EXISTS reader_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reader_pin VARCHAR(20) NOT NULL REFERENCES readers(reader_pin) ON DELETE CASCADE,

  -- Activity Details
  activity_type VARCHAR(100) NOT NULL, -- 'login', 'nda_signed', 'report_downloaded', 'corrections_submitted', etc.
  activity_description TEXT,
  ip_address VARCHAR(50),
  user_agent TEXT,

  -- Context
  related_assignment_id UUID REFERENCES reader_assignments(id) ON DELETE SET NULL,

  -- Timestamp
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for activity log
CREATE INDEX idx_activity_log_reader_pin ON reader_activity_log(reader_pin);
CREATE INDEX idx_activity_log_activity_type ON reader_activity_log(activity_type);
CREATE INDEX idx_activity_log_created_at ON reader_activity_log(created_at);

-- ==============================================
-- TABLE 4: READER_NDA_VERSIONS (NDA Template Tracking)
-- ==============================================
-- Tracks different versions of NDA template
-- Ensures readers sign current version
-- ==============================================

CREATE TABLE IF NOT EXISTS reader_nda_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number VARCHAR(20) NOT NULL UNIQUE, -- e.g., "v1.0", "v2.0"
  nda_template_path VARCHAR(500) NOT NULL, -- Path to NDA template PDF
  effective_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT TRUE,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NOT NULL -- 'Liz'
);

-- Only one current version allowed
CREATE UNIQUE INDEX idx_nda_current_version ON reader_nda_versions(is_current) WHERE is_current = TRUE;

-- ==============================================
-- FUNCTIONS & TRIGGERS
-- ==============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for readers table
CREATE TRIGGER update_readers_updated_at
    BEFORE UPDATE ON readers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for reader_assignments table
CREATE TRIGGER update_assignments_updated_at
    BEFORE UPDATE ON reader_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-calculate deadline (24 hours from assignment)
CREATE OR REPLACE FUNCTION set_assignment_deadline()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deadline IS NULL THEN
        NEW.deadline = NEW.report_assigned_at + INTERVAL '24 hours';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set deadline automatically
CREATE TRIGGER set_deadline_on_assignment
    BEFORE INSERT ON reader_assignments
    FOR EACH ROW
    EXECUTE FUNCTION set_assignment_deadline();

-- Auto-calculate turnaround hours when corrections submitted
CREATE OR REPLACE FUNCTION calculate_turnaround_hours()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.corrections_submitted = TRUE AND OLD.corrections_submitted = FALSE THEN
        NEW.turnaround_hours = EXTRACT(EPOCH FROM (NEW.corrections_submitted_at - NEW.report_assigned_at)) / 3600;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to calculate turnaround
CREATE TRIGGER calculate_turnaround_on_submission
    BEFORE UPDATE ON reader_assignments
    FOR EACH ROW
    EXECUTE FUNCTION calculate_turnaround_hours();

-- ==============================================
-- INITIAL DATA
-- ==============================================

-- Insert current NDA version
INSERT INTO reader_nda_versions (version_number, nda_template_path, effective_date, is_current, created_by)
VALUES ('v1.0', '/central-repository/original/TemplateNDA.pdf', CURRENT_DATE, TRUE, 'Liz')
ON CONFLICT (version_number) DO NOTHING;

-- ==============================================
-- USEFUL QUERIES FOR CASE MANAGERS DASHBOARD
-- ==============================================

-- View all active readers
-- SELECT reader_pin, reader_name, reader_type, portal_access_status, nda_signed, total_assignments_completed
-- FROM readers
-- WHERE portal_access_status = 'active'
-- ORDER BY reader_type, reader_name;

-- View pending payment approvals
-- SELECT
--   ra.assignment_number,
--   ra.reader_pin,
--   r.reader_name,
--   ra.corrections_submitted_at,
--   ra.payment_amount,
--   ra.internal_case_pin
-- FROM reader_assignments ra
-- JOIN readers r ON ra.reader_pin = r.reader_pin
-- WHERE ra.corrections_submitted = TRUE
--   AND ra.corrections_approved = FALSE
-- ORDER BY ra.corrections_submitted_at ASC;

-- View reader performance stats
-- SELECT
--   reader_pin,
--   reader_name,
--   reader_type,
--   total_assignments_completed,
--   average_turnaround_hours,
--   total_earnings
-- FROM readers
-- WHERE total_assignments_completed > 0
-- ORDER BY total_assignments_completed DESC;

-- ==============================================
-- SCHEMA COMPLETE ✅
-- ==============================================
-- Next Steps:
-- 1. Run this SQL file on PostgreSQL server
-- 2. Create readers-registration-card.ejs in CaseManagers Dashboard
-- 3. Build Reader PIN generator in CaseManagersController.js
-- 4. Create API endpoints in caseManagerRoutes.js
-- 5. Integrate email invitation system
-- ==============================================
