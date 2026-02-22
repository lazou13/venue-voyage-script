

## Plan : Road Book Client dans l'onglet Exports

### Objectif
Ajouter un onglet "Road Book" dans les exports qui genere un document destine aux clients (joueurs). C'est le guide qu'on remet aux participants avant ou pendant la quete : il contient l'histoire, les regles, le parcours etape par etape avec les indices, et les informations pratiques.

### Contenu du Road Book Client

1. **Page de couverture** : Titre de la quete (i18n), lieu, theme, avatar narrateur (si storytelling actif), duree estimee, difficulte
2. **Regles du jeu** : Mode de jeu (solo/equipe), scoring (points, penalites), nombre d'indices disponibles, conditions de victoire
3. **L'histoire** : Synopsis de la quete (story_i18n) dans la langue principale, avec l'avatar narrateur
4. **Le parcours** : Pour chaque etape/POI :
   - Numero et nom
   - Zone / lieu
   - Type d'interaction (enigme, QCM, photo, etc.)
   - Contenu texte (contentI18n) dans la langue principale
   - Nombre d'indices disponibles
   - Points a gagner
5. **Informations pratiques** : Langues disponibles, zones interdites, consignes de securite (pour route_recon)
6. **Bon jeu !** : Message de cloture

### Fichiers a modifier

**1. `src/lib/outputGenerators.ts`**
- Ajouter une fonction `generateRoadBook(data: OutputData): string`
- Genere un Markdown structure et agreable a lire, oriente joueur (pas technique)
- Utilise les donnees i18n (titre, histoire, contenu des etapes)
- Inclut les regles de scoring, indices, et le parcours complet
- Adapte selon le type de projet (establishment, tourist_spot, route_recon)

**2. `src/components/intake/OutputsStep.tsx`**
- Ajouter un onglet "Road Book" dans le tableau `outputs`
- Memes boutons que les autres exports (Copier, Telecharger .md)
- Disponible pour tous les types de projet
- Positionne apres "Compte-rendu" (ou apres "Prompt" pour route_recon)

### Exemple de rendu (extrait)

```text
# Quest : Le Mystere du Riad Perdu
## Hotel & Spa Marrakech

Duree estimee : 45 min | Difficulte : 3/5 | Mode : Equipes

---

## Votre mission

Votre narrateur Youssef vous accueille...
[story_i18n.fr]

---

## Regles

- Chaque etape rapporte 10 points
- Utiliser un indice coute -2 points  
- 3 indices max par etape
- Temps limite : aucun

---

## Parcours (12 etapes)

### Etape 1 — Accueil Reception
Zone : Hall d'entree
[contenu de l'etape]
Indices disponibles : 2 | Points : 10

### Etape 2 — ...
```

### Resume des fichiers

| Fichier | Action |
|---|---|
| `src/lib/outputGenerators.ts` | Modifier - ajouter `generateRoadBook()` |
| `src/components/intake/OutputsStep.tsx` | Modifier - ajouter onglet Road Book |

