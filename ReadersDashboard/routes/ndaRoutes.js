// ==============================================
// NDA ROUTES - READERS DASHBOARD
// ==============================================
// Purpose: Handle NDA workflow (4-step process)
// Pattern: Follows ClientsDashboard consent routes
// Author: Claude (following Liz's specification)
// Date: 27th January 2026
// ==============================================

import NdaController from '../controllers/NdaController.js';

async function ndaRoutes(fastify, options) {
  // ==============================================
  // STEP 1 → STEP 2: Continue to Sign
  // ==============================================
  fastify.post('/api/nda/continueToSign', {
    preHandler: fastify.authenticate
  }, NdaController.continueToSign);

  // ==============================================
  // STEP 2 → STEP 3: Generate Preview
  // ==============================================
  fastify.post('/api/nda/preview', {
    preHandler: fastify.authenticate
  }, NdaController.generatePreview);

  // ==============================================
  // SERVE PREVIEW PDF (for iframe)
  // ==============================================
  fastify.get('/api/nda/previewPdf', {
    preHandler: fastify.authenticate
  }, NdaController.servePreviewPdf);

  // ==============================================
  // STEP 3 → STEP 4: Final Sign
  // ==============================================
  fastify.post('/api/nda/sign', {
    preHandler: fastify.authenticate
  }, NdaController.signNda);

  // ==============================================
  // VIEW SIGNED NDA (Step 4 and future access)
  // ==============================================
  fastify.get('/api/nda/view', {
    preHandler: fastify.authenticate
  }, NdaController.viewSignedNda);

  // ==============================================
  // DOWNLOAD SIGNED NDA
  // ==============================================
  fastify.get('/api/nda/download', {
    preHandler: fastify.authenticate
  }, NdaController.downloadSignedNda);
}

export default ndaRoutes;
