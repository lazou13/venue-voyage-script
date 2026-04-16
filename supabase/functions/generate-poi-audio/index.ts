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
    const { poi_id, field, text, storage_path } = await req.json();
    if (!poi_id || !field || !text || !storage_path) {
      return new Response(JSON.stringify({ error: "Missing params: poi_id, field, text, storage_path" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. TTS
    console.log(`Generating TTS for ${poi_id} → ${field}...`);
    const audio = await generateTTS(text);
    console.log(`Audio: ${(audio.length / 1024).toFixed(0)} KB`);

    // 2. Upload
    const bucket = "audio-guides";
    const { error: uploadErr } = await sb.storage.from(bucket).upload(storage_path, audio, {
      contentType: "audio/mpeg",
      upsert: true,
    });
    if (uploadErr) throw new Error(`Upload: ${uploadErr.message}`);

    const { data: urlData } = sb.storage.from(bucket).getPublicUrl(storage_path);
    const publicUrl = urlData.publicUrl;

    // 3. Update DB
    const { error: dbErr } = await sb.from("medina_pois").update({ [field]: publicUrl }).eq("id", poi_id);
    if (dbErr) throw new Error(`DB: ${dbErr.message}`);

    return new Response(
      JSON.stringify({ ok: true, field, url: publicUrl, audio_kb: Math.round(audio.length / 1024) }),
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
