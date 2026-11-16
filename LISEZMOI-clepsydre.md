# Clepsydre v0.3.0 (ex-Qwenagenda) — synchro avec Céleste

Ce dossier ne contient que les **fichiers modifiés ou nouveaux** : copie-les par-dessus ton dépôt (mêmes chemins), puis :
`npm install` (aucune dépendance nouvelle), `npm test`, `npm run build`, et remplace le contenu de `docs/` par celui de `dist/` (les polices Cinzel et EB Garamond de `docs/assets` sont régénérées par le build).
Fichiers inchangés (non fournis) : `src/main.js`, `src/Item.svelte`, `src/icons.js`, `src/tokens.css`, `package-lock.json`, `public/`.

## Nouveautés
- **Icône Clepsydre** en haut à gauche, à la place du « Q » (le médaillon de ton fichier d'icônes, version circulaire) ; marque « CLEPSYDRE », sous-titre « L'agenda de Céleste, en poche ».
- **Synchro avec Céleste** (nouveau `src/sync.js`) : Réglages → adresse de Céleste (https://…ts.net) et clé de synchro (la même que Codex, affichée dans Céleste en cliquant sur le médaillon Clepsydre). Actions, liste quotidienne et cases cochées sont synchronisées dans les deux sens, à l'ouverture, au retour sur l'appli, toutes les minutes, 4 s après une modification et via le bouton.
- **Voyant** en haut (vert = synchronisé ; doré = changements en attente ; braise = non configuré, Céleste injoignable ou clé refusée).
- **Conflit** (action modifiée des deux côtés entre deux synchros) : la plus récente gagne et une carte sur l'accueil décrit la version remplacée (bouton « Compris »).
- **Annuler** tient maintenant compte de la synchro : une action annulée est conservée comme supprimée (30 jours) pour que Céleste voie la suppression au lieu de la garder.
- Renommage Qwenagenda → Clepsydre dans les textes, le manifeste, les noms de fichiers d'export (`clepsydre-….json` / `.ics`).

## À ne pas changer
- Le nom de la base IndexedDB reste `qwenagenda` (la renommer ferait « disparaître » tes données du téléphone). Les exports JSON gardent `app: "qwenagenda"` (l'import accepte aussi `"clepsydre"`).
- Les autres PWA sur `caldheron.github.io` partagent le même espace de stockage : Clepsydre utilise sa propre base.

## Rappels
- Les **icônes PNG de l'installation PWA** (`public/icon-192.png`, `icon-512.png`, et `docs/`) ne sont pas modifiées : remplace-les par les tiennes (il y a toujours le « Q » dessus).
- `npm test` : 9 tests de synchro. `test/e2e-celeste.mjs` : deux téléphones simulés contre un vrai Céleste (`CELESTE_URL=http://127.0.0.1:7860 CELESTE_KEY=<clé de data/sync_key.txt> node test/e2e-celeste.mjs`) : synchro, deux conflits, suppression, cases, liste quotidienne, convergence, clé refusée.
- Côté Céleste, l'agenda s'affiche en lecture seule dans la colonne de gauche (Céleste v1.7.0).
