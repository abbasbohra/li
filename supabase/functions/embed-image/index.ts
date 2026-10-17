// Image -> 512-number embedding using Jina CLIP v2 (Matryoshka, truncated to 512 dims).
// Secret needed:  supabase secrets set JINA_API_KEY=jina_xxx
// Deploy:         supabase functions deploy embed-image

declare const Deno: any;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const key = Deno.env.get('JINA_API_KEY');
    if (!key) return json({ error: 'JINA_API_KEY secret is not set' }, 500);

    const { image } = await req.json();
    if (!image) return json({ error: 'No image received' }, 400);

    const res = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'jina-clip-v2',
        dimensions: 512,
        input: [{ image }],
      }),
    });
    const text = await res.text();
    if (!res.ok)
      return json(
        { error: `Jina API ${res.status}: ${text.slice(0, 300)}` },
        500,
      );

    let emb: number[] = JSON.parse(text).data[0].embedding;
    const norm = Math.sqrt(emb.reduce((s, v) => s + v * v, 0)) || 1;
    emb = emb.map(v => v / norm);
    return json({ embedding: emb });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
