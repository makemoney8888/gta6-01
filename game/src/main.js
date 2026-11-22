// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between four
// screens: title, play, paused and game over (busted / wasted).
//
// ?seed=N fixes the city. ?shot=cover|drive|chase|mission (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.

import { STEP } from './config.js';
import { createWorld, EVENT_BUSTED, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const hud = createHud();
const audio = createAudio();

function runShot(name) {
  const { world, screen } = stageShot(name);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, screen, world.state.time);
    hud.drawHud(renderer.ctx, world.state, renderer.width, renderer.height, world.state.time, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const world = createWorld(seed);
  const input = createInput(canvas);
  const hasSave = world.loadSave();
  let screen = SCREEN_TITLE;
  let overKind = 'wasted';
  let accumulator = 0;
  let last = performance.now();
  let time = 0;
  let prompt = null;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.state.player.health = 100;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Solmar Bay.');
  }

  function endGame(kind) {
    overKind = kind;
    screen = SCREEN_OVER;
    world.save();
    audio.setSiren(false);
    audio.setEngine(0, false);
    announce(kind === 'busted' ? 'Busted by the Solmar PD.' : 'Wasted in Solmar.');
  }

  /** The aim point in world coordinates, from the mouse position on screen. */
  function aimPoint() {
    const cam = world.state.camera;
    const scale = renderer.width / (1280 / cam.zoom);
    const wx = cam.x + (input.mouse.x - renderer.width / 2) / scale;
    const wy = cam.y + (input.mouse.y - renderer.height / 2) / scale;
    return { x: wx, y: wy };
  }

  /** What the prompt line should say right now, or null. */
  function computePrompt() {
    const p = world.state.player;
    if (p.inCar) return null;
    // Near a car?
    const cars = [...world.traffic.cars, ...world.police.cars];
    if (world.state.stealCar) cars.push(world.state.stealCar);
    for (const car of cars) {
      if (Math.hypot(car.x - p.x, car.y - p.y) < 70) {
        return car.kind === 'police' ? 'E — STEAL THE COP CAR' : 'E — STEAL CAR';
      }
    }
    if (!world.missions.current() && world.missions.completed < 5) return 'Q — START THE NEXT JOB';
    return null;
  }

  function handleActions() {
    // Only the menu actions are consumed here; E (enter car) is consumed by the world.
    const actions = input.takeActions(ACTION_CONFIRM | ACTION_PAUSE | ACTION_MUTE);
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function step() {
    const event = world.step(STEP, input, aimPoint(), audio);
    if (event === EVENT_BUSTED) endGame('busted');
    else if (event === EVENT_WASTED) endGame('wasted');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    time += dt;
    handleActions();
    if (screen === SCREEN_PLAY) {
      accumulator += dt;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
      prompt = computePrompt();
    } else {
      accumulator = 0;
      prompt = null;
    }
    renderer.draw(world.state, screen, time);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      hud.drawHud(renderer.ctx, world.state, renderer.width, renderer.height, time, screen === SCREEN_PLAY ? prompt : null);
    }
    if (screen === SCREEN_TITLE) {
      hud.drawTitle(renderer.ctx, world.state, renderer.width, renderer.height, hasSave, time);
    } else if (screen === SCREEN_PAUSED) {
      hud.drawPaused(renderer.ctx, renderer.width, renderer.height);
    } else if (screen === SCREEN_OVER) {
      hud.drawOver(renderer.ctx, world.state, renderer.width, renderer.height, overKind);
    }
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // First gesture unlocks the synthesized sound.
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });

  // Q is read as a raw key here because the input module maps only one-shot actions.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyQ' && !event.repeat && screen === SCREEN_PLAY) {
      if (!world.missions.current()) {
        const m = world.startNextMission(audio);
        if (m) announce(`${m.title}: ${m.intro}`);
      }
    }
  });

  announce('Solmar Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
