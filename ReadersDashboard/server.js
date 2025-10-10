// ==============================================
// QOLAE READERS DASHBOARD SERVER
// ==============================================
// Purpose: Secure workspace for readers to review and correct INA reports
// Author: Liz
// Date: October 7, 2025
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
dotenv.config({ path: path.join(process.cwd(), '..', '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// 1. CORS Configuration
await server.register(fastifyCors, {
  origin: process.env.CORS_ORIGIN || 'https://readers.qolae.com',
  credentials: true,
});

// 2. JWT Authentication
await server.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'readers-secret-key-2025',
  cookie: {
    cookieName: 'qolae_reader_token',
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

// Authentication Routes
await server.register(import('./routes/authRoutes.js'));

// Reader Routes (NDA, Reports, Corrections)
await server.register(import('./routes/readerRoutes.js'));

// ==============================================
// ROOT ROUTE
// ==============================================

server.get('/', async (request, reply) => {
  return reply.redirect('/readers-login');
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
    console.log('  🔐 Login: /readers-login');
    console.log('  🏠 Dashboard: /readers-dashboard');
    console.log('  📝 NDA Workflow: /nda-review');
    console.log('  📄 Report Viewer: /report-viewer');
    console.log('  ✏️ Corrections Editor: /corrections-editor');
    console.log('  💰 Payment Tracking: /payment-status');
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
