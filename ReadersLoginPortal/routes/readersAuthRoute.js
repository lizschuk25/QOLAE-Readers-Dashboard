
// ==============================================
// readersAuthRoute.js - Readers Authentication Routes
// THE BRIDGE: Readers-specific authentication routes
// Author: Liz 👑
// GDPR CRITICAL: All auth attempts must be logged
// ==============================================

// ==============================================
// LOCATION BLOCK A: IMPORTS & CONFIGURATION
// ==============================================

import axios from 'axios';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Configure axios to call the SSOT API
axios.defaults.baseURL = 'https://api.qolae.com';

// Axios response interceptor for consistent status validation
axios.interceptors.response.use(
  (response) => {
    if (response.status >= 200 && response.status < 300 && response.data === undefined) {
      console.warn('[SSOT] Response missing data payload');
    }
    return response;
  },
  (error) => {
    console.error('[SSOT] API Error:', {
      status: error.response?.status,
      message: error.response?.data?.error || error.message,
      url: error.config?.url
    });
    return Promise.reject(error);
  }
);

// ReadersDashboard baseURL for redirects
const READERS_DASHBOARD_BASE_URL = 'https://readers.qolae.com';

// JWT Secret - fail fast if not configured
const JWT_SECRET = process.env.READERS_LOGIN_JWT_SECRET || (() => {
  console.error('❌ READERS_LOGIN_JWT_SECRET not found in environment variables!');
  throw new Error('READERS_LOGIN_JWT_SECRET environment variable is required');
})();

// ==============================================
// LOCATION BLOCK B: ROUTE DEFINITIONS
// ==============================================

