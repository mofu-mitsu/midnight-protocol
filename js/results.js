// ================================================================
// 深夜都市行動解析計画 | MIDNIGHT PROTOCOL
// DISC 行動解析総括・証明書生成・履歴比較・共有モジュール
// ================================================================

import { analysis, getSummary } from './analysis.js';
import { cityMemory } from './memory.js';

const STORAGE_KEY = 'midnight_protocol_past_records';

// 16種類のDISC複合アーキタイプ定義
const ARCHETYPES = {
  // 単独優位
  'D': {
    title: '【主導的変革者】Directive Pioneer',
    sub: '迅速な決断と障害の強行突破を好む、結果志向の行動者',
    color: '#ff4757',
    desc: '街の異常に対して逡巡することなく直接介入し、最短距離で結論を導き出そうとする傾向が顕著です。他者との交渉でも主導権を握り、状況を自らの手で動かす強いドライブ力を有しています。',
    preferred: '直接介入、障害突破、主導的指示、即時決断',
    avoided: '長時間の静観、過度な同調、曖昧な妥協'
  },
  'I': {
    title: '【直感共鳴型インフルエンサー】Inspiring Catalyst',
    sub: '感情の交流と新規性の波及を楽しむ、共鳴志向の表現者',
    color: '#ff75c8',
    desc: '街の住人への声がけや夜光フィードへの共有、混沌への突入など、外界との刺激的な相互作用を自発的に起こす傾向が見られます。直感と遊び心を原動力として、都市のノイズを彩りに変換します。',
    preferred: 'フィード投稿、住人への声かけ、カオス探求、感情的共感',
    avoided: '孤立した作業、厳密すぎる定型手順、無言の立ち去り'
  },
  'S': {
    title: '【静穏の観測調停者】Supportive Anchor',
    sub: '調和と安全を重んじ、静かに見守る持続的安定者',
    color: '#2ed573',
    desc: '激しい摩擦を避け、街の雨音や住人の心情に穏やかに寄り添う傾向が顕著です。急激な変革よりも現状の安全確保や配慮を優先し、深夜都市の崩壊を防ぐ精神的なアンカーとして機能します。',
    preferred: '雨宿り・付き添い、安全確認、傾聴・受容、持続的観察',
    avoided: '強引な支配、突発的な危険行為、無配慮な言動'
  },
  'C': {
    title: '【精密理論構築者】Analytical Architect',
    sub: '論理構造と客観的事実を突き詰める、規律志向の探求者',
    color: '#72f6ff',
    desc: '配線の波形測定、シリアル照合、因果モデルの検証など、システムの根底にある整合性を追究する傾向が際立っています。感情や勢いに流されず、最小限のリスクで最大の精度を求めます。',
    preferred: '回路バイパス解析、データ照合、原因究明、論理的質問',
    avoided: '根拠のない直感、衝動的行動、主観的な思い込み'
  },
  // 複合優位
  'DI': {
    title: '【カリスマ牽引者】Dynamic Motivator',
    sub: '情熱的な行動力と社交性で周囲を巻き込む推進者',
    color: '#ff6b81',
    desc: '決断の速さと他者への求心力が高いレベルで融合しています。自ら先陣を切って街の謎へ飛び込み、そのプロセスを周囲に共有してムーブメントを起こします。',
    preferred: '主導的提案、フィード共有、積極的対話、突入',
    avoided: '受動的な待機、細かな書類確認'
  },
  'DS': {
    title: '【不撓不屈の守護者】Resolute Protector',
    sub: 'ブレない芯の強さと包容力で場を守り抜く実務家',
    color: '#e056fd',
    desc: '必要な時は迷わず決断を下しながらも、仲間や街の住人を決して見捨てない安定感を持っています。有事における頼もしさが際立ちます。',
    preferred: '迅速な救助、確実な安全確保、責任ある判断',
    avoided: '無責任な煽り、無計画な暴走'
  },
  'DC': {
    title: '【冷徹なる戦略司令官】Strategic Director',
    sub: '緻密な論理と圧倒的な実行力で最短勝利を掴む設計者',
    color: '#ff9f43',
    desc: '感情を排して状況を冷静に数値化し、最も合理的かつ迅速な解決策を即座に執行します。高い目標達成能力を誇ります。',
    preferred: '最短工数での修復、効率的検証、論理的指示',
    avoided: '感情的雑談、非効率な手順'
  },
  'IS': {
    title: '【親愛なる共鳴調停者】Empathetic Harmonizer',
    sub: '温かな言葉と受容力で他者の心を解きほぐす伴走者',
    color: '#ff9ff3',
    desc: '他者への共感力と親しみやすさがずば抜けており、街の住人（ダーリンちゃんや夏江）から最も深く本音を引き出すタイプです。',
    preferred: '差し入れ・プレゼント、思い出の共有、優しい傾聴',
    avoided: '冷淡な無視、一方的な論理の押し付け'
  },
  'IC': {
    title: '【先見の着想解析官】Insightful Innovator',
    sub: '知的好奇心と直感を論理で裏付けるアイデアメーカー',
    color: '#00d2d3',
    desc: '都市の奇妙なバグや謎に対して、常人とは異なるユニークな仮説を立て、それをデータによって実証しようとします。',
    preferred: '仮説の議論、電脳ミニゲーム、謎解き、独自視点の共有',
    avoided: '単調な定常作業、形骸化したルール'
  },
  'SC': {
    title: '【堅実なるシステム保全者】System Guardian',
    sub: '誠実な手順と正確性で都市の秩序を静かに支える職人',
    color: '#54a0ff',
    desc: '規律正しさと他者への思いやりを兼ね備え、見落とされがちな街の小さなほころびを丁寧に修復していきます。極めて高い信頼性を誇ります。',
    preferred: 'マニュアル通りの測定、丁寧な安全確認、静かな観察',
    avoided: '衝動的な冒険、リスクの高い実験'
  }
};

