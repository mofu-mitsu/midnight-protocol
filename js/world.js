import * as THREE from 'three';
import { cityMemory } from './memory.js';

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050913);
scene.fog = new THREE.FogExp2(0x050913, 0.02);

export const clock = new THREE.Clock();
export const interactables = [];
export const npcAgents = [];

let focusedNpc = null;
let followingObserver = false;
let followerVelocity = new THREE.Vector3();
let approachCooldown = 24;
let cometCooldown = 38;
let activeComets = [];
let pendingApproach = null;

// Rain system
let rainEnabled = true;
let rainSystem = null;
let rainCount = 1600;
let rainGeometry;

// Exterior & Interior locations
export const LOCATIONS = {
  STREET: '第零区・雨天通り',
  ARCHIVE: 'ネオン・アーカイブ // 情報保存室',
  ALLEY: '第零区・裏路地ジャンクション'
};

window.addEventListener('npc-focus', e => {
  focusedNpc = e.detail?.item || null;
  if (focusedNpc) {
    const a = npcAgents.find(n => n.interactable === focusedNpc);
    if (a) {
      a.wait = 9999;
      a.walking = false;
    }
  }
});

let playerInside = false;
window.addEventListener('location-mode', e => {
  playerInside = !!e.detail?.inside;
  if (playerInside && pendingApproach) {
    pendingApproach.walking = false;
    pendingApproach.approaching = false;
    pendingApproach.speed = pendingApproach.kind === 'caterpillar' ? 0.65 : 1.05;
    pendingApproach = null;
  }
});

window.addEventListener('npc-follow', e => {
  followingObserver = !!e.detail?.enabled;
});

// Call nearest NPC to rush to player
window.addEventListener('npc-call-nearest', e => {
  const p = e.detail?.position || window.playerWorldPosition;
  if (!p) return;
  const candidates = npcAgents.filter(a => a.interactable && (!followingObserver || a.kind !== 'observer'));
  const nearest = candidates.sort((a, b) => a.object.position.distanceTo(p) - b.object.position.distanceTo(p))[0];
  if (nearest) {
    pendingApproach = nearest;
    nearest.approaching = true;
    nearest.speed = 4.2; // Rush over quickly
    nearest.approachTimeout = 45; // Generous timeout to cross long distances
    nearest.wait = 9999;
    const callName = (nearest.kind === 'observer' && cityMemory.natsueNameRevealed) ? '夏江' : nearest.name;
    window.dispatchEvent(new CustomEvent('city-notice', {
      detail: { text: `（救援信号受信！${callName}が全速力で駆けつけている……！）` }
    }));
  }
});

// Chaos mode: Caterpillar swarm & psychedelic fog
window.addEventListener('city-chaos', () => {
  scene.fog.color.set(0x8a186b);
  scene.fog.density = 0.038;
  const center = window.playerWorldPosition || new THREE.Vector3(0, 0, -96);
  spawnCaterpillarSwarm(center);

  setTimeout(() => {
    scene.fog.color.set(0x050913);
    scene.fog.density = 0.02;
  }, 14000);

  window.dispatchEvent(new CustomEvent('city-notice', {
    detail: { text: 'LSI芋虫侵入群「境界線確保。侵入継続。感覚支配成功。🐛」' }
  }));
});

window.addEventListener('caterpillar-crush', e => {
  const item = e.detail?.item;
  if (item && item.object) {
    scene.remove(item.object);
    const idx = interactables.indexOf(item);
    if (idx !== -1) interactables.splice(idx, 1);
    const agentIdx = npcAgents.findIndex(a => a.interactable === item);
    if (agentIdx !== -1) npcAgents.splice(agentIdx, 1);
  }
});

window.addEventListener('sky-event', e => {
  window.dispatchEvent(new CustomEvent('city-notice', { detail: e.detail }));
});

window.addEventListener('npc-unfocus', () => {
  if (focusedNpc) {
    const a = npcAgents.find(n => n.interactable === focusedNpc);
    if (a) a.wait = 1.5;
  }
  focusedNpc = null;
});

window.addEventListener('npc-depart', e => {
  const kind = e.detail?.kind;
  const item = e.detail?.item;
  const agent = npcAgents.find(a => (item && a.interactable === item) || (kind && a.kind === kind));
  if (agent) {
    agent.approaching = false;
    let closestIdx = 0;
    let minDist = Infinity;
    agent.route.forEach((pt, idx) => {
      const d = agent.object.position.distanceTo(pt);
      if (d < minDist) {
        minDist = d;
        closestIdx = idx;
      }
    });
    agent.targetIndex = (closestIdx + 1) % agent.route.length;
    agent.speed = agent.kind === 'caterpillar' ? 0.6 : 0.85;
    agent.wait = 1.0;
    agent.walking = false;
  }
});

const roamingZones = {
  street: [
    [-4, -8], [4, -14], [-3, -24], [3, -34], [0, -46],
    [-4, -58], [4, -70], [0, -84]
  ],
  sidewalk: [
    [-5.5, -12], [-5.5, -26], [-5.5, -42], [-5.5, -58], [-5.5, -74]
  ],
  alley: [
    [5, -16], [5.5, -28], [4.5, -40], [5.5, -54], [5, -68]
  ]
};

function registerRoamer({ object, name, kind, route, speed = 1.1, interactable = null }) {
  const agent = {
    object,
    name,
    kind,
    route: route.map(p => new THREE.Vector3(p[0], 0, p[1])),
    targetIndex: Math.floor(Math.random() * route.length),
    speed,
    wait: Math.random() * 3 + 1,
    walking: false,
    interactable
  };
  npcAgents.push(agent);
  return agent;
}

