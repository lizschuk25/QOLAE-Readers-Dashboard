// ==============================================
// READERS DASHBOARD - READER ROUTES
// ==============================================
// Purpose: Workflow journey — dashboard, corrections, payment processing
// Author: Liz
// Date: 28th October 2025 (Refactored: 12th February 2026)
// Architecture: SSOT Thin Proxy (Zero SQL, Zero import pg)
// Controller: ReadersController.js handles all SSOT fetch() calls
// ==============================================

import ReadersController from '../controllers/ReadersController.js';
import ssotFetch from '../utils/ssotFetch.js';

export default async function readerRoutes(fastify, options) {

  // ==============================================
  // LOCATION BLOCK 1: READERS DASHBOARD (Main Workspace)
  // ==============================================
  // VIEW: readersDashboard.ejs
  // ARCHITECTURE: 100% Server-Side, SSOT Bootstrap Pattern
  // SECURITY: PIN in URL is safe (bootstrap identifier + auth required)
  // Modal pattern: /readersDashboard?readerPin=KB-123456&modal=nda
  // SSOT: Bootstrap from api.qolae.com, modal data via ReadersController

  fastify.get('/readersDashboard', async (request, reply) => {
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');

    const { readerPin, modal, showModal: showModalParam, assignmentId, step } = request.query;
    const showModal = modal || showModalParam || null;
    const currentStep = parseInt(step) || 1;

    if (!readerPin) {
      return reply.code(400).send({ error: 'Reader PIN required' });
    }

    try {
      console.log(`🔍 Readers Dashboard route called with Reader PIN: ${readerPin}, Modal: ${modal || 'none'}`);

      // ==============================================
      // SINGLE SOURCE OF TRUTH - SSOT Bootstrap only
      // ==============================================
      // Step 1: Get stored JWT from SSOT
      const tokenResponse = await ssotFetch(`/auth/readers/getStoredToken?readerPin=${readerPin}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!tokenResponse.ok) {
        console.error(`❌ No valid JWT token found for readerPin: ${readerPin}`);
        return reply.code(401).send({ error: 'Invalid session - please login again' });
      }

      const tokenData = await tokenResponse.json();
      const { accessToken } = tokenData;

      // Step 2: Call SSOT bootstrap endpoint
      const bootstrapResponse = await ssotFetch(`/readers/workspace/bootstrap`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!bootstrapResponse.ok) {
        console.error(`❌ SSOT bootstrap failed for readerPin: ${readerPin}`);
        return reply.code(401).send({ error: 'Invalid session - please login again' });
      }

      const bootstrapData = await bootstrapResponse.json();

      if (!bootstrapData || !bootstrapData.valid) {
        console.error(`❌ Invalid bootstrap for readerPin: ${readerPin}`);
        return reply.code(401).send({ error: 'Invalid session - please login again' });
      }

      // Extract data from bootstrap response
      const reader = {
        readerPin: bootstrapData.user.readerPin,
        readerName: bootstrapData.user.readerName,
        firstName: bootstrapData.user.firstName || '',
        readerType: bootstrapData.user.readerType,
        readerEmail: bootstrapData.user.readerEmail,
        phone: bootstrapData.user.phone,
        ndaSigned: bootstrapData.gates.nda.completed,
        lastLogin: bootstrapData.user.lastLogin,
        totalAssignmentsCompleted: bootstrapData.stats.completedAssignments,
        averageTurnaroundHours: bootstrapData.stats.averageTurnaroundHours,
        totalEarnings: bootstrapData.stats.totalEarnings
      };

      const assignments = bootstrapData.assignments || [];

      console.log(`✅ Dashboard loading for ${reader.readerName} (${readerPin}) via SSOT Bootstrap`);

      // ===== MODAL DATA LOADING (via ReadersController → SSOT) =====
      let modalData = null;

      if (showModal === 'nda') {
        modalData = {
          type: 'nda',
          reader: reader,
          currentStep: currentStep
        };
        console.log(`[NDA Modal] Loading step ${currentStep} for ${readerPin}`);
      }

      else if (showModal === 'review' && assignmentId) {
        modalData = await ReadersController.getReaderReviewModalData(readerPin, assignmentId);
      }

      else if (showModal === 'payment' && assignmentId) {
        modalData = await ReadersController.getReaderPaymentModalData(readerPin, assignmentId);
      }

      else if (showModal === 'calendar') {
        modalData = await ReadersController.getReaderCalendarModalData(readerPin, request.query);
      }

      if (showModal) {
        console.log(`[SSR] Modal requested: ${showModal}, Data loaded: ${modalData ? 'Yes' : 'No'}`);
      }

      // Generate CSRF token for forms
      const csrfToken = fastify.jwt.sign({
        csrf: true,
        readerPin: readerPin,
        timestamp: Date.now()
      });

      // Pass bootstrap data to EJS template
      return reply.view('readersDashboard.ejs', {
        reader,
        assignments,
        gates: bootstrapData.gates,
        features: bootstrapData.features,
        stats: bootstrapData.stats,
        showModal: showModal,
        modalData: modalData,
        csrfToken: csrfToken,
        currentStep: currentStep
      });

    } catch (error) {
      console.error('❌ ERROR loading readers dashboard:', error);
      fastify.log.error('Error loading readers dashboard:', error);
      return reply.code(500).send({ success: false, error: 'Failed to load dashboard' });
    }
  });

  // ==============================================
  // LOCATION BLOCK 2: SAVE CORRECTIONS
  // ==============================================
  // Proxy → ReadersController → SSOT /api/readers/corrections/save

  fastify.post('/api/readers/saveCorrections', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    return await ReadersController.saveReaderCorrections(request, reply);
  });

  // ==============================================
  // LOCATION BLOCK 3: SUBMIT CORRECTIONS
  // ==============================================
  // Proxy → ReadersController → SSOT /api/readers/corrections/submit

  fastify.post('/api/readers/submitCorrections', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    return await ReadersController.submitReaderCorrections(request, reply);
  });

  // ==============================================
  // LOCATION BLOCK 4: PAYMENT PROCESSING
  // ==============================================
  // Proxy → ReadersController → SSOT /api/readers/payment/processing
  // VIEW: paymentProcessing.ejs (rendered by controller)

  fastify.get('/paymentProcessing', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    return await ReadersController.getReaderPaymentProcessing(request, reply);
  });

  // ==============================================
  // LOCATION BLOCK 5: PAYMENT STATUS (AUTO-REFRESH)
  // ==============================================
  // Proxy → ReadersController → SSOT /api/readers/payment/status/:assignmentId

  fastify.get('/api/readers/payment/status/:assignmentId', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    return await ReadersController.getReaderPaymentStatus(request, reply);
  });

  // ==============================================
  // LOCATION BLOCK 6: PAYMENT HISTORY
  // ==============================================
  // Proxy → ReadersController → SSOT /api/readers/payment/history

  fastify.get('/readers/paymentHistory', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    return await ReadersController.getReaderPaymentHistory(request, reply);
  });

  // ==============================================
  // LOCATION BLOCK 7: CONTACT SUPPORT
  // ==============================================
  // No DB, no SSOT — simple mailto redirect (stays inline)

  fastify.get('/readers/support', {
    preHandler: fastify.authenticate
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
