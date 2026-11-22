// The Solmar Police Department: wanted stars, patrol cars that spawn and chase,
// ramming, and the "busted" arrest when a cop reaches the player on foot. Wanted
// decays once the player stays out of sight of every cop for a while.
//
// Cop cars are not ghosts: buildings stop them, so chases stay on the streets
// instead of cutting across rooftops. Ramming is a nudge, not a wreck — a staged
// car survives a chase.

import { POLICE } from './config.js';
import { collideBuildings, nearestRoadPoint } from './city.js';
import { createRandom } from './random.js';

export function createPolice(seed, city) {
  const rng = createRandom(seed ^ 0x9c0a);
  const cars = [];
  let wanted = 0;
  let unseenTimer = 0;
  let bustTimer = 0;
  let spawnTimer = 0;

  function spawnCarNear(x, y) {
    const angle = rng.range(0, Math.PI * 2);
    const p = nearestRoadPoint(
      x + Math.cos(angle) * POLICE.spawnDistance,
      y + Math.sin(angle) * POLICE.spawnDistance,
    );
    const clamped = {
      x: Math.max(80, Math.min(3760, p.x)),
      y: Math.max(80, Math.min(3520, p.y)),
    };
    cars.push({
      kind: 'police',
      x: clamped.x,
      y: clamped.y,
      angle: Math.atan2(y - clamped.y, x - clamped.x),
      speed: 0,
      maxSpeed: POLICE.chaseSpeed,
      color: '#f8f9fa',
      length: 64,
      width: 30,
      health: 120,
      sirenPhase: rng.range(0, Math.PI * 2),
      ramCooldown: 0,
    });
  }

  return {
    cars,
    get wanted() {
      return wanted;
    },
    setWanted(level, audio) {
      const next = Math.max(0, Math.min(POLICE.maxStars, level));
      if (next > wanted && audio) audio.wantedUp();
      wanted = next;
      unseenTimer = 0;
      if (wanted === 0) cars.length = 0;
    },
    addWanted(amount, audio) {
      this.setWanted(wanted + amount, audio);
    },
    reset() {
      wanted = 0;
      cars.length = 0;
      unseenTimer = 0;
      bustTimer = 0;
    },
    /**
     * Step the pursuit. Returns 'busted' when a cop arrests the player on foot,
     * otherwise null. `player` carries {x, y, inCar, speed, health}; `events`
     * collects ram hits for the world to turn into damage and sound.
     */
    step(dt, player, events, audio) {
      if (wanted === 0) {
        if (audio && audio.isSirenOn()) audio.setSiren(false);
        return null;
      }
      // How many cop cars the wanted level calls for.
      const targetCount = Math.min(wanted + 1, 6);
      spawnTimer -= dt;
      if (cars.length < targetCount && spawnTimer <= 0) {
        spawnCarNear(player.x, player.y);
        spawnTimer = 1.2;
      }
      // Nearest cop distance decides whether the player is "seen".
      let nearest = Infinity;
      for (const car of cars) nearest = Math.min(nearest, Math.hypot(car.x - player.x, car.y - player.y));
      if (nearest > 700) {
        unseenTimer += dt;
        if (unseenTimer > POLICE.decayDelay) {
          this.setWanted(wanted - 1, null);
          unseenTimer = 0;
        }
      } else {
        unseenTimer = 0;
      }
      if (audio && !audio.isSirenOn()) audio.setSiren(true);

      for (let i = cars.length - 1; i >= 0; i -= 1) {
        const car = cars[i];
        car.sirenPhase += dt * 6;
        car.ramCooldown -= dt;
        // Steer toward the player, with a little wobble so chases look alive.
        const desired = Math.atan2(player.y - car.y, player.x - car.x) + Math.sin(car.sirenPhase * 0.5) * 0.12;
        let diff = desired - car.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
        const targetSpeed = car.maxSpeed * (0.85 + 0.15 * Math.sin(car.sirenPhase * 0.3));
        car.speed += Math.max(-500 * dt, Math.min(500 * dt, targetSpeed - car.speed));
        const prevX = car.x;
        const prevY = car.y;
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;
        // Buildings stop cop cars: a chase that hits a wall slows down instead
        // of driving over the roof.
        const pushed = collideBuildings(city, car.x, car.y, 26);
        car.x = pushed.x;
        car.y = pushed.y;
        if (pushed.pushed && car.speed > 200) {
          car.speed *= 0.5;
          car.angle += (rng.chance(0.5) ? 1 : -1) * 0.9;
        }
        car.x = Math.max(60, Math.min(3780, car.x));
        car.y = Math.max(60, Math.min(3560, car.y));
        void prevX;
        void prevY;

        const dist = Math.hypot(car.x - player.x, car.y - player.y);
        // Ramming the player's car (or the player on foot) hurts — a little.
        if (dist < 52 && car.ramCooldown <= 0) {
          car.ramCooldown = 1.1;
          car.speed *= 0.45;
          events.push({ type: 'policeRam', x: car.x, y: car.y, damage: POLICE.ramDamage });
        }
        // On foot and a cop is right on top of the player: the arrest timer runs.
        if (!player.inCar && dist < 46) {
          bustTimer += dt;
          if (bustTimer >= POLICE.bustSeconds) return 'busted';
        } else {
          bustTimer = Math.max(0, bustTimer - dt * 2);
        }
        // Far away and unseen: the cop gives up and leaves.
        if (dist > POLICE.despawnDistance && wanted <= 2) {
          cars.splice(i, 1);
        }
      }
      return null;
    },
    get bustProgress() {
      return Math.min(1, bustTimer / POLICE.bustSeconds);
    },
  };
}