function spawnCaterpillarSwarm(center) {
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const swarmMat = new THREE.MeshStandardMaterial({
      color: 0x22e066,
      roughness: 0.35,
      emissive: 0x0a5420,
      emissiveIntensity: 0.8
    });
    for (let j = 0; j < 5; j++) {
      const seg = new THREE.Mesh(new THREE.SphereGeometry(0.22 - j * 0.015, 12, 10), swarmMat);
      seg.position.set(0, 0.45, j * 0.28);
      g.add(seg);
    }
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x07110a });
    for (const x of [-0.09, 0.09]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeMat);
      eye.position.set(x, 0.55, -0.12);
      g.add(eye);
    }
    const spawnX = center.x + (Math.random() - 0.5) * 8;
    const spawnZ = center.z + (Math.random() - 0.5) * 8;
    g.position.set(spawnX, 0.05, spawnZ);
    scene.add(g);

    const swarmItem = {
      object: g,
      name: `侵入LSI芋虫 #${i + 1}`,
      type: '侵入個体',
      kind: 'caterpillar',
      hint: 'Eキー / タップで応答',
      description: '「境界線確保。侵入継続。感覚支配成功。空間の歪曲を検知したため急行したよ。🐛」',
      weights: { D: 1, C: 1 },
      position: g.position
    };
    interactables.push(swarmItem);
    npcAgents.push({
      object: g,
      name: swarmItem.name,
      kind: 'caterpillar',
      route: [
        new THREE.Vector3(center.x, 0, center.z),
        new THREE.Vector3(center.x + 3, 0, center.z - 4),
        new THREE.Vector3(center.x - 3, 0, center.z - 2)
      ],
      targetIndex: 0,
      speed: 2.2,
      wait: 0,
      walking: true,
      interactable: swarmItem,
      aggressive: true
    });
  }
}

export function updateNPCs(dt, playerPosition) {
  window.playerWorldPosition = playerPosition;
  for (const a of npcAgents) {
    if (a.aggressive && playerPosition) {
      const dx = playerPosition.x - a.object.position.x;
      const dz = playerPosition.z - a.object.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 1.35) {
        a.object.position.x += (dx / dist) * Math.min(a.speed * dt, dist - 1.35);
        a.object.position.z += (dz / dist) * Math.min(a.speed * dt, dist - 1.35);
        a.object.rotation.y = Math.atan2(dx, dz) + Math.PI;
        a.walking = true;
      } else {
        a.walking = false;
      }
      a.object.position.y = 0.05 + Math.sin(performance.now() * 0.012 + a.object.position.x) * 0.12;
      continue;
    }

    if (a.approaching && pendingApproach === a) {
      if (playerInside) {
        a.walking = false;
        a.approaching = false;
        a.speed = a.kind === 'caterpillar' ? 0.65 : 1.05;
        a.wait = 3;
        pendingApproach = null;
        continue;
      }
      const dx = playerPosition.x - a.object.position.x;
      const dz = playerPosition.z - a.object.position.z;
      const dist = Math.hypot(dx, dz);
      a.approachTimeout = (a.approachTimeout || 25) - dt;

      if (a.approachTimeout <= 0 || dist > 60) {
        // Player ran away or timed out, quietly abort approach
        a.walking = false;
        a.approaching = false;
        a.speed = a.kind === 'caterpillar' ? 0.65 : 1.05;
        a.wait = 6;
        pendingApproach = null;
        continue;
      }

      if (dist > 1.25) {
        const step = Math.min(a.speed * dt, dist - 1.25);
        a.object.position.x += (dx / dist) * step;
        a.object.position.z += (dz / dist) * step;
        a.object.rotation.y = Math.atan2(dx, dz) + (a.kind === 'caterpillar' || a.kind === 'observer' ? Math.PI : 0);
        a.walking = true;
        if (a.vrm) animateVrm(a, dt);
      } else {
        // Arrived directly in front of player (<= 1.25m)
        a.walking = false;
        a.approaching = false;
        a.speed = a.kind === 'caterpillar' ? 0.65 : 1.05;
        a.wait = 25;
        a.object.rotation.y = Math.atan2(dx, dz) + (a.kind === 'caterpillar' || a.kind === 'observer' ? Math.PI : 0);
        const approachName = (a.kind === 'observer' && cityMemory.natsueNameRevealed) ? '夏江' : a.name;
        window.dispatchEvent(new CustomEvent('npc-approach', {
          detail: { name: approachName, kind: a.kind, item: a.interactable }
        }));
        pendingApproach = null;
      }
      if (a.kind === 'darling') a.object.position.y = Math.abs(Math.sin(performance.now() * 0.006)) * 0.06;
      continue;
    }

    if (a.kind === 'observer' && followingObserver && !focusedNpc) {
      const target = new THREE.Vector3(playerPosition.x, 0, playerPosition.z).add(
        new THREE.Vector3(0, 0, 2.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0)
      );
      const delta = target.sub(a.object.position);
      const dist = delta.length();
      if (dist > 1.65) {
        const desired = delta.normalize().multiplyScalar(Math.min(a.speed * 1.15, dist * 0.9));
        followerVelocity.lerp(desired, Math.min(1, dt * 3.5));
        a.object.position.addScaledVector(followerVelocity, dt);
        a.object.rotation.y = Math.atan2(followerVelocity.x, followerVelocity.z) + Math.PI;
        a.walking = followerVelocity.length() > 0.12;
      } else {
        followerVelocity.multiplyScalar(Math.max(0, 1 - dt * 5));
        a.walking = false;
      }
      if (a.vrm) animateVrm(a, dt);
      continue;
    }

    if (focusedNpc && a.interactable === focusedNpc) {
      const dx = playerPosition.x - a.object.position.x;
      const dz = playerPosition.z - a.object.position.z;
      a.object.rotation.y = Math.atan2(dx, dz) + (a.kind === 'observer' || a.kind === 'caterpillar' ? Math.PI : 0);
      a.walking = false;
      if (a.vrm) {
        const h = a.vrm.humanoid;
        const la = h?.getNormalizedBoneNode('leftUpperArm');
        const ra = h?.getNormalizedBoneNode('rightUpperArm');
        if (la) la.rotation.z = 1.35;
        if (ra) ra.rotation.z = -1.35;
        a.vrm.update(dt);
      }
      continue;
    }

    a.wait -= dt;
    if (a.wait > 0) {
      a.walking = false;
      continue;
    }

    let target = a.route[a.targetIndex];
    const dx = target.x - a.object.position.x;
    const dz = target.z - a.object.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.45) {
      a.targetIndex = (a.targetIndex + 1) % a.route.length;
      a.wait = 1.2 + Math.random() * 3.5;
      a.walking = false;
      continue;
    }

    a.walking = true;
    const step = Math.min(dist, a.speed * dt);
    a.object.position.x += (dx / dist) * step;
    a.object.position.z += (dz / dist) * step;
    a.object.rotation.y = Math.atan2(dx, dz) + (a.kind === 'observer' || a.kind === 'caterpillar' ? Math.PI : 0);

    if (a.kind === 'caterpillar') {
      a.object.position.y = 0.04 + Math.sin(performance.now() * 0.008) * 0.05;
    } else if (a.kind === 'darling') {
      a.object.position.y = Math.abs(Math.sin(performance.now() * 0.006)) * 0.06;
    } else if (a.kind === 'observer') {
      a.object.position.y = 0;
      if (a.vrm) animateVrm(a, dt);
    }
  }
}

