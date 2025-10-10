-- ==============================================
-- MIGRATION: Add Compliance Tracking to Readers Table
-- ==============================================
-- Purpose: Add flags to track reader compliance submission status
-- Author: Liz
-- Date: October 10, 2025
-- Database: qolae_readers
-- ==============================================

-- Connect to qolae_readers database
-- \c qolae_readers;

-- Add compliance tracking columns to readers table
ALTER TABLE readers 
  ADD COLUMN IF NOT EXISTS compliance_submitted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS compliance_submitted_at TIMESTAMP;

-- Create index for quick lookup of readers who haven't submitted compliance
CREATE INDEX IF NOT EXISTS idx_readers_compliance_submitted 
  ON readers(compliance_submitted);

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON COLUMN readers.compliance_submitted IS 
  'TRUE if reader has submitted HR compliance (CV + references). Used as gate to dashboard access.';

COMMENT ON COLUMN readers.compliance_submitted_at IS 
  'Timestamp when reader submitted their compliance documents.';

-- ==============================================
-- USAGE
-- ==============================================
-- Middleware in Readers Dashboard will check:
-- IF compliance_submitted = FALSE → redirect to /compliance
-- IF compliance_submitted = TRUE → allow access to dashboard
--
-- After compliance submission:
-- UPDATE readers 
-- SET compliance_submitted = TRUE, 
--     compliance_submitted_at = CURRENT_TIMESTAMP
-- WHERE reader_pin = 'RDR-XX123456';
-- ==============================================

-- ==============================================
-- MIGRATION COMPLETE ✅
-- ==============================================

