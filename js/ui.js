import * as THREE from 'three';
import { analysis, getSummary, record } from './analysis.js';
import { toggleRain } from './world.js';
import { cityMemory, getRelationshipStatus } from './memory.js';

export function setupUI(interactions) {
  const logButton = document.getElementById('logButton');
  const helpButton = document.getElementById('helpButton');
  const inventoryButton = document.getElementById('inventoryButton');
  const missionButton = document.getElementById('missionButton');
  const rainToggleButton = document.getElementById('rainToggleButton');
  const resetButton = document.getElementById('resetButton');

  logButton?.addEventListener('click', () => togglePanel('logPanel'));
  helpButton?.addEventListener('click', () => togglePanel('helpPanel'));
  inventoryButton?.addEventListener('click', () => togglePanel('inventoryPanel'));
  missionButton?.addEventListener('click', () => togglePanel('missionPanel'));

  const feedButton = document.getElementById('feedButton');
  feedButton?.addEventListener('click', () => {
    document.exitPointerLock?.();
    document.getElementById('feedModal')?.classList.remove('hidden');
  });
  document.getElementById('closeFeedModal')?.addEventListener('click', () => {
    document.getElementById('feedModal')?.classList.add('hidden');
  });

  setupNeonFeed(interactions);

  // Mobile Collapsible Menu Controls
  const mobileMenuToggleBtn = document.getElementById('mobileMenuToggleBtn');
  const closeMobileMenuBtn = document.getElementById('closeMobileMenuBtn');

  function toggleMobileMenu(forceOpen) {
    const willOpen = forceOpen !== undefined ? forceOpen : !document.body.classList.contains('mobile-menu-open');
    document.body.classList.toggle('mobile-menu-open', willOpen);
    if (mobileMenuToggleBtn) {
      mobileMenuToggleBtn.textContent = willOpen ? '✕ メニュー閉じる' : '☰ メニュー';
    }
  }

  mobileMenuToggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMobileMenu();
  });

  closeMobileMenuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMobileMenu(false);
  });

  document.querySelectorAll('.hud-right .hud-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (document.body.classList.contains('mobile')) {
        toggleMobileMenu(false);
      }
    });
  });

  const hudToggleBtn = document.getElementById('hudToggleButton');
  hudToggleBtn?.addEventListener('click', () => {
    document.body.classList.toggle('hud-hidden');
    const isHidden = document.body.classList.contains('hud-hidden');
    const txt = hudToggleBtn.querySelector('.toggle-text');
    if (txt) txt.textContent = isHidden ? '展開' : 'HUD';
    const icon = hudToggleBtn.querySelector('.toggle-icon');
    if (icon) icon.textContent = isHidden ? '✕' : '👁️';
  });

  function togglePanel(id) {
    const el = document.getElementById(id);
    const wasHidden = el.classList.contains('hidden');
    document.querySelectorAll('.sidepanel').forEach(p => p.classList.add('hidden'));
    if (wasHidden) el.classList.remove('hidden');
  }

  document.querySelectorAll('[data-close]').forEach(b => {
    b.addEventListener('click', () => document.getElementById(b.dataset.close)?.classList.add('hidden'));
  });

  // Rain toggle
  rainToggleButton?.addEventListener('click', () => {
    const active = toggleRain();
    const weather = document.getElementById('weatherStatus');
    if (weather) {
      weather.textContent = active ? '🌧️ ACID RAIN 観測中' : '☁️ OVERCAST / 曇天';
    }
  });

  // Inventory update listener
  window.addEventListener('inventory-update', e => {
    const ul = document.getElementById('inventoryList');
    if (!ul) return;
    ul.replaceChildren();
    const items = e.detail?.items || [];
    if (!items.length) {
      const li = document.createElement('li');
      li.textContent = 'まだ何も持っていない';
      ul.append(li);
    } else {
      items.forEach((item, i) => {
        const li = document.createElement('li');
        li.textContent = `${i + 1}. ${item}`;
        ul.append(li);
      });
    }
  });

  // Mission update listener
  window.addEventListener('mission-update', e => {
    const text = e.detail?.text || 'ミッション更新';
    const obj = document.getElementById('objective');
    if (obj) obj.textContent = text;
    const status = document.getElementById('missionStatus');
    if (status) status.textContent = text;
    const ul = document.getElementById('missionList');
    if (ul) {
      const li = document.createElement('li');
      li.textContent = text;
      ul.prepend(li);
    }
  });

  // DISC Real-time Observation updates
  window.addEventListener('observation', () => {
    const s = getSummary();
    const countEl = document.getElementById('logCount');
    if (countEl) countEl.textContent = 'LOG ' + String(analysis.actions).padStart(3, '0');

    const meterFill = document.getElementById('meterFill');
    if (meterFill) meterFill.style.width = Math.min(100, analysis.actions * 5) + '%';

    const discHint = document.getElementById('discHint');
    if (discHint) {
      discHint.textContent = s.total > 0.5 ? `傾向：${s.leader.key}（${s.leader.label.split(' / ')[0]}）` : '行動傾向：未解析';
    }

    const total = Math.max(0.1, s.total);
    const dPct = Math.round((analysis.D / total) * 100);
    const iPct = Math.round((analysis.I / total) * 100);
    const sPct = Math.round((analysis.S / total) * 100);
    const cPct = Math.round((analysis.C / total) * 100);

    setBar('D', dPct);
    setBar('I', iPct);
    setBar('S', sPct);
    setBar('C', cPct);

    const ul = document.getElementById('logList');
    if (ul) {
      ul.replaceChildren();
      for (const l of analysis.logs.slice(0, 35)) {
        const li = document.createElement('li');
        li.textContent = `[${l.time}] ${l.type} — ${l.detail}`;
        ul.append(li);
      }
    }

    const resultCard = document.getElementById('discResult');
    if (resultCard) {
      resultCard.innerHTML = `
        <h3>行動解析プロファイル（暫定値）</h3>
        <p style="margin-bottom: 10px; color: var(--cyan); font-weight: bold;">
          最優位傾向：${s.leader.key}型 (${s.leader.label}) — ${s.leader.pct}%
        </p>
        <p style="font-size: 11px; color: #a4c5dc; line-height: 1.6; margin-bottom: 12px;">
          ${s.leader.description}
        </p>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${s.entries.map(e => `
            <div style="display: flex; justify-content: space-between; font-family: var(--mono); font-size: 11px;">
              <span>${e.key} ${e.label.split(' / ')[0]}</span>
              <span style="color: var(--cyan);">${e.pct}% (${e.score}pt)</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    const relCard = document.getElementById('relationshipCard');
    if (relCard) {
      const rel = getRelationshipStatus();
      relCard.innerHTML = `
        <h4>都市の観測記録 // 個体間関係性</h4>
        <p style="margin: 0; font-size: 11px; line-height: 1.6; color: #b6d5ea;">
          <b>ダーリンちゃん：</b> <span style="color: var(--pink);">${rel.darlingStatus}</span><br>
          <b>LSI芋虫：</b> <span style="color: var(--cyan);">${rel.caterpillarStatus}</span><br>
          <b>${cityMemory.natsueNameRevealed ? '夏江' : '観測者'}：</b> <span style="color: #c9b6ff;">${rel.natsueStatus}</span><br>
          <b>都市の認識：</b> <span style="color: var(--green);">${rel.reputation}</span>
        </p>
      `;
    }
  });

  function setBar(key, pct) {
    const bar = document.getElementById(`bar${key}`);
    const val = document.getElementById(`val${key}`);
    if (bar) bar.style.width = pct + '%';
    if (val) val.textContent = pct + '%';
  }

  // Start screen & reset
  document.getElementById('startButton')?.addEventListener('click', () => {
    document.body.classList.add('game-started');
    document.getElementById('startScreen')?.classList.add('hidden');
    document.querySelector('.mobile-hud-top-actions')?.classList.remove('hidden');
    interactions.toast('接続完了。自由に歩いて、都市の異常や住人を観測してください。');
  });

  resetButton?.addEventListener('click', () => {
    if (confirm('観測記録をリセットし、都市の初期地点へ再接続しますか？')) {
      location.reload();
    }
  });

  // Clock tick
  let seconds = 0;
  setInterval(() => {
    seconds++;
    const clock = document.getElementById('clock');
    if (clock) {
      clock.textContent = `02:${String(17 + Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }
  }, 1000);

  // Minigame modal handler
  setupMinigame();

  // 3D Vending showcase modal handler
  setup3DVending(interactions);
}

// 3D Vending Showcase
function setup3DVending(interactions) {
  const modal = document.getElementById('vendingModal');
  const closeBtn = document.getElementById('closeVending');
  const grid = document.getElementById('vendingCansGrid');

  closeBtn?.addEventListener('click', () => modal?.classList.add('hidden'));

  const drinks = [
    {
      name: '深夜エスプレッソ',
      color: 0xff9900,
      effect: '漆黒の濃縮珈琲。直断力と覚醒を促進',
      weights: { D: 2 }
    },
    {
      name: '夜光ソーダ',
      color: 0x33e5ff,
      effect: '青い微発泡。知覚と論理分析力を研ぎ澄ます',
      weights: { C: 2 }
    },
    {
      name: '桃色ミルク',
      color: 0xff66cc,
      effect: '濃厚な甘み。感情の交流と共鳴が広がる',
      weights: { I: 2 }
    },
    {
      name: '星屑ウォーター',
      color: 0xaaffdd,
      effect: '純度の高い天体蒸留水。静穏と落ち着き',
      weights: { S: 2 }
    },
    {
      name: '夜のチョココロネ',
      color: 0x6e3d16,
      effect: '深夜の買い食い定番菓子パン。懐かしい甘みと衝動',
      weights: { I: 1, D: 1 }
    },
    {
      name: 'シュガーデニッシュ',
      color: 0xee9933,
      effect: '夜風に溶ける甘いデニッシュ。規則的なやすらぎ',
      weights: { S: 1, C: 1 }
    }
  ];

  window.addEventListener('open-vending', () => {
    document.exitPointerLock?.();
    modal?.classList.remove('hidden');
    grid.replaceChildren();

    drinks.forEach(d => {
      const card = document.createElement('div');
      card.className = 'vending-can-card';

      // 2D Canvas preview of the can (lightweight, zero WebGL context leaks)
      const canvas = document.createElement('canvas');
      canvas.className = 'can-preview-canvas';
      card.append(canvas);

      const title = document.createElement('div');
      title.className = 'can-name';
      title.textContent = d.name;
      card.append(title);

      const desc = document.createElement('div');
      desc.className = 'can-effect';
      desc.textContent = d.effect;
      card.append(desc);

      const buyBtn = document.createElement('button');
      buyBtn.className = 'can-buy-btn';
      buyBtn.textContent = '購入する [0 C]';
      card.append(buyBtn);

      const buyAction = () => {
        modal?.classList.add('hidden');
        window.dispatchEvent(new CustomEvent('inventory-add', {
          detail: { item: d.name }
        }));
        record('アイテム購入', `${d.name}を自販機から直感購入（${d.effect}）`, d.weights);
        interactions.toast(`「${d.name}」を購入！持ち物に追加しました。`);
      };

      card.addEventListener('click', buyAction);

      grid.append(card);

      // Render crisp cyberpunk beverage can in 2D canvas
      drawMiniCyberCan2D(canvas, d);
    });
  });
}

function drawMiniCyberCan2D(canvas, drink) {
  const width = 90;
  const height = 90;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const hexColor = '#' + drink.color.toString(16).padStart(6, '0');

  ctx.clearRect(0, 0, width, height);

  // Outer ambient neon glow circle
  const glow = ctx.createRadialGradient(45, 45, 8, 45, 45, 42);
  glow.addColorStop(0, `${hexColor}55`);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(45, 45, 42, 0, Math.PI * 2);
  ctx.fill();

  const canX = 27;
  const canY = 16;
  const canW = 36;
  const canH = 56;
  const r = 5;

  // Can Body Gradient (metallic highlight)
  const bodyGrad = ctx.createLinearGradient(canX, 0, canX + canW, 0);
  bodyGrad.addColorStop(0, '#0d1522');
  bodyGrad.addColorStop(0.2, hexColor);
  bodyGrad.addColorStop(0.5, '#ffffff');
  bodyGrad.addColorStop(0.8, hexColor);
  bodyGrad.addColorStop(1, '#080c14');

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(canX, canY, canW, canH, r);
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = hexColor;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Top rim & pull tab
  const topGrad = ctx.createLinearGradient(canX + 3, canY - 4, canX + canW - 3, canY);
  topGrad.addColorStop(0, '#556677');
  topGrad.addColorStop(0.5, '#e4ecf4');
  topGrad.addColorStop(1, '#2b3948');
  ctx.fillStyle = topGrad;
  ctx.beginPath();
  ctx.ellipse(45, canY + 1, canW / 2 - 2, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c0d0e0';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Pull tab ring
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(45, canY - 0.5, 4.5, 2.2, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Bottom rim
  ctx.fillStyle = '#1c2838';
  ctx.beginPath();
  ctx.ellipse(45, canY + canH - 1, canW / 2 - 2, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Holographic horizontal label stripe
  ctx.fillStyle = 'rgba(7, 14, 28, 0.8)';
  ctx.fillRect(canX + 1, canY + 15, canW - 2, 24);

  // Neon text / logo on can
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('NEON', 45, canY + 25);
  ctx.fillStyle = hexColor;
  ctx.font = '7px monospace';
  ctx.fillText('0.0 C', 45, canY + 34);

  // Vertical highlight reflection slit
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fillRect(canX + 12, canY + 3, 2.5, canH - 6);

  ctx.restore();
}

function setupMinigame() {
  const modal = document.getElementById('minigameModal');
  const closeBtn = document.getElementById('closeMinigame');
  const board = document.getElementById('minigameBoard');
  const svg = document.getElementById('minigameWireSvg');
  const statusEl = document.getElementById('minigameStatus');
  const timerFill = document.getElementById('minigameTimerFill');

  let timerInterval = null;

  closeBtn?.addEventListener('click', () => {
    clearInterval(timerInterval);
    modal.classList.add('hidden');
  });

  window.addEventListener('start-minigame', e => {
    document.exitPointerLock?.();
    const config = e.detail || {};
    modal.classList.remove('hidden');

    const titleEl = document.getElementById('minigameTitle');
    if (titleEl) titleEl.textContent = config.title || '異常配線バイパス回路';

    const pairs = [
      { id: 1, label: 'PWR-A (主電源線)', targetId: 2, targetLabel: 'PORT-β (バイパス)', color: '#ffb833' },
      { id: 2, label: 'DAT-B (論理通信線)', targetId: 1, targetLabel: 'PORT-α (CPU中継)', color: '#72f6ff' },
      { id: 3, label: 'GND-C (接地保護線)', targetId: 3, targetLabel: 'PORT-γ (接地端子)', color: '#55efc4' }
    ];

    let selectedLeft = null;
    let connectedCount = 0;
    let mistakes = 0;
    const maxMistakes = 3;
    const startTime = performance.now();
    const durationSec = 15;

    board.replaceChildren();
    if (svg) svg.replaceChildren();

    const leftCol = document.createElement('div');
    leftCol.className = 'minigame-node-col';
    const rightCol = document.createElement('div');
    rightCol.className = 'minigame-node-col';

    const leftPins = [];
    const rightPins = [];

    // Helper to draw connecting SVG wire between two pin elements
    function drawWire(pinA, pinB, wireColor) {
      if (!svg) return;
      const bRect = board.getBoundingClientRect();
      const rA = pinA.getBoundingClientRect();
      const rB = pinB.getBoundingClientRect();

      const x1 = rA.right - bRect.left;
      const y1 = rA.top + rA.height / 2 - bRect.top;
      const x2 = rB.left - bRect.left;
      const y2 = rB.top + rB.height / 2 - bRect.top;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const dx = x2 - x1;
      const d = `M ${x1} ${y1} C ${x1 + dx * 0.45} ${y1}, ${x2 - dx * 0.45} ${y2}, ${x2} ${y2}`;
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', wireColor);
      path.setAttribute('stroke-width', '4');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('class', 'minigame-wire-line');
      path.style.filter = `drop-shadow(0 0 8px ${wireColor})`;
      svg.append(path);
    }

    pairs.forEach(p => {
      const pinL = document.createElement('div');
      pinL.className = 'minigame-pin';
      pinL.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};box-shadow:0 0 8px ${p.color}"></span> ${p.label}`;
      pinL.dataset.id = p.id;
      pinL.addEventListener('click', () => {
        if (pinL.classList.contains('connected')) return;
        leftPins.forEach(x => x.classList.remove('selected'));
        pinL.classList.add('selected');
        selectedLeft = p.id;
        statusEl.textContent = `端子「${p.label}」を選択中 → 接続先ポートをクリック`;
      });
      leftCol.append(pinL);
      leftPins.push(pinL);

      const pinR = document.createElement('div');
      pinR.className = 'minigame-pin';
      pinR.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;border:1px solid #72f6ff"></span> ${p.targetLabel}`;
      pinR.dataset.targetId = p.targetId;
      pinR.addEventListener('click', () => {
        if (!selectedLeft) {
          statusEl.textContent = '先に左側の端子を選択してください';
          return;
        }
        if (pinR.classList.contains('connected')) return;

        const leftEl = leftPins.find(x => Number(x.dataset.id) === selectedLeft);
        const currentPair = pairs.find(x => x.id === selectedLeft);

        if (Number(pinR.dataset.targetId) === selectedLeft) {
          pinR.classList.add('connected');
          if (leftEl) {
            leftEl.classList.remove('selected');
            leftEl.classList.add('connected');
            drawWire(leftEl, pinR, currentPair.color);
          }
          connectedCount++;
          selectedLeft = null;
          statusEl.textContent = `接続成功！（残り ${pairs.length - connectedCount} 箇所）`;

          if (connectedCount >= pairs.length) {
            clearInterval(timerInterval);
            const elapsed = Math.round((performance.now() - startTime) / 100) / 10;
            statusEl.textContent = `全回路バイパス成功！ [所要時間: ${elapsed}s / ミス: ${mistakes}]`;
            setTimeout(() => {
              modal.classList.add('hidden');
              config.onComplete?.({ success: true, elapsed, mistakes });
            }, 900);
          }
        } else {
          mistakes++;
          pinR.classList.add('wrong');
          setTimeout(() => pinR.classList.remove('wrong'), 450);

          if (mistakes >= maxMistakes) {
            clearInterval(timerInterval);
            statusEl.textContent = '過電流ショート発生！ヒューズ遮断（バイパス失敗）';
            setTimeout(() => {
              modal.classList.add('hidden');
              config.onComplete?.({ success: false, elapsed: Math.round((performance.now() - startTime) / 100) / 10, mistakes });
            }, 1000);
          } else {
            statusEl.textContent = `警告：ショート発生！正しいポートへ接続してください（誤接続: ${mistakes}/${maxMistakes}）`;
          }
        }
      });
      rightCol.append(pinR);
      rightPins.push(pinR);
    });

    board.append(leftCol, rightCol);
    statusEl.textContent = '端子を選択して対応するポートへ接続してください [制限時間: 15秒 / 許容ショート: 2回]';

    clearInterval(timerInterval);
    const startTimestamp = Date.now();
    timerInterval = setInterval(() => {
      const passed = (Date.now() - startTimestamp) / 1000;
      const leftRatio = Math.max(0, 1 - passed / durationSec);
      if (timerFill) timerFill.style.width = `${leftRatio * 100}%`;

      if (passed >= durationSec) {
        clearInterval(timerInterval);
        statusEl.textContent = 'タイムアウト！過電流保護により緊急遮断！（復旧失敗）';
        setTimeout(() => {
          modal.classList.add('hidden');
          config.onComplete?.({ success: false, elapsed: durationSec, mistakes: mistakes + 1 });
        }, 900);
      }
    }, 100);
  });
}

