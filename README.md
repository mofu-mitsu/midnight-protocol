# 深夜都市行動解析計画 | MIDNIGHT PROTOCOL

Three.jsで構築する、夜の都市を舞台にしたDISC行動観測プロトタイプです。

## Features
- Three.jsによるネオン都市、ビル群、ホログラム、浮遊粒子、発光インタラクションノード
- DISCの4指標（D / I / S / C）を明記した行動ログ型の探索
- ダーリンちゃん🥺：光沢のある3Dフェイス風オブジェクト＋対話
- LSI芋虫🐛：セグメント状の3D芋虫モデル＋行動ログ解析役
- INFP / IEI / 4w5の感情風景観測者NPC
- 選択型ミニゲーム、行動ログ、DISC傾向レポート
- VRoid Studioから書き出した .vrm モデルの読み込み（ブラウザ内表示）

## Run
GitHub Pagesで公開するか、ローカルHTTPサーバーで `index.html` を開いてください。Three.jsとVRM関連モジュールをCDNから読み込みます。

## VRoid avatar
VRoid StudioからVRM形式でエクスポートし、探索画面の「AVATAR LINK」からファイルを選択してください。GLB/GLTFも読み込みを試みます。VRMモデルの見た目やボーン構造により調整が必要な場合があります。

## Controls
- Click a glowing node: inspect / talk
- Drag: rotate the city
- Scroll: zoom
- The DISC percentages summarize choices in this prototype and are not a formal DISC assessment.