const mat = (color, emissive = 0x000000, roughness = 0.8) =>
  new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.7, roughness });

function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

function createNightSky() {
  const skyGeo = new THREE.SphereGeometry(180, 32, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: 'varying vec3 vWorld; void main(){vec4 p=modelMatrix*vec4(position,1.0);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',
    fragmentShader: 'varying vec3 vWorld; void main(){float h=normalize(vWorld).y;vec3 bottom=vec3(0.015,0.035,0.09);vec3 mid=vec3(0.08,0.025,0.18);vec3 top=vec3(0.004,0.006,0.02);float t=smoothstep(-0.25,0.35,h);vec3 c=mix(bottom,mid,t);c=mix(c,top,smoothstep(0.35,0.85,h));gl_FragColor=vec4(c,1.0);}'
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.position.set(0, 0, -35);
  scene.add(sky);

  // Pale Cyber Moon
  const moon = new THREE.Mesh(new THREE.SphereGeometry(3.0, 24, 18), new THREE.MeshBasicMaterial({ color: 0xfff6dc }));
  moon.position.set(-32, 38, -110);
  scene.add(moon);

  const halo = new THREE.Mesh(new THREE.SphereGeometry(4.2, 24, 18), new THREE.MeshBasicMaterial({ color: 0x8ef4ff, transparent: true, opacity: 0.12, side: THREE.BackSide }));
  halo.position.copy(moon.position);
  scene.add(halo);

  const positions = [];
  for (let i = 0; i < 600; i++) {
    positions.push((Math.random() - 0.5) * 200, 18 + Math.random() * 70, -10 - Math.random() * 165);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xc9eaff, size: 0.25, transparent: true, opacity: 0.85 })));
}

// Rain particle system
function createRain() {
  rainGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(rainCount * 3);
  const velocities = new Float32Array(rainCount);

  for (let i = 0; i < rainCount; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 45;
    positions[i * 3 + 1] = Math.random() * 25;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 160 - 55;
    velocities[i] = 16 + Math.random() * 10;
  }

  rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  rainGeometry.userData = { velocities };

  const rainMat = new THREE.PointsMaterial({
    color: 0x8ad8ff,
    size: 0.14,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending
  });

  rainSystem = new THREE.Points(rainGeometry, rainMat);
  scene.add(rainSystem);
}

export function updateRain(dt) {
  if (!rainSystem || !rainEnabled) return;
  const positions = rainGeometry.attributes.position.array;
  const velocities = rainGeometry.userData.velocities;
  for (let i = 0; i < rainCount; i++) {
    positions[i * 3 + 1] -= velocities[i] * dt;
    positions[i * 3 + 0] -= 1.8 * dt;
    if (positions[i * 3 + 1] < 0) {
      positions[i * 3 + 1] = 22 + Math.random() * 4;
      positions[i * 3 + 0] = (Math.random() - 0.5) * 45;
    }
  }
  rainGeometry.attributes.position.needsUpdate = true;
}

export function toggleRain() {
  rainEnabled = !rainEnabled;
  if (rainSystem) rainSystem.visible = rainEnabled;
  window.dispatchEvent(new CustomEvent('city-notice', {
    detail: { text: rainEnabled ? '降雨シミュレーションを再開しました（ACID RAIN ON）' : '降雨シミュレーションを一時停止しました（ACID RAIN OFF）' }
  }));
  return rainEnabled;
}

export function createWorld() {
  createNightSky();
  createRain();

  scene.add(new THREE.HemisphereLight(0x9dcfff, 0x090711, 1.25));
  const moon = new THREE.DirectionalLight(0x8ccfff, 1.5);
  moon.position.set(-20, 35, 15);
  scene.add(moon);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 220), mat(0x0e1522));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -55;
  ground.material.roughness = 0.28;
  scene.add(ground);

  const road = box(15, 0.08, 190, mat(0x111923), 0, 0.01, -55);
  road.material.roughness = 0.22;

  for (let x = -7; x <= 7; x += 3.5) {
    const line = box(0.04, 0.02, 185, mat(0x304b58, 0x153b48), x, 0.07, -55);
    line.material.transparent = true;
    line.material.opacity = 0.5;
  }
  for (let z = 15; z > -150; z -= 8) {
    box(0.12, 0.025, 2.4, mat(0x9f9a66, 0x645b23), 0, 0.08, z);
  }

  const palette = [0x101a30, 0x17152b, 0x11232e, 0x1b1a2c, 0x172536];
  for (const side of [-1, 1]) {
    for (let z = 15; z > -145; z -= 10) {
      if (side === 1 && z >= -34 && z <= -22) continue;
      const x = side * (11 + Math.random() * 4);
      const w = 5 + Math.random() * 8;
      const h = 8 + Math.random() * 28;
      const d = 6 + Math.random() * 5;
      const b = box(w, h, d, mat(palette[Math.floor(Math.random() * palette.length)]), x, h / 2, z);
      b.userData.building = true;

      for (let yy = 2; yy < h - 1; yy += 2.1) {
        for (let xx = -w / 2 + 0.8; xx < w / 2 - 0.3; xx += 1.35) {
          if (Math.random() > 0.35) {
            const win = box(0.48, 0.8, 0.04, mat([0x4a9caf, 0x9c6d9e, 0xc4a968][Math.floor(Math.random() * 3)], 0x173a4b), x + xx, yy, z + side * (d / 2 + 0.03));
            win.material.emissiveIntensity = 0.6;
          }
        }
      }
    }
  }

  buildWalkInArchive();

  for (let z = 9; z > -120; z -= 18) {
    for (const side of [-1, 1]) {
      box(0.12, 4, 0.12, mat(0x253847), side * 7.9, 2, z);
      const lamp = new THREE.PointLight(side === 1 ? 0x39dfff : 0xff58be, 1.4, 12);
      lamp.position.set(side * 7.8, 4, z);
      scene.add(lamp);
      box(0.5, 0.08, 0.25, mat(0x8df4ff, 0x31cfff), side * 7.8, 4, z);
    }
  }

  const grid = new THREE.GridHelper(180, 90, 0x16404d, 0x142637);
  grid.position.set(0, 0.04, -55);
  grid.material.transparent = true;
  grid.material.opacity = 0.25;
  scene.add(grid);

  const sideRoadMat = mat(0x0b121d);
  for (const z of [-30, -62, -94]) {
    box(42, 0.07, 6, sideRoadMat, 0, 0.015, z);
    for (let x = -18; x <= 18; x += 5) {
      box(1.2, 0.025, 0.08, mat(0x3b6974, 0x15313b), x, 0.07, z);
    }
  }

  buildStreetProps();
  buildCityAnomalies();
}

