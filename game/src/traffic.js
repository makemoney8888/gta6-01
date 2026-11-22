// Traffic cars that drive the road grid and pedestrians who stroll the sidewalks,
// both of which the player can interact with: cars can be stolen, pedestrians flee
// from gunfire and can be (accidentally) hit. All movement is on the road grid.

import { CAR, TRAFFIC } from './config.js';
import { ROAD_LINES, isOnRoad, isWater, randomRoadPoint, randomSidewalkPoint } from './city.js';
import { createRandom } from './random.js';

const CAR_PAINT = [
  '#e63946', '#f4a261', '#2a9d8f', '#4361ee', '#f8f9fa',
  '#ffb703', '#7209b7', '#06d6a0', '#ef476f', '#118ab2',
  '#ff7b00', '#073b4c', '#8338ec', '#3a86ff', '#ffbe0b', '#adb5bd',
];

const SHIRTS = ['#ef476f', '#06d6a0', '#118ab2', '#ffb703', '#8338ec', '#f4a261', '#e63946', '#2a9d8f'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

/** A traffic car sitting on a road, already pointing along it. */
function makeTrafficCar(rng, x, y) {
  // Pick a road axis and a lane offset, then drive along it.
  const vertical = rng.chance(0.5);
  const angle = vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
  const lane = 22;
  const px = vertical ? x + lane : x;
  const py = vertical ? y : y + lane;
  return {
    kind: 'traffic',
    x: px,
    y: py,
    angle,
    speed: rng.range(TRAFFIC.carSpeed * 0.75, TRAFFIC.carSpeed * 1.15),
    color: CAR_PAINT[rng.int(0, CAR_PAINT.length - 1)],
    length: CAR.length,
    width: CAR.width,
    health: CAR.health,
    driver: true,
    turnCooldown: rng.range(0, 3),
    honkCooldown: 0,
  };
}

function makePedestrian(rng, x, y) {
  return {
    kind: 'ped',
    x,
    y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(TRAFFIC.pedSpeed * 0.7, TRAFFIC.pedSpeed * 1.3),
    shirt: SHIRTS[rng.int(0, SHIRTS.length - 1)],
    skin: SKINS[rng.int(0, SKINS.length - 1)],
    fleeing: 0,
    walkPhase: rng.range(0, Math.PI * 2),
    target: null,
    pause: rng.range(0, 4),
  };
}

export function createTraffic(city, seed) {
  const rng = createRandom(seed ^ 0x51ab);
  const cars = [];
  const peds = [];
  for (let i = 0; i < TRAFFIC.cars; i += 1) {
    const p = randomRoadPoint(rng);
    cars.push(makeTrafficCar(rng, p.x, p.y));
  }
  for (let i = 0; i < TRAFFIC.peds; i += 1) {
    const p = randomSidewalkPoint(rng);
    peds.push(makePedestrian(rng, p.x, p.y));
  }

  /** A fresh car on a road near (x, y), already pointing along that road. */
  function spawnCarNear(x, y) {
    const vertical = rng.chance(0.5);
    const line = ROAD_LINES[rng.int(0, ROAD_LINES.length - 1)];
    const along = Math.max(120, Math.min(3720, (vertical ? y : x) + rng.range(-600, 600)));
    const car = makeTrafficCar(rng, vertical ? line : along, vertical ? along : line);
    // makeTrafficCar picks its own axis; force it onto the road we chose.
    if (vertical) {
      car.angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
      car.x = line + 22;
      car.y = along;
    } else {
      car.angle = rng.chance(0.5) ? 0 : Math.PI;
      car.x = along;
      car.y = line + 22;
    }
    cars.push(car);
  }

  /** A fresh pedestrian on a sidewalk near (x, y). */
  function spawnPedNear(x, y) {
    const p = randomSidewalkPoint(rng);
    const dx = p.x - 1920;
    const dy = p.y - 1920;
    peds.push(makePedestrian(rng,
      Math.max(80, Math.min(3760, x + dx * 0.4)),
      Math.max(80, Math.min(3520, y + dy * 0.4))));
  }

  return {
    cars,
    peds,
    /** Keep the streets busy: top the traffic back up near the player. */
    maintain(playerX, playerY) {
      while (cars.length < TRAFFIC.cars) spawnCarNear(playerX, playerY);
      while (peds.length < TRAFFIC.peds) spawnPedNear(playerX, playerY);
    },
    spawnCarNear,
    spawnPedNear,
    /**
     * Step traffic and pedestrians. `player` is the player entity (for avoidance
     * and fleeing); `events` collects hits for the world to turn into damage.
     */
    step(dt, player, events, audio) {
      // --- Cars: drive along their axis; at an intersection, sometimes turn. ---
      for (let i = cars.length - 1; i >= 0; i -= 1) {
        const car = cars[i];
        car.turnCooldown -= dt;
        // Slow down when a car is close ahead.
        let blocked = false;
        for (const other of cars) {
          if (other === car) continue;
          const dx = other.x - car.x;
          const dy = other.y - car.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 110 && Math.cos(car.angle) * dx + Math.sin(car.angle) * dy > 0) { blocked = true; break; }
        }
        const speed = blocked ? car.speed * 0.25 : car.speed;
        const mx = car.x + Math.cos(car.angle) * speed * dt;
        const my = car.y + Math.sin(car.angle) * speed * dt;
        const onRoad = isOnRoad(mx, my) && !isWater(mx, my);
        const nearIntersection = ROAD_LINES.some((l) => Math.abs(mx - l) < 14) && ROAD_LINES.some((l) => Math.abs(my - l) < 14);
        if (onRoad) {
          car.x = mx;
          car.y = my;
        } else {
          // Reached the city edge: turn around and head back.
          car.angle += Math.PI;
          car.x += Math.cos(car.angle) * 20;
          car.y += Math.sin(car.angle) * 20;
        }
        if (nearIntersection && car.turnCooldown <= 0 && rng.chance(0.35)) {
          car.angle += rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
          car.turnCooldown = rng.range(2, 5);
        }
        // Keep cars inside the city.
        if (car.x < 60 || car.x > 3780 || car.y < 60 || car.y > 3540) {
          car.angle += Math.PI;
          car.x = Math.max(80, Math.min(3760, car.x));
          car.y = Math.max(80, Math.min(3520, car.y));
        }
      }
      // --- Pedestrians: stroll the sidewalks, flee from gunfire or a speeding car. ---
      for (const ped of peds) {
        ped.walkPhase += dt * 6;
        if (ped.fleeing > 0) {
          ped.fleeing -= dt;
          const dx = ped.x - player.x;
          const dy = ped.y - player.y;
          const d = Math.hypot(dx, dy) || 1;
          ped.x += (dx / d) * TRAFFIC.pedSpeed * 2.4 * dt;
          ped.y += (dy / d) * TRAFFIC.pedSpeed * 2.4 * dt;
          ped.angle = Math.atan2(dy, dx);
          continue;
        }
        if (ped.pause > 0) {
          ped.pause -= dt;
          continue;
        }
        if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 12) {
          const p = randomSidewalkPoint(rng);
          ped.target = { x: p.x, y: p.y };
          if (rng.chance(0.25)) ped.pause = rng.range(1, 4);
        }
        const dx = ped.target.x - ped.x;
        const dy = ped.target.y - ped.y;
        const d = Math.hypot(dx, dy) || 1;
        ped.x += (dx / d) * ped.speed * dt;
        ped.y += (dy / d) * ped.speed * dt;
        ped.angle = Math.atan2(dy, dx);
      }
      void events;
      void audio;
    },
    /** Scare every pedestrian near (x, y) into fleeing. */
    scare(x, y, radius) {
      for (const ped of peds) {
        if (Math.hypot(ped.x - x, ped.y - y) < radius) ped.fleeing = rng.range(2, 4);
      }
    },
    /** Remove a car from traffic (it was stolen) and return it. */
    takeCar(car) {
      const index = cars.indexOf(car);
      if (index >= 0) cars.splice(index, 1);
      car.driver = false;
      return car;
    },
  };
}
