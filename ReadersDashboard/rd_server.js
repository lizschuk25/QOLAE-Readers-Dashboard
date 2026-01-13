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
  secret: process.env.JWT_SECRET || 'readers-secret-key-2025',
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
// ROUTES REGISTRATION
// ==============================================

// Authentication is handled by ReadersLoginPortal (port 3015)
// This server (port 3008) handles the authenticated workspace only

// Reader Routes (NDA, Reports, Corrections)
await server.register(import('./routes/readerRoutes.js'));

// ==============================================
// ROOT ROUTE
// ==============================================

server.get('/', async (request, reply) => {
  // Redirect to ReadersLoginPortal (port 3015)
  return reply.redirect('https://readers.qolae.com/readersLogin');
});

// ==============================================
// READERS MANAGEMENT HUB
// ==============================================

server.get('/readersManagementHub', async (request, reply) => {
  try {
    // Get reader from session (or JWT)
    await request.jwtVerify();
    const { pin } = request.user;

    // Fetch data from database
    const reader = await getReaderById(pin);
    const documents = await getReaderDocuments(pin);
    const reports = await getReaderReports(pin);
    const payments = await getReaderPayments(pin);

    return reply.view('readersManagementHub.ejs', {
      reader,
      documents,
      reports,
      payments
    });

  } catch (error) {
    server.log.error('Error loading Readers Management Hub:', error);
    return reply.redirect('https://readers.qolae.com/readersLogin');
  }
});

// ==============================================
// DATABASE HELPER FUNCTIONS (TODO: Move to separate file)
// ==============================================

async function getReaderById(readerPin) {
  // TODO: Implement database query
  // Example: SELECT * FROM readers WHERE reader_pin = $1
  return {
    pin: readerPin,
    name: 'Reader Name',
    email: 'reader@example.com',
    type: 'firstReader',
    totalEarnings: 0
  };
}

async function getReaderDocuments(readerPin) {
  // TODO: Implement database query
  // Example: SELECT * FROM reader_documents WHERE reader_pin = $1
  return [];
}

async function getReaderReports(readerPin) {
  // TODO: Implement database query
  // Example: SELECT * FROM reader_assignments WHERE reader_pin = $1
  return [];
}

async function getReaderPayments(readerPin) {
  // TODO: Implement database query
  // Example: SELECT * FROM reader_assignments WHERE reader_pin = $1 AND payment_status IS NOT NULL
  return [];
}

// ==============================================
// SSOT HELPER FUNCTIONS (Following LawyersDashboard Pattern)
// ==============================================

/**
 * Fetch modal workflow data from SSOT API
 * @param {string} modal - Modal type (nda, review, payment)
 * @param {string} readerPin - Reader PIN
 * @param {string} assignmentId - Assignment ID (for review/payment modals)
 * @returns {object|null} Modal workflow data or null
 */
async function fetchModalWorkflowData(modal, readerPin, assignmentId = null) {
  if (!modal || !readerPin) return null;

  const endpointMap = {
    'nda': '/api/readers/nda/workflow',
    'review': '/api/readers/review/workflow',
    'payment': '/api/readers/payment/workflow'
  };

  const endpoint = endpointMap[modal];
  if (!endpoint) {
    console.log(`[SSR] Unknown modal type: ${modal}`);
    return null;
  }

  try {
    console.log(`[SSR] Fetching ${modal} workflow data from SSOT API for Reader PIN: ${readerPin}`);

    // Build URL with required parameters
    let url = `${server.ssotBaseUrl}${endpoint}?readerPin=${encodeURIComponent(readerPin)}`;
    if (assignmentId) {
      url += `&assignmentId=${encodeURIComponent(assignmentId)}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.error(`[SSR] SSOT API error for ${modal}:`, response.status);
      return null;
    }

    const data = await response.json();

    if (!data.success) {
      console.error(`[SSR] SSOT API returned error for ${modal}:`, data.error);
      return null;
    }

    console.log(`[SSR] ✓ ${modal} workflow data fetched successfully`);
    return data;

  } catch (error) {
    console.error(`[SSR] Error fetching ${modal} workflow data:`, error.message);
    return null;
  }
}

/**
 * Build reader bootstrap data from SSOT API
 * @param {string} readerPin - Reader PIN
 * @returns {object|null} Bootstrap data or null
 */
async function buildReaderBootstrapData(readerPin) {
  try {
    console.log(`📊 [SSR] Building bootstrap data for Reader PIN: ${readerPin}`);

    // TODO: Get stored JWT token from SSOT (when implemented)
    // For now, use direct database query as fallback
    const tokenResponse = await fetch(`${server.ssotBaseUrl}/auth/getStoredToken?readerPin=${readerPin}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    }).catch(() => null);

    let accessToken = null;
    if (tokenResponse && tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      accessToken = tokenData.accessToken;
    }

    // TODO: Call SSOT bootstrap endpoint (when implemented)
    // For now, return null to trigger fallback database query
    if (accessToken) {
      const bootstrapResponse = await fetch(`${server.ssotBaseUrl}/readers/workspace/bootstrap`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (bootstrapResponse.ok) {
        const bootstrapData = await bootstrapResponse.json();
        console.log(`✅ [SSR] Bootstrap data fetched successfully for ${readerPin}`);
        return bootstrapData;
      }
    }

    console.log(`⚠️ [SSR] SSOT bootstrap not available yet, using database fallback`);
    return null;

  } catch (error) {
    console.error(`❌ [SSR] Bootstrap error for ${readerPin}:`, error.message);
    return null;
  }
}

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
    console.log('  📝 NDA Workflow: /ndaReview');
    console.log('  📄 Report Viewer: /reportViewer');
    console.log('  ✏️ Corrections Editor: /correctionsEditor');
    console.log('  💰 Payment Tracking: /paymentStatus');
    console.log('  💳 Payment Processing: /paymentProcessing');
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