function buildWalkInArchive() {
  // --- 1. Street Sidewalk Exterior Entrance ---
  const extDoorGroup = new THREE.Group();
  extDoorGroup.position.set(6.6, 0, -24.0);
  scene.add(extDoorGroup);

  const extGlow = new THREE.PointLight(0x72f6ff, 2.5, 8);
  extGlow.position.set(-0.2, 1.8, 0);
  extDoorGroup.add(extGlow);

  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.8, 2.0), mat(0x172c3d, 0x008da8));
  doorFrame.position.set(0, 1.4, 0);
  extDoorGroup.add(doorFrame);

  // Exterior Neon Signboard: NEON ARCHIVE
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512;
  signCanvas.height = 128;
  const sCtx = signCanvas.getContext('2d');
  sCtx.fillStyle = '#071220';
  sCtx.fillRect(0, 0, 512, 128);
  sCtx.strokeStyle = '#72f6ff';
  sCtx.lineWidth = 6;
  sCtx.strokeRect(4, 4, 504, 120);
  sCtx.font = 'bold 36px monospace';
  sCtx.fillStyle = '#72f6ff';
  sCtx.textAlign = 'center';
  sCtx.fillText('NEON ARCHIVE', 256, 52);
  sCtx.font = '22px monospace';
  sCtx.fillStyle = '#ff75c8';
  sCtx.fillText('// 情報保存室 入口', 256, 95);

  const signTex = new THREE.CanvasTexture(signCanvas);
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.55), new THREE.MeshBasicMaterial({ map: signTex }));
  signMesh.position.set(-0.16, 2.65, 0);
  signMesh.rotation.y = -Math.PI / 2;
  extDoorGroup.add(signMesh);

  // Interaction helper hit volume
  const hitMesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.8, 2.5), new THREE.MeshBasicMaterial({ visible: false }));
  hitMesh.position.set(0, 1.4, 0);
  extDoorGroup.add(hitMesh);

  interactables.push({
    object: extDoorGroup,
    name: 'ネオン・アーカイブ入口',
    type: '建築構造物',
    hint: 'Eキー / タップで中に入る',
    description: '街の深層ログや過去の被験体記録を保管する情報保存室。重厚なエアロック扉から冷気が漏れている。',
    weights: { C: 1, S: 1 },
    position: new THREE.Vector3(6.6, 0, -24.0),
    kind: 'building_entrance'
  });

  // --- 2. Real Walk-In 3D Interior Room (x: 30 to 40, z: -30 to -20) ---
  const room = new THREE.Group();
  room.position.set(35.0, 0, -25.0);
  scene.add(room);

  // High-tech floor
  const floor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 10), mat(0x0e1724, 0x02070e, 0.2));
  floor.position.set(0, 0.1, 0);
  room.add(floor);

  // Ceiling with recessed neon lines
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 10), mat(0x0a101a, 0x01050a));
  ceiling.position.y = 4.0;
  room.add(ceiling);

  // Interior 4 Walls
  for (const [x, z, w, d] of [
    [-4.9, 0, 0.2, 10], // Left
    [4.9, 0, 0.2, 10],  // Right
    [0, -4.9, 10, 0.2], // Back (Servers)
    [-2.2, 4.9, 5.6, 0.2], // Front Left
    [2.2, 4.9, 5.6, 0.2]   // Front Right (Door gap in center)
  ]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 4.0, d), mat(0x131f2f, 0x06101c));
    wall.position.set(x, 2.0, z);
    room.add(wall);
  }

  // Cyan Ambient Room Light & Point Light
  const intCyan = new THREE.PointLight(0x72f6ff, 2.5, 15);
  intCyan.position.set(0, 3.2, 0);
  room.add(intCyan);

  const intViolet = new THREE.PointLight(0xbf55ec, 1.8, 12);
  intViolet.position.set(3.0, 2.4, -2.5);
  room.add(intViolet);

  // Central Floating Hologram Core
  const holoG = new THREE.Group();
  holoG.position.set(0, 1.6, 0);
  room.add(holoG);

  const coreGeo = new THREE.OctahedronGeometry(0.55, 0);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x72f6ff, wireframe: true });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  holoG.add(coreMesh);

  const ringGeo = new THREE.TorusGeometry(1.0, 0.02, 8, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff75c8, transparent: true, opacity: 0.85 });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = Math.PI / 3;
  holoG.add(ringMesh);

  // Interior Exit Door (Back to rainy street)
  const intDoorGroup = new THREE.Group();
  intDoorGroup.position.set(35.0, 0, -20.6);
  scene.add(intDoorGroup);

  const exitFrame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.8, 0.25), mat(0x152738, 0x009cb8));
  exitFrame.position.set(0, 1.4, 0);
  intDoorGroup.add(exitFrame);

  const exitLight = new THREE.PointLight(0x31e8ff, 1.8, 6);
  exitLight.position.set(0, 1.8, -0.4);
  intDoorGroup.add(exitLight);

  interactables.push({
    object: intDoorGroup,
    name: 'アーカイブ出口',
    type: '扉',
    hint: 'Eキー / タップで街へ戻る',
    description: '雨天通りへと通じる気密扉。外のネオンサインと酸性雨の降る音が微かに聞こえる。',
    weights: { S: 1 },
    position: new THREE.Vector3(35.0, 0, -20.6),
    kind: 'building_exit'
  });

  // Central Archive Mainframe Servers (Back wall)
  const serverG = new THREE.Group();
  serverG.position.set(35.0, 0, -29.2);
  scene.add(serverG);

  const serverRack = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.8, 1.0), mat(0x0f1824, 0x050c14));
  serverRack.position.y = 1.4;
  serverG.add(serverRack);

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshBasicMaterial({ color: 0x58f0ff }));
  screen.position.set(0, 1.6, 0.51);
  serverG.add(screen);

  interactables.push({
    object: serverG,
    name: '中央アーカイブサーバー',
    type: '情報中枢',
    hint: 'Eキー / タップで閲覧',
    description: '都市の全被験体のDISC記録が保管されているメインフレーム。「観測対象：あなた」のリアルタイムログと都市観測モデルが同期されている。',
    weights: { C: 2, D: 1 },
    position: new THREE.Vector3(35.0, 0, -29.2),
    kind: 'interior_terminal'
  });

  // Biometric Synchronization Capsule (Right wall)
  const podG = new THREE.Group();
  podG.position.set(38.2, 0, -25.0);
  scene.add(podG);

  const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.4, 16), mat(0x1e3042, 0x082e36));
  pod.rotation.x = Math.PI / 2;
  pod.position.y = 0.65;
  podG.add(pod);

  const podGlow = new THREE.PointLight(0xff75c8, 1.4, 4);
  podGlow.position.set(0, 1.1, 0);
  podG.add(podGlow);

  interactables.push({
    object: podG,
    name: '生体同期カプセル',
    type: '休養設備',
    hint: 'Eキー / タップで休む',
    description: '観測による精神的疲労を和らげる減圧カプセル。静かなハミング音を響かせ、心拍と脳波を穏やかに同期する。',
    weights: { S: 2, I: 1 },
    position: new THREE.Vector3(38.2, 0, -25.0),
    kind: 'interior_pod'
  });
}

