// The city of Solmar: a seeded grid of roads and blocks, a park, a marina district,
// a beach and sea along the south edge, and named landmarks that sit on the middle
// of their own blocks. Generation is deterministic for a seed; rendering and
// collision both read this one structure.
//
// Layout rule: road centrelines run at 240, 720, 1200, ... and each block sits
// BETWEEN two neighbouring roads, never under one — so buildings never touch a
// road and cars can drive every street without scraping a wall.

import { BUILDING_COLORS, COAST, WORLD } from './config.js';
import { createRandom } from './random.js';

export const ROAD_LINES = [];
for (let p = WORLD.roadGap / 2; p < WORLD.size; p += WORLD.roadGap) ROAD_LINES.push(p);

/** True when the point is on a road (not on a block). */
export function isOnRoad(x, y) {
  const hw = WORLD.roadWidth / 2;
  for (const line of ROAD_LINES) {
    if (Math.abs(x - line) < hw || Math.abs(y - line) < hw) return true;
  }
  return false;
}

/** True when the point is in the sea (south of the water line). */
export function isWater(x, y) {
  return y >= COAST.waterStart;
}

/** True when the point is on sand (beach strip, walkable, no cars). */
export function isSand(x, y) {
  return y >= COAST.sandStart && y < COAST.waterStart;
}

// The gap between two neighbouring roads, minus road and sidewalk on each side.
const BLOCK_INSET = WORLD.roadWidth / 2 + WORLD.sidewalk;

/** The rectangle of the block in column `col`, row `row` (between two roads). */
function blockRect(col, row) {
  const gap = WORLD.roadGap;
  return {
    x: col * gap + gap / 2 + BLOCK_INSET,
    y: row * gap + gap / 2 + BLOCK_INSET,
    w: gap - 2 * BLOCK_INSET,
    h: gap - 2 * BLOCK_INSET,
  };
}

/** The centre of the block in column `col`, row `row` — where landmarks live. */
export function blockCenter(col, row) {
  const gap = WORLD.roadGap;
  return { x: col * gap + gap, y: row * gap + gap };
}

// Named places, each pinned to the centre of its own block so its label never
// lands on a park, a road or the wrong building. The two beach spots have no
// block (they sit on the sand) and are drawn by the renderer instead.
const LANDMARK_SPOTS = [
  { name: 'Old Town Market', col: 1, row: 1, kind: 'market' },
  { name: 'Solmar Stadium', col: 6, row: 1, kind: 'stadium' },
  { name: 'Harbor Bank', col: 4, row: 2, kind: 'bank' },
  { name: 'Palmera Park', col: 3, row: 3, kind: 'park' },
  { name: 'Sunset Garage', col: 2, row: 4, kind: 'garage' },
  { name: 'Grand Solmar Hotel', col: 6, row: 5, kind: 'hotel' },
  { name: 'Solmar Pier', x: 1920, y: 3520, kind: 'pier' },
  { name: 'Marina Docks', x: 600, y: 3480, kind: 'docks' },
];

/**
 * Build the city. Returns blocks (each with buildings, trees, kind), the landmark
 * list, and the named places missions can point at.
 */
