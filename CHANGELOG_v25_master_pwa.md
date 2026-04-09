# v25 Master layout + Web App support

## 変更点
- マスター画面の操作パネルをレスポンシブ再調整
  - PC幅: 左にルームコード、右に操作ボタン2列レイアウト
  - スマホ幅: ルームコード → 各操作ボタンの縦並び
- プレイヤー情報入力画面のPCレイアウトを調整
  - 3列崩れを修正し、2列の適切な幅配分へ変更
- プレイヤー画面下部に `©amaoto_jp` を常時表示
- Webアプリ向け設定を追加
  - `manifest.webmanifest`
  - iOS/Android/PWA アイコン設定
  - theme-color / apple-touch-icon / アプリ名設定
  - `service-worker.js` と登録用 `js/pwa.js`

## 追加ファイル
- manifest.webmanifest
- service-worker.js
- js/pwa.js
- assets/images/ui/webappicon_ios.png
- assets/images/ui/webappicon_android.png
- assets/images/ui/webappicon_pwa.png
