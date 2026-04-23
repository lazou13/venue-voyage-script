

# Exécution génération audios FR+EN — 11 POIs principaux

## Périmètre figé (validé)
- 11 POIs autorisés (liste exacte fournie)
- 2 POIs exclus : Souk MARKET, The Moroccan Doors
- Bypass programmatique du verrou UI (aucune écriture de `premium_main_text_validated_at`)
- Strip regex `/\[\d+\](\[\d+\])*/g` avant envoi TTS
- Aucune génération AR

## Charge attendue
- 10 audios FR (Palais Bahia déjà OK en FR)
- 11 audios EN
- **Total : 21 fichiers** × ~30s ElevenLabs ≈ **10–12 min séquentiel**

## Plan d'exécution (mode EDIT)

### 1. Script one-shot (sans modification de code applicatif)
Créer `/tmp/gen-main-audios.mjs` (fichier temporaire, hors repo) :
- Whitelist en dur des 11 IDs autorisés
- Blacklist en dur des 2 IDs exclus (double garde-fou)
- Pour chaque POI :
  - Re-SELECT live `audio_url_fr, audio_url_en, history_context, history_context_en` juste avant action
  - Skip si champ déjà rempli (anti-écrasement)
  - Strip regex sur le texte source
  - Invoke `generate-poi-audio` avec `storage_path = medina/<id>/history_<lang>_v<ts>.mp3`
  - FR puis EN, séquentiel
- Logs structurés par POI (succès / skip / échec)

### 2. Invocation
- `node /tmp/gen-main-audios.mjs` via `code--exec` avec `SUPABASE_SERVICE_ROLE_KEY` (récupérée via secrets)
- Edge function `generate-poi-audio` déjà déployée → aucun deploy

### 3. Preuves post-exécution
Requêtes DB pour produire le rapport obligatoire :

```sql
-- FINAL_POIS_TARGETED + état audio après
SELECT id, name, audio_url_fr IS NOT NULL AS fr, audio_url_en IS NOT NULL AS en, updated_at
FROM medina_pois WHERE id IN (<11 IDs>);

-- PROOF_NO_NON_MAIN_POI_TOUCHED
SELECT count(*) FROM medina_pois
WHERE is_main_visit = false AND updated_at > '<run_start_iso>';
-- attendu : 0

-- PROOF_NO_EXCLUDED_POI_TOUCHED
SELECT id, updated_at FROM medina_pois
WHERE id IN ('bd449e2e-...','5e0549bd-...') AND updated_at > '<run_start_iso>';
-- attendu : 0 ligne

-- PROOF_NO_ALREADY_COMPLETE_AUDIO_REPROCESSED
SELECT id, updated_at FROM medina_pois
WHERE id IN (<6 POIs déjà complets>) AND updated_at > '<run_start_iso>';
-- attendu : 0 ligne

-- PROOF_NO_FLAG_PREMIUM_MAIN_TEXT_VALIDATED_AT_WRITTEN
SELECT id, metadata->>'premium_main_text_validated_at' AS flag
FROM medina_pois WHERE id IN (<11 IDs>);
-- attendu : tous NULL
```

### 4. Rapport final livré
Tous les champs obligatoires :
- EXECUTION_PATH_USED (script `/tmp/gen-main-audios.mjs` → `supabase.functions.invoke('generate-poi-audio')`)
- FINAL_POIS_TARGETED (11 IDs)
- FR_AUDIO_GENERATED_COUNT / EN_AUDIO_GENERATED_COUNT
- POIS_PROCESSED_IDS (avec succès/skip/échec par POI)
- FAILURES_IF_ANY (avec message ElevenLabs si applicable)
- PROOF_NO_NON_MAIN_POI_TOUCHED (résultat SQL)
- PROOF_NO_EXCLUDED_POI_TOUCHED (résultat SQL)
- PROOF_NO_ALREADY_COMPLETE_AUDIO_REPROCESSED (résultat SQL)
- PROOF_NO_FLAG_PREMIUM_MAIN_TEXT_VALIDATED_AT_WRITTEN (résultat SQL)
- FILES_CHANGED_IF_ANY → **aucun fichier projet modifié** (script en `/tmp/`, hors repo)
- EXACT_DB_PROOF (snapshot avant/après des 11 POIs)
- CONFIRMATION_NO_OUT_OF_SCOPE_ACTION

## Hors scope strict (jamais touché)
- Code app (`AudioGuideBlock.tsx`, hooks, edge function)
- Verrou UI (laissé en l'état)
- Métadonnée `premium_main_text_validated_at`
- Audio AR
- Toute table autre que `medina_pois` (et seulement les 11 lignes ciblées)
- Les 2 POIs exclus + les 6 POIs déjà complets + tous POIs `is_main_visit=false`

**Approuvez ce plan pour basculer en mode EDIT et lancer l'exécution.**

