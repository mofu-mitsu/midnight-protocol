// プレイヤーの行動と選択を記憶する都市観測メモリー
export const cityMemory = {
  // ダーリンちゃん
  darlingIgnoredCount: 0,
  darlingSpentTimeCount: 0,
  darlingHonestyPicks: [],

  // LSI芋虫
  caterpillarTapCount: 0,
  caterpillarCrushedCount: 0,
  caterpillarConsultCount: 0,

  // 観測者ちゃん（夏江）
  natsueAffection: 0,
  natsueNameRevealed: false,
  natsueReceiptFound: false,
  natsueBreadPromised: false,
  natsueSharedNightview: false,
  natsueRememberMeDone: false,

  // 都市全体
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
  let darlingStatus = '未確定';
  if (cityMemory.darlingIgnoredCount >= 2) darlingStatus = '放置された記憶（恨み・からかい）';
  else if (cityMemory.darlingSpentTimeCount >= 1) darlingStatus = '阿波弁を許した仲';
  else darlingStatus = '観察と演出の対象';

  let caterpillarStatus = '通常分類';
  if (cityMemory.caterpillarCrushedCount > 0) caterpillarStatus = '【最重要警戒】被験体SLE';
  else if (cityMemory.caterpillarTapCount >= 10) caterpillarStatus = '物理接触過多（要警戒）';
  else if (cityMemory.caterpillarConsultCount > 0) caterpillarStatus = '論理モデルの共有者';

  let natsueStatus = '街を彷徨う観測者';
  if (cityMemory.natsueNameRevealed) natsueStatus = '「夏江」と名乗った存在';
  else if (cityMemory.natsueReceiptFound) natsueStatus = '「夏江」という痕跡の発見';
  else if (cityMemory.natsueAffection >= 3) natsueStatus = '少しだけ心を開いた同行者';

  return {
    darlingStatus,
    caterpillarStatus,
    natsueStatus,
    reputation: cityMemory.kindnessScore >= 3 ? '親切ナ観測者' : '気マグレナ探索者'
  };
}
