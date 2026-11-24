# Crónicas del Jade

A Fantasy Auto-Battler Inspired by East Asian Mythology

Crónicas del Jade is a strategic auto-battler set in an original fantasy universe inspired by the cultures, histories, and mythologies of East Asia.

After the celestial Astrolabe of Jade shattered, five great civilizations began competing to determine the fate of the world.

As a Bannerbearer, you must assemble an army of warriors, mystics, guardians, and legendary beings to conquer the Jade Conclave.

Features

* Strategic 7×8 battlefield
* Collectible heroes with unique abilities
* Faction and class synergies
* Automatic tactical combat
* Formation-based strategy
* Banner commands and battlefield modifiers
* Hero evolution system
* Economy, recruitment, and army management

The Five Civilizations

* Crimson Shogunate — Japanese-inspired warriors and spirits
* Four Heavens Dynasty — Chinese-inspired celestial cultivators
* White Moon Court — Korean-inspired royal guardians and supernatural beings
* Eternal Sky Confederation — Mongolian-inspired cavalry and steppe warriors
* Emerald Lotus Kingdom — Vietnamese-inspired river guardians and mountain spirits

Development Status

Version: 0.3.0 Alpha

The current prototype focuses on single-player combat, basic army management, and the initial roster of 12 playable heroes.

Planned Features

* Stylized 3D collectible characters
* Improved combat animations and visual effects
* Expanded hero roster
* Additional civilizations and environments
* Eight-player competitive matches
* PC and mobile optimization

Technology

Initial prototype: HTML, CSS, and JavaScript.

The project is in active development. Gameplay systems, visual assets, and technical architecture are subject to change.

---

## Prototipo jugable en el navegador

La versión actual está disponible como [`index.html`](./index.html). GitHub Pages puede publicarla desde la raíz de la rama `main`.

**Estado real:** prototipo 2D en solitario contra bots. Aún no hay ocho jugadores online, personajes 3D ni las facciones mongola y vietnamita jugables.

### Ejecutar localmente

Abre `index.html` en un navegador compatible, o sirve esta carpeta con:

```bash
python -m http.server 8000
```

Abre entonces http://localhost:8000. El prototipo funciona sin bibliotecas externas y almacena su progreso básico en el navegador.

### Desarrollo y pruebas

Requiere Node.js 22 o superior para las tareas de desarrollo (no para jugar):

```bash
npm test
npm run build
```

`npm test` verifica reglas de despliegue, sinergias, habilidades, determinismo y colisiones. `npm run build` regenera el HTML autónomo a partir de `src/engine.js`, `src/app.js`, `src/styles.css` y `src/shell.html`.

Las pruebas de interfaz opcionales necesitan Python, Playwright y Chromium:

```bash
python tests/browser_smoke.py
python tests/app_flow.py
```

### Estructura del repositorio

- `index.html` — juego jugable y portable.
- `src/engine.js` — simulador táctico determinista y catálogo de 12 personajes.
- `src/app.js` — interfaz, tienda, rondas, economía y repeticiones.
- `src/styles.css` — interfaz adaptable a PC y móviles.
- `src/shell.html` y `scripts/build.mjs` — generación del HTML independiente.
- `tests/` — validaciones del motor, flujo móvil y capturas.
- `.github/workflows/ci.yml` — comprobaciones automáticas con cada cambio.

### Próximo hito

Equilibrar encuentros mediante simulaciones, mostrar datos por unidad durante las batallas y empezar la capa de miniaturas 3D estilizadas.
