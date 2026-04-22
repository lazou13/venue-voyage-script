// =============================================================================
// LEGACY / DISABLED — DO NOT USE
// =============================================================================
// Cette Edge Function est désactivée depuis LOT-AUD-5.
//
// Raison :
//  - HPP est désormais autonome sur l'audio (LOT-AUD-1, LOT-AUD-3, LOT-AUD-4
//    validés).
//  - Tous les champs audio non nuls de medina_pois pointent vers le bucket HPP
//    (host: dtwqmrmtzfhczvjggmct).
//  - audio_irrecoverable.needs_regeneration = 0.
//  - Questrides n'est plus une dépendance active pour l'état audio courant.
//
// État :
//  - Code source historique CONSERVÉ ci-dessous (commenté) à des fins d'audit.
//  - La fonction reste déployée mais répond 410 Gone à toute invocation.
//  - Aucun cron / trigger ne l'invoque (vérifié : cron.job vide pour ce nom).
//  - L'action `pull_audio` dans n8n-proxy a été désactivée en parallèle.
//
// Ne PAS supprimer ce fichier : il sert de preuve historique de la migration.
// Pour réactiver (déconseillé), il faudrait restaurer le handler ci-dessous.
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      ok: false,
      disabled: true,
      legacy: true,
      reason:
        "pull-audio-from-questride is disabled since LOT-AUD-5. HPP is autonomous on audio; Questride is no longer an active audio dependency.",
      replaced_by: "import-audio-to-hpp (one-shot repatriation, already executed)",
      disabled_at: "2026-04-22",
    }),
    {
      status: 410, // Gone
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});

// =============================================================================
// HISTORICAL CODE (LOT-AUD-0, kept for audit trail — DO NOT EXECUTE)
// =============================================================================
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
//
// const QUESTRIDE_URL = "https://brhckhyrbpjfnieexggq.supabase.co";
// const AUDIO_FIELDS = "name,name_fr,name_en,lat,lng,audio_url_fr,audio_url_en,audio_url_ar,anecdote_audio_url_fr,anecdote_audio_url_en";
//
// (full original handler — fetched Questride medina_pois with audio URLs,
//  matched by name/GPS, and copied URLs into HPP medina_pois rows.
//  Removed from execution path on 2026-04-22; see git history for details.)
// =============================================================================
