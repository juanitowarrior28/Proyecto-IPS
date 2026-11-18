import * as THREE from 'three';

export class RoomScene {
  constructor(canvas) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080908);
    this.scene.fog = new THREE.FogExp2(0x080908, 0.045);
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 50);
    this.camera.position.set(0, 1.65, 1.8);
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
    this.buildForestWindow();
    this.box(0.08, 3, 5, 0x292a24, 2, 1.5, 0);
    this.box(4, 0.08, 5, 0x171812, 0, 3, 0);
    this.box(1.15, 2.05, 0.08, 0x1b1b18, 0, 1.025, -2.44, 'door');
    this.buildRearDoor();

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
  buildRearDoor() {
    const doorWidth = 1.2;
    const doorHeight = 2.1;
    const sideWidth = (4 - doorWidth) / 2;
    this.box(sideWidth, 3, 0.08, 0x292a24, -1.4, 1.5, 2.5);
    this.box(sideWidth, 3, 0.08, 0x292a24, 1.4, 1.5, 2.5);
    this.box(doorWidth, 3 - doorHeight, 0.08, 0x292a24, 0, 2.55, 2.5);
    this.box(doorWidth, doorHeight, 0.09, 0x30271f, 0, doorHeight / 2, 2.44);

    [1.5, 0.9].forEach((y) => {
      const pane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42, 0.3),
        new THREE.MeshBasicMaterial({ color: 0x465152, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
      );
      pane.position.set(0, y, 2.385);
      this.scene.add(pane);
      this.box(0.48, 0.035, 0.025, 0x554838, 0, y + 0.17, 2.385);
      this.box(0.48, 0.035, 0.025, 0x554838, 0, y - 0.17, 2.385);
      this.box(0.035, 0.34, 0.025, 0x554838, -0.255, y, 2.385);
      this.box(0.035, 0.34, 0.025, 0x554838, 0.255, y, 2.385);
    });
    this.box(0.045, 0.16, 0.045, 0x9b8c5c, 0.42, 0.98, 2.37);
  }
  buildForestWindow() {
    const windowWidth = 1.4;
    const windowHeight = 1.05;
    const windowBottom = 1.15;
    const windowY = windowBottom + windowHeight / 2;
    const sideLength = (5 - windowWidth) / 2;
    this.box(0.08, 3, sideLength, 0x292a24, -2, 1.5, -(windowWidth + sideLength) / 2);
    this.box(0.08, 3, sideLength, 0x292a24, -2, 1.5, (windowWidth + sideLength) / 2);
    this.box(0.08, windowBottom, windowWidth, 0x292a24, -2, windowBottom / 2, 0);
    this.box(0.08, 3 - windowBottom - windowHeight, windowWidth, 0x292a24,
      -2, windowBottom + windowHeight + (3 - windowBottom - windowHeight) / 2, 0);

    const barrier = this.box(0.04, windowHeight, windowWidth, 0x292a24, -2, windowY, 0);
    barrier.material.transparent = true;
    barrier.material.opacity = 0;
    barrier.material.depthWrite = false;

    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(windowWidth, windowHeight),
      new THREE.MeshBasicMaterial({
        color: 0x829394,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    glass.position.set(-1.945, windowY, 0);
    glass.rotation.y = Math.PI / 2;
    this.scene.add(glass);

    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 5),
      new THREE.MeshBasicMaterial({ color: 0x596566, side: THREE.DoubleSide })
    );
    sky.position.set(-5.6, 1.75, 0);
    sky.rotation.y = Math.PI / 2;
    this.scene.add(sky);

    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.08, 5),
      new THREE.MeshBasicMaterial({ color: 0x242a28 })
    );
    ground.position.set(-4, 0.08, 0);
    this.scene.add(ground);

    this.buildExteriorTrees();
    this.fogBands = [];
    [1.32, 1.63, 1.94].forEach((y, index) => {
      const fog = new THREE.Mesh(
        new THREE.SphereGeometry(1, 12, 8),
        new THREE.MeshBasicMaterial({
          color: 0x9ba5a4,
          transparent: true,
          opacity: 0.055 + index * 0.01,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      );
      fog.position.set(-3.15 - index * 0.5, y, -0.1 + index * 0.15);
      fog.scale.set(0.24, 0.12, 0.72);
      this.scene.add(fog);
      this.fogBands.push(fog);
    });

    this.buildRain(windowBottom, windowHeight);
    const flashMaterial = new THREE.MeshBasicMaterial({
      color: 0xd5e1e5,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.lightningFlash = new THREE.Mesh(
      new THREE.PlaneGeometry(windowWidth, windowHeight),
      flashMaterial
    );
    this.lightningFlash.position.set(-2.2, windowY, 0);
    this.lightningFlash.rotation.y = Math.PI / 2;
    this.scene.add(this.lightningFlash);
    this.lightningLight = new THREE.PointLight(0xc6d8df, 0, 7);
    this.lightningLight.position.set(-2.35, windowY, 0);
    this.scene.add(this.lightningLight);
    this.lightningCountdown = 4 + Math.random() * 5;
    this.lightningElapsed = -1;

    const frameColor = 0x514b3d;
    this.box(0.1, 0.06, windowWidth + 0.08, frameColor, -1.94, windowBottom, 0);
    this.box(0.1, 0.06, windowWidth + 0.08, frameColor, -1.94, windowBottom + windowHeight, 0);
    this.box(0.1, windowHeight, 0.06, frameColor, -1.94, windowY, -windowWidth / 2);
    this.box(0.1, windowHeight, 0.06, frameColor, -1.94, windowY, windowWidth / 2);
    this.box(0.1, windowHeight, 0.035, frameColor, -1.93, windowY, 0);
  }
  buildExteriorTrees() {
    const bark = new THREE.MeshBasicMaterial({ color: 0x171b1a });
    const branchMaterial = new THREE.MeshBasicMaterial({ color: 0x252b29 });
    const trunkGeometry = new THREE.CylinderGeometry(0.09, 0.17, 1, 5);
    const branchGeometry = new THREE.CylinderGeometry(0.01, 0.035, 1, 4);
    const trees = [
      [-2.3, -0.38, 3.2], [-2.35, 0.36, 2.9], [-2.7, 0.05, 3.6],
      [-3.1, -0.58, 3.8], [-3.25, 0.28, 3], [-3.6, 0.65, 3.5],
      [-4, -0.8, 3.4], [-4.4, 0, 3.8]
    ];
    const up = new THREE.Vector3(0, 1, 0);
    trees.forEach(([x, z, height], index) => {
      const trunk = new THREE.Mesh(trunkGeometry, bark);
      trunk.position.set(x, height / 2, z);
      trunk.scale.y = height;
      this.scene.add(trunk);

      [0.42, 0.58, 0.73, 0.86].forEach((level, branchIndex) => {
        [-1, 1].forEach((direction) => {
          const start = new THREE.Vector3(x, height * level, z);
          const length = 0.2 + ((index + branchIndex) % 3) * 0.06;
          const end = new THREE.Vector3(
            x + (index % 2 ? 0.08 : -0.08),
            height * level + 0.18 + branchIndex * 0.025,
            z + direction * length
          );
          const vector = end.clone().sub(start);
          const branchLength = vector.length();
          const branch = new THREE.Mesh(branchGeometry, branchMaterial);
          branch.position.copy(start).add(end).multiplyScalar(0.5);
          branch.quaternion.setFromUnitVectors(up, vector.normalize());
          branch.scale.y = branchLength;
          this.scene.add(branch);
        });
      });
    });
  }
  buildRain(windowBottom, windowHeight) {
    this.rainStreaks = [];
    const material = new THREE.MeshBasicMaterial({
      color: 0x879597,
      transparent: true,
      opacity: 0.34,
      depthWrite: false
    });
    const geometry = new THREE.BoxGeometry(0.006, 0.13, 0.006);
    for (let i = 0; i < 54; i++) {
      const streak = new THREE.Mesh(geometry, material);
      streak.position.set(
        -2.25 - Math.random() * 1.5,
        windowBottom + Math.random() * (windowHeight + 0.5),
        (Math.random() - 0.5) * 1.9
      );
      streak.rotation.z = -0.14;
      this.scene.add(streak);
      this.rainStreaks.push({ mesh: streak, speed: 2.2 + Math.random() * 2.4 });
    }
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
    this.drawerNote = this.makeDrawerNote(x);
    this.drawerNote.userData.id = 'drawerNote';
    this.drawerNote.visible = false;
    this.scene.add(this.drawerNote);

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
      part.visible = false;
      this.scene.add(part);
    });
    this.keyParts[0].userData.id = 'key';
    this.cabinetLight = new THREE.PointLight(0xd0a74c, 0, 1.7);
    this.cabinetLight.position.set(x, 1.18, z + 0.45);
    this.scene.add(this.cabinetLight);
    this.drawerOpen = false;
    this.chapter2Completed = false;
    this.keysFound = false;
    this.chapter3Completed = false;
    this.drawer3Open = false;
  }
  setKeyVisible(visible) {
    const available = visible && this.chapter2Completed && this.drawerOpen && !this.keysFound;
    this.keyParts.forEach((part) => { part.visible = available; });
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
  setDrawer1Open(open) {
    this.drawerOpen = Boolean(open);
    const drawer = this.interactables.find((object) => object.userData.drawerIndex === 0);
    if (drawer) {
      drawer.userData.open = this.drawerOpen;
      drawer.position.z = this.drawerOpen ? -0.22 : -0.49;
    }
    this.keyParts.forEach((part) => { part.position.z = this.drawerOpen ? -0.04 : -0.25; });
    this.setKeyVisible(true);
  }
  openDrawer(index) {
    if (index === 0 && !this.chapter2Completed) return false;
    if (index === 2 && !this.chapter3Completed) return false;
    const drawers = this.interactables.filter((object) => object.userData.id === 'drawer');
    const drawer = drawers.find((object) => object.userData.drawerIndex === index);
    if (!drawer) return false;
    const opening = !drawer.userData.open;
    drawer.userData.open = opening;
    if (index === 0) {
      this.setDrawer1Open(opening);
    } else if (index === 2) {
      this.setDrawer3Open(opening);
    } else {
      drawer.position.z = opening ? -0.34 : -0.49;
    }
    return opening;
  }
  setDrawer3Open(open) {
    this.drawer3Open = Boolean(open && this.chapter3Completed);
    const drawer = this.interactables.find((object) => object.userData.drawerIndex === 2);
    if (drawer) {
      drawer.userData.open = this.drawer3Open;
      drawer.position.z = this.drawer3Open ? -0.22 : -0.49;
    }
    this.drawerNote.visible = this.drawer3Open;
  }
  makeDrawerNote(x) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 384;
    const context = canvas.getContext('2d');
    context.fillStyle = '#d6d0b8';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#77715f';
    context.lineWidth = 8;
    context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    context.fillStyle = '#27261f';
    context.font = 'bold 42px monospace';
    context.fillText('CLAVE: IPS', 32, 68);
    context.strokeStyle = '#77715f';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(32, 92);
    context.lineTo(480, 92);
    context.stroke();
    context.fillStyle = '#35342d';
    context.font = '20px monospace';
    const lines = [
      'Paciente 028 se encuentra',
      'ausente tras escapar. Aún',
      'continúa la búsqueda.',
      'Mantengan la precaución:',
      'un frasco con la dosis apareció',
      'estrellado en el suelo de la',
      'habitación por donde suponemos',
      'que escapó el paciente.'
    ];
    lines.forEach((line, index) => context.fillText(line, 32, 128 + index * 29));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const note = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.32),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
    );
    note.position.set(x, 0.5, -0.245);
    note.rotation.x = -0.12;
    return note;
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
    const hit = hits[0] || null;
    if (hit?.object.userData.id === 'key'
      && (!this.chapter2Completed || !this.drawerOpen || this.keysFound)) return null;
    return hit;
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
  setPhase(phase, keysFound = false, chapter2Completed = false, drawer1Open = false) {
    this.mainLight.intensity = [1.8, 1.55, 1.35, 1.15, 0.9][Math.min(phase, 4)];
    this.cabinetLight.intensity = phase >= 3 ? 0.55 : 0;
    this.keysFound = keysFound;
    this.chapter2Completed = chapter2Completed;
    this.setDrawer1Open(chapter2Completed && drawer1Open);
  }
  setChapter3Completed(completed, drawerOpen = false) {
    this.chapter3Completed = Boolean(completed);
    this.setDrawer3Open(drawerOpen);
  }
  update(delta) {
    this.resize();
    const elapsed = this.clock.elapsedTime;
    if (this.phaseFlare) this.mainLight.intensity *= 0.98 + Math.sin(elapsed * 7) * 0.02;
    this.rainStreaks.forEach(({ mesh, speed }) => {
      mesh.position.y -= speed * delta;
      if (mesh.position.y < 0.95) {
        mesh.position.set(
          -2.25 - Math.random() * 1.5,
          2.25 + Math.random() * 0.45,
          (Math.random() - 0.5) * 1.9
        );
      }
    });
    this.fogBands.forEach((fog, index) => {
      fog.position.z += delta * (index % 2 ? -0.035 : 0.025);
      if (fog.position.z < -0.6) fog.position.z = 0.6;
      if (fog.position.z > 0.6) fog.position.z = -0.6;
    });

    if (this.lightningElapsed < 0) {
      this.lightningCountdown -= delta;
      if (this.lightningCountdown <= 0) {
        this.lightningElapsed = 0;
        this.onLightning?.();
      }
    }
    if (this.lightningElapsed >= 0) {
      this.lightningElapsed += delta;
      const time = this.lightningElapsed;
      const strength = time < 0.08 ? 1
        : time < 0.16 ? 0.04
          : time < 0.24 ? 0.72
            : time < 0.32 ? 0
              : time < 0.4 ? 0.3
                : 0;
      this.lightningFlash.material.opacity = strength * 0.55;
      this.lightningLight.intensity = strength * 4.5;
      if (time >= 0.52) {
        this.lightningElapsed = -1;
        this.lightningCountdown = 8 + Math.random() * 11;
        this.lightningFlash.material.opacity = 0;
        this.lightningLight.intensity = 0;
      }
    }
  }
  render() { this.renderer.render(this.scene, this.camera); }
}
