// プレイヤーの行動と選択を記憶する都市観測メモリー
export const cityMemory = {
  // ダーリンちゃん
  darlingAffection: 0,
  darlingIgnoredCount: 0,
  darlingSpentTimeCount: 0,
  darlingHonestyPicks: [],
  darlingQuestActive: false,
  darlingQuestCompleted: false,

  // LSI芋虫
  caterpillarTapCount: 0,
  caterpillarCrushedCount: 0,
  caterpillarConsultCount: 0,
  caterpillarQuestActive: false,
  caterpillarQuestCompleted: false,

  // 観測者ちゃん（夏江）
  natsueAffection: 0,
  natsueNameRevealed: false,
  natsueReceiptFound: false,
  natsueBreadPromised: false,
  natsueSharedNightview: false,
  natsueRememberMeDone: false,
  natsueQuestActive: false,
  natsueQuestCompleted: false,

  // 都市全体・おつかい
  errandsCompleted: 0,
  kindnessScore: 0,
  anomaliesFixed: 0,
  lastDarlingLine: '「ねぇ、ダーリン♡ 感情なんて事象のログ漏れにすぎないのよ」',
  lastObserverLine: '「この街、誰も知らない私を見つけてほしい気がするの」',
  knownToCity: false
};

export function updateMemory(key, val) {
  if (typeof cityMemory[key] === 'number') {
    cityMemory[key] += (val ?? 1);
  } else {
    cityMemory[key] = val;
  }
}

export function getRelationshipStatus() {
  let darlingLevel = Math.min(5, Math.floor(cityMemory.darlingAffection / 2) + (cityMemory.darlingQuestCompleted ? 2 : 0) + (cityMemory.darlingSpentTimeCount >= 1 ? 1 : 0));
  let darlingStatus = '観察と演出の対象';
  if (cityMemory.darlingQuestCompleted) darlingStatus = '特別なおねだりを聞いた仲♡ (親愛度 ★★★★★)';
  else if (cityMemory.darlingSpentTimeCount >= 1 && cityMemory.darlingAffection >= 3) darlingStatus = '本音を語る仲 (親愛度 ★★★★☆)';
  else if (cityMemory.darlingAffection >= 2) darlingStatus = '気になる観測者 (親愛度 ★★★☆☆)';
  else if (cityMemory.darlingIgnoredCount >= 2) darlingStatus = '放置された記憶（恨み・からかい）';

  let natsueLevel = Math.min(5, Math.floor(cityMemory.natsueAffection / 2) + (cityMemory.natsueQuestCompleted ? 2 : 0) + (cityMemory.natsueNameRevealed ? 1 : 0));
  let natsueStatus = '街を彷徨う観測者';
  if (cityMemory.natsueNameRevealed && cityMemory.natsueQuestCompleted) natsueStatus = '名前を呼び合う唯一の理解者 (親愛度 ★★★★★)';
  else if (cityMemory.natsueNameRevealed) natsueStatus = '「夏江」と名乗った存在 (親愛度 ★★★★☆)';
  else if (cityMemory.natsueReceiptFound || cityMemory.natsueQuestCompleted) natsueStatus = '雨宿りと温もりを分かち合う仲 (親愛度 ★★★☆☆)';
  else if (cityMemory.natsueAffection >= 2) natsueStatus = '少しだけ心を開いた同行者 (親愛度 ★★☆☆☆)';

  let caterpillarStatus = '通常分類';
  if (cityMemory.caterpillarCrushedCount > 0) caterpillarStatus = '【最重要警戒】被験体SLE';
  else if (cityMemory.caterpillarQuestCompleted) caterpillarStatus = '論理回路パートナー (信頼度 ★★★★★)';
  else if (cityMemory.caterpillarTapCount >= 10) caterpillarStatus = '物理接触過多（要警戒）';
  else if (cityMemory.caterpillarConsultCount > 0) caterpillarStatus = '論理モデルの共有者 (信頼度 ★★★☆☆)';

  return {
    darlingLevel,
    darlingStatus,
    natsueLevel,
    natsueStatus,
    caterpillarStatus,
    errandsCompleted: cityMemory.errandsCompleted,
    reputation: cityMemory.errandsCompleted >= 2 ? '心優しき街の支援者' : cityMemory.kindnessScore >= 3 ? '親切ナ観測者' : '気マグレナ探索者'
  };
}
