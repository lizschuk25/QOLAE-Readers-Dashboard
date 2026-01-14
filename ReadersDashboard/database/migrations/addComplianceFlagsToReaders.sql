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
  ADD COLUMN IF NOT EXISTS "complianceSubmitted" BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "complianceSubmittedAt" TIMESTAMP;

-- Create index for quick lookup of readers who haven't submitted compliance
CREATE INDEX IF NOT EXISTS "idxReadersComplianceSubmitted" 
  ON readers("complianceSubmitted");

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON COLUMN readers."complianceSubmitted" IS 
  'TRUE if reader has submitted HR compliance (CV + references). Used as gate to dashboard access.';

COMMENT ON COLUMN readers."complianceSubmittedAt" IS 
  'Timestamp when reader submitted their compliance documents.';

-- ==============================================
-- USAGE
-- ==============================================
-- Middleware in Readers Dashboard will check:
-- IF "complianceSubmitted" = FALSE → redirect to /compliance
-- IF "complianceSubmitted" = TRUE → allow access to dashboard
--
-- After compliance submission:
-- UPDATE readers 
-- SET "complianceSubmitted" = TRUE, 
--     "complianceSubmittedAt" = CURRENT_TIMESTAMP
-- WHERE "readerPin" = 'JS-123456';
-- ==============================================

-- ==============================================
-- MIGRATION COMPLETE ✅
-- ==============================================

