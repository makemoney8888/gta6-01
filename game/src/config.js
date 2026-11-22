// Solmar Bay — every tuning number, colour and name in one place.
// The world is a fixed 3840 x 3840 unit city. The camera follows the player and
// the renderer scales to the window, so no rule here depends on screen size.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

/** The city is a square of this many world units; the south edge is beach and sea. */
export const WORLD = { size: 3840, roadGap: 480, roadWidth: 96, sidewalk: 18 };

/** Where the sea starts (south edge): sand from here to the water line. */
export const COAST = { sandStart: 3360, waterStart: 3600 };

export const PLAYER = {
  radius: 14,
  walkSpeed: 210,
  runSpeed: 330,
  health: 100,
  pistolDamage: 34,
  pistolRange: 520,
  pistolCooldown: 0.22,
  ammoStart: 60,
};

export const CAR = {
  length: 64,
  width: 30,
  accel: 520,
  reverseAccel: 340,
  brake: 900,
  maxSpeed: 620,
  maxReverse: 220,
  steer: 2.6,
  grip: 0.94,
  health: 100,
};

export const POLICE = {
  maxStars: 5,
  chaseSpeed: 640,
  ramDamage: 5,
  bustSeconds: 1.6,
  spawnDistance: 900,
  despawnDistance: 1500,
  decayDelay: 9,
};

export const TRAFFIC = { cars: 26, peds: 42, carSpeed: 170, pedSpeed: 55 };

export const MISSION_REWARDS = [400, 900, 1400, 2000, 3500];

export const PALETTE = {
  sky: '#f7e3b0',
  grass: '#7fb069',
  grassDark: '#6da25c',
  park: '#8fbf6f',
  sand: '#ecd9a4',
  water: '#2e9db8',
  waterDeep: '#1f7fa0',
  sidewalk: '#cfc4ae',
  road: '#3d3a38',
  roadLine: '#e8d44d',
  curb: '#b8ab8f',
  buildingRoof: '#8a6f5c',
  text: '#fff8ea',
  muted: '#d8cbb2',
  hudPanel: 'rgba(20, 18, 24, 0.72)',
  hudAccent: '#ffb703',
  danger: '#ef476f',
  money: '#80ed99',
  policeBlue: '#4361ee',
  policeRed: '#ef233c',
};

export const BUILDING_COLORS = [
  '#e8b4b8', '#f4d58d', '#a8dadc', '#ffb4a2', '#cdb4db',
  '#ffc8dd', '#bde0fe', '#ffd6a5', '#caffbf', '#fdffb6',
  '#e0aaff', '#90dbf4', '#f1c0e8', '#b9fbc0', '#ffcfd2',
];

export const CAR_COLORS = [
  '#e63946', '#f4a261', '#2a9d8f', '#4361ee', '#f8f9fa',
  '#ffb703', '#7209b7', '#06d6a0', '#ef476f', '#118ab2',
  '#ff7b00', '#073b4c', '#8338ec', '#3a86ff', '#ffbe0b',
];

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Where the save (missions, money, best stats) is kept between visits (this browser only). */
export const SAVE_KEY = 'solmar-bay.save.v1';

/** The city the game is set in, and its people. All names are original. */
export const CITY_NAME = 'Solmar';
export const GAME_TITLE = 'SOLMAR BAY';
export const PROTAGONIST = 'Leo Marín';
export const CONTACTS = {
  mara: 'Mara Solis',
  eddie: 'Eddie Kwan',
  sal: 'Salvatore "Sal" Perri',
};
