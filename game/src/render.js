// The renderer: draws the city, every entity, and the sun-soaked look — warm light,
// long shadows, turquoise water — on a 2D canvas. The camera follows the player;
// the HUD and menus are drawn by hud.js on top of this frame.

import { COAST, PALETTE, WORLD } from './config.js';
import { ROAD_LINES } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hash(n) {
  let t = (n * 2654435761) % 4294967296;
  t ^= t >>> 15;
  t = Math.imul(t, 2246822519);
  t ^= t >>> 13;
  return ((t >>> 0) / 4294967296);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 1280;
  let height = 720;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    width = Math.max(320, Math.floor(rect.width * dpr));
    height = Math.max(240, Math.floor(rect.height * dpr));
    canvas.width = width;
    canvas.height = height;
  }
  resize();
  window.addEventListener('resize', resize);

  function view(state) {
    const cam = state.camera;
    const viewW = 1280 / cam.zoom;
    const viewH = 720 / cam.zoom;
    const scale = width / viewW;
    return {
      scale,
      ox: width / 2 - cam.x * scale,
      oy: height / 2 - cam.y * scale,
      left: cam.x - viewW / 2,
      right: cam.x + viewW / 2,
      top: cam.y - viewH / 2,
      bottom: cam.y + viewH / 2,
    };
  }

  function drawCarShape(car, isPlayerCar, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const l = car.length;
    const w = car.width;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    roundRect(ctx, -l / 2 + 5, -w / 2 + 6, l, w, 8);
    ctx.fill();
    // Wheels.
    ctx.fillStyle = '#16130f';
    const wheelW = 12;
    const wheelH = 7;
    ctx.fillRect(-l / 2 + 6, -w / 2 - 3, wheelW, wheelH);
    ctx.fillRect(l / 2 - 18, -w / 2 - 3, wheelW, wheelH);
    ctx.fillRect(-l / 2 + 6, w / 2 - 4, wheelW, wheelH);
    ctx.fillRect(l / 2 - 18, w / 2 - 4, wheelW, wheelH);
    // Body.
    ctx.fillStyle = car.color;
    roundRect(ctx, -l / 2, -w / 2, l, w, 9);
    ctx.fill();
    // Roof and cabin.
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    roundRect(ctx, -l / 2 + 14, -w / 2 + 5, l - 34, w - 10, 6);
    ctx.fill();
    // Windshield and rear window.
    ctx.fillStyle = 'rgba(20, 40, 60, 0.75)';
    ctx.fillRect(l / 2 - 18, -w / 2 + 6, 7, w - 12);
    ctx.fillRect(-l / 2 + 13, -w / 2 + 6, 6, w - 12);
    // Headlights.
    ctx.fillStyle = '#fff8c9';
    ctx.fillRect(l / 2 - 2, -w / 2 + 4, 3, 6);
    ctx.fillRect(l / 2 - 2, w / 2 - 10, 3, 6);
    // Police light bar.
    if (car.kind === 'police') {
      const phase = Math.floor(time * 6 + car.sirenPhase) % 2;
      ctx.fillStyle = phase === 0 ? '#ff2e4d' : '#2e6bff';
      ctx.fillRect(-8, -w / 2 + 3, 16, 7);
      ctx.fillStyle = phase === 0 ? '#2e6bff' : '#ff2e4d';
      ctx.fillRect(-8, w / 2 - 10, 16, 7);
      ctx.fillStyle = '#111';
      ctx.font = `bold ${Math.round(w * 0.34)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('POLICE', 0, 1);
    }
    if (isPlayerCar) {
      ctx.strokeStyle = 'rgba(255, 214, 10, 0.9)';
      ctx.lineWidth = 2.5;
      roundRect(ctx, -l / 2 - 3, -w / 2 - 3, l + 6, w + 6, 10);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCity(state, v, time) {
    const city = state.city;
    // Ground: warm grass.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(v.left - 40, v.top - 40, v.right - v.left + 80, v.bottom - v.top + 80);
    // Subtle grass patches.
    ctx.fillStyle = PALETTE.grassDark;
    for (let i = 0; i < 40; i += 1) {
      const gx = hash(i * 3 + 1) * WORLD.size;
      const gy = hash(i * 7 + 2) * WORLD.size;
      if (gx < v.left - 80 || gx > v.right + 80 || gy < v.top - 80 || gy > v.bottom + 80) continue;
      ctx.beginPath();
      ctx.ellipse(gx, gy, 60 + hash(i) * 60, 30 + hash(i + 50) * 40, hash(i + 9) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Beach and sea (south edge).
    if (v.bottom > COAST.sandStart) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(v.left, COAST.sandStart, v.right - v.left, COAST.waterStart - COAST.sandStart);
      ctx.fillStyle = PALETTE.waterDeep;
      ctx.fillRect(v.left, COAST.waterStart, v.right - v.left, v.bottom - COAST.waterStart + 80);
      ctx.fillStyle = PALETTE.water;
      ctx.fillRect(v.left, COAST.waterStart, v.right - v.left, 26);
      // Animated wave lines.
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i += 1) {
        const wy = COAST.waterStart + 14 + i * 34 + Math.sin(time * 1.2 + i * 2) * 4;
        ctx.beginPath();
        for (let x = v.left; x <= v.right; x += 60) {
          ctx.lineTo(x, wy + Math.sin(x * 0.01 + time * 1.5 + i) * 5);
        }
        ctx.stroke();
      }
      // Palm trees along the beach.
      for (let x = 120; x < WORLD.size; x += 260) {
        if (x < v.left - 60 || x > v.right + 60) continue;
        const py = COAST.sandStart + 60 + hash(x) * 60;
        ctx.strokeStyle = '#8a6d4b';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x, py);
        ctx.lineTo(x + 6, py - 26);
        ctx.stroke();
        ctx.fillStyle = '#3f9d4e';
        for (let f = 0; f < 5; f += 1) {
          const a = (f / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.ellipse(x + 6 + Math.cos(a) * 14, py - 26 + Math.sin(a) * 9, 15, 6, a, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // The pier.
      ctx.fillStyle = '#a9805b';
      ctx.fillRect(1860, COAST.sandStart - 10, 120, COAST.waterStart - COAST.sandStart + 160);
      ctx.fillStyle = '#8a6d4b';
      for (let y = COAST.sandStart; y < COAST.waterStart + 140; y += 34) {
        ctx.fillRect(1860, y, 120, 4);
      }
    }
    // Roads: dark strips along every grid line, with sidewalks.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const line of ROAD_LINES) {
      ctx.fillRect(v.left, line - WORLD.roadWidth / 2 - WORLD.sidewalk, v.right - v.left, WORLD.roadWidth + WORLD.sidewalk * 2);
      ctx.fillRect(line - WORLD.roadWidth / 2 - WORLD.sidewalk, v.top, WORLD.roadWidth + WORLD.sidewalk * 2, v.bottom - v.top);
    }
    ctx.fillStyle = PALETTE.road;
    for (const line of ROAD_LINES) {
      ctx.fillRect(v.left, line - WORLD.roadWidth / 2, v.right - v.left, WORLD.roadWidth);
      ctx.fillRect(line - WORLD.roadWidth / 2, v.top, WORLD.roadWidth, v.bottom - v.top);
    }
    // Lane dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const line of ROAD_LINES) {
      for (let d = Math.floor(v.left / 64) * 64; d < v.right; d += 64) {
        ctx.fillRect(d, line - 2, 30, 4);
      }
      for (let d = Math.floor(v.top / 64) * 64; d < v.bottom; d += 64) {
        ctx.fillRect(line - 2, d, 4, 30);
      }
    }
    // Blocks: parks, plazas and buildings.
    for (const block of city.blocks) {
      if (block.x > v.right || block.x + block.w < v.left || block.y > v.bottom || block.y + block.h < v.top) continue;
      if (block.kind === 'park') {
        ctx.fillStyle = PALETTE.park;
        roundRect(ctx, block.x, block.y, block.w, block.h, 12);
        ctx.fill();
        if (block.pond) {
          ctx.fillStyle = PALETTE.water;
          ctx.beginPath();
          ctx.arc(block.pond.x, block.pond.y, block.pond.r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (block.kind === 'plaza') {
        ctx.fillStyle = '#d9c9a8';
        roundRect(ctx, block.x, block.y, block.w, block.h, 12);
        ctx.fill();
        ctx.fillStyle = '#b8a888';
        ctx.beginPath();
        ctx.arc(block.x + block.w / 2, block.y + block.h / 2, 34, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#b9ac93';
        roundRect(ctx, block.x, block.y, block.w, block.h, 10);
        ctx.fill();
      }
      // Trees.
      for (const tree of block.trees) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(tree.x + 4, tree.y + 5, tree.r, tree.r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4c9a52';
        ctx.beginPath();
        ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#67b26a';
        ctx.beginPath();
        ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
      // Buildings: long shadows, coloured roofs, windows.
      for (const b of block.buildings) {
        const shadow = b.height * 5;
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(b.x + shadow, b.y + shadow + 4, b.w, b.h);
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, 8);
        ctx.fillStyle = 'rgba(20,40,60,0.55)';
        const cols = Math.max(2, Math.floor(b.w / 26));
        const rows = Math.max(2, Math.floor(b.h / 26));
        for (let i = 0; i < b.windows; i += 1) {
          const cx = b.x + 8 + (hash(b.seed + i * 13) * (cols - 1) | 0) * 26;
          const cy = b.y + 10 + (hash(b.seed + i * 29) * (rows - 1) | 0) * 26;
          ctx.fillRect(cx, cy, 12, 9);
        }
      }
    }
    // Landmark labels: each sits on the middle of its own block, in cream with a
    // dark outline so it reads over roofs, grass and road alike.
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const lm of city.landmarks) {
      if (lm.x < v.left - 120 || lm.x > v.right + 120 || lm.y < v.top - 40 || lm.y > v.bottom + 40) continue;
      if (lm.kind === 'pier' || lm.kind === 'docks') continue;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(20,18,24,0.65)';
      ctx.strokeText(lm.name.toUpperCase(), lm.x, lm.y);
      ctx.fillStyle = '#fff8ea';
      ctx.fillText(lm.name.toUpperCase(), lm.x, lm.y);
    }
  }

  function drawEntities(state, v, time) {
    const p = state.player;
    // Mission marker: a pulsing beacon the player can always see.
    const marker = state.missions.marker();
    if (marker) {
      const pulse = 1 + Math.sin(time * 4) * 0.15;
      ctx.save();
      ctx.translate(marker.x, marker.y);
      ctx.strokeStyle = '#ffd60a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 214, 10, 0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd60a';
      ctx.beginPath();
      ctx.moveTo(0, -52 * pulse);
      ctx.lineTo(10, -30 * pulse);
      ctx.lineTo(-10, -30 * pulse);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Cash pickups.
    for (const pk of state.pickups) {
      const bob = Math.sin(time * 5 + pk.x) * 4;
      ctx.fillStyle = '#80ed99';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bob, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1b4332';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', pk.x, pk.y + bob);
    }
    // The prize car for the Hot Wheels job, with a marker.
    if (state.stealCar) {
      drawCarShape(state.stealCar, false, time);
      ctx.fillStyle = '#ffd60a';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▼', state.stealCar.x, state.stealCar.y - 44);
    }
    // Traffic.
    for (const car of state.traffic.cars) drawCarShape(car, false, time);
    // Police.
    for (const car of state.police.cars) drawCarShape(car, false, time);
    // Pedestrians.
    for (const ped of state.traffic.peds) {
      if (ped.x < v.left - 30 || ped.x > v.right + 30 || ped.y < v.top - 30 || ped.y > v.bottom + 30) continue;
      const bob = Math.sin(ped.walkPhase) * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(ped.x + 3, ped.y + 4, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y + bob, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.skin;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y - 2 + bob, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Rival crew (mission 5).
    for (const enemy of state.enemies) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(enemy.x + 3, enemy.y + 4, 11, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a0ca3';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f1c27d';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y - 2, 7, 0, Math.PI * 2);
      ctx.fill();
      // Gun barrel.
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(enemy.x, enemy.y);
      ctx.lineTo(enemy.x + Math.cos(enemy.angle) * 20, enemy.y + Math.sin(enemy.angle) * 20);
      ctx.stroke();
      // Health bar.
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(enemy.x - 14, enemy.y - 24, 28, 4);
      ctx.fillStyle = '#ef476f';
      ctx.fillRect(enemy.x - 14, enemy.y - 24, 28 * Math.max(0, enemy.health / 70), 4);
    }
    // The player's car.
    if (p.inCar && p.car) drawCarShape(p.car, true, time);
    // Bullets.
    ctx.fillStyle = '#ffd60a';
    for (const b of state.bullets) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.fillRect(-8, -1.5, 16, 3);
      ctx.restore();
    }
    // The player on foot.
    if (!p.inCar) {
      const bob = Math.sin(p.walkPhase) * 1.5;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(p.x + 3, p.y + 5, 11, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff6d00';
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f1c27d';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 2 + bob, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b2d42';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 5 + bob, 8, Math.PI, 0);
      ctx.fill();
      // Pistol in hand, pointing where the player aims.
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22);
      ctx.stroke();
      if (p.invuln > 0 && Math.floor(time * 12) % 2 === 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // Particles.
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // A red flash at the screen edge while wanted.
    if (state.wantedFlash > 0.05) {
      const g = ctx.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, height * 0.75);
      g.addColorStop(0, 'rgba(239,35,60,0)');
      g.addColorStop(1, `rgba(239,35,60,${0.28 * state.wantedFlash})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }
  }

  /** Draw one frame. `screen` is one of the SCREEN_* constants. */
  function draw(state, screen, time) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const v = view(state);
    ctx.save();
    ctx.scale(v.scale, v.scale);
    ctx.translate(v.ox / v.scale, v.oy / v.scale);
    drawCity(state, v, time);
    drawEntities(state, v, time);
    ctx.restore();
    // Warm sunlight wash over the whole frame.
    const sun = ctx.createLinearGradient(0, 0, width, height);
    sun.addColorStop(0, 'rgba(255, 214, 130, 0.10)');
    sun.addColorStop(0.5, 'rgba(255, 214, 130, 0.02)');
    sun.addColorStop(1, 'rgba(255, 140, 60, 0.08)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, width, height);
    return { width, height };
  }

  return { draw, resize, ctx, get width() { return width; }, get height() { return height; } };
}
