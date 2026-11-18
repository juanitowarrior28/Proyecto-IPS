import './styles/main.css';
import * as THREE from 'three';
import { chapters, endingChapters } from './config/chapters.js';
import { SaveManager, defaultSave } from './core/SaveManager.js';
import { GameState } from './core/GameState.js';
import { ProgressionSystem } from './core/ProgressionSystem.js';
import { AudioSystem } from './core/AudioSystem.js';
import { RoomScene } from './scene/RoomScene.js';

class Game {
  constructor() {
    this.app = document.querySelector('#app');
    this.saveManager = new SaveManager();
    this.state = new GameState(defaultSave());
    this.progress = new ProgressionSystem(this);
    this.audio = new AudioSystem();
    this.mode = 'menu';
    this.currentChapter = null;
    this.mouseLookEnabled = false;
    this.pointerLockWarningShown = false;
    this.subtitles = [];
    this.subtitleVisible = true;
    this.clock = new THREE.Clock();
    this.renderMenu();
  }
  save() { this.saveManager.save(this.state.state); }
  notify(message) {
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }
  renderMenu() {
    this.mode = 'menu';
    const saved = this.saveManager.exists();
    this.app.innerHTML = `
      <main class="menu-screen">
        <div class="menu-noise"></div>
        <section class="menu-panel">
          <p class="menu-kicker">ARCHIVO DE VIGILANCIA // 1994</p>
          <h1>EFFECTO<br>IPS</h1>
          <div class="menu-actions">
            <button id="newGame">Nueva partida</button>
            ${saved ? '<button id="continueGame">Continuar partida</button>' : ''}
            <button id="settings">Configuración</button>
          </div>
        </section>
      </main>`;
    document.querySelector('#newGame').onclick = () => {
      if (saved && !confirm('¿Eliminar el progreso guardado y comenzar una nueva partida?')) return;
      this.saveManager.clear();
      this.state = new GameState(defaultSave());
      this.progress = new ProgressionSystem(this);
      this.startGame();
    };
    if (saved) document.querySelector('#continueGame').onclick = () => {
      this.state = new GameState(this.saveManager.load() || defaultSave());
      this.progress = new ProgressionSystem(this);
      this.startGame();
    };
    document.querySelector('#settings').onclick = () => this.renderSettings();
  }
  renderSettings() {
    const s = this.state.state.settings;
    this.app.innerHTML = `
      <main class="menu-screen settings-screen">
        <section class="menu-panel settings-panel">
          <h2>CONFIGURACIÓN</h2>
          <label>Subtítulos <input id="subtitleSetting" type="checkbox" ${s.subtitles ? 'checked' : ''}></label>
          <label>Volumen general <input id="generalVolume" type="range" min="0" max="1" step="0.05" value="${s.generalVolume}"></label>
          <label>Sensibilidad <input id="sensitivity" type="range" min="0.5" max="3.5" step="0.1" value="${s.mouseSensitivity}"></label>
          <label>Reducir parpadeos <input id="reduceFlashes" type="checkbox" ${s.reduceFlashes ? 'checked' : ''}></label>
          <label>Reducir movimiento <input id="reduceMovement" type="checkbox" ${s.reduceMovement ? 'checked' : ''}></label>
          <label>Interferencias <input id="interference" type="checkbox" ${s.interference ? 'checked' : ''}></label>
          <button id="backMenu">Volver al menú</button>
        </section>
      </main>`;
    const values = ['subtitleSetting','generalVolume','sensitivity','reduceFlashes','reduceMovement','interference'];
    values.forEach((id) => document.querySelector('#'+id).addEventListener('change', (e) => {
      const map = { subtitleSetting:'subtitles', generalVolume:'generalVolume', sensitivity:'mouseSensitivity', reduceFlashes:'reduceFlashes', reduceMovement:'reduceMovement', interference:'interference' };
      s[map[id]] = e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value);
      if (id === 'sensitivity') this.lookSensitivity = 0.0045 * s.mouseSensitivity;
      this.save();
    }));
    document.querySelector('#backMenu').onclick = () => this.renderMenu();
  }
  startGame() {
    this.app.innerHTML = `<canvas id="gameCanvas"></canvas><div id="crosshair"></div><div id="contextHint"></div><div id="lookTip">RATÓN: MIRAR · WASD: MOVER · E: INTERACTUAR · CLIC: CAPTURAR RATÓN</div><div id="holdIndicator" class="hold-indicator" hidden><span id="holdLabel"></span><div class="hold-track"><div id="holdFill"></div></div></div><div id="hotbar" class="hotbar" aria-label="Inventario"></div><div id="hud"></div><div id="computerOverlay"></div>`;
    this.room = new RoomScene(document.querySelector('#gameCanvas'));
    this.room.setPhase(this.state.state.phase, this.state.state.keysFound);
    this.room.setCompartmentState(
      this.state.state.compartmentUnlocked,
      this.state.state.compartmentOpen,
      this.state.state.tape3Found
    );
    this.keys = {};
    this.mouseLookEnabled = false;
    this.lookSensitivity = 0.0045 * this.state.state.settings.mouseSensitivity;
    this.room.camera.rotation.order = 'YXZ';
    this.syncLookTarget();
    this.setupControls();
    this.mode = 'room';
    this.renderHotbar();
    this.audio.ensure();
    this.audio.ambient();
    this.animate();
  }
  setupControls() {
    const canvas = document.querySelector('#gameCanvas');
    canvas.addEventListener('click', () => {
      if (this.mode === 'room') {
        this.mouseLookEnabled = true;
        if (document.pointerLockElement !== document.body) this.requestPointerLock();
      }
      this.audio.ensure();
    });
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
    });
    document.addEventListener('pointerlockchange', () => {
      if (this.mode === 'room' && !document.pointerLockElement) this.mouseLookEnabled = true;
    });
    document.addEventListener('mousedown', (event) => {
      if (event.button === 0 && this.mode === 'room' && document.pointerLockElement === document.body) {
        this.interact();
      }
    });
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyI' && this.mode === 'room') this.toggleInventory();
      if (e.code === 'KeyE' && this.mode === 'room' && !e.repeat) this.handleEKeyDown();
      if (e.code === 'Escape' && this.mode === 'computer') this.leaveComputer();
    });
    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'KeyE') this.cancelHoldInteraction();
    });
    window.addEventListener('blur', () => {
      this.keys = {};
      this.cancelHoldInteraction();
    });
  }
  animate() {
    requestAnimationFrame(() => this.animate());
    const delta = Math.min(this.clock.getDelta(), 0.05);
    if (this.mode === 'room' && this.mouseLookEnabled) {
      this.updateCameraLook(delta);
      this.move(delta);
    }
    this.updateRaycast();
    this.updateHoldInteraction();
    this.room.update(delta);
    this.room.render();
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
    pos.addScaledVector(direction, forward * speed * delta);
    pos.addScaledVector(right, side * speed * delta);
    pos.x = THREE.MathUtils.clamp(pos.x, -1.65, 1.65);
    pos.z = THREE.MathUtils.clamp(pos.z, -1.1, 1.9);
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
    const labels = {
      computer: 'Usar computador',
      locker: 'Examinar locker',
      drawer: 'Abrir cajón',
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
    if (id === 'key' && !this.state.state.keysFound) {
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
      ? !this.state.state.keysFound
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
        this.room.setKeyVisible(false);
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
      const keyAvailable = this.state.state.phase >= 3 && !this.state.state.keysFound;
      this.room.openDrawer(hit.object.userData.drawerIndex, keyAvailable);
      this.notify(keyAvailable ? 'El cajón se abre. Hay una llave dentro.' : 'El cajón se abre; está vacío.');
    }
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
    if (id === 'locker') {
      const result = this.progress.openLocker();
      if (result === 'locked') this.notify('La cerradura requiere llaves.');
      else this.notify('Locker abierto');
    }
    if (id === 'tape' && this.room.tape.visible) {
      this.notify('Mantén E durante 5 segundos para recoger el cassette.');
    }
  }
  enterComputer() {
    this.mode = 'computer';
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
    if (this.computerView) {
      this.room.camera.position.copy(this.computerView.position);
      this.room.camera.quaternion.copy(this.computerView.quaternion);
    }
    this.mode = 'room';
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
    this.stopAudio();
    const overlay = document.querySelector('#computerOverlay');
    overlay.innerHTML = `
      <div class="crt player">
        <div class="crt-header"><span>${chapter.title}</span><button id="playerBack">VOLVER</button></div>
        <div class="player-art"><img src="${chapter.image}" alt=""><strong>${chapter.title}</strong><div id="subtitleBox" class="subtitle-box"></div></div>
        <div class="transport">
          <button id="rewind">« 15</button><button id="play">REPRODUCIR</button><button id="pause">PAUSA</button><button id="forward">15 »</button>
          ${chapter.subtitles ? `<button id="subtitles">${this.subtitleVisible ? 'SUBTÍTULOS: ON' : 'SUBTÍTULOS: OFF'}</button>` : ''}
        </div>
        <input id="progressBar" type="range" min="0" max="${chapter.duration}" value="0" step="0.1">
        <div class="time-row"><span id="elapsed">00:00</span><span id="duration">00:20</span></div>
        <div id="audioError" class="audio-error"></div>
      </div>`;
    overlay.querySelector('#playerBack').onclick = () => { this.stopAudio(); this.renderComputerMenu(); };
    this.currentChapter = id;
    this.audioElement = new Audio(chapter.file);
    this.subtitleVisible = this.state.state.settings.subtitles;
    this.audioElement.addEventListener('loadedmetadata', () => {
      overlay.querySelector('#progressBar').max = this.audioElement.duration;
      overlay.querySelector('#duration').textContent = this.formatTime(this.audioElement.duration);
    });
    this.audioElement.addEventListener('error', () => { overlay.querySelector('#audioError').textContent = 'Archivo de audio no disponible. Se conservará la progresión de prueba.'; });
    this.audioElement.addEventListener('timeupdate', () => this.updatePlayer());
    this.audioElement.addEventListener('ended', () => this.chapterEnded(id));
    overlay.querySelector('#play').onclick = () => this.audioElement.play().catch(() => overlay.querySelector('#audioError').textContent = 'El navegador bloqueó la reproducción.');
    overlay.querySelector('#pause').onclick = () => this.audioElement.pause();
    overlay.querySelector('#rewind').onclick = () => { this.audioElement.currentTime = Math.max(0, this.audioElement.currentTime - 15); };
    overlay.querySelector('#forward').onclick = () => { this.audioElement.currentTime = Math.min(this.audioElement.duration || 0, this.audioElement.currentTime + 15); };
    overlay.querySelector('#progressBar').oninput = (e) => { this.audioElement.currentTime = Number(e.target.value); };
    const subtitlesButton = overlay.querySelector('#subtitles');
    if (subtitlesButton) {
      subtitlesButton.onclick = (e) => {
        this.subtitleVisible = !this.subtitleVisible;
        e.target.textContent = `SUBTÍTULOS: ${this.subtitleVisible ? 'ON' : 'OFF'}`;
      };
    }
  }
  updatePlayer() {
    if (!this.audioElement) return;
    const t = this.audioElement.currentTime;
    const bar = document.querySelector('#progressBar');
    if (bar) bar.value = t;
    const elapsed = document.querySelector('#elapsed');
    if (elapsed) elapsed.textContent = this.formatTime(t);
    const box = document.querySelector('#subtitleBox');
    const currentAudio = [...chapters, ...endingChapters].find((chapter) => chapter.id === this.currentChapter);
    if (box) box.textContent = this.subtitleVisible && currentAudio?.subtitles
      ? '[Contenido provisional reemplazable por el subtítulo original]'
      : '';
  }
  stopAudio() {
    if (this.audioElement) { this.audioElement.pause(); this.audioElement.src = ''; this.audioElement = null; }
  }
  chapterEnded(id) {
    this.state.emit('CHAPTER_FINISHED', id);
    this.room.setPhase(this.state.state.phase, this.state.state.keysFound);
    this.save();
    this.notify(id === 'prologue' ? 'Nuevo cassette desbloqueado: Capítulo 1' : 'Grabación completada');
    if (id === 'chapter1') this.renderPuzzle();
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
  }
  renderPasswords() {
    const overlay = document.querySelector('#computerOverlay');
    overlay.innerHTML = `<div class="crt quiz"><div class="crt-header"><span>TERMINAL // ACCESO FINAL</span><button id="passwordBack">VOLVER</button></div><h2>INTRODUCIR CONTRASEÑA</h2><input id="password" autocomplete="off"><button id="submitPassword">Acceder</button><p id="passwordMessage"></p></div>`;
    overlay.querySelector('#passwordBack').onclick = () => this.renderComputerMenu();
    overlay.querySelector('#submitPassword').onclick = () => {
      const value = overlay.querySelector('#password').value.toLowerCase().replace(/\s+/g, '');
      const endingId = { vincent: 'vincent', leteo: 'leteo', ips: 'ips' }[value];
      if (endingId) {
        this.progress.addEnding(endingId);
        this.renderEndingFolder(endingId);
      } else overlay.querySelector('#passwordMessage').textContent = 'ACCESO DENEGADO';
    };
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
