import { fetchGvizMapped } from './_gviz.js';

const CUSTOMER_QUERY = 'SELECT B,C,D,E,F,H,J,L,M,N,O,P WHERE T is null ORDER BY A DESC';

function mapCustomer(row) {
  return {
    id: row.customerId ?? '',
    index: row.customerIndex ?? '',
    name: row.customerName ?? '',
    phone: row.phone ?? '',
    address: row.address ?? '',
    registeredDate: row.registeredDate ?? '',
    line: row.lineId ?? '',
    email: row.email ?? '',
    type: row.customerType ?? '',
    source: row.source ?? '',
    scheduledDays: row.scheduledDays ?? '',
    lastVisitDate: row.lastVisitDate ?? '',
  };
}

function normalizePayload(body) {
  const customerName = body.customerName ?? body.name ?? [body.firstName, body.lastName].filter(Boolean).join(' ');
  return {
    ...body,
    customerName,
    updatedBy: body.updatedBy ?? 'webapp-vue',
  };
}

async function postCustomer(payload) {
  if (!process.env.APPSCRIPT_CUSTOMER_URL) {
    throw new Error('APPSCRIPT_CUSTOMER_URL is not configured');
  }

  const upstream = await fetch(process.env.APPSCRIPT_CUSTOMER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  });

  if (!upstream.ok) throw new Error(`Upstream responded ${upstream.status}`);
  return upstream.json();
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { rows, error } = await fetchGvizMapped('customers', CUSTOMER_QUERY);
    if (error) return res.status(502).json({ error });
    return res.status(200).json({ customers: rows.map(mapCustomer) });
  }

  if (req.method === 'POST') {
    const payload = normalizePayload(req.body ?? {});
    if (!payload.customerName) {
      return res.status(422).json({ error: 'Missing required fields: customerName' });
    }

    try {
      return res.status(200).json(await postCustomer(payload));
    } catch (error) {
      return res.status(502).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
