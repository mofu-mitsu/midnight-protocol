export const analysis = {
  D: 0,
  I: 0,
  S: 0,
  C: 0,
  logs: [],
  walkDistance: 0,
  runDistance: 0,
  idleSeconds: 0,
  actions: 0,
  anomaliesResolved: 0,
  minigamesPlayed: 0,
  routePreferences: { mainStreet: 0, alley: 0, interior: 0 }
};

const labels = {
  D: "主導性 / Dominance",
  I: "影響性 / Influence",
  S: "安定性 / Steadiness",
  C: "慎重性 / Conscientiousness"
};

const descriptions = {
  D: "迅速な意思決定と主体的な問題解決を好むタイプ。異常や障害に直面した際、迷わず直接介入し、最短距離で結果を出そうとする行動特性が見られます。",
  I: "他者との対話や感情の交流、新規性の探索を好むタイプ。NPCへの積極的な関わりや、直感的なアイデアの共有によって周囲に波及をもたらします。",
  S: "周囲の調和と安全確認、着実な手順を好むタイプ。急な変化にも落ち着いて対処し、状況の観察や他者への配慮を怠らない持続的な行動が特徴です。",
  C: "客観的な事実や論理構造、正確性を重視するタイプ。異常の根本原因やシステムの規則を深く分析し、リスクを最小化した堅実な手順を選択します。"
};

export function record(type, detail, weight = {}) {
  const time = new Date().toLocaleTimeString("ja-JP", { hour12: false });
  analysis.logs.unshift({ time, type, detail });
  if (analysis.logs.length > 100) analysis.logs.pop();
  analysis.actions++;

  const keys = Object.keys(weight).filter(k => ['D', 'I', 'S', 'C'].includes(k));
  for (const k of keys) {
    const highest = Math.max(analysis.D, analysis.I, analysis.S, analysis.C, 1);
    const relative = analysis[k] / highest;
    const correction = relative > 0.9 ? 0.6 : relative > 0.75 ? 0.8 : 1.0;
    analysis[k] += weight[k] * correction;
  }

  window.dispatchEvent(new CustomEvent("observation", { detail: { type, detail } }));
}

export function recordMovement(distance, running, locationZone = 'mainStreet') {
  if (distance < 0.0001) {
    analysis.idleSeconds += 1 / 60;
    return;
  }
  analysis.walkDistance += distance;
  if (running) analysis.runDistance += distance;
  if (analysis.routePreferences[locationZone] !== undefined) {
    analysis.routePreferences[locationZone] += distance;
  }
}

export function getSummary() {
  const total = Math.max(0.1, analysis.D + analysis.I + analysis.S + analysis.C);
  const entries = Object.keys(labels).map(k => ({
    key: k,
    label: labels[k],
    score: Math.round(analysis[k] * 10) / 10,
    pct: Math.round((analysis[k] / total) * 100),
    description: descriptions[k]
  })).sort((a, b) => b.score - a.score);

  return {
    entries,
    leader: entries[0],
    total: Math.round(total * 10) / 10,
    raw: { D: analysis.D, I: analysis.I, S: analysis.S, C: analysis.C }
  };
}