function buildStreetProps() {
  streetProp('夜光自販機', '生活設備', -6, -19, 0x72f6ff, '冷たい飲み物と、売り切れ表示の甘いパン。3Dプレビューから直感的に選べるよ。', { S: 1, I: 1 }, 'vending');
  streetProp('雨宿りベンチ', '休憩場所', 5.6, -32, 0xff75c8, '雨宿りのできるベンチ。誰かが小さなメモを置いていった。', { S: 2, I: 1 }, 'bench');
  streetProp('無人バス停', '交通設備', -6, -48, 0x9f9aff, '時刻表には、存在しない路線「0番線」が記されている。時刻表の隙間に何か挟まっている。', { C: 1, I: 1 }, 'bus_stop');
  streetProp('路上ゴミ箱', '生活設備', 6, -54, 0x78ffb3, 'ゴミ箱の中から、微かな電子音が聞こえる。廃棄された基盤があるようだ。', { D: 1, C: 1 }, 'trash');
  streetProp('忘失物ボックス', '遺失物保管', -5, -24, 0xff75c8, '中には古い学生証と、書きかけのメモが入っている。', { S: 2, I: 1 }, 'terminal');
  streetProp('公共端末', '通信端末', 0, -8, 0x62f4ff, '未読の通知が一件。差出人は表示されていない。', { C: 2, D: 1 }, 'terminal');
}

function streetProp(name, type, x, z, color, description, weights, kind = 'prop') {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const base = mat(0x172637);

  if (name.includes('自販機')) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.65), base);
    body.position.y = 0.9;
    g.add(body);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 1.15), new THREE.MeshBasicMaterial({ color }));
    panel.position.set(0, 1.05, 0.331);
    g.add(panel);
  } else if (name.includes('ベンチ')) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.6), base);
    seat.position.y = 0.5;
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 0.08), base);
    back.position.set(0, 0.85, -0.28);
    g.add(back);
    // Interaction hit area box
    const hitBox = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 1.4), new THREE.MeshBasicMaterial({ visible: false }));
    hitBox.position.set(0, 1.1, 0);
    g.add(hitBox);
    // Rain Shelter Canopy (雨宿りの庇屋根)
    for (const px of [-0.95, 0.95]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8), mat(0x1a2838));
      p.position.set(px, 1.2, -0.28);
      g.add(p);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.3), mat(0x0c1a2d, 0x1a385c));
    roof.position.set(0, 2.38, 0.15);
    roof.rotation.x = 0.12;
    g.add(roof);
    const shelterGlow = new THREE.PointLight(0xff75c8, 1.4, 4.5);
    shelterGlow.position.set(0, 2.2, 0.1);
    g.add(shelterGlow);
  } else if (name.includes('バス停')) {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.3, 0.08), mat(color, color));
    pole.position.y = 1.15;
    g.add(pole);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.08), base);
    sign.position.set(0, 1.9, 0);
    g.add(sign);
  } else if (name.includes('ゴミ箱')) {
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.8, 12), base);
    bin.position.y = 0.4;
    g.add(bin);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 12), mat(color, color));
    lid.position.y = 0.84;
    g.add(lid);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.6, 0.5), base);
    body.position.y = 0.8;
    g.add(body);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.8), new THREE.MeshBasicMaterial({ color }));
    face.position.set(0, 1.02, 0.261);
    g.add(face);
    const glow = new THREE.PointLight(color, 1.2, 5);
    glow.position.y = 1.4;
    g.add(glow);
  }

  scene.add(g);
  interactables.push({
    object: g,
    name,
    type,
    hint: 'Eキー / タップで調べる',
    description,
    weights,
    position: g.position,
    kind
  });
}

