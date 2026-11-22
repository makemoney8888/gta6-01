[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/makemoney8888/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/makemoney8888/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar Bay — an open-world crime story

A sun-soaked open-world crime game that runs in desktop Chrome from static
files — no build step, no network requests, every asset generated in code.

You are **Leo Marín**, a driver for hire who owes money to the wrong people in
**Solmar**, a fictional coastal city of neon nights, beachfront deals and cops
who never sleep. Drive, steal, run and fight your way through five story jobs
to buy your freedom.

## The city

- A full grid city to explore on foot and by car: roads, blocks, parks,
  plazas, a stadium, a hotel district, a market and a marina. Every block
  sits between the roads, so buildings never touch a street and chases stay
  on the asphalt.
- A beach and the sea along the south edge, with a pier, palms and animated waves.
- Live traffic cars and pedestrians who stroll the sidewalks and flee gunfire.
- Cars you can steal — walk up to one and press **E**. The driver bails, the
  law notices.
- A wanted level (0–5 stars) with Solmar PD patrol cars that chase, ram and
  try to arrest you on foot. Lose them to cool off.
- Five story missions with a contact, an intro, objectives and a payout:
  1. **First Fare** — a pickup and a drop-off for Mara Solis.
  2. **Hot Wheels** — steal a red convertible for Eddie Kwan.
  3. **Beach Run** — three parcels along the beachfront against the clock.
  4. **Heat** — lose a three-star pursuit and reach the safehouse.
  5. **The Big Score** — rob Harbor Bank, deal with Sal Perri's crew, escape
     to the Marina Docks.
- Combat: a pistol, aimed with the mouse, with rival crew who shoot back.
- A HUD with money, health, ammo, wanted stars, a live minimap, a
  speedometer, and the current objective — plus a start screen, pause, and
  busted / wasted screens. Progress (money, jobs done, best wanted level)
  saves in `localStorage`.
- Sound is synthesized live with WebAudio: engine hum, sirens, gunshots,
  crashes and mission jingles. No audio files.

## How to play

Serve `game/` with any static server (for example `node serve.ts`, then open
http://localhost:8080) and press **Enter** on the title screen.

| Key | Action |
| --- | --- |
| W A S D / Arrows | Walk, or drive when in a car |
| Shift | Run |
| E | Steal / enter a car, or get out |
| Mouse | Aim |
| Click | Shoot |
| Space | Handbrake (in a car) |
| Q | Start the next story job |
| P / Esc | Pause |
| M | Mute |

Tips: stealing a car or firing a gun in public raises your wanted level.
Police give up if they cannot see you for a while — use the side streets.
Mission markers show on the minimap as a yellow `!`.

## Screenshots

`?shot=cover` — the city, a chase and the HUD · `?shot=drive` — driving
downtown in traffic · `?shot=chase` — a three-star pursuit ·
`?shot=mission` — the bank job, trading shots with the crew. Each shot mode
stages the scene from the real simulation with a fixed seed.

## Structure

- `game/src/config.js` — tuning numbers, palette, city and character names
- `game/src/random.js` — the seeded RNG
- `game/src/city.js` — city generation, roads, buildings, collision, the coast
- `game/src/traffic.js` — traffic cars and pedestrians
- `game/src/police.js` — wanted stars and the police pursuit
- `game/src/missions.js` — the five-job story arc
- `game/src/world.js` — the player, driving, combat, the mission driver, save
- `game/src/render.js` — the city and entity renderer, camera, sunlight
- `game/src/hud.js` — HUD, minimap, menus
- `game/src/audio.js` — synthesized WebAudio sound
- `game/src/input.js` — keyboard and mouse
- `game/src/shots.js` — the staged screenshot scenes
- `game/src/main.js` — boot, the fixed-step loop, screen flow

Everything in this game — the city, the characters, the vehicles, the story —
is original. Nothing is taken from any commercial game.
