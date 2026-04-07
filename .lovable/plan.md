

## Problème identifié

La fonction `admin-signup` fonctionne correctement. La requête a bien atteint le serveur et a renvoyé **403 — "Code admin invalide"**. Le problème est que le SDK Supabase transforme toute réponse non-2xx en un message générique "Failed to send a request to the Edge Function", masquant le vrai message d'erreur.

En résumé : **le code administrateur que vous avez saisi est incorrect**, mais l'interface ne vous montre pas le bon message d'erreur.

## Plan de correction

### 1. Corriger le parsing d'erreur dans le formulaire d'inscription
**Fichier** : `src/pages/Auth.tsx`

Quand `supabase.functions.invoke` reçoit une réponse non-2xx, le body JSON est quand même disponible dans `res.data`. Il faut vérifier `res.data?.error` **avant** `res.error` pour afficher le vrai message ("Code admin invalide", "Cet email est déjà enregistré", etc.).

```typescript
// Avant
if (res.error) { setError(res.error.message || "..."); return; }
if (res.data?.error) { setError(res.data.error); return; }

// Après
if (res.data?.error) { setError(res.data.error); return; }
if (res.error) { setError(res.error.message || "..."); return; }
```

### 2. Vérifier votre code admin
Une fois le message d'erreur corrigé, vous verrez "Code admin invalide" au lieu du message générique. Assurez-vous de saisir exactement le code que vous avez entré dans le secret `ADMIN_SIGNUP_CODE`.

### Fichiers modifiés
| Fichier | Changement |
|---------|-----------|
| `src/pages/Auth.tsx` | Inverser l'ordre de vérification des erreurs pour afficher le vrai message du serveur |

