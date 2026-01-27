// ==============================================
// READERS NDA SIGNATURE INSERTION
// ==============================================
// Purpose: Insert reader + Liz's signatures into signed NDA
// Pattern: Follows generateCustomizedTOB.js signature workflow
// Author: Liz
// Date: October 14, 2025
// ==============================================

import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection
const readersDb = new Pool({
  connectionString: process.env.HRCOMPLIANCE_DATABASE_URL
});

// ==============================================
// HELPER: Get Directory Paths
// ==============================================
function getDirectoryPaths() {
  // Use API Dashboard central repository (following Admin pattern)
  const apiCentralRepo = '/var/www/api.qolae.com/centralRepository';

  return {
    finalNdaDir: path.join(apiCentralRepo, 'finalNda'),
    signedNdaDir: path.join(apiCentralRepo, 'signed-nda'),
    signaturesDir: path.join(apiCentralRepo, 'signatures')
  };
}

// ==============================================
// INSERT SIGNATURES INTO NDA
// ==============================================
// Purpose: Insert reader signature + Liz's signature into button placeholders
// Button fields: ReadersSignature, LizsSignature
// ==============================================

async function insertSignaturesIntoNDA(readerPin, signatureData) {
  try {
    console.log(`\n=== INSERTING SIGNATURES INTO NDA ===`);
    console.log(`Reader PIN: ${readerPin}`);

    // Load PDF from final-nda folder
    const { finalNdaDir, signedNdaDir, signaturesDir } = getDirectoryPaths();
    const pdfPath = path.join(finalNdaDir, `readersNda${readerPin}.pdf`);

    if (!fs.existsSync(pdfPath)) {
      throw new Error(`NDA file not found at: ${pdfPath}`);
    }

    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    console.log(`PDF loaded: ${pdfDoc.getPageCount()} pages`);

    // Get form to access button fields
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    console.log(`Found ${fields.length} form fields`);

    // Track signature insertion results
    const results = {
      readersSignature: false,
      lizsSignature: false,
    };

    // Helper function to insert signature (uses pdf-lib's button field approach)
    const insertSignature = async (buttonName, signatureImageData) => {
      try {
        const buttonField = form.getButton(buttonName);

        // Load signature image
        let imageBytes;
        if (signatureImageData.startsWith('data:image')) {
          // Base64 data URL
          const base64Data = signatureImageData.split(',')[1];
          imageBytes = Buffer.from(base64Data, 'base64');
        } else if (fs.existsSync(signatureImageData)) {
          // File path
          imageBytes = fs.readFileSync(signatureImageData);
        } else {
          throw new Error(`Invalid signature data for ${buttonName}`);
        }

        // Embed image in PDF
        const signatureImage = await pdfDoc.embedPng(imageBytes);

        // Set image as button appearance
        buttonField.setImage(signatureImage);

        console.log(`  ✓ Inserted signature into ${buttonName}`);
        return true;

      } catch (error) {
        console.error(`  ✗ Failed to insert ${buttonName}: ${error.message}`);
        return false;
      }
    };

    // Insert Liz's signature (button field: LizsSignature)
    if (signatureData.lizSignature) {
      const lizSignaturePath = path.join(signaturesDir, 'lizs-signature-canvas.png');
      if (fs.existsSync(lizSignaturePath)) {
        results.lizsSignature = await insertSignature('LizsSignature', lizSignaturePath);
      } else {
        console.log(`⚠️ Liz's signature file not found at: ${lizSignaturePath}`);
      }
    }

    // Insert reader's signature (button field: ReadersSignature)
    if (signatureData.readerSignature) {
      results.readersSignature = await insertSignature('ReadersSignature', signatureData.readerSignature);
    }

    // Save the signed NDA
    const outputFilename = `signedReadersNda${readerPin}.pdf`;
    const outputPath = path.join(signedNdaDir, outputFilename);

    // Ensure output directory exists
    if (!fs.existsSync(signedNdaDir)) {
      fs.mkdirSync(signedNdaDir, { recursive: true });
    }

    const finalPdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, finalPdfBytes);

    console.log(`\n=== SIGNATURE INSERTION RESULTS ===`);
    console.log(`PDF saved to: ${outputPath}`);
    console.log('Results:', results);

    return {
      success: true,
      outputPath,
      results,
    };

  } catch (error) {
    console.error(`✗ Signature insertion failed:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ==============================================
// FLATTEN NDA (Make Non-Editable)
// ==============================================
async function flattenNDA(readerPin) {
  try {
    console.log(`\n=== FLATTENING NDA ===`);
    console.log(`Reader PIN: ${readerPin}`);

    const { signedNdaDir } = getDirectoryPaths();
    const pdfPath = path.join(signedNdaDir, `signedReadersNda${readerPin}.pdf`);

    if (!fs.existsSync(pdfPath)) {
      throw new Error(`Signed NDA not found at: ${pdfPath}`);
    }

    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Flatten all form fields (makes all 14 fields non-editable)
    const form = pdfDoc.getForm();
    form.flatten();

    console.log('✓ All 14 form fields flattened (12 text + 2 signature buttons)');

    // Save flattened PDF (overwrite)
    const flattenedBytes = await pdfDoc.save();
    fs.writeFileSync(pdfPath, flattenedBytes);

    console.log(`✓ Flattened NDA saved to: ${pdfPath}`);

    // Update database - save NDA PDF path
    await readersDb.query(
      'UPDATE readers SET "ndaPdfPath" = $1 WHERE "readerPin" = $2',
      [pdfPath, readerPin]
    );

    return {
      success: true,
      outputPath: pdfPath,
    };

  } catch (error) {
    console.error(`✗ Flattening failed:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ==============================================
// EXPORTS
// ==============================================
export {
  insertSignaturesIntoNDA,
  flattenNDA
};