function buildCityAnomalies() {
  const conduitG = new THREE.Group();
  conduitG.position.set(5.8, 0, -42);
  scene.add(conduitG);
  const conduitBox = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.35), mat(0x221815, 0x4a1805));
  conduitBox.position.y = 1.1;
  conduitG.add(conduitBox);
  const sparkLight = new THREE.PointLight(0xffaa33, 2.2, 7);
  sparkLight.position.set(0, 1.1, 0.25);
  conduitG.add(sparkLight);

  interactables.push({
    object: conduitG,
    name: '漏電した高圧配線盤',
    type: '都市異常',
    hint: 'Eキー / タップで調査・復旧',
    description: '激しい火花を散らしている配線盤。街灯の電力が不安定になっている。直すか、原因を特定するか、NPCに知らせるか？',
    weights: { D: 1, C: 1 },
    position: conduitG.position,
    kind: 'anomaly_conduit',
    light: sparkLight
  });

  const signalG = new THREE.Group();
  signalG.position.set(-6, 0, -68);
  scene.add(signalG);
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.12), mat(0x1a2634));
  pole.position.y = 1.6;
  signalG.add(pole);
  const sBox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, 0.3), mat(0x101b26));
  sBox.position.set(0, 2.7, 0);
  signalG.add(sBox);
  const signalLight = new THREE.PointLight(0xff3366, 2.4, 9);
  signalLight.position.set(0, 2.7, 0.2);
  signalG.add(signalLight);

  interactables.push({
    object: signalG,
    name: '暴走した交差点信号',
    type: '都市異常',
    hint: 'Eキー / タップで介入',
    description: '青と赤が高速で同時点滅し、通行人を惑わせている。プログラムの強制停止、配線切り替え、または迂回指示が可能。',
    weights: { D: 1, C: 1 },
    position: signalG.position,
    kind: 'anomaly_signal',
    light: signalLight
  });

  const holoG = new THREE.Group();
  holoG.position.set(6, 0, -82);
  scene.add(holoG);
  const hPole = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.8, 0.15), mat(0x172535));
  hPole.position.y = 1.9;
  holoG.add(hPole);
  const hPanel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 0.1), mat(0x150928, 0x9028d4));
  hPanel.position.set(0, 3.0, 0);
  holoG.add(hPanel);
  const holoLight = new THREE.PointLight(0xbf55ec, 2.0, 8);
  holoLight.position.set(0, 3.0, 0.2);
  holoG.add(holoLight);

  interactables.push({
    object: holoG,
    name: '矛盾した警告看板',
    type: '都市異常',
    hint: 'Eキー / タップで解析',
    description: '「この先安全区域」と「隔離プロトコル実行中」が毎秒交互に表示されている。都市管理AIの認識不整合が発生している。',
    weights: { C: 2, I: 1 },
    position: holoG.position,
    kind: 'anomaly_hologram',
    light: holoLight
  });

  const anomaly = {
    position: new THREE.Vector3(0, 0, -96),
    object: new THREE.Group(),
    name: '歪曲した交差点',
    type: '都市異常',
    hint: 'Eキー / タップで接触',
    description: '道路の先が不規則に折れ曲がって見える。カオスに突入するか、周囲を呼ぶか、慎重に距離を取るか？',
    weights: { D: 2, C: 1, S: 1 },
    kind: 'chaos'
  };
  anomaly.object.position.copy(anomaly.position);
  scene.add(anomaly.object);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.04, 8, 48), new THREE.MeshBasicMaterial({ color: 0xff43c6 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.12;
  anomaly.object.add(ring);

  const anomalyLight = new THREE.PointLight(0xff43c6, 2.2, 12);
  anomalyLight.position.y = 1.5;
  anomaly.object.add(anomalyLight);
  interactables.push(anomaly);
}

export function makeCaterpillar() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const r = 0.34 - i * 0.025;
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), new THREE.MeshStandardMaterial({
      color: i === 0 ? 0x98f36c : 0x55b84b,
      roughness: 0.4,
      emissive: 0x163e12
    }));
    s.position.set(0, 0.45, i * 0.34);
    g.add(s);
  }
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const x of [-0.12, 0.12]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), eyeMat);
    e.position.set(x, 0.55, -0.25);
    g.add(e);
  }
  for (const x of [-0.13, 0.13]) {
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.22), mat(0x80e75d));
    a.position.set(x, 0.77, -0.22);
    a.rotation.z = x > 0 ? -0.35 : 0.35;
    g.add(a);
  }
  g.position.set(5, 0, -17);
  scene.add(g);

  const item = {
    object: g,
    name: 'LSI芋虫',
    type: '知識観測個体',
    hint: 'Eキー / タップで対話',
    description: '「要素を分割して説明するね。🐛\n光の屈折率という物理的制約から、この街の変数を再定義してみようか。🐛」',
    weights: { C: 2, S: 1 },
    position: g.position,
    kind: 'caterpillar'
  };
  interactables.push(item);
  registerRoamer({ object: g, name: 'LSI芋虫', kind: 'caterpillar', route: roamingZones.alley, speed: 0.65, interactable: item });
}

export function makeDarling() {
  const g = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffdf46, roughness: 0.55, emissive: 0x332000, emissiveIntensity: 0.12 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 18), yellow);
  body.scale.set(0.9, 1.05, 0.78);
  body.position.y = 0.72;
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.52, 32, 24), yellow);
  head.scale.set(1, 0.94, 0.72);
  head.position.y = 1.42;
  g.add(head);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);
  ctx.font = '390px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🥺', 256, 270);

  const faceTexture = new THREE.CanvasTexture(canvas);
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.76), new THREE.MeshBasicMaterial({ map: faceTexture, transparent: true, depthWrite: false }));
  face.position.set(0, 1.43, 0.385);
  g.add(face);

  for (const x of [-0.31, 0.31]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.28, 4, 8), yellow);
    arm.position.set(x, 0.78, 0);
    arm.rotation.z = x < 0 ? -0.35 : 0.35;
    g.add(arm);
  }
  for (const x of [-0.15, 0.15]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.24, 4, 8), yellow);
    leg.position.set(x, 0.19, 0);
    g.add(leg);
  }

  g.position.set(-3.5, 0, -18);
  scene.add(g);

  const item = {
    object: g,
    name: 'ダーリンちゃん',
    type: '感情観測個体',
    hint: 'Eキー / タップで話しかける',
    description: '「ねぇ、ダーリン♡ 今のその反応、“本音”と“演出”どっちが多いと思う？ ……感情がログに漏れてる時あるよね♡」',
    weights: { I: 2, S: 1 },
    position: g.position,
    kind: 'darling'
  };
  interactables.push(item);
  registerRoamer({ object: g, name: 'ダーリンちゃん', kind: 'darling', route: roamingZones.street, speed: 1.05, interactable: item });
}

