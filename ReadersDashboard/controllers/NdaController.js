// ==============================================
// NDA CONTROLLER - READERS DASHBOARD
// ==============================================
// Purpose: Handle NDA workflow (4-step process)
// Pattern: Follows ClientsDashboard consent controller
// Author: Claude (following Liz's specification)
// Date: 27th January 2026
// ==============================================

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import crypto from 'crypto';
import { insertSignaturesIntoNDA, flattenNDA } from '../utils/insertSignaturesIntoReadersNDA.js';

const { Pool } = pg;

// Database connection
const readersDb = new Pool({
  connectionString: process.env.READERS_DATABASE_URL
});

// ==============================================
// PREVIEW CACHE (10-minute TTL)
// Pattern: Same as ClientsDashboard consent workflow
// ==============================================
const previewCache = new Map();
const PREVIEW_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Cleanup expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of previewCache.entries()) {
    if (now - value.timestamp > PREVIEW_CACHE_TTL) {
      previewCache.delete(key);
      console.log(`[NDA Cache] Cleaned up expired preview for ${key}`);
    }
  }
}, 60000); // Check every minute

// ==============================================
// DIRECTORY PATHS
// ==============================================
function getDirectoryPaths() {
  const apiCentralRepo = '/var/www/api.qolae.com/centralRepository';

  return {
    finalNdaDir: path.join(apiCentralRepo, 'public', 'finalNda'),
    signedNdaDir: path.join(apiCentralRepo, 'protected', 'signed-nda'),
    signaturesDir: path.join(apiCentralRepo, 'protected', 'signatures')
  };
}

// ==============================================
// CONTROLLER METHODS
// ==============================================

