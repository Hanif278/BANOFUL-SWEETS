// Vercel serverless proxy: browser -> /api/gas -> Google Apps Script -> Google Sheet
// The Apps Script URL and secret stay on the server (Vercel Environment Variables).
module.exports = async function handler(req, res) {
  const url = process.env.GAS_URL;
  // Browser test: open https://YOUR-SITE.vercel.app/api/gas to check the connection
  if (req.method === 'GET') {
    if (!url) return res.status(200).json({ ok: false, problem: 'GAS_URL is NOT set in Vercel Environment Variables (or you did not Redeploy after adding it)' });
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'RPC', method: 'getAllSheetsData', args: [], secret: process.env.GAS_SECRET || '' }), redirect: 'follow' });
      const t = await r.text(); let j;
      try { j = JSON.parse(t); } catch (e) { return res.status(200).json({ ok: false, problem: 'Apps Script did not return JSON. Deployment access must be "Anyone".', preview: t.slice(0, 150) }); }
      if (j.status === 'error') return res.status(200).json({ ok: false, problem: j.message });
      if (!j.data) return res.status(200).json({ ok: false, problem: 'Apps Script is running the OLD Code.gs. Paste the new Code.gs and deploy a NEW VERSION.' });
      const d = j.data;
      return res.status(200).json({ ok: true, message: 'Google Sheet connected', products: (d.products||[]).length, invoices: (d.invoices||[]).length, expenses: (d.expenses||[]).length, customers: (d.customers||[]).length });
    } catch (err) { return res.status(200).json({ ok: false, problem: String(err) }); }
  }
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'POST only' });
  if (!url) return res.status(500).json({ status: 'error', message: 'GAS_URL environment variable is not set on Vercel' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'RPC', method: body.method, args: body.args || [], secret: process.env.GAS_SECRET || '' }),
      redirect: 'follow'
    });
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch (e) {
      return res.status(502).json({ status: 'error', message: 'Apps Script returned non-JSON. Check deployment access = Anyone. ' + text.slice(0, 200) });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(json);
  } catch (err) {
    return res.status(500).json({ status: 'error', message: String(err) });
  }
};
module.exports.config = { api: { bodyParser: { sizeLimit: '4mb' } } };
