import './styles/main.css';
import * as THREE from 'three';
import { chapters, endingChapters } from './config/chapters.js';
import { SaveManager, defaultSave } from './core/SaveManager.js';
import { GameState } from './core/GameState.js';
import { ProgressionSystem } from './core/ProgressionSystem.js';
import { AudioSystem } from './core/AudioSystem.js';
import { RoomScene } from './scene/RoomScene.js';
import { quotes } from './config/quotes.js';

class Game {
  static loadingDuration = 20_000;

  constructor() {
    this.app = document.querySelector('#app');
    this.saveManager = new SaveManager();
    this.state = new GameState(defaultSave());
    this.progress = new ProgressionSystem(this);
    this.audio = new AudioSystem();
    this.mode = 'menu';
    this.currentChapter = null;
    this.currentSubtitleText = '';
    this.mouseLookEnabled = false;
    this.pointerLockWarningShown = false;
    this.subtitles = [];
    this.subtitleVisible = true;
    this.clock = new THREE.Clock();
    this.animationFrame = null;
    this.controlsAbortController = null;
    this.pauseState = null;
    this.loadingTimeout = null;
    this.loadingInterval = null;
    this.endingCinematicTimeout = null;
    this.endingCinematic = null;
    this.mainMusicGestureHandler = () => {
      if (this.mode === 'menu') this.startMainMusic();
    };
    document.addEventListener('pointerdown', this.mainMusicGestureHandler);
    document.addEventListener('keydown', this.mainMusicGestureHandler);
    window.addEventListener('beforeunload', () => this.save());
    this.renderMenu();
  }
  save() { this.saveManager.save(this.state.state); }
  startMainMusic() {
    this.audio.startMainMusic(this.state.state.settings).catch((error) => {
      console.warn('No se pudo iniciar la música principal.', error);
    });
  }
  notify(message) {
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }
  renderMenu() {
    this.mode = 'menu';
    this.startMainMusic();
    const saved = this.saveManager.exists();
    this.app.innerHTML = `
      <main class="menu-screen">
        <div class="menu-noise"></div>
        <section class="menu-panel">
          <p class="menu-kicker">ARCHIVO DE VIGILANCIA // 1994</p>
          <h1>EFFECTO<br>IPS</h1>
          <div class="menu-actions">
            <button id="newGame">Nueva partida</button>
            ${saved ? '<button id="continueGame">Continuar</button>' : ''}
            <button id="settings">Configuración</button>
          </div>
        </section>
      </main>`;
    document.querySelector('#newGame').onclick = () => {
      if (saved && !confirm('¿Eliminar el progreso guardado y comenzar una nueva partida?')) return;
      this.saveManager.clear();
      this.state = new GameState(defaultSave());
      this.progress = new ProgressionSystem(this);
      this.showScriptureLoading(() => this.startGame());
    };
    if (saved) document.querySelector('#continueGame').onclick = () => {
      this.state = new GameState(this.saveManager.load() || defaultSave());
      this.progress = new ProgressionSystem(this);
      this.showScriptureLoading(() => this.startGame());
    };
    document.querySelector('#settings').onclick = () => this.renderSettings();
  }
  showScriptureLoading(onComplete) {
    clearTimeout(this.loadingTimeout);
    clearInterval(this.loadingInterval);
    this.mode = 'loading';
    this.audio.stopMainMusic(2);
    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    this.app.innerHTML = `
      <main class="scripture-loading menu-screen" aria-label="Pantalla de carga">
        <div class="menu-noise"></div>
        <section class="scripture-panel" aria-live="polite">
          <p class="menu-kicker">ARCHIVO DE VIGILANCIA // 1994</p>
          <blockquote>“${quote.text}”</blockquote>
          <p class="scripture-reference">— ${quote.reference}</p>
          <div class="loading-track" role="progressbar" aria-label="Cargando" aria-valuemin="0" aria-valuemax="20" aria-valuenow="0">
            <div class="loading-fill"></div>
          </div>
          <p id="loadingCountdown">PREPARANDO // 20</p>
        </section>
      </main>`;
    const startedAt = Date.now();
    this.loadingInterval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((Game.loadingDuration - (Date.now() - startedAt)) / 1000));
      const countdown = this.app.querySelector('#loadingCountdown');
      const progress = this.app.querySelector('.loading-track');
      if (countdown) countdown.textContent = `PREPARANDO // ${remaining}`;
      if (progress) progress.setAttribute('aria-valuenow', String(20 - remaining));
    }, 250);
    this.loadingTimeout = setTimeout(() => {
      clearInterval(this.loadingInterval);
      this.loadingInterval = null;
      this.loadingTimeout = null;
      onComplete();
    }, Game.loadingDuration);
  }
  renderSettings(fromPause = false, reuseRoot = null) {
    if (!fromPause) {
      this.mode = 'settings';
      this.audio.stopMainMusic(2);
    }
    const s = this.state.state.settings;
    const settingsRoot = reuseRoot || (fromPause ? document.createElement('div') : this.app);
    if (fromPause && !reuseRoot) {
      settingsRoot.id = 'settingsOverlay';
      document.body.appendChild(settingsRoot);
    }
    settingsRoot.innerHTML = `
      <main class="menu-screen settings-screen">
        <section class="menu-panel settings-panel">
          <h2>CONFIGURACIÓN</h2>
          <label>Subtítulos <input id="subtitleSetting" type="checkbox" ${s.subtitles ? 'checked' : ''}></label>
          <label>Volumen general <input id="generalVolume" type="range" min="0" max="1" step="0.05" value="${s.generalVolume}"></label>
          <label>Volumen de música <input id="musicVolume" type="range" min="0" max="1" step="0.05" value="${s.musicVolume}"></label>
          <label>Sensibilidad <input id="sensitivity" type="range" min="0.5" max="3.5" step="0.1" value="${s.mouseSensitivity}"></label>
          <label>Reducir parpadeos <input id="reduceFlashes" type="checkbox" ${s.reduceFlashes ? 'checked' : ''}></label>
          <label>Reducir movimiento <input id="reduceMovement" type="checkbox" ${s.reduceMovement ? 'checked' : ''}></label>
          <label>Interferencias <input id="interference" type="checkbox" ${s.interference ? 'checked' : ''}></label>
          <button id="aboutButton" type="button">ABOUT / CRÉDITOS</button>
          <button id="backMenu">${fromPause ? 'Volver a pausa' : 'Volver al menú'}</button>
        </section>
      </main>`;
    const values = ['subtitleSetting','generalVolume','musicVolume','sensitivity','reduceFlashes','reduceMovement','interference'];
    values.forEach((id) => settingsRoot.querySelector('#'+id).addEventListener('change', (e) => {
      const map = {
        subtitleSetting: 'subtitles',
        generalVolume: 'generalVolume',
        musicVolume: 'musicVolume',
        sensitivity: 'mouseSensitivity',
        reduceFlashes: 'reduceFlashes',
        reduceMovement: 'reduceMovement',
        interference: 'interference'
      };
      s[map[id]] = e.target.type === 'checkbox'
        ? e.target.checked
        : e.target.type === 'select-one' ? e.target.value : Number(e.target.value);
      if (id === 'sensitivity') this.lookSensitivity = 0.0045 * s.mouseSensitivity;
      if (id === 'musicVolume') this.audio.setMusicVolume(s.musicVolume);
      this.save();
    }));
    settingsRoot.querySelector('#aboutButton').onclick = () => this.renderAbout(settingsRoot, fromPause);
    settingsRoot.querySelector('#backMenu').onclick = () => {
      if (fromPause) settingsRoot.remove();
      else this.renderMenu();
    };
  }
  renderAbout(settingsRoot, fromPause) {
    settingsRoot.innerHTML = `
      <main class="menu-screen settings-screen">
        <section class="menu-panel settings-panel credits-panel" aria-labelledby="aboutTitle">
          <h2 id="aboutTitle">ABOUT / CRÉDITOS</h2>
          <dl>
            <dt>Dirección y diseño</dt>
            <dd>Mariana Monsalve<br>Juan José Guerrero García</dd>
            <dt>Programación</dt>
            <dd>Juan José Guerrero García</dd>
            <dt>Modelado 3D y escenarios</dt>
            <dd>Mariana Monsalve</dd>
            <dt>Diseño de sonido</dt>
            <dd>Juan José Guerrero García</dd>
            <dt>Composición</dt>
            <dd>Tweenty Eight</dd>
            <dt>Voice acting</dt>
            <dd>
              <ul>
                <li>Juan José Guerrero García — Protagonista (028)</li>
                <li>Wilmar Ruiz — Doctor</li>
                <li>Francisco Javier Guerrero — Vincent</li>
                <li>Mariana Monsalve — Emma</li>
                <li>Milena García — Enfermera</li>
                <li>Luismi — Guardia de seguridad</li>
                <li>Profesor de medios — Noticiero</li>
              </ul>
            </dd>
            <dt>Agradecimientos especiales</dt>
            <dd>Universidad de San Buenaventura de Medellín<br>Facultad de Ingeniería</dd>
          </dl>
          <p class="credits-copyright">© 2026</p>
          <button id="backAbout" type="button">Volver a configuración</button>
        </section>
      </main>`;
    settingsRoot.querySelector('#backAbout').onclick = () => this.renderSettings(fromPause, settingsRoot);
  }
  startGame() {
    this.controlsAbortController?.abort();
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    document.body.classList.add('game-playing');
    document.body.classList.remove('computer-active');
    this.app.innerHTML = `<canvas id="gameCanvas"></canvas><div id="crosshair"></div><div id="contextHint"></div><aside id="objectiveGuide" class="objective-guide" aria-live="polite"><div id="guideHeader" class="guide-header"><h2>GUÍA DE CAMPO</h2><button id="collapseGuide" class="guide-toggle" type="button" aria-label="Ocultar instrucciones" aria-expanded="true">×</button></div><p id="guideControls" class="guide-controls">Clic en la escena para activar la cámara. Muévete con WASD y apunta al centro del objeto.<br><br>Pulsa E o haz clic para interactuar. Mantén E 5 segundos para recoger objetos.<br><br>Pulsa ESC para abrir opciones y X para ocultar esta guía.</p><div class="guide-objective-row"><p id="guideObjective" class="guide-objective"></p><button id="expandGuide" class="guide-toggle guide-expand" type="button" aria-label="Mostrar instrucciones" aria-expanded="false" hidden>+</button></div></aside><div id="lookTip">RATÓN: MIRAR · WASD: MOVER · E: INTERACTUAR · CLIC: CAPTURAR RATÓN</div><div id="holdIndicator" class="hold-indicator" hidden><span id="holdLabel"></span><div class="hold-track"><div id="holdFill"></div></div></div><div id="hotbar" class="hotbar" aria-label="Inventario"></div><div id="hud"></div><div id="computerOverlay"></div><button id="gameMenuButton" class="game-menu-button" aria-label="Abrir menú de pausa" title="Opciones">⋮</button><div id="pauseMenu" class="pause-menu" hidden><section class="pause-panel" role="dialog" aria-modal="true" aria-labelledby="pauseTitle"><h2 id="pauseTitle">PAUSA</h2><button id="resumeGame">SEGUIR JUGANDO</button><button id="saveGame">GUARDAR PARTIDA</button><button id="pauseSettings">CONFIGURACIÓN</button><button id="exitToMenu">SALIR AL MENÚ</button></section></div>`;
    this.room = new RoomScene(document.querySelector('#gameCanvas'));
    this.room.onLightning = () => this.audio.playThunder();
    this.room.setPhase(
      this.state.state.phase,
      this.state.state.keysFound,
      this.state.state.completed.includes('chapter2'),
      this.state.state.drawer1Open
    );
    this.room.setCompartmentState(
      this.state.state.compartmentUnlocked,
      this.state.state.compartmentOpen,
      this.state.state.tape3Found
    );
    this.room.setChapter3Completed(
      this.state.state.completed.includes('chapter3'),
      this.state.state.drawer3Open
    );
    this.keys = {};
    this.mouseLookEnabled = false;
    this.lookSensitivity = 0.0045 * this.state.state.settings.mouseSensitivity;
    this.room.camera.rotation.order = 'YXZ';
    this.syncLookTarget();
    this.setupControls();
    this.mode = 'room';
    this.renderHotbar();
    this.pauseState = null;
    this.audio.ensure();
    this.audio.startRoomAmbience();
    this.animate();
  }
  setupControls() {
    const canvas = document.querySelector('#gameCanvas');
    this.controlsAbortController = new AbortController();
    const listenerOptions = { signal: this.controlsAbortController.signal };
    canvas.addEventListener('click', () => {
      if (this.mode === 'room') {
        this.mouseLookEnabled = true;
        if (document.pointerLockElement !== document.body) this.requestPointerLock();
        this.audio.startRoomAmbience();
      }
      this.audio.ensure();
    }, listenerOptions);
    document.addEventListener('mousemove', (event) => {
      if (this.mode !== 'room' || !this.mouseLookEnabled) return;
      this.targetYaw = Math.atan2(
        Math.sin(this.targetYaw - event.movementX * this.lookSensitivity),
        Math.cos(this.targetYaw - event.movementX * this.lookSensitivity)
      );
      this.targetPitch = THREE.MathUtils.clamp(
        this.targetPitch - event.movementY * this.lookSensitivity,
        -Math.PI / 2 + 0.05,
        Math.PI / 2 - 0.05
      );
    }, listenerOptions);
    document.addEventListener('pointerlockchange', () => {
      if (this.mode === 'room' && !document.pointerLockElement) this.mouseLookEnabled = true;
    }, listenerOptions);
    document.addEventListener('mousedown', (event) => {
      if (event.button === 0 && this.mode === 'room' && document.pointerLockElement === document.body) {
        this.interact();
      }
    }, listenerOptions);
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyI' && this.mode === 'room') this.toggleInventory();
      if (e.code === 'KeyE' && this.mode === 'room' && !e.repeat) this.handleEKeyDown();
      if (e.code === 'KeyX' && this.mode === 'room') {
        const guide = document.querySelector('#objectiveGuide');
        if (guide && !guide.classList.contains('collapsed')) {
          document.querySelector('#collapseGuide').click();
        }
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        if (this.mode === 'computer') {
          this.leaveComputer();
          return;
        }
        if (this.mode === 'readingNote') {
          this.closeDrawerNote();
          return;
        }
        if (this.mode === 'room') {
          this.openPauseMenu();
          return;
        }
        if (this.mode === 'paused' && !document.querySelector('#settingsOverlay')) {
          this.resumeGame();
        }
        return;
      }
    }, listenerOptions);
    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'KeyE') this.cancelHoldInteraction();
    }, listenerOptions);
    window.addEventListener('blur', () => {
      this.keys = {};
      this.cancelHoldInteraction();
    }, listenerOptions);
    document.querySelector('#gameMenuButton').onclick = () => this.openPauseMenu();
    document.querySelector('#resumeGame').onclick = () => this.resumeGame();
    document.querySelector('#saveGame').onclick = () => {
      this.save();
      this.notify('Partida guardada.');
    };
    document.querySelector('#pauseSettings').onclick = () => this.renderSettings(true);
    document.querySelector('#exitToMenu').onclick = () => this.exitToMenu();
    const guide = document.querySelector('#objectiveGuide');
    const toggleGuide = (collapsed) => {
      guide.classList.toggle('collapsed', collapsed);
      document.querySelector('#collapseGuide').setAttribute('aria-expanded', String(!collapsed));
      document.querySelector('#expandGuide').hidden = !collapsed;
      document.querySelector('#expandGuide').setAttribute('aria-expanded', String(!collapsed));
    };
    document.querySelector('#collapseGuide').onclick = () => toggleGuide(true);
    document.querySelector('#expandGuide').onclick = () => toggleGuide(false);
  }
  animate() {
    this.animationFrame = requestAnimationFrame(() => this.animate());
    const delta = Math.min(this.clock.getDelta(), 0.05);
    if (this.mode === 'paused') {
      this.room.render();
      return;
    }
    if (this.mode === 'room' && this.mouseLookEnabled) {
      this.updateCameraLook(delta);
      this.move(delta);
    }
    this.updateRaycast();
    this.updateObjectiveGuide();
    this.updateHoldInteraction();
    this.room.update(delta);
    this.room.render();
  }
  updateObjectiveGuide() {
    const objective = document.querySelector('#guideObjective');
    if (!objective) return;
    const state = this.state.state;
    let message;
    if (this.mode === 'computer' && document.querySelector('#password')) {
      message = 'Busca la contraseña en el entorno o recuerda lo dicho en los audios; quizá sea el nombre de algún medicamento.';
    } else if (this.mode === 'computer' && document.querySelector('.player')) {
      message = 'Reproduce el cassette. Puedes pausar, avanzar o retroceder y activar los subtítulos.';
    } else if (!state.completed.includes('prologue')) {
      message = 'Objetivo: usa el computador y escucha el prólogo completo.';
    } else if (!state.completed.includes('chapter1')) {
      message = 'Nuevo cassette disponible. Vuelve al computador y escucha el capítulo 1 completo.';
    } else if (!state.puzzleSolved) {
      message = 'Revisa el cuestionario en el computador y responde para desbloquear el capítulo 2.';
    } else if (!state.completed.includes('chapter2')) {
      message = 'Vuelve al computador y escucha el capítulo 2 completo.';
    } else if (!state.keysFound) {
      message = 'Hm, el capítulo 3 está cerrado, ¿no habrá alguna llave por aquí...? Abre el cajón 1 y mantén E para recogerla.';
    } else if (!state.compartmentUnlocked) {
      message = 'Busca el compartimento superior y usa la llave para desbloquearlo.';
    } else if (!state.tape3Found) {
      message = 'El compartimento está abierto. Mantén E 5 segundos sobre el cassette para recogerlo.';
    } else if (!state.completed.includes('chapter3')) {
      message = 'El capítulo 3 ya está disponible. Regresa al computador y escucha el cassette.';
    } else if (state.endings.length < 3) {
      message = 'Busca pistas en el entorno y en los cassettes. El cajón 3 podría guardar una contraseña.';
    } else {
      message = 'Explora las carpetas de los finales en el computador para reproducir los cassettes desbloqueados.';
    }
    if (objective.textContent !== message) objective.textContent = message;
  }
  openPauseMenu() {
    if (!['room', 'computer'].includes(this.mode)) return;
    if (this.mode === 'computer' && this.isFirstEndingListen() && this.audioElement && !this.audioElement.paused) return;
    this.pauseState = {
      mode: this.mode,
      mouseLookEnabled: this.mouseLookEnabled,
      audioWasPlaying: Boolean(this.audioElement && !this.audioElement.paused)
    };
    this.mode = 'paused';
    document.body.classList.add('pause-menu-active');
    this.keys = {};
    this.cancelHoldInteraction();
    this.audioElement?.pause();
    this.mouseLookEnabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    document.querySelector('#pauseMenu').hidden = false;
  }
  resumeGame() {
    if (this.mode !== 'paused') return;
    document.querySelector('#pauseMenu').hidden = true;
    const pauseState = this.pauseState;
    this.mode = pauseState?.mode || 'room';
    document.body.classList.remove('pause-menu-active');
    this.mouseLookEnabled = this.mode === 'room' || Boolean(pauseState?.mouseLookEnabled);
    this.pauseState = null;
    if (pauseState?.audioWasPlaying && this.audioElement) {
      this.audioElement.play().catch(() => {
        const error = document.querySelector('#audioError');
        if (error) error.textContent = 'El navegador bloqueó la reproducción.';
      });
    }
  }
  exitToMenu() {
    this.cleanupGame();
    this.showScriptureLoading(() => this.renderMenu());
  }
  cleanupGame() {
    this.save();
    this.cancelHoldInteraction();
    this.stopAudio();
    this.audio.stopRoomAmbience();
    if (document.pointerLockElement) document.exitPointerLock();
    this.controlsAbortController?.abort();
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    if (this.room) this.room.renderer.dispose();
    this.room = null;
    this.keys = {};
    this.pauseState = null;
    document.body.classList.remove('ending-transition');
    document.body.classList.remove('game-playing', 'computer-active', 'pause-menu-active', 'note-active');
  }
  returnToMainMenu() {
    this.cleanupGame();
    this.renderMenu();
  }
  move(delta) {
    const speed = this.state.state.settings.reduceMovement ? 1.5 : 2.2;
    const forward = (this.keys.KeyW ? 1 : 0) - (this.keys.KeyS ? 1 : 0);
    const side = (this.keys.KeyD ? 1 : 0) - (this.keys.KeyA ? 1 : 0);
    if (!forward && !side) return;
    const direction = new THREE.Vector3();
    this.room.camera.getWorldDirection(direction); direction.y = 0; direction.normalize();
    const right = new THREE.Vector3().crossVectors(direction, this.room.camera.up).normalize();
    const pos = this.room.camera.position.clone();
    const next = pos.clone()
      .addScaledVector(direction, forward * speed * delta)
      .addScaledVector(right, side * speed * delta);
    const nextX = THREE.MathUtils.clamp(next.x, -1.65, 1.65);
    const nextZ = THREE.MathUtils.clamp(next.z, -1.1, 1.9);
    if (!this.room.isBlocked(nextX, pos.z)) pos.x = nextX;
    if (!this.room.isBlocked(pos.x, nextZ)) pos.z = nextZ;
    this.room.camera.position.copy(pos);
  }
  syncLookTarget() {
    this.targetYaw = this.room.camera.rotation.y;
    this.targetPitch = this.room.camera.rotation.x;
  }
  updateCameraLook(delta) {
    const blend = 1 - Math.exp(-26 * delta);
    const yawDifference = Math.atan2(
      Math.sin(this.targetYaw - this.room.camera.rotation.y),
      Math.cos(this.targetYaw - this.room.camera.rotation.y)
    );
    this.room.camera.rotation.y += yawDifference * blend;
    this.room.camera.rotation.x += (this.targetPitch - this.room.camera.rotation.x) * blend;
  }
  requestPointerLock() {
    if (!document.body.requestPointerLock) return;
    try {
      const request = document.body.requestPointerLock();
      request?.catch((error) => {
        console.warn('Pointer Lock no disponible; se mantiene el control de cámara con ratón libre.', error);
        this.mouseLookEnabled = true;
        if (!this.pointerLockWarningShown) {
          this.pointerLockWarningShown = true;
          this.notify('El ratón libre está activo; mueve el cursor para mirar.');
        }
      });
    } catch (error) {
      console.warn('No se pudo capturar el puntero; se mantiene el control de cámara con ratón libre.', error);
      this.mouseLookEnabled = true;
      if (!this.pointerLockWarningShown) {
        this.pointerLockWarningShown = true;
        this.notify('El ratón libre está activo; mueve el cursor para mirar.');
      }
    }
  }
  updateRaycast() {
    if (this.mode !== 'room') {
      this.currentHit = null;
      return;
    }
    const hit = this.room.getInteraction(this.room.camera.position, this.room.camera.getWorldDirection(new THREE.Vector3()));
    this.currentHit = hit;
    const hint = document.querySelector('#contextHint');
    if (!hit) { hint.textContent = ''; document.querySelector('#crosshair').classList.remove('active'); return; }
    document.querySelector('#crosshair').classList.add('active');
    const id = hit.object.userData.id;
    if (id === 'drawerNote') {
      hint.textContent = '';
      return;
    }
    const labels = {
      computer: 'Usar computador',
      drawer: hit.object.userData.drawerIndex === 2
        ? (this.state.state.completed.includes('chapter3')
          ? (this.state.state.drawer3Open ? 'Cerrar cajón 3' : 'Abrir cajón 3 · buscar nota')
          : 'Cajón 3 cerrado · escucha capítulo 3')
        : 'Abrir cajón',
      shelf: this.state.state.compartmentUnlocked
        ? (this.state.state.compartmentOpen ? 'Cerrar compartimento' : 'Abrir compartimento')
        : (this.state.state.keysFound ? 'Desbloquear compartimento' : 'Bloqueado: necesitas la llave'),
      key: 'Mantén E 5 segundos para recoger la llave',
      tape: 'Mantén E 5 segundos para recoger el cassette',
      desk: 'Examinar escritorio',
      door: 'Puerta cerrada',
      keyboard: 'Teclado'
    };
    hint.textContent = labels[id] || 'Examinar';
  }
  handleEKeyDown() {
    const id = this.currentHit?.object.userData.id;
    if (id === 'key' && this.canCollectKey()) {
      this.startHoldInteraction('key');
      return;
    }
    if (id === 'tape' && this.room.tape.visible) {
      this.startHoldInteraction('tape');
      return;
    }
    this.interact();
  }
  startHoldInteraction(id) {
    if (this.holdInteraction) return;
    if (id === 'key' && !this.canCollectKey()) return;
    this.holdInteraction = { id, startedAt: performance.now() };
    const label = id === 'key' ? 'RECOGIENDO LLAVE' : 'RECOGIENDO CASSETTE';
    document.querySelector('#holdLabel').textContent = `MANTÉN E · ${label} 0%`;
    document.querySelector('#holdFill').style.transform = 'scaleX(0)';
    document.querySelector('#holdIndicator').hidden = false;
  }
  updateHoldInteraction() {
    if (!this.holdInteraction) return;
    const { id, startedAt } = this.holdInteraction;
    const isTargeted = this.currentHit?.object.userData.id === id;
    const isAvailable = id === 'key'
      ? this.canCollectKey()
      : this.room.tape.visible && this.state.state.compartmentOpen;
    if (!isTargeted || !isAvailable) {
      this.cancelHoldInteraction();
      return;
    }
    const progress = Math.min(1, (performance.now() - startedAt) / 5000);
    const item = id === 'key' ? 'LLAVE' : 'CASSETTE';
    document.querySelector('#holdLabel').textContent = `MANTÉN E · RECOGIENDO ${item} ${Math.round(progress * 100)}%`;
    document.querySelector('#holdFill').style.transform = `scaleX(${progress})`;
    if (progress === 1) this.finishHoldInteraction(id);
  }
  finishHoldInteraction(id) {
    this.holdInteraction = null;
    document.querySelector('#holdIndicator').hidden = true;
    if (id === 'key') {
      if (this.progress.collectKeys()) {
        this.room.setPhase(
          this.state.state.phase,
          this.state.state.keysFound,
          this.state.state.completed.includes('chapter2'),
          this.state.state.drawer1Open
        );
        this.renderHotbar();
        this.notify('Llave recogida. Ahora puedes desbloquear el compartimento superior.');
      }
      return;
    }
    if (this.progress.collectTape3()) {
      this.room.setCompartmentState(true, true, true);
      this.renderHotbar();
      this.notify('Capítulo 3 desbloqueado. Ya puedes reproducirlo en el computador.');
    }
  }
  cancelHoldInteraction() {
    if (!this.holdInteraction) return;
    this.holdInteraction = null;
    const indicator = document.querySelector('#holdIndicator');
    if (indicator) indicator.hidden = true;
  }
  canCollectKey() {
    const state = this.state.state;
    return state.completed.includes('chapter2')
      && state.drawer1Open
      && this.room.drawerOpen
      && !state.keysFound;
  }
  renderHotbar() {
    const bar = document.querySelector('#hotbar');
    if (!bar) return;
    const state = this.state.state;
    const hasKey = state.keysFound || state.inventory.includes('Llaves');
    const hasTape = state.tape3Found || state.inventory.includes('Cassette — Capítulo 3');
    const slots = [
      hasKey ? { label: 'LLAVE', icon: '<circle cx="9" cy="16" r="5"/><path d="M14 16h13v3h-4v4h-3v-4h-6z"/>' } : null,
      hasTape ? { label: 'CASSETTE 3', icon: '<rect x="4" y="6" width="24" height="20" rx="2"/><circle cx="11" cy="15" r="3"/><circle cx="21" cy="15" r="3"/><path d="M10 22h12"/>' } : null,
      null,
      null
    ];
    bar.innerHTML = slots.map((item, index) => `
      <div class="hotbar-slot ${item ? 'filled' : ''}" aria-label="${item?.label || `Ranura ${index + 1} vacía`}">
        <span class="hotbar-number">${index + 1}</span>
        ${item ? `<svg viewBox="0 0 32 32" class="hotbar-icon" aria-hidden="true">${item.icon}</svg><span class="hotbar-label">${item.label}</span>` : '<span class="hotbar-empty">—</span>'}
      </div>`).join('');
  }
  interact() {
    if (this.mode !== 'room') return;
    let hit = this.room.getInteraction(this.room.camera.position, this.room.camera.getWorldDirection(new THREE.Vector3()));
    if (!hit) {
      const toComputer = this.room.computer.position.clone().sub(this.room.camera.position);
      const distance = toComputer.length();
      const facing = toComputer.normalize().dot(this.room.camera.getWorldDirection(new THREE.Vector3()));
      if (distance < 6 && facing > 0.75) hit = { object: this.room.computer };
    }
    if (!hit) return;
    const id = hit.object.userData.id;
    this.audio.click();
    if (id === 'computer') this.enterComputer();
    if (id === 'drawer') {
      const drawerIndex = hit.object.userData.drawerIndex;
      const chapter2Completed = this.state.state.completed.includes('chapter2');
      const chapter3Completed = this.state.state.completed.includes('chapter3');
      if (drawerIndex === 0 && !chapter2Completed) {
        this.notify('Primero debes reproducir el capítulo 2. Después podrás abrir este cajón.');
        return;
      }
      if (drawerIndex === 2 && !chapter3Completed) {
        this.notify('Este cajón sigue cerrado. Primero escucha el capítulo 3.');
        return;
      }
      const isOpen = this.room.openDrawer(drawerIndex);
      if (drawerIndex === 0) {
        this.state.state.drawer1Open = isOpen;
        this.save();
      } else if (drawerIndex === 2) {
        this.state.state.drawer3Open = isOpen;
        this.save();
      }
      this.notify(drawerIndex === 0 && isOpen && !this.state.state.keysFound
        ? 'Cajón 1 abierto. Mantén E para recoger la llave.'
        : drawerIndex === 2 && isOpen
          ? 'Cajón 3 abierto. Mira la nota y pulsa E para leerla.'
          : isOpen ? 'El cajón se abre; está vacío.' : 'Cajón cerrado.');
    }
    if (id === 'drawerNote') this.readDrawerNote();
    if (id === 'shelf') {
      const state = this.state.state;
      if (!state.compartmentUnlocked) {
        if (!state.keysFound) {
          this.notify('Compartimento bloqueado con candado. Encuentra la llave en la cajonera.');
          return;
        }
        state.compartmentUnlocked = true;
        state.compartmentOpen = true;
        this.room.setCompartmentState(true, true, state.tape3Found);
        this.save();
        this.notify('Candado abierto. El cassette está dentro del compartimento.');
        return;
      }
      state.compartmentOpen = !state.compartmentOpen;
      this.room.setCompartmentState(state.compartmentUnlocked, state.compartmentOpen, state.tape3Found);
      this.save();
      this.notify(state.compartmentOpen ? 'Compartimento abierto.' : 'Compartimento cerrado.');
    }
    if (id === 'key') {
      this.notify('Mantén E durante 5 segundos para recoger la llave.');
    }
    if (id === 'tape' && this.room.tape.visible) {
      this.notify('Mantén E durante 5 segundos para recoger el cassette.');
    }
  }
  enterComputer() {
    this.mode = 'computer';
    document.body.classList.add('computer-active');
    if (document.pointerLockElement) document.exitPointerLock();
    this.computerView = {
      position: this.room.camera.position.clone(),
      quaternion: this.room.camera.quaternion.clone(),
      targetPosition: new THREE.Vector3(0, 1.45, -0.65),
      targetLook: new THREE.Vector3(0, 1.18, -1.72)
    };
    document.querySelector('#hotbar').hidden = true;
    const overlay = document.querySelector('#computerOverlay');
    overlay.style.display = 'flex';
    this.renderComputerMenu();
    this.animateComputerTransition();
  }
  animateComputerTransition() {
    if (!this.computerView) return;
    const started = performance.now();
    const origin = this.computerView.position;
    const destination = this.computerView.targetPosition;
    const lookAt = this.computerView.targetLook;
    const duration = this.state.state.settings.reduceMovement ? 150 : 650;
    const step = (now) => {
      if (this.mode !== 'computer') return;
      const t = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      this.room.camera.position.lerpVectors(origin, destination, eased);
      this.room.camera.lookAt(lookAt);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  leaveComputer() {
    if (this.isFirstEndingListen() && this.audioElement && !this.audioElement.paused) return;
    if (this.computerView) {
      this.room.camera.position.copy(this.computerView.position);
      this.room.camera.quaternion.copy(this.computerView.quaternion);
    }
    this.mode = 'room';
    document.body.classList.remove('computer-active');
    document.body.classList.remove('ending-transition');
    document.querySelector('#computerOverlay').style.display = 'none';
    document.querySelector('#hotbar').hidden = false;
    this.stopAudio();
    this.mouseLookEnabled = true;
    this.syncLookTarget();
  }
  renderComputerMenu() {
    const s = this.state.state;
    const overlay = document.querySelector('#computerOverlay');
    const availableEndings = endingChapters.filter((ending) => s.endingCassettes.includes(ending.id));
    const unopenedFolders = endingChapters.filter((ending) =>
      s.endings.includes(ending.id) && !s.endingCassettes.includes(ending.id)
    );
    overlay.innerHTML = `
      <div class="crt">
        <div class="crt-header"><span>IPS//ARCHIVO SONORO</span><button id="computerBack">VOLVER</button></div>
        <div class="cassette-grid">${[...chapters, ...availableEndings].map((c) => {
          const unlocked = s.unlocked.includes(c.id);
          const endingUnlocked = availableEndings.some((ending) => ending.id === c.id);
          const isUnlocked = unlocked || endingUnlocked;
          return `<button class="cassette ${isUnlocked ? '' : 'locked'}" data-id="${c.id}" ${isUnlocked ? '' : 'disabled'}><img src="${c.image}" alt=""><span>${c.title}</span><small>${isUnlocked ? 'DISPONIBLE' : 'BLOQUEADO'}</small></button>`;
        }).join('')}</div>
        ${unopenedFolders.length ? `<section class="ending-folders"><h3>CARPETAS DESBLOQUEADAS</h3>${unopenedFolders.map((ending) => `<button class="folder-button" data-folder="${ending.id}">Carpeta &quot;${ending.folderName}&quot; · ABRIR</button>`).join('')}</section>` : ''}
        ${s.completed.includes('chapter1') && !s.puzzleSolved ? '<button class="crt-action" id="openPuzzle">Abrir cuestionario</button>' : ''}
        ${s.completed.includes('chapter3') ? '<button class="crt-action" id="openPasswords">Introducir contraseña</button>' : ''}
      </div>`;
    overlay.querySelector('#computerBack').onclick = () => this.leaveComputer();
    overlay.querySelectorAll('.cassette[data-id]').forEach((button) => button.onclick = () => this.renderPlayer(button.dataset.id));
    overlay.querySelectorAll('.folder-button').forEach((button) => button.onclick = () => this.renderEndingFolder(button.dataset.folder));
    if (overlay.querySelector('#openPuzzle')) overlay.querySelector('#openPuzzle').onclick = () => this.renderPuzzle();
    if (overlay.querySelector('#openPasswords')) overlay.querySelector('#openPasswords').onclick = () => this.renderPasswords();
  }
  renderPlayer(id) {
    const chapter = [...chapters, ...endingChapters].find((c) => c.id === id);
    if (!chapter) return;
    const isEnding = endingChapters.some((ending) => ending.id === id);
    if (isEnding && !this.state.state.endingCassettes.includes(id)) return;
    this.stopAudio();
    const firstEndingListen = isEnding && this.state.state.endingPlayCounts[id] === 0;
    this.subtitleVisible = this.state.state.settings.subtitles;
    const overlay = document.querySelector('#computerOverlay');
    overlay.innerHTML = `
      <div class="crt player">
        <div class="crt-header"><span>${chapter.title}</span><button id="playerBack">VOLVER</button></div>
        <div class="player-art"><img src="${chapter.image}" alt=""><strong>${chapter.title}</strong><div id="subtitleBox" class="subtitle-box"></div></div>
        <div class="transport">
          <button id="rewind">« 15</button><button id="play">REPRODUCIR</button><button id="pause" ${firstEndingListen ? 'disabled' : ''}>PAUSA</button><button id="forward" ${firstEndingListen ? 'disabled' : ''}>15 »</button>
          ${chapter.subtitles ? `<button id="subtitles">${this.subtitleVisible ? 'SUBTÍTULOS: ON' : 'SUBTÍTULOS: OFF'}</button>` : ''}
        </div>
        <input id="progressBar" type="range" min="0" max="${chapter.duration}" value="0" step="0.1" ${firstEndingListen ? 'disabled' : ''}>
        <div class="time-row"><span id="elapsed">00:00</span><span id="duration">00:20</span></div>
        <div id="audioError" class="audio-error"></div>
      </div>`;
    overlay.querySelector('#playerBack').onclick = () => { this.stopAudio(); this.renderComputerMenu(); };
    this.currentChapter = id;
    const audioElement = new Audio(chapter.file);
    this.audioElement = audioElement;
    this.currentSubtitleText = '';
    if (chapter.subtitles) {
      const trackElement = document.createElement('track');
      trackElement.kind = 'subtitles';
      trackElement.label = 'Español';
      trackElement.srclang = 'es';
      trackElement.src = chapter.subtitles;
      trackElement.default = true;
      audioElement.appendChild(trackElement);
      trackElement.track.mode = 'hidden';
      trackElement.addEventListener('cuechange', () => {
        if (this.audioElement !== audioElement) return;
        this.currentSubtitleText = trackElement.track.activeCues?.[0]?.text || '';
        this.updateSubtitleDisplay();
      });
      trackElement.addEventListener('error', () => {
        if (this.audioElement !== audioElement) return;
        const subtitleError = overlay.querySelector('#audioError');
        if (subtitleError) subtitleError.textContent = 'No se pudieron cargar los subtítulos.';
        console.warn(`No se pudieron cargar los subtítulos: ${chapter.subtitles}`);
      });
    }
    audioElement.addEventListener('loadedmetadata', () => {
      if (this.audioElement !== audioElement) return;
      overlay.querySelector('#progressBar').max = audioElement.duration;
      overlay.querySelector('#duration').textContent = this.formatTime(audioElement.duration);
    });
    audioElement.addEventListener('error', () => {
      if (this.audioElement !== audioElement) return;
      overlay.querySelector('#audioError').textContent = 'Archivo de audio no disponible. Se conservará la progresión de prueba.';
    });
    audioElement.addEventListener('timeupdate', () => {
      if (this.audioElement === audioElement) this.updatePlayer();
    });
    audioElement.addEventListener('ended', () => {
      if (this.audioElement !== audioElement) return;
      if (isEnding && !this.audioPlayedCompletely(audioElement)) {
        this.notify('Para ver este final, escucha el cassette completo sin adelantarlo.');
        return;
      }
      this.chapterEnded(id);
    });
    overlay.querySelector('#play').onclick = () => audioElement.play().catch(() => {
      if (this.audioElement === audioElement) overlay.querySelector('#audioError').textContent = 'El navegador bloqueó la reproducción.';
    });
    overlay.querySelector('#pause').onclick = () => {
      if (!firstEndingListen) audioElement.pause();
    };
    overlay.querySelector('#rewind').onclick = () => { audioElement.currentTime = Math.max(0, audioElement.currentTime - 15); };
    overlay.querySelector('#forward').onclick = () => {
      if (!firstEndingListen) audioElement.currentTime = Math.min(audioElement.duration || 0, audioElement.currentTime + 15);
    };
    overlay.querySelector('#progressBar').oninput = (e) => {
      if (!firstEndingListen) audioElement.currentTime = Number(e.target.value);
    };
    const subtitlesButton = overlay.querySelector('#subtitles');
    if (subtitlesButton) {
      subtitlesButton.onclick = (e) => {
        this.subtitleVisible = !this.subtitleVisible;
        e.target.textContent = `SUBTÍTULOS: ${this.subtitleVisible ? 'ON' : 'OFF'}`;
        this.updateSubtitleDisplay();
      };
    }
    this.updateSubtitleDisplay();
  }
  updatePlayer() {
    if (!this.audioElement) return;
    const t = this.audioElement.currentTime;
    const bar = document.querySelector('#progressBar');
    if (bar) bar.value = t;
    const elapsed = document.querySelector('#elapsed');
    if (elapsed) elapsed.textContent = this.formatTime(t);
    this.updateSubtitleDisplay();
  }
  updateSubtitleDisplay() {
    const box = document.querySelector('#subtitleBox');
    if (box) {
      box.textContent = this.subtitleVisible && this.state.state.settings.subtitles
        ? this.currentSubtitleText
        : '';
    }
  }
  stopAudio() {
    clearTimeout(this.endingCinematicTimeout);
    this.endingCinematicTimeout = null;
    if (this.audioElement) { this.audioElement.pause(); this.audioElement.src = ''; this.audioElement = null; }
  }
  audioPlayedCompletely(audioElement) {
    if (!Number.isFinite(audioElement.duration) || audioElement.duration <= 0) return false;
    let heardUntil = 0;
    for (let index = 0; index < audioElement.played.length; index++) {
      const start = audioElement.played.start(index);
      const end = audioElement.played.end(index);
      if (start > heardUntil + 0.15) return false;
      heardUntil = Math.max(heardUntil, end);
    }
    return heardUntil >= audioElement.duration - 0.25;
  }
  isFirstEndingListen() {
    return endingChapters.some((ending) => ending.id === this.currentChapter)
      && this.state.state.endingPlayCounts[this.currentChapter] === 0;
  }
  chapterEnded(id) {
    this.state.emit('CHAPTER_FINISHED', id);
    this.room.setPhase(
      this.state.state.phase,
      this.state.state.keysFound,
      this.state.state.completed.includes('chapter2'),
      this.state.state.drawer1Open
    );
    if (id === 'chapter3') {
      this.room.setChapter3Completed(true, this.state.state.drawer3Open);
    }
    const ending = {
      vincent: ['Final 1: Abierto', '¿Será que escaparon?'],
      leteo: ['Final 2: Contenido', 'Solo eres uno de muchos'],
      ips: ['Final 3: Alternativo', 'Era cuestión de tiempo…']
    }[id];
    if (ending && this.state.state.endingCassettes.includes(id)) {
      this.state.state.endingPlayCounts[id] += 1;
    }
    this.save();
    if (ending) {
      if (id === 'ips') {
        this.mode = 'endingTransition';
        this.mouseLookEnabled = false;
        this.keys = {};
        this.cancelHoldInteraction();
        if (document.pointerLockElement) document.exitPointerLock();
        document.body.classList.add('ending-transition');
        document.querySelector('#computerOverlay').replaceChildren();
        document.querySelectorAll('.toast').forEach((toast) => toast.remove());
        this.room.onLightning = null;
        this.room.lightningCountdown = Infinity;
        this.room.lightningElapsed = -1;
        this.room.lightningFlash.material.opacity = 0;
        this.room.lightningLight.intensity = 0;
        this.audio.stopRoomAmbience();
        const knockSequenceDuration = this.audio.playDoorKnocks(0.16);
        this.turnCameraToDoor(knockSequenceDuration);
        this.endingCinematicTimeout = setTimeout(() => {
          this.endingCinematicTimeout = null;
          this.showEndingCinematic(...ending);
        }, knockSequenceDuration + 550);
        return;
      }
      this.showEndingCinematic(...ending);
      return;
    }
    this.notify(id === 'prologue' ? 'Nuevo cassette desbloqueado: Capítulo 1' : 'Grabación completada');
    if (id === 'chapter1') this.renderPuzzle();
  }
  showEndingCinematic(title, line) {
    this.audio.stopRoomAmbience();
    this.audio.stopMainMusic();
    this.mode = 'endingCinematic';
    const cinematic = document.createElement('main');
    cinematic.className = 'ending-cinematic';
    cinematic.setAttribute('aria-label', title);
    cinematic.innerHTML = `
      <section class="ending-cinematic-copy" aria-live="polite">
        <h1>${title}</h1>
        <p>${line}</p>
        <button type="button">Volver a la pantalla de inicio</button>
      </section>`;
    cinematic.querySelector('button').onclick = () => {
      cinematic.remove();
      this.endingCinematic = null;
      this.returnToMainMenu();
    };
    document.body.appendChild(cinematic);
    this.endingCinematic = cinematic;
  }
  turnCameraToDoor(duration) {
    const camera = this.room.camera;
    const target = new THREE.Object3D();
    target.position.copy(camera.position);
    target.lookAt(0, 1.05, 2.42);
    const startOrientation = camera.quaternion.clone();
    const endOrientation = target.quaternion.clone();
    const startedAt = performance.now();
    const rotate = (now) => {
      if (this.mode !== 'endingTransition') return;
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      camera.quaternion.slerpQuaternions(startOrientation, endOrientation, eased);
      if (progress < 1) requestAnimationFrame(rotate);
    };
    requestAnimationFrame(rotate);
  }
  renderPuzzle() {
    const overlay = document.querySelector('#computerOverlay');
    overlay.innerHTML = `<div class="crt quiz"><div class="crt-header"><span>CUESTIONARIO // ARCHIVO CLÍNICO</span><button id="quizBack">VOLVER</button></div><h2>¿Cuál es la dosis final del paciente?</h2><input id="answer" autocomplete="off" placeholder="Escriba la respuesta"><button id="submitAnswer">Confirmar</button><p id="answerMessage"></p></div>`;
    overlay.querySelector('#quizBack').onclick = () => this.renderComputerMenu();
    overlay.querySelector('#submitAnswer').onclick = () => {
      if (this.progress.solvePuzzle(overlay.querySelector('#answer').value)) {
        overlay.querySelector('#answerMessage').textContent = 'Respuesta correcta.';
        this.notify('Capítulo 2 desbloqueado');
        setTimeout(() => this.renderComputerMenu(), 900);
      } else overlay.querySelector('#answerMessage').textContent = 'Respuesta incorrecta. Puede intentar nuevamente.';
    };
    overlay.querySelector('#answer').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        overlay.querySelector('#submitAnswer').click();
      }
    });
  }
  renderPasswords() {
    const overlay = document.querySelector('#computerOverlay');
    overlay.innerHTML = `<div class="crt quiz"><div class="crt-header"><span>TERMINAL // ACCESO FINAL</span><button id="passwordBack">VOLVER</button></div><h2>INTRODUCIR CONTRASEÑA</h2><p class="password-hint">Busca la contraseña en el entorno o recuerda lo dicho en los audios; quizá sea el nombre de algún medicamento.</p><input id="password" autocomplete="off"><button id="submitPassword">Acceder</button><p id="passwordMessage"></p></div>`;
    overlay.querySelector('#passwordBack').onclick = () => this.renderComputerMenu();
    overlay.querySelector('#submitPassword').onclick = () => {
      const value = overlay.querySelector('#password').value.toLowerCase().replace(/\s+/g, '');
      const endingId = { vincent: 'vincent', leteo: 'leteo', ips: 'ips' }[value];
      if (endingId) {
        this.progress.addEnding(endingId);
        this.renderEndingFolder(endingId);
      } else overlay.querySelector('#passwordMessage').textContent = 'ACCESO DENEGADO';
    };
    overlay.querySelector('#password').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        overlay.querySelector('#submitPassword').click();
      }
    });
  }
  readDrawerNote() {
    if (this.mode !== 'room' || !this.room.drawer3Open || !this.state.state.completed.includes('chapter3')) return;
    const note = document.createElement('section');
    note.className = 'drawer-note-overlay';
    note.setAttribute('role', 'dialog');
    note.setAttribute('aria-modal', 'true');
    note.setAttribute('aria-labelledby', 'drawerNoteTitle');
    note.innerHTML = `
      <article class="drawer-note">
        <button class="drawer-note-close" type="button" aria-label="Cerrar nota">×</button>
        <h2 id="drawerNoteTitle">CLAVE: IPS</h2>
        <p>Paciente 028 se encuentra ausente tras escapar. Aún continúa la búsqueda. Mantengan la precaución: un frasco con la dosis apareció estrellado contra el suelo de la habitación por donde suponemos que escapó el paciente.</p>
        <button class="drawer-note-done" type="button">CERRAR</button>
      </article>`;
    document.body.appendChild(note);
    this.noteOverlay = note;
    this.mode = 'readingNote';
    document.body.classList.add('note-active');
    this.mouseLookEnabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    const close = () => this.closeDrawerNote();
    note.querySelector('.drawer-note-close').onclick = close;
    note.querySelector('.drawer-note-done').onclick = close;
    note.addEventListener('click', (event) => {
      if (event.target === note) close();
    });
  }
  closeDrawerNote() {
    this.noteOverlay?.remove();
    this.noteOverlay = null;
    document.body.classList.remove('note-active');
    if (this.mode === 'readingNote') this.mode = 'room';
  }
  renderEndingFolder(id) {
    const ending = endingChapters.find((entry) => entry.id === id);
    if (!ending) return;
    const overlay = document.querySelector('#computerOverlay');
    overlay.innerHTML = `<div class="crt ending"><p>ARCHIVO DESBLOQUEADO</p><h2>Carpeta &quot;${ending.folderName}&quot; desbloqueada</h2><p>Abre la carpeta para añadir su cassette al archivo sonoro.</p><button id="openEndingCassette">ABRIR</button><button id="endingBack">REGRESAR</button></div>`;
    overlay.querySelector('#openEndingCassette').onclick = () => {
      if (this.progress.unlockEndingCassette(id)) {
        this.notify(`Cassette ${ending.title} desbloqueado.`);
        this.renderComputerMenu();
      }
    };
    overlay.querySelector('#endingBack').onclick = () => this.renderComputerMenu();
  }
  toggleInventory() {
    let panel = document.querySelector('#inventoryPanel');
    if (panel) { panel.remove(); return; }
    panel = document.createElement('div'); panel.id = 'inventoryPanel';
    panel.className = 'inventory';
    panel.innerHTML = `<h2>INVENTARIO</h2>${this.state.state.inventory.length ? this.state.state.inventory.map((item) => `<button>${item}</button>`).join('') : '<p>Vacío</p>'}<button id="closeInventory">Cerrar</button>`;
    document.body.appendChild(panel);
    panel.querySelector('#closeInventory').onclick = () => panel.remove();
  }
  formatTime(value) {
    if (!Number.isFinite(value)) return '00:00';
    const m = Math.floor(value / 60), s = Math.floor(value % 60);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
}

new Game();
