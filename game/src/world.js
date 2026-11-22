// The world: the player (on foot or in a car), driving physics, combat, the mission
// step machine, particles, and the save. Traffic and police live in their own modules;
// this file owns the player and ties everything together each fixed step.

import { ACTION_ENTER_CAR, ACTION_SHOOT } from './input.js';
import { CAR, COAST, PLAYER, SAVE_KEY, WORLD } from './config.js';
import { createCity, clampToCity, collideBuildings, isOnRoad, isSand, isWater, nearestRoadPoint } from './city.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createMissions, MISSIONS } from './missions.js';
import { createRandom } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;

// Where the Hot Wheels prize car waits (on the road beside Palmera Park) and
// where Sal's crew gathers for the bank job (outside Harbor Bank).
const STEAL_CAR_SPOT = { x: 1920, y: 1680 };
const BANK_SPOT = { x: 2400, y: 1440 };

function saveData(state) {
  return {
    money: state.money,
    missionsCompleted: state.missions.completed,
    bestWanted: state.stats.bestWanted,
    carsStolen: state.stats.carsStolen,
    playtime: state.stats.playtime,
  };
}

export function createWorld(seed) {
  const rng = createRandom(seed);
  const city = createCity(seed);
  const traffic = createTraffic(city, seed);
  const police = createPolice(seed, city);
  const missions = createMissions();

  const start = nearestRoadPoint(960, 960);

  const state = {
    seed,
    city,
    traffic,
    police,
    missions,
    time: 0,
    money: 250,
    player: {
      x: start.x,
      y: start.y,
      angle: -Math.PI / 2,
      health: PLAYER.health,
      ammo: PLAYER.ammoStart,
      inCar: false,
      car: null,
      shootCooldown: 0,
      invuln: 0,
      walkPhase: 0,
    },
    bullets: [],
    enemies: [],
    particles: [],
    pickups: [],
    camera: { x: start.x, y: start.y, zoom: 1 },
    stats: { bestWanted: 0, carsStolen: 0, playtime: 0, shotsFired: 0, missionsFailed: 0 },
    stealCar: null,
    passenger: false,
    wantedFlash: 0,
  };

  function loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      state.money = data.money ?? 250;
      state.missions.load(data.missionsCompleted ?? 0);
      state.stats.bestWanted = data.bestWanted ?? 0;
      state.stats.carsStolen = data.carsStolen ?? 0;
      state.stats.playtime = data.playtime ?? 0;
      return true;
    } catch {
      return false;
    }
  }

  function save() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(saveData(state)));
    } catch {
      // Storage can be off: progress then lasts this visit only.
    }
  }

  function burst(x, y, color, count, speed = 160, life = 0.7, size = 4) {
    for (let i = 0; i < count; i += 1) {
      const a = rng.range(0, Math.PI * 2);
      const s = rng.range(speed * 0.3, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rng.range(life * 0.5, life),
        maxLife: life,
        color,
        size: rng.range(size * 0.6, size * 1.4),
      });
    }
  }

  function nearestCar(x, y, maxDist) {
    let best = null;
    let bestDist = maxDist;
    const candidates = [];
    if (state.player.car) candidates.push(state.player.car);
    for (const car of traffic.cars) candidates.push(car);
    for (const car of police.cars) candidates.push(car);
    if (state.stealCar) candidates.push(state.stealCar);
    for (const car of candidates) {
      const d = Math.hypot(car.x - x, car.y - y);
      if (d < bestDist) { bestDist = d; best = car; }
    }
    return best;
  }

  function enterCar(car, audio) {
    const p = state.player;
    if (car.kind === 'traffic' && car.driver) {
      // Carjacking: the driver bails and runs, the law notices.
      car.driver = false;
      traffic.takeCar(car);
      traffic.scare(car.x, car.y, 120);
      police.addWanted(1, audio);
      state.stats.carsStolen += 1;
      if (audio) audio.crash(0.4);
    }
    if (car.kind === 'police') {
      // Stealing a cop car is a bad idea that feels great.
      police.addWanted(2, audio);
    }
    if (state.stealCar === car) {
      state.stealCar = null;
      const step = missions.currentStep();
      if (step && step.type === 'steal') {
        missions.advanceStep();
        missions.showMessage('Eddie Kwan: That is the one! Bring it to Sunset Garage.', 5);
        if (audio) audio.pickup();
      }
      police.addWanted(1, audio);
    }
    p.inCar = true;
    p.car = car;
    car.speed = 0;
    if (audio) audio.unlock();
  }

  function exitCar() {
    const p = state.player;
    if (!p.inCar || !p.car) return;
    const car = p.car;
    const side = { x: car.x + Math.cos(car.angle + Math.PI / 2) * 34, y: car.y + Math.sin(car.angle + Math.PI / 2) * 34 };
    const spot = clampToCity(side.x, side.y);
    p.x = spot.x;
    p.y = spot.y;
    p.angle = car.angle;
    p.inCar = false;
    p.car = null;
  }

  function shoot(aimX, aimY, audio) {
    const p = state.player;
    if (p.inCar || p.ammo <= 0 || p.shootCooldown > 0) return;
    p.shootCooldown = PLAYER.pistolCooldown;
    p.ammo -= 1;
    p.angle = Math.atan2(aimY - p.y, aimX - p.x);
    state.stats.shotsFired += 1;
    const mx = p.x + Math.cos(p.angle) * 20;
    const my = p.y + Math.sin(p.angle) * 20;
    state.bullets.push({ x: mx, y: my, angle: p.angle, speed: 950, life: 0.7, fromPlayer: true });
    burst(mx, my, '#ffd60a', 4, 120, 0.15, 3);
    traffic.scare(p.x, p.y, 260);
    if (audio) audio.gunshot();
    // Firing a gun in public draws attention.
    if (police.wanted === 0) police.addWanted(1, audio);
  }

  function spawnFightCrew() {
    const base = BANK_SPOT;
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2;
      state.enemies.push({
        x: base.x + Math.cos(a) * 180,
        y: base.y + Math.sin(a) * 180,
        angle: a,
        health: 70,
        shootCooldown: rng.range(0.5, 1.5),
        speed: 150,
      });
    }
  }

  function startMissionStepEffects(step, audio) {
    if (!step) return;
    if (step.type === 'wanted') {
      police.setWanted(step.stars, audio);
      missions.advanceStep();
      missions.showMessage('Lose the cops, then get to the safehouse.', 5);
    } else if (step.type === 'survive') {
      missions.setTimer(step.seconds);
    } else if (step.type === 'rob') {
      // The bank job starts at two stars; the crew shows up after the grab.
      police.setWanted(2, audio);
    }
  }

  function damagePlayer(amount, audio) {
    const p = state.player;
    if (p.invuln > 0) return;
    p.health -= amount;
    p.invuln = 0.4;
    burst(p.x, p.y, '#ef476f', 8, 140, 0.5, 4);
    if (audio) audio.crash(0.5);
  }

  function explodeCar(car, audio) {
    burst(car.x, car.y, '#ff7b00', 26, 320, 0.9, 6);
    burst(car.x, car.y, '#3d3a38', 18, 160, 1.2, 7);
    burst(car.x, car.y, '#ffd60a', 14, 240, 0.5, 5);
    if (audio) audio.crash(1);
    if (state.player.car === car) {
      state.player.inCar = false;
      state.player.car = null;
      const spot = clampToCity(car.x + 40, car.y + 40);
      state.player.x = spot.x;
      state.player.y = spot.y;
      damagePlayer(25, audio);
    }
    const ti = traffic.cars.indexOf(car);
    if (ti >= 0) traffic.cars.splice(ti, 1);
    const pi = police.cars.indexOf(car);
    if (pi >= 0) police.cars.splice(pi, 1);
  }

  // --- The parked prize for mission 2, placed when the mission starts. ---
  function placeStealCar() {
    state.stealCar = {
      kind: 'steal',
      x: STEAL_CAR_SPOT.x,
      y: STEAL_CAR_SPOT.y,
      angle: Math.PI / 2,
      speed: 0,
      color: '#e63946',
      length: CAR.length,
      width: CAR.width,
      health: CAR.health,
      driver: false,
    };
  }

  function stepPlayer(dt, input, aim, audio, events) {
    const p = state.player;
    p.shootCooldown = Math.max(0, p.shootCooldown - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    const drive = input.drive();
    const walk = input.walk();

    if (p.inCar && p.car) {
      const car = p.car;
      // Throttle / brake / reverse.
      if (drive.y > 0) car.speed += CAR.accel * dt;
      else if (drive.y < 0) {
        car.speed += car.speed > 30 ? -CAR.brake * dt : -CAR.reverseAccel * dt;
      } else {
        car.speed -= car.speed * 0.6 * dt;
      }
      if (input.isHandbrake()) car.speed -= car.speed * 3.2 * dt;
      car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
      // Steering only bites while moving; sharper at low speed.
      const steerAmount = drive.x * CAR.steer * dt * Math.min(1, Math.abs(car.speed) / 140 + 0.25);
      car.angle += steerAmount * (car.speed >= 0 ? 1 : -1);
      // A little drift so turns feel loose.
      const vx = Math.cos(car.angle) * car.speed;
      const vy = Math.sin(car.angle) * car.speed;
      const prevX = car.x;
      const prevY = car.y;
      car.x += vx * dt;
      car.y += vy * dt;
      // Buildings are solid.
      const pushed = collideBuildings(city, car.x, car.y, 26);
      car.x = pushed.x;
      car.y = pushed.y;
      if (pushed.pushed && Math.abs(car.speed) > 120) {
        car.speed *= 0.55;
        burst(car.x, car.y, '#ffd60a', 8, 140, 0.4, 3);
        if (audio) audio.crash(Math.min(1, Math.abs(car.speed) / 400));
        events.push({ type: 'crash', x: car.x, y: car.y });
      }
      // Water stops the car.
      if (isWater(car.x, car.y)) {
        car.x = prevX;
        car.y = prevY;
        car.speed *= -0.3;
      }
      // The city ends: the edge of the map stops the car instead of letting it
      // drive off into empty grass.
      if (car.x < 60 || car.x > 3780 || car.y < 60 || car.y > 3560) {
        car.x = Math.max(60, Math.min(3780, car.x));
        car.y = Math.max(60, Math.min(3560, car.y));
        car.speed *= 0.4;
      }
      // Bump traffic cars and police cars. A bump is a scrape, not a wreck:
      // the damage stays small so a car survives a chase.
      for (const other of [...traffic.cars, ...police.cars]) {
        if (other === car) continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const d = Math.hypot(dx, dy);
        if (d < 46 && d > 0.01) {
          const push = (46 - d) / 2;
          other.x += (dx / d) * push;
          other.y += (dy / d) * push;
          car.x -= (dx / d) * push;
          car.y -= (dy / d) * push;
          if (Math.abs(car.speed) > 200) {
            other.health -= 8;
            car.health -= 3;
            burst(other.x, other.y, '#ffd60a', 10, 160, 0.5, 4);
            if (audio) audio.crash(0.7);
            if (other.health <= 0) explodeCar(other, audio);
            if (car.health <= 0) explodeCar(car, audio);
          }
          car.speed *= 0.8;
        }
      }
      // Running over pedestrians is a crime.
      for (let i = traffic.peds.length - 1; i >= 0; i -= 1) {
        const ped = traffic.peds[i];
        if (Math.hypot(ped.x - car.x, ped.y - car.y) < 30 && Math.abs(car.speed) > 60) {
          traffic.peds.splice(i, 1);
          burst(ped.x, ped.y, '#ef476f', 12, 180, 0.7, 4);
          police.addWanted(1, audio);
          car.speed *= 0.85;
        }
      }
      // Sand slows the car right down.
      if (isSand(car.x, car.y)) car.speed *= 1 - 1.4 * dt;
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      if (audio) audio.setEngine(Math.abs(car.speed) / CAR.maxSpeed, true);
    } else {
      if (audio) audio.setEngine(0, false);
      const speed = input.isRunning() ? PLAYER.runSpeed : PLAYER.walkSpeed;
      let mx = walk.x;
      let my = walk.y;
      const len = Math.hypot(mx, my);
      if (len > 0) {
        mx /= len;
        my /= len;
        // Screen-relative: W (walk.y = 1) is north, so it moves -y.
        p.x += mx * speed * dt;
        p.y -= my * speed * dt;
        p.angle = Math.atan2(-my, mx);
        p.walkPhase += dt * (input.isRunning() ? 14 : 9);
      }
      const pushed = collideBuildings(city, p.x, p.y, PLAYER.radius);
      p.x = pushed.x;
      p.y = pushed.y;
      const clamped = clampToCity(p.x, p.y);
      p.x = clamped.x;
      p.y = clamped.y;
      if (input.isMouseDown() || input.takeActions(ACTION_SHOOT)) shoot(aim.x, aim.y, audio);
    }
  }

  function stepBullets(dt, audio) {
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      b.life -= dt;
      let dead = b.life <= 0 || isWater(b.x, b.y);
      // Hit a building.
      if (!dead) {
        for (const block of city.blocks) {
          for (const bd of block.buildings) {
            if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) {
              dead = true;
              burst(b.x, b.y, '#e8dcc3', 5, 100, 0.3, 3);
              break;
            }
          }
          if (dead) break;
        }
      }
      if (!dead && b.fromPlayer) {
        // Enemies first.
        for (let e = state.enemies.length - 1; e >= 0; e -= 1) {
          const enemy = state.enemies[e];
          if (Math.hypot(enemy.x - b.x, enemy.y - b.y) < 18) {
            enemy.health -= PLAYER.pistolDamage;
            burst(b.x, b.y, '#ef476f', 6, 120, 0.4, 3);
            dead = true;
            if (enemy.health <= 0) {
              burst(enemy.x, enemy.y, '#ef476f', 16, 200, 0.8, 4);
              state.enemies.splice(e, 1);
              const left = state.enemies.length;
              missions.setFightLeft(left);
              if (left === 0) {
                const step = missions.currentStep();
                if (step && step.type === 'fight') {
                  missions.advanceStep();
                  missions.showMessage('Crew down. Get to the Marina Docks — now!', 5);
                }
              }
            }
            break;
          }
        }
        // Then traffic and police cars.
        if (!dead) {
          for (const car of [...traffic.cars, ...police.cars]) {
            if (Math.hypot(car.x - b.x, car.y - b.y) < 34) {
              car.health -= PLAYER.pistolDamage;
              burst(b.x, b.y, '#ffd60a', 6, 120, 0.4, 3);
              dead = true;
              if (car.kind === 'police') police.addWanted(1, audio);
              if (car.health <= 0) explodeCar(car, audio);
              break;
            }
          }
        }
        // Then pedestrians (a crime, and it scares the street).
        if (!dead) {
          for (let j = traffic.peds.length - 1; j >= 0; j -= 1) {
            const ped = traffic.peds[j];
            if (Math.hypot(ped.x - b.x, ped.y - b.y) < 16) {
              traffic.peds.splice(j, 1);
              burst(ped.x, ped.y, '#ef476f', 10, 160, 0.6, 4);
              police.addWanted(1, audio);
              dead = true;
              break;
            }
          }
        }
      }
      if (!dead && !b.fromPlayer) {
        const p = state.player;
        if (!p.inCar && Math.hypot(p.x - b.x, p.y - b.y) < 16) {
          damagePlayer(9, audio);
          dead = true;
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
  }

  function stepEnemies(dt, audio) {
    const p = state.player;
    for (const enemy of state.enemies) {
      const dx = p.x - enemy.x;
      const dy = p.y - enemy.y;
      const d = Math.hypot(dx, dy) || 1;
      enemy.angle = Math.atan2(dy, dx);
      if (d > 220) {
        enemy.x += (dx / d) * enemy.speed * dt;
        enemy.y += (dy / d) * enemy.speed * dt;
      }
      enemy.shootCooldown -= dt;
      if (enemy.shootCooldown <= 0 && d < 520) {
        enemy.shootCooldown = rng.range(0.9, 1.6);
        state.bullets.push({
          x: enemy.x + Math.cos(enemy.angle) * 20,
          y: enemy.y + Math.sin(enemy.angle) * 20,
          angle: enemy.angle + rng.range(-0.08, 0.08),
          speed: 700,
          life: 0.8,
          fromPlayer: false,
        });
        if (audio) audio.enemyShot();
      }
    }
  }

  function stepMission(dt, audio) {
    const m = missions.current();
    if (!m) return;
    const step = missions.currentStep();
    if (!step) {
      const reward = missions.completeMission();
      state.money += reward;
      if (audio) audio.missionComplete();
      save();
      return;
    }
    // One-shot setup the first time a step becomes current.
    if (step._entered !== true) {
      step._entered = true;
      if (step.type === 'steal') placeStealCar();
      if (step.type === 'fight') missions.setFightLeft(step.count);
      startMissionStepEffects(step, audio);
      if (audio) audio.phone();
    }
    const p = state.player;
    if (step.type === 'go' || step.type === 'pickup' || step.type === 'deliver' || step.type === 'escape') {
      if (Math.hypot(p.x - step.x, p.y - step.y) < step.radius) {
        missions.reachedMarker();
        if (step.type === 'pickup') {
          state.passenger = true;
          missions.showMessage('Passenger aboard. Drive smooth.', 4);
        }
        if (step.type === 'deliver') {
          state.passenger = false;
          if (m.timeLimit) state.money += 100;
          if (audio) audio.pickup();
        }
        if (step.type === 'escape') {
          police.setWanted(0, null);
          if (audio) audio.setSiren(false);
        }
      }
    } else if (step.type === 'rob') {
      if (Math.hypot(p.x - step.x, p.y - step.y) < step.radius) {
        missions.reachedMarker();
        state.money += 1500;
        burst(p.x, p.y, '#80ed99', 20, 200, 0.8, 4);
        missions.showMessage('Cash grabbed! Sal\u2019s crew is on the street — deal with them.', 5);
        police.setWanted(4, audio);
        spawnFightCrew();
        if (audio) audio.pickup();
      }
    }
    // 'survive' and 'fight' steps complete themselves elsewhere.
    void dt;
  }

  function step(dt, input, aim, audio) {
    state.time += dt;
    state.stats.playtime += dt;
    const p = state.player;
    const events = [];
    const policeEvents = [];

    // Mission timers that tick every step.
    const step = missions.currentStep();
    if (step && step.type === 'survive') {
      missions.setTimer((missions.timer > 0 ? missions.timer : step.seconds) - dt);
      if (missions.timer <= 0) {
        missions.advanceStep();
        missions.showMessage('You shook them. Get to the safehouse in Old Town.', 5);
      }
    }
    const activeMission = missions.current();
    if (activeMission && activeMission.timeLimit && missions.timer > 0) {
      missions.tickTimer(dt);
      if (missions.timer <= 0 && !missions.isMissionDone()) {
        missions.failMission(`${activeMission.title} failed — the parcels never made it.`);
        state.stats.missionsFailed += 1;
        if (audio) audio.missionFail();
      }
    }

    stepPlayer(dt, input, aim, audio, events);
    traffic.step(dt, p, events, audio);
    traffic.maintain(p.x, p.y);
    const busted = police.step(dt, p, policeEvents, audio);
    for (const e of policeEvents) {
      if (e.type === 'policeRam') {
        if (p.inCar && p.car) {
          p.car.health -= e.damage;
          burst(e.x, e.y, '#ffd60a', 8, 140, 0.4, 3);
          if (audio) audio.crash(0.6);
          if (p.car.health <= 0) explodeCar(p.car, audio);
        } else {
          damagePlayer(e.damage, audio);
        }
      }
    }
    stepBullets(dt, audio);
    stepEnemies(dt, audio);
    stepMission(dt, audio);

    // Particles.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 1 - 2 * dt;
      pt.vy *= 1 - 2 * dt;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
    // Pickups (cash) drift and expire.
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pk = state.pickups[i];
      pk.life -= dt;
      if (Math.hypot(p.x - pk.x, p.y - pk.y) < 30) {
        state.money += pk.value;
        burst(pk.x, pk.y, '#80ed99', 12, 160, 0.6, 4);
        if (audio) audio.coin();
        state.pickups.splice(i, 1);
        continue;
      }
      if (pk.life <= 0) state.pickups.splice(i, 1);
    }

    // Wanted stars: track the best (highest) the player has survived.
    if (police.wanted > state.stats.bestWanted) state.stats.bestWanted = police.wanted;
    if (police.wanted > 0) state.wantedFlash = Math.min(1, state.wantedFlash + dt * 2);
    else state.wantedFlash = Math.max(0, state.wantedFlash - dt * 2);

    // Camera follows the player, a little ahead in the direction of travel.
    const lookX = p.x + (p.inCar && p.car ? Math.cos(p.car.angle) * 90 : 0);
    const lookY = p.y + (p.inCar && p.car ? Math.sin(p.car.angle) * 90 : 0);
    state.camera.x += (lookX - state.camera.x) * Math.min(1, dt * 4);
    state.camera.y += (lookY - state.camera.y) * Math.min(1, dt * 4);
    state.camera.zoom += ((p.inCar ? 0.82 : 1) - state.camera.zoom) * Math.min(1, dt * 2);

    // Enter / exit car.
    if (input.takeActions(ACTION_ENTER_CAR)) {
      if (p.inCar) exitCar();
      else {
        const car = nearestCar(p.x, p.y, 70);
        if (car) enterCar(car, audio);
      }
    }

    missions.tickMessage(dt);
    if (busted) return EVENT_BUSTED;
    if (p.health <= 0) return EVENT_WASTED;
    return EVENT_NONE;
  }

  return {
    state,
    city,
    traffic,
    police,
    missions,
    loadSave,
    save,
    step,
    shoot,
    enterCar,
    exitCar,
    burst,
    /** Start the next story mission; returns it or null when the story is done. */
    startNextMission(audio) {
      const m = missions.startNext();
      if (m) {
        const step = missions.currentStep();
        if (step && step.type === 'steal') placeStealCar();
        if (audio) audio.phone();
      }
      return m;
    },
    /** Drop a cash pickup at (x, y). */
    dropCash(x, y, value) {
      state.pickups.push({ x, y, value, life: 20 });
    },
    /** Reset a fresh free-roam run after busted/wasted, keeping money and progress. */
    respawn(audio) {
      const p = state.player;
      p.health = PLAYER.health;
      p.ammo = PLAYER.ammoStart;
      p.inCar = false;
      p.car = null;
      const spot = nearestRoadPoint(960, 960);
      p.x = spot.x;
      p.y = spot.y;
      state.bullets.length = 0;
      state.enemies.length = 0;
      police.reset();
      if (audio) audio.setSiren(false);
      missions.failMission('');
      state.camera.x = p.x;
      state.camera.y = p.y;
    },
  };
}
