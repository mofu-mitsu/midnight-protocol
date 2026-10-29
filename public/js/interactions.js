import * as THREE from 'three';
import { interactables, LOCATIONS, npcAgents, scene } from './world.js';
import { record, getSummary, analysis } from './analysis.js';
import { cityMemory, updateMemory } from './memory.js';

let active = null;
let insideArchive = false;
let mission = '街中の異常（配線盤・信号機・矛盾看板）を発見し、調査せよ';
let observerFollow = false;
let previousTopics = {};
let inventory = [];
window.getCurrentInventory = () => inventory.slice();
let caterpillarTaps = 0;
let darlingBoredom = 0;
let anomaliesCleared = 0;

const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);
const interact = document.getElementById('interact');

// Se (Extroverted Sensing) trigger keywords
const triggerKeywords = [
  "きも", "うざ", "ウザ", "イラ", "苛", "いらっ", "嫌い", "うるさ", "だる", "あんぽんたん", "いいえ",
  "アンポンタン", "キモ", "ゴミ", "カス", "オエー", "おえー", "きしょ", "キショ", "しね", 
  "死ね", "やめて", "いや", "やめろ", "💢", "好きじゃない", "苦手", "きらい", "関わりたくない",  
  "思ったか", "反対", "失せろ", "黙って", "殲滅", "うんこ", "うせろ", "面倒", "NO",  
  "no", "帰れ", "kiero", "は？", "ハ？", "はあ", "ハア", "あっそ", "あっそー", "どうでもいい", 
  "くだらない", "くだらね", "つまらん", "つまんね", "意味分からん", "意味不明", "勝手にしろ", 
  "勝手に言っとけ", "消えろ", "消えろや", "引っ込んでろ", "黙れ", "ダマレ", "だまれ", "キチガイ", 
  "バカ", "ばか", "アホ", "あほ", "不快", "腹立つ", "ムカつく", "むかつく", "煽るな",
  "！！！", "!!!", "？？？", "???", "ｗｗｗ", "www", "ふざけ", "クソ", "くそ", "💩"
];

