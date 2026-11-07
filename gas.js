// Vercel serverless proxy: browser -> /api/gas -> Google Apps Script -> Google Sheet
// The Apps Script URL and secret stay on the server (Vercel Environment Variables).
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'POST only' });
  const url = process.env.GAS_URL;
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
