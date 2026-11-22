// The screenshot scenes behind ?shot=cover|drive|chase|mission. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// simple driving autopilot (or, on foot, by aiming at the nearest enemy), so the
// frame is what real play looks like and the same seed always gives the same frame.
//
// Staging coordinates match the landmark blocks in city.js: Harbor Bank sits at
// (2400, 1440), the Palmera Park prize car waits on the road at (1920, 1680).

import { STEP } from './config.js';
import { createWorld } from './world.js';
import { nearestRoadPoint } from './city.js';
import { SCREEN_PLAY } from './render.js';

const SEED = 7;

// Bank job: the player walks in from the west along the road in front of Harbor
// Bank (the bank itself is a solid building — the job triggers on its street side).
const BANK = { x: 2400, y: 1680 };
const BANK_APPROACH = { x: 2160, y: 1680 };

function fakeInput() {
  const driveVec = { x: 0, y: 0 };
  return {
    driveVec,
    mouseDown: false,
    drive() { return driveVec; },
    walk() { return driveVec; },
    isRunning() { return false; },
    isHandbrake() { return false; },
    isMouseDown() { return this.mouseDown; },
    hasAction() { return false; },
    takeActions() { return 0; },
  };
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Steer the player's car toward a point ahead on the nearest road, easing off the throttle in hard turns. */
function driveAutopilot(world, input) {
  const p = world.state.player;
  if (!p.inCar || !p.car) {
    input.driveVec.x = 0;
    input.driveVec.y = 0;
    return;
  }
  const car = p.car;
  const ahead = {
    x: p.x + Math.cos(car.angle) * 220,
    y: p.y + Math.sin(car.angle) * 220,
  };
  const target = nearestRoadPoint(ahead.x, ahead.y);
  const desired = Math.atan2(target.y - p.y, target.x - p.x);
  const diff = angleDiff(desired, car.angle);
  input.driveVec.x = Math.max(-1, Math.min(1, diff * 3));
  input.driveVec.y = (Math.abs(diff) > 0.7 || Math.abs(car.speed) > 420) ? 0 : 1;
}

/** If the player's car was wrecked during staging, put them in a fresh one. */
function ensureInCar(world) {
  const p = world.state.player;
  if (p.inCar && p.car) return;
  const car = {
    kind: 'traffic',
    x: p.x,
    y: p.y,
    angle: p.angle,
    speed: 0,
    color: '#ff7b00',
    length: 64,
    width: 30,
    health: 100,
    driver: false,
    turnCooldown: 0,
    honkCooldown: 0,
  };
  p.inCar = true;
  p.car = car;
}

function putPlayerInCar(world) {
  const p = world.state.player;
  const car = world.traffic.cars[0];
  world.traffic.takeCar(car);
  p.inCar = true;
  p.car = car;
  car.x = p.x;
  car.y = p.y;
  car.angle = p.angle;
  car.speed = 0;
  return car;
}

/** Snap the player's car onto the nearest road, heading along it toward the marker, at speed. */
function resetCarOnRoad(world, speed) {
  const p = world.state.player;
  if (!p.inCar || !p.car) return;
  const car = p.car;
  const road = nearestRoadPoint(p.x, p.y);
  const marker = world.missions.marker();
  car.x = road.x;
  car.y = road.y;
  const snappedVertical = road.x !== p.x;
  if (snappedVertical) {
    const dy = marker ? marker.y - p.y : -1;
    car.angle = dy >= 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    const dx = marker ? marker.x - p.x : 1;
    car.angle = dx >= 0 ? 0 : Math.PI;
  }
  car.speed = speed;
}

/** Pull the closest cop car in behind the player so the chase reads in one frame. */
function pullCopBehind(world, distance) {
  const p = world.state.player;
  const cops = world.police.cars;
  if (cops.length === 0 || !p.inCar || !p.car) return;
  let nearest = cops[0];
  for (const c of cops) {
    if (Math.hypot(c.x - p.x, c.y - p.y) < Math.hypot(nearest.x - p.x, nearest.y - p.y)) nearest = c;
  }
  nearest.x = p.x - Math.cos(p.car.angle) * distance;
  nearest.y = p.y - Math.sin(p.car.angle) * distance;
  nearest.angle = p.car.angle;
  nearest.speed = 520;
}

/** A short final stretch with the autopilot so the staged car is moving in frame. */
function finalStretch(world, input, seconds) {
  for (let i = 0; i < Math.round(seconds / STEP); i += 1) {
    driveAutopilot(world, input);
    world.step(STEP, input, { x: 0, y: 0 }, null);
  }
}

/**
 * After the final stretch, make sure the car is on a road and moving for the
 * frame: a car wedged against a building by a police ram is re-seated on the
 * road at speed, with a cop pulled in behind it.
 */
function settleCar(world, speed, copDistance) {
  const p = world.state.player;
  if (!p.inCar || !p.car) return;
  if (Math.abs(p.car.speed) < 150) {
    resetCarOnRoad(world, speed);
    if (copDistance) pullCopBehind(world, copDistance);
  }
}

function stageCover(world) {
  const input = fakeInput();
  world.startNextMission(null);
  putPlayerInCar(world);
  world.police.setWanted(2, null);
  for (let i = 0; i < Math.round(10 / STEP); i += 1) {
    driveAutopilot(world, input);
    world.step(STEP, input, { x: 0, y: 0 }, null);
  }
  ensureInCar(world);
  resetCarOnRoad(world, 380);
  pullCopBehind(world, 260);
  finalStretch(world, input, 0.7);
  settleCar(world, 380, 260);
  const p = world.state.player;
  world.state.camera.x = p.x;
  world.state.camera.y = p.y;
  return { screen: SCREEN_PLAY };
}

function stageDrive(world) {
  const input = fakeInput();
  world.startNextMission(null);
  // Move downtown for a denser street scene.
  const p = world.state.player;
  p.x = 2160;
  p.y = 2160;
  p.angle = 0;
  putPlayerInCar(world);
  for (let i = 0; i < Math.round(9 / STEP); i += 1) {
    driveAutopilot(world, input);
    world.step(STEP, input, { x: 0, y: 0 }, null);
  }
  ensureInCar(world);
  resetCarOnRoad(world, 360);
  finalStretch(world, input, 0.7);
  settleCar(world, 360, 0);
  world.state.camera.x = p.x;
  world.state.camera.y = p.y;
  return { screen: SCREEN_PLAY };
}

function stageChase(world) {
  const input = fakeInput();
  world.startNextMission(null);
  const p = world.state.player;
  p.x = 1200;
  p.y = 1680;
  p.angle = Math.PI / 2;
  putPlayerInCar(world);
  world.police.setWanted(3, null);
  for (let i = 0; i < Math.round(8 / STEP); i += 1) {
    driveAutopilot(world, input);
    world.step(STEP, input, { x: 0, y: 0 }, null);
  }
  ensureInCar(world);
  resetCarOnRoad(world, 420);
  pullCopBehind(world, 200);
  finalStretch(world, input, 0.7);
  settleCar(world, 420, 200);
  world.state.camera.x = p.x;
  world.state.camera.y = p.y;
  return { screen: SCREEN_PLAY };
}

function stageMission(world) {
  const input = fakeInput();
  // Jump to the final job: the bank heist.
  world.missions.load(4);
  world.startNextMission(null);
  const p = world.state.player;
  p.x = BANK_APPROACH.x;
  p.y = BANK_APPROACH.y;
  p.angle = -Math.PI / 2;
  world.state.camera.x = p.x;
  world.state.camera.y = p.y;
  // Walk east along the road until the bank grab triggers and the crew appears.
  let triggered = false;
  for (let i = 0; i < Math.round(4 / STEP) && !triggered; i += 1) {
    input.driveVec.x = 1;
    input.driveVec.y = 0;
    world.step(STEP, input, { x: p.x + 100, y: p.y }, null);
    const step = world.missions.currentStep();
    if (step && step.type === 'fight') triggered = true;
  }
  // Trade shots with the crew for a short burst: muzzle flashes and visible
  // enemies, but the crew is still standing when the frame is taken.
  input.mouseDown = true;
  for (let i = 0; i < Math.round(1.1 / STEP); i += 1) {
    input.driveVec.x = 0;
    input.driveVec.y = 0;
    let aim = { x: p.x, y: p.y - 200 };
    if (world.state.enemies.length > 0) {
      const e = world.state.enemies[0];
      aim = { x: e.x, y: e.y };
    }
    world.step(STEP, input, aim, null);
  }
  input.mouseDown = false;
  world.state.camera.x = p.x;
  world.state.camera.y = p.y;
  void BANK;
  return { screen: SCREEN_PLAY };
}

/**
 * Build a fresh world and stage the named scene (cover, drive, chase, mission;
 * anything else is the cover). Returns the world and the screen to draw over it.
 */
export function stageShot(name) {
  const world = createWorld(SEED);
  if (name === 'drive') return { world, ...stageDrive(world) };
  if (name === 'chase') return { world, ...stageChase(world) };
  if (name === 'mission') return { world, ...stageMission(world) };
  return { world, ...stageCover(world) };
}
