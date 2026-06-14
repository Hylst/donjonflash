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
- [ ] Generer l'image OG
- [ ] Build le jeu (npm run build)
- [ ] Copier dist/ → donjonflash/ dans le monorepo
- [ ] Copier og-image.png dans donjonflash/
- [ ] Commit et push
- [ ] Deployer via Coolify

## Ameliorations futures
- [ ] Ajouter un mode "endless" (salles infinies)
- [ ] Ajouter un systeme de sauvegarde (localStorage)
- [ ] Ajouter des boss de fin de zone
- [ ] Ajouter un almanach des ennemis
- [ ] Optimiser les performances mobiles

## Equilibre gameplay
- [x] Nerf Nova de Gel : zone limitée (rayon 250px), slow 65% pendant 2.5s au lieu de freeze total, dégâts +2
- [x] Nerf lancer de dagues (Filou) : commence à 2 dagues, +1 toutes les 2NV (3 au NV3, 4 au NV5)
- [ ] Reequilibrer les classes : Ranger trop faible late game, Warrior bonusDamage absent

## Variete des salles
- [ ] Salles plus grandes (boss rooms, arenas etendues)
- [ ] Labyrinthe avec murs plus complexes et pieges
- [ ] Ensembles de salles connectees par des couloirs
- [ ] Pieges au sol (dallees piegees, poison, glace)
- [ ] Grilles avec cles intermediaires (avant la cle d'or)
- [ ] Portes secondaires / secrets dans les murs
- [ ] Nouveaux types de salles : temple, forge, bibliotheque, cimetiere