export class ResultsController {
  constructor() {
    this.modal = document.getElementById('resultsModal');
    this.confirmModal = document.getElementById('exitConfirmModal');
    this.imageSaveModal = document.getElementById('imageSaveModal');
    this.cachedCardDataUrl = null;
    this.setupListeners();
  }

  setupListeners() {
    // 観測終了ボタン
    const triggerButtons = [
      document.getElementById('exitButton')
    ];
    triggerButtons.forEach(btn => {
      btn?.addEventListener('click', () => this.showExitConfirmation());
    });

    // 確認ダイアログの操作
    document.getElementById('closeExitConfirm')?.addEventListener('click', () => {
      this.confirmModal?.classList.add('hidden');
    });
    document.getElementById('btnCancelExit')?.addEventListener('click', () => {
      this.confirmModal?.classList.add('hidden');
    });
    document.getElementById('btnProceedExit')?.addEventListener('click', () => {
      this.confirmModal?.classList.add('hidden');
      this.openResults();
    });

    // リザルト画面の操作
    document.getElementById('closeResults')?.addEventListener('click', () => {
      this.modal?.classList.add('hidden');
    });
    document.getElementById('btnBackToCity')?.addEventListener('click', () => {
      this.modal?.classList.add('hidden');
    });
    document.getElementById('btnRestartExploration')?.addEventListener('click', () => {
      this.modal?.classList.add('hidden');
      this.confirmModal?.classList.add('hidden');
      document.getElementById('dialog')?.classList.add('hidden');
      document.getElementById('directInputModal')?.classList.add('hidden');
      document.getElementById('feedModal')?.classList.add('hidden');
      document.getElementById('startScreen')?.classList.remove('hidden');
      window.location.reload();
    });

    // 共有と画像保存
    document.getElementById('btnShareResult')?.addEventListener('click', () => this.shareResult());
    document.getElementById('btnExportImage')?.addEventListener('click', () => this.exportImageCard());

    // 画像保存モーダルの閉じる
    document.getElementById('btnCloseImageSave')?.addEventListener('click', () => {
      this.imageSaveModal?.classList.add('hidden');
    });
  }

