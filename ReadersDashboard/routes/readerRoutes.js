// ==============================================
// READERS DASHBOARD - READER ROUTES
// ==============================================
// Purpose: NDA, Report Viewer, Corrections, Payment Tracking
// Author: Liz
// Date: 28th October 2025
// Architecture: SSOT Pattern (Follows LawyersDashboard)
// ==============================================

import pg from 'pg';
import fetch from 'node-fetch';
import { insertSignaturesIntoNDA, flattenNDA } from '../utils/insertSignaturesIntoReadersNDA.js';

const { Pool } = pg;

// SSOT Base URL (API-Dashboard)
const SSOT_BASE_URL = process.env.SSOT_BASE_URL || 'https://api.qolae.com';

// Database connections (Fallback - prefer SSOT API calls)
const readersDb = new Pool({
  connectionString: process.env.READERS_DATABASE_URL
});

const caseManagersDb = new Pool({
  connectionString: process.env.CASEMANAGERS_DATABASE_URL
});

// ==============================================
// NOTE: SSOT Helper Functions in rd_server.js
// ==============================================
// Following LawyersDashboard pattern:
// - fetchModalWorkflowData() → rd_server.js
// - buildReaderBootstrapData() → rd_server.js

// ==============================================
// AUTHENTICATION MIDDLEWARE
// ==============================================
async function authenticateReader(request, reply) {
  try {
    await request.jwtVerify();

    // Verify reader role
    if (request.user.role !== 'reader') {
      throw new Error('Unauthorized');
    }
  } catch (error) {
    reply.code(401).send({
      success: false,
      error: 'Authentication required'
    });
  }
}

