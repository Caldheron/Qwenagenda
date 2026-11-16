# Clepsydre (PWA, ex-Qwenagenda)
Svelte + Vite + vite-plugin-pwa. Données locales (IndexedDB), aucune donnée dans le dépôt. Synchro avec Céleste via Tailscale (HTTPS).
- `npm install` puis `npm run dev` pour tester, `npm test` pour les tests, `npm run build` pour produire `dist/`.
- Publication : déposer le contenu de `dist/` dans le dossier servi par GitHub Pages (`docs/`), déploiement manuel.
- Style : `src/tokens.css` est extrait de `style.css` (Phanéïa) ; `src/app.css` n'utilise que ces jetons.
