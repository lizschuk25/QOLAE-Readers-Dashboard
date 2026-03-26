// ==============================================
// QOLAE READERS DASHBOARD SERVER
// ==============================================
// Purpose: Secure workspace for readers to review and correct INA reports
// Author: Liz
// Date: 28th October 2025
// ==============================================

import 'dotenv/config';
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
import ssotFetch from './utils/ssotFetch.js';
import sessionMiddleware from './middleware/sessionMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==============================================
// SSOT CONFIGURATION
// ==============================================
// SSOT_BASE_URL now centralised in utils/ssotFetch.js
// All route files import ssotFetch directly

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
  sign: { algorithm: 'HS256' },
  verify: { algorithms: ['HS256'] },
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

// SSOT-compliant session validation (replaces inline jwtVerify preHandler + authenticate decorator)
server.addHook('preHandler', sessionMiddleware);

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
    const pin = request.user?.readerPin;
    if (pin) {
      try {
        await ssotFetch('/auth/invalidateSession', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userType: 'readers', pin })
        });
      } catch (invalidateError) {
        console.error('Session invalidation failed:', invalidateError.message);
      }
    }

    reply.clearCookie('qolaeReaderToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      domain: '.qolae.com'
    });
    return reply.redirect('https://readers.qolae.com/readersLogin');
  } catch (error) {
    console.error('Logout error:', error.message);
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

    server.log.info(`ReadersDashboard running on port ${port}`);

  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Start the server
start();

export default server;
