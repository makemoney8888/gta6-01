// The HUD and the menus: money, health, wanted stars, the minimap, the mission
// objective bar, on-screen prompts, and the title / pause / busted / wasted screens.
// Everything here is screen-space, drawn after the world.

import { COAST, GAME_TITLE, PALETTE, PROTAGONIST, WORLD } from './config.js';
import { ROAD_LINES } from './city.js';

const MINIMAP = 196;

function panel(ctx, x, y, w, h, radius = 10) {
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
}

function drawStars(ctx, x, y, wanted) {
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < wanted ? '#ffb703' : 'rgba(255,255,255,0.28)';
    ctx.fillText('★', x + i * 28, y);
  }
}

function drawMinimap(ctx, state, width, height, time) {
  const size = MINIMAP;
  const x0 = width - size - 16;
  const y0 = 16;
  const scale = size / WORLD.size;
  panel(ctx, x0 - 6, y0 - 6, size + 12, size + 12, 12);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  // Ground and sea.
  ctx.fillStyle = '#5d8a4a';
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#2e9db8';
  ctx.fillRect(x0, y0 + COAST.waterStart * scale, size, size - COAST.waterStart * scale);
  ctx.fillStyle = '#ecd9a4';
  ctx.fillRect(x0, y0 + COAST.sandStart * scale, size, (COAST.waterStart - COAST.sandStart) * scale);
  // Roads.
  ctx.strokeStyle = '#3d3a38';
  ctx.lineWidth = 3;
  for (const line of ROAD_LINES) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + line * scale);
    ctx.lineTo(x0 + size, y0 + line * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0 + line * scale, y0);
    ctx.lineTo(x0 + line * scale, y0 + size);
    ctx.stroke();
  }
  // Mission marker.
  const marker = state.missions.marker();
  if (marker) {
    const pulse = 10 + Math.sin(time * 5) * 3;
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath();
    ctx.arc(x0 + marker.x * scale, y0 + marker.y * scale, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', x0 + marker.x * scale, y0 + marker.y * scale);
  }
  // Police cars.
  for (const car of state.police.cars) {
    ctx.fillStyle = Math.floor(time * 4) % 2 === 0 ? '#ff2e4d' : '#2e6bff';
    ctx.beginPath();
    ctx.arc(x0 + car.x * scale, y0 + car.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player, as a white arrow.
  const p = state.player;
  ctx.save();
  ctx.translate(x0 + p.x * scale, y0 + p.y * scale);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-6, -6);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#fff8ea';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('SOLMAR', x0, y0 + size + 20);
}

function drawHud(ctx, state, width, height, time, prompt) {
  const p = state.player;
  // Top-left cluster: money, health, wanted, ammo.
  panel(ctx, 16, 16, 250, 132, 12);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PALETTE.money;
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(`$${state.money.toLocaleString('en-US')}`, 30, 48);
  ctx.fillStyle = '#fff8ea';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`Missions done: ${state.missions.completed} / 5`, 30, 70);
  drawStars(ctx, 30, 92, state.police.wanted);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.roundRect(30, 104, 160, 10, 5);
  ctx.fill();
  ctx.fillStyle = p.health > 30 ? '#80ed99' : '#ef476f';
  ctx.beginPath();
  ctx.roundRect(30, 104, 160 * Math.max(0, p.health / 100), 10, 5);
  ctx.fill();
  ctx.fillStyle = '#fff8ea';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('HEALTH', 196, 113);
  if (!p.inCar) {
    ctx.fillStyle = '#fff8ea';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(`AMMO ${p.ammo}`, 30, 134);
  }
  drawMinimap(ctx, state, width, height, time);
  // Objective bar at the bottom. The text comes from missions.objectiveText(),
  // which always returns a real label — never "undefined".
  const objective = state.missions.objectiveText();
  if (objective) {
    ctx.font = 'bold 16px system-ui, sans-serif';
    const tw = ctx.measureText(objective).width;
    const bw = Math.min(width - 40, tw + 48);
    panel(ctx, (width - bw) / 2, height - 64, bw, 40, 10);
    ctx.fillStyle = '#ffd60a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(objective, width / 2, height - 44);
  }
  // Story message toast.
  if (state.missions.messageTimer > 0 && state.missions.message) {
    ctx.font = '15px system-ui, sans-serif';
    const lines = wrapText(ctx, state.missions.message, width - 160);
    const lh = 21;
    const bh = lines.length * lh + 20;
    panel(ctx, 80, height - 64 - bh - 12, width - 160, bh, 10);
    ctx.fillStyle = '#fff8ea';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, i) => {
      ctx.fillText(line, width / 2, height - 64 - bh - 12 + 20 + i * lh);
    });
  }
  // Speedometer while driving.
  if (p.inCar && p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.32);
    panel(ctx, width - 170, height - 96, 154, 72, 12);
    ctx.fillStyle = '#fff8ea';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(kmh), width - 56, height - 52);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#d8cbb2';
    ctx.textAlign = 'left';
    ctx.fillText('km/h', width - 50, height - 52);
    // Car health.
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.roundRect(width - 154, height - 40, 122, 8, 4);
    ctx.fill();
    ctx.fillStyle = p.car.health > 30 ? '#80ed99' : '#ef476f';
    ctx.beginPath();
    ctx.roundRect(width - 154, height - 40, 122 * Math.max(0, p.car.health / 100), 8, 4);
    ctx.fill();
  }
  // Context prompt ("E — Steal car", "Q — Start mission").
  if (prompt) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    const tw = ctx.measureText(prompt).width;
    panel(ctx, (width - tw - 36) / 2, height - 118, tw + 36, 34, 9);
    ctx.fillStyle = '#ffd60a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(prompt, width / 2, height - 101);
  }
  // Controls hint, bottom-left.
  ctx.fillStyle = 'rgba(255,248,234,0.75)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WASD move / drive · E enter car · Mouse aim · Click shoot · Q mission · P pause · M mute', 16, height - 14);
  // Busted progress ring.
  if (state.police.bustProgress > 0.02) {
    const cx = width / 2;
    const cy = height / 2 - 90;
    ctx.fillStyle = 'rgba(20,18,24,0.8)';
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ef476f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, 28, -Math.PI / 2, -Math.PI / 2 + state.police.bustProgress * Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff8ea';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BUSTED?', cx, cy);
  }
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawTitle(ctx, state, width, height, hasSave, time) {
  ctx.fillStyle = 'rgba(20, 16, 10, 0.45)';
  ctx.fillRect(0, 0, width, height);
  const cx = width / 2;
  // Sun glow behind the title.
  const glow = ctx.createRadialGradient(cx, height * 0.32, 10, cx, height * 0.32, 320);
  glow.addColorStop(0, 'rgba(255, 200, 90, 0.35)');
  glow.addColorStop(1, 'rgba(255, 200, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffd60a';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('WELCOME TO', cx, height * 0.2);
  ctx.fillStyle = '#fff8ea';
  ctx.font = `900 ${Math.round(Math.min(96, width * 0.09))}px system-ui, sans-serif`;
  ctx.shadowColor = 'rgba(255, 120, 40, 0.8)';
  ctx.shadowBlur = 30;
  ctx.fillText(GAME_TITLE, cx, height * 0.34);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffb703';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('A SUN-SOAKED OPEN-WORLD CRIME STORY', cx, height * 0.4);
  ctx.fillStyle = '#fff8ea';
  ctx.font = '17px system-ui, sans-serif';
  const story = [
    `${PROTAGONIST} owes money to the wrong people in Solmar — a coastal city of`,
    'neon nights, beachfront deals and cops who never sleep. Drive, steal, run',
    'and fight your way through five jobs to buy your freedom.',
  ];
  story.forEach((line, i) => ctx.fillText(line, cx, height * 0.48 + i * 26));
  // Controls card.
  panel(ctx, cx - 330, height * 0.6, 660, 118, 14);
  ctx.fillStyle = '#ffd60a';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('HOW TO PLAY', cx, height * 0.6 + 28);
  ctx.fillStyle = '#fff8ea';
  ctx.font = '15px system-ui, sans-serif';
  const controls = [
    'WASD / Arrows — walk or drive      E — steal / enter a car',
    'Mouse — aim      Click — shoot      Shift — run      Space — handbrake',
    'Q — start the next job      P — pause      M — mute',
  ];
  controls.forEach((line, i) => ctx.fillText(line, cx, height * 0.6 + 56 + i * 22));
  const pulse = 0.6 + Math.sin(time * 3) * 0.4;
  ctx.fillStyle = `rgba(255, 214, 10, ${pulse})`;
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(hasSave ? 'ENTER — CONTINUE YOUR STORY' : 'ENTER — START YOUR STORY', cx, height * 0.82);
  ctx.fillStyle = 'rgba(255,248,234,0.75)';
  ctx.font = '14px system-ui, sans-serif';
  const stats = hasSave
    ? `Saved: $${state.money.toLocaleString('en-US')} · ${state.missions.completed} of 5 jobs done · best wanted ${'★'.repeat(state.stats.bestWanted) || '—'}`
    : 'New game — $250 in your pocket, five jobs ahead of you.';
  ctx.fillText(stats, cx, height * 0.87);
}

function drawPaused(ctx, width, height) {
  ctx.fillStyle = 'rgba(15, 12, 20, 0.6)';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff8ea';
  ctx.font = '900 54px system-ui, sans-serif';
  ctx.fillText('PAUSED', width / 2, height / 2 - 20);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = '#d8cbb2';
  ctx.fillText('P or Esc — resume      Enter — restart from the last save', width / 2, height / 2 + 24);
}

function drawOver(ctx, state, width, height, kind) {
  ctx.fillStyle = kind === 'busted' ? 'rgba(20, 30, 90, 0.72)' : 'rgba(60, 10, 10, 0.72)';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'busted' ? '#7aa2ff' : '#ef476f';
  ctx.font = '900 84px system-ui, sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', width / 2, height / 2 - 40);
  ctx.fillStyle = '#fff8ea';
  ctx.font = '19px system-ui, sans-serif';
  const lines = kind === 'busted'
    ? ['The Solmar PD hauled you in. Your lawyer got you out —', 'but the jobs are still waiting.']
    : ['Solmar chewed you up. But the city never keeps a driver', 'down for long.'];
  lines.forEach((line, i) => ctx.fillText(line, width / 2, height / 2 + 8 + i * 28));
  ctx.fillStyle = '#ffd60a';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(
    `$${state.money.toLocaleString('en-US')} · ${state.missions.completed} of 5 jobs done · ${state.stats.carsStolen} cars stolen`,
    width / 2,
    height / 2 + 84,
  );
  ctx.fillStyle = 'rgba(255,248,234,0.85)';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('ENTER — BACK ON THE STREETS', width / 2, height / 2 + 130);
}

export function createHud() {
  return {
    drawHud,
    drawTitle,
    drawPaused,
    drawOver,
  };
}
