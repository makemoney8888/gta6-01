// Missions: a five-job story arc for Leo Marín, a driver for hire in Solmar who owes
// money to the wrong people. Each mission is a list of steps (go to, pick up, deliver,
// survive, escape); the world drives the step machine, the HUD shows the objective,
// and completing a mission pays out and unlocks the next. Names are all original.
//
// Every step carries a label the HUD can show — the objective line never reads
// "undefined". Targets sit on the street in front of their landmark (a mission
// marker inside a solid building could never be reached):
// Old Town Market (960, 1200), Palmera Park (1920, 1680), Sunset Garage (1440, 2640),
// Harbor Bank (2400, 1680), Grand Solmar Hotel (3360, 3120), Marina Docks (600, 3480),
// Solmar Pier (1920, 3520).

import { MISSION_REWARDS } from './config.js';

function pickup(x, y, label) {
  return { type: 'pickup', x, y, radius: 52, label };
}
function deliver(x, y, label) {
  return { type: 'deliver', x, y, radius: 52, label };
}
function survive(seconds) {
  return { type: 'survive', seconds, label: 'Stay alive — the heat is on' };
}
function escapeTo(x, y, label) {
  return { type: 'escape', x, y, radius: 52, label };
}

export const MISSIONS = [
  {
    id: 1,
    title: 'First Fare',
    contact: 'Mara Solis',
    intro: 'Mara needs a driver who asks no questions. Pick up her cousin at the Old Town Market and drop him at the Grand Solmar Hotel. Drive like you mean it — the meter is running.',
    steps: [
      pickup(960, 1200, 'Pick up the passenger at Old Town Market'),
      deliver(3360, 3120, 'Drop him at the Grand Solmar Hotel'),
    ],
    reward: MISSION_REWARDS[0],
    outro: 'Clean run. Mara says you drive like a local. She has more work — and it pays better.',
  },
  {
    id: 2,
    title: 'Hot Wheels',
    contact: 'Eddie Kwan',
    intro: 'Eddie wants a specific car — a red convertible parked by Palmera Park. Take it, any way you like, and bring it to Sunset Garage. The cops will notice. They always do.',
    steps: [
      { type: 'steal', x: 1920, y: 1680, radius: 60, label: 'Steal the red convertible by Palmera Park' },
      deliver(1440, 2640, 'Deliver it to Sunset Garage'),
    ],
    reward: MISSION_REWARDS[1],
    outro: 'Eddie is thrilled. The car was "borrowed" from a man who collects debts. He will want it back.',
  },
  {
    id: 3,
    title: 'Beach Run',
    contact: 'Mara Solis',
    intro: 'Three parcels, three drop-offs along the beachfront, before the tide comes in — forty seconds a stop, give or take. Mara is counting on you.',
    timeLimit: 150,
    steps: [
      deliver(600, 3480, 'Parcel 1 — Marina Docks'),
      deliver(1920, 3520, 'Parcel 2 — Solmar Pier'),
      deliver(3120, 3300, 'Parcel 3 — South Beach'),
    ],
    reward: MISSION_REWARDS[2],
    outro: 'Every parcel landed. Mara slips you a bonus and a warning: Sal Perri has started asking about you.',
  },
  {
    id: 4,
    title: 'Heat',
    contact: 'Eddie Kwan',
    intro: 'Sal Perri sent his crew to collect. The police are already on you — three stars and climbing. Lose them, then get to the safehouse in Old Town. Do not stop moving.',
    steps: [
      { type: 'wanted', stars: 3, label: 'The heat is on — you are wanted' },
      survive(20),
      escapeTo(960, 1200, 'Reach the safehouse in Old Town'),
    ],
    reward: MISSION_REWARDS[3],
    outro: 'You slipped the net. Eddie says Sal is done playing games — one last job, and your debt is wiped.',
  },
  {
    id: 5,
    title: 'The Big Score',
    contact: 'Salvatore "Sal" Perri',
    intro: 'Sal calls in the debt: Harbor Bank, midday. Walk in, take the cash, and get out. His crew will cover the street — but the whole city will be after you. Reach the Marina Docks and the boat is yours.',
    steps: [
      { type: 'rob', x: 2400, y: 1680, radius: 60, label: 'Get inside Harbor Bank and grab the cash' },
      { type: 'fight', count: 4, label: 'Deal with Sal\u2019s crew on the street' },
      escapeTo(600, 3480, 'Escape to the Marina Docks'),
    ],
    reward: MISSION_REWARDS[4],
    outro: 'The boat pulls out as the sirens fade. Debt paid, city behind you — for now. Solmar is yours.',
  },
];

