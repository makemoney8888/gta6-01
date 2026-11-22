// Keyboard and mouse input: held keys as a set, one-shot actions consumed by the loop,
// and the mouse position in canvas pixels (converted to world coordinates by the caller).

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_SHOOT = 8;
export const ACTION_RUN = 16;
export const ACTION_HANDBRAKE = 32;
export const ACTION_MUTE = 64;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  Escape: ACTION_PAUSE,
  KeyP: ACTION_PAUSE,
  KeyE: ACTION_ENTER_CAR,
  KeyM: ACTION_MUTE,
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDown = false;
  const mouse = { x: 0, y: 0 };

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    const action = KEY_ACTIONS[event.code];
    if (action) actions |= action;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    if (event.button === 0) {
      mouseDown = true;
      onMouseMove(event);
      actions |= ACTION_SHOOT;
    }
  }
  function onMouseUp(event) {
    if (event.button === 0) mouseDown = false;
  }
  function onBlur() {
    keys.clear();
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onBlur);

  return {
    mouse,
    isMouseDown() {
      return mouseDown;
    },
    /** -1/0/1 steering and throttle from WASD or arrows, as {x, y}. */
    drive() {
      const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const y = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      return { x, y };
    },
    /** -1/0/1 movement on foot. */
    walk() {
      return this.drive();
    },
    isRunning() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    isHandbrake() {
      return keys.has('Space');
    },
    /** One-shot actions matching `mask` since the last call; consuming them clears only those bits. */
    takeActions(mask = 0xffffffff) {
      const taken = actions & mask;
      actions &= ~mask;
      return taken;
    },
    hasAction(action) {
      return (actions & action) !== 0;
    },
  };
}