export default async function readersAuthRoutes(fastify, opts) {
  
  // ==============================================
  // B.1: READERS LOGIN WITH PIN (FROM EMAIL CLICK)
  // ==============================================
  
  fastify.post('/readersAuth/login', async (request, reply) => {
    const { email, readerPin } = request.body;
    const readerIP = request.ip;
    
    // 📝 GDPR Audit Log
    fastify.log.info({
      event: 'readerLoginAttempt',
      readerPin: readerPin,
      email: email,
      ip: readerIP,
      timestamp: new Date().toISOString(),
      gdprCategory: 'authentication'
    });
    
    if (!email || !readerPin) {
      return reply.code(302).redirect(`/readersLogin?readerPin=${readerPin || ''}&error=${encodeURIComponent('Email and Reader PIN are required')}`);
    }
    
    try {
      // Validate Reader PIN format first
      const pinValidation = await axios.post('/api/pin/validate', {
        pin: readerPin,
        userType: 'reader'
      });
      
      if (!pinValidation.data.validation.isValid) {
        fastify.log.warn({
          event: 'invalidPinFormat',
          readerPin: readerPin,
          errors: pinValidation.data.validation.errors
        });

        return reply.code(302).redirect(`/readersLogin?readerPin=${readerPin}&error=${encodeURIComponent('Invalid Reader PIN format')}`);
      }
      
      // Call SSOT API for authentication
      const apiResponse = await axios.post('/auth/readers/requestToken', {
        readerEmail: email,
        readerPin,
        source: 'readers-portal',
        ip: readerIP
      });

      if (apiResponse.data.success) {
        fastify.log.info({
          event: 'readerLoginSuccess',
          readerPin: readerPin,
          complianceSubmitted: apiResponse.data.reader.complianceSubmitted
        });

        try {
          const jwtToken = request.cookies?.qolaeReaderToken;

          if (!jwtToken) {
            fastify.log.warn({
              event: 'loginNoJWT',
              readerPin: readerPin,
              gdprCategory: 'authentication'
            });
            return reply.code(302).redirect(`/readersLogin?readerPin=${readerPin}&error=${encodeURIComponent('Session expired. Please click your PIN link again.')}`);
          }

          // Validate JWT token via SSOT
          const validationResponse = await axios.post(
            `${process.env.API_BASE_URL || 'https://api.qolae.com'}/auth/readers/session/validate`,
            { token: jwtToken }
          );

          if (!validationResponse.data.success || !validationResponse.data.valid) {
            fastify.log.warn({
              event: 'loginInvalidJWT',
              readerPin: readerPin,
              error: validationResponse.data.error || 'Invalid token',
              gdprCategory: 'authentication'
            });
            return reply.code(302).redirect(`/readersLogin?readerPin=${readerPin}&error=${encodeURIComponent('Session expired. Please click your PIN link again.')}`);
          }

          // Verify PIN matches JWT payload
          const readerData = validationResponse.data.reader;
          if (readerData.readerPin !== readerPin) {
            fastify.log.info({
              event: 'loginPinMismatch',
              expectedPin: readerData.readerPin,
              providedPin: readerPin,
              action: 'clearingOldCookie',
              gdprCategory: 'authentication'
            });
            reply.clearCookie('qolaeReaderToken', {
              path: '/',
              domain: process.env.COOKIE_DOMAIN || '.qolae.com'
            });
            return reply.code(302).redirect(`/readersLogin?readerPin=${readerPin}`);
          }

          fastify.log.info({
            event: 'jwtValidated',
            readerPin: readerPin,
            expiresAt: validationResponse.data.expiresAt,
            gdprCategory: 'authentication'
          });

          // Redirect to 2FA page
          return reply.code(302).redirect('/readers2fa');

        } catch (sessionError) {
          fastify.log.error({
            event: 'sessionCreationError',
            readerPin: readerPin,
            error: sessionError.message,
            stack: sessionError.stack
          });

          return reply.code(302).redirect(`/readersLogin?readerPin=${readerPin}&error=${encodeURIComponent('Failed to create session. Please try again.')}`);
        }
      } else {
        fastify.log.warn({
          event: 'readerLoginFailed',
          readerPin: readerPin,
          error: apiResponse.data.error
        });

        return reply.code(302).redirect(`/readersLogin?readerPin=${readerPin}&error=${encodeURIComponent(apiResponse.data.error || 'Authentication failed')}`);
      }
    } catch (err) {
      fastify.log.error({
        event: 'readerLoginError',
        readerPin: readerPin,
        error: err.message,
        stack: err.stack
      });
      
      if (err.response?.data?.error) {
        return reply.code(302).redirect(`/readersLogin?readerPin=${readerPin}&error=${encodeURIComponent(err.response.data.error)}`);
      }

      return reply.code(302).redirect(`/readersLogin?readerPin=${readerPin || ''}&error=${encodeURIComponent('Authentication service unavailable. Please try again.')}`);
    }
  });
  
  // ==============================================
  // B.2: REQUEST EMAIL VERIFICATION CODE
  // ==============================================

  fastify.post('/readersAuth/requestEmailCode', async (request, reply) => {
    const readerIP = request.ip;
    const sessionId = request.cookies?.qolaeReaderToken;

    if (!sessionId) {
      fastify.log.warn({
        event: 'verificationCodeRequestNoSession',
        ip: readerIP,
        gdprCategory: 'authentication'
      });

      return reply.code(302).redirect('/readersLogin?error=' + encodeURIComponent('No active session. Please log in again.'));
    }

    try {
      const ssotResponse = await axios.post(
        `${process.env.API_BASE_URL || 'https://api.qolae.com'}/auth/readers/2fa/requestCode`,
        {
          ipAddress: readerIP,
          userAgent: request.headers['user-agent']
        },
        {
          headers: {
            'Authorization': `Bearer ${sessionId}`
          }
        }
      );

      const ssotData = ssotResponse.data;

      if (ssotData.success) {
        fastify.log.info({
          event: 'verificationCodeRequested',
          readerPin: ssotData.reader?.readerPin,
          email: ssotData.reader?.readerEmail,
          sessionId: sessionId.substring(0, 10) + '...',
          gdprCategory: 'authentication'
        });

        return reply.code(302).redirect('/readers2fa?codeSent=true');
      } else {
        fastify.log.warn({
          event: 'verificationCodeRequestApiFailed',
          error: ssotData.error,
          gdprCategory: 'authentication'
        });

        return reply.code(302).redirect('/readers2fa?error=' + encodeURIComponent(ssotData.error || 'Failed to send verification code'));
      }
    } catch (err) {
      if (err.response) {
        const status = err.response.status;
        const errorData = err.response.data;

        if (status === 401) {
          fastify.log.warn({
            event: 'verificationCodeRequestInvalidSession',
            error: errorData.error,
            ip: readerIP,
            gdprCategory: 'authentication'
          });

          return reply.code(302).redirect('/readersLogin?error=' + encodeURIComponent(errorData.error || 'Session invalid. Please log in again.'));
        }
      }

      fastify.log.error({
        event: 'verificationCodeRequestError',
        error: err.message,
        stack: err.stack,
        gdprCategory: 'authentication'
      });

      return reply.code(302).redirect('/readers2fa?error=' + encodeURIComponent('Verification code service unavailable'));
    }
  });
  
  // ==============================================
  // B.3: 2FA VERIFICATION
  // ==============================================

  fastify.post('/readersAuth/verify2fa', async (request, reply) => {
    const { verificationCode } = request.body;
    const readerIP = request.ip;

    fastify.log.info({
      event: '2faVerificationAttempt',
      ip: readerIP,
      timestamp: new Date().toISOString(),
      gdprCategory: 'authentication'
    });

    const sessionId = request.cookies?.qolaeReaderToken;

    if (!sessionId) {
      fastify.log.warn({
        event: '2faVerificationNoSession',
        ip: readerIP,
        gdprCategory: 'authentication'
      });

      return reply.code(302).redirect('/readersLogin?error=' + encodeURIComponent('No active session. Please log in again.'));
    }

    if (!verificationCode) {
      return reply.code(302).redirect('/readers2fa?error=' + encodeURIComponent('Verification code required'));
    }

    try {
      const ssotResponse = await axios.post(
        `${process.env.API_BASE_URL || 'https://api.qolae.com'}/auth/readers/2fa/verifyCode`,
        {
          verificationCode: verificationCode,
          ipAddress: readerIP,
          userAgent: request.headers['user-agent']
        },
        {
          headers: {
            'Authorization': `Bearer ${sessionId}`
          }
        }
      );

      const ssotData = ssotResponse.data;

      if (ssotData.success) {
        const readerPin = ssotData.reader.readerPin;
        const readerData = ssotData.reader;
        const jwtToken = ssotData.accessToken;

        console.log(`🔑 JWT token received from SSOT for Reader PIN: ${readerPin}`);

        fastify.log.info({
          event: '2faVerificationSuccess',
          readerPin: readerPin,
          complianceSubmitted: readerData.complianceSubmitted,
          sessionId: sessionId.substring(0, 10) + '...',
          jwtReceived: !!jwtToken,
          gdprCategory: 'authentication'
        });

        // ═══════════════════════════════════════════════════════════
        // HRCOMPLIANCE GATE CHECK
        // Readers MUST complete compliance before password setup
        // ═══════════════════════════════════════════════════════════
        if (!readerData.complianceSubmitted) {
          console.log(`[2FA] Reader ${readerPin} needs compliance - redirecting to HRCompliance`);
          return reply.code(302).redirect(`${process.env.HRCOMPLIANCE_URL || 'https://hrcompliance.qolae.com'}/readersCompliance?readerPin=${readerPin}`);
        }

        // Redirect based on password setup status (matches Lawyers/Clients pattern)
        if (ssotData.passwordSetupCompleted) {
          return reply.code(302).redirect(`/secureLogin?readerPin=${readerPin}&setupCompleted=true`);
        } else {
          return reply.code(302).redirect(`/secureLogin?readerPin=${readerPin}&verified=true`);
        }
      } else {
        fastify.log.warn({
          event: '2faVerificationFailed',
          error: ssotData.error,
          gdprCategory: 'authentication'
        });

        return reply.code(302).redirect('/readers2fa?error=' + encodeURIComponent(ssotData.error || '2FA verification failed'));
      }
    } catch (err) {
      if (err.response) {
        const status = err.response.status;
        const errorData = err.response.data;

        if (status === 401) {
          fastify.log.warn({
            event: '2faVerificationInvalidSession',
            error: errorData.error,
            ip: readerIP,
            gdprCategory: 'authentication'
          });

          if (errorData.redirect) {
            return reply.code(302).redirect('/readersLogin?error=' + encodeURIComponent(errorData.error || 'Session invalid. Please log in again.'));
          }

          return reply.code(302).redirect('/readers2fa?error=' + encodeURIComponent(errorData.error || 'Invalid verification code'));
        }
      }

      fastify.log.error({
        event: '2faVerificationError',
        error: err.message,
        stack: err.stack,
        gdprCategory: 'authentication'
      });

      return reply.code(302).redirect('/readers2fa?error=' + encodeURIComponent('2FA verification service unavailable'));
    }
  });

  // ==============================================
  // B.4: SECURE LOGIN - PASSWORD SETUP/VERIFY
  // ==============================================

  fastify.post('/readersAuth/secureLogin', async (request, reply) => {
    const { password, passwordConfirm, isNewUser, reset, readerPin } = request.body;
    const readerIP = request.ip;

    fastify.log.info({
      event: 'secureLoginAttempt',
      isNewUser: isNewUser,
      reset: reset,
      ip: readerIP,
      timestamp: new Date().toISOString(),
      gdprCategory: 'authentication'
    });

    const jwtToken = request.cookies?.qolaeReaderToken;

    if (!jwtToken) {
      fastify.log.warn({
        event: 'secureLoginNoSession',
        ip: readerIP,
        gdprCategory: 'authentication'
      });

      return reply.code(302).redirect('/readersLogin?error=' + encodeURIComponent('Session expired. Please click your PIN link again.'));
    }

    if (!password) {
      return reply.code(302).redirect(`/secureLogin?readerPin=${readerPin || ''}&error=` + encodeURIComponent('Password is required'));
    }

    // Server-side password match validation (for new users and password reset)
    if (passwordConfirm && password !== passwordConfirm) {
      fastify.log.warn({
        event: 'passwordMismatch',
        readerPin: readerPin,
        ip: readerIP,
        gdprCategory: 'authentication'
      });
      return reply.code(302).redirect(`/secureLogin?readerPin=${readerPin || ''}&error=${encodeURIComponent('Passwords do not match. Please try again.')}`);
    }

    const isReset = reset === 'true' || reset === true;

    try {
      const endpoint = isReset
        ? '/auth/readers/passwordReset'
        : (isNewUser === 'true' || isNewUser === true)
          ? '/auth/readers/passwordSetup'
          : '/auth/readers/passwordVerify';

      console.log(`🔐 Calling SSOT ${endpoint}`);

      // passwordReset takes PIN in body (no JWT auth header needed)
      // passwordSetup and passwordVerify use JWT auth header
      const requestBody = isReset
        ? { readerPin: readerPin, password: password, ipAddress: readerIP, userAgent: request.headers['user-agent'] }
        : { password: password, ipAddress: readerIP, userAgent: request.headers['user-agent'] };

      const requestConfig = isReset
        ? {}
        : { headers: { 'Authorization': `Bearer ${jwtToken}` } };

      const ssotResponse = await axios.post(
        `${process.env.API_BASE_URL || 'https://api.qolae.com'}${endpoint}`,
        requestBody,
        requestConfig
      );

      const ssotData = ssotResponse.data;

      if (ssotData.success) {
        if (ssotData.accessToken) {
          reply.setCookie('qolaeReaderToken', ssotData.accessToken, {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24
          });

          const opType = isReset ? 'reset' : (isNewUser ? 'setup' : 'verify');
          console.log(`🔑 Updated JWT cookie after password ${opType}`);
        }

        const eventName = isReset ? 'passwordResetSuccess' : (isNewUser ? 'passwordSetupSuccess' : 'passwordVerifySuccess');
        fastify.log.info({
          event: eventName,
          readerPin: ssotData.reader?.readerPin,
          gdprCategory: 'authentication'
        });

        // Redirect to Dashboard
        const ssotReaderPin = ssotData.reader?.readerPin;
        if (!ssotReaderPin) {
          return reply.code(302).redirect(`/secureLogin?readerPin=${readerPin || ''}&error=` + encodeURIComponent('Session data incomplete'));
        }
        return reply.code(302).redirect(`/readersDashboard?readerPin=${encodeURIComponent(readerPin)}`);

      } else {
        fastify.log.warn({
          event: isNewUser ? 'passwordSetupFailed' : 'passwordVerifyFailed',
          error: ssotData.error,
          gdprCategory: 'authentication'
        });

        return reply.code(302).redirect(`/secureLogin?readerPin=${readerPin || ''}&error=` + encodeURIComponent(ssotData.error || 'Password operation failed'));
      }

    } catch (err) {
      if (err.response) {
        const status = err.response.status;
        const errorData = err.response.data;

        if (status === 401) {
          const apiError = errorData.error || '';
          const isInvalidPassword = apiError.toLowerCase().includes('invalid password');

          fastify.log.warn({
            event: isInvalidPassword ? 'secureLoginInvalidPassword' : 'secureLoginInvalidSession',
            error: apiError,
            ip: readerIP,
            gdprCategory: 'authentication'
          });

          if (isInvalidPassword) {
            const resetParam = isReset ? '&reset=true' : '';
            return reply.code(302).redirect('/secureLogin?readerPin=' + encodeURIComponent(readerPin || '') + resetParam + '&error=' + encodeURIComponent('Invalid password. Please try again.'));
          }
          return reply.code(302).redirect('/readersLogin?error=' + encodeURIComponent('Session expired. Please click your PIN link again.'));
        }

        if (status === 409) {
          return reply.code(302).redirect(`/secureLogin?readerPin=${readerPin || ''}&setupCompleted=true&error=` + encodeURIComponent('Password already set up. Please enter your password.'));
        }
      }

      fastify.log.error({
        event: 'secureLoginError',
        error: err.message,
        stack: err.stack,
        gdprCategory: 'authentication'
      });

      return reply.code(302).redirect(`/secureLogin?readerPin=${readerPin || ''}&error=` + encodeURIComponent('Authentication service unavailable'));
    }
  });
  
  // ==============================================
  // B.5: LOGOUT
  // ==============================================

  fastify.post('/readersAuth/logout', async (request, reply) => {
    const jwtToken = request.cookies?.qolaeReaderToken;
    const readerIP = request.ip;

    fastify.log.info({
      event: 'readerLogoutRequest',
      hasToken: !!jwtToken,
      ip: readerIP,
      timestamp: new Date().toISOString(),
      gdprCategory: 'authentication'
    });

    if (jwtToken) {
      try {
        fastify.log.info({
          event: 'jwtCleared',
          gdprCategory: 'authentication'
        });
      } catch (err) {
        fastify.log.error({
          event: 'logoutError',
          error: err.message
        });
      }
    }

    reply.header('Set-Cookie', 'qolaeReaderToken=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');

    return reply.send({
      success: true,
      redirect: '/readersLogin'
    });
  });
  
  // ==============================================
  // B.6: SESSION CHECK
  // ==============================================
  
  fastify.get('/readersAuth/session', async (request, reply) => {
    return reply.send({
      success: true,
      authenticated: !!request.headers.authorization
    });
  });

}
