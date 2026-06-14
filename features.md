# Fonctionnalites de DonjonFlash

## Gameplay
- Action RPG tactique top-down
- 3 classes de heros avec playstyles uniques
- Systeme de niveaux (XP + progression)
- Systeme de combo avec multiplicateur x1.25
- Salles proceduralement generees (6 types)
- Loot varié (potions, parchemins, nourriture)

## Classes
- **Guerrier** : 7 PV, epee lourde rotative (balayage de zone), Boules de Feu
- **Ranger** : 5 PV, arc long (fleches perforantes), Nova de Gel
- **Filou** : 4 PV, eventail de dagues, Boules de Feu

## Ennemis
- **Normal** : ennemi de base
- **Fast** : rapide mais fragile
- **Tank** : lent mais resistant
- **Shooter** : tire des projectiles a distance

## Salles
- **Arena** : salle ouverte
- **Pillars** : colonnes de pierre
- **Royal** : bassin central avec piliers
- **Cross** : croix tactique
- **Corridors** : couloirs etroits
- **Labyrinth** : dedale complexe

## Loot
- Potion de Soin (+1 PV)
- Potion de Vitesse (+35% vitesse, 8s)
- Fiole d'Invulnerabilite (6s)
- Parchemin de Boule de Feu (3 projectiles)
- Parchemin de Nova de Gel (gèle tous les ennemis)
- Nourriture (Gigot Roti, +1 PV)

## Audio
- Chiptune procedural (Web Audio API)
- Echelle Phrygian (ambiance sombre)
- Tempo ~166 BPM (8-bit tracker)
- Effets sonores : epee, arc, dagues, feu, gel, impact, loot, victoire, game over

## Rendu
- Canvas 2D avec textures procedurales
- Eclairage dynamique (torches)
- Particules et effets visuels
- Screen shake et hit stop
- Textes flottants

## Controles
- Fleches / ZQSD : deplacement
- Espace : attaque principale
- Shift / F : sort secondaire
- Echap / P : pause
- D-pad tactile (mobile)