function setupNeonFeed(interactions) {
  const timeline = document.getElementById('feedTimeline');
  const postInput = document.getElementById('feedPostInput');
  const sendBtn = document.getElementById('btnSendFeedPost');

  const posts = [
    {
      id: 'f_1',
      avatar: '🥺',
      name: 'ダーリンちゃん',
      handle: '@darling_0',
      time: '2分前',
      text: '街角の配線盤、バチバチ火花散らしとるやん♡ 退屈な街のトランプが崩れそうで綺麗〜 #深夜の第零区',
      location: '第零区・雨天通り',
      likes: 89,
      reposts: 14,
      liked: false
    },
    {
      id: 'f_2',
      avatar: '👤',
      name: cityMemory.natsueNameRevealed ? '夏江' : '観測者',
      handle: cityMemory.natsueNameRevealed ? '@natsue_rain' : '@rain_observer',
      time: '7分前',
      text: '夜中に食べるコンビニの菓子パンって、なんであんなに安心するんだろ。誰かに見つけてもらえたらいいな。 #雨宿り',
      location: '雨宿りベンチ',
      likes: 142,
      reposts: 28,
      liked: false
    },
    {
      id: 'f_3',
      avatar: '🐛',
      name: 'LSI芋虫',
      handle: '@caterpillar_lsi',
      time: '15分前',
      text: '本日の降雨酸性度pH 4.82を観測。光の屈折率補正を推奨するよ。接触回数の記録は禁止だよ！🐛 #第零区観測',
      location: '都市境界線',
      likes: 67,
      reposts: 19,
      liked: false
    },
    {
      id: 'f_4',
      avatar: '📡',
      name: '匿名都民 #804',
      handle: '@citizen_804',
      time: '26分前',
      text: '0番線のバス停に謎の切符が挟まってたってマジ？ 運行してないはずの路線なのに……誰か検証してきて #都市伝説',
      location: '無人バス停',
      likes: 215,
      reposts: 53,
      liked: false
    }
  ];

  function renderFeed() {
    if (!timeline) return;
    timeline.replaceChildren();

    posts.forEach(p => {
      const card = document.createElement('div');
      card.className = 'feed-post-card';

      const header = document.createElement('div');
      header.className = 'post-header-row';
      header.innerHTML = `
        <span class="post-avatar-badge">${p.avatar}</span>
        <div class="post-user-info">
          <span class="post-author-name">${p.name}</span>
          <span class="post-author-handle">${p.handle}</span>
        </div>
        <span class="post-timestamp">${p.time}</span>
      `;
      card.append(header);

      if (p.location) {
        const loc = document.createElement('div');
        loc.className = 'post-location-tag';
        loc.textContent = `📍 ${p.location}`;
        card.append(loc);
      }

      const body = document.createElement('div');
      body.className = 'post-body-text';
      body.textContent = p.text;
      card.append(body);

      if (p.image) {
        const imgWrap = document.createElement('div');
        imgWrap.className = 'post-image-attachment';
        const img = document.createElement('img');
        img.src = p.image;
        img.alt = '添付画像';
        img.className = 'post-attached-photo';
        imgWrap.append(img);
        card.append(imgWrap);
      }

      const actions = document.createElement('div');
      actions.className = 'post-interaction-bar';

      const likeBtn = document.createElement('button');
      likeBtn.className = `post-action-btn ${p.liked ? 'liked' : ''}`;
      likeBtn.innerHTML = `♥ <span>${p.likes}</span>`;
      likeBtn.addEventListener('click', () => {
        p.liked = !p.liked;
        p.likes += p.liked ? 1 : -1;
        likeBtn.className = `post-action-btn ${p.liked ? 'liked' : ''}`;
        likeBtn.querySelector('span').textContent = p.likes;
      });

      const repostBtn = document.createElement('button');
      repostBtn.className = 'post-action-btn';
      repostBtn.innerHTML = `🔁 <span>${p.reposts}</span>`;
      repostBtn.addEventListener('click', () => {
        p.reposts++;
        repostBtn.querySelector('span').textContent = p.reposts;
        interactions.toast('ネオン・フィードでリポスト拡散しました！');
      });

      const exportBtn = document.createElement('button');
      exportBtn.className = 'post-action-btn';
      exportBtn.innerHTML = `🖼️ <span>画像保存</span>`;
      exportBtn.addEventListener('click', () => {
        exportFeedPostImage(p);
      });

      const shareBtn = document.createElement('button');
      shareBtn.className = 'post-action-btn';
      shareBtn.innerHTML = `🔗 <span>共有</span>`;
      shareBtn.addEventListener('click', () => {
        shareFeedPost(p);
      });

      actions.append(likeBtn, repostBtn, exportBtn, shareBtn);
      card.append(actions);

      timeline.append(card);
    });
  }

  // Quick tags
  document.querySelectorAll('.quick-tag').forEach(tagBtn => {
    tagBtn.addEventListener('click', () => {
      if (!postInput) return;
      const tag = tagBtn.dataset.tag || tagBtn.textContent;
      if (!postInput.value.includes(tag)) {
        postInput.value = (postInput.value + ' ' + tag).trim();
      }
      postInput.focus();
    });
  });

  // Post Submission with Reactive NPC Comments
  function submitPost(text, location = '第零区・観測地点', image = null) {
    if (!text || !text.trim()) return;
    const newPost = {
      id: 'f_' + Date.now(),
      avatar: '🕶️',
      name: '都市観測者（あなた）',
      handle: '@observer',
      time: 'たった今',
      text: text.trim(),
      location,
      image,
      likes: Math.floor(Math.random() * 20 + 8),
      reposts: Math.floor(Math.random() * 8 + 1),
      liked: false
    };
    posts.unshift(newPost);
    renderFeed();
    record('フィード実況', 'ネオン・フィードに実況投稿: ' + text.trim(), { I: 2 });
    interactions.toast('ネオン・フィードニ実況ヲ投稿シタ！');

    // Trigger reactive NPC comment after brief realistic delay
    setTimeout(() => {
      const npcReplies = [
        {
          avatar: '🥺',
          name: 'ダーリンちゃん',
          handle: '@darling_0',
          lines: [
            '「ダーリン、その場所お気に入りなの？♡ 足元滑るから気をつけてね！」',
            '「わ、ダーリンの実況みっけ♡ 退屈な夜のトランプ崩し、一緒にしよ〜？」',
            '「ふふっ♡ リアルタイム実況なんて、意外と目立ちたがり屋さんやね？」'
          ]
        },
        {
          avatar: '🐛',
          name: 'LSI芋虫',
          handle: '@caterpillar_lsi',
          lines: [
            '「観測パケット受信したよ！🐛 その座標の電磁ノイズ率をデバッグキューに追加しておくね。」',
            '「その地点の酸性雨降雨データと同期完了。記録ありがとうね！🐛」',
            '「実況フィードのタイムスタンプ整合性を確認。正常に分散ログへ書き込まれたよ。🐛」'
          ]
        },
        {
          avatar: cityMemory.natsueNameRevealed ? '👧' : '👤',
          name: cityMemory.natsueNameRevealed ? '夏江' : '観測者',
          handle: cityMemory.natsueNameRevealed ? '@natsue_rain' : '@rain_observer',
          lines: [
            '「私もさっきその近く通ったよ。雨宿りできる場所、見つかった？」',
            '「夜の街って、誰かの呟きが流れてくるだけで少し温かくなるね。」',
            '「雨に濡れて風邪引かないように気をつけてね。」'
          ]
        }
      ];

      const chosenNpc = npcReplies[Math.floor(Math.random() * npcReplies.length)];
      const chosenLine = chosenNpc.lines[Math.floor(Math.random() * chosenNpc.lines.length)];

      const replyPost = {
        id: 'f_rep_' + Date.now(),
        avatar: chosenNpc.avatar,
        name: chosenNpc.name,
        handle: chosenNpc.handle,
        time: 'たった今',
        text: `@observer ${chosenLine}`,
        location,
        likes: Math.floor(Math.random() * 15 + 5),
        reposts: Math.floor(Math.random() * 5 + 1),
        liked: false
      };

      // Insert immediately below the user's post
      posts.splice(1, 0, replyPost);
      renderFeed();
      interactions.toast(`【ネオン・フィード】${chosenNpc.name} から返信が届きました！`);
    }, 2000);
  }

  sendBtn?.addEventListener('click', () => {
    if (!postInput) return;
    const val = postInput.value.trim();
    if (val) {
      submitPost(val);
      postInput.value = '';
    }
  });

  // External listener from interactions
  window.addEventListener('neon-feed', e => {
    const text = e.detail?.text;
    const loc = e.detail?.location || '第零区・観測地点';
    const img = e.detail?.image || null;
    if (text) {
      submitPost(text, loc, img);
    }
  });

  window.addEventListener('neon-feed-post-external', e => {
    const text = e.detail?.text;
    const loc = e.detail?.location || '第零区・忘失物ボックス前';
    const img = e.detail?.image || null;
    if (text) {
      submitPost(text, loc, img);
    }
  });

  function exportFeedPostImage(post) {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 800, 480);
    grad.addColorStop(0, '#060c18');
    grad.addColorStop(0.5, '#0b162a');
    grad.addColorStop(1, '#140c24');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 480);

    // Cyber border
    ctx.strokeStyle = '#72f6ff';
    ctx.lineWidth = 3;
    ctx.strokeRect(16, 16, 768, 448);

    // Header badge
    ctx.fillStyle = '#72f6ff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('NEON-FEED // URBAN REALTIME STREAM', 40, 56);

    ctx.fillStyle = '#ff75c8';
    ctx.font = '14px monospace';
    ctx.fillText('MIDNIGHT PROTOCOL // BUILD 0.6', 520, 56);

    // Divider
    ctx.strokeStyle = 'rgba(114, 246, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 72);
    ctx.lineTo(760, 72);
    ctx.stroke();

    // Author Row
    ctx.font = '36px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
    ctx.fillText(post.avatar, 40, 130);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Hiragino Kaku Gothic ProN",sans-serif';
    ctx.fillText(post.name, 95, 115);

    ctx.fillStyle = '#72f6ff';
    ctx.font = '15px monospace';
    ctx.fillText(post.handle + ' • ' + post.time, 95, 140);

    // Location tag
    if (post.location) {
      ctx.fillStyle = 'rgba(255, 117, 200, 0.15)';
      ctx.fillRect(40, 165, 240, 32);
      ctx.strokeStyle = '#ff75c8';
      ctx.strokeRect(40, 165, 240, 32);
      ctx.fillStyle = '#ff75c8';
      ctx.font = '14px sans-serif';
      ctx.fillText('📍 ' + post.location, 52, 186);
    }

    // Post Body Text (word wrapped)
    ctx.fillStyle = '#eef6fc';
    ctx.font = '20px "Hiragino Kaku Gothic ProN",sans-serif';
    const words = post.text.split('\n');
    let y = 240;
    for (const line of words) {
      ctx.fillText(line, 40, y);
      y += 34;
    }

    // Stats bar
    ctx.strokeStyle = 'rgba(114, 246, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(40, 390);
    ctx.lineTo(760, 390);
    ctx.stroke();

    ctx.fillStyle = '#ff75c8';
    ctx.font = '16px monospace';
    ctx.fillText(`♥ ${post.likes} いいね   🔁 ${post.reposts} リポスト`, 40, 424);

    ctx.fillStyle = '#8caac1';
    ctx.font = '12px monospace';
    ctx.fillText('深夜都市行動解析計画 | 行動で観測される街', 460, 424);

    const dataUrl = canvas.toDataURL('image/png');
    const previewImg = document.getElementById('previewImageCard');
    const dlBtn = document.getElementById('btnDownloadCardDirect');
    const saveModal = document.getElementById('imageSaveModal');
    const tagEl = document.getElementById('imageSaveTag');
    const titleEl = document.getElementById('imageSaveTitle');

    if (tagEl) tagEl.textContent = 'NEON FEED SNAPSHOT // 実況記録カード';
    if (titleEl) titleEl.textContent = 'ネオン・フィード実況カードの保存';
    if (previewImg) previewImg.src = dataUrl;
    if (dlBtn) {
      dlBtn.href = dataUrl;
      dlBtn.download = `NEON_FEED_${Date.now()}.png`;
    }
    saveModal?.classList.remove('hidden');
  }

  function shareFeedPost(post) {
    const shareText = `【ネオン・フィード実況】\n${post.name} (${post.handle})\n「${post.text}」\n📍 ${post.location || '第零区'}\n#深夜都市行動解析計画 #MIDNIGHT_PROTOCOL`;
    if (navigator.share) {
      navigator.share({
        title: 'ネオン・フィード実況 | 深夜都市行動解析計画',
        text: shareText,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(shareText + '\n' + window.location.href).then(() => {
        interactions.toast('実況テキストとURLをクリップボードにコピーしました！');
      }).catch(() => {
        interactions.toast('共有テキストを準備しました。');
      });
    }
  }

  renderFeed();
}
