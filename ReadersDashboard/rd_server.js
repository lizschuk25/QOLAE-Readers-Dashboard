// ==============================================
// QOLAE READERS DASHBOARD SERVER
// ==============================================
// Purpose: Secure workspace for readers to review and correct INA reports
// Author: Liz
// Date: 28th October 2025
// ==============================================

import Fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import fastifyStatic from '@fastify/static';
import fastifyView from '@fastify/view';
import ejs from 'ejs';
import fastifyFormbody from '@fastify/formbody';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==============================================
// SSOT CONFIGURATION
// ==============================================
// Configure base URL for server-to-server calls to SSOT (API-Dashboard)
// Follows LawyersDashboard architecture pattern
const SSOT_BASE_URL = process.env.SSOT_BASE_URL || 'https://api.qolae.com';

// ==============================================
// FASTIFY SERVER INITIALIZATION
// ==============================================

const server = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

// Make SSOT_BASE_URL available to routes
server.decorate('ssotBaseUrl', SSOT_BASE_URL);

// ==============================================
// MIDDLEWARE REGISTRATION
// ==============================================

// 1. CORS Configuration (Matches LawyersDashboard pattern)
await server.register(fastifyCors, {
  origin: [
    'https://admin.qolae.com',
    'https://api.qolae.com',
    'https://readers.qolae.com',
    'https://hrcompliance.qolae.com',
    process.env.CORS_ORIGIN || 'https://readers.qolae.com'
  ],
  methods: ['GET', 'POST'],
  credentials: true,
});

// 2. JWT Authentication
await server.register(fastifyJwt, {
  secret: process.env.READERS_LOGIN_JWT_SECRET,
  cookie: {
    cookieName: 'qolaeReaderToken',
    signed: false,
  },
});

// 3. Cookie Support
await server.register(fastifyCookie);

// 4. Form Body Parser
await server.register(fastifyFormbody);

// 5. Static Files
await server.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/public/',
});

// 6. View Engine (EJS)
await server.register(fastifyView, {
  engine: {
    ejs: ejs,
  },
  root: path.join(__dirname, 'views'),
  options: {
    filename: path.join(__dirname, 'views'),
  },
});

// ==============================================
// AUTHENTICATION DECORATOR
// ==============================================
// JWT verification decorator — single source of auth for all route plugins
// @fastify/jwt is registered above — request.jwtVerify() is available
server.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
    if (request.user.role !== 'reader') {
      throw new Error('Unauthorized role');
    }
  } catch (error) {
    reply.code(401).send({ success: false, error: 'Authentication required' });
  }
});

// ==============================================
// PT-9: GLOBAL SESSION VALIDATION — preHandler
// ==============================================
// Protects ALL routes except /public/ static assets
// Uses request.jwtVerify() directly with redirect on failure
// Does NOT call fastify.authenticate (wrong failure behaviour for browsers)
server.addHook('preHandler', async (request, reply) => {
  const urlPath = request.url.split('?')[0];

  if (urlPath.startsWith('/public/')) {
    return;
  }

  try {
    await request.jwtVerify();
    if (request.user.role !== 'reader') {
      return reply.redirect('https://readers.qolae.com/readersLogin');
    }
  } catch (err) {
    return reply.redirect('https://readers.qolae.com/readersLogin');
  }
});

// ==============================================
// ROUTES REGISTRATION
// ==============================================

// Authentication is handled by ReadersLoginPortal (port 3015)
// This server (port 3008) handles the authenticated workspace only

// Reader Routes — workflow journey (dashboard, corrections, payment)
await server.register(import('./routes/readerRoutes.js'));

// NDA Workflow Routes (4-step thin proxy)
await server.register(import('./routes/ndaRoutes.js'));

// Management Hub Routes — operational home (hub, future calendar)
await server.register(import('./routes/readersManagementHubRoutes.js'));

// ==============================================
// LOGOUT ROUTE
// ==============================================
server.get('/logout', async (request, reply) => {
  try {
    reply.clearCookie('qolaeReaderToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict'
    });
    return reply.redirect('https://readers.qolae.com/readersLogin');
  } catch (error) {
    server.log.error('Logout error:', error);
    return reply.redirect('https://readers.qolae.com/readersLogin');
  }
});

// ==============================================
// ROOT ROUTE
// ==============================================

server.get('/', async (request, reply) => {
  // Redirect to ReadersLoginPortal (port 3015)
  return reply.redirect('https://readers.qolae.com/readersLogin');
});

// ==============================================
// HEALTH CHECK
// ==============================================

server.get('/health', async (request, reply) => {
  return {
    status: 'healthy',
    service: 'qolae-readers-dashboard',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  };
});

// ==============================================
// ERROR HANDLING
// ==============================================

server.setErrorHandler((error, request, reply) => {
  server.log.error(error);

  // Send appropriate error response
  reply.status(error.statusCode || 500).send({
    success: false,
    error: error.message || 'Internal Server Error',
    timestamp: new Date().toISOString(),
  });
});

// ==============================================
// SERVER START
// ==============================================

const start = async () => {
  try {
    const port = process.env.PORT || 3008;
    const host = process.env.HOST || '0.0.0.0';

    await server.listen({ port, host });

    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║   📖 QOLAE READERS DASHBOARD STARTED           ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    console.log(`📍 Server running at: http://${host}:${port}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 Database: qolae_readers`);
    console.log('');
    console.log('Available Routes:');
    console.log('  🔐 Login: https://readers.qolae.com/readersLogin (ReadersLoginPortal - port 3015)');
    console.log('  🏠 Dashboard: /readersDashboard');
    console.log('  📚 Management Hub: /readersManagementHub');
    console.log('  📅 Calendar: GET /calendar | POST /calendar/setPattern | POST /calendar/addOverride | POST /calendar/removeOverride');
    console.log('  📝 NDA Workflow: /nda/*');
    console.log('  ✏️ Save Corrections: POST /api/readers/saveCorrections');
    console.log('  📤 Submit Corrections: POST /api/readers/submitCorrections');
    console.log('  💳 Payment Processing: GET /paymentProcessing');
    console.log('  💰 Payment Status: GET /api/readers/payment/status/:assignmentId');
    console.log('  📊 Payment History: GET /readers/paymentHistory');
    console.log('  ❤️ Health Check: /health');
    console.log('');
    console.log('Ready for readers to access their workspace! 🚀');
    console.log('');

  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Start the server
start();

export default server;
