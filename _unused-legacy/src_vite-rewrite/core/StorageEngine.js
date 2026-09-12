/* ============================================================
   StorageEngine — a tiny localStorage wrapper. The one job it
   does that raw localStorage calls scattered around don't: fail
   silently and consistently in private-browsing / storage-disabled
   contexts, instead of every call site needing its own try/catch.
============================================================ */

export const StorageEngine = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false; // private mode / storage disabled — caller just skips persistence
    }
  },
};
