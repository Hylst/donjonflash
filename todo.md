# TODO — DonjonFlash

## Integration plateforme ✅
- [x] Corriger vite.config.ts (ajouter base: '/donjonflash/')
- [x] Ajouter SEO meta tags (og, twitter, canonical, robots)
- [x] Renommer "Donjon Flash" → "DonjonFlash" (titre, HUD, comments)
- [x] Creer about.md
- [x] Creer README.md
- [x] Creer structure.md
- [x] Creer features.md
- [x] Creer todo.md
- [x] Creer changelog.md
- [x] Build le jeu (npm run build, single-file ~2.1 MB)
- [x] Copier dist/ → donjonflash/ dans le monorepo
- [x] Copier og-image.png dans donjonflash/
- [x] Commit et push
- [ ] Generer l'image OG (manuelle)
- [ ] Deployer via Coolify

## Ameliorations futures
- [ ] Ajouter un almanach des ennemis

## Equilibre gameplay
- [x] Nerf Nova de Gel : zone limitée (rayon 250px), slow 65% pendant 2.5s au lieu de freeze total, dégâts +2
- [x] Nerf lancer de dagues (Filou) : 1 dague NV1, +1 NV5, +1 NV10 (max 3), dégâts ×2/dague
- [x] Rééquilibrer les classes : Warrior armure/crit, Ranger double tir/perçant, Rogue crit/assassinat
- [x] Ajouter modes de difficulté : Facile (standard), Normal (-25% tir, -20% PV), Difficile (-50% tir, -40% PV)
- [ ] Ajouter mode Endless (salles infinies) avec leaderboard
- [ ] Ajouter un système de sauvegarde (localStorage)

## Variete des salles
- [x] Modificateurs de salle : Piégée (dégâts périodiques), Trésor (coffres bonus), Renforcée (ennemis buffés)
- [x] Mini-boss toutes les 5 salles (tank géant + ennemis bonus)
- [x] Nouvel ennemi : Berserker (NV6+, dash rage, rapide)
- [ ] Salles plus grandes (boss rooms, arenas étendues)
- [ ] Labyrinthe avec murs plus complexes et pièges
- [ ] Ensembles de salles connectées par des couloirs
- [ ] Grilles avec clés intermédiaires (avant la clé d'or)
- [ ] Portes secondaires / secrets dans les murs
- [ ] Nouveaux types de salles : temple, forge, bibliothèque, cimetière

## Performance
- [x] Particles cap (500 max) + fillRect au lieu de arc/shadowBlur
- [x] Wall pattern caching
- [x] Floating texts cap (20 max)
- [x] Nettoyage shadowBlur yeux/piliers/shooters
- [ ] Optimiser les performances mobiles
