# The Prince's Rescue — Interactive 2D / 3D Animation Web App

A single-file interactive web app where users help **Prince James Arthur**
walk through a land, jump an obstacle, defeat a riddle-posing **Giant** with
wit, and rescue **Princess Claida Violet**. The same story is told two ways:
a **2D Canvas** animation and a **3D Three.js** animation, both reachable from
a single homepage.

> Everything lives in **`index.html`** — one self-contained file. Open it in a
> browser and the whole app runs (Home / 2D / 3D switch in-page).

---

## Objectives

- Build an interactive web app with **pure HTML, CSS, and JavaScript** (no
  backend, no React).
- Offer a **choice** between a 2D and a 3D animation of the same original
  characters and story.
- Show understanding of **computer graphics** (transforms, easing, the
  animation loop, the scene graph, lighting, particles) and **interactive
  UI design**.

## Features

- **Homepage** with an animated hero (twinkling stars, floating clouds), a
  looping **typewriter** dialogue from James Arthur, character cards and a
  short story.
- **2D Adventure** drawn entirely with the Canvas API (no image files):
  sky, moving clouds, parallax hills, ground, a fallen log, a castle/tower,
  the giant at the gate, and the princess in the window.
- **3D Adventure** built with Three.js from primitive geometries
  (spheres, boxes, cylinders, cones), with ambient + directional lighting,
  shadows, fog, and OrbitControls (rotate / zoom).
- **Prince** controlled by the player: click **Walk** to walk him forward to the
  next checkpoint (he stops at the log, the gate, and the tower), **Jump** to
  leap, and **Wave** to wave. The prince never moves on his own — you command
  every step. Walking cycle, gravity parabolic jump (ease), and swaying cape
  included.
- **Giant** reactions: a shake + shrink on a correct answer, a stomp with
  screen/camera shake on a wrong answer, and a laugh + retreat when beaten.
- **Riddle battle**: 3 riddles chosen at random from a shared pool of 7, each
  with 3–4 multiple-choice answers, a one-time hint, and feedback text. After a
  **correct** answer a **Next** button appears for you to proceed — the battle
  never auto-advances. A **wrong** answer costs a heart.
- **Hearts** system: 3 lives; a wrong answer costs a heart; lose them all and
  a "Try Again" game-over screen appears.
- **Celebration**: confetti + floating hearts (2D) / confetti particle system
  (3D) plus a bouncing/spinning dance, then a win screen.
- **Controls**: Play / Pause, Replay, a Speed slider, and Walk / Jump / Wave
  action buttons (Walk advances the prince to the next checkpoint), and (3D)
  Camera reset. Plus a "switch to the other version" button.
- **Keyboard shortcuts**: `Space` play/pause, `J` jump, `W` walk, `V` wave,
  `R` replay, `C` camera reset (3D), and `1`–`4` to pick a riddle answer.
- **Responsive** layout for desktop and mobile.

## How to run

1. Make sure you have an internet connection (the 3D page loads **Three.js
   r128** and **OrbitControls** from the jsdelivr CDN).
2. Open **`index.html`** in any modern browser (Chrome, Edge, Firefox, Safari).
   - You can double-click the file, or serve it with any static server, e.g.:
     ```
     # from this folder
     python -m http.server 8000
     # then visit http://localhost:8000
     ```
3. Use the **Home / 2D / 3D** buttons (top right) or the big adventure buttons
   to switch views. In 2D/3D, use the control bar or the keyboard.

> If you are offline, the **Home** and **2D** views still work perfectly; only
> the **3D** view needs the CDN (it shows a friendly message if Three.js
> fails to load).

## File structure

```
index.html   ← the whole app: styles + 2D engine + 3D engine + router (inline)
README.md     ← this file
```

`index.html` is organised in three layers:

| Section | Contents |
|--------|----------|
| `<style>` | The shared fairy-tale theme (palette, fonts, cards, buttons, riddle panel, overlays, responsive rules). |
| HTML body | The top nav and three views: `#view-home`, `#view-2d`, `#view-3d`. Only one is visible at a time. |
| `<script>` 1 | Shared core: riddle data + logic, `Typewriter`, `StageUI` (HUD / dialogue / riddle panel / overlays / control bar), `RiddleBattle`. |
| `<script>` 2 | The `createAdventure2D` engine (Canvas), the `createAdventure3D` engine (Three.js), and the single-page **view router** + keyboard handler. |

The two adventures are created lazily the first time you open their view, and
their animation loops are paused when you leave — so only the active view runs.

## Computer-graphics concepts used

**2D (Canvas API)**
- **Transforms**: each character is drawn with `ctx.translate / scale / rotate`
  relative to a "feet" anchor, so the same draw code moves with the scene.
- **Parametric animation**: legs, arms and the cape swing along sine waves
  driven by a phase that advances with time.
- **Easing + gravity**: the jump is a real parabola (constant downward
  acceleration), giving natural ease-in / ease-out; squash-and-stretch on
  takeoff/landing.
- **Delta-time loop**: `requestAnimationFrame` with a `dt` (seconds) keeps motion
  frame-rate independent; the speed slider scales `dt`.
- **Particle systems**: confetti squares and heart shapes for the celebration.
- **Parallax**: clouds drift at their own rate for depth.

**3D (Three.js)**
- **Scene graph**: the prince, giant and princess are `THREE.Group`s whose
  child meshes (built from primitive geometries) are animated via their
  parents' transforms.
- **Lighting**: an ambient light plus a shadow-casting directional light.
- **Shadows**: the ground and characters receive/cast shadows.
- **Fog + sky** for atmosphere.
- **Particle system**: a `THREE.Points` confetti cloud (position + colour
  buffers) spawned and recycled during the celebration.
- **Camera**: a perspective camera with OrbitControls; a wrong answer
  temporarily shakes the orbit target for a "camera shake".
- **Transforms/animation**: leg/arm swing, parabolic jump, cape sway, giant
  breathing, scale-pulse + shake reactions, and a spin/bounce celebration dance.

## Riddles

Seven family-friendly riddles live in the shared data array. Each playthrough
picks **3 at random** (shuffled), so Replay feels different. Each riddle has a
question, 3–4 options, the correct index, a prince hint (usable once per game),
and correct/wrong feedback lines. A wrong answer costs a heart; a correct
answer reveals a **Next** button you click to continue — the prince never
auto-walks or auto-advances.

## Accessibility & UX

- Consistent navigation, colours and button styles across views.
- Tooltips on control buttons and the speed slider.
- Clear win ("The kingdom is saved!") and game-over ("Try Again") screens.
- Smooth fade transitions between views.

## Notes for graders

- **No copyrighted characters** — James Arthur, Claida Violet and the Giant
  are original.
- The code is commented and organised by concern (scene drawing, simulation,
  controls, router).
- Only external dependency is Three.js r128 + OrbitControls from the jsdelivr
  CDN (pinned to `three@0.128.0`).
