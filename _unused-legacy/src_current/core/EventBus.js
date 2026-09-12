/* ============================================================
   EventBus — the single decoupling point between engines.

   Why this exists: without it, e.g. ScrollEngine would need to
   import ParticleEngine directly to change petal "mood" on scroll,
   and CursorEngine would need to import AudioEngine to duck the
   glow near the player. That's exactly the tight coupling the
   brief asks to avoid. Instead every engine only knows about the
   bus: it emits events it owns, and listens for events it cares
   about, never reaching into another engine's internals.
============================================================ */

class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, handler) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    this._listeners.get(event)?.delete(handler);
  }

  emit(event, payload) {
    this._listeners.get(event)?.forEach((handler) => {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] listener for "${event}" threw:`, err);
      }
    });
  }
}

// One shared bus for the whole page — intentional singleton, this
// is infrastructure, not per-feature state.
export const bus = new EventBus();
