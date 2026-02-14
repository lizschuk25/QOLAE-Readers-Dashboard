// ┌────────────────────────────────────────────┐
// │ QOLAE ReadersController.js                 │
// │ Author: Liz                                │
// │ Description: Thin proxy controller for     │
// │   Readers Dashboard — ALL fetch() to SSOT  │
// │   ZERO SQL. ZERO import pg. ZERO Pool.     │
// │ Active Exports:                            │
// │ 1. saveReaderCorrections                   │
// │ 2. submitReaderCorrections                 │
// │ 3. getReaderPaymentProcessing              │
// │ 4. getReaderPaymentStatus                  │
// │ 5. getReaderPaymentHistory                 │
// │ 6. getReaderManagementHub                  │
// │ 7. getReaderReviewModalData                │
// │ 8. getReaderPaymentModalData               │
// │ 9. getReaderCalendar                       │
// │ 10. setReaderCalendarPattern               │
// │ 11. addReaderCalendarOverride              │
// │ 12. removeReaderCalendarOverride           │
// │ 13. getReaderCalendarModalData             │
// └────────────────────────────────────────────┘

// SSOT Base URL (API-Dashboard)
const SSOT_BASE_URL = process.env.SSOT_BASE_URL || 'https://api.qolae.com';

// ==============================================
// EXPORTED CONTROLLER METHODS
// ==============================================

