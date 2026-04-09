# GitHub更新用パック

このフォルダは、そのまま GitHub リポジトリ直下に置ける構成です。

## 主なファイル
- `index.html` : プレイヤー画面
- `master.html` : マスター画面
- `spectator.html` : 観戦画面
- `manifest.webmanifest` : 単一PWA設定（プレイヤー / 観戦 / マスターのショートカット入り）
- `service-worker.js` : 最小サービスワーカー
- `js/config.js` : Supabase接続設定

## Supabase設定
`js/config.js` の以下を編集してください。

```js
window.AM_SYNC_CONFIG = {
  mode: "supabase",
  supabaseUrl: "YOUR_SUPABASE_URL",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",
  tableName: "room_states",
  pollIntervalMs: 1500
};
```

## GitHub Pages
ルートに `index.html` があるので、このフォルダの中身をそのままコミットすれば公開構成にしやすいです。

## PWA
- アプリ名: あまおと丸ぷれぜんつ｜リスナーバトル
- ホーム画面 / デスクトップ起動時の既定ページ: プレイヤー画面
- ショートカット:
  - プレイヤー
  - 観戦
  - マスター
