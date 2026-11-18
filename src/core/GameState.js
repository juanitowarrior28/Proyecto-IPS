export class GameState {
  constructor(save) {
    this.state = save;
    this.listeners = new Map();
  }
  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
  }
  emit(event, detail) {
    this.listeners.get(event)?.forEach((fn) => fn(detail));
  }
  update(mutator) {
    mutator(this.state);
  }
}
