// ==============================================
// Readers_server.js - Readers Login Portal Server
// QOLAE Readers Login & Authentication Hub
// THE BRIDGE: Between HRCompliance and Readers-Dashboard
// Organized by Location Block Workflow Pattern
// Author: Liz 👑
// Port: 3015
// ==============================================

// ==============================================
// LOCATION BLOCK A: IMPORTS & CONFIGURATION
// A.1: Core Dependencies & ES6 Setup
// A.2: Environment Variables
// A.3: Server Initialization
// ==============================================

// A.1: Core Dependencies & ES6 Setup
import Fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import axios from 'axios';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import fastifyView from '@fastify/view';
import cookie from '@fastify/cookie';
import ejs from 'ejs';

// ES6 module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// A.2: Environment Variables
dotenv.config({ path: `${__dirname}/.env` });

// A.3: Server Initialization
const fastify = Fastify({ logger: true });

// ==============================================
// LOCATION BLOCK B: MIDDLEWARE & PLUGINS
// B.1: CORS Configuration
// B.2: Cache-Busting Headers
// B.3: Form Body Parser
// B.4: Static File Serving
// B.5: View Engine Setup
// ==============================================

// B.1: CORS Configuration
fastify.register(cors, {
  origin: [
    'https://admin.qolae.com',
    'https://api.qolae.com',
    'https://lawyers.qolae.com',
    'https://clients.qolae.com',
    'https://hrcompliance.qolae.com',
    'https://casemanagers.qolae.com',
    'https://readers.qolae.com',
  ],
  methods: ['GET', 'POST'],
  credentials: true
});

// B.2: Cache-Busting Middleware - Prevent stale content
fastify.addHook('onRequest', async (request, reply) => {
  reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  reply.header('Pragma', 'no-cache');
  reply.header('Expires', '0');
  reply.header('Last-Modified', new Date().toUTCString());
  reply.header('ETag', `"${Date.now()}"`);
});

// B.3: Form Body Parser
fastify.register(formbody);

// B.3.1: Cookie Parser
fastify.register(cookie, {
  secret: process.env.COOKIE_SECRET || process.env.READERS_LOGIN_JWT_SECRET,
  parseOptions: {}
});

// B.4: Static File Serving (GDPR compliant)
const staticRoots = [path.join(__dirname, 'public')];
const staticPrefixes = ['/public/'];

if (process.env.CENTRAL_REPOSITORY_PATH) {
  staticRoots.push(process.env.CENTRAL_REPOSITORY_PATH);
  staticPrefixes.push('/centralRepository/');
}

fastify.register(await import('@fastify/static'), {
  root: staticRoots,
  prefix: staticPrefixes
});

// B.5: View Engine Setup
fastify.register(fastifyView, {
  engine: {
    ejs: ejs
  },
  root: path.join(__dirname, 'views')
});

// ==============================================
// LOCATION BLOCK C: AUTHENTICATION SETUP
// C.1: JWT Configuration
// C.2: JWT Verification Middleware
// C.3: Security Helper Functions
// ==============================================

// C.1: JWT Secret
const JWT_SECRET = process.env.READERS_LOGIN_JWT_SECRET;

