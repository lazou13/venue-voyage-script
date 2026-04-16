import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VOICE_ID = "JdwJ7jL68CWmQZuo7KgG";
const MODEL_ID = "eleven_multilingual_v2";
const VOICE_SETTINGS = {
  stability: 0.3,
  similarity_boost: 0.9,
  style: 0.85,
  use_speaker_boost: true,
  speed: 0.75,
};

const PROMPT_FR = "Tu es un narrateur élégant et raffiné. Réécris ce texte en un script audio de 30 à 60 secondes, avec un ton distingué et chaleureux, sans exclamations ni superlatifs. Supprime toutes les références bibliographiques [1][2] etc.";
const PROMPT_EN = "You are an elegant and refined narrator. Rewrite this text into a 30 to 60 second audio script, with a distinguished and warm tone, without exclamations or superlatives. Remove all bibliographic references [1][2] etc.";

async function rewriteText(text: string, lang: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

  const systemPrompt = lang === "fr" ? PROMPT_FR : PROMPT_EN;
  const resp = await fetch("https://ai-gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      max_tokens: 1000,
    }),
  });
  if (!resp.ok) throw new Error(`Rewrite failed: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || text;
}

async function generateTTS(text: string): Promise<Uint8Array> {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");

  const resp = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: VOICE_SETTINGS }),
    }
  );
  if (!resp.ok) throw new Error(`TTS failed: ${resp.status} ${await resp.text()}`);
  return new Uint8Array(await resp.arrayBuffer());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { poi_id, field, text, lang, storage_path } = await req.json();
    if (!poi_id || !field || !text || !lang || !storage_path) {
      return new Response(JSON.stringify({ error: "Missing params" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Rewrite
    console.log(`Rewriting ${field} for ${poi_id}...`);
    const rewritten = await rewriteText(text, lang);
    console.log(`Rewritten: ${rewritten.length} chars`);

    // 2. TTS
    console.log(`Generating TTS...`);
    const audio = await generateTTS(rewritten);
    console.log(`Audio: ${(audio.length / 1024).toFixed(0)} KB`);

    // 3. Upload
    const bucket = "audio-guides";
    const { error: uploadErr } = await sb.storage.from(bucket).upload(storage_path, audio, {
      contentType: "audio/mpeg",
      upsert: true,
    });
    if (uploadErr) throw new Error(`Upload: ${uploadErr.message}`);

    const { data: urlData } = sb.storage.from(bucket).getPublicUrl(storage_path);
    const publicUrl = urlData.publicUrl;

    // 4. Update DB
    const { error: dbErr } = await sb.from("medina_pois").update({ [field]: publicUrl }).eq("id", poi_id);
    if (dbErr) throw new Error(`DB: ${dbErr.message}`);

    return new Response(
      JSON.stringify({ ok: true, field, url: publicUrl, rewritten_length: rewritten.length, audio_size: audio.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error(msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