  // 観測終了の事前確認モーダル
  showExitConfirmation() {
    document.exitPointerLock?.();
    const inventoryCount = (window.getCurrentInventory?.() || []).length;
    const metCount = this.calculateMetNpcCount();
    const incompleteMissions = this.calculateIncompleteMissionCount();

    const statMet = document.getElementById('statMetNpcCount');
    const statDiscovered = document.getElementById('statDiscoveredCount');
    const statIncomplete = document.getElementById('statIncompleteMissionCount');

    if (statMet) statMet.textContent = `${metCount} / 3 名`;
    if (statDiscovered) statDiscovered.textContent = `${inventoryCount + (cityMemory.anomaliesFixedCount || 0)} 件`;
    if (statIncomplete) statIncomplete.textContent = `${incompleteMissions} 件`;

    this.confirmModal?.classList.remove('hidden');
  }

  calculateMetNpcCount() {
    let count = 0;
    if (cityMemory.natsueAffection > 0 || cityMemory.natsueReceiptFound) count++;
    if (cityMemory.darlingSpentTimeCount > 0 || cityMemory.darlingIgnoredCount > 0) count++;
    if (cityMemory.caterpillarTapsCount > 0 || cityMemory.caterpillarConsultCount > 0) count++;
    return count;
  }

  calculateIncompleteMissionCount() {
    let incomplete = 3;
    if (cityMemory.anomaliesFixedCount >= 3) incomplete--;
    if (cityMemory.natsueNameRevealed) incomplete--;
    if (cityMemory.zeroPlatformFound) incomplete--;
    return Math.max(0, incomplete);
  }

  // DISC結果画面の生成と表示
  openResults() {
    document.exitPointerLock?.();
    const summary = getSummary();
    let scores;
    let archetypeKey;

    if (summary.total <= 0.1 || (analysis.D === 0 && analysis.I === 0 && analysis.S === 0 && analysis.C === 0)) {
      // 一切の行動を起こさず静観した場合：カオスを避けて安定に寄った「S（安定型・静観者）」と判定
      scores = { D: 0, I: 0, S: 100, C: 0 };
      archetypeKey = 'S';
    } else {
      const total = summary.total;
      const dPct = Math.round((analysis.D / total) * 100);
      const iPct = Math.round((analysis.I / total) * 100);
      const sPct = Math.round((analysis.S / total) * 100);
      const cPct = Math.round((analysis.C / total) * 100);

      scores = { D: dPct, I: iPct, S: sPct, C: cPct };
      const sortedKeys = ['D', 'I', 'S', 'C'].sort((a, b) => scores[b] - scores[a]);
      const topKey = sortedKeys[0];
      const secondKey = sortedKeys[1];

      archetypeKey = topKey;
      if (scores[topKey] - scores[secondKey] <= 10 && ARCHETYPES[topKey + secondKey]) {
        archetypeKey = topKey + secondKey;
      } else if (scores[topKey] - scores[secondKey] <= 10 && ARCHETYPES[secondKey + topKey]) {
        archetypeKey = secondKey + topKey;
      }
    }

    const arch = ARCHETYPES[archetypeKey] || ARCHETYPES['S'];

    // 履歴比較の計算
    const historyDiff = this.calculateHistoryDiff(scores, arch.title);

    // DOM更新
    this.renderResultDOM({
      scores,
      archetype: arch,
      historyDiff,
      totalActions: analysis.actions,
      dateStr: new Date().toLocaleString('ja-JP')
    });

    // 履歴を保存
    this.saveRecordToStorage({
      date: new Date().toISOString(),
      scores,
      archetype: arch.title,
      actions: analysis.actions
    });

    this.modal?.classList.remove('hidden');
  }

  calculateHistoryDiff(currentScores, currentArchTitle) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { isFirst: true, text: '初回観測：行動プロファイルのベースラインを確立しました。' };
      const records = JSON.parse(raw);
      if (!records || !records.length) return { isFirst: true, text: '初回観測：行動プロファイルのベースラインを確立しました。' };

      const prev = records[records.length - 1];
      const diffD = currentScores.D - (prev.scores?.D || 0);
      const diffI = currentScores.I - (prev.scores?.I || 0);
      const diffS = currentScores.S - (prev.scores?.S || 0);
      const diffC = currentScores.C - (prev.scores?.C || 0);

