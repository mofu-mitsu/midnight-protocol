# 深夜都市行動解析計画 | MIDNIGHT PROTOCOL

一人称視点で夜の都市を歩き、プレイヤーの実際の行動を記録する Three.js プロトタイプ。

## 操作
- PC: WASD / 矢印で移動、マウスで視点操作、Eキーで対象を調べる、Shiftで走る
- スマートフォン: 左下の仮想スティックで移動、画面右側をスワイプして視点操作、「調べる」ボタンでアクション

## 構成
- `index.html`: UI構造
- `css/style.css`: UIとHUD
- `js/main.js`: Three.js起動・メインループ
- `js/world.js`: 都市、建物、端末、NPC、VRMローダー
- `js/controls.js`: 一人称移動・視点操作
- `js/interactions.js`: 近距離対象の検出・アクション
- `js/analysis.js`: 行動ログと暫定DISC傾向
- `js/ui.js`: ログ・操作パネル

## プレイヤーVRM
VRoid StudioからVRM形式でエクスポートし、`assets/models/player/player.vrm` として配置してください。ローカルファイル選択ではなく、GitHubに置いた同じモデルを公開サイトが読み込みます。VRMを一人称カメラに読み込む機能は今後の実装対象です。現時点では読み込み処理の足場のみで、モデルが正常に表示されることは未検証です。

## 行動分析
DISC（D: Dominance / 主導性、I: Influence / 影響性、S: Steadiness / 安定性、C: Conscientiousness / 慎重性）を参考にした探索プロトタイプです。正式なDISC診断ではありません。現状は歩行・走行・対象との接触・回避などをログ化し、接触時の行動に仮の重みを付けています。

## 公開
GitHub Pagesでリポジトリの `main` ブランチ、`/ (root)` を公開元に設定してください。