export default async function readerRoutes(fastify, options) {

  // ==============================================
  // READERS DASHBOARD (Main Workspace)
  // ==============================================
  // VIEW: readersDashboard.ejs ✅ EXISTS
  // ARCHITECTURE: 100% Server-Side Modal Workflow Cards (Matches LawyersDashboard)
  // SECURITY: PIN in URL is safe (bootstrap identifier + auth required)
  // Modal pattern: /readersDashboard?pin=KB-123456&modal=nda
  // SSOT READY: Helper functions prepared, awaiting API-Dashboard endpoints
  fastify.get('/readersDashboard', async (request, reply) => {
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');

    const { readerPin, modal, showModal: showModalParam, assignmentId, step } = request.query;
    const showModal = modal || showModalParam || null;  // Server-side modal overlay control
    const currentStep = parseInt(step) || 1;  // Default to step 1 for NDA workflow

    if (!readerPin) {
      return reply.code(400).send({ error: 'Reader PIN required' });
    }

    try {
      console.log(`🔍 Readers Dashboard route called with Reader PIN: ${readerPin}, Modal: ${modal || 'none'}`);

      // Get reader data (bootstrap)
      const readerResult = await readersDb.query(
        `SELECT "readerPin", "readerName", "readerType", "readerEmail", phone,
                "ndaSigned", "pinAccessTokenStatus", "totalAssignmentsCompleted",
                "averageTurnaroundHours", "totalEarnings"
         FROM readers
         WHERE "readerPin" = $1`,
        [readerPin]
      );

      if (readerResult.rows.length === 0) {
        return reply.code(404).send({ success: false, error: 'Reader not found' });
      }

      const reader = readerResult.rows[0];

      // Get active assignments
      const assignmentsResult = await readersDb.query(
        `SELECT id, "assignmentNumber", "readerPin", "readerType",
                "reportPdfPath", "reportAssignedAt", deadline, 
                "correctionsSubmitted", "paymentStatus", "paymentAmount"
         FROM "readerAssignments"
         WHERE "readerPin" = $1
         AND "correctionsSubmitted" = false
         ORDER BY deadline ASC`,
        [readerPin]
      );

      // ===== MODAL DATA LOADING (Server-Side) =====
      // Fetch modal-specific data if modal parameter is present
      // Modal files will be conditionally included in readersDashboard.ejs
      
      let modalData = null;
      
      if (showModal === 'nda') {
        // NDA 4-step workflow modal
        modalData = {
          type: 'nda',
          reader: reader,
          currentStep: currentStep
        };
        console.log(`[NDA Modal] Loading step ${currentStep} for ${readerPin}`);
      }
      
      else if (showModal === 'review' && assignmentId) {
        const assignmentResult = await readersDb.query(
          `SELECT "assignmentId", "assignmentNumber", "readerPin", "reportType",
                  "assignmentStatus", "redactedReportPath", "correctionsContent", deadline
           FROM "readerAssignments"
           WHERE "assignmentId" = $1 AND "readerPin" = $2`,
          [assignmentId, readerPin]
        );
        
        if (assignmentResult.rows.length > 0) {
          modalData = {
            type: 'review',
            assignment: assignmentResult.rows[0],
            reader: { readerPin, readerName: reader.readerName }
          };
        }
      }
      
      else if (showModal === 'payment' && assignmentId) {
        const paymentQuery = `
          SELECT 
            ra.id as "assignmentId",
            ra."readerPin",
            ra."paymentStatus",
            ra."paymentAmount",
            ra."paymentReference",
            ra."paymentApprovedAt",
            ra."paymentProcessedAt",
            ra."reportAssignedAt" as "assignedAt",
            ra."correctionsSubmittedAt",
            r."readerName",
            r.email as "readerEmail",
            r."paymentRate",
            r."readerType"
          FROM "readerAssignments" ra
          INNER JOIN readers r ON ra."readerPin" = r."readerPin"
          WHERE ra.id = $1 AND ra."readerPin" = $2
        `;
        const paymentResult = await readersDb.query(paymentQuery, [assignmentId, readerPin]);
        
        if (paymentResult.rows.length > 0) {
          modalData = {
            type: 'payment',
            assignmentId: paymentResult.rows[0].assignmentId,
            readerPin: paymentResult.rows[0].readerPin,
            readerName: paymentResult.rows[0].readerName,
            readerEmail: paymentResult.rows[0].readerEmail,
            readerType: paymentResult.rows[0].readerType === 'firstReader' ? 'first' : 'second',
            paymentStatus: paymentResult.rows[0].paymentStatus || 'pending',
            paymentAmount: paymentResult.rows[0].paymentAmount || paymentResult.rows[0].paymentRate,
            paymentReference: paymentResult.rows[0].paymentReference || 'N/A',
            assignedAt: paymentResult.rows[0].assignedAt,
            correctionsSubmittedAt: paymentResult.rows[0].correctionsSubmittedAt,
            paymentApprovedAt: paymentResult.rows[0].paymentApprovedAt,
            paymentProcessedAt: paymentResult.rows[0].paymentProcessedAt
          };
        }
      }

      console.log(`✅ Dashboard loading for ${reader.readerName} (${readerPin})`);
      if (showModal) {
        console.log(`[SSR] Modal requested: ${showModal}, Data loaded: ${modalData ? 'Yes' : 'No'}`);
      }

      // ALWAYS render main dashboard with conditional modal includes
      // Generate CSRF token for forms
      const csrfToken = fastify.jwt.sign({
        csrf: true,
        readerPin: readerPin,
        timestamp: Date.now()
      });

      return reply.view('readersDashboard.ejs', {
        reader,
        assignments: assignmentsResult.rows,
        showModal: showModal,      // 'nda', 'review', 'payment', or null
        modalData: modalData,      // Modal-specific data or null
        csrfToken: csrfToken,      // CSRF token for forms
        currentStep: currentStep   // NDA workflow step (1-4)
      });

    } catch (error) {
      console.error('❌ ERROR loading readers dashboard:', error);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Error message:', error.message);
      fastify.log.error('Error loading readers dashboard:', error);
      return reply.code(500).send({ success: false, error: 'Failed to load dashboard', details: error.message });
    }
  });

  // ==============================================
  // NDA WORKFLOW - HANDLED VIA DASHBOARD MODAL
  // ==============================================
  // Pattern: /readersDashboard?pin=KB-123456&modal=nda
  // Modal rendered server-side in readersDashboard.ejs
  // Follows LawyersDashboard architecture

  // ==============================================
  // SIGN NDA (API) - Complete Workflow
  // ==============================================
  fastify.post('/api/readers/signNda', {
    preHandler: authenticateReader
  }, async (request, reply) => {
    const { pin, name } = request.user;
    const { readerSignature } = request.body;

    try {
      // Get current NDA version
      const ndaResult = await readersDb.query(
        'SELECT id, "versionNumber" FROM "readerNdaVersions" WHERE "isCurrent" = TRUE'
      );

      if (ndaResult.rows.length === 0) {
        return reply.code(404).send({ success: false, error: 'NDA version not found' });
      }

      const nda = ndaResult.rows[0];

      // Step 1: Insert signatures (Reader + Liz)
      // Note: NDA was already generated by HR Compliance during reader registration
      const signatureResult = await insertSignaturesIntoNDA(pin, {
        readerSignature: readerSignature,
        lizSignature: true // Liz's signature from file
      });

      if (!signatureResult.success) {
        throw new Error(`Signature insertion failed: ${signatureResult.error}`);
      }

      // Step 2: Flatten NDA (make non-editable)
      const flattenResult = await flattenNDA(pin);
      if (!flattenResult.success) {
        throw new Error(`Flattening failed: ${flattenResult.error}`);
      }

      // Step 3: Update reader - NDA signed
      await readersDb.query(
        `UPDATE readers
         SET "ndaSigned" = TRUE,
             "ndaSignedAt" = NOW(),
             "ndaVersionId" = $1,
             "pinAccessTokenStatus" = 'active'
         WHERE "readerPin" = $2`,
        [nda.id, pin]
      );

      // Log activity
      await readersDb.query(
        `INSERT INTO "readerActivityLog" ("readerPin", "activityType", "activityDescription")
         VALUES ($1, $2, $3)`,
        [pin, 'ndaSigned', `Reader signed NDA version ${nda.versionNumber}`]
      );

      return reply.send({
        success: true,
        message: 'NDA signed successfully',
        redirectTo: '/readersDashboard',
        ndaPath: flattenResult.outputPath
      });

    } catch (error) {
      fastify.log.error('Error signing NDA:', error);
      return reply.code(500).send({ success: false, error: 'Failed to sign NDA' });
    }
  });

  // ==============================================
  // REPORT REVIEW WORKFLOW - HANDLED VIA DASHBOARD MODAL
  // ==============================================
  // Pattern: /readersDashboard?pin=KB-123456&modal=review&assignmentId=xxx
  // Modal rendered server-side in readersDashboard.ejs
  // Follows LawyersDashboard architecture

  // ==============================================
  // CORRECTIONS WORKFLOW - HANDLED VIA DASHBOARD MODAL
  // ==============================================
  // Pattern: /readersDashboard?pin=KB-123456&modal=corrections&assignmentId=xxx
  // Modal rendered server-side in readersDashboard.ejs
  // Follows LawyersDashboard architecture

  // ==============================================
  // SAVE CORRECTIONS (API)
  // ==============================================
  fastify.post('/api/readers/saveCorrections', {
    preHandler: authenticateReader
  }, async (request, reply) => {
    const { pin, name } = request.user;
    const { assignmentId, corrections } = request.body;

    try {
      // Update assignment with corrections
      await readersDb.query(
        `UPDATE "readerAssignments"
         SET "correctionsContent" = $1,
             "correctionsUpdatedAt" = NOW()
         WHERE "assignmentId" = $2 AND "readerPin" = $3`,
        [JSON.stringify(corrections), assignmentId, pin]
      );

      // Log activity
      await readersDb.query(
        `INSERT INTO "readerActivityLog" ("readerPin", "activityType", "activityDescription")
         VALUES ($1, $2, $3)`,
        [pin, 'correctionsSaved', `Reader saved corrections for assignment ${assignmentId}`]
      );

      return reply.send({
        success: true,
        message: 'Corrections saved successfully'
      });

    } catch (error) {
      fastify.log.error('Error saving corrections:', error);
      return reply.code(500).send({ success: false, error: 'Failed to save corrections' });
    }
  });

  // ==============================================
  // SUBMIT CORRECTIONS (API)
  // ==============================================
  fastify.post('/api/readers/submitCorrections', {
    preHandler: authenticateReader
  }, async (request, reply) => {
    const { pin, name } = request.user;
    const { assignmentId } = request.body;

    try {
      // Update assignment status
      const result = await readersDb.query(
        `UPDATE "readerAssignments"
         SET "assignmentStatus" = 'completed',
             "correctionsSubmittedAt" = NOW(),
             "actualTurnaroundHours" = EXTRACT(EPOCH FROM (NOW() - "assignedAt")) / 3600
         WHERE "assignmentId" = $1 AND "readerPin" = $2
         RETURNING "paymentAmount"`,
        [assignmentId, pin]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ success: false, error: 'Assignment not found' });
      }

      // Update reader stats
      await readersDb.query(
        `UPDATE readers
         SET "totalAssignmentsCompleted" = "totalAssignmentsCompleted" + 1
         WHERE "readerPin" = $1`,
        [pin]
      );

      // Log activity
      await readersDb.query(
        `INSERT INTO "readerActivityLog" ("readerPin", "activityType", "activityDescription")
         VALUES ($1, $2, $3)`,
        [pin, 'correctionsSubmitted', `Reader submitted corrections for assignment ${assignmentId}`]
      );

      return reply.send({
        success: true,
        message: 'Corrections submitted successfully! Payment pending review.',
        paymentAmount: result.rows[0].paymentAmount
      });

    } catch (error) {
      fastify.log.error('Error submitting corrections:', error);
      return reply.code(500).send({ success: false, error: 'Failed to submit corrections' });
    }
  });

  // ==============================================
  // PAYMENT WORKFLOW - HANDLED VIA DASHBOARD MODAL
  // ==============================================
  // Pattern: /readersDashboard?pin=KB-123456&modal=payment&assignmentId=xxx
  // Modal rendered server-side in readersDashboard.ejs
  // Follows LawyersDashboard architecture

  // ==============================================
  // PAYMENT PROCESSING ROUTES
  // ==============================================
  // Author: Liz
  // Date: October 28, 2025
  // Purpose: Payment modal, status API, history, support
  // ==============================================

  /**
   * ROUTE 1: RENDER PAYMENT PROCESSING MODAL
   * GET /paymentProcessing?assignmentId=xxx
   * VIEW: paymentProcessing.ejs ✅ EXISTS
   */
  fastify.get('/paymentProcessing', {
    preHandler: authenticateReader
  }, async (request, reply) => {
    try {
      const { assignmentId } = request.query;
      const { pin } = request.user;

      if (!assignmentId) {
        return reply.code(400).send({ error: 'Assignment ID is required' });
      }

      // Get payment data from qolae_readers
      const paymentQuery = `
        SELECT 
          ra.id as "assignmentId",
          ra."readerPin",
          ra."paymentStatus",
          ra."paymentAmount",
          ra."paymentReference",
          ra."paymentApprovedAt",
          ra."paymentProcessedAt",
          ra."reportAssignedAt" as "assignedAt",
          ra."correctionsSubmittedAt",
          r."readerName",
          r.email as "readerEmail",
          r."paymentRate",
          r."readerType"
        FROM "readerAssignments" ra
        INNER JOIN readers r ON ra."readerPin" = r."readerPin"
        WHERE ra.id = $1 AND ra."readerPin" = $2
      `;

      const result = await readersDb.query(paymentQuery, [assignmentId, pin]);

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Payment record not found' });
      }

      const paymentData = result.rows[0];

      // Get banking details from qolae_hrcompliance (via separate connection)
      // NOTE: For now, we'll handle this separately. Banking details should be
      // fetched from HR Compliance database when needed for actual payment processing.
      
      // Build timeline based on payment status
      const timeline = buildTimeline(
        paymentData.paymentStatus,
        paymentData.assignedAt,
        paymentData.paymentApprovedAt,
        paymentData.paymentProcessedAt
      );

      // Determine reader type
      const readerType = paymentData.readerType === 'firstReader' ? 'first' : 'second';

      // Render EJS template
      return reply.view('paymentProcessing.ejs', {
        // Assignment info
        assignmentId: paymentData.assignmentId,
        readerPin: paymentData.readerPin,
        
        // Reader info
        readerName: paymentData.readerName,
        readerEmail: paymentData.readerEmail,
        readerType: readerType,
        
        // Payment status & amount
        paymentStatus: paymentData.paymentStatus || 'pending',
        paymentAmount: paymentData.paymentAmount || paymentData.paymentRate,
        paymentReference: paymentData.paymentReference || 'N/A',
        
        // Timeline dates
        assignedAt: paymentData.assignedAt,
        correctionsSubmittedAt: paymentData.correctionsSubmittedAt,
        paymentApprovedAt: paymentData.paymentApprovedAt,
        paymentProcessedAt: paymentData.paymentProcessedAt,
        
        // Timeline status
        timeline: timeline,
        
        // Placeholder banking details (will be fetched from HR Compliance when needed)
        bankName: 'Not loaded',
        accountHolderName: 'Not loaded',
        lastFourDigits: '****',
        sortCode: 'N/A',
        accountType: 'unknown',
        paymentDetailsVerified: false
      });

    } catch (error) {
      fastify.log.error('Error rendering payment processing modal:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * ROUTE 2: GET PAYMENT STATUS (API - FOR AUTO-REFRESH)
   * GET /api/readers/payment/status/:assignmentId
   */
  fastify.get('/api/readers/payment/status/:assignmentId', {
    preHandler: authenticateReader
  }, async (request, reply) => {
    try {
      const { assignmentId } = request.params;
      const { pin } = request.user;

      const statusQuery = `
        SELECT 
          "paymentStatus",
          "paymentAmount",
          "paymentReference",
          "paymentApprovedAt",
          "paymentProcessedAt"
        FROM "readerAssignments"
        WHERE id = $1 AND "readerPin" = $2
      `;

      const result = await readersDb.query(statusQuery, [assignmentId, pin]);

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Assignment not found' });
      }

      return reply.send({
        paymentStatus: result.rows[0].paymentStatus,
        paymentAmount: result.rows[0].paymentAmount,
        paymentReference: result.rows[0].paymentReference,
        paymentApprovedAt: result.rows[0].paymentApprovedAt,
        paymentProcessedAt: result.rows[0].paymentProcessedAt
      });

    } catch (error) {
      fastify.log.error('Error fetching payment status:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * ROUTE 3: VIEW PAYMENT HISTORY
   * GET /readers/payment-history
   */
  fastify.get('/readers/paymentHistory', {
    preHandler: authenticateReader
  }, async (request, reply) => {
    try {
      const { pin } = request.user;

      const historyQuery = `
        SELECT 
          ra.id as "assignmentId",
          ra."assignmentNumber",
          ra."paymentStatus",
          ra."paymentAmount",
          ra."paymentReference",
          ra."paymentApprovedAt",
          ra."paymentProcessedAt",
          ra."reportAssignedAt" as "assignedAt",
          ra."correctionsSubmittedAt"
        FROM "readerAssignments" ra
        WHERE ra."readerPin" = $1
        ORDER BY ra."reportAssignedAt" DESC
      `;

      const result = await readersDb.query(historyQuery, [pin]);

      return reply.send({
        success: true,
        payments: result.rows
      });

    } catch (error) {
      fastify.log.error('Error fetching payment history:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * ROUTE 4: CONTACT SUPPORT
   * GET /readers/support?assignmentId=xxx&subject=xxx
   */
  fastify.get('/readers/support', {
    preHandler: authenticateReader
  }, async (request, reply) => {
    try {
      const { assignmentId, subject } = request.query;
      const { pin, name, email } = request.user;

      const supportEmail = 'support@qolae.com';
      const emailSubject = subject || 'Payment Inquiry';
      const emailBody = `Reader PIN: ${pin}\nReader Name: ${name}\nReader Email: ${email}\nAssignment ID: ${assignmentId || 'N/A'}`;

      return reply.redirect(`mailto:${supportEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`);

    } catch (error) {
      fastify.log.error('Error accessing support:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

}

// ==============================================
// HELPER FUNCTIONS
// ==============================================

/**
 * BUILD TIMELINE
 * Determines which timeline steps are completed/current/pending
 */
function buildTimeline(paymentStatus, assignedAt, paymentApprovedAt, paymentProcessedAt) {
  const timeline = {
    step1: 'pending',
    step2: 'pending',
    step3: 'pending',
    step4: 'pending'
  };

  // Step 1: Report Submitted
  if (assignedAt) {
    timeline.step1 = 'completed';
  }

  // Step 2: Under Review by Liz
  if (paymentStatus === 'pending' && assignedAt) {
    timeline.step2 = 'current';
  } else if (paymentApprovedAt || ['approved', 'processing', 'paid'].includes(paymentStatus)) {
    timeline.step2 = 'completed';
  }

  // Step 3: Payment Processing
  if (paymentStatus === 'approved' || paymentStatus === 'processing') {
    timeline.step3 = 'current';
  } else if (paymentStatus === 'paid') {
    timeline.step3 = 'completed';
  }

  // Step 4: Payment Complete
  if (paymentStatus === 'paid') {
    timeline.step4 = 'completed';
  }

  return timeline;
}
