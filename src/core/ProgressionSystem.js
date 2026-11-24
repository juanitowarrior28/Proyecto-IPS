export class ProgressionSystem {
  constructor(game) { this.game = game; game.state.on('CHAPTER_FINISHED', (id) => this.chapterFinished(id)); }
  chapterFinished(id) {
    const s = this.game.state.state;
    if (!s.completed.includes(id)) s.completed.push(id);
    if (!s.listened.includes(id)) s.listened.push(id);
    if (id === 'prologue' && !s.unlocked.includes('chapter1')) {
      s.unlocked.push('chapter1'); s.phase = 1;
      this.game.notify('Nuevo cassette desbloqueado: Capítulo 1');
    }
    if (id === 'chapter1') s.phase = 2;
    if (id === 'chapter2' && s.phase < 3) s.phase = 3;
    if (id === 'chapter3' && s.phase < 4) s.phase = 4;
    this.game.save();
  }
  solvePuzzle(answer) {
    const normalized = answer.toLowerCase().replace(/\s+/g, ' ').trim();
    if (['6', '6 pastillas', 'seis', 'seis pastillas'].includes(normalized)) {
      const s = this.game.state.state;
      s.puzzleSolved = true;
      if (!s.unlocked.includes('chapter2')) s.unlocked.push('chapter2');
      s.phase = 2;
      this.game.save();
      return true;
    }
    return false;
  }
  collectKeys() {
    const s = this.game.state.state;
    if (s.keysFound || !s.completed.includes('chapter2') || !s.drawer1Open) return false;
    s.keysFound = true; s.inventory.push('Llaves');
    this.game.save();
    return true;
  }
  collectTape3() {
    const s = this.game.state.state;
    if (s.tape3Found || !s.compartmentOpen) return false;
    s.tape3Found = true; s.inventory.push('Cassette — Capítulo 3');
    if (!s.unlocked.includes('chapter3')) s.unlocked.push('chapter3');
    s.phase = Math.max(s.phase, 3);
    this.game.save();
    return true;
  }
  addEnding(id) {
    const s = this.game.state.state;
    if (!s.endings.includes(id)) s.endings.push(id);
    this.game.save();
    if (id === 'ips') this.game.grantIpsReward();
  }
  unlockEndingCassette(id) {
    const s = this.game.state.state;
    if (!s.endings.includes(id) || !['vincent', 'leteo', 'ips'].includes(id)) return false;
    if (!s.endingCassettes.includes(id)) s.endingCassettes.push(id);
    this.game.save();
    if (id === 'ips') this.game.grantIpsReward();
    return true;
  }
}
