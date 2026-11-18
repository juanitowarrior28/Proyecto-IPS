export class AudioSystem {
  constructor() {
    this.context = null;
  }
  ensure() {
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === 'suspended') this.context.resume();
  }
  ambient() {
    this.ensure();
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sine'; osc.frequency.value = 58;
    gain.gain.value = 0.018;
    osc.connect(gain).connect(this.context.destination);
    osc.start();
  }
  click() {
    this.ensure();
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.frequency.value = 220; gain.gain.value = 0.025;
    osc.connect(gain).connect(this.context.destination);
    osc.start(); osc.stop(this.context.currentTime + 0.035);
  }
}
