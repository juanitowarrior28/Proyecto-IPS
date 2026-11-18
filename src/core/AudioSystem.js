export class AudioSystem {
  constructor() {
    this.context = null;
    this.ambientNodes = [];
    this.rainNodes = [];
    this.thunderSounds = new Set();
    this.musicBuffer = null;
    this.musicBufferPromise = null;
    this.musicSource = null;
    this.musicStartedAt = null;
    this.musicRequestId = 0;
    this.musicFilter = null;
    this.musicOutput = null;
    this.musicWetGain = null;
    this.musicVolume = 0.35;
  }
  ensure() {
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === 'suspended') this.context.resume();
  }
  async startMainMusic(settings = {}) {
    const requestId = this.musicRequestId;
    this.setMusicVolume(settings.musicVolume);

    if (!this.context) this.context = new AudioContext();
    const resumePromise = this.context.state === 'suspended'
      ? this.context.resume().then(() => true).catch((error) => {
        if (error.name === 'NotAllowedError') return false;
        throw error;
      })
      : Promise.resolve(true);
    const buffer = await this.loadMainMusicBuffer();
    const resumed = await resumePromise;
    if (requestId !== this.musicRequestId) return false;
    if (!resumed || this.context.state !== 'running') return false;
    if (this.musicSource) return true;

    this.createMusicGraph();
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.musicFilter);
    const startAt = this.context.currentTime + 0.03;
    source.start(startAt);
    this.musicSource = source;
    this.musicStartedAt = startAt;
    source.onended = () => {
      source.disconnect();
      if (this.musicSource === source) {
        this.musicSource = null;
        this.musicStartedAt = null;
      }
    };
    this.setMusicVolume(this.musicVolume, 0.8, startAt);
    return true;
  }
  loadMainMusicBuffer() {
    if (this.musicBuffer) return Promise.resolve(this.musicBuffer);
    if (!this.musicBufferPromise) {
      this.musicBufferPromise = fetch('/assets/audio/music/main-theme-loop.mp3')
        .then((response) => {
          if (!response.ok) throw new Error(`No se pudo cargar la música principal (${response.status}).`);
          return response.arrayBuffer();
        })
        .then((data) => this.context.decodeAudioData(data))
        .then((buffer) => {
          this.musicBuffer = buffer;
          return buffer;
        })
        .catch((error) => {
          this.musicBufferPromise = null;
          throw error;
        });
    }
    return this.musicBufferPromise;
  }
  createMusicGraph() {
    if (this.musicOutput) return;
    const context = this.context;
    this.musicFilter = context.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 22000;
    this.musicFilter.Q.value = 0.35;

    const dryGain = context.createGain();
    dryGain.gain.value = 0.88;
    this.musicOutput = context.createGain();
    this.musicOutput.gain.value = 0.0001;
    this.musicWetGain = context.createGain();
    this.musicWetGain.gain.value = 0.055;

    const impulseDuration = 1.1;
    const impulse = context.createBuffer(
      2,
      Math.ceil(context.sampleRate * impulseDuration),
      context.sampleRate
    );
    for (let channelIndex = 0; channelIndex < impulse.numberOfChannels; channelIndex++) {
      const channel = impulse.getChannelData(channelIndex);
      for (let index = 0; index < channel.length; index++) {
        const decay = Math.pow(1 - index / channel.length, 3.2);
        channel[index] = (Math.random() * 2 - 1) * decay;
      }
    }
    const reverb = context.createConvolver();
    reverb.buffer = impulse;
    reverb.normalize = true;

    this.musicFilter.connect(dryGain).connect(this.musicOutput);
    this.musicFilter.connect(reverb).connect(this.musicWetGain).connect(this.musicOutput);
    this.musicOutput.connect(context.destination);
  }
  setMusicVolume(value, duration = 0.2, at = this.context?.currentTime || 0) {
    this.musicVolume = Number.isFinite(Number(value))
      ? Math.max(0, Math.min(1, Number(value)))
      : 0.35;
    if (!this.musicOutput) return;
    this.musicOutput.gain.cancelScheduledValues(at);
    this.musicOutput.gain.setValueAtTime(this.musicOutput.gain.value, at);
    this.musicOutput.gain.linearRampToValueAtTime(
      Math.max(0.0001, this.musicVolume * 0.72),
      at + duration
    );
  }
  stopMainMusic(fadeDuration = 0.35) {
    this.musicRequestId += 1;
    if (!this.context || !this.musicSource) return;
    const source = this.musicSource;
    const now = this.context.currentTime;
    this.musicOutput?.gain.cancelScheduledValues(now);
    this.musicOutput?.gain.setValueAtTime(this.musicOutput.gain.value, now);
    this.musicOutput?.gain.linearRampToValueAtTime(0.0001, now + fadeDuration);
    source.stop(now + fadeDuration + 0.05);
    this.musicSource = null;
    this.musicStartedAt = null;
  }
  ambient() {
    this.ensure();
    if (this.ambientNodes.length) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sine'; osc.frequency.value = 58;
    gain.gain.value = 0.018;
    osc.connect(gain).connect(this.context.destination);
    osc.start();
    this.ambientNodes = [osc, gain];
  }
  startRainAmbience() {
    this.ensure();
    if (this.rainNodes.length) return;

    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    source.buffer = this.createRainBuffer(6);
    source.loop = true;

    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 5200;
    filter.Q.value = 0.3;

    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.0003, now + 1);
    source.connect(filter).connect(gain).connect(this.context.destination);
    source.start(now);
    this.rainNodes = [source, filter, gain];
  }
  stopRainAmbience() {
    if (!this.rainNodes.length) return;
    const nodes = this.rainNodes;
    const [source, filter, gain] = nodes;
    const now = this.context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0.0001, now, 0.025);
    source.stop(now + 0.15);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    this.rainNodes = [];
  }
  startRoomAmbience() {
    this.ambient();
    this.startRainAmbience();
  }
  stopRoomAmbience() {
    this.stopRainAmbience();
    this.stopThunder();
    if (!this.ambientNodes.length) return;
    const [osc, gain] = this.ambientNodes;
    const now = this.context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0.0001, now, 0.025);
    osc.stop(now + 0.15);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    this.ambientNodes = [];
  }
  createRainBuffer(duration) {
    const frameCount = Math.ceil(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    const fadeFrames = Math.floor(this.context.sampleRate * 0.12);
    for (let i = 0; i < frameCount; i++) {
      let envelope = 1;
      if (i < fadeFrames) envelope = i / fadeFrames;
      else if (i >= frameCount - fadeFrames) envelope = (frameCount - i - 1) / fadeFrames;
      channel[i] = (Math.random() * 2 - 1) * Math.max(0, envelope);
    }
    return buffer;
  }
  click() {
    this.ensure();
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.frequency.value = 220; gain.gain.value = 0.025;
    osc.connect(gain).connect(this.context.destination);
    osc.start(); osc.stop(this.context.currentTime + 0.035);
  }
  playThunder() {
    this.ensure();
    const startAt = this.context.currentTime + 0.2;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(0.075, startAt + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 2.7);
    gain.connect(this.context.destination);

    const rumble = this.context.createBufferSource();
    rumble.buffer = this.createNoiseBuffer(2.8);
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    rumble.connect(filter).connect(gain);
    rumble.start(startAt);
    rumble.stop(startAt + 2.75);
    const sound = { rumble, filter, gain };
    this.thunderSounds.add(sound);
    rumble.onended = () => {
      this.thunderSounds.delete(sound);
      rumble.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  stopThunder() {
    const now = this.context?.currentTime;
    if (now === undefined) return;
    this.thunderSounds.forEach(({ rumble, gain }) => {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0.0001, now, 0.025);
      rumble.stop(now + 0.15);
    });
  }
  playDoorKnocks(startDelay = 0) {
    this.ensure();
    const now = this.context.currentTime;
    const knockInterval = 0.67;
    const knockDuration = 0.15;
    [0, 1, 2].forEach((index) => {
      const startAt = now + startDelay + index * knockInterval;
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.4, startAt + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.14);
      gain.connect(this.context.destination);

      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 950;
      const noise = this.context.createBufferSource();
      noise.buffer = this.createNoiseBuffer(0.16);
      noise.connect(filter).connect(gain);
      noise.start(startAt);
      noise.stop(startAt + 0.15);

      const thud = this.context.createOscillator();
      thud.type = 'triangle';
      thud.frequency.setValueAtTime(105, startAt);
      thud.frequency.exponentialRampToValueAtTime(58, startAt + 0.13);
      thud.connect(gain);
      thud.start(startAt);
      thud.stop(startAt + 0.15);
      noise.onended = () => {
        noise.disconnect();
        filter.disconnect();
        thud.disconnect();
        gain.disconnect();
      };
    });
    return (startDelay + 2 * knockInterval + knockDuration) * 1000;
  }
  createNoiseBuffer(duration) {
    const frameCount = Math.ceil(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) channel[i] = Math.random() * 2 - 1;
    return buffer;
  }
}