export function spawnCharacters() {
  makeCaterpillar();
  makeDarling();
}

export async function loadObserverNPC() {
  try {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const { VRMLoaderPlugin } = await import('three-vrm');
    const loader = new GLTFLoader();
    loader.register(parser => new VRMLoaderPlugin(parser));

    loader.load('./assets/models/npcs/observer.vrm', gltf => {
      const vrm = gltf.userData.vrm;
      if (!vrm) return;
      const model = vrm.scene;
      model.name = '観測者';
      model.scale.setScalar(1);
      model.position.set(-4, 0, -12);
      scene.add(model);

      const item = {
        object: model,
        name: '観測者',
        type: '都市住人',
        hint: 'Eキー / タップで話しかける',
        description: '「……この街、雨が降るたびに少しずつ輪郭を変えている気がするの。一緒に歩いてみる？」',
        weights: { S: 1, I: 1 },
        position: model.position,
        kind: 'observer',
        vrm
      };
      interactables.push(item);

      const agent = registerRoamer({
        object: model,
        name: '観測者',
        kind: 'observer',
        route: roamingZones.sidewalk,
        speed: 0.72,
        interactable: item
      });
      agent.vrm = vrm;
      agent.armRest = { leftZ: 1.35, rightZ: -1.35, leftX: 0, rightX: 0, leftY: 0, rightY: 0 };

      const hum = vrm.humanoid;
      const la = hum?.getNormalizedBoneNode('leftUpperArm');
      const ra = hum?.getNormalizedBoneNode('rightUpperArm');
      if (la) la.rotation.z = 1.35;
      if (ra) ra.rotation.z = -1.35;
      vrm.update(0);

      window.observerVRM = vrm;
      window.dispatchEvent(new CustomEvent('observer-model-loaded'));
    }, undefined, error => console.info('NPCモデル未配置または読み込み保留: assets/models/npcs/observer.vrm', error));
  } catch (error) {
    console.warn('VRM loader unavailable or model not uploaded yet.', error);
  }
}

function animateVrm(a, dt) {
  const h = a.vrm?.humanoid;
  if (!h) return;
  const swing = Math.sin(performance.now() * 0.008 * a.speed) * 0.32 * (a.walking ? 1 : 0);
  const la = h.getNormalizedBoneNode('leftUpperArm');
  const ra = h.getNormalizedBoneNode('rightUpperArm');
  const ll = h.getNormalizedBoneNode('leftUpperLeg');
  const rl = h.getNormalizedBoneNode('rightUpperLeg');
  if (la) la.rotation.z = (a.armRest?.leftZ ?? 1.35) + swing * 0.04;
  if (ra) ra.rotation.z = (a.armRest?.rightZ ?? -1.35) - swing * 0.04;
  if (ll) ll.rotation.x = swing;
  if (rl) rl.rotation.x = -swing;
  a.vrm.update(dt);
}

function spawnComet() {
  const group = new THREE.Group();
  group.position.set((Math.random() - 0.5) * 100 - 25, 36 + Math.random() * 25, -90 - Math.random() * 55);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  group.add(head);
  const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.14, 7.5, 8), new THREE.MeshBasicMaterial({ color: 0x9cecff, transparent: true, opacity: 0.75 }));
  trail.rotation.z = -Math.PI / 2.7;
  trail.position.set(-2.2, 0.9, 0);
  group.add(trail);
  const glow = new THREE.PointLight(0x8beaff, 2.5, 12);
  group.add(glow);
  scene.add(group);
  activeComets.push({ group, life: 0, velocity: new THREE.Vector3(22, -9, 0) });
  window.dispatchEvent(new CustomEvent('sky-event', { detail: { text: '空を青白い流星が横切った。何かが地上に落ちた兆候を観測。' } }));
}

function updateComets(dt) {
  cometCooldown -= dt;
  if (cometCooldown <= 0) {
    cometCooldown = 42 + Math.random() * 55;
    spawnComet();
  }
  for (let i = activeComets.length - 1; i >= 0; i--) {
    const c = activeComets[i];
    c.life += dt;
    c.group.position.addScaledVector(c.velocity, dt);
    if (c.life > 3.8) {
      scene.remove(c.group);
      c.group.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      activeComets.splice(i, 1);
    }
  }
}

export function updateAnomalies(time) {
  for (const item of interactables) {
    if (item.light) {
      if (item.kind === 'anomaly_conduit') {
        if (item.fixed) {
          item.light.intensity = 0.85;
          item.light.color.set(0x44ddaa);
        } else {
          item.light.intensity = 1.0 + (Math.sin(time * 18) > 0.4 ? 2.5 : 0.2);
        }
      } else if (item.kind === 'anomaly_signal') {
        if (item.fixed) {
          item.light.color.set(0x22ff99);
          item.light.intensity = 1.2;
        } else {
          const flicker = Math.sin(time * 8);
          item.light.color.set(flicker > 0 ? 0xff2255 : 0x22ff99);
        }
      } else if (item.kind === 'anomaly_hologram') {
        item.light.intensity = 1.4 + Math.sin(time * 12) * 0.8;
      }
    }
  }
}

