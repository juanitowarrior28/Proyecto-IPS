const KEY = 'effecto-ips-save-v1';

export const defaultSave = () => ({
  version: 1,
  unlocked: ['prologue'],
  completed: [],
  listened: [],
  puzzleSolved: false,
  keysFound: false,
  drawer1Open: false,
  drawer3Open: false,
  compartmentUnlocked: false,
  compartmentOpen: false,
  tape3Found: false,
  inventory: [],
  phase: 0,
  endings: [],
  endingCassettes: [],
  endingPlayCounts: { vincent: 0, leteo: 0, ips: 0 },
  settings: {
    subtitles: true,
    generalVolume: 0.8,
    radioVolume: 0.9,
    ambientVolume: 0.35,
    effectsVolume: 0.7,
    musicVolume: 0.35,
    mouseSensitivity: 1.8,
    reduceFlashes: false,
    reduceMovement: false,
    interference: true
  }
});

export class SaveManager {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.version !== 1 || !Array.isArray(data.unlocked)) throw new Error('Formato incompatible');
      const settings = { ...defaultSave().settings, ...data.settings };
      delete settings.musicEnabled;
      delete settings.musicMode;
      const save = { ...defaultSave(), ...data, settings };
      const legacyEndingIds = {
        'FINAL 1 — VINCENT': 'vincent',
        'FINAL 2 — LETEO': 'leteo',
        'FINAL 3 — IPS': 'ips'
      };
      save.endings = Array.isArray(data.endings)
        ? data.endings.map((ending) => legacyEndingIds[ending] || ending)
        : [];
      save.endingCassettes = Array.isArray(data.endingCassettes) ? data.endingCassettes : [];
      const endingIds = ['vincent', 'leteo', 'ips'];
      const storedPlayCounts = data.endingPlayCounts && typeof data.endingPlayCounts === 'object'
        ? data.endingPlayCounts
        : {};
      save.endingPlayCounts = Object.fromEntries(endingIds.map((id) => {
        const count = storedPlayCounts[id];
        const validCount = Number.isSafeInteger(count) && count >= 0 ? count : 0;
        const previouslyCompleted = Array.isArray(save.completed) && save.completed.includes(id);
        return [id, Math.max(validCount, previouslyCompleted ? 1 : 0)];
      }));
      if (!Object.hasOwn(data, 'compartmentUnlocked') && data.lockerOpen) save.compartmentUnlocked = true;
      if (!Object.hasOwn(data, 'compartmentOpen') && data.lockerOpen) save.compartmentOpen = true;
      return save;
    } catch (error) {
      console.warn('Guardado dañado; se usará una partida nueva.', error);
      return null;
    }
  }
  save(state) { localStorage.setItem(KEY, JSON.stringify(state)); }
  exists() { return Boolean(localStorage.getItem(KEY)); }
  clear() { localStorage.removeItem(KEY); }
}
