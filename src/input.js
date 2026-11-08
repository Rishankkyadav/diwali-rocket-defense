// Pointer (mouse + touch) and keyboard. Events are queued in native 480×270 coordinates
// and consumed once per frame by the game.
import { W, H } from './config.js';
import { unlock } from './audio.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.events = [];
    this.keys = new Set();
    this.pointer = { x: -1, y: -1, down: false, id: null };

    const toNative = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
    };

    window.addEventListener('pointerdown', (e) => {
      unlock(); // audio must start inside a user gesture
      if (this.pointer.down) return; // ignore extra fingers
      const p = toNative(e);
      this.pointer = { ...p, down: true, id: e.pointerId };
      this.events.push({ type: 'down', pointerType: e.pointerType, ...p });
      if (e.target === canvas) e.preventDefault();
    }, { passive: false });

    window.addEventListener('pointermove', (e) => {
      const p = toNative(e);
      if (this.pointer.down && e.pointerId !== this.pointer.id) return;
      this.pointer.x = p.x; this.pointer.y = p.y;
      this.events.push({ type: 'move', ...p });
    });

    const up = (e) => {
      if (!this.pointer.down || e.pointerId !== this.pointer.id) return;
      const p = toNative(e);
      this.pointer = { ...p, down: false, id: null };
      this.events.push({ type: e.type === 'pointercancel' ? 'cancel' : 'up', ...p });
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('blur', () => {
      if (this.pointer.down) this.events.push({ type: 'cancel', x: this.pointer.x, y: this.pointer.y });
      this.pointer.down = false;
      this.events.push({ type: 'blur' });
    });

    window.addEventListener('keydown', (e) => {
      unlock();
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.events.push({ type: 'key', code: e.code });
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  drain() {
    const ev = this.events;
    this.events = [];
    return ev;
  }
}
