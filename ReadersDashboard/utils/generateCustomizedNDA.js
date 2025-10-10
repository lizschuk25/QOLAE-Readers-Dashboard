// ==============================================
// QOLAE CUSTOMIZED NDA GENERATOR
// ==============================================
// Purpose: Auto-populate TemplateReadersNDA.pdf with reader data
// Author: Liz
// Date: October 7, 2025
// Pattern: Following generateCustomizedTOB.js pattern
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
  connectionString: process.env.READERS_DATABASE_URL
});

// ==============================================
// HELPER: Get Reader Data by PIN from Database
// ==============================================
async function getReaderData(readerPin) {
  try {
    const result = await readersDb.query(
      'SELECT reader_pin, reader_name, email, reader_type, specialization FROM readers WHERE reader_pin = $1',
      [readerPin]
    );

    if (result.rows.length === 0) {
      throw new Error(`Reader with PIN ${readerPin} not found in database`);
    }

    console.log(`✅ Found reader data for: ${result.rows[0].reader_name}`);
    return result.rows[0];

  } catch (error) {
    console.error(`❌ Database error finding reader:`, error);
    throw error;
  }
}

// ==============================================
// HELPER: Format Date (UK Format)
// ==============================================
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// ==============================================
// HELPER: Get Directory Paths
// ==============================================
function getDirectoryPaths() {
  // Use API Dashboard central repository (following Admin pattern)
  const apiCentralRepo = '/var/www/api.qolae.com/central-repository';

  return {
    templatePath: path.join(apiCentralRepo, 'original', 'TemplateReadersNDA.pdf'),
    tempDir: path.join(apiCentralRepo, 'temp'),
    finalNdaDir: path.join(apiCentralRepo, 'final-nda'),
    signedNdaDir: path.join(apiCentralRepo, 'signed-nda'),
    signaturesDir: path.join(apiCentralRepo, 'signatures')
  };
}

// ==============================================
// HELPER: Populate Form Fields with Reader Data
// ==============================================
async function populateFormFields(form, reader, readerPin) {
  console.log(`📝 Populating form fields for ${reader.reader_name}...`);

  // Format current date
  const currentDate = new Date();
  const formattedDate = formatDate(currentDate);

  console.log(`Formatted current date: ${formattedDate}`);

  // Reader Name fields (7 instances)
  const readerNameFields = [
    'ReadersName1',
    'ReadersName2',
    'ReadersName3',
    'ReadersName4',
    'ReadersName5',
    'ReadersName6',
    'ReadersName7'
  ];

  readerNameFields.forEach(fieldName => {
    try {
      const field = form.getTextField(fieldName);
      if (field) {
        field.setText(reader.reader_name || '');
        console.log(`  ✅ Set ${fieldName} to: ${reader.reader_name}`);
      }
    } catch (e) {
      console.warn(`  ⚠️ Field ${fieldName} not found or error: ${e.message}`);
    }
  });

  // Current Date fields (4 instances)
  const currentDateFields = [
    'CurrentDate1',
    'CurrentDate2',
    'CurrentDate3',
    'CurrentDate4'
  ];

  currentDateFields.forEach(fieldName => {
    try {
      const field = form.getTextField(fieldName);
      if (field) {
        field.setText(formattedDate);
        console.log(`  ✅ Set ${fieldName} to: ${formattedDate}`);
      }
    } catch (e) {
      console.warn(`  ⚠️ Field ${fieldName} not found or error: ${e.message}`);
    }
  });

  // PIN field (1 instance)
  try {
    const pinField = form.getTextField('PIN');
    if (pinField) {
      pinField.setText(readerPin || '');
      console.log(`  ✅ Set PIN to: ${readerPin}`);
    }
  } catch (e) {
    console.warn(`  ⚠️ PIN field not found or error: ${e.message}`);
  }

  console.log('✅ Form population complete');
}