export default {

  // ──────────────────────────────────────────────
  // 1. SAVE READER CORRECTIONS (DRAFT)
  // ──────────────────────────────────────────────
  // Proxy: POST → SSOT /api/readers/corrections/save
  // ──────────────────────────────────────────────
  saveReaderCorrections: async (req, reply) => {
    const { pin } = req.user;
    const { assignmentId, corrections } = req.body;

    try {
      const apiResponse = await fetch(`${SSOT_BASE_URL}/api/readers/corrections/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readerPin: pin,
          assignmentId,
          corrections
        })
      });

      const apiData = await apiResponse.json();

      if (!apiResponse.ok) {
        return reply.code(apiResponse.status).send(apiData);
      }

      return reply.send(apiData);

    } catch (error) {
      console.error('[ReadersController] saveReaderCorrections error:', error.message);
      return reply.code(500).send({
        success: false,
        error: 'Failed to save corrections'
      });
    }
  },

  // ──────────────────────────────────────────────
  // 2. SUBMIT READER CORRECTIONS (FINAL)
  // ──────────────────────────────────────────────
  // Proxy: POST → SSOT /api/readers/corrections/submit
  // ──────────────────────────────────────────────
  submitReaderCorrections: async (req, reply) => {
    const { pin } = req.user;
    const { assignmentId } = req.body;

    try {
      const apiResponse = await fetch(`${SSOT_BASE_URL}/api/readers/corrections/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readerPin: pin,
          assignmentId
        })
      });

      const apiData = await apiResponse.json();

      if (!apiResponse.ok) {
        return reply.code(apiResponse.status).send(apiData);
      }

      return reply.send(apiData);

    } catch (error) {
      console.error('[ReadersController] submitReaderCorrections error:', error.message);
      return reply.code(500).send({
        success: false,
        error: 'Failed to submit corrections'
      });
    }
  },

  // ──────────────────────────────────────────────
  // 3. GET READER PAYMENT PROCESSING
  // ──────────────────────────────────────────────
  // Proxy: GET → SSOT /api/readers/payment/processing
  // Renders paymentProcessing.ejs with SSOT data
  // ──────────────────────────────────────────────
  getReaderPaymentProcessing: async (req, reply) => {
    const { pin } = req.user;
    const { assignmentId } = req.query;

    try {
      const apiResponse = await fetch(
        `${SSOT_BASE_URL}/api/readers/payment/processing?readerPin=${encodeURIComponent(pin)}&assignmentId=${encodeURIComponent(assignmentId)}`
      );

      const apiData = await apiResponse.json();

      if (!apiResponse.ok || !apiData.success) {
        return reply.code(apiResponse.status || 500).send({
          success: false,
          error: apiData.error || 'Failed to load payment data'
        });
      }

      const { paymentData, timeline } = apiData;

      // Render EJS view with SSOT data
      return reply.view('paymentProcessing.ejs', {
        assignmentId: paymentData.assignmentId,
        readerPin: paymentData.readerPin,
        readerName: paymentData.readerName,
        readerEmail: paymentData.readerEmail,
        readerType: paymentData.readerType,
        paymentStatus: paymentData.paymentStatus,
        paymentAmount: paymentData.paymentAmount,
        paymentReference: paymentData.paymentReference,
        assignedAt: paymentData.assignedAt,
        correctionsSubmittedAt: paymentData.correctionsSubmittedAt,
        paymentApprovedAt: paymentData.paymentApprovedAt,
        paymentProcessedAt: paymentData.paymentProcessedAt,
        timeline,
        bankName: 'Not loaded',
        accountHolderName: 'Not loaded',
        lastFourDigits: '****',
        sortCode: 'N/A',
        accountType: 'unknown',
        paymentDetailsVerified: false
      });

    } catch (error) {
      console.error('[ReadersController] getReaderPaymentProcessing error:', error.message);
      return reply.code(500).send({
        success: false,
        error: 'Failed to load payment processing'
      });
    }
  },

  // ──────────────────────────────────────────────
  // 4. GET READER PAYMENT STATUS (AUTO-REFRESH)
  // ──────────────────────────────────────────────
  // Proxy: GET → SSOT /api/readers/payment/status/:assignmentId
  // ──────────────────────────────────────────────
  getReaderPaymentStatus: async (req, reply) => {
    const { pin } = req.user;
    const { assignmentId } = req.params;

    try {
      const apiResponse = await fetch(
        `${SSOT_BASE_URL}/api/readers/payment/status/${encodeURIComponent(assignmentId)}?readerPin=${encodeURIComponent(pin)}`
      );

      const apiData = await apiResponse.json();

      if (!apiResponse.ok) {
        return reply.code(apiResponse.status).send(apiData);
      }

      return reply.send(apiData);

    } catch (error) {
      console.error('[ReadersController] getReaderPaymentStatus error:', error.message);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve payment status'
      });
    }
  },

  // ──────────────────────────────────────────────
  // 5. GET READER PAYMENT HISTORY
  // ──────────────────────────────────────────────
  // Proxy: GET → SSOT /api/readers/payment/history
  // ──────────────────────────────────────────────
  getReaderPaymentHistory: async (req, reply) => {
    const { pin } = req.user;

    try {
      const apiResponse = await fetch(
        `${SSOT_BASE_URL}/api/readers/payment/history?readerPin=${encodeURIComponent(pin)}`
      );

      const apiData = await apiResponse.json();

      if (!apiResponse.ok) {
        return reply.code(apiResponse.status).send(apiData);
      }

      return reply.send(apiData);

    } catch (error) {
      console.error('[ReadersController] getReaderPaymentHistory error:', error.message);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve payment history'
      });
    }
  },

  // ──────────────────────────────────────────────
  // 6. GET READER MANAGEMENT HUB
  // ──────────────────────────────────────────────
  // Proxy: GET → SSOT /api/readers/managementHub/bootstrap
  // Renders readersManagementHub.ejs with SSOT data
  // ──────────────────────────────────────────────
  getReaderManagementHub: async (req, reply) => {
    const { pin } = req.user;

    try {
      const apiResponse = await fetch(
        `${SSOT_BASE_URL}/api/readers/managementHub/bootstrap?readerPin=${encodeURIComponent(pin)}`
      );

      const apiData = await apiResponse.json();

      if (!apiResponse.ok || !apiData.success) {
        console.error('[ReadersController] ManagementHub SSOT failed:', apiResponse.status);
        return reply.redirect('https://readers.qolae.com/readersLogin');
      }

      return reply.view('readersManagementHub.ejs', {
        reader: apiData.reader,
        documents: apiData.documents,
        reports: apiData.reports,
        payments: apiData.payments
      });

    } catch (error) {
      console.error('[ReadersController] getReaderManagementHub error:', error.message);
      return reply.redirect('https://readers.qolae.com/readersLogin');
    }
  },

  // ──────────────────────────────────────────────
  // 7. GET READER REVIEW MODAL DATA
  // ──────────────────────────────────────────────
  // Proxy: GET → SSOT /api/readers/payment/processing
  //   (reuses same SSOT endpoint, extracts assignment data)
  // Used by GET /readersDashboard when modal=review
  // Returns: { type, assignment, reader } or null
  // ──────────────────────────────────────────────
  getReaderReviewModalData: async (readerPin, assignmentId) => {
    try {
      const apiResponse = await fetch(
        `${SSOT_BASE_URL}/api/readers/payment/processing?readerPin=${encodeURIComponent(readerPin)}&assignmentId=${encodeURIComponent(assignmentId)}`
      );

      const apiData = await apiResponse.json();

      if (!apiResponse.ok || !apiData.success) {
        return null;
      }

      const { paymentData } = apiData;

      return {
        type: 'review',
        assignment: {
          assignmentId: paymentData.assignmentId,
          readerPin: paymentData.readerPin,
          paymentStatus: paymentData.paymentStatus,
          assignedAt: paymentData.assignedAt,
          correctionsSubmittedAt: paymentData.correctionsSubmittedAt
        },
        reader: {
          readerPin: paymentData.readerPin,
          readerName: paymentData.readerName
        }
      };

    } catch (error) {
      console.error('[ReadersController] getReaderReviewModalData error:', error.message);
      return null;
    }
  },

  // ──────────────────────────────────────────────
  // 8. GET READER PAYMENT MODAL DATA
  // ──────────────────────────────────────────────
  // Proxy: GET → SSOT /api/readers/payment/processing
  // Used by GET /readersDashboard when modal=payment
  // Returns: { type, ...paymentFields } or null
  // ──────────────────────────────────────────────
  getReaderPaymentModalData: async (readerPin, assignmentId) => {
    try {
      const apiResponse = await fetch(
        `${SSOT_BASE_URL}/api/readers/payment/processing?readerPin=${encodeURIComponent(readerPin)}&assignmentId=${encodeURIComponent(assignmentId)}`
      );

      const apiData = await apiResponse.json();

      if (!apiResponse.ok || !apiData.success) {
        return null;
      }

      const { paymentData } = apiData;

      return {
        type: 'payment',
        assignmentId: paymentData.assignmentId,
        readerPin: paymentData.readerPin,
        readerName: paymentData.readerName,
        readerEmail: paymentData.readerEmail,
        readerType: paymentData.readerType,
        paymentStatus: paymentData.paymentStatus,
        paymentAmount: paymentData.paymentAmount,
        paymentReference: paymentData.paymentReference,
        assignedAt: paymentData.assignedAt,
        correctionsSubmittedAt: paymentData.correctionsSubmittedAt,
        paymentApprovedAt: paymentData.paymentApprovedAt,
        paymentProcessedAt: paymentData.paymentProcessedAt
      };

    } catch (error) {
      console.error('[ReadersController] getReaderPaymentModalData error:', error.message);
      return null;
    }
  },

  // ──────────────────────────────────────────────
  // 9. GET READER CALENDAR
  // ──────────────────────────────────────────────
  // Proxy: GET → SSOT /api/readers/calendar/resolved
  // Renders readersCalendar.ejs with resolved month data
  // ──────────────────────────────────────────────
  getReaderCalendar: async (req, reply) => {
    const { readerPin } = req.user;
    const { month, year, view, tab } = req.query;

    try {
      const params = new URLSearchParams({ readerPin });
      if (month) params.append('month', month);
      if (year) params.append('year', year);

      const apiResponse = await fetch(
        `${SSOT_BASE_URL}/api/readers/calendar/resolved?${params.toString()}`
      );

      const apiData = await apiResponse.json();

      if (!apiResponse.ok || !apiData.success) {
        console.error('[ReadersController] Calendar SSOT failed:', apiResponse.status);
        return reply.redirect('https://readers.qolae.com/readersLogin');
      }

      return reply.view('readersCalendar.ejs', {
        calendar: apiData.calendar,
        reader: apiData.reader,
        overrides: apiData.overrides,
        assignments: apiData.assignments,
        view: view || 'twoColumn',
        activeTab: tab || 'availability',
        readerPin
      });

    } catch (error) {
      console.error('[ReadersController] getReaderCalendar error:', error.message);
      return reply.redirect('https://readers.qolae.com/readersLogin');
    }
  },

  // ──────────────────────────────────────────────
  // 10. SET READER CALENDAR PATTERN
  // ──────────────────────────────────────────────
  // Proxy: POST → SSOT /api/readers/calendar/setPattern
  // Redirects back to /calendar after save
  // ──────────────────────────────────────────────
  setReaderCalendarPattern: async (req, reply) => {
    const { readerPin } = req.user;
    const { monday, tuesday, wednesday, thursday, friday, saturday, sunday, month, year, view, returnTo } = req.body;

    try {
      const apiResponse = await fetch(`${SSOT_BASE_URL}/api/readers/calendar/setPattern`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readerPin,
          monday: monday === 'on',
          tuesday: tuesday === 'on',
          wednesday: wednesday === 'on',
          thursday: thursday === 'on',
          friday: friday === 'on',
          saturday: saturday === 'on',
          sunday: sunday === 'on'
        })
      });

      if (!apiResponse.ok) {
        console.error('[ReadersController] setPattern SSOT failed:', apiResponse.status);
      }

      const params = new URLSearchParams();
      if (view) params.append('view', view);
      if (month) params.append('month', month);
      if (year) params.append('year', year);
      const qs = params.toString();

      if (returnTo === 'dashboard') {
        const dashParams = new URLSearchParams({ readerPin, showModal: 'calendar' });
        if (view) dashParams.append('view', view);
        if (month) dashParams.append('month', month);
        if (year) dashParams.append('year', year);
        return reply.redirect(`/readersDashboard?${dashParams.toString()}`);
      }

      return reply.redirect(`/calendar${qs ? '?' + qs : ''}`);

    } catch (error) {
      console.error('[ReadersController] setReaderCalendarPattern error:', error.message);
      return reply.redirect('/calendar');
    }
  },

  // ──────────────────────────────────────────────
  // 11. ADD READER CALENDAR OVERRIDE
  // ──────────────────────────────────────────────
  // Proxy: POST → SSOT /api/readers/calendar/addOverride
  // Redirects back to /calendar after save
  // ──────────────────────────────────────────────
  addReaderCalendarOverride: async (req, reply) => {
    const { readerPin } = req.user;
    const { date, type, category, reason, month, year, view, returnTo } = req.body;

    try {
      const apiResponse = await fetch(`${SSOT_BASE_URL}/api/readers/calendar/addOverride`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readerPin,
          date,
          type,
          category: category || null,
          reason: reason || null
        })
      });

      if (!apiResponse.ok) {
        console.error('[ReadersController] addOverride SSOT failed:', apiResponse.status);
      }

      const params = new URLSearchParams();
      if (view) params.append('view', view);
      if (month) params.append('month', month);
      if (year) params.append('year', year);
      const qs = params.toString();

      if (returnTo === 'dashboard') {
        const dashParams = new URLSearchParams({ readerPin, showModal: 'calendar' });
        if (view) dashParams.append('view', view);
        if (month) dashParams.append('month', month);
        if (year) dashParams.append('year', year);
        return reply.redirect(`/readersDashboard?${dashParams.toString()}`);
      }

      return reply.redirect(`/calendar${qs ? '?' + qs : ''}`);

    } catch (error) {
      console.error('[ReadersController] addReaderCalendarOverride error:', error.message);
      return reply.redirect('/calendar');
    }
  },

  // ──────────────────────────────────────────────
  // 12. REMOVE READER CALENDAR OVERRIDE
  // ──────────────────────────────────────────────
  // Proxy: POST → SSOT /api/readers/calendar/removeOverride
  // Redirects back to /calendar after removal
  // ──────────────────────────────────────────────
  removeReaderCalendarOverride: async (req, reply) => {
    const { readerPin } = req.user;
    const { date, month, year, view, returnTo } = req.body;

    try {
      const apiResponse = await fetch(`${SSOT_BASE_URL}/api/readers/calendar/removeOverride`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readerPin,
          date
        })
      });

      if (!apiResponse.ok) {
        console.error('[ReadersController] removeOverride SSOT failed:', apiResponse.status);
      }

      const params = new URLSearchParams();
      if (view) params.append('view', view);
      if (month) params.append('month', month);
      if (year) params.append('year', year);
      const qs = params.toString();

      if (returnTo === 'dashboard') {
        const dashParams = new URLSearchParams({ readerPin, showModal: 'calendar' });
        if (view) dashParams.append('view', view);
        if (month) dashParams.append('month', month);
        if (year) dashParams.append('year', year);
        return reply.redirect(`/readersDashboard?${dashParams.toString()}`);
      }

      return reply.redirect(`/calendar${qs ? '?' + qs : ''}`);

    } catch (error) {
      console.error('[ReadersController] removeReaderCalendarOverride error:', error.message);
      return reply.redirect('/calendar');
    }
  },

  // ──────────────────────────────────────────────
  // 13. GET READER CALENDAR MODAL DATA
  // ──────────────────────────────────────────────
  // Static method: called by readerRoutes.js when
  //   showModal === 'calendar' on dashboard load.
  // Fetches resolved calendar from SSOT, returns
  //   data object for EJS include (NOT req/reply).
  // Matches getReaderReviewModalData pattern.
  // ──────────────────────────────────────────────
  getReaderCalendarModalData: async (readerPin, query) => {
    const { month, year, view, tab } = query;

    try {
      const params = new URLSearchParams({ readerPin });
      if (month) params.append('month', month);
      if (year) params.append('year', year);

      const apiResponse = await fetch(
        `${SSOT_BASE_URL}/api/readers/calendar/resolved?${params.toString()}`
      );

      const apiData = await apiResponse.json();

      if (!apiResponse.ok || !apiData.success) {
        console.error('[ReadersController] Calendar modal SSOT failed:', apiResponse.status);
        return null;
      }

      return {
        type: 'calendar',
        calendar: apiData.calendar,
        overrides: apiData.overrides,
        assignments: apiData.assignments,
        view: view || 'twoColumn',
        activeTab: tab || 'availability',
        readerPin
      };

    } catch (error) {
      console.error('[ReadersController] getReaderCalendarModalData error:', error.message);
      return null;
    }
  }

};
