// ==============================================
// READERS DASHBOARD - AUTHENTICATION ROUTES
// ==============================================
// Purpose: 2FA authentication for readers (PIN + Email verification)
// Author: Liz
// Date: October 7, 2025
// ==============================================

import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

// Database connection
const readersDb = new Pool({
  connectionString: process.env.READERS_DATABASE_URL
});

export default async function authRoutes(fastify, options) {

  // ==============================================
  // STEP 1: READERS LOGIN PAGE
  // ==============================================
  fastify.get('/readers-login', async (request, reply) => {
    return reply.view('readers-login.ejs');
  });

  // ==============================================
  // STEP 2: REQUEST EMAIL VERIFICATION CODE
  // ==============================================
  fastify.post('/api/readers/request-email-code', async (request, reply) => {
    const { pin, email } = request.body;

    try {
      // Validate input
      if (!pin || !email) {
        return reply.code(400).send({
          success: false,
          error: 'PIN and email are required'
        });
      }

      // Check if reader exists with this PIN and email
      const readerResult = await readersDb.query(
        'SELECT reader_pin, reader_name, email, portal_access_status FROM readers WHERE reader_pin = $1 AND email = $2',
        [pin, email]
      );

      if (readerResult.rows.length === 0) {
        return reply.code(401).send({
          success: false,
          error: 'Invalid PIN or email'
        });
      }

      const reader = readerResult.rows[0];

      // Check if reader access is active
      if (reader.portal_access_status !== 'active' && reader.portal_access_status !== 'pending') {
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
         SET email_verification_code = $1,
             email_verification_code_expires_at = $2,
             email_verification_code_attempts = 0
         WHERE reader_pin = $3`,
        [verificationCode, expiresAt, pin]
      );

      // Log activity
      await readersDb.query(
        `INSERT INTO reader_activity_log (reader_pin, activity_type, activity_description, performed_by, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [pin, 'email_code_requested', 'Reader requested email verification code', reader.reader_name, request.ip]
      );

      // TODO: Send email with verification code
      fastify.log.info(`Email verification code for ${email}: ${verificationCode}`);

      return reply.send({
        success: true,
        message: `Verification code sent to ${email}`,
        expiresIn: 600 // 10 minutes in seconds
      });

    } catch (error) {
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
  fastify.post('/api/readers/verify-email-code', async (request, reply) => {
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
        `SELECT reader_pin, reader_name, email, reader_type,
                email_verification_code, email_verification_code_expires_at,
                email_verification_code_attempts, nda_signed,
                portal_access_status
         FROM readers
         WHERE reader_pin = $1 AND email = $2`,
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
      if (new Date() > new Date(reader.email_verification_code_expires_at)) {
        return reply.code(401).send({
          success: false,
          error: 'Verification code has expired. Please request a new one.'
        });
      }

      // Check attempts (max 3)
      if (reader.email_verification_code_attempts >= 3) {
        return reply.code(403).send({
          success: false,
          error: 'Too many failed attempts. Please request a new code.'
        });
      }

      // Verify code
      if (code !== reader.email_verification_code) {
        // Increment attempts
        await readersDb.query(
          'UPDATE readers SET email_verification_code_attempts = email_verification_code_attempts + 1 WHERE reader_pin = $1',
          [pin]
        );

        return reply.code(401).send({
          success: false,
          error: 'Invalid verification code',
          attemptsRemaining: 3 - (reader.email_verification_code_attempts + 1)
        });
      }

      // Code is valid - Generate JWT token
      const token = fastify.jwt.sign({
        pin: reader.reader_pin,
        name: reader.reader_name,
        email: reader.email,
        type: reader.reader_type,
        role: 'reader'
      });

      // Clear verification code
      await readersDb.query(
        `UPDATE readers
         SET email_verification_code = NULL,
             email_verification_code_expires_at = NULL,
             email_verification_code_attempts = 0,
             last_login = NOW(),
             last_login_ip = $1
         WHERE reader_pin = $2`,
        [request.ip, pin]
      );

      // Log successful login
      await readersDb.query(
        `INSERT INTO reader_activity_log (reader_pin, activity_type, activity_description, performed_by, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [pin, 'login_success', 'Reader logged in successfully', reader.reader_name, request.ip]
      );

      // Set cookie with token
      reply.setCookie('qolae_reader_token', token, {
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
          pin: reader.reader_pin,
          name: reader.reader_name,
          type: reader.reader_type,
          ndaSigned: reader.nda_signed
        },
        redirectTo: reader.nda_signed ? '/readers-dashboard' : '/nda-review'
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
      reply.clearCookie('qolae_reader_token', { path: '/' });

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
