# Changelog — DonjonFlash

## [1.1.0] — 2025-06-15
### Ameliore
- Reequilibrage degats : dagues/vague epee = degats plats par NV, flèches/nova ×0.5 bonusDamage
- HP ennemis : formule exponentielle par salle (x2.5), types varies (normal, tank, berserker, shooter, fast)
- Degats ennemis scales avec la salle (1 + floor(roomLevel/4)) pour contrer armure warrior
- Nerf Nova de Gel : rayon 250px, slow 65% 2.5s, degats +2
- Nerf dagues : 1/2/3 par NV, degats plats
- Classes reequilibrees : Warrior armure/crit, Ranger double tir/percant, Rogue crit/assassinat
- Modes de difficulte : Facile, Normal, Difficile (PV/degats ajustes)
- Musique stable (AudioContext.currentTime scheduling)
### Ajoute
- Ennemi Berserker (NV6+, dash rage, rapide)
- Mini-boss toutes les 5 salles (tank geant + ennemis bonus)
- Modificateurs de salle : Piegee, Tresor, Renforcee
- Barres de timer buffs (vitesse, bouclier) sur le HUD
- Armure ennemis : reduction degats projectiles/contact avec feedback "BLOQUE!"
### Corrige
- Bug piercing flèches (toujours true → rangerPierceBonus)
- Bug armure warrior (rawDmg fixe a 1 → scaled par salle)
- Bug timer pieges (state.time % → timer dedie)
- Performances : shadowBlur elimine, particules cap 500, wall pattern caching

## [1.0.0] — 2025-06-14
### Ajoute
- Premier jeu : **DonjonFlash** (`/donjonflash/`)
- 3 classes de heros (Guerrier, Ranger, Filou)
- 6 types de salles procedurales
- 4 types d'ennemis (normal, fast, tank, shooter)
- Systeme de loot (potions, parchemins, nourriture)
- Systeme de combo avec multiplicateur
- Systeme de niveaux (XP + progression)
- Audio chiptune procedural (Web Audio API)
- Rendu Canvas 2D avec eclairage dynamique
- Controles tactiles et clavier
- Tutoriel integre (3 slides)
- Meta tags SEO complets
- Image Open Graph