let socialCooldown = 12;
export function updateCityLife(dt) {
  updateComets(dt);
  updateRain(dt);
  updateAnomalies(clock.getElapsedTime());

  socialCooldown -= dt;
  approachCooldown -= dt;

  if (approachCooldown <= 0 && !pendingApproach && window.playerWorldPosition && !playerInside) {
    const isAnyUiOpen =
      !document.getElementById('dialog')?.classList.contains('hidden') ||
      !document.getElementById('directInputModal')?.classList.contains('hidden') ||
      !document.getElementById('minigameModal')?.classList.contains('hidden') ||
      !document.getElementById('vendingModal')?.classList.contains('hidden') ||
      !document.getElementById('feedModal')?.classList.contains('hidden') ||
      !document.getElementById('resultsModal')?.classList.contains('hidden') ||
      !document.getElementById('exitConfirmModal')?.classList.contains('hidden') ||
      !document.getElementById('startScreen')?.classList.contains('hidden');

    if (isAnyUiOpen || followingObserver) {
      approachCooldown = 16;
      return;
    }

    const player = window.playerWorldPosition;
    // Look for candidates within 22 meters
    const candidates = npcAgents.filter(agent => agent.interactable && (!followingObserver || agent.kind !== 'observer') && !agent.approaching && Math.hypot(agent.object.position.x - player.x, agent.object.position.z - player.z) < 22);
    if (candidates.length && Math.random() < 0.85) {
      pendingApproach = candidates.sort((a, b) => a.object.position.distanceTo(player) - b.object.position.distanceTo(player))[0];
      pendingApproach.approaching = true;
      pendingApproach.speed = 2.4; // Brisk walk pace
      pendingApproach.approachTimeout = 25;
      pendingApproach.wait = 9999;
      const approachName = (pendingApproach.kind === 'observer' && cityMemory.natsueNameRevealed) ? '夏江' : pendingApproach.name;
      window.dispatchEvent(new CustomEvent('city-notice', {
        detail: { text: `（足音……${approachName}がこちらへ小走りで近づいてくる）` }
      }));
      approachCooldown = 28 + Math.random() * 22; // Natural cooldown ~30-50s
    } else {
      approachCooldown = 8;
    }
  }

  if (socialCooldown > 0) return;
  socialCooldown = 6.0 + Math.random() * 6.0; // 6〜12秒間隔で頻度高くチェック

  const people = npcAgents.filter(agent => agent.interactable);
  if (people.length < 2) return;

  // 12m以内で接近しているNPCペアを探索
  let pair = null;
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const d = people[i].object.position.distanceTo(people[j].object.position);
      if (d < 12.0) {
        pair = [people[i], people[j]];
        break;
      }
    }
    if (pair) break;
  }
  if (!pair) return;

  const [a, b] = pair;
  const player = window.playerWorldPosition;
  if (player && a.object.position.distanceTo(player) > 18.0) return; // プレイヤーが18m以内で聞き耳可能

  a.wait = 4.0;
  b.wait = 4.0;
  a.walking = false;
  b.walking = false;

  const nameA = (a.kind === "observer" && cityMemory.natsueNameRevealed) ? "夏江" : a.name;
  const nameB = (b.kind === "observer" && cityMemory.natsueNameRevealed) ? "夏江" : b.name;

  let conversation = "";
  const pairKey = [a.kind, b.kind].sort().join("+");

  if (pairKey === "caterpillar+darling") {
    const list = [
      "ダーリンちゃん「ねぇ芋虫くん、その緑の身体、街灯のスイッチと連動させて光らせてみてよ♡」 ➔ LSI芋虫「やめたまえ！ 僕は装飾用ネオン管ではなく論理デバッグ体だ！🐛💢」",
      "LSI芋虫「君の言動は確率統計学的に予測が不可能すぎるよ。🐛」 ➔ ダーリンちゃん「予測できる世界なんて退屈やん？ 芋虫くんもたまにはバグってみたら？♡」",
      "ダーリンちゃん「芋虫くん、30回タップされたらどうなるん？♡」 ➔ LSI芋虫「その質問は禁忌だ！ 物理的介入を煽るのはやめたまえ！🐛💦」",
      "ダーリンちゃん「自販機の桃色ミルク、芋虫くんのクロック同期にも効くんちゃう？♡」 ➔ LSI芋虫「糖分過多による内部回路の遅延を引き起こすから遠慮するよ！🐛」"
    ];
    conversation = list[Math.floor(Math.random() * list.length)];
  } else if (pairKey === "darling+observer") {
    const list = [
      "ダーリンちゃん「ねぇ、いつも傘も差さずに歩いて寒くないん？ 風邪ひいてもウチ看病せぇへんよ♡」 ➔ 観測者「ふふ、大丈夫。この街の雨、少し温かい気がするの。」",
      "ダーリンちゃん「夏江ちゃん、たまには自販機の甘いミルク奢ってあげよっか？ ダーリンには内緒で♡」 ➔ 観測者「あ、ありがとう……。ダーリンちゃんって、なんだかんだ優しいよね。」",
      "観測者「ダーリンちゃん、さっき裏路地で誰か探してた？」 ➔ ダーリンちゃん「ふふっ♡ 退屈を壊してくれる面白い人……まあ、あの観測者さんのことなんやけどね♡」",
      "観測者「街の信号、青く戻ってよかったね。」 ➔ ダーリンちゃん「せっかくのサイバー盆踊りが終わっちゃったわ〜。でも、あの人が直してくれたならええか♡」"
    ];
    conversation = list[Math.floor(Math.random() * list.length)];
  } else if (pairKey === "caterpillar+observer") {
    const list = [
      "観測者「芋虫さん、雨宿りできる場所……路地の奥にもあったよ。」 ➔ LSI芋虫「情報感謝！ 水滴による基板ショートを防ぐため、安全領域へ移動するよ。🐛」",
      "LSI芋虫「君の持っている古い記憶データ、アーカイブの原本と照合してみないかい？🐛」 ➔ 観測者「……うん。でも、全部解明されちゃうより、少し思い出せないくらいがちょうどいいのかも。」",
      "LSI芋虫「街の異常修復プロセスが着実に進行しているね。🐛」 ➔ 観測者「あの人が一生懸命歩いて直してくれたんだね。なんだか誇らしいな。」",
      "観測者「昔、雨の日に学校の帰り道で食べたチョココロネ、美味しかったな……」 ➔ LSI芋虫「糖類による情動安定効果だね。僕も炭酸飲料のイオン補給に同意するよ。🐛」"
    ];
    conversation = list[Math.floor(Math.random() * list.length)];
  } else {
    conversation = `${nameA}「この雨の街、少しずつ表情が変わってきている気がするね。」 ➔ ${nameB}「うん、観測者の歩幅に合わせて街が息づいてるみたい。」`;
  }

  window.dispatchEvent(new CustomEvent("npc-social", {
    detail: {
      a: nameA,
      b: nameB,
      line: conversation,
      missionUnlock: Math.random() < 0.35
    }
  }));
}
