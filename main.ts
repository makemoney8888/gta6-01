// Solmar Bay — a gta6-01 entry (Node 22, standard library only): the game is this
// directory's game/ folder, plain static files a desktop browser loads offline
// (game/index.html and its ES modules, no library and no network request), and the
// program hands it in. It copies game/ and screenshots/ from beside this file to
// /output and writes /output/dossier.json, the summary the judge reads, with the
// vendored make.fun library, then reads the dossier back and checks it against the
// scorer's caps so a bad build fails loudly here instead of at the gate. The game
// itself is an original top-down open-world crime story: Leo Marín drives, steals
// cars, outruns the Solmar PD and runs five story missions across a coastal city
// with traffic, pedestrians, a wanted level, combat, a HUD with a minimap and a
// localStorage save.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Count the files and bytes under a directory, recursively. */
function countTree(dir) {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = countTree(path);
      files += sub.files;
      bytes += sub.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += statSync(path).size;
    }
  }
  return { files, bytes };
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// Read the dossier back and check it against the gate's caps, so a build that
// would be refused fails here with a clear message instead of at the gate.
const dossierBytes = statSync(join(out, 'dossier.json')).size;
if (dossierBytes > 1572864) throw new Error(`dossier.json is ${dossierBytes} bytes, over the 1.5 MiB cap`);
const game = countTree(join(out, 'game'));
if (game.files > 993) throw new Error(`game/ holds ${game.files} files, over the 993 cap`);
if (game.bytes > 50331648) throw new Error(`game/ is ${game.bytes} bytes, over the 48 MiB cap`);
const shots = readdirSync(join(out, 'screenshots')).filter((name) => !name.startsWith('.'));
if (shots.length < 3 || shots.length > 4) throw new Error(`screenshots/ holds ${shots.length} images, need 3 or 4`);
for (const name of shots) {
  const size = statSync(join(out, 'screenshots', name)).size;
  if (size > 262144) throw new Error(`screenshots/${name} is ${size} bytes, over the 256 KiB cap`);
}
const parsed = JSON.parse(readFileSync(join(out, 'dossier.json'), 'utf8'));
if (typeof parsed.text !== 'string' || parsed.text.length === 0) throw new Error('dossier.json has no text');
// The gate also caps each screenshot's pixels (long side at most 1280, short side
// at least 480) and refuses dotfiles inside game/ — check both here too. JPEG
// dimensions come from the first SOF marker in the file header.
function jpegDimensions(path) {
  const buf = readFileSync(path);
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}
for (const name of shots) {
  const path = join(out, 'screenshots', name);
  const dims = jpegDimensions(path);
  if (!dims) throw new Error(`screenshots/${name} is not a readable JPEG`);
  if (Math.max(dims.width, dims.height) > 1280 || Math.min(dims.width, dims.height) < 480) {
    throw new Error(`screenshots/${name} is ${dims.width}x${dims.height}, outside the 1280 / 480 pixel caps`);
  }
}
function checkNoDotfiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) throw new Error(`game/ must hold no dotfiles, found ${join(dir, entry.name)}`);
    if (entry.isDirectory()) checkNoDotfiles(join(dir, entry.name));
  }
}
checkNoDotfiles(join(out, 'game'));
const indexBytes = statSync(join(out, 'game', 'index.html')).size;
if (indexBytes > 1048576) throw new Error(`game/index.html is ${indexBytes} bytes, over the 1 MiB cap`);
console.log(`Solmar Bay handed in: game/ ${game.files} files, ${game.bytes} bytes; screenshots ${shots.join(', ')}; dossier.json ${dossierBytes} bytes.`);
