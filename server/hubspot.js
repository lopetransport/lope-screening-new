const contactUrl = 'https://api.hubapi.com/crm/v3/objects/contacts';

export function createHandler({ fetchContact = fetch, getToken = () => process.env.HUBSPOT_ACCESS_TOKEN, logger = console } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const reply = (status, message) => res.status(status).json({ success: false, message });
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return reply(405, 'Use POST to submit your sign-up.');
    }
    const origin = req.headers.origin;
    const host = req.headers.host;
    if (req.headers['sec-fetch-site'] === 'cross-site') return reply(403, 'Submit using the onboarding page.');
    if (origin) {
      try { if (new URL(origin).host !== host) return reply(403, 'Submit using the onboarding page.'); }
      catch { return reply(403, 'Invalid request origin.'); }
    }
    if (!req.headers['content-type']?.startsWith('application/json')) return reply(415, 'A JSON sign-up request is required.');
    let body;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
    catch { return reply(400, 'Invalid sign-up data.'); }
    if (!body || typeof body !== 'object') return reply(400, 'Invalid sign-up data.');
    const clean = (value, limit) => typeof value === 'string' && value.trim().length <= limit ? value.trim() : null;
    const email = clean(body.email, 254);
    const fullName = clean(body.fullName, 200);
    const phone = clean(body.phone, 30);
    const company = clean(body.company ?? '', 200);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !fullName || !phone || !/^(?:0|\+27)[6-8]\d{8}$/.test(phone) || company === null) {
      return reply(400, 'Check your name, email, South African mobile number and company, then retry.');
    }
    if (body.consents?.terms !== true || body.consents?.processing !== true || body.consents?.contact !== true) return reply(400, 'All required consent checkboxes must be selected.');
    const token = getToken()?.trim();
    if (!token) {
      logger.error('HubSpot configuration missing', { code: 'MISSING_ACCESS_TOKEN' });
      return reply(503, 'Sign-up submission is not configured yet. Please try again later.');
    }
    const [firstname, ...remaining] = fullName.split(/\s+/);
    try {
      const response = await fetchContact(contactUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: { email, firstname, lastname: remaining.join(' '), phone: phone.replace(/^0/, '+27'), company } }),
        signal: AbortSignal.timeout(15000),
      });
      if (response.status !== 200 && response.status !== 201) {
        const detail = await response.json().catch(() => null);
        const correlationId = typeof detail?.correlationId === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(detail.correlationId) ? detail.correlationId : undefined;
        logger.error('HubSpot contact submission failed', { status: response.status, correlationId });
        if (response.status === 409) return reply(409, 'A contact already exists for this email. Please contact Lope to confirm your sign-up.');
        if (response.status === 429) return reply(429, 'Sign-up is temporarily busy. Wait a moment, then retry.');
        if (response.status === 400) return reply(400, 'HubSpot rejected the contact details. Check your name, email and phone, then retry.');
        return reply(502, 'Sign-up submission failed. Please retry shortly. If it continues, contact Lope.');
      }
      const contact = await response.json();
      if (!contact?.id || !['string', 'number'].includes(typeof contact.id)) {
        logger.error('HubSpot returned an invalid contact receipt', { status: response.status });
        return reply(502, 'No contact reference was returned. Contact Lope before retrying.');
      }
      return res.status(200).json({ success: true, applicationId: String(contact.id) });
    } catch (error) {
      const reason = error?.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_OR_RESPONSE_ERROR';
      logger.error('HubSpot contact request could not be confirmed', { reason });
      return reply(502, 'Sign-up could not be confirmed. Check your connection and retry; if your email is already registered, contact Lope.');
    }
  };
}

export default createHandler();
