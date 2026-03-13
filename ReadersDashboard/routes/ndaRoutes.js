// ==============================================
// NDA ROUTES - READERS DASHBOARD (THIN PROXY)
// ==============================================
// Purpose: Proxy NDA workflow requests to SSOT API (api.qolae.com)
// Pattern: Follows LawyersDashboard Parent Bridge — NO business logic
// Author: Claude (following Liz's NDA SSOT Refactor spec)
// Date: 11th February 2026
//
// SSOT Architecture:
//   Browser → ReadersDashboard (form POST/GET) → api.qolae.com (business logic) → JSON/PDF response
//   ReadersDashboard reads JSON → redirects to next step or streams PDF back to browser
//
// NO direct DB queries, NO PDF manipulation, NO blockchain hashing, NO crypto imports
// ==============================================

import ssotFetch from '../utils/ssotFetch.js';

async function ndaRoutes(fastify, options) {

  // ==============================================
  // POST /nda/continueToSign
  // Step 1 → Step 2: Validate reader, transition to signing
  // ==============================================
  fastify.post('/nda/continueToSign', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    const readerPin = request.user.readerPin;

    try {
      const apiResponse = await ssotFetch(
        '/api/readers/nda/continueToSign',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ readerPin })
        }
      );

      const apiData = await apiResponse.json();

      if (apiData.success) {
        return reply.redirect('/readersDashboard?readerPin=' + readerPin + '&showModal=nda&step=2');
      }

      fastify.log.error({ event: 'ndaContinueToSignFailed', readerPin, error: apiData.error });
      return reply.redirect('/readersDashboard?readerPin=' + readerPin + '&showModal=nda&step=1&error=' + encodeURIComponent('Unable to proceed. Please try again.'));

    } catch (error) {
      fastify.log.error({ event: 'ndaContinueToSignError', readerPin, error: error.message });
      return reply.redirect('/readersDashboard?readerPin=' + readerPin + '&showModal=nda&step=1&error=' + encodeURIComponent('Unable to proceed. Please try again.'));
    }
  });

  // ==============================================
  // POST /nda/preview
  // Step 2 → Step 3: Submit signature, generate preview
  // ==============================================
  fastify.post('/nda/preview', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    const readerPin = request.user.readerPin;
    const { signatureData, acknowledgmentConfirmed } = request.body;

    try {
      const apiResponse = await ssotFetch(
        '/api/readers/nda/preview',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            readerPin,
            signatureData,
            agreedToTerms: acknowledgmentConfirmed
          })
        }
      );

      const apiData = await apiResponse.json();

      if (apiData.success) {
        return reply.redirect('/readersDashboard?readerPin=' + readerPin + '&showModal=nda&step=3');
      }

      fastify.log.error({ event: 'ndaPreviewFailed', readerPin, error: apiData.error });
      return reply.redirect('/readersDashboard?readerPin=' + readerPin + '&showModal=nda&step=2&error=' + encodeURIComponent(apiData.error || 'Signature processing failed. Please try again.'));

    } catch (error) {
      fastify.log.error({ event: 'ndaPreviewError', readerPin, error: error.message });
      return reply.redirect('/readersDashboard?readerPin=' + readerPin + '&showModal=nda&step=2&error=' + encodeURIComponent('Signature processing failed. Please try again.'));
    }
  });

  // ==============================================
  // GET /nda/previewPdf
  // Serve cached preview PDF (proxy stream from SSOT)
  // ==============================================
  fastify.get('/nda/previewPdf', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    const readerPin = request.user.readerPin;

    try {
      const apiResponse = await ssotFetch(
        '/api/readers/nda/previewPdf/' + readerPin
      );

      if (!apiResponse.ok) {
        return reply.code(404).send({ error: 'Preview not available' });
      }

      const pdfBuffer = Buffer.from(await apiResponse.arrayBuffer());

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', 'inline; filename="NDA_Preview_' + readerPin + '.pdf"');
      return reply.send(pdfBuffer);

    } catch (error) {
      fastify.log.error({ event: 'ndaPreviewPdfError', readerPin, error: error.message });
      return reply.code(404).send({ error: 'Preview not available' });
    }
  });

  // ==============================================
  // POST /nda/sign
  // Step 3 → Step 4: Flatten PDF, blockchain hash, complete
  // ==============================================
  fastify.post('/nda/sign', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    const readerPin = request.user.readerPin;
    const { confirmFromPreview } = request.body;

    if (!confirmFromPreview) {
      return reply.redirect('/readersDashboard?readerPin=' + readerPin + '&showModal=nda&step=3&error=' + encodeURIComponent('Please confirm before submitting.'));
    }

    try {
      const apiResponse = await ssotFetch(
        '/api/readers/nda/sign',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ readerPin })
        }
      );

      const apiData = await apiResponse.json();

      if (apiData.success) {
        return reply.redirect('/readersDashboard?readerPin=' + readerPin + '&showModal=nda&step=4');
      }

      fastify.log.error({ event: 'ndaSignFailed', readerPin, error: apiData.error });
      return reply.redirect('/readersDashboard?readerPin=' + readerPin + '&showModal=nda&step=3&error=' + encodeURIComponent('Signing failed. Please try again.'));

    } catch (error) {
      fastify.log.error({ event: 'ndaSignError', readerPin, error: error.message });
      return reply.redirect('/readersDashboard?readerPin=' + readerPin + '&showModal=nda&step=3&error=' + encodeURIComponent('Signing failed. Please try again.'));
    }
  });

  // ==============================================
  // GET /nda/view
  // Serve signed NDA inline (proxy stream from SSOT)
  // ==============================================
  fastify.get('/nda/view', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    const readerPin = request.user.readerPin;

    try {
      const apiResponse = await ssotFetch(
        '/api/readers/nda/view/' + readerPin
      );

      if (!apiResponse.ok) {
        return reply.code(404).send({ error: 'Signed NDA not found' });
      }

      const pdfBuffer = Buffer.from(await apiResponse.arrayBuffer());

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', 'inline; filename="signedReadersNda' + readerPin + '.pdf"');
      return reply.send(pdfBuffer);

    } catch (error) {
      fastify.log.error({ event: 'ndaViewError', readerPin, error: error.message });
      return reply.code(404).send({ error: 'Signed NDA not found' });
    }
  });

  // ==============================================
  // GET /nda/download
  // Download signed NDA (proxy stream from SSOT)
  // ==============================================
  fastify.get('/nda/download', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    const readerPin = request.user.readerPin;

    try {
      const apiResponse = await ssotFetch(
        '/api/readers/nda/download/' + readerPin
      );

      if (!apiResponse.ok) {
        return reply.code(404).send({ error: 'Signed NDA not found' });
      }

      const pdfBuffer = Buffer.from(await apiResponse.arrayBuffer());

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', 'attachment; filename="signedReadersNda' + readerPin + '.pdf"');
      return reply.send(pdfBuffer);

    } catch (error) {
      fastify.log.error({ event: 'ndaDownloadError', readerPin, error: error.message });
      return reply.code(404).send({ error: 'Signed NDA not found' });
    }
  });
}

export default ndaRoutes;