export function createMissions() {
  let activeIndex = -1; // index into MISSIONS, -1 when between missions
  let stepIndex = 0;
  let timer = 0;
  let fightLeft = 0;
  let completed = 0;
  let message = '';
  let messageTimer = 0;

  function current() {
    return activeIndex >= 0 ? MISSIONS[activeIndex] : null;
  }
  function currentStep() {
    const m = current();
    return m ? m.steps[stepIndex] : null;
  }

  return {
    get activeIndex() { return activeIndex; },
    get completed() { return completed; },
    get message() { return message; },
    get messageTimer() { return messageTimer; },
    get fightLeft() { return fightLeft; },
    current,
    currentStep,
    /** Start the next mission (the first not yet completed), or null when done. */
    startNext() {
      if (completed >= MISSIONS.length) return null;
      activeIndex = completed;
      stepIndex = 0;
      timer = MISSIONS[activeIndex].timeLimit || 0;
      fightLeft = 0;
      const m = MISSIONS[activeIndex];
      const step = m.steps[0];
      if (step.type === 'fight') fightLeft = step.count;
      message = `${m.contact}: ${m.intro}`;
      messageTimer = 7;
      return m;
    },
    /** The world calls this when the player reaches the current marker. */
    reachedMarker() {
      const m = current();
      if (!m) return false;
      const step = m.steps[stepIndex];
      if (!step) return false;
      if (step.type === 'go' || step.type === 'pickup' || step.type === 'deliver' || step.type === 'escape' || step.type === 'rob') {
        stepIndex += 1;
        return true;
      }
      return false;
    },
    /** Advance one step (used by timed/fight/survive completions). */
    advanceStep() {
      stepIndex += 1;
    },
    /** True when the current mission has no more steps. */
    isMissionDone() {
      const m = current();
      return m ? stepIndex >= m.steps.length : false;
    },
    /** Pay out the finished mission and move to the next. Returns the reward. */
    completeMission() {
      const m = current();
      const reward = m ? m.reward : 0;
      completed += 1;
      activeIndex = -1;
      stepIndex = 0;
      timer = 0;
      message = m ? m.outro : '';
      messageTimer = 7;
      return reward;
    },
    failMission(reason) {
      const m = current();
      activeIndex = -1;
      stepIndex = 0;
      timer = 0;
      message = reason || (m ? `${m.title} failed.` : 'Mission failed.');
      messageTimer = 6;
    },
    setTimer(seconds) {
      timer = seconds;
    },
    get timer() {
      return timer;
    },
    tickTimer(dt) {
      if (timer > 0) timer -= dt;
    },
    setFightLeft(n) {
      fightLeft = n;
    },
    showMessage(text, seconds = 5) {
      message = text;
      messageTimer = seconds;
    },
    tickMessage(dt) {
      if (messageTimer > 0) messageTimer -= dt;
    },
    /** Restore progress from a save: how many missions are done. */
    load(completedCount) {
      completed = Math.max(0, Math.min(MISSIONS.length, completedCount || 0));
    },
    /** The objective line the HUD shows, or null. Never "undefined": every step has a label, and this falls back to a plain one. */
    objectiveText() {
      const m = current();
      if (!m) return null;
      const step = m.steps[stepIndex];
      if (!step) return null;
      const label = step.label || 'Reach the marker';
      if (step.type === 'survive') return `${m.title}: Stay alive — ${Math.ceil(timer)}s left`;
      if (m.timeLimit) return `${m.title}: ${label} — ${Math.ceil(timer)}s left`;
      if (step.type === 'fight') return `${m.title}: ${label} — ${fightLeft} left`;
      return `${m.title}: ${label}`;
    },
    /** The current marker position for the map, or null. */
    marker() {
      const step = currentStep();
      if (!step || step.x === undefined) return null;
      return { x: step.x, y: step.y };
    },
  };
}
