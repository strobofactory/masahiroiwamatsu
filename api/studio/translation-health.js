import { getVercelOidcToken } from '@vercel/oidc';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  try {
    const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || await getVercelOidcToken();
    if (!token) return res.status(503).json({ ok: false, stage: 'oidc' });
    const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-5',
        messages: [{ role: 'user', content: 'Reply with exactly OK.' }],
        stream: false,
        temperature: 0,
        max_tokens: 8
      })
    });
    const data = await response.json().catch(() => ({}));
    return res.status(response.ok ? 200 : 502).json({
      ok: response.ok,
      stage: response.ok ? 'claude' : 'gateway',
      model: data?.model || null,
      reply: data?.choices?.[0]?.message?.content || null,
      error: response.ok ? null : data?.error?.message || 'AI Gateway request failed.'
    });
  } catch (error) {
    return res.status(500).json({ ok: false, stage: 'runtime', error: String(error?.message || error) });
  }
}
