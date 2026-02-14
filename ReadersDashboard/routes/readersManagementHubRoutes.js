// ==============================================
// READERS MANAGEMENT HUB ROUTES
// ==============================================
// Purpose: Operational home base — hub bootstrap, calendar, history
// Author: Liz
// Date: 12th February 2026
// Architecture: SSOT Thin Proxy (Zero SQL, Zero import pg)
// Controller: ReadersController.js handles all SSOT fetch() calls
//
// Calendar routes added Session 124 (12th Feb 2026)
// per approved Readers Calendar plan
// ==============================================

import ReadersController from '../controllers/ReadersController.js';

export default async function readersManagementHubRoutes(fastify, opts) {

  // ==============================================
  // LOCATION BLOCK 1: MANAGEMENT HUB
  // ==============================================
  // VIEW: readersManagementHub.ejs (rendered by controller)
  // Proxy → ReadersController → SSOT /api/readers/managementHub/bootstrap

  fastify.get('/readersManagementHub', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    return await ReadersController.getReaderManagementHub(request, reply);
  });

  // ==============================================
  // LOCATION BLOCK 2: READERS CALENDAR
  // ==============================================
  // GET /calendar → renders readersCalendar.ejs (4 view layouts)
  // POST /calendar/setPattern → save weekly availability pattern
  // POST /calendar/addOverride → add date-specific override
  // POST /calendar/removeOverride → remove date-specific override
  // All routes: thin proxy via ReadersController → SSOT api.qolae.com

  fastify.get('/calendar', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    return await ReadersController.getReaderCalendar(request, reply);
  });

  fastify.post('/calendar/setPattern', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    return await ReadersController.setReaderCalendarPattern(request, reply);
  });

  fastify.post('/calendar/addOverride', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    return await ReadersController.addReaderCalendarOverride(request, reply);
  });

  fastify.post('/calendar/removeOverride', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    return await ReadersController.removeReaderCalendarOverride(request, reply);
  });

}
