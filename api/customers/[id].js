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
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'customer id is required' });

  try {
    const result = await postCustomer({
      action: 'UPDATE',
      customerId: id,
      deletedAt: new Date().toISOString(),
      updatedBy: 'webapp-vue',
    });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
}