// C.2: Middleware to verify JWT token
const authenticateToken = async (request, reply) => {
  const authHeader = request.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return reply.code(401).send({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    request.user = decoded;
  } catch (err) {
    return reply.code(403).send({ error: 'Invalid token' });
  }
};

// C.3: Security Helper Functions
import crypto from 'crypto';

function generateSecureToken() {
  return crypto.randomBytes(8).toString('hex');
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateDeviceFingerprint(req) {
  const components = [
    req.headers['user-agent'],
    req.headers['accept-language'],
    req.headers['accept-encoding']
  ].join('|');

  return crypto.createHash('sha256').update(components).digest('hex');
}

// ==============================================
// LOCATION BLOCK 1: CORE ROUTING
// 1.1: Root & Redirect Routes
// 1.2: Login Page Routes
// 1.3: 2FA Authentication Route
// 1.4: Dashboard & Logout Routes
// ==============================================

// 1.1: Root Route - Redirect to Login
fastify.get('/', async (request, reply) => {
  return reply.redirect('/readersLogin');
});

// 1.2a: Readers Login Page - Main Route with PIN Access via SSOT
fastify.get('/readersLogin', async (request, reply) => {
  const { readerPin } = request.query;
  const readerIP = request.ip;
  const userAgent = request.headers['user-agent'];

  // ═══════════════════════════════════════════════════════════
  // SCENARIO A: NO PIN = Show Login Form (Logout/Direct Access)
  // ═══════════════════════════════════════════════════════════
  if (!readerPin) {
    return reply.view('readersLogin.ejs', {
      title: 'QOLAE Readers Login',
      readerPin: '',
      readerEmail: '',
      readerName: '',
      isFirstAccess: false,
      tokenStatus: '',
      error: request.query.error || '',
      success: request.query.success || '',
      message: 'Please enter your Reader PIN and email address to log in'
    });
  }

  // ═══════════════════════════════════════════════════════════
  // SCENARIO B: HAS PIN = Email Hyperlink Flow
  // Uses SSOT endpoint /auth/readers/pinAccess
  // ═══════════════════════════════════════════════════════════

  try {
    console.log(`🔒 [SSOT] PIN Access request for: ${readerPin}`);

    const deviceFingerprint = generateDeviceFingerprint(request);

    const ssotResponse = await axios.post(`${process.env.API_BASE_URL || 'https://api.qolae.com'}/auth/readers/pinAccess`, {
      readerPin: readerPin,
      deviceFingerprint: deviceFingerprint,
      ipAddress: readerIP,
      userAgent: userAgent
    });

    const ssotData = ssotResponse.data;

    if (!ssotData.success) {
      console.log(`[SSOT] PIN Access failed: ${ssotData.error}`);
      return reply.code(401).send('Invalid Reader PIN');
    }

    console.log(`[SSOT] PIN Access successful for: ${readerPin}, isNew: ${ssotData.isNewReader}`);

    // Initialize session if it doesn't exist
    if (!request.session) {
      request.session = {};
    }

    request.session.reader = {
      readerPin: ssotData.reader.readerPin,
      email: ssotData.reader.readerEmail,
      name: ssotData.reader.readerName,
      accessToken: ssotData.token,
      tokenStatus: 'active',
      jwtToken: ssotData.token,
      deviceFingerprint: deviceFingerprint,
      isFirstAccess: ssotData.isNewReader,
      authenticated2FA: false,
      authenticatedPassword: false
    };

    // Set HTTP-only JWT cookie
    reply.setCookie('qolaeReaderToken', ssotData.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: ssotData.expiresIn * 1000,
      path: '/',
      domain: process.env.COOKIE_DOMAIN || '.qolae.com'
    });

    return reply.view('readersLogin.ejs', {
      title: 'QOLAE Readers Login',
      readerPin: ssotData.reader.readerPin,
      email: ssotData.reader.readerEmail,
      readerName: ssotData.reader.readerName,
      isFirstAccess: ssotData.isNewReader,
      tokenStatus: 'active',
      error: request.query.error || null,
      success: request.query.success || null
    });

  } catch (error) {
    console.error('❌ [SSOT] ReadersLogin error:', error.message);

    if (error.response) {
      const status = error.response.status;

      if (status === 401) {
        return reply.code(404).send('Invalid Reader PIN');
      }
      if (status === 403) {
        return reply.code(403).send(`
          <h2>Access Revoked</h2>
          <p>Your access has been revoked. Contact support@qolae.com</p>
        `);
      }
    }

    return reply.code(500).send('Internal server error');
  }
});

// 1.2b: Backward compatibility redirect
fastify.get('/login', async (request, reply) => {
  const { readerPin } = request.query;
  const redirectUrl = readerPin ? `/readersLogin?readerPin=${readerPin}` : '/readersLogin';
  return reply.redirect(redirectUrl);
});

// 1.3: 2FA Authentication Page
fastify.get('/readers2fa', async (request, reply) => {
  const sessionId = request.cookies.qolaeReaderToken;
  const codeSent = request.query.codeSent === 'true';
  const errorMsg = request.query.error ? decodeURIComponent(request.query.error) : '';

  // Default view data - always pass all variables
  const viewData = {
    title: '2-Way Authentication - QOLAE Readers Portal',
    readerPin: '',
    readerEmail: '',
    readerName: '',
    authToken: '',
    codeSent: codeSent,
    error: errorMsg,
    success: codeSent ? 'Verification code sent! Check your email inbox.' : ''
  };

  if (!sessionId) {
    viewData.error = 'No active session. Please return to login.';
    return reply.view('readers2fa.ejs', viewData);
  }

  try {
    const sessionResponse = await axios.post(
      `${process.env.API_BASE_URL || 'https://api.qolae.com'}/auth/readers/session/validate`,
      { token: sessionId }
    );

    if (!sessionResponse.data.success) {
      viewData.error = sessionResponse.data.error || 'Session invalid. Please return to login.';
      return reply.view('readers2fa.ejs', viewData);
    }

    const reader = sessionResponse.data.reader;

    viewData.readerPin = reader.readerPin || '';
    viewData.readerEmail = reader.readerEmail || '';
    viewData.readerName = reader.readerName || '';
    viewData.authToken = sessionId;

    return reply.view('readers2fa.ejs', viewData);

  } catch (error) {
    fastify.log.error('2FA page error:', error.message);
    viewData.error = 'An error occurred. Please return to login.';
    return reply.view('readers2fa.ejs', viewData);
  }
});

// 1.4a: Secure Login (Password Setup) - WITH HRCOMPLIANCE GATE
fastify.get('/secureLogin', async (req, reply) => {
  const { verified, readerPin } = req.query;
  const token = req.cookies.qolaeReaderToken;

  reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  reply.header('Pragma', 'no-cache');
  reply.header('Expires', '0');

  if (!readerPin) {
    return reply.code(400).send('Reader PIN required');
  }

  if (!token) {
    console.log('[SecureLogin] No JWT token found, redirecting to login');
    return reply.redirect(`/readersLogin?readerPin=${readerPin}&error=sessionExpired`);
  }

  try {
    const statusResponse = await axios.get(
      `${process.env.API_BASE_URL || 'https://api.qolae.com'}/auth/readers/loginStatus`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!statusResponse.data.success) {
      console.log('[SecureLogin] SSOT status check failed:', statusResponse.data.error);
      return reply.redirect(`/readersLogin?readerPin=${readerPin}&error=statusCheckFailed`);
    }

    const reader = statusResponse.data.reader;
    console.log(`[SecureLogin] SSOT status retrieved for: ${reader.readerPin}`);

    // NOTE: Compliance gate is handled at 2FA stage, not here
    // If reader reaches secureLogin, they have already passed compliance check

    const userStatus = {
      isFirstTime: !reader.passwordSetupCompleted,
      hasPassword: reader.hasPassword,
      tokenStatus: reader.pinAccessTokenStatus,
      complianceSubmitted: reader.complianceSubmitted,
      complianceApproved: reader.complianceApproved
    };

    const progressSteps = [
      { key: 'linkClicked', label: 'Email Link Clicked', completed: true },
      { key: '2faVerified', label: '2FA Verification', completed: userStatus.hasPassword || userStatus.tokenStatus === 'active' },
      { key: 'complianceSubmitted', label: 'Compliance Submitted', completed: userStatus.complianceSubmitted },
      { key: 'passwordCreated', label: 'Password Setup', completed: userStatus.hasPassword },
      { key: 'workspaceAccess', label: 'Workspace Access', completed: userStatus.tokenStatus === 'active' && userStatus.complianceApproved }
    ];

    const completedSteps = progressSteps.filter(step => step.completed).length;
    const progressPercentage = Math.round((completedSteps / progressSteps.length) * 100);

    let uiState = 'unknown';
    let welcomeMessage = '';
    let actionRequired = '';

    const isPasswordReset = req.query.reset === 'true' || req.query.forgot === 'true';
    const readerDisplayName = reader.readerName || 'Reader';

    if (isPasswordReset) {
      uiState = 'forgotPassword';
      welcomeMessage = `Reset Your Password`;
      actionRequired = 'Enter your email to receive a password reset link';
    } else if (userStatus.isFirstTime && !userStatus.hasPassword) {
      uiState = 'firstTimeSetup';
      welcomeMessage = `Welcome ${readerDisplayName}! Let's set up your secure workspace.`;
      actionRequired = 'Create your password to activate access';
    } else if (userStatus.hasPassword && userStatus.tokenStatus === 'pending') {
      uiState = 'passwordRequired';
      welcomeMessage = `Welcome back ${readerDisplayName}! Complete your setup.`;
      actionRequired = 'Create your password to activate access';
    } else if (userStatus.hasPassword && userStatus.tokenStatus === 'active') {
      uiState = 'returningUser';
      welcomeMessage = `Welcome back ${readerDisplayName}!`;
      actionRequired = 'Enter your password to access your workspace';
    } else if (userStatus.tokenStatus === 'revoked') {
      uiState = 'accessRevoked';
      welcomeMessage = `Access Revoked`;
      actionRequired = 'Contact support@qolae.com for assistance';
    }

    // Security logging (non-blocking)
    await axios.post(`${process.env.API_BASE_URL || 'https://api.qolae.com'}/auth/readers/securityLog`, {
      readerPin: readerPin,
      eventType: 'secureLoginPageAccessed',
      eventStatus: 'success',
      details: {
        uiState: uiState,
        progressPercentage: progressPercentage,
        completedSteps: completedSteps,
        isPasswordReset: isPasswordReset,
        source: 'ReadersLoginPortal'
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      riskScore: 0
    }).catch(err => console.log('[SecureLogin] Security log failed (non-blocking):', err.message));

    return reply.view('secureLogin.ejs', {
      title: 'Secure Login - QOLAE Readers Portal',
      verified: verified === 'true' || verified === true,
      readerPin: readerPin,
      state: isPasswordReset ? 'resetPassword' : (userStatus.isFirstTime ? 'createPassword' : 'loginPassword'),
      userStatus: userStatus,
      uiState: uiState,
      welcomeMessage: welcomeMessage,
      actionRequired: actionRequired,
      progressSteps: progressSteps,
      progressPercentage: progressPercentage,
      completedSteps: completedSteps,
      readerName: reader.readerName,
      readerEmail: reader.readerEmail,
      tokenStatus: userStatus.tokenStatus,
      isFirstTime: userStatus.isFirstTime,
      hasPassword: userStatus.hasPassword,
      setupCompleted: req.query.setupCompleted === 'true',
      errorMessage: req.query.error ? decodeURIComponent(req.query.error) : '',
      newDevice: req.query.newDevice === 'true',
      previousIp: req.query.previousIp || ''
    });

  } catch (error) {
    console.error('❌ SecureLogin SSOT error:', error.message);

    await axios.post(`${process.env.API_BASE_URL || 'https://api.qolae.com'}/auth/readers/securityLog`, {
      readerPin: readerPin,
      eventType: 'secureLoginError',
      eventStatus: 'failure',
      details: { error: error.message, source: 'ReadersLoginPortal' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      riskScore: 30
    }).catch(err => console.log('[SecureLogin] Error log failed (non-blocking):', err.message));

    return reply.redirect(`/readersLogin?readerPin=${readerPin}&error=secureLoginFailed`);
  }
});

// 1.4b: Logout
fastify.post('/logout', async (request, reply) => {
  return reply.send({
    success: true,
    message: 'Logged out successfully',
    redirect: '/readersLogin'
  });
});

// ==============================================
// LOCATION BLOCK 2: HELPER FUNCTIONS
// ==============================================

const checkReaderInSystem = async (readerPin) => {
  try {
    const response = await axios.get(`/api/reader/validate/${readerPin}`);
    const result = response.data;

    if (result.success && result.reader) {
      fastify.log.info(`✅ Reader found via API: ${result.reader.readerName} (${result.reader.readerPin})`);
      return {
        readerPin: result.reader.readerPin,
        email: result.reader.readerEmail,
        readerName: result.reader.readerName
      };
    } else {
      fastify.log.warn(`❌ Reader not found via API: ${readerPin}`);
      return null;
    }
  } catch (error) {
    fastify.log.error('Error checking reader via API:', error);
    return null;
  }
};

fastify.decorate('checkReaderInSystem', checkReaderInSystem);

// ==============================================
// LOCATION BLOCK 3: EXTERNAL ROUTE MODULES
// ==============================================

// ==============================================
// LOCATION BLOCK 4: SERVER STARTUP
// ==============================================

const start = async () => {
  try {
    const { default: readersAuthRoute } = await import('./routes/readersAuthRoute.js');
    await fastify.register(readersAuthRoute);

    await fastify.listen({
      port: process.env.PORT || 3015,
      host: '0.0.0.0'
    });
    const address = fastify.server.address();
    console.log(`🚀 ReadersLoginPortal bound to: ${address.address}:${address.port}`);
    fastify.log.info(`Readers Login Portal running on port ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