      const formatDiff = (num) => (num > 0 ? `+${num}%` : `${num}%`);
      const shiftDesc = [];
      if (diffD >= 8) shiftDesc.push('主導権を握る能動的突破が増加');
      else if (diffD <= -8) shiftDesc.push('独断専行が抑制され協調的傾向へ');
      if (diffI >= 8) shiftDesc.push('直感的な共鳴・外部発信が活発化');
      else if (diffI <= -8) shiftDesc.push('他者へのアプローチが慎重化');
      if (diffS >= 8) shiftDesc.push('穏やかな見守りと安全志向へシフト');
      else if (diffS <= -8) shiftDesc.push('静観から積極的なアクションへ推移');
      if (diffC >= 8) shiftDesc.push('綿密な論理検証・データ重視が強化');
      else if (diffC <= -8) shiftDesc.push('直感的・柔軟な判断を許容');

      return {
        isFirst: false,
        prevDate: new Date(prev.date).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        diffStr: `D: ${formatDiff(diffD)} | I: ${formatDiff(diffI)} | S: ${formatDiff(diffS)} | C: ${formatDiff(diffC)}`,
        explanation: shiftDesc.length ? shiftDesc.join(' / ') : '前回の観測傾向とおおむね一貫した行動パターンを維持しています。'
      };
    } catch {
      return { isFirst: true, text: '初回観測：行動プロファイルのベースラインを確立しました。' };
    }
  }

  saveRecordToStorage(record) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const records = raw ? JSON.parse(raw) : [];
      records.push(record);
      if (records.length > 20) records.shift();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  renderResultDOM({ scores, archetype, historyDiff, totalActions, dateStr }) {
    // アーキタイプ表示
    const titleEl = document.getElementById('resArchetypeTitle');
    const subEl = document.getElementById('resArchetypeSub');
    const descEl = document.getElementById('resArchetypeDesc');
    if (titleEl) {
      titleEl.textContent = archetype.title;
      titleEl.style.color = archetype.color;
      titleEl.style.textShadow = `0 0 16px ${archetype.color}88`;
    }
    if (subEl) subEl.textContent = archetype.sub;
    if (descEl) descEl.textContent = archetype.desc;

    // 事前自認プロファイル（結果カード上のバッジ表示）
    const selfInputEl = document.getElementById('selfTypeInput');
    const selfVal = selfInputEl?.value.trim();
    const selfBadge = document.getElementById('resSelfTypeBadge');
    const selfDisplay = document.getElementById('resSelfTypeDisplay');

    if (selfBadge && selfDisplay) {
      if (selfVal) {
        selfDisplay.textContent = selfVal;
        selfBadge.classList.remove('hidden');
      } else {
        selfBadge.classList.add('hidden');
      }
    }

    // ダーリンちゃんからの特別講評
    const darlingCommentEl = document.getElementById('resDarlingCommentText');
    if (darlingCommentEl) {
      darlingCommentEl.textContent = this.getDarlingComment(archetype.title, scores);
    }

    // DISCパーセンテージバー
    const setResBar = (id, val, color) => {
      const bar = document.getElementById(`resBar${id}`);
      const txt = document.getElementById(`resVal${id}`);
      if (bar) {
        bar.style.width = `${val}%`;
        bar.style.backgroundColor = color;
      }
      if (txt) txt.textContent = `${val}%`;
    };
    setResBar('D', scores.D, '#ff4757');
    setResBar('I', scores.I, '#ff75c8');
    setResBar('S', scores.S, '#2ed573');
    setResBar('C', scores.C, '#72f6ff');

    // 行動傾向（選んだ行動 vs 避けた行動）
    const prefEl = document.getElementById('resPreferredActions');
    const avoidEl = document.getElementById('resAvoidedActions');
    if (prefEl) prefEl.textContent = archetype.preferred;
    if (avoidEl) avoidEl.textContent = archetype.avoided;

    // NPCとの対話傾向
    const npcLogEl = document.getElementById('resNpcTendencies');
    if (npcLogEl) {
      const lines = [];
      if (cityMemory.natsueAffection > 0 || cityMemory.natsueNameRevealed) {
        lines.push(`・観測者（夏江）：${cityMemory.natsueNameRevealed ? '本名「夏江」の記憶を共有。精神的アンカー確立。' : '夜景や菓子パンの思い出を分かち合い、心の距離を縮めた。'}`);
      }
      if (cityMemory.darlingSpentTimeCount > 0 || cityMemory.darlingIgnoredCount > 0) {
        lines.push(`・ダーリンちゃん：${cityMemory.darlingSpentTimeCount > cityMemory.darlingIgnoredCount ? '気まぐれな誘いに静かに付き合い、退屈を分かち合った。' : '強引な誘惑を振り切り、自身の探索ペースを貫徹した。'}`);
      }
      if (cityMemory.caterpillarTapsCount > 0 || cityMemory.caterpillarConsultCount > 0) {
        lines.push(`・LSI芋虫：論理パズルや境界線の定義について討議し、構造的思考を検証。`);
      }
      if (!lines.length) lines.push('・住人との深い接触は控え、街の景観と異常調査を単独で推進。');
      npcLogEl.innerHTML = lines.map(l => `<li>${l}</li>`).join('');
    }

    // 発見物と達成状況
    const discListEl = document.getElementById('resDiscoveryList');
    if (discListEl) {
      const items = window.getCurrentInventory?.() || [];
      const fixes = cityMemory.anomaliesFixedCount || 0;
      const discItems = [];
      if (fixes > 0) discItems.push(`⚡ 街の異常回路・信号機を ${fixes} 箇所修復完了`);
      items.forEach(it => discItems.push(`◇ 携行品：${it}`));
      if (!discItems.length) discItems.push('街の空気と夜光の観測ログ');
      discListEl.innerHTML = discItems.map(d => `<li>${d}</li>`).join('');
    }

    // 履歴比較
    const histEl = document.getElementById('resHistoryDiff');
    if (histEl) {
      if (historyDiff.isFirst) {
        histEl.innerHTML = `<span class="hist-badge">NEW</span> ${historyDiff.text}`;
      } else {
        histEl.innerHTML = `
          <div class="hist-row">
            <span class="hist-badge">前回比較（${historyDiff.prevDate}）</span>
            <strong class="hist-diff-nums">${historyDiff.diffStr}</strong>
          </div>
          <p class="hist-explanation">${historyDiff.explanation}</p>
        `;
      }
    }

    const metaEl = document.getElementById('resMetaInfo');
    if (metaEl) {
      metaEl.textContent = `観測日時: ${dateStr} // 実行動アクション数: ${totalActions}`;
    }
  }

  getDarlingComment(archTitle, scores) {
    const d = scores.D || 0;
    const i = scores.I || 0;
    const s = scores.S || 0;
    const c = scores.C || 0;

    if (scores.S === 100 && d === 0 && i === 0 && c === 0) {
      return '「ふふっ♡ 一切の刺激に飛びつかず、静かに夜の雨を見守ってたんやね。カオスだらけの街で、余計な摩擦を起こさずに平穏を選び取ったの、すごくマイペースで好きやわ。アンタのその静かな強さ、ちゃんとログに刻まれてるよ♡」';
    }

    if (d >= 40 || (d >= i && d >= s && d >= c)) {
      return '「ふふ、やっぱりアンタって迷わずグイグイ切り開くタイプよね！ 信号機も配線も力強く突破していく後ろ姿、見ててスカッとしたわ♡ でも無茶しすぎて回路焼き切らないでよね？ アンタの推進力、めっちゃ頼もしかったよ！」';
    }

    if (i >= 40 || (i >= d && i >= s && i >= c)) {
      return '「あっはは！ 街角で出会う人に片っ端から話しかけたり、怪しい空間にワクワク突っ込んだり……アンタ、最高にノリがいいやん！ 一緒に街をふらついてて一番退屈しないのは間違いなくアンタだよ♡ その好奇心、ずっと失くさないでね！」';
    }

    if (c >= 40 || (c >= d && c >= i && c >= s)) {
      return '「ん〜！ さすが論理と思考のスペシャリスト！ 異常回路を一本ずつ精査したり、迂闊に動かず状況を分析するその鋭い目つき……ゾクッとしちゃった♡ 理詰めで街の秘密を暴いていく姿、最高にクールだったわ！」';
    }

    return '「ふふっ♡ アンタのその絶妙なバランス感覚、すごく興味深いわ。周りをよく観察しながら、必要な時にはちゃんと自分の意志を貫いてたよね。繊細で深い思考と、たまに見せる無邪気なノリ……アンタのそういうところ、ウチは大好きだよ♡」';
  }

  // 2D Canvas による高解像度解析証明書カード描画
  generateCanvasCard() {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1260;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const summary = getSummary();
    let scores;
    let archetypeKey;

    if (summary.total <= 0.1 || (analysis.D === 0 && analysis.I === 0 && analysis.S === 0 && analysis.C === 0)) {
      scores = { D: 0, I: 0, S: 100, C: 0 };
      archetypeKey = 'S';
    } else {
      const total = summary.total;
      const dPct = Math.round((analysis.D / total) * 100);
      const iPct = Math.round((analysis.I / total) * 100);
      const sPct = Math.round((analysis.S / total) * 100);
      const cPct = Math.round((analysis.C / total) * 100);
      scores = { D: dPct, I: iPct, S: sPct, C: cPct };

      const sortedKeys = ['D', 'I', 'S', 'C'].sort((a, b) => scores[b] - scores[a]);
      const topKey = sortedKeys[0];
      const secondKey = sortedKeys[1];
      archetypeKey = topKey;
      if (scores[topKey] - scores[secondKey] <= 10 && ARCHETYPES[topKey + secondKey]) {
        archetypeKey = topKey + secondKey;
      } else if (scores[topKey] - scores[secondKey] <= 10 && ARCHETYPES[secondKey + topKey]) {
        archetypeKey = secondKey + topKey;
      }
    }
    const arch = ARCHETYPES[archetypeKey] || ARCHETYPES['S'];

    // 背景（深紺グラデーション）
    const bgGrad = ctx.createLinearGradient(0, 0, 900, 1260);
    bgGrad.addColorStop(0, '#040711');
    bgGrad.addColorStop(0.5, '#070f22');
    bgGrad.addColorStop(1, '#050916');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 900, 1260);

    // グリッド線
    ctx.strokeStyle = 'rgba(114, 246, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 30; x < 900; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1260);
      ctx.stroke();
    }
    for (let y = 30; y < 1260; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(900, y);
      ctx.stroke();
    }

    // 外枠サイバーフレーム
    ctx.strokeStyle = 'rgba(114, 246, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(36, 36, 828, 1188);

    // 四隅のサイバーアクセント
    const drawCorner = (x, y, dx, dy) => {
      ctx.strokeStyle = '#72f6ff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, y + dy * 28);
      ctx.lineTo(x, y);
      ctx.lineTo(x + dx * 28, y);
      ctx.stroke();
    };
    drawCorner(36, 36, 1, 1);
    drawCorner(864, 36, -1, 1);
    drawCorner(36, 1224, 1, -1);
    drawCorner(864, 1224, -1, -1);

    // ヘッダー部
    ctx.fillStyle = '#72f6ff';
    ctx.font = 'bold 15px "SF Mono", monospace';
    ctx.fillText('URBAN BEHAVIOR OBSERVATION LAB // CERTIFICATE', 60, 80);

    const selfInputEl = document.getElementById('selfTypeInput');
    const selfVal = selfInputEl?.value.trim();
    if (selfVal) {
      ctx.fillStyle = '#ff75c8';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`【事前自認】 ${selfVal}`, 640, 80);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 32px -apple-system, sans-serif';
    ctx.fillText('深夜都市行動解析計画 | 行動特性証明書', 60, 122);

    ctx.fillStyle = '#8ba8c4';
    ctx.font = '13px monospace';
    const timeStr = new Date().toLocaleString('ja-JP');
    ctx.fillText(`PROTOCOL VER 0.6 // TIMESTAMP: ${timeStr} // ACTIONS: ${analysis.actions}`, 60, 150);

    // 区切り線
    ctx.strokeStyle = 'rgba(114, 246, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(60, 170);
    ctx.lineTo(840, 170);
    ctx.stroke();

    // アーキタイプ巨大バッジ
    ctx.fillStyle = 'rgba(11, 24, 48, 0.75)';
    ctx.fillRect(60, 195, 780, 160);
    ctx.strokeStyle = arch.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 195, 780, 160);

    ctx.fillStyle = arch.color;
    ctx.font = 'bold 16px monospace';
    ctx.fillText('DOMINANT BEHAVIORAL ARCHETYPE', 85, 230);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 30px -apple-system, sans-serif';
    ctx.fillText(arch.title, 85, 275);

    ctx.fillStyle = '#c5dcee';
    ctx.font = '15px -apple-system, sans-serif';
    ctx.fillText(arch.sub, 85, 315);

    // DISC 4軸メーター
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px -apple-system, sans-serif';
    ctx.fillText('■ DISC行動4象限バランス', 60, 400);

    const meters = [
      { key: 'D', name: '主導性 (Dominance)', val: scores.D, color: '#ff4757', desc: '直接介入・決断・突破' },
      { key: 'I', name: '感化性 (Influence)', val: scores.I, color: '#ff75c8', desc: '対話発信・共鳴・カオス' },
      { key: 'S', name: '安定性 (Steadiness)', val: scores.S, color: '#2ed573', desc: '静穏見守り・傾聴・調和' },
      { key: 'C', name: '慎重性 (Conscientiousness)', val: scores.C, color: '#72f6ff', desc: '論理照合・精密解析・規則' }
    ];

    let startY = 435;
    meters.forEach(m => {
      // ラベル
      ctx.fillStyle = m.color;
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`${m.key} : ${m.name}`, 60, startY + 18);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(`${m.val}%`, 780, startY + 18);

      // バー背景
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(60, startY + 28, 780, 14);

      // バー本体
      ctx.fillStyle = m.color;
      ctx.fillRect(60, startY + 28, (780 * m.val) / 100, 14);

      // 補助説明
      ctx.fillStyle = '#829fb8';
      ctx.font = '12px -apple-system, sans-serif';
      ctx.fillText(m.desc, 60, startY + 56);

      startY += 70;
    });

    // 行動特徴詳細ブロック
    const blockY = 730;
    ctx.fillStyle = 'rgba(11, 24, 48, 0.65)';
    ctx.fillRect(60, blockY, 780, 200);
    ctx.strokeStyle = 'rgba(114, 246, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(60, blockY, 780, 200);

    ctx.fillStyle = '#72f6ff';
    ctx.font = 'bold 17px -apple-system, sans-serif';
    ctx.fillText('■ 探索ログから観測された行動傾向', 85, blockY + 36);

    ctx.fillStyle = '#4fffa4';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('【高頻度で選ばれた行動】', 85, blockY + 70);
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px -apple-system, sans-serif';
    ctx.fillText(arch.preferred, 85, blockY + 95);

    ctx.fillStyle = '#ff75c8';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('【意識的に抑制・回避された行動】', 85, blockY + 135);
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px -apple-system, sans-serif';
    ctx.fillText(arch.avoided, 85, blockY + 160);

    // 事前自認プロファイル＆ダーリンちゃん講評
    const darlingComment = this.getDarlingComment(arch.title, scores);

    const infoY = 945;
    ctx.fillStyle = 'rgba(11, 24, 48, 0.7)';
    ctx.fillRect(60, infoY, 780, 110);
    ctx.strokeStyle = 'rgba(255, 117, 200, 0.3)';
    ctx.strokeRect(60, infoY, 780, 110);

    if (selfVal) {
      ctx.fillStyle = '#ff75c8';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`【事前自認】 ${selfVal}   ⟷   【都市観測DISC】 ${arch.title}`, 80, infoY + 28);
    } else {
      ctx.fillStyle = '#72f6ff';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`【都市実行動抽出DISC】 ${arch.title}`, 80, infoY + 28);
    }

    ctx.fillStyle = '#ffd1ed';
    ctx.font = '13px -apple-system, sans-serif';
    ctx.fillText('🥺 ダーリンちゃん講評：', 80, infoY + 56);
    ctx.fillStyle = '#eaf5ff';
    ctx.font = '13px -apple-system, sans-serif';
    this.wrapText(ctx, darlingComment, 80, infoY + 78, 740, 20);

    // 総括コメント
    ctx.fillStyle = '#8eaac2';
    ctx.font = '13px -apple-system, sans-serif';
    const commentY = 1080;
    this.wrapText(ctx, arch.desc, 60, commentY, 780, 22);

    // フッター＆バーコード
    ctx.strokeStyle = 'rgba(114, 246, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(60, 1160);
    ctx.lineTo(840, 1160);
    ctx.stroke();

    ctx.fillStyle = '#658199';
    ctx.font = '12px monospace';
    ctx.fillText('RECORD VERIFIED BY MIDNIGHT NEON CORE ARCHIVE // PUBLIC PROTOCOL', 60, 1185);
    ctx.fillText('ID: ' + Math.random().toString(36).substring(2, 10).toUpperCase(), 60, 1205);

    // 擬似バーコード描画
    let bcX = 660;
    for (let i = 0; i < 30; i++) {
      const w = (i % 3 === 0 ? 3 : i % 2 === 0 ? 1 : 2);
      ctx.fillStyle = i % 5 === 0 ? '#ff75c8' : '#72f6ff';
      ctx.fillRect(bcX, 1165, w, 35);
      bcX += w + 2;
    }

    return canvas.toDataURL('image/png');
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const chars = text.split('');
    let line = '';
    for (let n = 0; n < chars.length; n++) {
      const testLine = line + chars[n];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = chars[n];
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  }

  // 画像保存処理（PCダウンロード ＋ スマホ長押しモーダル）
  exportImageCard() {
    const dataUrl = this.generateCanvasCard();
    if (!dataUrl) return;
    this.cachedCardDataUrl = dataUrl;

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;

    // プレビュー画像をセット
    const imgEl = document.getElementById('previewImageCard');
    const downloadA = document.getElementById('btnDownloadCardDirect');
    if (imgEl) imgEl.src = dataUrl;
    if (downloadA) {
      downloadA.href = dataUrl;
      downloadA.download = `MIDNIGHT_PROTOCOL_DISC_${Date.now()}.png`;
    }

    if (isMobile) {
      // スマホ：長押し保存モーダルを表示
      this.imageSaveModal?.classList.remove('hidden');
    } else {
      // PC：自動ダウンロード実行しつつモーダルも開く
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `MIDNIGHT_PROTOCOL_DISC_${Date.now()}.png`;
      a.click();
      this.imageSaveModal?.classList.remove('hidden');
    }
  }

  // ナビゲーション・結果共有
  async shareResult() {
    const summary = getSummary();
    const total = Math.max(0.1, summary.total);
    const dPct = Math.round((analysis.D / total) * 100);
    const iPct = Math.round((analysis.I / total) * 100);
    const sPct = Math.round((analysis.S / total) * 100);
    const cPct = Math.round((analysis.C / total) * 100);

    const shareUrl = window.location.hostname.includes('vercel.app')
      ? window.location.href
      : 'https://midnight-protocol-iota.vercel.app/';

    const shareText = `【深夜都市行動解析計画 | MIDNIGHT PROTOCOL】\n私の都市行動特性：${summary.leader.key}型（${summary.leader.label.split(' / ')[0]}）\n[ D: ${dPct}% | I: ${iPct}% | S: ${sPct}% | C: ${cPct}% ]\n夜の街での行動記録が解析されました。\n#深夜都市行動解析計画 #MIDNIGHT_PROTOCOL`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: '深夜都市行動解析計画 DISC解析結果',
          text: shareText,
          url: shareUrl
        });
        return;
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('Share error:', err);
      }
    }

    // クリップボードへのフォールバックコピー（alert/promptを排除）
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      const btn = document.getElementById('btnShareResult');
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '<span>✓</span> コピー完了！';
        setTimeout(() => { btn.innerHTML = orig; }, 2500);
      }
      window.dispatchEvent(new CustomEvent('city-notice', {
        detail: { text: '解析結果の共有テキストをクリップボードにコピーしました！' }
      }));
    } catch {
      // safe fallback
    }
  }
}
