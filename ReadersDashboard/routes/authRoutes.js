// ==============================================
// READERS DASHBOARD - AUTHENTICATION ROUTES
// ==============================================
// Purpose: 2FA authentication for readers (PIN + Email verification)
// Author: Liz
// Date: October 7, 2025
// ==============================================

import pg from 'pg';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const { Pool } = pg;

// Database connection
const readersDb = new Pool({
  connectionString: process.env.READERS_DATABASE_URL
});

export default async function authRoutes(fastify, options) {

  // ==============================================
  // STEP 1: READERS LOGIN PAGE
  // ==============================================
  fastify.get('/readersLogin', async (request, reply) => {
    return reply.view('readersLogin.ejs');
  });

  // ==============================================
  // STEP 2: REQUEST EMAIL VERIFICATION CODE
  // ==============================================
  fastify.post('/api/readers/requestEmailCode', async (request, reply) => {
    const { pin, email } = request.body;

    try {
      console.log('🔍 Step 1: Received request - PIN:', pin, 'Email:', email);
      
      // Validate input
      if (!pin || !email) {
        console.log('❌ Step 2: Validation failed - missing PIN or email');
        return reply.code(400).send({
          success: false,
          error: 'PIN and email are required'
        });
      }

      console.log('✅ Step 2: Validation passed');
      console.log('🔍 Step 3: Querying database for reader...');

      // Check if reader exists with this PIN and email
      const readerResult = await readersDb.query(
        'SELECT "readerPin", "readerName", email, "portalAccessStatus" FROM readers WHERE "readerPin" = $1 AND email = $2',
        [pin, email]
      );

      console.log('✅ Step 3: Query completed. Found', readerResult.rows.length, 'readers');

      if (readerResult.rows.length === 0) {
        return reply.code(401).send({
          success: false,
          error: 'Invalid PIN or email'
        });
      }

      const reader = readerResult.rows[0];

      // Check if reader access is active
      if (reader.portalAccessStatus !== 'active' && reader.portalAccessStatus !== 'pending') {
        return reply.code(403).send({
          success: false,
          error: 'Your access has been suspended. Please contact QOLAE.'
        });
      }

      // Generate 6-digit verification code
      const verificationCode = crypto.randomInt(100000, 999999).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Save verification code to database
      await readersDb.query(
        `UPDATE readers
         SET "emailVerificationCode" = $1,
             "emailVerificationCodeExpiresAt" = $2,
             "emailVerificationCodeAttempts" = 0
         WHERE "readerPin" = $3`,
        [verificationCode, expiresAt, pin]
      );

      // Log activity
      await readersDb.query(
        `INSERT INTO "readerActivityLog" ("readerPin", "activityType", "activityDescription", "ipAddress")
         VALUES ($1, $2, $3, $4)`,
        [pin, 'emailCodeRequested', 'Reader requested email verification code', request.ip]
      );

      // Send email with verification code
      fastify.log.info(`Email verification code for ${email}: ${verificationCode}`);
      
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });

        await transporter.sendMail({
          from: process.env.EMAIL_FROM || 'Liz Chukwu <Liz.Chukwu@qolae.com>',
          to: email,
          subject: 'QOLAE Readers Portal - Verification Code',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
                .container { background: white; padding: 30px; border-radius: 8px; }
                .code-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
                .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; font-family: 'Courier New', monospace; }
              </style>
            </head>
            <body>
              <div class="container">
                <h2 style="color: #667eea;">📖 QOLAE Readers Portal</h2>
                <p>Hello,</p>
                <p>Your verification code for the QOLAE Readers Portal is:</p>
                <div class="code-box">
                  <div class="code">${verificationCode}</div>
                </div>
                <p>This code will expire in <strong>10 minutes</strong>.</p>
                <p>If you didn't request this code, please ignore this email.</p>
                <p style="margin-top: 30px; color: #6b7280;">Best regards,<br><strong>QOLAE Team</strong></p>
              </div>
            </body>
            </html>
          `
        });

        console.log('✅ Verification code email sent successfully to:', email);
      } catch (emailError) {
        console.error('⚠️  Failed to send email (code still valid):', emailError.message);
        // Don't fail the request if email fails - code is still in database
      }

      return reply.send({
        success: true,
        message: `Verification code sent to ${email}`,
        expiresIn: 600 // 10 minutes in seconds
      });

    } catch (error) {
      console.log('❌ CAUGHT ERROR:', error.message);
      console.log('❌ ERROR STACK:', error.stack);
      console.log('❌ ERROR DETAILS:', JSON.stringify(error, null, 2));
      fastify.log.error('Error requesting email code:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to send verification code'
      });
    }
  });

  // ==============================================
  // STEP 3: VERIFY EMAIL CODE & LOGIN
  // ==============================================
  fastify.post('/api/readers/verifyEmailCode', async (request, reply) => {
    const { pin, email, code } = request.body;

    try {
      // Validate input
      if (!pin || !email || !code) {
        return reply.code(400).send({
          success: false,
          error: 'PIN, email, and verification code are required'
        });
      }

      // Get reader with verification code
      const readerResult = await readersDb.query(
        `SELECT "readerPin", "readerName", email, "readerType",
                "emailVerificationCode", "emailVerificationCodeExpiresAt",
                "emailVerificationCodeAttempts", "ndaSigned",
                "portalAccessStatus", "complianceSubmitted", "complianceSubmittedAt"
         FROM readers
         WHERE "readerPin" = $1 AND email = $2`,
        [pin, email]
      );

      if (readerResult.rows.length === 0) {
        return reply.code(401).send({
          success: false,
          error: 'Invalid PIN or email'
        });
      }

      const reader = readerResult.rows[0];

      // Check if code has expired
      if (new Date() > new Date(reader.emailVerificationCodeExpiresAt)) {
        return reply.code(401).send({
          success: false,
          error: 'Verification code has expired. Please request a new one.'
        });
      }

      // Check attempts (max 3)
      if (reader.emailVerificationCodeAttempts >= 3) {
        return reply.code(403).send({
          success: false,
          error: 'Too many failed attempts. Please request a new code.'
        });
      }

      // Verify code
      if (code !== reader.emailVerificationCode) {
        // Increment attempts
        await readersDb.query(
          'UPDATE readers SET "emailVerificationCodeAttempts" = "emailVerificationCodeAttempts" + 1 WHERE "readerPin" = $1',
          [pin]
        );

        return reply.code(401).send({
          success: false,
          error: 'Invalid verification code',
          attemptsRemaining: 3 - (reader.emailVerificationCodeAttempts + 1)
        });
      }

      // Code is valid - Generate JWT token
      const token = fastify.jwt.sign({
        pin: reader.readerPin,
        name: reader.readerName,
        email: reader.email,
        type: reader.readerType,
        role: 'reader'
      });

      // Clear verification code
      await readersDb.query(
        `UPDATE readers
         SET "emailVerificationCode" = NULL,
             "emailVerificationCodeExpiresAt" = NULL,
             "emailVerificationCodeAttempts" = 0,
             "lastLogin" = NOW(),
             "lastLoginIp" = $1
         WHERE "readerPin" = $2`,
        [request.ip, pin]
      );

      // Log successful login
      await readersDb.query(
        `INSERT INTO "readerActivityLog" ("readerPin", "activityType", "activityDescription", "ipAddress")
         VALUES ($1, $2, $3, $4)`,
        [pin, 'loginSuccess', 'Reader logged in successfully', request.ip]
      );

      // Set cookie with token
      reply.setCookie('qolaeReaderToken', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 8 * 60 * 60 // 8 hours
      });

      return reply.send({
        success: true,
        message: 'Login successful',
        reader: {
          pin: reader.readerPin,
          name: reader.readerName,
          type: reader.readerType,
          ndaSigned: reader.ndaSigned,
          complianceSubmitted: reader.complianceSubmitted
        },
        redirectTo: reader.complianceSubmitted ? '/readers-dashboard' : 'https://hrcompliance.qolae.com/readers-compliance?readerPin=' + reader.readerPin
      });

    } catch (error) {
      fastify.log.error('Error verifying email code:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to verify code'
      });
    }
  });

  // ==============================================
  // LOGOUT
  // ==============================================
  fastify.post('/api/readers/logout', async (request, reply) => {
    try {
      // Clear cookie
      reply.clearCookie('qolaeReaderToken', { path: '/' });

      return reply.send({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      fastify.log.error('Error during logout:', error);
      return reply.code(500).send({
        success: false,
        error: 'Logout failed'
      });
    }
  });

}