export function createCity(seed) {
  const rng = createRandom(seed);
  const blocks = [];
  const cols = ROAD_LINES.length - 1;
  const rows = ROAD_LINES.length - 1;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const rect = blockRect(col, row);
      // The last row is beach: no blocks there.
      if (rect.y + rect.h > COAST.sandStart - WORLD.sidewalk) continue;
      const roll = rng.next();
      const kind = roll < 0.14 ? 'park' : roll < 0.22 ? 'plaza' : 'buildings';
      const block = { ...rect, kind, buildings: [], trees: [] };
      if (kind === 'park') {
        for (let i = 0; i < 9; i += 1) {
          block.trees.push({
            x: rect.x + rng.range(30, rect.w - 30),
            y: rect.y + rng.range(30, rect.h - 30),
            r: rng.range(9, 15),
          });
        }
      } else if (kind === 'buildings') {
        const count = rng.int(2, 4);
        const slots = [
          { x: rect.x + 14, y: rect.y + 14, w: rect.w / 2 - 24, h: rect.h / 2 - 24 },
          { x: rect.x + rect.w / 2 + 10, y: rect.y + 14, w: rect.w / 2 - 24, h: rect.h / 2 - 24 },
          { x: rect.x + 14, y: rect.y + rect.h / 2 + 10, w: rect.w / 2 - 24, h: rect.h / 2 - 24 },
          { x: rect.x + rect.w / 2 + 10, y: rect.y + rect.h / 2 + 10, w: rect.w / 2 - 24, h: rect.h / 2 - 24 },
        ];
        for (let i = 0; i < count; i += 1) {
          const s = slots[i];
          block.buildings.push({
            ...s,
            color: rng.pick(BUILDING_COLORS),
            height: rng.int(1, 5),
            windows: rng.int(6, 18),
            seed: rng.int(0, 99999),
          });
        }
        for (let i = 0; i < rng.int(1, 3); i += 1) {
          block.trees.push({
            x: rect.x + rng.range(20, rect.w - 20),
            y: rect.y + rng.range(20, rect.h - 20),
            r: rng.range(8, 12),
          });
        }
      }
      blocks.push(block);
    }
  }

  // Landmarks claim their blocks: Palmera Park becomes a park with a pond, the
  // others become built-up blocks, so no label ever sits over the wrong kind.
  const landmarks = [];
  for (const spot of LANDMARK_SPOTS) {
    if (spot.col !== undefined) {
      const centre = blockCenter(spot.col, spot.row);
      const block = blocks.find((b) => centre.x >= b.x && centre.x <= b.x + b.w && centre.y >= b.y && centre.y <= b.y + b.h);
      if (block) {
        block.kind = spot.kind === 'park' ? 'park' : 'buildings';
        block.buildings = [];
        block.trees = [];
        if (spot.kind === 'park') {
          block.pond = { x: centre.x, y: centre.y, r: 70 };
          for (let i = 0; i < 9; i += 1) {
            block.trees.push({
              x: block.x + rng.range(30, block.w - 30),
              y: block.y + rng.range(30, block.h - 30),
              r: rng.range(9, 15),
            });
          }
        } else {
          // One big building fills a landmark block, so the place reads as a place.
          block.buildings.push({
            x: block.x + 24,
            y: block.y + 24,
            w: block.w - 48,
            h: block.h - 48,
            color: rng.pick(BUILDING_COLORS),
            height: rng.int(3, 5),
            windows: rng.int(14, 24),
            seed: rng.int(0, 99999),
          });
        }
      }
      landmarks.push({ name: spot.name, x: centre.x, y: centre.y, kind: spot.kind });
    } else {
      landmarks.push({ name: spot.name, x: spot.x, y: spot.y, kind: spot.kind });
    }
  }

  return { blocks, landmarks, rng };
}

/** A point on a road, for spawning cars and for mission waypoints. */
export function randomRoadPoint(rng) {
  const line = rng.pick(ROAD_LINES);
  const along = rng.range(120, WORLD.size - 120);
  return rng.chance(0.5) ? { x: line, y: along } : { x: along, y: line };
}

/** A point on a sidewalk beside a road, for pedestrians. */
export function randomSidewalkPoint(rng) {
  const line = rng.pick(ROAD_LINES);
  const along = rng.range(120, WORLD.size - 120);
  const off = WORLD.roadWidth / 2 + WORLD.sidewalk / 2;
  return rng.chance(0.5)
    ? { x: line + (rng.chance(0.5) ? off : -off), y: along }
    : { x: along, y: line + (rng.chance(0.5) ? off : -off) };
}

/** The nearest point on a road centreline to (x, y). */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const line of ROAD_LINES) {
    const d1 = Math.abs(x - line);
    const d2 = Math.abs(y - line);
    if (d1 < bestDist) { bestDist = d1; best = { x: line, y }; }
    if (d2 < bestDist) { bestDist = d2; best = { x, y: line }; }
  }
  return best;
}

/**
 * Circle-vs-buildings collision: push a circle of radius `r` out of any building
 * it overlaps. Returns the corrected position and whether a push happened.
 * Buildings are solid; trees are not.
 */
export function collideBuildings(city, x, y, r) {
  let pushed = false;
  for (const block of city.blocks) {
    for (const b of block.buildings) {
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.001;
        const push = r - d;
        x += (dx / d) * push;
        y += (dy / d) * push;
        pushed = true;
      }
    }
  }
  return { x, y, pushed };
}

/** Clamp a point inside the walkable city (never into the sea). */
export function clampToCity(x, y, margin = 40) {
  return {
    x: Math.max(margin, Math.min(WORLD.size - margin, x)),
    y: Math.max(margin, Math.min(COAST.waterStart - margin, y)),
  };
}