const NdaController = {
  // ==============================================
  // STEP 1 → STEP 2: Continue to Sign
  // ==============================================
  continueToSign: async (request, reply) => {
    try {
      const { readerPin } = request.body;

      if (!readerPin) {
        return reply.code(400).send({ error: 'Reader PIN required' });
      }

      console.log(`[NDA] Step 1 → Step 2: Reader ${readerPin} continuing to sign`);

      // Redirect to dashboard with step=2
      return reply.redirect(`/readersDashboard?readerPin=${readerPin}&showModal=nda&step=2`);

    } catch (error) {
      console.error('[NDA] continueToSign error:', error.message);
      return reply.code(500).send({ error: 'Failed to proceed to sign step' });
    }
  },

  // ==============================================
  // STEP 2 → STEP 3: Generate Preview
  // ==============================================
  generatePreview: async (request, reply) => {
    try {
      const { readerPin, signatureData, acknowledgmentConfirmed } = request.body;
      const signatureFile = request.body.signatureUpload;

      if (!readerPin) {
        return reply.code(400).send({ error: 'Reader PIN required' });
      }

      // Validate acknowledgment
      if (!acknowledgmentConfirmed) {
        console.log(`[NDA] Preview rejected - acknowledgment not confirmed for ${readerPin}`);
        return reply.redirect(`/readersDashboard?readerPin=${readerPin}&showModal=nda&step=2&error=acknowledgment`);
      }

      // Validate signature (either drawn or uploaded)
      let finalSignatureData = signatureData;

      if (signatureFile && signatureFile.data) {
        // Convert uploaded file to base64
        finalSignatureData = `data:${signatureFile.mimetype};base64,${signatureFile.data.toString('base64')}`;
      }

      if (!finalSignatureData || finalSignatureData === 'data:image/png;base64,') {
        console.log(`[NDA] Preview rejected - no signature provided for ${readerPin}`);
        return reply.redirect(`/readersDashboard?readerPin=${readerPin}&showModal=nda&step=2&error=signature`);
      }

      console.log(`[NDA] Step 2 → Step 3: Generating preview for ${readerPin}`);

      // Get reader data
      const readerResult = await readersDb.query(
        'SELECT "readerPin", "readerName", "readerType" FROM readers WHERE "readerPin" = $1',
        [readerPin]
      );

      if (readerResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Reader not found' });
      }

      const reader = readerResult.rows[0];

      // Insert signatures into NDA PDF
      const signatureResult = await insertSignaturesIntoNDA(readerPin, {
        readerSignature: finalSignatureData,
        lizSignature: true
      });

      if (!signatureResult.success) {
        console.error(`[NDA] Signature insertion failed: ${signatureResult.error}`);
        return reply.redirect(`/readersDashboard?readerPin=${readerPin}&showModal=nda&step=2&error=pdf`);
      }

      // Cache preview data
      previewCache.set(readerPin, {
        pdfPath: signatureResult.outputPath,
        signatureData: finalSignatureData,
        timestamp: Date.now(),
        reader: reader
      });

      console.log(`[NDA] Preview cached for ${readerPin}, redirecting to step 3`);

      // Redirect to preview step
      return reply.redirect(`/readersDashboard?readerPin=${readerPin}&showModal=nda&step=3`);

    } catch (error) {
      console.error('[NDA] generatePreview error:', error.message);
      const readerPin = request.body?.readerPin || '';
      return reply.redirect(`/readersDashboard?readerPin=${readerPin}&showModal=nda&step=2&error=server`);
    }
  },

  // ==============================================
  // SERVE PREVIEW PDF (for iframe)
  // ==============================================
  servePreviewPdf: async (request, reply) => {
    try {
      const { readerPin } = request.query;

      if (!readerPin) {
        return reply.code(400).send({ error: 'Reader PIN required' });
      }

      // Get from cache
      const cached = previewCache.get(readerPin);

      if (!cached || !cached.pdfPath) {
        console.log(`[NDA] Preview not found in cache for ${readerPin}`);
        return reply.code(404).send({ error: 'Preview not found. Please restart the signing process.' });
      }

      // Check if PDF file exists
      if (!fs.existsSync(cached.pdfPath)) {
        console.error(`[NDA] Preview PDF file not found: ${cached.pdfPath}`);
        return reply.code(404).send({ error: 'Preview PDF not found' });
      }

      // Serve the PDF
      const pdfBuffer = fs.readFileSync(cached.pdfPath);

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `inline; filename="NDA_Preview_${readerPin}.pdf"`);

      return reply.send(pdfBuffer);

    } catch (error) {
      console.error('[NDA] servePreviewPdf error:', error.message);
      return reply.code(500).send({ error: 'Failed to serve preview' });
    }
  },

  // ==============================================
  // STEP 3 → STEP 4: Final Sign
  // ==============================================
  signNda: async (request, reply) => {
    try {
      const { readerPin, confirmFromPreview } = request.body;

      if (!readerPin) {
        return reply.code(400).send({ error: 'Reader PIN required' });
      }

      if (!confirmFromPreview) {
        return reply.redirect(`/readersDashboard?readerPin=${readerPin}&showModal=nda&step=3&error=confirm`);
      }

      console.log(`[NDA] Step 3 → Step 4: Finalizing NDA for ${readerPin}`);

      // Get cached preview data
      const cached = previewCache.get(readerPin);

      if (!cached) {
        console.log(`[NDA] No cached preview for ${readerPin}, redirecting to step 2`);
        return reply.redirect(`/readersDashboard?readerPin=${readerPin}&showModal=nda&step=2&error=expired`);
      }

      // Flatten the NDA (make non-editable)
      const flattenResult = await flattenNDA(readerPin);

      if (!flattenResult.success) {
        console.error(`[NDA] Flattening failed: ${flattenResult.error}`);
        return reply.redirect(`/readersDashboard?readerPin=${readerPin}&showModal=nda&step=3&error=flatten`);
      }

      // Generate blockchain hash
      const pdfBuffer = fs.readFileSync(flattenResult.outputPath);
      const blockchainHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
      const blockchainTimestamp = new Date().toISOString();

      // Update database
      await readersDb.query(
        `UPDATE readers
         SET "ndaSigned" = TRUE,
             "ndaSignedAt" = NOW(),
             "ndaPdfPath" = $1,
             "ndaBlockchainHash" = $2,
             "ndaBlockchainTimestamp" = $3
         WHERE "readerPin" = $4`,
        [flattenResult.outputPath, blockchainHash, blockchainTimestamp, readerPin]
      );

      console.log(`[NDA] NDA signed successfully for ${readerPin}`);
      console.log(`[NDA] Blockchain hash: ${blockchainHash.substring(0, 16)}...`);

      // Clear cache
      previewCache.delete(readerPin);

      // Redirect to completion step
      return reply.redirect(`/readersDashboard?readerPin=${readerPin}&showModal=nda&step=4`);

    } catch (error) {
      console.error('[NDA] signNda error:', error.message);
      const readerPin = request.body?.readerPin || '';
      return reply.redirect(`/readersDashboard?readerPin=${readerPin}&showModal=nda&step=3&error=server`);
    }
  },

  // ==============================================
  // VIEW SIGNED NDA (Step 4 and future access)
  // ==============================================
  viewSignedNda: async (request, reply) => {
    try {
      const { readerPin } = request.query;

      if (!readerPin) {
        return reply.code(400).send({ error: 'Reader PIN required' });
      }

      // Get PDF path from database
      const result = await readersDb.query(
        'SELECT "ndaPdfPath" FROM readers WHERE "readerPin" = $1',
        [readerPin]
      );

      if (result.rows.length === 0 || !result.rows[0].ndaPdfPath) {
        return reply.code(404).send({ error: 'Signed NDA not found' });
      }

      const pdfPath = result.rows[0].ndaPdfPath;

      if (!fs.existsSync(pdfPath)) {
        console.error(`[NDA] Signed NDA file not found: ${pdfPath}`);
        return reply.code(404).send({ error: 'Signed NDA file not found' });
      }

      // Serve the PDF
      const pdfBuffer = fs.readFileSync(pdfPath);

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `inline; filename="signedReadersNda${readerPin}.pdf"`);

      return reply.send(pdfBuffer);

    } catch (error) {
      console.error('[NDA] viewSignedNda error:', error.message);
      return reply.code(500).send({ error: 'Failed to retrieve signed NDA' });
    }
  },

  // ==============================================
  // DOWNLOAD SIGNED NDA
  // ==============================================
  downloadSignedNda: async (request, reply) => {
    try {
      const { readerPin } = request.query;

      if (!readerPin) {
        return reply.code(400).send({ error: 'Reader PIN required' });
      }

      // Get PDF path from database
      const result = await readersDb.query(
        'SELECT "ndaPdfPath" FROM readers WHERE "readerPin" = $1',
        [readerPin]
      );

      if (result.rows.length === 0 || !result.rows[0].ndaPdfPath) {
        return reply.code(404).send({ error: 'Signed NDA not found' });
      }

      const pdfPath = result.rows[0].ndaPdfPath;

      if (!fs.existsSync(pdfPath)) {
        console.error(`[NDA] Signed NDA file not found: ${pdfPath}`);
        return reply.code(404).send({ error: 'Signed NDA file not found' });
      }

      // Serve the PDF for download
      const pdfBuffer = fs.readFileSync(pdfPath);

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="signedReadersNda${readerPin}.pdf"`);

      return reply.send(pdfBuffer);

    } catch (error) {
      console.error('[NDA] downloadSignedNda error:', error.message);
      return reply.code(500).send({ error: 'Failed to download signed NDA' });
    }
  }
};

export default NdaController;
