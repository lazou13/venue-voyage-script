// poi-watchdog — Hunt Planer Pro (qualité & surveillance)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const alerts: Array<{ type: string; severity: string; summary: string; details: Record<string, unknown> }> = [];

    // 1. Fetch all active POIs
    const { data: pois, error } = await supabase
      .from('medina_pois')
      .select('id, name, status, lat, lng, category, riddle_easy, riddle_hard, description_short, history_context, local_anecdote_fr, poi_quality_score, opening_hours, price_info, is_active')
      .eq('is_active', true)
      .not('status', 'eq', 'filtered');

    if (error) throw error;
    const all = pois ?? [];

    // 2. Validated POIs missing critical fields
    const validated = all.filter(p => p.status === 'validated');
    const validatedMissing = validated.filter(p => 
      !p.riddle_easy || !p.description_short || !p.history_context
    );
    if (validatedMissing.length > 0) {
      alerts.push({
        type: 'validated_missing_content',
        severity: 'critical',
        summary: `${validatedMissing.length} POIs validés avec contenu manquant (énigme, description ou histoire)`,
        details: { poi_ids: validatedMissing.slice(0, 20).map(p => ({ id: p.id, name: p.name })) },
      });
    }

    // 3. POIs without GPS
    const noGps = all.filter(p => p.lat == null || p.lng == null);
    if (noGps.length > 0) {
      alerts.push({
        type: 'missing_gps',
        severity: 'warning',
        summary: `${noGps.length} POIs actifs sans coordonnées GPS`,
        details: { count: noGps.length, sample: noGps.slice(0, 10).map(p => p.name) },
      });
    }

    // 4. Low quality score but validated
    const lowScore = validated.filter(p => p.poi_quality_score != null && p.poi_quality_score < 3);
    if (lowScore.length > 0) {
      alerts.push({
        type: 'low_quality_validated',
        severity: 'warning',
        summary: `${lowScore.length} POIs validés avec score qualité < 3`,
        details: { poi_ids: lowScore.map(p => ({ id: p.id, name: p.name, score: p.poi_quality_score })) },
      });
    }

    // 5. Enriched but not validated (stalled)
    const enrichedStalled = all.filter(p => p.status === 'enriched');
    if (enrichedStalled.length > 20) {
      alerts.push({
        type: 'enriched_stalled',
        severity: 'info',
        summary: `${enrichedStalled.length} POIs enrichis en attente de validation`,
        details: { count: enrichedStalled.length },
      });
    }

    // 6. Missing riddle_hard
    const noHardRiddle = all.filter(p => p.status === 'validated' && !p.riddle_hard);
    if (noHardRiddle.length > 0) {
      alerts.push({
        type: 'missing_riddle_hard',
        severity: 'warning',
        summary: `${noHardRiddle.length} POIs validés sans énigme difficile`,
        details: { count: noHardRiddle.length },
      });
    }

    // 7. Out-of-bounds POIs (outside Marrakech bounding box)
    const outOfBounds = withGps.filter(p =>
      p.lat! < 31.60 || p.lat! > 31.67 || p.lng! < -8.02 || p.lng! > -7.97
    );
    if (outOfBounds.length > 0) {
      alerts.push({
        type: 'out_of_bounds',
        severity: 'critical',
        summary: `${outOfBounds.length} POIs actifs hors de la zone Marrakech`,
        details: { pois: outOfBounds.slice(0, 20).map(p => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng })) },
      });
    }

    // 8. GPS duplicates (within 5m)
    const withGps = all.filter(p => p.lat != null && p.lng != null);
    const duplicates: string[] = [];
    for (let i = 0; i < withGps.length && duplicates.length < 10; i++) {
      for (let j = i + 1; j < withGps.length; j++) {
        const d = Math.sqrt(
          Math.pow((withGps[i].lat! - withGps[j].lat!) * 111320, 2) +
          Math.pow((withGps[i].lng! - withGps[j].lng!) * 111320 * Math.cos(withGps[i].lat! * Math.PI / 180), 2)
        );
        if (d < 5) {
          duplicates.push(`${withGps[i].name} ↔ ${withGps[j].name} (${d.toFixed(1)}m)`);
        }
      }
    }
    if (duplicates.length > 0) {
      alerts.push({
        type: 'gps_duplicates',
        severity: 'warning',
        summary: `${duplicates.length} paires de POIs à moins de 5m`,
        details: { pairs: duplicates },
      });
    }

    // Write alerts to watchdog_reports
    if (alerts.length > 0) {
      for (const alert of alerts) {
        await supabase.from('watchdog_reports').insert({
          report_type: alert.type,
          severity: alert.severity,
          summary: alert.summary,
          details: alert.details,
        });
      }
    }

    // Global stats
    const stats = {
      total: all.length,
      validated: validated.length,
      enriched: enrichedStalled.length,
      draft: all.filter(p => p.status === 'draft').length,
      classified: all.filter(p => p.status === 'classified').length,
      with_gps: withGps.length,
      with_riddle: all.filter(p => p.riddle_easy).length,
      with_anecdote: all.filter(p => p.local_anecdote_fr).length,
      alerts_count: alerts.length,
    };

    return new Response(JSON.stringify({ success: true, stats, alerts_count: alerts.length, alerts }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('poi-watchdog error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
