# Structure de DonjonFlash

```
donjon-flash-game-development/
├── index.html                    # Template HTML (source)
├── package.json                  # Deps: React 19, Vite 7, Tailwind 4
├── package-lock.json
├── tsconfig.json
├── vite.config.ts                # Config Vite + singlefile + base: '/donjonflash/'
├── public/                       # Fichiers publics
├── src/
│   ├── main.tsx                  # Point d'entree React
│   ├── App.tsx                   # Composant principal (553 lignes)
│   ├── index.css                 # Styles globaux (Orbitron, Tailwind)
│   ├── images.d.ts               # Declarations TypeScript pour images
│   ├── assets/                   # Images du jeu
│   │   ├── floor.jpg             # Texture de sol
│   │   ├── floor.png             # Texture de sol (variante)
│   │   ├── wall.jpg              # Texture de mur
│   │   ├── wall.png              # Texture de mur (variante)
│   │   ├── onboarding_1.jpg      # Image tutoriel 1
│   │   ├── onboarding_2.jpg      # Image tutoriel 2
│   │   └── onboarding_3.jpg      # Image tutoriel 3
│   ├── game/                     # Logique du jeu
│   │   ├── types.ts              # Types et interfaces (207 lignes)
│   │   ├── engine.ts             # Moteur de jeu (1199 lignes)
│   │   ├── renderer.ts           # Rendu Canvas 2D (911 lignes)
│   │   ├── audio.ts              # Audio procedural chiptune (251 lignes)
│   │   └── dimensions.ts         # Dimensions dynamiques (15 lignes)
│   └── utils/                    # Utilitaires
└── donjonflash/                  # Build final (a creer)
    ├── index.html                # Build single-file
    ├── og-image.png              # Image Open Graph
    └── favicon.png               # Favicon
```

## Architecture
- **App.tsx** : Interface React, HUD, menus, touches
- **engine.ts** : Logique du jeu (IA ennemis, collisions, loot, sorts)
- **renderer.ts** : Rendu Canvas 2D (sprites, particules, eclairage)
- **audio.ts** : Audio procedural chiptune (Web Audio API)
- **types.ts** : Types TypeScript (Player, Enemy, Wall, etc.)
- **dimensions.ts** : Dimensions dynamiques de l'ecran
