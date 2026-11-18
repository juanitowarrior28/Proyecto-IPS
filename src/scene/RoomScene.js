import * as THREE from 'three';

export class RoomScene {
  constructor(canvas) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080908);
    this.scene.fog = new THREE.FogExp2(0x080908, 0.045);
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 50);
    this.camera.position.set(0, 1.65, 3.2);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.raycaster = new THREE.Raycaster();
    this.interactables = [];
    this.colliders = [];
    this.clock = new THREE.Clock();
    this.build();
  }
  mat(color, roughness = 0.8) { return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 }); }
  box(w, h, d, color, x, y, z, name) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat(color));
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.collider = { halfWidth: w / 2, halfDepth: d / 2, minY: y - h / 2, maxY: y + h / 2 };
    this.colliders.push(mesh);
    if (name) mesh.userData.id = name;
    this.scene.add(mesh); return mesh;
  }
  build() {
    this.box(4, 0.08, 5, 0x24251f, 0, 0, 0);
    this.box(4, 3, 0.08, 0x303129, 0, 1.5, -2.5);
    this.box(0.08, 3, 5, 0x292a24, -2, 1.5, 0);
    this.box(0.08, 3, 5, 0x292a24, 2, 1.5, 0);
    this.box(4, 0.08, 5, 0x171812, 0, 3, 0);
    this.box(1.15, 2.05, 0.08, 0x1b1b18, 0, 1.025, -2.44, 'door');

    this.scene.add(new THREE.HemisphereLight(0x5f6d63, 0x151611, 0.18));
    this.mainLight = new THREE.PointLight(0xb7b79a, 2.2, 7);
    this.mainLight.position.set(0, 2.65, 0.5); this.mainLight.castShadow = true;
    this.mainLight.shadow.mapSize.set(512, 512); this.scene.add(this.mainLight);

    const desk = this.box(2.1, 0.12, 0.75, 0x3a3026, 0, 0.78, -1.72, 'desk');
    this.box(0.1, 0.72, 0.1, 0x28251f, -0.85, 0.38, -1.72);
    this.box(0.1, 0.72, 0.1, 0x28251f, 0.85, 0.38, -1.72);

    this.computer = this.box(0.9, 0.78, 0.68, 0xb6ad91, 0, 1.18, -1.72, 'computer');
    this.computer.add(this.makeLabel('Vincent'));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.48),
      new THREE.MeshBasicMaterial({ color: 0x5f7f65 }));
    screen.position.set(0, 0.08, 0.348); this.computer.add(screen); this.monitorScreen = screen;
    this.box(0.72, 0.07, 0.28, 0xaaa58f, 0, 0.72, -1.15, 'keyboard');

    [-1.55, -0.55, 0.45].forEach((x, i) => {
      const locker = this.box(0.42, 1.65, 0.5, i === 1 ? 0x4a4d48 : 0x55584f, x, 0.825, -2.15, i === 1 ? 'locker' : 'locker');
      locker.userData.interaction = i === 1 ? 'locker' : 'locker';
    });
    this.buildCabinet();
    this.tape = this.box(0.24, 0.1, 0.15, 0x48483d, 1.35, 1.67, -0.82, 'tape');
    const tapeLabel = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.025, 0.006), this.mat(0xb8ac82));
    tapeLabel.position.set(0, 0.025, 0.079);
    this.tape.add(tapeLabel);
    const reelMaterial = this.mat(0x252720, 0.45);
    [-0.045, 0.045].forEach((reelX) => {
      const reel = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 12), reelMaterial);
      reel.position.set(reelX, -0.018, 0.079);
      this.tape.add(reel);
    });
    this.tape.visible = false;
    this.tapeTarget = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.22, 0.24),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    this.tapeTarget.position.copy(this.tape.position);
    this.tapeTarget.userData.id = 'tape';
    this.tapeTarget.visible = false;
    this.scene.add(this.tapeTarget);

    this.interactables = this.scene.children.filter((o) => o.isMesh && o.userData.id);
  }
  buildCabinet() {
    const x = 1.35, z = -0.82;
    this.box(0.72, 1.18, 0.62, 0x39372f, x, 0.59, z);
    this.box(0.76, 0.06, 0.66, 0x514b3d, x, 1.2, z);
    this.box(0.76, 0.06, 0.66, 0x514b3d, x, 0.02, z);
    for (let i = 0; i < 3; i++) {
      const front = this.box(0.64, 0.28, 0.055, 0x5b5546, x, 0.98 - i * 0.36, z + 0.33, 'drawer');
      front.userData.drawerIndex = i;
      this.box(0.12, 0.035, 0.035, 0x9b8c5c, x, 0.98 - i * 0.36, z + 0.37);
    }

    this.box(0.84, 0.055, 0.44, 0x514b3d, x, 1.55, z - 0.08);
    this.box(0.84, 0.055, 0.44, 0x514b3d, x, 1.85, z - 0.08);
    this.box(0.055, 0.38, 0.44, 0x514b3d, x - 0.39, 1.68, z - 0.08);
    this.box(0.055, 0.38, 0.44, 0x514b3d, x + 0.39, 1.68, z - 0.08);
    this.shelfDoor = this.box(0.72, 0.36, 0.045, 0x484438, x, 1.68, z + 0.17, 'shelf');
    const lockMaterial = new THREE.MeshStandardMaterial({ color: 0x8c7848, metalness: 0.7, roughness: 0.35 });
    this.padlockBody = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.045), lockMaterial);
    this.padlockBody.position.set(x, 1.66, z + 0.22);
    this.scene.add(this.padlockBody);
    this.padlockShackle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.01, 8, 16), lockMaterial);
    this.padlockShackle.position.set(x, 1.75, z + 0.22);
    this.scene.add(this.padlockShackle);

    const brass = new THREE.MeshBasicMaterial({ color: 0xe7bd58 });
    this.keyParts = [
      new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.24, 0.12),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      ),
      new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 18), brass),
      new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.022, 0.018), brass),
      new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.055, 0.018), brass)
    ];
    this.keyParts[0].position.set(x, 0.93, -0.25);
    this.keyParts[1].position.set(x - 0.08, 0.93, -0.25);
    this.keyParts[2].position.set(x + 0.025, 0.93, -0.25);
    this.keyParts[3].position.set(x + 0.09, 0.9, -0.25);
    this.keyParts.forEach((part) => {
      part.userData.id = 'key';
      part.visible = false;
      this.scene.add(part);
    });
    this.cabinetLight = new THREE.PointLight(0xd0a74c, 0, 1.7);
    this.cabinetLight.position.set(x, 1.18, z + 0.45);
    this.scene.add(this.cabinetLight);
    this.drawerOpen = false;
  }
  setKeyVisible(visible) {
    this.keyParts.forEach((part) => { part.visible = visible; });
  }
  setCompartmentState(unlocked, open, cassetteCollected) {
    this.compartmentUnlocked = unlocked;
    this.compartmentOpen = unlocked && open;
    this.shelfDoor.position.x = this.compartmentOpen ? 0.58 : 1.35;
    this.padlockBody.visible = !unlocked;
    this.padlockShackle.visible = !unlocked;
    this.tape.visible = this.compartmentOpen && !cassetteCollected;
    this.tapeTarget.visible = this.tape.visible;
  }
  openDrawer(index, keyAvailable) {
    const drawers = this.interactables.filter((object) => object.userData.id === 'drawer');
    const drawer = drawers.find((object) => object.userData.drawerIndex === index);
    if (!drawer) return;
    const opening = !drawer.userData.open;
    drawer.userData.open = opening;
    drawer.position.z = opening ? -0.34 : -0.49;
    if (index === 0) {
      this.drawerOpen = opening;
      this.setKeyVisible(opening && keyAvailable);
    }
  }
  makeLabel(text) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#c2b578'; ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#171714'; ctx.font = 'bold 44px monospace'; ctx.fillText(text, 34, 48);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
    sprite.position.set(0.24, -0.24, 0.36); sprite.scale.set(0.28, 0.07, 1);
    return sprite;
  }
  resize() {
    const w = this.renderer.domElement.clientWidth, h = this.renderer.domElement.clientHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }
  getInteraction(origin, direction) {
    this.raycaster.set(origin, direction); this.raycaster.far = 5.5;
    this.raycaster.camera = this.camera;
    const hits = this.raycaster.intersectObjects(this.interactables, false);
    return hits[0] || null;
  }
  isBlocked(x, z) {
    const radius = 0.24;
    const playerBottom = this.camera.position.y - 1.55;
    const playerTop = this.camera.position.y + 0.1;
    return this.colliders.some((mesh) => {
      const { halfWidth, halfDepth, minY, maxY } = mesh.userData.collider;
      if (playerBottom >= maxY || playerTop <= minY) return false;
      const nearestX = THREE.MathUtils.clamp(x, mesh.position.x - halfWidth, mesh.position.x + halfWidth);
      const nearestZ = THREE.MathUtils.clamp(z, mesh.position.z - halfDepth, mesh.position.z + halfDepth);
      const dx = x - nearestX;
      const dz = z - nearestZ;
      return dx * dx + dz * dz < radius * radius;
    });
  }
  setPhase(phase, keysFound = false, chapter2Completed = false) {
    this.mainLight.intensity = [1.8, 1.55, 1.35, 1.15, 0.9][Math.min(phase, 4)];
    this.cabinetLight.intensity = phase >= 3 ? 0.55 : 0;
    this.setKeyVisible(chapter2Completed && this.drawerOpen && !keysFound);
  }
  update(delta) {
    this.resize();
    const elapsed = this.clock.elapsedTime;
    if (this.phaseFlare) this.mainLight.intensity *= 0.98 + Math.sin(elapsed * 7) * 0.02;
  }
  render() { this.renderer.render(this.scene, this.camera); }
}
