import * as THREE from 'three';
import { record, recordMovement } from './analysis.js';

export function setupControls(camera, renderer) {
  const keys = {};
  const direction = new THREE.Vector3();
  let yaw = 0;
  let pitch = 0;
  let locked = false;
  let stick = { x: 0, y: 0 };
  let lookTouch = null;
  let isInside = false;

  const isMobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  if (isMobile) document.body.classList.add('mobile');

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // モーダル中も操作UI自体は消さない。会話終了の入力経路を失わないよう、
  // 表示位置・重なりはダイアログ側で制御する。
  const isTypingTarget = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

  const clearMoveKeys = () => {
    keys['KeyW'] = false;
    keys['KeyA'] = false;
    keys['KeyS'] = false;
    keys['KeyD'] = false;
    keys['ArrowUp'] = false;
    keys['ArrowDown'] = false;
    keys['ArrowLeft'] = false;
    keys['ArrowRight'] = false;
  };

  document.addEventListener('focusin', e => {
    if (isTypingTarget(e.target)) {
      clearMoveKeys();
    }
  });

  document.addEventListener('keydown', e => {
    if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) {
      clearMoveKeys();
      return;
    }
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.code === 'KeyE') window.dispatchEvent(new Event('interact-nearest'));
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      // 走行開始を1回だけ記録
      if (!keys.ShiftRecorded) {
        keys.ShiftRecorded = true;
        record('行動', 'ダッシュ走行に移行', { D: 1 });
      }
    }
  });

  document.addEventListener('keyup', e => {
    if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) {
      clearMoveKeys();
      return;
    }
    keys[e.code] = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      keys.ShiftRecorded = false;
    }
  });

  renderer.domElement.addEventListener('click', () => {
    const dialogOpen = !document.getElementById('dialog').classList.contains('hidden');
    const inputOpen = !document.getElementById('directInputModal')?.classList.contains('hidden');
    const minigameOpen = !document.getElementById('minigameModal')?.classList.contains('hidden');
    const vendingOpen = !document.getElementById('vendingModal')?.classList.contains('hidden');

    if (!isMobile && !locked && !dialogOpen && !inputOpen && !minigameOpen && !vendingOpen && document.pointerLockElement !== renderer.domElement) {
      renderer.domElement.requestPointerLock?.();
    }
  });

  document.addEventListener('pointerlockchange', () => (locked = document.pointerLockElement === renderer.domElement));

  document.addEventListener('mousemove', e => {
    if (!locked) return;
    yaw -= e.movementX * 0.0022;
    pitch = clamp(pitch - e.movementY * 0.0018, -1.35, 1.35);
  });

  // Mobile virtual joystick
  const stickEl = document.getElementById('stick');
  const knob = document.getElementById('stickKnob');
  if (stickEl) {
    stickEl.addEventListener('pointerdown', e => {
      stickEl.setPointerCapture(e.pointerId);
      moveStick(e);
    });
    stickEl.addEventListener('pointermove', e => {
      if (stickEl.hasPointerCapture(e.pointerId)) moveStick(e);
    });
    const end = () => {
      stick = { x: 0, y: 0 };
      knob.style.transform = 'translate(0px,0px)';
    };
    stickEl.addEventListener('pointerup', end);
    stickEl.addEventListener('pointercancel', end);
  }

  function moveStick(e) {
    const r = stickEl.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    const scale = Math.min(1, 42 / (len || 1));
    stick = { x: (dx * scale) / 42, y: (dy * scale) / 42 };
    knob.style.transform = `translate(${stick.x * 35}px,${stick.y * 35}px)`;
  }

  let touchStartPos = null;
  let touchStartTime = 0;

  renderer.domElement.addEventListener(
    'touchstart',
    e => {
      for (const t of e.changedTouches) {
        touchStartPos = { x: t.clientX, y: t.clientY };
        touchStartTime = Date.now();
        if (t.clientX > innerWidth * 0.45) lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
      }
    },
    { passive: true }
  );

  renderer.domElement.addEventListener(
    'touchmove',
    e => {
      if (!lookTouch) return;
      for (const t of e.changedTouches) {
        if (t.identifier === lookTouch.id) {
          yaw -= (t.clientX - lookTouch.x) * 0.006;
          pitch = clamp(pitch - (t.clientY - lookTouch.y) * 0.004, -1.35, 1.35);
          lookTouch.x = t.clientX;
          lookTouch.y = t.clientY;
        }
      }
    },
    { passive: true }
  );

  renderer.domElement.addEventListener(
    'touchend',
    e => {
      for (const t of e.changedTouches) {
        if (touchStartPos && Date.now() - touchStartTime < 350) {
          const moveDist = Math.hypot(t.clientX - touchStartPos.x, t.clientY - touchStartPos.y);
          if (moveDist < 14) {
            window.dispatchEvent(new CustomEvent('world-tap', {
              detail: { clientX: t.clientX, clientY: t.clientY }
            }));
          }
        }
        if (lookTouch && t.identifier === lookTouch.id) lookTouch = null;
      }
    },
    { passive: true }
  );

  document.getElementById('mobileAction')?.addEventListener('click', () => window.dispatchEvent(new Event('interact-nearest')));

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  let accumulatedWalk = 0;
  let accumulatedRun = 0;

  window.addEventListener('location-mode', e => {
    isInside = !!e.detail?.inside;
  });

  return {
    update(dt) {
      if (isTypingTarget(document.activeElement)) {
        clearMoveKeys();
        direction.set(0, 0, 0);
        return;
      }

      const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - stick.y;
      const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + stick.x;
      direction.set(s, 0, f);
      if (direction.lengthSq() > 1) direction.normalize();

      const running = !!(keys.ShiftLeft || keys.ShiftRight);
      const speed = running ? 8.5 : 4.5;
      forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      right.set(Math.cos(yaw), 0, -Math.sin(yaw));

      const dx = (right.x * direction.x + forward.x * direction.z) * speed * dt;
      const dz = (right.z * direction.x + forward.z * direction.z) * speed * dt;

      if (isInside) {
        camera.position.x = clamp(camera.position.x + dx, 31.0, 39.0);
        camera.position.z = clamp(camera.position.z + dz, -29.0, -21.0);
      } else {
        camera.position.x = clamp(camera.position.x + dx, -7.5, 7.5);
        camera.position.z = clamp(camera.position.z + dz, -135, 14);
      }

      camera.position.y = 1.65;
      camera.rotation.order = 'YXZ';
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;

      const dist = Math.hypot(dx, dz);
      const zone = isInside ? 'interior' : Math.abs(camera.position.x) > 4 ? 'alley' : 'mainStreet';
      recordMovement(dist, running, zone);

      // Sの過剰加算バグ修正：
      // 数歩ごとにSを加算するのを廃止し、まとまった距離を歩行・走行した時だけマイルストーンとして適正に加算
      if (dist > 0.01) {
        if (running) {
          accumulatedRun += dist;
          if (accumulatedRun >= 45) {
            record('行動', '都市を長距離ダッシュ（積極的直進）', { D: 1 });
            accumulatedRun = 0;
          }
        } else {
          accumulatedWalk += dist;
          if (accumulatedWalk >= 60) {
            record('行動', '都市を一定ペースで巡回（安定歩行）', { S: 1 });
            accumulatedWalk = 0;
          }
        }
      }
    },
    get yaw() {
      return yaw;
    },
    get locked() {
      return locked;
    },
    setYaw(val) {
      yaw = val;
    },
    isMobile
  };
}