// ==============================================
// MAIN FUNCTION: Generate Customized NDA
// ==============================================
async function generateCustomizedNDA(readerPin) {
  console.log(`\n📄 === GENERATING CUSTOMIZED NDA FOR PIN: ${readerPin} ===`);

  try {
    // 1. Get reader data from database
    const reader = await getReaderData(readerPin);
    console.log(`👤 Processing NDA for: ${reader.reader_name}`);

    // 2. Get directory paths
    const { templatePath, finalNdaDir } = getDirectoryPaths();

    // 3. Check if template exists
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template NDA not found at: ${templatePath}`);
    }

    // 4. Load template PDF
    console.log(`📄 Loading template from: ${templatePath}`);
    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);

    // 5. Get the form from the PDF
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    console.log(`📋 Found ${fields.length} form fields in template`);

    // 6. Log available fields for debugging
    if (fields.length > 0) {
      console.log('📝 Available form fields:');
      fields.forEach((field, index) => {
        console.log(`  ${index + 1}. ${field.getName()} (${field.constructor.name})`);
      });
    }

    // 7. Fill in the form fields with reader data
    await populateFormFields(form, reader, readerPin);

    // 8. Don't flatten - preserve button placeholders for signatures
    console.log('Skipping form flattening to preserve signature button placeholders (ReadersSignature, LizsSignature)...');

    // 9. Save the customized NDA to final-nda folder
    const outputFilename = `NDA_${readerPin}.pdf`;
    const outputPath = path.join(finalNdaDir, outputFilename);

    // Ensure output directory exists
    if (!fs.existsSync(finalNdaDir)) {
      fs.mkdirSync(finalNdaDir, { recursive: true });
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);

    console.log(`✅ Customized NDA saved to: ${outputPath}`);

    return {
      success: true,
      message: `Customized NDA generated for ${reader.reader_name}`,
      outputPath: outputPath,
      readerName: reader.reader_name,
      readerPin: readerPin,
    };

  } catch (error) {
    console.error(`❌ Error generating customized NDA:`, error.message);
    return {
      success: false,
      error: error.message,
      readerPin: readerPin,
    };
  }
}

// ==============================================
// INSERT SIGNATURES INTO NDA
// ==============================================
// Purpose: Insert reader signature + Liz's signature into button placeholders
// Button fields: ReadersSignature, LizsSignature
// ==============================================

async function insertSignaturesIntoNDA(readerPin, signatureData) {
  try {
    console.log(`\n🖊️ Starting signature insertion for NDA: ${readerPin}`);

    // Load PDF from final-nda folder
    const { finalNdaDir, signedNdaDir, signaturesDir } = getDirectoryPaths();
    const pdfPath = path.join(finalNdaDir, `NDA_${readerPin}.pdf`);

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

        console.log(`  ✅ Inserted signature into ${buttonName}`);
        return true;

      } catch (error) {
        console.error(`  ❌ Failed to insert ${buttonName}: ${error.message}`);
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
    const outputFilename = `NDA_${readerPin}_Signed.pdf`;
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
    console.error(`❌ Signature insertion failed:`, error.message);
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
    console.log(`\n📋 Flattening NDA for PIN: ${readerPin}`);

    const { signedNdaDir } = getDirectoryPaths();
    const pdfPath = path.join(signedNdaDir, `NDA_${readerPin}_Signed.pdf`);

    if (!fs.existsSync(pdfPath)) {
      throw new Error(`Signed NDA not found at: ${pdfPath}`);
    }

    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Flatten all form fields (makes all 14 fields non-editable)
    const form = pdfDoc.getForm();
    form.flatten();

    console.log('✅ All 14 form fields flattened (12 text + 2 signature buttons)');

    // Save flattened PDF (overwrite)
    const flattenedBytes = await pdfDoc.save();
    fs.writeFileSync(pdfPath, flattenedBytes);

    console.log(`✅ Flattened NDA saved to: ${pdfPath}`);

    // Update database - save NDA PDF path
    await readersDb.query(
      'UPDATE readers SET nda_pdf_path = $1 WHERE reader_pin = $2',
      [pdfPath, readerPin]
    );

    return {
      success: true,
      outputPath: pdfPath,
    };

  } catch (error) {
    console.error(`❌ Flattening failed:`, error.message);
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
  generateCustomizedNDA,
  insertSignaturesIntoNDA,
  flattenNDA
};
