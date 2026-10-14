// Turns an image into a 512-number CLIP embedding.
// Deploy: supabase functions deploy embed-image
// Secret: supabase secrets set HF_TOKEN=hf_xxx
// Optional: set EMBED_URL to your own CLIP server (must return a 512-d vector).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { image } = await req.json();
    const bytes = Uint8Array.from(atob(image), (c) => c.charCodeAt(0));
    const url = Deno.env.get("EMBED_URL") ??
      "https://api-inference.huggingface.co/models/openai/clip-vit-base-patch32";
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("HF_TOKEN")}` },
      body: bytes,
    });
    if (!res.ok) throw new Error(await res.text());
    let emb = await res.json();
    while (Array.isArray(emb[0])) emb = emb[0];
    const norm = Math.sqrt(emb.reduce((s: number, v: number) => s + v * v, 0));
    emb = emb.map((v: number) => v / norm);
    return new Response(JSON.stringify({ embedding: emb }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
