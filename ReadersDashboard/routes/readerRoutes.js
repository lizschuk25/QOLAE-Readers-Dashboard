// ==============================================
// READERS DASHBOARD - READER ROUTES
// ==============================================
// Purpose: NDA, Report Viewer, Corrections, Payment Tracking
// Author: Liz
// Date: October 7, 2025
// ==============================================

import pg from 'pg';
import { generateCustomizedNDA, insertSignaturesIntoNDA, flattenNDA } from '../utils/generateCustomizedNDA.js';

const { Pool } = pg;

// Database connections
const readersDb = new Pool({
  connectionString: process.env.READERS_DATABASE_URL
});

const caseManagersDb = new Pool({
  connectionString: process.env.CASEMANAGERS_DATABASE_URL
});

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
  fastify.get('/readers-dashboard', {
    preHandler: authenticateReader
  }, async (request, reply) => {
    const { pin, name, type } = request.user;

    try {
      // Get reader data
      const readerResult = await readersDb.query(
        `SELECT reader_pin, reader_name, reader_type, email, phone,
                nda_signed, portal_access_status, total_assignments_completed,
                average_turnaround_hours, total_earnings
         FROM readers
         WHERE reader_pin = $1`,
        [pin]
      );

      if (readerResult.rows.length === 0) {
        return reply.code(404).send({ success: false, error: 'Reader not found' });
      }

      const reader = readerResult.rows[0];

      // Get active assignments
      const assignmentsResult = await readersDb.query(
        `SELECT assignment_id, assignment_number, report_type,
                assigned_at, deadline, assignment_status, payment_amount
         FROM reader_assignments
         WHERE reader_pin = $1
         AND assignment_status IN ('pending', 'in_progress')
         ORDER BY deadline ASC`,
        [pin]
      );

      return reply.view('readers-dashboard.ejs', {
        reader,
        assignments: assignmentsResult.rows
      });

    } catch (error) {
      fastify.log.error('Error loading readers dashboard:', error);
      return reply.code(500).send({ success: false, error: 'Failed to load dashboard' });
    }
  });

  // ==============================================
  // NDA REVIEW PAGE
  // ==============================================
  fastify.get('/nda-review', {
    preHandler: authenticateReader
  }, async (request, reply) => {
    const { pin, name, type } = request.user;

    try {
      // Get reader data
      const readerResult = await readersDb.query(
        'SELECT reader_pin, reader_name, nda_signed FROM readers WHERE reader_pin = $1',
        [pin]
      );

      if (readerResult.rows.length === 0) {
        return reply.code(404).send({ success: false, error: 'Reader not found' });
      }

      const reader = readerResult.rows[0];

      // Get current NDA version
      const ndaResult = await readersDb.query(
        'SELECT version_number, effective_date, nda_content FROM reader_nda_versions WHERE is_current = TRUE'
      );

      return reply.view('nda-review.ejs', {
        reader,
        nda: ndaResult.rows[0]
      });

    } catch (error) {
      fastify.log.error('Error loading NDA review:', error);
      return reply.code(500).send({ success: false, error: 'Failed to load NDA' });
    }
  });

  // ==============================================
  // GENERATE CUSTOMIZED NDA (API)
  // ==============================================
  fastify.post('/api/readers/generate-nda', {
    preHandler: authenticateReader
  }, async (request, reply) => {
    const { pin } = request.user;

    try {
      // Generate customized NDA with reader's name, date, PIN
      const result = await generateCustomizedNDA(pin);

      if (!result.success) {
        return reply.code(500).send({ success: false, error: result.error });
      }

      return reply.send({
        success: true,
        message: 'NDA generated successfully',
        outputPath: result.outputPath
      });

    } catch (error) {
      fastify.log.error('Error generating NDA:', error);
      return reply.code(500).send({ success: false, error: 'Failed to generate NDA' });
    }
  });

  // ==============================================
  // SIGN NDA (API) - Complete Workflow
  // ==============================================
  fastify.post('/api/readers/sign-nda', {
    preHandler: authenticateReader
  }, async (request, reply) => {
    const { pin, name } = request.user;
    const { readerSignature } = request.body;

    try {
      // Get current NDA version
      const ndaResult = await readersDb.query(
        'SELECT id, version_number FROM reader_nda_versions WHERE is_current = TRUE'
      );

      if (ndaResult.rows.length === 0) {
        return reply.code(404).send({ success: false, error: 'NDA version not found' });
      }

      const nda = ndaResult.rows[0];

      // Step 1: Generate customized NDA (if not already generated)
      const generateResult = await generateCustomizedNDA(pin);
      if (!generateResult.success) {
        throw new Error(`NDA generation failed: ${generateResult.error}`);
      }

      // Step 2: Insert signatures (Reader + Liz)
      const signatureResult = await insertSignaturesIntoNDA(pin, {
        readerSignature: readerSignature,
        lizSignature: true // Liz's signature from file
      });

      if (!signatureResult.success) {
        throw new Error(`Signature insertion failed: ${signatureResult.error}`);
      }

      // Step 3: Flatten NDA (make non-editable)
      const flattenResult = await flattenNDA(pin);
      if (!flattenResult.success) {
        throw new Error(`Flattening failed: ${flattenResult.error}`);
      }

      // Step 4: Update reader - NDA signed
      await readersDb.query(
        `UPDATE readers
         SET nda_signed = TRUE,
             nda_signed_at = NOW(),
             nda_version_id = $1,
             portal_access_status = 'active'
         WHERE reader_pin = $2`,
        [nda.id, pin]
      );

      // Log activity
      await readersDb.query(
        `INSERT INTO reader_activity_log (reader_pin, activity_type, activity_description, performed_by)
         VALUES ($1, $2, $3, $4)`,
        [pin, 'nda_signed', `Reader signed NDA version ${nda.version_number}`, name]
      );

      return reply.send({
        success: true,
        message: 'NDA signed successfully',
        redirectTo: '/readers-dashboard',
        ndaPath: flattenResult.outputPath
      });

    } catch (error) {
      fastify.log.error('Error signing NDA:', error);
      return reply.code(500).send({ success: false, error: 'Failed to sign NDA' });
    }
  });

  // ==============================================
  // REPORT VIEWER (In-Workspace Only - No Download)
  // ==============================================
  fastify.get('/report-viewer/:assignmentId', {
    preHandler: authenticateReader
  }, async (request, reply) => {
    const { pin, name } = request.user;
    const { assignmentId } = request.params;

    try {
      // Get assignment details
      const assignmentResult = await readersDb.query(
        `SELECT assignment_id, assignment_number, reader_pin, report_type,
                assignment_status, redacted_report_path, deadline
         FROM reader_assignments
         WHERE assignment_id = $1 AND reader_pin = $2`,
        [assignmentId, pin]
      );

      if (assignmentResult.rows.length === 0) {
        return reply.code(404).send({ success: false, error: 'Assignment not found' });
      }

      const assignment = assignmentResult.rows[0];

      // Check if assignment is accessible
      if (assignment.assignment_status === 'completed' || assignment.assignment_status === 'cancelled') {
        return reply.code(403).send({ success: false, error: 'This assignment is no longer accessible' });
      }

      return reply.view('report-viewer.ejs', {
        assignment,
        reader: { pin, name }
      });

    } catch (error) {
      fastify.log.error('Error loading report viewer:', error);
      return reply.code(500).send({ success: false, error: 'Failed to load report' });
    }
  });

  // ==============================================
  // CORRECTIONS EDITOR (In-Workspace Only)
  // ==============================================
  fastify.get('/corrections-editor/:assignmentId', {
    preHandler: authenticateReader
  }, async (request, reply) => {
    const { pin, name } = request.user;
    const { assignmentId } = request.params;

    try {
      // Get assignment details
      const assignmentResult = await readersDb.query(
        `SELECT assignment_id, assignment_number, reader_pin, report_type,
                assignment_status, redacted_report_path, corrections_content,
                deadline
         FROM reader_assignments
         WHERE assignment_id = $1 AND reader_pin = $2`,
        [assignmentId, pin]
      );

      if (assignmentResult.rows.length === 0) {
        return reply.code(404).send({ success: false, error: 'Assignment not found' });
      }

      const assignment = assignmentResult.rows[0];

      return reply.view('corrections-editor.ejs', {
        assignment,
        reader: { pin, name }
      });

    } catch (error) {
      fastify.log.error('Error loading corrections editor:', error);
      return reply.code(500).send({ success: false, error: 'Failed to load editor' });
    }
  });

  // ==============================================
  // SAVE CORRECTIONS (API)
  // ==============================================
  fastify.post('/api/readers/save-corrections', {
    preHandler: authenticateReader
  }, async (request, reply) => {
    const { pin, name } = request.user;
    const { assignmentId, corrections } = request.body;

    try {
      // Update assignment with corrections
      await readersDb.query(
        `UPDATE reader_assignments
         SET corrections_content = $1,
             corrections_updated_at = NOW()
         WHERE assignment_id = $2 AND reader_pin = $3`,
        [JSON.stringify(corrections), assignmentId, pin]
      );

      // Log activity
      await readersDb.query(
        `INSERT INTO reader_activity_log (reader_pin, activity_type, activity_description, performed_by)
         VALUES ($1, $2, $3, $4)`,
        [pin, 'corrections_saved', `Reader saved corrections for assignment ${assignmentId}`, name]
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
  fastify.post('/api/readers/submit-corrections', {
    preHandler: authenticateReader
  }, async (request, reply) => {
    const { pin, name } = request.user;
    const { assignmentId } = request.body;

    try {
      // Update assignment status
      const result = await readersDb.query(
        `UPDATE reader_assignments
         SET assignment_status = 'completed',
             corrections_submitted_at = NOW(),
             actual_turnaround_hours = EXTRACT(EPOCH FROM (NOW() - assigned_at)) / 3600
         WHERE assignment_id = $1 AND reader_pin = $2
         RETURNING payment_amount`,
        [assignmentId, pin]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ success: false, error: 'Assignment not found' });
      }

      // Update reader stats
      await readersDb.query(
        `UPDATE readers
         SET total_assignments_completed = total_assignments_completed + 1
         WHERE reader_pin = $1`,
        [pin]
      );

      // Log activity
      await readersDb.query(
        `INSERT INTO reader_activity_log (reader_pin, activity_type, activity_description, performed_by)
         VALUES ($1, $2, $3, $4)`,
        [pin, 'corrections_submitted', `Reader submitted corrections for assignment ${assignmentId}`, name]
      );

      return reply.send({
        success: true,
        message: 'Corrections submitted successfully! Payment pending review.',
        paymentAmount: result.rows[0].payment_amount
      });

    } catch (error) {
      fastify.log.error('Error submitting corrections:', error);
      return reply.code(500).send({ success: false, error: 'Failed to submit corrections' });
    }
  });

  // ==============================================
  // PAYMENT STATUS
  // ==============================================
  fastify.get('/payment-status', {
    preHandler: authenticateReader
  }, async (request, reply) => {
    const { pin, name } = request.user;

    try {
      // Get payment history
      const paymentsResult = await readersDb.query(
        `SELECT assignment_id, assignment_number, payment_amount,
                corrections_submitted_at, corrections_approved,
                payment_approved, payment_approved_at, payment_processed_at
         FROM reader_assignments
         WHERE reader_pin = $1
         AND assignment_status = 'completed'
         ORDER BY corrections_submitted_at DESC`,
        [pin]
      );

      // Get total earnings
      const earningsResult = await readersDb.query(
        'SELECT total_earnings FROM readers WHERE reader_pin = $1',
        [pin]
      );

      return reply.view('payment-status.ejs', {
        reader: { pin, name, totalEarnings: earningsResult.rows[0].total_earnings },
        payments: paymentsResult.rows
      });

    } catch (error) {
      fastify.log.error('Error loading payment status:', error);
      return reply.code(500).send({ success: false, error: 'Failed to load payment status' });
    }
  });

}