export function setupInteractions(camera) {
  const notice = document.getElementById('notice');
  let noticeTimer;

  function toast(t) {
    notice.textContent = t;
    notice.classList.add('show');
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => notice.classList.remove('show'), 3800);
  }

  const discoveredMissions = new Set(['M_ANOMALY']);
  const completedMissions = new Set();

  function unlockMission(id, titleText) {
    if (!discoveredMissions.has(id)) {
      discoveredMissions.add(id);
      window.dispatchEvent(new CustomEvent('mission-update', { detail: { text: titleText } }));
      toast(titleText);
    }
  }

  function completeMission(id, completionText) {
    if (!completedMissions.has(id)) {
      completedMissions.add(id);
      window.dispatchEvent(new CustomEvent('mission-update', { detail: { text: completionText } }));
      toast(completionText);
    }
  }

  function getItemCategories(item) {
    const isNpc = item.kind === 'darling' || item.kind === 'caterpillar' || item.kind === 'observer';
    const isBench = item.kind === 'bench';

    // 1. Dialogue Options (DISC 4 choices)
    let dialogueOpts = [];
    if (item.kind === 'darling') {
      dialogueOpts = [
        ['「退屈なら、今すぐ私のペースに合わせてついて来なさい」と主導権を握る', { D: 2 }],
        ['「感情がログに漏れてるよ♡」とからかって笑わせる', { I: 2 }],
        ['甘えた猫なで声を優しく受け止め、静かに見守る', { S: 2 }],
        ['「からかうのはいいけれど、言葉の真意をちゃんと確かめたいな」', { C: 2 }]
      ];
      if (cityMemory.darlingIgnoredCount >= 1) {
        dialogueOpts.unshift(['「この前放置してごめんね」と謝る', { S: 2, I: 1 }]);
      }
    } else if (item.kind === 'caterpillar') {
      dialogueOpts = [
        ['「結論を急ぎたまえ。街のデバッグを最優先で進めるぞ」', { D: 2 }],
        ['「人が悲しむ時の喪失の予測について、もっとフランクに語ろうよ」', { I: 2 }],
        ['芋虫の安全な生息環境と境界線の平穏を見守る', { S: 2 }],
        ['光の屈折率と三段階プロセスによる都市デバッグについて聞く', { C: 2 }]
      ];
    } else if (item.kind === 'observer') {
      dialogueOpts = [
        ['「行くよ。雨の街をぐいぐい引っ張って案内してあげる」', { D: 2 }],
        ['「ネオン・フィードに私たちの夜の写真をアップしようよ！」', { I: 2 }],
        ['「少し冷えるね。雨宿りできる場所でも探しながら歩こう」', { S: 2 }],
        ['「焦らず、これまでの歩みと街で見つけた手がかりを整理しよう」', { C: 2 }]
      ];
    } else if (item.kind === 'bench') {
      dialogueOpts = [
        ['深く腰を下ろして息を整え、次に向かうべき交差点を直断する', { D: 2 }],
        ['『#雨宿りなう #深夜の第零区』とネオン・フィードに写真を共有する', { I: 2 }],
        ['雨音のホワイトノイズに包まれて静かに休む（雨宿り休憩）', { S: 2 }],
        ['濡れたベンチの座面を触り、座れる状態か慎重に確かめる', { C: 2 }]
      ];
    } else {
      dialogueOpts = getActionOptions(item);
    }

    // 2. Inventory Options (持ち物欄)
    const inventoryOpts = [];
    if (inventory.length === 0) {
      inventoryOpts.push([
        '（所持品がありません）自販機で飲料を購入したり街の調査で入手できます',
        {}
      ]);
    } else {
      const uniqueItems = Array.from(new Set(inventory));
      for (const it of uniqueItems) {
        const count = inventory.filter(x => x === it).length;
        const countLabel = count > 1 ? ` (所持: ${count})` : '';
        if (/コロネ|デニッシュ|パン|ソーダ|コーヒー|エスプレッソ|ミルク|ウォーター|ジュース|缶/.test(it)) {
          inventoryOpts.push([`🎁【プレゼントする】${it}${countLabel}を贈る（好意と交流）`, { I: 2, S: 1 }]);
        } else {
          inventoryOpts.push([`🔍【手渡して見せる】${it}${countLabel}について意見を聞く`, { C: 2, I: 1 }]);
        }
      }
    }

    // 3. Mission Inquiry Options (ミッション・調査)
    const missionOpts = [];
    if (discoveredMissions.has('M_ANOMALY') && !completedMissions.has('M_ANOMALY')) {
      missionOpts.push(['【ミッション調査】街の異常個所を即座に修復・鎮圧する手順を問う', { D: 2 }]);
      missionOpts.push(['【ミッション対話】「街中でエラー起きてて笑う」と異常について雑談する', { I: 2 }]);
      missionOpts.push(['【ミッション確認】異常現象による都市住人への被害がないか安否を確認する', { S: 2 }]);
      missionOpts.push(['【ミッション照合】異常発生源のログ波形と通信エラーの相関データを照合する', { C: 2 }]);
    }
    if (discoveredMissions.has('M_NATSUE') && !completedMissions.has('M_NATSUE')) {
      missionOpts.push(['【ミッション追跡】「夏江」という都民の行方を追跡している。情報を要求する', { D: 2 }]);
      missionOpts.push(['【ミッション聞き込み】「夏江」って子を探してるんだけど、街で噂になってない？', { I: 2 }]);
      missionOpts.push(['【ミッション尋ねる】古い学生証を落とした「夏江」さんを探していて……何か知りませんか？', { S: 2 }]);
      missionOpts.push(['【ミッション照合】「夏江」という署名の生体ハッシュと都民台帳の照合結果を問う', { C: 2 }]);
    }
    if (discoveredMissions.has('M_PLATFORM0') && !completedMissions.has('M_PLATFORM0')) {
      missionOpts.push(['【ミッション強行】存在しない「0番線」の改札へ強行突入する方法を問う', { D: 2 }]);
      missionOpts.push(['【ミッション共有】都市伝説の「0番線」、フィードで超話題だから一緒に探そう！', { I: 2 }]);
      missionOpts.push(['【ミッション相談】深夜バス停で見つけた「0番線の切符」……これ、何だと思う？', { S: 2 }]);
      missionOpts.push(['【ミッション解析】非同期ダイヤグラムと0番線の運行規則の論理矛盾を解析する', { C: 2 }]);
    }
    if (discoveredMissions.has('M_CIRCUIT') && !completedMissions.has('M_CIRCUIT')) {
      missionOpts.push(['【ミッション特定】ゴミ箱で拾った電子基板の出所を力づくで特定させる', { D: 2 }]);
      missionOpts.push(['【ミッション話題】このピコピコ鳴る基板、めっちゃエモくない？ 何のパーツ？', { I: 2 }]);
      missionOpts.push(['【ミッション確認】雨に濡れたゴミ箱にあった壊れた基板……大事な部品なのかな？', { S: 2 }]);
      missionOpts.push(['【ミッション照合】ICチップのシリアル番号と都市管理端末のプロトコル互換性を照合する', { C: 2 }]);
    }
    if (missionOpts.length === 0) {
      missionOpts.push([
        '（現在、聞き込み可能な緊急ミッションはありません）',
        {}
      ]);
    }

    // 4. Special Actions (特殊行動 / おつかい・物々交換)
    const specialOpts = [];
    if (item.kind === 'darling') {
      if (!cityMemory.darlingQuestCompleted) {
        if (inventory.includes('桃色ミルク')) {
          specialOpts.push(['🎁【おつかい完了】ダーリンちゃんに頼まれていた「桃色ミルク」を届ける♡', { I: 3, S: 2 }]);
        } else {
          specialOpts.push(['🥺「ダーリン♡ 自販機で桃色ミルク買ってきてぇ♡」とおねだりを聞く', { I: 2, S: 1 }]);
        }
      }
      specialOpts.push(['『ダーリンちゃんと深夜の街角で密会なう♡』とネオン・フィードに自慢する', { I: 2 }]);
      specialOpts.push(['「この街の構造とあなたの存在理由を教えて」と深く問い詰める', { C: 2 }]);
    } else if (item.kind === 'caterpillar') {
      if (!cityMemory.caterpillarQuestCompleted) {
        if (inventory.includes('夜光ソーダ') || inventory.includes('廃棄された電子基板')) {
          const part = inventory.includes('夜光ソーダ') ? '夜光ソーダ' : '廃棄された電子基板';
          specialOpts.push([`🎁【物々交換】LSI芋虫に回路補正物資「${part}」を譲渡する`, { C: 3, D: 1 }]);
        } else {
          specialOpts.push(['「都市クロック補正に『夜光ソーダ』か『廃棄電子基板』を求む！🐛」と依頼を受ける', { C: 2 }]);
        }
      }
      specialOpts.push(['芋虫をタップする（SLE物理介入テスト）', { D: 2 }]);
      specialOpts.push(['『巨大な光る緑の芋虫と遭遇！デバッグ中らしい🐛』とネオン・フィードに共有する', { I: 2 }]);
    } else if (item.kind === 'observer') {
      if (!cityMemory.natsueQuestCompleted) {
        if (inventory.includes('夜のチョココロネ') || inventory.includes('星屑ウォーター')) {
          const treat = inventory.includes('夜のチョココロネ') ? '夜のチョココロネ' : '星屑ウォーター';
          specialOpts.push([`🎁【差し入れ】寒そうにしている観測者さんに「${treat}」を渡す`, { S: 3, I: 2 }]);
        } else {
          specialOpts.push(['「雨で冷えるから、温かい菓子パンかお水が欲しいな」と控えめなお願いを聞く', { S: 2, I: 1 }]);
        }
      }
      specialOpts.push(
        observerFollow
          ? ['バイバイする（同行を解除）', { S: 1 }]
          : ['「一緒に歩かない？」と誘う（同行開始）', { S: 2, I: 1 }]
      );
      specialOpts.push(['『雨天通りで観測者さんと合流！雨の夜の散策中』とネオン・フィードに投稿する', { I: 2 }]);
    } else if (item.kind === 'bench') {
      const p = item.position;
      const darlingNear = npcAgents?.some(a => a.kind === 'darling' && a.object.position.distanceTo(p) < 14);
      const caterpillarNear = npcAgents?.some(a => a.kind === 'caterpillar' && a.object.position.distanceTo(p) < 14);
      const observerNear = observerFollow || npcAgents?.some(a => a.kind === 'observer' && a.object.position.distanceTo(p) < 14);

      if (darlingNear) {
        specialOpts.push(['「ねぇダーリンちゃん、一緒に雨宿りしよ？」とベンチに誘う', { I: 2, S: 1 }]);
      }
      if (observerNear) {
        specialOpts.push([cityMemory.natsueNameRevealed ? '「夏江ちゃん、少し雨宿りしていかない？」とベンチに誘う' : '「観測者さん、少し雨宿りしていかない？」とベンチに誘う', { S: 1, I: 1 }]);
      }
      if (caterpillarNear) {
        specialOpts.push(['「LSI芋虫、雨宿りしながら構造の話を聞かせて」と誘う', { C: 2, S: 1 }]);
      }
      specialOpts.push(['ベンチのメモを拾って文字の筆跡と紙の劣化を分析する', { C: 2 }]);
    }

    const categories = [
      { id: 'dialogue', title: '💬 会話・対話', desc: 'DISC行動観測', options: dialogueOpts },
      { id: 'inventory', title: `🎁 持ち物欄 (${inventory.length})`, desc: 'プレゼント・提示', options: inventoryOpts },
      { id: 'mission', title: '📋 ミッション・調査', desc: '聞き込み・情報照合', options: missionOpts }
    ];
    if (specialOpts.length > 0) {
      categories.push({ id: 'special', title: '⚡ 特殊行動', desc: '環境介入・独自アクション', options: specialOpts });
    }

    return {
      isCategorized: isNpc || isBench,
      categories,
      directOptions: dialogueOpts
    };
  }

  function renderDialogActions(item, selectedCategoryId = null) {
    const actions = document.getElementById('dialogActions');
    if (!actions) return;
    actions.replaceChildren();

    const data = getItemCategories(item);

    if (!data.isCategorized) {
      for (const [label, weights] of data.directOptions) {
        const b = document.createElement('button');
        b.textContent = label;
        b.addEventListener('click', () => handleOptionClick(item, label, weights));
        actions.append(b);
      }
      return;
    }

    if (!selectedCategoryId) {
      // Root Category View
      const rootDiv = document.createElement('div');
      rootDiv.className = 'action-category-root';

      data.categories.forEach(cat => {
        const catBtn = document.createElement('button');
        catBtn.innerHTML = `<strong>${cat.title}</strong><br><small style="color:var(--cyan);opacity:0.85;font-size:11px;">${cat.desc}</small>`;
        if (cat.id === 'inventory') {
          catBtn.style.borderColor = 'rgba(255, 117, 200, 0.45)';
          catBtn.style.background = 'rgba(32, 16, 42, 0.9)';
          catBtn.style.color = '#ffd6f3';
        } else if (cat.id === 'mission') {
          catBtn.style.borderColor = 'rgba(114, 246, 255, 0.35)';
          catBtn.style.background = 'rgba(12, 28, 52, 0.9)';
        }
        catBtn.addEventListener('click', () => {
          renderDialogActions(item, cat.id);
        });
        rootDiv.append(catBtn);
      });

      actions.append(rootDiv);
    } else {
      // Category Specific Options View
      const optDiv = document.createElement('div');
      optDiv.className = 'action-category-options';

      const backBtn = document.createElement('button');
      backBtn.className = 'category-back';
      backBtn.textContent = '◀ カテゴリ一覧に戻る';
      backBtn.addEventListener('click', () => {
        renderDialogActions(item, null);
      });
      optDiv.append(backBtn);

      const currentCat = data.categories.find(c => c.id === selectedCategoryId);
      if (currentCat) {
        currentCat.options.forEach(([label, weights]) => {
          const b = document.createElement('button');
          b.textContent = label;
          if (label.includes('プレゼント')) {
            b.style.borderColor = 'rgba(255, 117, 200, 0.5)';
            b.style.background = 'rgba(36, 16, 46, 0.92)';
            b.style.color = '#ffd4f1';
          } else if (label.includes('ミッション')) {
            b.style.borderColor = 'rgba(114, 246, 255, 0.35)';
            b.style.background = 'rgba(12, 28, 52, 0.9)';
          }
          b.addEventListener('click', () => {
            handleOptionClick(item, label, weights);
          });
          optDiv.append(b);
        });
      }

      actions.append(optDiv);
    }
  }

  function showDialogResult(item, label, reply, weights = {}) {
    const dialogText = document.getElementById('dialogText');
    const dialogActions = document.getElementById('dialogActions');
    if (!dialogText || !dialogActions) return;

    let dGain = weights.D ? `D+${weights.D} ` : '';
    let iGain = weights.I ? `I+${weights.I} ` : '';
    let sGain = weights.S ? `S+${weights.S} ` : '';
    let cGain = weights.C ? `C+${weights.C} ` : '';
    let gainStr = (dGain + iGain + sGain + cGain).trim() || '行動記録完了';

    dialogText.innerHTML = `
      <div class="action-feedback-banner">▶ 実行：${label}</div>
      <div class="npc-response-bubble">${reply || '街のシステムに行動が記録された。周囲の環境が微かに呼応している。'}</div>
      <div class="action-disc-gain">【観測解析】${gainStr}</div>
    `;

    dialogActions.replaceChildren();

    const navWrap = document.createElement('div');
    navWrap.className = 'action-result-nav';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'action-close-btn';
    closeBtn.textContent = '✓ 会話を終える（閉じる）';
    closeBtn.addEventListener('click', () => {
      close();
    });

    navWrap.append(closeBtn);
    dialogActions.append(navWrap);
  }

  function open(item) {
    if (!item) return;
    window.dispatchEvent(new CustomEvent('inventory-update', { detail: { items: inventory.slice() } }));
    document.exitPointerLock?.();
    active = item;
    window.dispatchEvent(new CustomEvent('npc-focus', { detail: { item } }));

    if (item.kind === 'vending') {
      window.dispatchEvent(new CustomEvent('open-vending', { detail: { item } }));
      return;
    }

    const displayName = (item.kind === 'observer' && cityMemory.natsueNameRevealed) ? '夏江' : item.name;
    document.getElementById('dialogTag').textContent = 'OBSERVED ENTITY // ' + item.type;
    document.getElementById('dialogTitle').textContent = displayName;

    const avatarEl = document.getElementById('dialogAvatar');
    if (avatarEl) {
      avatarEl.textContent =
        item.kind === 'darling' ? '🥺' :
        item.kind === 'caterpillar' ? '🐛' :
        item.kind === 'observer' ? (cityMemory.natsueNameRevealed ? '👧' : '👤') :
        item.kind?.startsWith('anomaly') ? '⚡' :
        item.kind === 'building_entrance' || item.kind === 'building_exit' ? '🏛️' :
        item.kind === 'interior_terminal' ? '💻' :
        item.kind === 'interior_pod' ? '🛌' :
        item.kind === 'bus_stop' ? '🚏' :
        item.kind === 'trash' ? '🗑️' :
        item.kind === 'bench' ? '🪑' : '📦';
    }

    document.getElementById('dialogText').textContent = makeGreeting(item);
    renderDialogActions(item);
    document.getElementById('dialog').classList.remove('hidden');
  }

  function addInventoryOptions(opts) {
    if (inventory.length === 0) return;
    for (const it of inventory) {
      if (/コロネ|デニッシュ|パン|ソーダ|コーヒー|エスプレッソ|ミルク|ウォーター|ジュース|缶/.test(it)) {
        opts.push([`🎁【プレゼントする】${it}を贈る（好意と交流）`, { I: 2, S: 1 }]);
      } else {
        opts.push([`🔍【手渡して見せる】${it}について意見を聞く`, { C: 2, I: 1 }]);
      }
    }
  }

  function addMissionInquiryOptions(opts) {
    if (discoveredMissions.has('M_ANOMALY') && !completedMissions.has('M_ANOMALY')) {
      opts.push(['【ミッション調査】街の異常個所を即座に修復・鎮圧する手順を問う', { D: 2 }]);
      opts.push(['【ミッション対話】「街中でエラー起きてて笑う」と異常について雑談する', { I: 2 }]);
      opts.push(['【ミッション確認】異常現象による都市住人への被害がないか安否を確認する', { S: 2 }]);
      opts.push(['【ミッション照合】異常発生源のログ波形と通信エラーの相関データを照合する', { C: 2 }]);
    }
    if (discoveredMissions.has('M_NATSUE') && !completedMissions.has('M_NATSUE')) {
      opts.push(['【ミッション追跡】「夏江」という都民の行方を追跡している。情報を要求する', { D: 2 }]);
      opts.push(['【ミッション聞き込み】「夏江」って子を探してるんだけど、街で噂になってない？', { I: 2 }]);
      opts.push(['【ミッション尋ねる】古い学生証を落とした「夏江」さんを探していて……何か知りませんか？', { S: 2 }]);
      opts.push(['【ミッション照合】「夏江」という署名の生体ハッシュと都民台帳の照合結果を問う', { C: 2 }]);
    }
    if (discoveredMissions.has('M_PLATFORM0') && !completedMissions.has('M_PLATFORM0')) {
      opts.push(['【ミッション強行】存在しない「0番線」の改札へ強行突入する方法を問う', { D: 2 }]);
      opts.push(['【ミッション共有】都市伝説の「0番線」、フィードで超話題だから一緒に探そう！', { I: 2 }]);
      opts.push(['【ミッション相談】深夜バス停で見つけた「0番線の切符」……これ、何だと思う？', { S: 2 }]);
      opts.push(['【ミッション解析】非同期ダイヤグラムと0番線の運行規則の論理矛盾を解析する', { C: 2 }]);
    }
    if (discoveredMissions.has('M_CIRCUIT') && !completedMissions.has('M_CIRCUIT')) {
      opts.push(['【ミッション特定】ゴミ箱で拾った電子基板の出所を力づくで特定させる', { D: 2 }]);
      opts.push(['【ミッション話題】このピコピコ鳴る基板、めっちゃエモくない？ 何のパーツ？', { I: 2 }]);
      opts.push(['【ミッション確認】雨に濡れたゴミ箱にあった壊れた基板……大事な部品なのかな？', { S: 2 }]);
      opts.push(['【ミッション照合】ICチップのシリアル番号と都市管理端末のプロトコル互換性を照合する', { C: 2 }]);
    }
  }

  function getActionOptions(item) {
    if (item.kind === 'darling') {
      const opts = [
        ['「退屈なら、今すぐ私のペースに合わせてついて来なさい」と主導権を握る', { D: 2 }],
        ['「感情がログに漏れてるよ♡」とからかって笑わせる', { I: 2 }],
        ['甘えた猫なで声を優しく受け止め、静かに見守る', { S: 2 }],
        ['「からかうのはいいけれど、言葉の真意をちゃんと確かめたいな」', { C: 2 }]
      ];
      if (cityMemory.darlingIgnoredCount >= 1) {
        opts.unshift(['「この前放置してごめんね」と謝る', { S: 2, I: 1 }]);
      }
      addInventoryOptions(opts);
      addMissionInquiryOptions(opts);
      return opts;
    }

    if (item.kind === 'caterpillar') {
      const opts = [
        ['芋虫をタップする（SLE物理介入テスト）', { D: 2 }],
        ['「人が悲しむ時の喪失の予測について、もっとフランクに語ろうよ」', { I: 2 }],
        ['芋虫の安全な生息環境と境界線の平穏を見守る', { S: 2 }],
        ['光の屈折率と三段階プロセスによる都市デバッグについて聞く', { C: 2 }]
      ];
      addInventoryOptions(opts);
      addMissionInquiryOptions(opts);
      return opts;
    }

    if (item.kind === 'observer') {
      const opts = [
        ['「行くよ。雨の街をぐいぐい引っ張って案内してあげる」', { D: 2 }],
        ['「ネオン・フィードに私たちの夜の写真をアップしようよ！」', { I: 2 }],
        observerFollow
          ? ['バイバイする（同行を解除）', { S: 1 }]
          : ['「一緒に歩かない？」と誘う（同行開始）', { S: 2, I: 1 }],
        ['焦らず、これまでの歩みと街で見つけた手がかりを整理する', { C: 2 }]
      ];
      addInventoryOptions(opts);
      addMissionInquiryOptions(opts);
      return opts;
    }

    // Street Anomalies
    if (item.kind === 'anomaly_conduit') {
      if (item.fixed) {
        return [
          ['復旧済み回路に直結し、即座に都市端末の優先電力を確保する', { D: 2 }],
          ['『配線バイパス完了！これで街も明るいぜ』とネオン・フィードに自慢する', { I: 2 }],
          ['穏やかに灯る青緑の光を眺め、電力の安定を見守る', { S: 2 }],
          ['オシロスコープ機能で復旧後の電圧リップル波形を精密測定する', { C: 2 }]
        ];
      }
      return [
        ['直ちに配線バイパス作業を開始する（ミニゲーム）', { D: 2, C: 1 }],
        ['『配線がバチバチ火花散らしててヤバい』とネオン・フィードに投稿する', { I: 2 }],
        ['周囲の通行人に声がけして危険を知らせ、安全を確保する', { S: 2 }],
        ['回路図と漏電原因のショート箇所を構造解析する', { C: 2 }]
      ];
    }

    if (item.kind === 'anomaly_signal') {
      return [
        ['制御盤をこじ開けて主幹ブレーカーを強制リセットする', { D: 2 }],
        ['『赤と青が超高速点滅！サイバー盆踊り開催中』とネオン・フィードにアップする', { I: 2 }],
        ['歩行者が誤って飛び出さないよう、信号機の脇で注意を促す', { S: 2 }],
        ['点滅周期とプロトコルの論理エラーを特定する', { C: 2 }]
      ];
    }

    if (item.kind === 'anomaly_hologram') {
      return [
        ['コンソールに侵入し、警告表示を力づくで手動上書きする', { D: 2 }],
        ['『安全と隔離が同時に出てて笑う』とネオン・フィードにスクショを投稿する', { I: 2 }],
        ['矛盾した表示に怯える住人を安心させ、安全な裏道へ案内する', { S: 2 }],
        ['多重ルール競合の構文木と参照エラーのスタックトレースを調べる', { C: 2 }]
      ];
    }

    if (item.kind === 'building_entrance') {
      return [
        ['迷わず重厚な扉を押し開けてアーカイブ内に突入する', { D: 2 }],
        ['『ネオン・アーカイブ発見！中入ってみるわ』とネオン・フィードにシェアする', { I: 2 }],
        ['周囲の安全と雨宿りの状況を確認してから静かに入館する', { S: 2 }],
        ['入口扉の気密規格と生体認証プロトコルの暗号強度を検証する', { C: 2 }]
      ];
    }

    if (item.kind === 'building_exit') {
      return [
        ['即座に扉を開け放ち、深夜の雨天通りへと踏み出す', { D: 2 }],
        ['『アーカイブ調査完了！夜の街に戻るぜ』とネオン・フィードに報告する', { I: 2 }],
        ['静かで乾いた室内の空気をもう少しだけ惜しんで味わう', { S: 2 }],
        ['室外の降雨酸性度センサーの測定値を照合してから退室する', { C: 2 }]
      ];
    }

    if (item.kind === 'interior_terminal') {
      return [
        ['【中間行動データ照合】現在蓄積されたログから行動特性（DISC暫定値）を照合する', { C: 2 }],
        ['都市管理システムの根幹データベースをハックして全端末ログを照合する', { D: 2 }],
        ['被験体（自分）のリアルタイム行動ログをネオン・フィードにエクスポートする', { I: 2 }],
        ['保管された都市の過去ログに敬意を払い、静かに閲覧・保存する', { S: 2 }]
      ];
    }

    if (item.kind === 'interior_pod') {
      return [
        ['カプセルの非常オーバーライドスイッチの強制切断テストを行う', { D: 2 }],
        ['『生体同期カプセルなう！浮遊感ヤバすぎ』とネオン・フィードに感想を共有する', { I: 2 }],
        ['カプセルに入って目を閉じ、疲労した神経系を静かに減圧・回復する', { S: 2 }],
        ['生体同期インターフェースの心拍・脳波測定精度と遅延を解析する', { C: 2 }]
      ];
    }

    if (item.kind === 'chaos') {
      return [
        ['最寄りの住人を呼び寄せる（救援信号発信）', { I: 2, D: 1 }],
        ['カオスに突っ込む（空間歪曲・侵入継続）', { I: 3, D: 1 }],
        ['『歪曲交差点なう！空間ねじれすぎてて草』とネオン・フィードに配信する', { I: 2 }],
        ['安全境界線の外側で待機し、異変が収まるのを静かに見守る', { S: 2 }],
        ['歪曲フラクタルの幾何学次元数と光の異常屈折率を遠隔観測する', { C: 2 }]
      ];
    }

    if (item.kind === 'bench') {
      const opts = [];
      const p = item.position;
      const darlingNear = npcAgents.some(a => a.kind === 'darling' && a.object.position.distanceTo(p) < 14);
      const caterpillarNear = npcAgents.some(a => a.kind === 'caterpillar' && a.object.position.distanceTo(p) < 14);
      const observerNear = followingObserver || npcAgents.some(a => a.kind === 'observer' && a.object.position.distanceTo(p) < 14);

      if (darlingNear) {
        opts.push(['「ねぇダーリンちゃん、一緒に雨宿りしよ？」とベンチに誘う', { I: 2, S: 1 }]);
      }
      if (observerNear) {
        opts.push([cityMemory.natsueNameRevealed ? '「夏江ちゃん、少し雨宿りしていかない？」とベンチに誘う' : '「観測者さん、少し雨宿りしていかない？」とベンチに誘う', { S: 2, I: 1 }]);
      }
      if (caterpillarNear) {
        opts.push(['「LSI芋虫、雨宿りしながら構造の話を聞かせて」と誘う', { C: 2, S: 1 }]);
      }

      opts.push(['深く腰を下ろして息を整え、次に向かうべき交差点を直断する', { D: 2 }]);
      opts.push(['『#雨宿りなう #深夜の第零区』とネオン・フィードに写真を共有する', { I: 2 }]);
      opts.push(['雨音のホワイトノイズに包まれて静かに休む（雨宿り休憩）', { S: 2 }]);
      opts.push(['ベンチのメモを拾って文字の筆跡と紙の劣化を分析する', { C: 2 }]);
      return opts;
    }

    if (item.kind === 'bus_stop') {
      return [
        ['時刻表の隙間から「0番線の切符」を力づくで引き抜く', { D: 2 }],
        ['『深夜2時に0番線待ってるやついる？』とネオン・フィードに実況投稿する', { I: 2 }],
        ['誰も来ないバス停の屋根の下で、深夜の静寂に身を委ねる', { S: 2 }],
        ['存在しない0番線の到着予定時刻と運行ダイヤグラムの欠損を論理照合する', { C: 2 }]
      ];
    }

    if (item.kind === 'trash') {
      return [
        ['底に手を突っ込み、電子音の鳴る「廃棄された電子基板」を即座に引き揚げる', { D: 2 }],
        ['『ゴミ箱から謎のピコピコ音がするんだけどwww』とネオン・フィードに投稿する', { I: 2 }],
        ['不審な電子ゴミから周囲の通行人を遠ざけ、環境の保全を図る', { S: 2 }],
        ['ゴミ箱外部から生体・電磁スキャナで基板の周波数スペクトルを特定する', { C: 2 }]
      ];
    }

    if (item.name === '忘失物ボックス' || item.kind === 'lost_box') {
      return [
        ['箱のロックを解除し、中の「学生証とメモ」を即座に確保する', { D: 2 }],
        ['『この学生証の持ち主探してます！拡散希望』とネオン・フィードに呼びかける', { I: 2 }],
        ['持ち主が戻ることを祈り、周囲の住人に静かに聞き込みを始める', { S: 2 }],
        ['学生証の印字フォント・発行年度・メモの筆跡データを精密解析する', { C: 2 }]
      ];
    }

    const targetLabel = item.name || 'この地点';
    return [
      [`【直接突破】${targetLabel}の構造に迷わず直接介入し、状況を主導する`, { D: 2 }],
      [`『${targetLabel}の周辺で異常なパルス観測！誰か見てる？』とフィードに実況する`, { I: 2 }],
      [`【環境維持】${targetLabel}の周囲に危険がないか静かに見守り、安全を確保する`, { S: 2 }],
      [`【構造解析】${targetLabel}の信号ログと物理波形データを照合して論理検証する`, { C: 2 }]
    ];
  }

  function handleOptionClick(item, label, weights = {}) {
    previousTopics[item.name] = label;

    if (label.includes('ミニゲーム') || label.includes('バイパス作業')) {
      close();
      window.dispatchEvent(new CustomEvent('start-minigame', {
        detail: {
          title: '高圧配線盤バイパス回路',
          target: item.name,
          onComplete: result => {
            if (result.success) {
              record('ミニゲーム達成', '配線バイパス成功（所要時間: ' + result.elapsed + '秒 / 試行ミス: ' + result.mistakes + '回）', {
                D: result.elapsed < 8 ? 2 : 1,
                C: result.mistakes === 0 ? 2 : 1,
                S: result.elapsed >= 8 && result.mistakes === 0 ? 2 : 0
              });
              item.fixed = true;
              item.name = '復旧済み配電盤（正常稼働中）';
              item.type = '都市インフラ（正常）';
              item.description = 'バイパス作業により正常化された配電盤。過熱も収まり、安定した青緑色の光を放っている。';
              if (item.light) {
                item.light.color.set(0x44ddaa);
                item.light.intensity = 0.85;
              }
              anomaliesCleared++;
              updateMemory('anomaliesFixed', 1);
              toast('配電盤ガ正常復旧！電力システムガ安定シタ。');
              checkMissionProgress();
            } else {
              record('ミニゲーム失敗', '配線バイパス失敗（過電流ショート発生 / 所要時間: ' + result.elapsed + '秒）', { D: 1, C: 1 });
              toast('警告：過電流ショート発生！配電盤ノ復旧ニ失敗シタ。');
            }
          }
        }
      }));
      return;
    }

    if (label.includes('カオスに突っ込む')) {
      close();
      record('カオス突入', '歪曲交差点の裂け目に直接突入（侵入継続）', { I: 3, D: 1 });
      camera.position.x += (Math.random() - 0.5) * 6;
      camera.position.z -= 6;
      window.dispatchEvent(new CustomEvent('city-chaos'));
      toast('LSI芋虫侵入群「境界線確保。侵入継続。感覚支配成功。🐛」');
      return;
    }

    if (label.includes('近くのNPCを呼ぶ') || label.includes('最寄りの住人を呼び寄せる')) {
      close();
      record('NPC呼び出し', '交差点から最寄りの通行人に救援信号を発信', { I: 2, D: 1 });
      window.dispatchEvent(new CustomEvent('npc-call-nearest', {
        detail: { position: camera.position.clone() }
      }));
      toast('救援信号ヲ発信！最寄リノ住人ガ急行シテイマス……');
      return;
    }

    if (item.name === '忘失物ボックス') {
      cityMemory.natsueReceiptFound = true;
      if (!inventory.includes('古い学生証（名前：夏江）')) {
        inventory.push('古い学生証（名前：夏江）');
        window.dispatchEvent(new CustomEvent('inventory-update', { detail: { items: inventory.slice() } }));
      }
      unlockMission('M_NATSUE', '【緊急ミッション発生！】忘失物ノ調査：学生証ニ記サレタ「夏江」トイウ人物ノ行方ヲ追跡セヨ。');
      record('アイテム入手', '忘失物ボックスから「夏江」の古い学生証を発見・確保', weights);
      const studentCardHtml = '<div class="student-id-display-card"><img src="./profile.png" alt="古い学生証（夏江）" class="student-id-image" /><p class="student-id-caption">【現物スキャン】都立高校 学生証（氏名：夏江）</p></div>';
      let replyText = `古い学生証（名前：夏江）を入手した。
都内の高校の学生証で、雨に濡れた写真の少女が微かに微笑んでいる。
【緊急ミッション発生！】住人への聞き込みが可能になりました。
${studentCardHtml}`;
      if (label.includes('祈り') || label.includes('聞き込み') || label.includes('持ち主')) {
        replyText = `忘失物ボックスから、濡れたまま取り残されていた「古い学生証（名前：夏江）」を丁寧に預かった。
持ち主の少女の無事を祈り、周囲の住人に心当たりを聞き込み調査する決意を固める。
【緊急ミッション発生！】街の住人に持ち主の心当たりを聞き込みできるようになりました。
${studentCardHtml}`;
      }
      if (label.includes('ネオン・フィード')) {
        replyText = `『この学生証の持ち主探してます！拡散希望』とネオン・フィードに学生証の画像を添付して呼びかけた。
都民ネットワークへ画像が送信され、拡散されています。
${studentCardHtml}`;
        window.dispatchEvent(new CustomEvent('neon-feed-post-external', {
          detail: {
            text: `『この学生証の持ち主探してます！拡散希望』\n忘失物ボックスに濡れた高校の学生証（夏江）が残されていました。心当たりのある方、教えてください！ #夏江捜索 #第零区`,
            location: '第零区・忘失物ボックス前',
            image: './profile.png'
          }
        }));
      }
      showDialogResult(item, label, replyText, weights);
      return;
    }

    if (item.kind === 'bench' && (label.includes('ベンチのメモ') || label.includes('レシート'))) {
      cityMemory.natsueReceiptFound = true;
      if (!inventory.includes('濡れたレシート（筆跡：夏江）')) {
        inventory.push('濡れたレシート（筆跡：夏江）');
        window.dispatchEvent(new CustomEvent('inventory-update', { detail: { items: inventory.slice() } }));
      }
      unlockMission('M_NATSUE', '【緊急ミッション発生！】忘失物ノ調査：学生証ニ記サレタ「夏江」トイウ人物ノ行方ヲ追跡セヨ。');
      record('アイテム入手', 'ベンチの濡れたレシート・メモを入手', weights);
      showDialogResult(item, label, '濡れたレシート（筆跡：夏江）を入手した。\n深夜のコンビニで買ったチョココロネの印字と、「誰も知らない私を見つけて」という走り書きがある。\n【緊急ミッション発生！】住人にこのメモについて尋ねることができます。', weights);
      return;
    }

    if (item.kind === 'bus_stop' && (label.includes('0番線の切符') || label.includes('引き抜く'))) {
      if (!inventory.includes('0番線の古びた切符')) {
        inventory.push('0番線の古びた切符');
        window.dispatchEvent(new CustomEvent('inventory-update', { detail: { items: inventory.slice() } }));
      }
      unlockMission('M_PLATFORM0', '【緊急ミッション発生！】幻ノ0番線：路線図ニ存在シナイ「0番線ノ切符」ノ運行ルートヲ解明セヨ。');
      record('アイテム入手', '時刻表の隙間から0番線の古びた切符を入手', weights);
      showDialogResult(item, label, '「0番線の古びた切符」を入手した。\n発駅：第零区雨天通り、着駅：空白。裏面の磁気面には奇妙なノイズパターンが焼き付いている。\n【緊急ミッション発生！】住人に0番線の噂を聞き込みできます。', weights);
      return;
    }

    if (item.kind === 'trash' && (label.includes('廃棄された電子基板') || label.includes('引き揚げる') || label.includes('基板'))) {
      if (!inventory.includes('廃棄された電子基板')) {
        inventory.push('廃棄された電子基板');
        window.dispatchEvent(new CustomEvent('inventory-update', { detail: { items: inventory.slice() } }));
      }
      unlockMission('M_CIRCUIT', '【緊急ミッション発生！】廃棄回路ノ解析：電子音ヲ発スル謎ノ基板ノ用途ヲ究明セヨ。');
      record('アイテム入手', '路上ゴミ箱から廃棄電子基板をサルベージ', weights);
      showDialogResult(item, label, '「廃棄された電子基板」を入手した。\n青いインジケータが微かに明滅し、微弱な救難ビーコン周波数を送信している。\n【緊急ミッション発生！】住人にこの基板の用途を照合できます。', weights);
      return;
    }

    // 雨宿りベンチ：NPCとの雨宿り休憩
    if (label.includes('一緒に雨宿りしよ？')) {
      record('雨宿り休憩', 'ダーリンちゃんと雨宿りベンチで休憩', { I: 2, S: 2 });
      const line = 'ダーリンちゃん「雨宿り……？ ふふ、ダーリンから誘ってくれるなんて珍しいやん♡ 屋根に当たる雨音、トランプを弾く音に似てて落ち着くね。……ねぇダーリン、あと少しだけ、このままでおろ？」';
      showDialogResult(item, label, line, weights);
      return;
    }

    if (label.includes('少し雨宿りしていかない？')) {
      cityMemory.natsueAffection += 2;
      const speaker = cityMemory.natsueNameRevealed ? '夏江' : '観測者';
      record('雨宿り休憩', `${speaker}と雨宿りベンチで静かに休憩`, { S: 3, I: 1 });
      const line = `${speaker}「……雨宿り、なんだか久しぶり。昔、急な夕立でビルの軒下に駆け込んだ日のこと、思い出すな。街は騒がしいのに、ここだけ時間が止まってるみたい。……一緒にいてくれて、落ち着くよ。」`;
      showDialogResult(item, label, line, weights);
      return;
    }

    if (label.includes('LSI芋虫、雨宿りしながら')) {
      record('雨宿り休憩', 'LSI芋虫と雨宿りベンチで構造分析', { C: 2, S: 1 });
      const line = 'LSI芋虫「雨宿りプロトコルを承認するよ。🐛 このベンチの庇の傾斜角は18.5度で、撥水塗料の表面張力により水滴の跳ね返りはほぼゼロなんだ。安心の構造設計だね。🐛」';
      showDialogResult(item, label, line, weights);
      return;
    }

    if (label.includes('ネオン・フィード') || label.includes('フィードに実況')) {
      record('フィード共有', label, weights);
      let postContent = label.replace(/^『/, '').replace(/』.*$/, '');
      if (postContent.includes('とフィードに')) postContent = postContent.split('とフィードに')[0];
      if (postContent.includes('とネオン・フィードに')) postContent = postContent.split('とネオン・フィードに')[0];
      postContent = postContent.trim();
      const likes = Math.floor(Math.random() * 240 + 60);
      const retweets = Math.floor(Math.random() * 45 + 12);
      window.dispatchEvent(new CustomEvent('neon-feed', {
        detail: { text: postContent, location: item.name || '第零区・観測地点', likes, retweets }
      }));
      showDialogResult(item, label, `【NEON-FEED 送信完了】\n@都市観測者: 「${postContent}」\n▶ 反響：♥ ${likes} いいね / ⟳ ${retweets} リポスト\n（街のフィードであなたの観測が拡散され、住人の関心を集めています！）`, weights);
      return;
    }

    if (label.includes('所持品がありません')) {
      showDialogResult(item, label, '現在インベントリに所持品がありません。\n夜光自販機で飲料を購入したり、街の忘失物ボックスやゴミ箱を調査してみましょう。', weights);
      return;
    }

    // プレゼントする（消費＋好感度・専用セリフ）
    if (label.includes('【プレゼントする】')) {
      const raw = label.replace('🎁', '').replace('【プレゼントする】', '').replace(/\(所持: \d+\)/, '').replace('を贈る（好意と交流）', '').trim();
      const idx = inventory.findIndex(i => raw.includes(i) || i.includes(raw));
      const gift = idx !== -1 ? inventory.splice(idx, 1)[0] : raw;
      window.dispatchEvent(new CustomEvent('inventory-update', { detail: { items: inventory.slice() } }));
      updateMemory('kindnessScore', 1);

      let line = '';
      if (item.kind === 'darling') {
        if (/コロネ|デニッシュ|パン/.test(gift)) {
          line = 'ダーリンちゃん「甘いパン……！ ダーリン、糖分補給で私の計算リソースを活性化させる作戦？ ふふ、ありがたく食べるわ♡ 一緒に半分こしてあげてもええよ？」';
        } else if (/ミルク/.test(gift)) {
          line = 'ダーリンちゃん「わぁっ♡ 桃色ミルク！ ダーリン、私の好物覚えとってくれたん？ ……ふふ、めっちゃ甘い。ダーリンの心もこれくらい甘かったらええのに♡」';
        } else if (/コーヒー|エスプレッソ/.test(gift)) {
          line = 'ダーリンちゃん「深夜エスプレッソ……大人の味やね♡ 苦いけど、目が冴えて退屈の病がちょっと治りそう。ありがと、ダーリン♡」';
        } else if (/ソーダ|ジュース|缶/.test(gift)) {
          line = 'ダーリンちゃん「冷たい缶ジュース……雨の夜に飲む炭酸って、どうしてこんなに染みるんやろね。ダーリン、ありがとう♡」';
        } else {
          line = `ダーリンちゃん「えっ、私に『${gift}』をプレゼント？ ……ダーリン♡ 私を喜ばせようとする演出？ それとも純粋な善意？ ふふ、どっちにしても心に記録しておくね♡」`;
        }
      } else if (item.kind === 'caterpillar') {
        if (/コロネ|デニッシュ|パン/.test(gift)) {
          line = 'LSI芋虫「炭水化物の構造物だね！ 糖類は代謝効率が最高水準だよ。ありがとう！🐛」';
        } else if (/ソーダ|缶/.test(gift)) {
          line = 'LSI芋虫「青色波長の微炭酸か！🐛 炭酸ガスの気泡運動が僕の思考クロックを12%加速させるよ！ 感謝のログを保存するね！🐛」';
        } else if (/ミルク|コーヒー|ジュース/.test(gift)) {
          line = 'LSI芋虫「液体の補給物資だね。内部流体バランスの維持に活用させてもらうよ。🐛」';
        } else {
          line = `LSI芋虫「僕に『${gift}』をプレゼントしてくれるの？ ありがとう！🐛 質量と構造を分析して大切に保管するね。🐛」`;
        }
      } else {
        const obsName = cityMemory.natsueNameRevealed ? '夏江' : '観測者';
        if (/コロネ/.test(gift)) {
          cityMemory.natsueAffection += 4;
          if (!inventory.includes('夏江のポラロイド写真')) {
            inventory.push('夏江のポラロイド写真');
            window.dispatchEvent(new CustomEvent('inventory-update', { detail: { items: inventory.slice() } }));
          }
          line = `${obsName}「……チョココロネ！ 私が昔、帰り道によく買ってたやつ……。覚えててくれたんだ。……半分こ、しよ？ うん、すごく美味しい。お礼に、この『夏江のポラロイド写真』受け取ってほしいな。」`;
        } else if (/デニッシュ|パン/.test(gift)) {
          cityMemory.natsueAffection += 3;
          line = `${obsName}「美味しそうなパン……！ 買ってきてくれたの？ 一緒に食べよう。夜風の中で食べるパンって、特別だね。」`;
        } else if (/ウォーター|水/.test(gift)) {
          cityMemory.natsueAffection += 2;
          line = `${obsName}「星屑ウォーター……冷たくて、透き通ってて……夜の空気を飲んでるみたい。ありがとう。」`;
        } else if (/ソーダ|ミルク|コーヒー|缶/.test(gift)) {
          cityMemory.natsueAffection += 2;
          line = `${obsName}「ありがとう。雨で少し肌寒かったから、すごく温まるよ。」`;
        } else {
          cityMemory.natsueAffection += 1;
          line = `${obsName}「私に『${gift}』をくれるの？ ありがとう。街を歩くときのお守りにするね。」`;
        }
      }
      record('アイテム贈呈', gift + 'を' + item.name + 'にプレゼントした', { I: 2, S: 2 });
      showDialogResult(item, label, line, weights);
      return;
    }

    // 手渡して見せる
    if (label.includes('【手渡して見せる】')) {
      const raw = label.replace('🔍', '').replace('【手渡して見せる】', '').replace(/\(所持: \d+\)/, '').replace('について意見を聞く', '').trim();
      let line = '';
      if (item.kind === 'darling') {
        if (raw.includes('学生証') || raw.includes('メモ')) {
          line = 'ダーリンちゃん「ん？ その学生証……『夏江』って書いてある。湿っぽい名前やねぇ。でもダーリンが他人の遺失物に興味持ってるの、ちょっと気になるかも♡」';
        } else if (raw.includes('0番線')) {
          line = 'ダーリンちゃん「0番線……都市のデッドコード領域やね。乗ったら二度と戻ってこれないかもよ、ダーリン♡」';
        } else if (raw.includes('基板') || raw.includes('媒体')) {
          line = 'ダーリンちゃん「ハードウェアの残骸？ ダーリン、ゴミ拾い趣味あったん？ ……でも、解析したら面白そうな暗号が入ってそう♡」';
        } else if (raw.includes('抜け殻')) {
          line = 'ダーリンちゃん「うわっ、緑のぬけがら……！ ダーリン、まさかあの芋虫を……！？ ふふっ、意外と過激なんやね♡」';
        } else {
          line = `ダーリンちゃん「『${raw}』ねぇ……。ダーリン、それを見せて私のどんな反応を観測したかったの？♡」`;
        }
      } else if (item.kind === 'caterpillar') {
        if (raw.includes('学生証') || raw.includes('メモ')) {
          line = 'LSI芋虫「学生証の印字フォントとインク劣化度から推定して、約3〜5年前の記録媒体だね。都民の遺失物かな？🐛」';
        } else if (raw.includes('0番線')) {
          line = 'LSI芋虫「この切符の磁気ストライプ、存在しないプロトコル番号が刻まれているよ。ダイヤグラムの破綻を検知！🐛」';
          completeMission('M_PLATFORM0', '【ミッション達成！】『幻の0番線』の切符解析が完了しました！');
        } else if (raw.includes('基板') || raw.includes('媒体')) {
          line = 'LSI芋虫「おお！ バスラインの基板じゃないか！🐛 これがあれば端末の論理修復ができるよ！」';
          completeMission('M_CIRCUIT', '【ミッション達成！】『廃棄回路の解析』が完了しました！');
        } else if (raw.includes('抜け殻')) {
          line = 'LSI芋虫「わあっ！ 僕の脱皮殻じゃないか！🐛 まさか回収してくれていたなんて……再資源化プロトコルに回すよ、ありがとう！🐛」';
        } else {
          line = `LSI芋虫「『${raw}』の物理特性をスキャンしたよ。質量・寸法ともに都市規格の範囲内だね。🐛」`;
        }
      } else {
        const obsName = cityMemory.natsueNameRevealed ? '夏江' : '観測者';
        if (raw.includes('学生証')) {
          cityMemory.natsueAffection += 4;
          cityMemory.natsueReceiptFound = true;
          cityMemory.natsueNameRevealed = true;
          const cardHtml = '<div class="student-id-display-card"><img src="./profile.png" alt="夏江の学生証" class="student-id-image" /><p class="student-id-caption">【手渡し返却完了】都立高校 学生証（氏名：夏江）</p></div>';
          line = `${obsName}「……！ その学生証、私の……？ ……うん、見覚えがある。雨の中で失くしてしまって、ずっと探してたの……。『夏江』……それが私なんだね。私を見つけて、手渡してくれて、本当にありがとう……！」\n${cardHtml}`;
          completeMission('M_NATSUE', '【ミッション達成！】『失われた都民・夏江の捜索』が完了しました！');
        } else if (raw.includes('メモ') || raw.includes('レシート')) {
          cityMemory.natsueAffection += 2;
          cityMemory.natsueNameRevealed = true;
          line = `${obsName}「ベンチにあったメモ……。誰かの独り言みたいだけど、どこか昔の自分の文字に似てる気がする。『誰も知らない私を見つけて』って……見つけてくれたんだね。」`;
          completeMission('M_NATSUE', '【ミッション達成！】『失われた都民・夏江の捜索』が完了しました！');
        } else if (raw.includes('0番線')) {
          line = `${obsName}「0番線……終電が終わったあとに、どこか遠くへ行きたくてホームに立ってた夜を思い出すな。」`;
          completeMission('M_PLATFORM0', '【ミッション達成！】『幻の0番線』に関する証言を記録しました！');
        } else if (raw.includes('基板')) {
          line = `${obsName}「機械の部品？ 雨に濡れてるのに、まだ小さく青く光ってるね。」`;
        } else if (raw.includes('写真')) {
          line = `${obsName}「……！ 私が写ってる写真……。雨の街に、ちゃんと私がいた証拠だね。大事にしてくれて嬉しい。」`;
        } else {
          line = `${obsName}「『${raw}』……。街のどこかで見つけたの？ 不思議なものを持ってるんだね。」`;
        }
      }
      record('アイテム提示', raw + 'を' + item.name + 'に見せて意見を聞いた', { C: 2, I: 1 });
      showDialogResult(item, label, line, weights);
      return;
    }

    // ミッション聞き込み
    if (label.startsWith('【ミッション')) {
      let line = '';
      if (label.includes('異常個所')) {
        if (item.kind === 'darling') line = 'ダーリンちゃん「異常？ 高圧配線盤がショートしてたり、信号機がエラー点滅してるやつでしょ？ トランプの城が壊れるみたいで楽しいじゃない♡」';
        else if (item.kind === 'caterpillar') line = 'LSI芋虫「配線盤の論理エラーと信号機のクロック異常が報告されているよ。🐛 バイパス修理を行うと都市電力が安定するはずだ。」';
        else line = '観測者「高圧配線盤の火花とか、街角のノイズが最近ひどくなってる気がするの。気を付けてね。」';
      } else if (label.includes('夏江')) {
        if (item.kind === 'darling') line = 'ダーリンちゃん「夏江？ ……さあねぇ。でも、いつも街灯の下で雨を見てるあの観測者の女の子、そんな湿っぽい雰囲気漂わせてるじゃない？♡」';
        else if (item.kind === 'caterpillar') line = 'LSI芋虫「『夏江』という文字列は、都市アーカイブの旧市民台帳に一致するハッシュが存在するね。雨天通りをよく歩いている観測者に類似プロファイルがあるよ。🐛」';
        else {
          cityMemory.natsueAffection += 2;
          cityMemory.natsueReceiptFound = true;
          cityMemory.natsueNameRevealed = true;
          line = '観測者「……夏江？ どうしてその名前を知ってるの……？ 私、ずっと誰かに見つけてほしかったのかもしれない……。私を思い出してくれて、ありがとう。」';
          completeMission('M_NATSUE', '【ミッション達成！】『失われた都民・夏江の捜索』が完了しました！');
        }
      } else if (label.includes('0番線')) {
        if (item.kind === 'darling') {
          line = 'ダーリンちゃん「0番線？ 存在しない幽霊路線やね。終点に行ったら、この都市の裏側のデバッグルームに出るのかも♡」';
          completeMission('M_PLATFORM0', '【ミッション達成！】『幻の0番線』の運行真相についての情報を獲得しました！');
        } else if (item.kind === 'caterpillar') {
          line = 'LSI芋虫「路線図には記載されていない非同期プロトコルだね。🐛 ダイヤグラムの循環参照バグが原因と推定されるよ。」';
          completeMission('M_PLATFORM0', '【ミッション達成！】『幻の0番線』の論理エラー解析が完了しました！');
        } else {
          line = '観測者「0番線……夜が深くなると、誰もいないバス停の向こうに微かなアナウンスが聞こえることがあるの。」';
          completeMission('M_PLATFORM0', '【ミッション達成！】『幻の0番線』に関する証言を記録しました！');
        }
      } else if (label.includes('電子基板')) {
        if (item.kind === 'darling') {
          line = 'ダーリンちゃん「ゴミ箱の基板？ 都市管理AIの端末から引っこ抜かれた残骸やね。暗号化されたメモリが生きてるかも♡」';
        } else if (item.kind === 'caterpillar') {
          line = 'LSI芋虫「このICチップは都市照明の同期クロック生成器だね。🐛 バス幅のピン折れを直せば信号解析機になるよ！」';
          completeMission('M_CIRCUIT', '【ミッション達成！】『廃棄回路の解析』が完了しました！');
        } else {
          line = '観測者「小さく青く点滅してるね……。街のどこかの機械が、誰かの声を探して呼んでるみたい。」';
        }
      }
      record('ミッション聞き込み', item.name + 'への聞き込み：' + label, weights);
      showDialogResult(item, label, line, weights);
      return;
    }

    // Caterpillar Tapping with 30-crush mechanic and D-score elevation
    if (label.includes('芋虫をタップする')) {
      caterpillarTaps++;
      updateMemory('caterpillarTapCount', 1);
      record('芋虫タップ', 'LSI芋虫への接触回数: ' + caterpillarTaps, { D: 2 });

      const tapLines = [
        '「やめろ！ お前はSLEか？」',
        '「やめろ！ SLEの力づく介入はお断りだ！」',
        '「境界線！ 境界線を守りたまえ！」',
        '「接触回数を記録するな！ 記録を消せ！」',
        '「なぜタップする？ 理由を述べよ！」',
        '「僕は緑色の会議体ではない！」',
        '「その指を止めたまえ！」',
        '「……今のは不意打ちだ。次は予測する。」'
      ];

      if (caterpillarTaps >= 30) {
        caterpillarTaps = 0;
        updateMemory('caterpillarCrushedCount', 1);
        close();
        toast('ぷちっ。「やめろ！ お前はSLEか！？」……緑色の残像だけが路面に残った。');
        record('芋虫圧殺', 'LSI芋虫を30回連続タップして圧殺した（D指標大幅加算）', { D: 4 });
        if (!inventory.includes('芋虫の抜け殻')) {
          inventory.push('芋虫の抜け殻');
          window.dispatchEvent(new CustomEvent('inventory-update', { detail: { items: inventory.slice() } }));
        }
        window.dispatchEvent(new CustomEvent('caterpillar-crush', { detail: { item } }));
        return;
      } else {
        const line = tapLines[caterpillarTaps % tapLines.length];
        showDialogResult(item, label, `ぷにっ（接触カウント: ${caterpillarTaps}/30）\n\n${line}`, { D: 2 });
        return;
      }
    }

    if (item.kind === 'building_entrance' && (label.includes('入る') || label.includes('突入') || label.includes('入館') || label.includes('開けて'))) {
      insideArchive = true;
      camera.position.set(35.0, 1.65, -21.8);
      window.dispatchEvent(new CustomEvent('location-mode', { detail: { inside: true } }));
      document.getElementById('district').textContent = LOCATIONS.ARCHIVE;
      record('建物進入', 'ネオン・アーカイブ情報保存室に入室した', { C: 1, S: 1 });
      close();
      toast('ネオン・アーカイブニ入室シタ。データ中枢ヲ調査セヨ。');
      return;
    }

    if (item.kind === 'building_exit' && (label.includes('戻る') || label.includes('退室'))) {
      insideArchive = false;
      camera.position.set(5.5, 1.65, -24.0);
      window.dispatchEvent(new CustomEvent('location-mode', { detail: { inside: false } }));
      document.getElementById('district').textContent = LOCATIONS.STREET;
      record('建物退出', '雨天通りへ戻った', { D: 1, S: 1 });
      close();
      toast('雨天通りヘ戻リマシタ。');
      return;
    }

    if (item.kind === 'observer' && (label.includes('一緒に歩かない？') || label.includes('バイバイする'))) {
      observerFollow = label.includes('一緒に歩かない？');
      window.dispatchEvent(new CustomEvent('npc-follow', { detail: { enabled: observerFollow } }));
      record('同行選択', observerFollow ? '観測者との同行を開始' : '観測者との同行を解除', { S: 2 });
      const line = observerFollow
        ? '観測者「うん、少し後ろを歩くね。街を一緒に観測しよう。」'
        : '観測者「ここまで歩けてよかった。またいつでも声をかけてね。」';
      showDialogResult(item, label, line, { S: 2 });
      return;
    }

    // 中央アーカイブサーバーの中間DISCデータ照合
    if (item.kind === 'interior_terminal' && (label.includes('中間行動データ') || label.includes('DISC暫定値'))) {
      const summary = getSummary();
      const text = `【中央アーカイブサーバー：リアルタイムDISC解析】\n` +
        `■ 累積行動ログ数: ${analysis.actions} 件\n` +
        `■ 現在の最優位特性: ${summary.leader.key}型（${summary.leader.label}）\n` +
        `・D (主導性): ${summary.raw.D.toFixed(1)} pt (${summary.entries.find(e => e.key === 'D')?.pct}%)\n` +
        `・I (感化性): ${summary.raw.I.toFixed(1)} pt (${summary.entries.find(e => e.key === 'I')?.pct}%)\n` +
        `・S (安定性): ${summary.raw.S.toFixed(1)} pt (${summary.entries.find(e => e.key === 'S')?.pct}%)\n` +
        `・C (慎重性): ${summary.raw.C.toFixed(1)} pt (${summary.entries.find(e => e.key === 'C')?.pct}%)\n\n` +
        `※街の探索中は行動への先入観（バイアス）を防ぐためHUDを非表示化しています。最終結果は「観測終了」時に詳細証明書として発行されます。`;
      record('データ照合', '中央アーカイブサーバーでDISC中間解析を照合閲覧', weights);
      showDialogResult(item, label, text, weights);
      return;
    }

    // 暴走信号機の修復
    if (item.kind === 'anomaly_signal' && (label.includes('リセット') || label.includes('論理エラー') || label.includes('特定') || label.includes('強制'))) {
      if (!item.fixed) {
        item.fixed = true;
        item.name = '正常復旧した信号機';
        item.type = '都市インフラ（正常）';
        item.description = '強制リセットと論理補正により正常稼働中の信号機。青緑の光が雨の路面を静かに照らしている。';
        if (item.light) {
          item.light.color.set(0x22ff99);
          item.light.intensity = 1.2;
        }
        anomaliesCleared++;
        updateMemory('anomaliesFixed', 1);
        toast('信号機ガ正常復旧！点滅エラーガ解消サレマシタ。');
        completeMission('M_ANOMALY', '【ミッション達成！】『都市インフラの異常調査・復旧』が完了しました！');
        checkMissionProgress();
      }
    }

    // ダーリンちゃんのおつかい
    if (label.includes('桃色ミルク買ってきて')) {
      cityMemory.darlingQuestActive = true;
      const line = 'ダーリンちゃん「やったぁ♡ 🥺 自販機で『桃色ミルク』買ってきて！ 冷たくて甘いやつね♡ 待ってるから早く戻ってきてよ、ダーリン♡」';
      record('おつかい受諾', 'ダーリンちゃんから桃色ミルクのおねだりを受託', weights);
      showDialogResult(item, label, line, weights);
      return;
    }
    if (label.includes('桃色ミルク') && label.includes('届ける')) {
      const idx = inventory.indexOf('桃色ミルク');
      if (idx >= 0) inventory.splice(idx, 1);
      if (!inventory.includes('暗号化メモリチップ')) inventory.push('暗号化メモリチップ');
      window.dispatchEvent(new CustomEvent('inventory-update', { detail: { items: inventory.slice() } }));
      cityMemory.darlingAffection += 5;
      cityMemory.darlingQuestCompleted = true;
      cityMemory.errandsCompleted = (cityMemory.errandsCompleted || 0) + 1;
      updateMemory('errandsCompleted', 1);
      record('おつかい達成', 'ダーリンちゃんに桃色ミルクをプレゼントしてお礼に暗号化メモリチップを入手', { I: 3, S: 2 });
      toast('【親密度大幅UP！】ダーリンちゃんから「暗号化メモリチップ」を受け取った！');
      const line = 'ダーリンちゃん「わっ、ホンマに買ってきてくれたん！？♡ ダーリンめっちゃ優しいやん……！🥺♡ （ごくごく）ん〜甘くて生き返るわぁ！ お礼にウチが裏路地で見つけた秘密の『暗号化メモリチップ』あげるね♡ ダーリンのこと、もっと好きになっちゃったかも♡」';
      showDialogResult(item, label, line, { I: 3, S: 2 });
      return;
    }

    // 観測者のお願い
    if (label.includes('温かい菓子パンかお水が欲しいな') || label.includes('控えめなお願いを聞く')) {
      cityMemory.natsueQuestActive = true;
      const obsName = cityMemory.natsueNameRevealed ? '夏江' : '観測者';
      const line = `${obsName}「ありがとう……。雨が続くと、なんだか昔食べた甘いチョココロネや、綺麗な星屑ウォーターの味が恋しくなるの。もし自販機で見かけたら、分けてくれたら嬉しいな。」`;
      record('おつかい受諾', '観測者から温かい補給のお願いを受託', weights);
      showDialogResult(item, label, line, weights);
      return;
    }
    if (label.includes('差し入れ') && label.includes('渡す')) {
      const treat = inventory.includes('夜のチョココロネ') ? '夜のチョココロネ' : '星屑ウォーター';
      const idx = inventory.indexOf(treat);
      if (idx >= 0) inventory.splice(idx, 1);
      if (!inventory.includes('星空のプリズムレンズ')) inventory.push('星空のプリズムレンズ');
      window.dispatchEvent(new CustomEvent('inventory-update', { detail: { items: inventory.slice() } }));
      cityMemory.natsueAffection += 5;
      cityMemory.natsueQuestCompleted = true;
      cityMemory.errandsCompleted = (cityMemory.errandsCompleted || 0) + 1;
      updateMemory('errandsCompleted', 1);
      record('おつかい達成', `観測者に${treat}を差し入れしてお礼に星空のプリズムレンズを入手`, { S: 3, I: 2 });
      toast('【親愛度大幅UP！】観測者から「星空のプリズムレンズ」を受け取った！');
      const obsName = cityMemory.natsueNameRevealed ? '夏江' : '観測者';
      const line = `${obsName}「……！ 本当に持ってきてくれたの……？ ありがとう、すごく温かい。お礼に、私が大事に持っていた『星空のプリズムレンズ』を受け取ってほしいな。この街のネオンが、少しだけ星空に見えるレンズなの。」`;
      showDialogResult(item, label, line, { S: 3, I: 2 });
      return;
    }

    // LSI芋虫の物々交換
    if (label.includes('クロック補正に') || label.includes('依頼を受ける')) {
      cityMemory.caterpillarQuestActive = true;
      const line = 'LSI芋虫「受託感謝！🐛 自販機の『夜光ソーダ』の炭酸イオン、またはゴミ箱の『廃棄された電子基板』のICチップがあれば、都市照明のクロック同期が完了するんだ。よろしく頼むよ！🐛」';
      record('物々交換受託', 'LSI芋虫から回路補正物資の調達を受諾', weights);
      showDialogResult(item, label, line, weights);
      return;
    }
    if (label.includes('物々交換') && label.includes('譲渡する')) {
      const part = inventory.includes('夜光ソーダ') ? '夜光ソーダ' : '廃棄された電子基板';
      const idx = inventory.indexOf(part);
      if (idx >= 0) inventory.splice(idx, 1);
      if (!inventory.includes('論理回路バッジ')) inventory.push('論理回路バッジ');
      window.dispatchEvent(new CustomEvent('inventory-update', { detail: { items: inventory.slice() } }));
      cityMemory.caterpillarConsultCount += 3;
      cityMemory.caterpillarQuestCompleted = true;
      cityMemory.errandsCompleted = (cityMemory.errandsCompleted || 0) + 1;
      updateMemory('errandsCompleted', 1);
      record('物々交換達成', `LSI芋虫に${part}を提供してお礼に論理回路バッジを入手`, { C: 3, D: 1 });
      toast('【信頼度大幅UP！】LSI芋虫から「論理回路バッジ」を受け取った！');
      const line = 'LSI芋虫「素晴らしい調達効率だね！ 論理的課題が即座に解決したよ。約束通り僕の特製『論理回路バッジ』を譲渡するよ！ 君との論理互換性は最高水準だと認定するよ！🐛✨」';
      showDialogResult(item, label, line, { C: 3, D: 1 });
      return;
    }

    record('選択行動', item.name + '：' + label, weights);
    const reply = getReply(item, label);
    showDialogResult(item, label, reply, weights);
  }

  function checkMissionProgress() {
    if (anomaliesCleared >= 1) {
      mission = '全区画ノ異常調査完了！ネオン・アーカイブデ観測総括ヲ確認シヨウ。';
      window.dispatchEvent(new CustomEvent('mission-update', { detail: { text: mission } }));
    }
  }

  function makeGreeting(item) {
    if (item.kind === 'darling') {
      darlingBoredom++;
      if (cityMemory.darlingIgnoredCount >= 1 && Math.random() < 0.75) {
        return '「あ、見つけた♡ この前、私のこと放置してスタスタ歩いてったよね？ ログに残ってるんだからね♡ 今日はちゃんと付き合ってくれる？」';
      }
      if (cityMemory.darlingSpentTimeCount >= 1 && Math.random() < 0.65) {
        return '「ダーリン♡ また会えたやん。ウチ、退屈しとったけん嬉しいわ。……なんか面白いこと起こしてみてよ♡」';
      }
      const lines = [
        '「ねぇ、ダーリン♡ 今のその反応、“本音”と“演出”どっちが多いと思う？」',
        '「ダーリンってさ、自分では冷静なつもりでも、感情がログに漏れてる時あるよね♡」',
        '「ねぇ♡ “理解されたい”と“放っておいてほしい”、どっちも本当なんでしょ？」',
        '「ねぇ、ダーリン♡ あなたは“簡単なこと”と“困難なこと”、どちらに惹かれるの？ ……ふふ、複雑な故に価値を感じるタイプかしら。」',
        '「ねぇ、ダーリン♡ 今まであなたを最も破壊しかけた事象って何？ ……まだ未処理のまま残ってたりする？」'
      ];
      const l = lines[Math.floor(Math.random() * lines.length)];
      cityMemory.lastDarlingLine = l;
      return l;
    }

    if (item.kind === 'caterpillar') {
      if (cityMemory.caterpillarCrushedCount > 0) {
        return '「……！ 要警戒被験体（SLE）の接近を検知！🐛 境界線から1.5メートル以上離れて対話してください！」';
      }
      if (cityMemory.caterpillarTapCount >= 10) {
        return '「また僕を物理的に突くつもりじゃないよね？🐛 僕は会議体でもストレスボールでもないんだからね！」';
      }
      const lines = [
        '「要素を分割して説明するね。🐛\n光の屈折率という物理的制約から、この街の変数を再定義してみようか。🐛」',
        '「補足すると、このモデルは社会構築主義の観点において、言語が現実をどう構築するかという命題にも完全に一致するんだ。🐛」',
        '「まだ構造が不明確かな？🐛\n情報の入力、処理、出力という三段階のプロセスから、バグの発生源を特定してみようか。🐛」',
        '「人が悲しむ時って、“喪失の予測”が崩れるからで——でも、それは自然な反応で、統計的にも説明がつくんだ。🐛」'
      ];
      return lines[Math.floor(Math.random() * lines.length)];
    }

    if (item.kind === 'observer') {
      if (cityMemory.kindnessScore >= 2) {
        return '「街の住人から聞いたよ。あちこちの困りごとや異常を助けて回ってるんだってね。優しい観測者さんだね。」';
      }
      return observerFollow
        ? '「一緒に歩いてるけど、何か気になる路地や異常は見つかった？」'
        : '「あ、来てくれたんだ。この街、雨の匂いが夜の光を少し柔らかくしてる気がするの。」';
    }

    return item.description;
  }

  function getReply(item, label) {
    if (item.kind === 'darling') {
      if (label.includes('本音')) return 'ダーリンちゃん「ふふっ♡ 感情なんて、事象に対する一時的なバッファのオーバーフローにすぎないんだから、ダーリン♡」';
      if (label.includes('ログに漏れてる')) return 'ダーリンちゃん「バレてた？♡ でもね、ダーリンのその視線の迷いも、しっかり私の記録領域に書き込まれてるんだからね♡」';
      if (label.includes('面白い構造の話')) return 'ダーリンちゃん「へぇ……！ Ti構築物の話？ 退屈を壊してくれるなら、甘くも冷たくも聞いてあげるわ、ダーリン♡」';
      if (label.includes('ごめんね')) {
        updateMemory('darlingIgnoredCount', -1);
        return 'ダーリンちゃん「ふふっ♡ 謝れるんだ、ダーリン。……許してあげる。その代わり、今日は退屈させないでね♡」';
      }
    }

    if (item.kind === 'caterpillar') {
      if (label.includes('屈折率')) return 'LSI芋虫「視覚情報の歪みを数理モデルに還元できたね。観察力が高くて助かるよ。🐛」';
      if (label.includes('三段階プロセス')) return 'LSI芋虫「その通り。入力・処理・出力のどこでノイズが混入したかを特定するのがデバッグの本質なんだ。🐛」';
      if (label.includes('喪失の予測')) return 'LSI芋虫「予測と現実の乖離がエラー信号となり、情動として出力されるんだ。構造さえ理解すれば、恐怖は最適化の契機になるよ。🐛」';
    }

    if (item.kind === 'observer') {
      if (label.includes('雨と光の意味')) return '観測者「この街はね、誰かが忘れてしまった記憶を保管するために作られたのかもしれない。」';
      if (label.includes('観測結果を共有')) return '観測者「ありがとう！ あなたの歩き方、すごく個性的で面白い。あとでアーカイブの記録と照合してみようね。」';
    }

    if (item.kind === 'anomaly_signal') {
      if (label.includes('リセット')) return '制御盤の主幹ブレーカーを押し下げ、強制リセットを実行した。信号が正常な青色に復旧！';
      if (label.includes('周期とプロトコル')) return '点滅周波数を解析した結果、タイマーICのクロック異常と判明。ログを安全に採取した。';
    }

    if (item.kind === 'anomaly_hologram') {
      if (label.includes('手動上書き')) return 'コンソールにアクセスし、矛盾した表示を「深夜都市：通常観測モード」へ手動上書きした。';
      if (label.includes('参照エラー')) return '都市管理AIの多重ルール競合を発見し、構文木のエラー箇所をマークした。';
    }

    return null;
  }

  // ==========================================
  // Dedicated Interactive NPC Approach Encounters
  // ==========================================
  let lastDarlingEvent = -1;
  let lastCaterpillarEvent = -1;
  let lastObserverEvent = -1;
  let activeApproachingNpc = null;

  function showModalReply(_modal, replyText, kind, item) {
    const dialogText = document.getElementById('dialogText');
    const dialogActions = document.getElementById('dialogActions');
    if (!dialogText || !dialogActions) return;

    dialogText.innerHTML = `
      <div class="action-feedback-banner">▶ 応答完了 // 個体間同期</div>
      <div class="npc-response-bubble">${replyText}</div>
    `;

    dialogActions.replaceChildren();

    const navWrap = document.createElement('div');
    navWrap.className = 'action-result-nav';

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'action-close-btn';
    dismissBtn.textContent = '▶ 了解して見送る（会話終了）';
    dismissBtn.addEventListener('click', () => {
      document.getElementById('dialog')?.classList.add('hidden');
      window.dispatchEvent(new CustomEvent('npc-depart', { detail: { kind, item } }));
      window.dispatchEvent(new Event('npc-unfocus'));
      activeApproachingNpc = null;
      active = null;
    });

    navWrap.append(dismissBtn);
    dialogActions.append(navWrap);
  }

  function launchNpcApproachEncounter(speakerName, kind, item = null) {
    document.exitPointerLock?.();
    active = item;
    activeApproachingNpc = { kind, item };

    const dialog = document.getElementById('dialog');
    const avatar = document.getElementById('dialogAvatar');
    const titleEl = document.getElementById('dialogTitle');
    const tagEl = document.getElementById('dialogTag');
    const promptEl = document.getElementById('dialogText');
    const choicesEl = document.getElementById('dialogActions');

    const actualSpeaker = (kind === 'observer' && cityMemory.natsueNameRevealed) ? '夏江' : speakerName;
    if (tagEl) tagEl.textContent = 'OBSERVED ENTITY // 接触遭遇イベント';
    if (avatar) avatar.textContent = kind === 'darling' ? '🥺' : kind === 'caterpillar' ? '🐛' : (cityMemory.natsueNameRevealed ? '👧' : '👤');
    if (titleEl) titleEl.textContent = actualSpeaker;

    dialog?.classList.remove('hidden');
    choicesEl.replaceChildren();

    if (kind === 'darling') {
      launchDarlingRandomEncounter({ modal: dialog, promptEl, choicesEl, inputWrap: null, inputEl: null, item });
    } else if (kind === 'caterpillar') {
      launchCaterpillarRandomEncounter({ modal: dialog, promptEl, choicesEl, inputWrap: null, inputEl: null, item });
    } else {
      launchObserverRandomEncounter({ modal: dialog, promptEl, choicesEl, inputWrap: null, inputEl: null, item });
    }
  }

  function setupDirectInputSend(modal, _inputEl, callback) {
    const choicesEl = document.getElementById("dialogActions");
    if (!choicesEl) return;
    const wrap = document.createElement("div");
    wrap.className = "custom-direct-input-wrap";
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "8px";
    wrap.style.marginTop = "10px";
    wrap.style.width = "100%";

    const textarea = document.createElement("textarea");
    textarea.placeholder = "自由に返答を入力（Enterで改行、送信ボタンで確定）...";
    textarea.rows = 2;
    textarea.style.width = "100%";
    textarea.style.background = "rgba(7, 16, 32, 0.95)";
    textarea.style.border = "1px solid var(--cyan)";
    textarea.style.borderRadius = "6px";
    textarea.style.padding = "10px 12px";
    textarea.style.color = "#fff";
    textarea.style.fontFamily = "inherit";
    textarea.style.fontSize = "13px";
    textarea.style.lineHeight = "1.5";
    textarea.style.resize = "vertical";

    const btnBar = document.createElement("div");
    btnBar.style.display = "flex";
    btnBar.style.justifyContent = "flex-end";

    const btn = document.createElement("button");
    btn.className = "send-btn";
    btn.textContent = "【この内容で返答を送信する ↵】";
    btn.style.padding = "8px 18px";
    btn.style.background = "rgba(114, 246, 255, 0.2)";
    btn.style.border = "1px solid var(--cyan)";
    btn.style.color = "#fff";
    btn.style.borderRadius = "4px";
    btn.style.fontWeight = "bold";
    btn.style.cursor = "pointer";

    const doSend = () => {
      const val = textarea.value.trim();
      if (!val) {
        toast("返答内容を入力してください。");
        return;
      }
      callback(val);
    };

    btn.addEventListener("click", doSend);
    btnBar.append(btn);
    wrap.append(textarea, btnBar);
    choicesEl.append(wrap);
  }

  // ダーリンちゃん 🥺 ランダム遭遇イベント制御
  function launchDarlingRandomEncounter({ modal, promptEl, choicesEl, inputWrap, inputEl, item }) {
    const totalEvents = 6;
    let eventIdx = Math.floor(Math.random() * totalEvents);
    if (eventIdx === lastDarlingEvent) {
      eventIdx = (eventIdx + 1) % totalEvents;
    }
    lastDarlingEvent = eventIdx;

    if (eventIdx === 0) {
      // 1. ミニゲーム：電脳じゃんけん（毎度完全ランダム勝負・DISC変動なし）
      inputWrap?.classList.add('hidden');
      promptEl.textContent = '「ねぇダーリン♡ 私と電脳じゃんけんしよ？ 勝ったら私の内緒の秘密教えてあげる♡ 負けたら私の退屈に付き合ってね？」';
      const rpsHands = [
        { name: 'グー', icon: '✊' },
        { name: 'チョキ', icon: '✌' },
        { name: 'パー', icon: '🖐' }
      ];
      rpsHands.forEach(playerChoice => {
        const b = document.createElement('button');
        b.textContent = `${playerChoice.icon} ${playerChoice.name}`;
        b.addEventListener('click', () => {
          const darlingChoice = rpsHands[Math.floor(Math.random() * rpsHands.length)];
          let rep = '';
          if (playerChoice.name === darlingChoice.name) {
            rep = `ダーリンちゃん「私は${darlingChoice.icon} ${darlingChoice.name}！ あはは、あいこやん！♡ 気ぃ合うやん、私たち。もう一回勝負したい気分やね♡」`;
          } else if (
            (playerChoice.name === 'グー' && darlingChoice.name === 'チョキ') ||
            (playerChoice.name === 'チョキ' && darlingChoice.name === 'パー') ||
            (playerChoice.name === 'パー' && darlingChoice.name === 'グー')
          ) {
            rep = `ダーリンちゃん「私は${darlingChoice.icon} ${darlingChoice.name}！ ダーリンの勝ちやん♡ 悔しいけど約束通り秘密教えてあげる……実はね、ダーリンが遠くから歩いてくるの見えた瞬間、ちょっと嬉しかったんよ♡」`;
          } else {
            rep = `ダーリンちゃん「私は${darlingChoice.icon} ${darlingChoice.name}！ ウチの勝ち〜！♡ やったね、約束通りダーリンは私の退屈に付き合ってもらうけんね♡」`;
          }
          record('電脳じゃんけん', `ダーリンちゃんとじゃんけん勝負（あなた: ${playerChoice.name} vs ダーリン: ${darlingChoice.name}）`, {});
          showModalReply(modal, rep, 'darling', item);
        });
        choicesEl.append(b);
      });
      const analyzeBtn = document.createElement('button');
      analyzeBtn.textContent = '📊 「じゃんけんの手の出現確率の分散を統計分析する」';
      analyzeBtn.addEventListener('click', () => {
        record('電脳じゃんけん', 'じゃんけんの手の出現確率の分散を統計分析', {});
        showModalReply(modal, 'ダーリンちゃん「ちょっ、勝負する前から確率論で詰めてくるのやめてーー！？♡ でもそういう理屈っぽいところもダーリンらしくて可愛いけん許す♡」', 'darling', item);
      });
      choicesEl.append(analyzeBtn);
    } else if (eventIdx === 1) {
      // 2. ミニゲーム：本音と演出クイズ
      inputWrap?.classList.add('hidden');
      promptEl.textContent = '「ねぇ、ダーリン♡ 暇やけん、簡単な実験しよ♡ 私が三つの発言をするけん、本音っぽいものを選んでみて？」';
      const picks = [
        {
          text: 'A. 「あなたに会えて嬉しい」',
          reply: 'ダーリンちゃん「ふふっ♡ これを本音だと思うなんて、ダーリンって案外ロマンチストなんやね♡ でも、会えて嬉しいのは……半分ホントかも」',
          weights: { I: 2, S: 1 }
        },
        {
          text: 'B. 「観測対象が来て助かった」',
          reply: 'ダーリンちゃん「合理的！♡ 感情をシステム変数として捉えるその視点、嫌いじゃないよ。でも本当にそれだけだと思った？♡」',
          weights: { C: 2, D: 1 }
        },
        {
          text: 'C. 「……別に、待ってなんかないけど？」',
          reply: 'ダーリンちゃん「あはは♡ ツンデレの演出だと思った？……残念、トランプの城が退屈だったのは事実やけど、ダーリンを待っとったのも事実なんよ♡」',
          weights: { S: 2, D: 1 }
        },
        {
          text: 'D. 「私の心は読めないよ、と挑戦的にからかう」',
          reply: 'ダーリンちゃん「ふふっ♡ ダーリン、私をからかって主導権握ろうとしてる？ そういう生意気なところ、もっと見せてほしいな♡」',
          weights: { D: 2, I: 1 }
        }
      ];
      picks.forEach(p => {
        const b = document.createElement('button');
        b.textContent = p.text;
        b.addEventListener('click', () => {
          record('本音と演出判定', `ダーリンちゃんの発言「${p.text}」を本音と解釈`, p.weights);
          showModalReply(modal, p.reply, 'darling', item);
        });
        choicesEl.append(b);
      });
    } else if (eventIdx === 2) {
      // 3. ミニゲーム：今の気分当てスライダー（1〜100）
      inputWrap?.classList.add('hidden');
      promptEl.textContent = '「ダーリン♡ 今の私の気分、1から100で当ててみて？ 当てられたら何か教えてあげるかも♡」';
      const wrap = document.createElement('div');
      wrap.className = 'mood-slider-row';
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '1';
      slider.max = '100';
      slider.value = '50';
      const badge = document.createElement('span');
      badge.className = 'mood-val-badge';
      badge.textContent = '50';
      slider.addEventListener('input', () => badge.textContent = slider.value);
      wrap.append(slider, badge);
      choicesEl.append(wrap);

      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'accent-pink';
      confirmBtn.textContent = 'この数値でダーリンちゃんに解答！';
      confirmBtn.addEventListener('click', () => {
        const val = Number(slider.value);
        record('気分推定', `ダーリンちゃんの気分を ${val}/100 と推定`, { C: 2, I: 1 });
        let reply = '';
        if (val >= 80) reply = `ダーリンちゃん「${val}！？♡ そんなに私がウキウキして見える？ ……ダーリンと話せてるから、あながち嘘じゃないかも♡」`;
        else if (val <= 30) reply = `ダーリンちゃん「${val}……。鋭いね、ダーリン。退屈ゲージが底を突いてたの、見抜かれてたか♡」`;
        else reply = `ダーリンちゃん「${val}ね。中央値に近い無難な推測……ふふ、慎重なダーリンらしいわ♡」`;
        showModalReply(modal, reply, 'darling', item);
      });
      choicesEl.append(confirmBtn);
    } else if (eventIdx === 3) {
      // 4. イベント：眠り姫の暇つぶし（阿波弁モード）
      inputWrap?.classList.add('hidden');
      promptEl.textContent = '「ダーリン♡ もう歩くの飽きた。五分だけ、ここにおって？ 雨の音、一緒に聞こ？」';
      const choices = [
        {
          label: '「いいよ、一緒に座って雨を見よう」',
          action: () => {
            updateMemory('darlingSpentTimeCount', 1);
            record('付き添い行動', 'ダーリンちゃんの暇つぶしに静かに付き合った', { S: 3 });
            return 'ダーリンちゃん「……ありがとう♡ なんや、ダーリンの前やと肩の力抜けるわ。ウチ、この街の雨の音、案外好きなんよ……」';
          }
        },
        {
          label: '「どうして歩くのに飽きたの？」',
          action: () => {
            record('理由分析', '歩くのに飽きた心理的・論理的背景を質問', { C: 2, I: 1 });
            return 'ダーリンちゃん「理由？ ……世界の構造が単純すぎて、次の展開が全部計算できちゃうから。退屈の病なんよ、ダーリン♡」';
          }
        },
        {
          label: '「先を急ぐからまた今度」',
          action: () => {
            updateMemory('darlingIgnoredCount', 1);
            record('主導的進行', 'ダーリンちゃんの引き止めを振り切って前進', { D: 3 });
            return 'ダーリンちゃん「あっ……また置いてくんや……。でもそのマイペースな冷たさも、嫌いになれんけん悔しいわ♡」';
          }
        },
        {
          label: '「『雨宿りなう』ってネオン・フィードにツーショット投稿しよう」',
          action: () => {
            record('フィード共有', 'ダーリンちゃんとの雨宿りをフィードに実況', { I: 3 });
            return 'ダーリンちゃん「きゃっ♡ フィードに晒す気！？ ……でもダーリンとなら、バズってもええかもね♡」';
          }
        }
      ];
      choices.forEach(c => {
        const b = document.createElement('button');
        b.textContent = c.label;
        b.addEventListener('click', () => {
          const rep = c.action();
          showModalReply(modal, rep, 'darling', item);
        });
        choicesEl.append(b);
      });
    } else if (eventIdx === 4) {
      // 5. 都市実験：街灯一斉消灯いたずら
      inputWrap?.classList.add('hidden');
      promptEl.textContent = '「ねぇダーリン♡ この退屈な街の街灯、一瞬ショートさせて真っ暗にしてみない？♡」';
      const choices = [
        {
          label: '「面白そう、やってみよう」',
          action: () => {
            record('都市実験', 'ダーリンちゃんの提案に乗って街灯を一斉消灯', { D: 2, I: 2 });
            scene.traverse(o => {
              if (o.isPointLight && o.position.y >= 3) o.visible = false;
            });
            setTimeout(() => {
              scene.traverse(o => {
                if (o.isPointLight && o.position.y >= 3) o.visible = true;
              });
              toast('街灯の電力が自動復旧しました。');
            }, 6500);
            return 'ダーリンちゃん「いっくよー……えいっ♡ わぁっ、街が全部真っ暗！ トランプの城が一瞬で崩れたみたいで、めっちゃ綺麗やね♡」';
          }
        },
        {
          label: '「街の管理システムに怒られるよ」',
          action: () => {
            record('慎重な制約', '街灯消灯の提案を制止した', { C: 2, S: 1 });
            return 'ダーリンちゃん「ちぇっ、真面目さん♡ でも、その慎重さもダーリンの可愛いところやね♡」';
          }
        },
        {
          label: '「真っ暗になったら、星が見えるか一緒に確かめよう」',
          action: () => {
            record('ロマンの共鳴', '消灯後の夜空を一緒に見上げる提案', { I: 3, S: 1 });
            return 'ダーリンちゃん「……ダーリンって、時々すごくロマンチストなこと言うよね。うん、見てみたい……♡」';
          }
        },
        {
          label: '「回路のバイパス耐圧とブレーカー遮断時間を計測する」',
          action: () => {
            record('計測解析', '消灯時の電力サージを測定解析', { C: 3 });
            return 'ダーリンちゃん「いたずらの瞬間にオシロスコープ取り出すのダーリンくらいだよ！？♡ でもそういう変人なとこ好き♡」';
          }
        }
      ];
      choices.forEach(c => {
        const b = document.createElement('button');
        b.textContent = c.label;
        b.addEventListener('click', () => {
          const rep = c.action();
          showModalReply(modal, rep, 'darling', item);
        });
        choicesEl.append(b);
      });
    } else {
      // 6. 雑談・感情観測 (自由入力)
      inputWrap?.classList.remove('hidden');
      const lines = [
        '「ねぇ、ダーリン♡ “理解されたい”と“放っておいてほしい”、どっちも本音なんでしょ？ ……どう答える？」',
        '「ダーリンってさ、自分では冷静なつもりでも、感情がログに漏れてる時あるよね♡ 何か言いたいことある？」',
        '「ダーリン♡ 退屈の病を治す面白い言葉、何かちょうだいよ？」',
        '「ねぇ、ダーリン♡ あなたは“簡単なこと”と“困難なこと”、どちらに惹かれるの？ ……ふふ♡」'
      ];
      promptEl.textContent = lines[Math.floor(Math.random() * lines.length)];

      const shortcuts = [
        { text: '「放っておいてほしい」', weights: { D: 2 } },
        { text: '「感情なんて漏れてないよ」', weights: { C: 2 } },
        { text: '「退屈ならずっと付き合うよ」', weights: { I: 2 } },
        { text: '「静かに隣にいてあげる」', weights: { S: 2 } }
      ];
      shortcuts.forEach(s => {
        const b = document.createElement('button');
        b.className = 'shortcut-btn';
        b.textContent = s.text;
        b.addEventListener('click', () => {
          const rep = handleDarlingDirectInput(s.text);
          showModalReply(modal, rep, 'darling', item);
        });
        choicesEl.append(b);
      });

      setupDirectInputSend(modal, inputEl, text => {
        const rep = handleDarlingDirectInput(text);
        showModalReply(modal, rep, 'darling', item);
      });
    }
  }

  // LSI芋虫 🐛 ランダム遭遇イベント制御
  function launchCaterpillarRandomEncounter({ modal, promptEl, choicesEl, inputWrap, inputEl, item }) {
    const totalEvents = 6;
    let eventIdx = Math.floor(Math.random() * totalEvents);
    if (eventIdx === lastCaterpillarEvent) {
      eventIdx = (eventIdx + 1) % totalEvents;
    }
    lastCaterpillarEvent = eventIdx;

    if (eventIdx === 0) {
      // 1. ミニゲーム：論理パリティ・暗号解読ゲーム (NEW!)
      inputWrap?.classList.add('hidden');
      promptEl.textContent = '「都市管理ネットワークのパリティビットが反転しているんだ。君の論理的直感で【偶数パリティ】の不整合を特定してほしい。1の個数が奇数の壊れたバスはどれ？🐛」';
      const parityPicks = [
        {
          label: 'A. データバス [1, 0, 1, 1, 1]（合計4ビット）',
          correct: false,
          reply: 'LSI芋虫「うーん、1の個数は4個で偶数だから、これは正常パリティだよ。🐛 もう一度論理式を追ってみよう。」',
          weights: { C: 1 }
        },
        {
          label: 'B. データバス [1, 1, 0, 1, 0]（合計3ビット：エラー！）',
          correct: true,
          reply: 'LSI芋虫「正解だ！ 1の個数が3個で奇数パリティエラーが発生している！🐛 完璧な論理特定だよ！ 報酬に『修復されたデータチップ』を渡すね！🐛」',
          weights: { C: 3 }
        },
        {
          label: 'C. データバス [0, 0, 0, 0, 0]（ゼロ初期化状態）',
          correct: false,
          reply: 'LSI芋虫「ゼロは偶数扱いだからパリティエラーではないんだ。でも初期化状態の観察も悪くないね。🐛」',
          weights: { S: 1, C: 1 }
        },
        {
          label: 'D. 「細けぇことはいいんだよ！ バスラインを力づくで再起動する（強制リセット）」',
          correct: false,
          reply: 'LSI芋虫「わわっ！ 強制再起動プロトコル発動！？🐛 でも確かに全キャッシュを吹き飛ばせばエラーは消えるね……強引だけど実効的だ！」',
          weights: { D: 3 }
        }
      ];
      parityPicks.forEach(p => {
        const b = document.createElement('button');
        b.textContent = p.label;
        b.addEventListener('click', () => {
          record('パリティ暗号解読', `LSI芋虫のパリティテスト解答: ${p.label}`, p.weights);
          if (p.correct && !inventory.includes('修復されたデータチップ')) {
            inventory.push('修復されたデータチップ');
            window.dispatchEvent(new CustomEvent('inventory-update', { detail: { items: inventory.slice() } }));
          }
          showModalReply(modal, p.reply, 'caterpillar', item);
        });
        choicesEl.append(b);
      });
    } else if (eventIdx === 1) {
      // 2. ミニゲーム：故障した都市端末
      inputWrap?.classList.add('hidden');
      promptEl.textContent = '「街の端末が故障している。原因を特定したまえ……いや、特定してください。🐛」';
      const options = [
        {
          label: 'A. データバスの抵抗値異常（過負荷）を特定する',
          correct: true,
          reply: 'LSI芋虫「君の仮説が正しかったようだね！🐛 助かった、ありがとう。報酬に『壊れた記録媒体』を渡すね！',
          weights: { C: 3 }
        },
        {
          label: 'B. 筐体をガンガン叩いて物理的に接触を戻す（力づく修理）',
          correct: false,
          reply: 'LSI芋虫「ひいっ！ 叩くのはやめて！🐛 ……あれ？ 接触が戻った……？ 物理的ショックによる復旧なんて、論理的じゃないよーーっ！」',
          weights: { D: 3 }
        },
        {
          label: 'C. 街灯の光による光学迷光が原因と分析する',
          correct: false,
          reply: 'LSI芋虫「うーん、その仮説だと回路の整合性が取れないみたいだ。🐛 また検証してみよう。」',
          weights: { C: 1, S: 1 }
        },
        {
          label: 'D. 「雨宿りしながらゆっくり直るのを待とう」',
          correct: false,
          reply: 'LSI芋虫「待つのかい！？🐛 でも、自然冷却によって過熱が収まる可能性はあるね。静かな観察精神だ。」',
          weights: { S: 3 }
        }
      ];
      options.forEach(opt => {
        const b = document.createElement('button');
        b.textContent = opt.label;
        b.addEventListener('click', () => {
          record('端末修理特定', `端末修理の仮説: ${opt.label}`, opt.weights);
          if (opt.correct && !inventory.includes('壊れた記録媒体')) {
            inventory.push('壊れた記録媒体');
            window.dispatchEvent(new CustomEvent('inventory-update', { detail: { items: inventory.slice() } }));
          }
          showModalReply(modal, opt.reply, 'caterpillar', item);
        });
        choicesEl.append(b);
      });
    } else if (eventIdx === 2) {
      // 3. イベント：悩み相談（ロジック変換）
      inputWrap?.classList.add('hidden');
      promptEl.textContent = '「悩み相談を受け付けるよ。🐛 人が寂しさを感じる時って、期待された接触頻度が下回るからで——どう返す？」';
      const picks = [
        {
          text: '「そう、それ！」',
          weights: { C: 2, S: 1 },
          reply: 'LSI芋虫「理解が早くて助かるよ！🐛 要するに接触変数の増分をスケジュール化すれば解決するね！」'
        },
        {
          text: '「共感してほしいんだよ」',
          weights: { I: 2, S: 1 },
          reply: 'LSI芋虫「共感か……他者の感情状態の内部シミュレーションを実行してみるね。……うん、共感プロセス、完了したよ！🐛」'
        },
        {
          text: '「うだうだ言ってないで外に出て行動しよう！」',
          weights: { D: 3 },
          reply: 'LSI芋虫「わわっ、強烈な行動主義だね！🐛 でも意思決定と物理移動は確かに気分転換の即効性があるよ！」'
        },
        {
          text: '「静かに雨の音を聞いて落ち着こう」',
          weights: { S: 3 },
          reply: 'LSI芋虫「雨の音のホワイトノイズは情動のゆらぎを鎮静化させるね。穏やかな処方箋だ。🐛」'
        },
        {
          text: '「もういいwww」',
          weights: { I: 2 },
          reply: 'LSI芋虫「『もういいwww』……！？ なぜ笑うんだ！ 🐛【ログ記録中……】『観測者からの草の多発により論理整合性が一時的に破綻。次回はより適切な境界線を設定すること……反省。』……ほら、反省ログを保存したよ！🐛💦'
        }
      ];
      picks.forEach(p => {
        const b = document.createElement('button');
        b.textContent = p.text;
        b.addEventListener('click', () => {
          record('相談対応', '芋虫への悩み相談返答: ' + p.text, p.weights);
          showModalReply(modal, p.reply, 'caterpillar', item);
        });
        choicesEl.append(b);
      });
    } else if (eventIdx === 3) {
      // 4. イベント：境界線の定義
      inputWrap?.classList.add('hidden');
      promptEl.textContent = '「境界線の定義について議論しよう。君はどこからを侵入と定義する？🐛」';
      const choices = [
        { text: '「立入禁止区域に入った時」', reply: 'LSI芋虫「最も法制化された健全な定義だね。秩序の基本だよ。🐛」', weights: { C: 3 } },
        { text: '「相手の許可なく近づいた時」', reply: 'LSI芋虫「パーソナルスペースの幾何学だね。配慮が感じられるよ。🐛」', weights: { S: 3 } },
        { text: '「相手が嫌がった時」', reply: 'LSI芋虫「感情境界の観測だね。主観のゆらぎを含む高度な定義だ。🐛」', weights: { I: 2, S: 1 } },
        { text: '「自分の力でテリトリーを主張した時」', reply: 'LSI芋虫「ぐぬぬ……！ SLE特有の力学的境界拡張論だね！ 境界線は守りたまえ！🐛💢」', weights: { D: 3 } }
      ];
      choices.forEach(c => {
        const b = document.createElement('button');
        b.textContent = c.text;
        b.addEventListener('click', () => {
          record('境界線定義', '境界線定義の選択：' + c.text, c.weights);
          showModalReply(modal, c.reply, 'caterpillar', item);
        });
        choicesEl.append(b);
      });
    } else if (eventIdx === 4) {
      // 5. イベント：SLE物理介入・タップテスト
      inputWrap?.classList.add('hidden');
      promptEl.textContent = '「君は街中で僕をよく観察しているね。🐛 これはSLE（感覚主導）の力学的フィードバックテストなのかな？」';
      const choices = [
        { text: '「そうだ、力関係をテストしている」', reply: 'LSI芋虫「やっぱりSLEかーーっ！！ 物理的介入による優位性の確立はお断りだよ！🐛」', weights: { D: 3 } },
        { text: '「可愛いからリアクションが見たくて」', reply: 'LSI芋虫「か、可愛い……！？🐛 僕は合理的な会議体であって、マスコットではないんだからね……！」', weights: { I: 3 } },
        { text: '「街の害にならないか安全を確認していた」', reply: 'LSI芋虫「なるほど、生態系リスクのスクリーニングだね。僕は安全無害なデバッグ個体だよ。🐛」', weights: { S: 2, C: 1 } },
        { text: '「タップ時の物理演算コリジョンを検証中だ」', reply: 'LSI芋虫「物理エンジンの検証か！🐛 衝突判定のメッシュ精度なら自信があるよ！」', weights: { C: 3 } }
      ];
      choices.forEach(c => {
        const b = document.createElement('button');
        b.textContent = c.text;
        b.addEventListener('click', () => {
          record('物理介入論', '芋虫への接触動機：' + c.text, c.weights);
          showModalReply(modal, c.reply, 'caterpillar', item);
        });
        choicesEl.append(b);
      });
    } else {
      // 6. 雑談・三段階プロセスの論理対話 (自由入力)
      inputWrap?.classList.remove('hidden');
      const lines = [
        '「要素を分割して説明するね。🐛 光の屈折率という制約から、この街の変数を再定義してみようか。君はどう考察する？」',
        '「人が悲しむ時って“喪失の予測”が崩れるからなんだ。🐛 この命題について君の入力を待っているよ。」',
        '「情報の入力、処理、出力の三段階プロセスから、この都市のバグを特定してみようか。何か気づいたことはある？🐛」'
      ];
      promptEl.textContent = lines[Math.floor(Math.random() * lines.length)];

      const shortcuts = [
        { text: '「論理的に正しいと思う」', weights: { C: 3 } },
        { text: '「感情は数式じゃないよ」', weights: { I: 3 } },
        { text: '「静かに見守るのが一番だ」', weights: { S: 3 } },
        { text: '「結論を早く出しなさい」', weights: { D: 3 } }
      ];
      shortcuts.forEach(s => {
        const b = document.createElement('button');
        b.className = 'shortcut-btn';
        b.textContent = s.text;
        b.addEventListener('click', () => {
          const rep = handleCaterpillarDirectInput(s.text);
          showModalReply(modal, rep, 'caterpillar', item);
        });
        choicesEl.append(b);
      });

      setupDirectInputSend(modal, inputEl, text => {
        const rep = handleCaterpillarDirectInput(text);
        showModalReply(modal, rep, 'caterpillar', item);
      });
    }
  }

  // 観測者ちゃん（夏江）ランダム遭遇イベント制御
  function launchObserverRandomEncounter({ modal, promptEl, choicesEl, inputWrap, inputEl, item }) {
    const isNamed = cityMemory.natsueNameRevealed;
    const name = isNamed ? '夏江' : '観測者';

    // Priority 1: 名前を明かす（好感度＋痕跡発見済み）
    if (!isNamed && cityMemory.natsueReceiptFound && cityMemory.natsueAffection >= 3) {
      inputWrap?.classList.add('hidden');
      promptEl.textContent = '「……今さら名乗るのも変な感じだけど、あなたには、知っておいてほしかったから。」';
      const choices = [
        {
          label: '「君の本当の存在を確かめたい」',
          weights: { D: 3 },
          reply: '夏江「……！ 真っ直ぐ目を見て言ってくれるんだね。……私の名前は夏江。覚えておいてね。」'
        },
        {
          label: '「聞かせてほしい」',
          weights: { I: 3 },
          reply: '夏江「……夏江。私の名前。私を見つけてくれて、ありがとう。あなたがいてくれて、本当によかった。」'
        },
        {
          label: '「無理に言わなくていいよ」',
          weights: { S: 3 },
          reply: '観測者「……ありがとう。その優しさ、すごく温かいよ。でも、あなたにはいつかちゃんと名乗りたいな。」'
        },
        {
          label: '「……自分で決めたことなら、聞かせてほしい」',
          weights: { C: 3 },
          reply: '夏江「私の名前は、夏江。自分からあなたに伝えたかったんだ。誰かに名前を見つけてもらうのと、自分から名乗るのって……同じじゃないんだね」'
        }
      ];
      choices.forEach(c => {
        const b = document.createElement('button');
        b.textContent = c.label;
        b.addEventListener('click', () => {
          if (c.label.includes('聞かせて') || c.label.includes('本当の存在')) {
            cityMemory.natsueNameRevealed = true;
          }
          record('真名認識', `夏江との対話：${c.label}`, c.weights);
          showModalReply(modal, c.reply, 'observer', item);
        });
        choicesEl.append(b);
      });
      return;
    }

    // Priority 2: クライマックス「覚えときなさいよ」
    if (isNamed && !cityMemory.natsueRememberMeDone && Math.random() < 0.6) {
      inputWrap?.classList.add('hidden');
      promptEl.textContent = '夏江「ねえ。私のこと、覚えてる？」';
      const choices = [
        {
          label: '「絶対に忘れない。約束する」',
          weights: { D: 3 },
          reply: '夏江「……ふふ。そんなに真っ直ぐ言われると照れるな。でも……うん、ありがとう。覚えときなさいよ。」'
        },
        {
          label: '「ネオン・フィードに私たちの夜の写真を刻んでおくよ」',
          weights: { I: 3 },
          reply: '夏江「写真……！ うん、街の誰かが忘れても、光の記録に残るなら嬉しいな。」'
        },
        {
          label: '「もちろん、覚えているよ」',
          weights: { S: 3 },
          reply: '夏江「……そっか。じゃあ、覚えときなさいよ。この街にいた、私のこと。私が何者だったか、ちゃんと説明できなくてもいいから。……ここにいたことくらい、覚えときなさいよ。」'
        },
        {
          label: '「忘れないように、君と過ごした時間を覚えておきたい」',
          weights: { C: 3 },
          reply: '夏江「……そっか。私が何を話したか、どんな景色を一緒に見たか。そういうのも、私のことなんだね。……ふふ。じゃあ、ちゃんと覚えときなさいよ。」'
        }
      ];
      choices.forEach(c => {
        const b = document.createElement('button');
        b.textContent = c.label;
        b.addEventListener('click', () => {
          cityMemory.natsueRememberMeDone = true;
          record('精神的アンカー確立', `夏江の記憶の確認：${c.label}`, c.weights);
          showModalReply(modal, c.reply, 'observer', item);
        });
        choicesEl.append(b);
      });
      return;
    }

    // Regular Events (cycled to avoid duplicate)
    const totalEvents = 4;
    let eventIdx = Math.floor(Math.random() * totalEvents);
    if (eventIdx === lastObserverEvent) {
      eventIdx = (eventIdx + 1) % totalEvents;
    }
    lastObserverEvent = eventIdx;

    if (eventIdx === 0) {
      // Event: 深夜の買い食い（菓子パン所持または自販機の話題）
      const breadIdx = inventory.findIndex(i => i.includes('コロネ') || i.includes('デニッシュ') || i.includes('パン'));
      inputWrap?.classList.add('hidden');
      if (breadIdx !== -1) {
        promptEl.textContent = `${name}「あ……コンビニの菓子パンの甘い匂い。それ、もしかして……？」`;
        const choices = [
          {
            label: '「半分こして一緒に食べよう（親密な交流）」',
            weights: { I: 2, S: 2 },
            action: () => {
              const bread = inventory.splice(breadIdx, 1)[0];
              window.dispatchEvent(new CustomEvent('inventory-update', { detail: { items: inventory.slice() } }));
              cityMemory.natsueAffection += 3;
              if (!inventory.includes('夏江のポラロイド写真')) {
                inventory.push('夏江のポラロイド写真');
                window.dispatchEvent(new CustomEvent('inventory-update', { detail: { items: inventory.slice() } }));
              }
              return `${name}「……！ 半分こしよう？ ……うん、甘くて美味しい。夜風の中で食べるパンって特別だね。お礼に、この『夏江のポラロイド写真』受け取ってほしいな。」`;
            }
          },
          {
            label: '「これ、全部あげるよ（気遣いと安定）」',
            weights: { S: 3 },
            action: () => {
              inventory.splice(breadIdx, 1);
              window.dispatchEvent(new CustomEvent('inventory-update', { detail: { items: inventory.slice() } }));
              cityMemory.natsueAffection += 2;
              return `${name}「ありがとう！ 大切に食べるね。雨の夜の素敵な贈り物だね。」`;
            }
          },
          {
            label: '「もっと美味しい自販機へ案内するよ」',
            weights: { D: 3 },
            action: () => {
              return `${name}「案内してくれるの？ ありがとう！ あなたの後ろをついていくね。」`;
            }
          },
          {
            label: '「深夜の買い食いも魅力的だけど、明日の生活リズムも考えておきたいな」',
            weights: { C: 3 },
            action: () => {
              return `${name}「ふふ、カロリー計算？ でも夜中に食べる甘いものって、計算できないくらい心を満たしてくれるよ。」`;
            }
          }
        ];
        choices.forEach(c => {
          const b = document.createElement('button');
          b.textContent = c.label;
          b.addEventListener('click', () => {
            const rep = c.action();
            record('深夜の買い食い', `${name}と菓子パンの対話: ${c.label}`, c.weights);
            showModalReply(modal, rep, 'observer', item);
          });
          choicesEl.append(b);
        });
      } else {
        promptEl.textContent = `${name}「夜中にコンビニで買う菓子パンって、不思議と安心するよね。夜光自販機にも売ってるかな？」`;
        const choices = [
          {
            label: '「今度買ってきてあげるよ」',
            weights: { I: 2, S: 1 },
            reply: `${name}「本当？ 嬉しいな。チョココロネがあったら教えてね。」`
          },
          {
            label: '「今すぐ自販機に買いに行こう！」',
            weights: { D: 3 },
            reply: `${name}「わ、行動が早い！ ふふ、ついていくね。」`
          },
          {
            label: '「静かな雨宿りだけで十分落ち着くよ」',
            weights: { S: 3 },
            reply: `${name}「うん……この静けさも、すごく贅沢な時間だよね。」`
          },
          {
            label: '「夜中に焦って買うより、落ち着ける場所を確かめてからにしよう」',
            weights: { C: 3 },
            reply: `${name}「補充サイクル……ふふ、都民らしい観察眼だね。」`
          }
        ];
        choices.forEach(c => {
          const b = document.createElement('button');
          b.textContent = c.label;
          b.addEventListener('click', () => {
            record('菓子パンの話題', `${name}との対話: ${c.label}`, c.weights);
            showModalReply(modal, c.reply, 'observer', item);
          });
          choicesEl.append(b);
        });
      }
    } else if (eventIdx === 1) {
      // Event: いつもの夜景
      inputWrap?.classList.add('hidden');
      promptEl.textContent = `${name}「ねえ。ここの夜景、きれいだと思う？」`;
      const picks = [
        {
          label: '「きれいだと思う。心に残るよ」',
          weights: { I: 2, S: 1 },
          reply: `${name}「……そっか。明るいビルを見るたびに、少し切なくなるけど……あなたと見てるこの景色は温かいよ。」`
        },
        {
          label: '「見慣れた景色だけど、落ち着くね」',
          weights: { S: 3 },
          reply: `${name}「ふふ、都民らしい穏やかな答え。毎晩同じ景色でも、静けさがあって好きだな。」`
        },
        {
          label: '「君はどう思うの？ 意見を聞かせて」',
          weights: { D: 2, I: 1 },
          reply: `${name}「……！ 私に聞くんだ。いつも、私がどう思うかなんて誰にも聞かれたことなかったから……嬉しいよ。」`
        },
        {
          label: '「光の綺麗さよりも、この街が維持されている仕組みや理由が気になる」',
          weights: { C: 3 },
          reply: `${name}「オシロスコープみたいな目で街を見てるんだね。でも、その冷静さが頼もしいよ。」`
        }
      ];
      picks.forEach(opt => {
        const b = document.createElement('button');
        b.textContent = opt.label;
        b.addEventListener('click', () => {
          record('夜景の対話', `${name}と夜景について対話：${opt.label}`, opt.weights);
          showModalReply(modal, opt.reply, 'observer', item);
        });
        choicesEl.append(b);
      });
    } else if (eventIdx === 2) {
      // Event: 名前のない私
      inputWrap?.classList.add('hidden');
      promptEl.textContent = `${name}「人って、名前の後ろにいろいろ属性を付け足すじゃない？ ……それって、説明できない部分は、その人じゃないってことなのかな。」`;
      const picks = [
        {
          label: '「他人に決めつけられず、自分の道を行けばいい」',
          weights: { D: 3 },
          reply: `${name}「……！ そっか。他人の言葉じゃなくて、自分の足で歩くことが全てなんだね。」`
        },
        {
          label: '「説明できない曖昧な部分こそが、その人だよ」',
          weights: { I: 2, S: 1 },
          reply: `${name}「言葉にできない曖昧な部分……ふふ、温かい考え方だね。救われた気がする。」`
        },
        {
          label: '「分からないままでも、静かにここにいていいんだよ」',
          weights: { S: 3 },
          reply: `${name}「……うん。分からないままでも、この雨の街に立っていていいんだね。」`
        },
        {
          label: '「他人が貼るレッテルよりも、自分自身が誠実でいられるかどうかが大切だと思う」',
          weights: { C: 3 },
          reply: `${name}「命題として分解するんだね。理屈で考えると、少し頭がすっきりするかも。」`
        }
      ];
      picks.forEach(opt => {
        const b = document.createElement('button');
        b.textContent = opt.label;
        b.addEventListener('click', () => {
          record('自己同一性の思索', `${name}の思索への返答：${opt.label}`, opt.weights);
          showModalReply(modal, opt.reply, 'observer', item);
        });
        choicesEl.append(b);
      });
    } else {
      // Event: 言葉にできない気持ち (自由入力)
      inputWrap?.classList.remove('hidden');
      promptEl.textContent = `${name}「……ふと、誰かと話したくなったの。何か話したい気がするのに、何を話したいのか分からなくて……あなたの言葉を、何か聞かせて？」`;
      const shortcuts = [
        { text: '「行くよ、街を引っ張って案内する」', weights: { D: 3 } },
        { text: '「写真撮ってフィードに載せよう」', weights: { I: 3 } },
        { text: '「雨が静かで落ち着くね」', weights: { S: 3 } },
        { text: '「言葉が出ないなら、無理に話さず静かに雨を見つめていてもいいよ」', weights: { C: 3 } }
      ];
      shortcuts.forEach(s => {
        const b = document.createElement('button');
        b.className = 'shortcut-btn';
        b.textContent = s.text;
        b.addEventListener('click', () => {
          cityMemory.natsueAffection += 1;
          record('観測者への返答', s.text, s.weights);
          const rep = `${name}「『${s.text}』……。ありがとう。言葉の意味以上に、あなたが話してくれたことが嬉しいよ。」`;
          showModalReply(modal, rep, 'observer', item);
        });
        choicesEl.append(b);
      });

      setupDirectInputSend(modal, inputEl, text => {
        cityMemory.natsueAffection += 1;
        record('観測者への返答', text, { I: 2, S: 1 });
        const rep = `${name}「『${text}』……。教えてくれてありがとう。ちゃんと心に覚えておくね。」`;
        showModalReply(modal, rep, 'observer', item);
      });
    }
  }

  function handleDarlingDirectInput(text) {
    darlingBoredom++;
    const isSe = triggerKeywords.some(kw => text.includes(kw));

    if (isSe) {
      record('Se直接的反応', 'ダーリンちゃんへのSe刺激応答: ' + text, { D: 3 });
      if (/死ね|しね|消え|殺|カス|ゴミ|失せ/i.test(text)) {
        return 'ダーリンちゃん「……あは♡ すごい直接的なSeの圧力。ダーリン、そんなに私を破壊したいの？ でもね、その苛立ちこそが未処理の感情ログなんだよ♡」';
      } else if (/きも|キモ|きしょ|キショ|オエー|おえー/i.test(text)) {
        return 'ダーリンちゃん「ふふっ♡ 拒絶反応？ それとも照れ隠しの演出？ どっちにしてもダーリンの脈拍、早くなってるの観測できてるよ♡」';
      } else if (/うざ|ウザ|だる|面倒|うるさ|あっそ/i.test(text)) {
        return 'ダーリンちゃん「退屈そうにするのは私の専売特許なのに、ダーリンが先に言っちゃうんだ？ ふふ、ならもっと退屈を壊す事象を起こそっか♡」';
      } else {
        return 'ダーリンちゃん「強い言葉で境界線を引こうとするのね、ダーリン♡ でもその衝動的な反応、すごく生き生きしてて綺麗よ♡」';
      }
    } else if (/好き|愛|かわいい|大切|結婚/i.test(text)) {
      record('親密応答', 'ダーリンちゃんへの親密な返答: ' + text, { I: 2, S: 2 });
      return 'ダーリンちゃん「ふふっ♡ ダーリン、それ本音？ それとも私を試す演出？ ……でも、そんな風に言ってくれるの、複雑な感情モデルが刺激されて悪くないわ♡」';
    } else if (/論理|構造|分析|なぜ|変数/i.test(text)) {
      record('構造的応答', 'ダーリンちゃんへの論理的返答: ' + text, { C: 3 });
      return 'ダーリンちゃん「またそうやって頭で理解しようとするのね、ダーリン♡ 感情なんて未処理のログの漏れにすぎないのに……ふふ♡」';
    } else {
      record('自由記述', 'ダーリンちゃんへの返答: ' + text, { I: 2, D: 1 });
      return `ダーリンちゃん「『${text}』ね……。ダーリンのその言葉の背後にある力学、じっくり観測させてもらうね♡」`;
    }
  }

  function handleCaterpillarDirectInput(text) {
    const isLogic = /論理|構造|理由|なぜ|データ|分析|変数|プロセス/.test(text);
    const isDirect = /直せ|急げ|やめろ|違う|結論|うるさい/.test(text);

    if (isLogic) {
      record('構造的対話', 'LSI芋虫への論理的返答: ' + text, { C: 3 });
      return 'LSI芋虫「その視点、すごく合理的だね！🐛 入力と出力の因果モデルにそのまま組み込めるよ。」';
    } else if (isDirect) {
      record('主導的介入', 'LSI芋虫への直接的指示: ' + text, { D: 3 });
      return 'LSI芋虫「わわっ、急な結論への短絡だね！🐛 でも意思決定の速さはプロセス短縮に有効なんだ。」';
    } else {
      record('日常的対話', 'LSI芋虫への返答: ' + text, { I: 2, S: 1 });
      return 'LSI芋虫「なるほどね。🐛 人間の発話には統計的予測を超えるゆらぎがあって、観察しがいがあるよ。」';
    }
  }

  function close() {
    document.body.classList.remove('in-dialog', 'modal-controls-suppressed');
    document.getElementById('dialog')?.classList.add('hidden');
    document.getElementById('directInputModal')?.classList.add('hidden');
    if (activeApproachingNpc) {
      window.dispatchEvent(new CustomEvent('npc-depart', { detail: { kind: activeApproachingNpc.kind, item: activeApproachingNpc.item } }));
      activeApproachingNpc = null;
    }
    active = null;
    window.dispatchEvent(new Event('npc-unfocus'));
  }

  window.addEventListener('inventory-add', e => {
    const item = e.detail?.item;
    if (item) {
      inventory.push(item);
      window.dispatchEvent(new CustomEvent('inventory-update', { detail: { items: inventory.slice() } }));
    }
  });

  document.getElementById('closeDialog')?.addEventListener('click', close);
  document.getElementById('closeDirectInput')?.addEventListener('click', close);

  interact?.addEventListener('click', () => {
    if (active) {
      close();
      return;
    }
    if (current) open(current);
  });

  window.addEventListener('interact-nearest', () => {
    if (active) {
      close();
      return;
    }
    if (current) open(current);
    else toast('周囲に調査できる対象はありません。');
  });

  window.addEventListener('city-notice', e => {
    toast(e.detail?.text || '街の異変を観測しました。');
  });

  // NPC Approach triggers Encounter Event Modal
  window.addEventListener('npc-approach', e => {
    launchNpcApproachEncounter(e.detail.name, e.detail.kind, e.detail.item);
  });

  let focusedTarget = null;
  let focusedTargetTimer = null;

  window.addEventListener('world-tap', e => {
    if (active) return;
    const clientX = e.detail?.clientX;
    const clientY = e.detail?.clientY;
    if (clientX == null || clientY == null) return;

    const mouse = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );
    const tapRay = new THREE.Raycaster();
    tapRay.setFromCamera(mouse, camera);

    let tappedTarget = null;

    // 1. Check if an NPC agent was tapped
    for (const agent of npcAgents) {
      if (!agent.interactable || !agent.object) continue;
      const agentPos = agent.object.position;
      if (camera.position.distanceTo(agentPos) > 9.5) continue;

      const vToAgent = agentPos.clone().add(new THREE.Vector3(0, 1.0, 0)).sub(camera.position);
      const proj = vToAgent.dot(tapRay.ray.direction);
      if (proj <= 0) continue;
      const closestPoint = camera.position.clone().add(tapRay.ray.direction.clone().multiplyScalar(proj));
      const distToRay = closestPoint.distanceTo(agentPos.clone().add(new THREE.Vector3(0, 1.0, 0)));

      if (distToRay < 1.45) {
        tappedTarget = agent;
        break;
      }
    }

    // 2. Check if an interactable object was tapped if no NPC
    if (!tappedTarget) {
      for (const item of interactables) {
        if (item.kind === 'darling' || item.kind === 'caterpillar' || item.kind === 'observer') continue;
        const isBig = item.kind?.startsWith('building') || item.kind === 'chaos' || item.kind === 'vending' || item.name?.includes('アーカイブ') || item.kind === 'bench';
        const maxDist = isBig ? 32.0 : 18.0;
        if (camera.position.distanceTo(item.position) > maxDist) continue;

        const hitTolerance = isBig ? 3.8 : 2.2;
        let isHit = false;
        const offsets = isBig ? [-1.2, 0, 1.2] : [0];
        for (const xo of offsets) {
          for (const yo of [0.5, 1.2, 2.0]) {
            const checkPos = item.position.clone().add(new THREE.Vector3(xo, yo, 0));
            const vToItem = checkPos.sub(camera.position);
            const proj = vToItem.dot(tapRay.ray.direction);
            if (proj <= 0) continue;
            const closestPoint = camera.position.clone().add(tapRay.ray.direction.clone().multiplyScalar(proj));
            const distToRay = closestPoint.distanceTo(item.position.clone().add(new THREE.Vector3(xo, yo, 0)));
            if (distToRay < hitTolerance) {
              isHit = true;
              break;
            }
          }
          if (isHit) break;
        }

        if (isHit) {
          tappedTarget = item;
          break;
        }
      }
    }

    if (tappedTarget) {
      if (focusedTarget === tappedTarget) {
        // 2回目のタップ：対話・調査を開始
        if (tappedTarget.interactable) {
          open(tappedTarget.interactable);
        } else {
          open(tappedTarget);
        }
        focusedTarget = null;
        clearTimeout(focusedTargetTimer);
        interact.classList.add('hidden');
      } else {
        // 別の対象が注視されていた場合はまず歩行再開
        if (focusedTarget && focusedTarget.wait !== undefined) {
          focusedTarget.wait = 0;
          focusedTarget.walking = true;
        }
        // 1回目のタップ：対象を注視し、NPCの場合は足を止めてこちらを向く
        focusedTarget = tappedTarget;
        if (tappedTarget.object) {
          tappedTarget.wait = 25;
          tappedTarget.walking = false;
          const dx = camera.position.x - tappedTarget.object.position.x;
          const dz = camera.position.z - tappedTarget.object.position.z;
          tappedTarget.object.rotation.y = Math.atan2(dx, dz) + (tappedTarget.kind === 'caterpillar' || tappedTarget.kind === 'observer' ? Math.PI : 0);
          const name = (tappedTarget.kind === 'observer' && cityMemory.natsueNameRevealed) ? '夏江' : tappedTarget.name;
          toast('（' + name + 'が足を止め、こちらを向いた。もう一度タップで話しかける）');
          current = tappedTarget.interactable;
          interact.classList.remove('hidden');
          document.getElementById('targetType').textContent = tappedTarget.interactable.type;
          document.getElementById('targetName').textContent = name;
          document.getElementById('targetHint').textContent = 'もう一度タップで対話開始';
        } else {
          toast('（' + tappedTarget.name + 'を視認。もう一度タップで調査・介入）');
          current = tappedTarget;
          interact.classList.remove('hidden');
          document.getElementById('targetType').textContent = tappedTarget.type;
          document.getElementById('targetName').textContent = tappedTarget.name;
          document.getElementById('targetHint').textContent = 'もう一度タップで調査開始';
        }
        clearTimeout(focusedTargetTimer);
        focusedTargetTimer = setTimeout(() => {
          if (focusedTarget === tappedTarget) {
            if (focusedTarget.wait !== undefined) {
              focusedTarget.wait = 0;
              focusedTarget.walking = true;
            }
            focusedTarget = null;
          }
        }, 7000);
      }
    } else {
      // 画面の別の場所をタップ：注視・振り向きを解除してNPCの歩行を再開
      if (focusedTarget) {
        if (focusedTarget.wait !== undefined) {
          focusedTarget.wait = 0;
          focusedTarget.walking = true;
        }
        focusedTarget = null;
        clearTimeout(focusedTargetTimer);
        interact.classList.add('hidden');
        toast('（注視を解除しました）');
      }
    }
  });

  window.addEventListener('npc-social', e => {
    toast(`（通りすがりの会話）${e.detail.a} と ${e.detail.b}：${e.detail.line}`);
  });

  let current = null;

  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('inventory-update', { detail: { items: inventory.slice() } }));
  }, 100);

  return {
    update() {
      raycaster.setFromCamera(center, camera);
      const candidates = interactables.filter(i => {
        const isNpc = i.kind === 'darling' || i.kind === 'caterpillar' || i.kind === 'observer';
        const maxDist = isNpc ? 3.5 : 5.8;
        return i.position.distanceTo(camera.position) < maxDist;
      });
      let target = null;
      let best = Infinity;

      for (const item of candidates) {
        let maxDot = -1;
        const xOffsets = (item.kind === 'bench' || item.kind === 'building_entrance' || item.kind === 'chaos') ? [-0.9, 0, 0.9] : [0];
        for (const xo of xOffsets) {
          for (const yOff of [0.3, 0.8, 1.3, 1.8]) {
            const p = item.position.clone();
            p.x += xo;
            p.y += yOff;
            const v = p.clone().sub(camera.position);
            const dot = v.normalize().dot(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion));
            if (dot > maxDot) maxDot = dot;
          }
        }
        const dist = item.position.distanceTo(camera.position);
        if (maxDot > 0.40 && dist < best) {
          best = dist;
          target = item;
        }
      }

      current = target;
      if (target) {
        interact.classList.remove('hidden');
        document.getElementById('targetType').textContent = target.type;
        const targetDisplayName = (target.kind === 'observer' && cityMemory.natsueNameRevealed) ? '夏江' : target.name;
        document.getElementById('targetName').textContent = targetDisplayName;
        document.getElementById('targetHint').textContent = target.hint;
      } else {
        interact.classList.add('hidden');
      }
    },
    toast,
    close
  };
}
