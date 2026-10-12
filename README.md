# 深夜都市行動解析計画 | MIDNIGHT PROTOCOL

一人称視点で夜の都市を歩き、NPCたちが自律的に移動する Three.js プロトタイプ。

## 操作
- PC: WASD / 矢印で移動、マウスで視点操作、Eキーで対象を調べる、Shiftで走る
- スマートフォン: 左下の仮想スティックで移動、画面右側をスワイプして視点操作、「調べる」ボタンでアクション

## NPCモデル
- `assets/models/npcs/observer.vrm`: VRoid Studioから書き出した観測者NPC
- ダーリンちゃん、LSI芋虫: Three.jsのプロシージャルモデル
- NPCはそれぞれ異なる巡回ルートと移動速度を持ち、立ち止まる時間を挟みながら自律移動します。近距離で話しかけることもできます。

### 観測者VRMの追加方法
1. VRoid StudioからキャラクターをVRM形式でエクスポート。
2. `assets/models/npcs/observer.vrm` としてGitHubにアップロード。
3. GitHub Pages公開後、ページを再読み込み。ローカルファイル選択は不要です。

## 構成
- `index.html`: UI構造とimport map
- `css/style.css`: UIとHUD
- `js/main.js`: Three.js起動・メインループ
- `js/world.js`: 都市、端末、NPC、NPC自律移動、VRMローダー
- `js/controls.js`: 一人称移動・視点操作
- `js/interactions.js`: 近距離対象の検出・アクション
- `js/analysis.js`: 行動ログと暫定DISC傾向
- `js/ui.js`: ログ・操作パネル

## 行動分析
DISC（D: Dominance / 主導性、I: Influence / 影響性、S: Steadiness / 安定性、C: Conscientiousness / 慎重性）を参考にした探索プロトタイプです。正式なDISC診断ではありません。歩行・走行・対象との接触・回避などを記録します。

## 公開
GitHub Pagesでリポジトリの `main` ブランチ、`/ (root)` を公開元に設定してください。
