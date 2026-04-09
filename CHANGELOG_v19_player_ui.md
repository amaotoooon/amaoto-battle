# v19 player UI / spectator chat patch

## 反映内容
- プレイヤー画面TOPをロゴ中心の1ボタン構成へ変更
- プレイヤー情報入力 / ルームコード入力 / 対戦準備のデザインを参考画像寄せに更新
- 追加素材を組み込み
  - `assets/images/ui/game_logo.png`
  - `assets/images/ui/game_logo_wide.png`
  - `assets/images/ui/player_bg.png`
  - `assets/images/ui/shiro_02_brown_roof_blue.png`
- ボディ選択 / スキルカード選択の中身構成は v18 を維持しつつ、見出しアイコンのみ反映
- ステージ遷移時にイントロ以外で共通ヘッダーを表示
- 観戦画面チャットをシンプル吹き出し寄せに調整

## 主な編集ファイル
- `index.html`
- `css/player.css`
- `css/spectator.css`
- `js/player.js`


## v20 追加修正
- トラブル回避を「相手の次の行動を無効」に変更
- プレイヤー画面の見出し下余白を拡張
- ボディ/スキル見出し文言を修正し、ボディ見出しアイコンを `icon_player_left.png` に変更
- 行動選択をスマホでも2列維持
- 行動確定後の待機中は、選択内容と変更ボタンのみ表示
- 実行待機中でも現在の選択行動を表示
- 反撃のドラを HP15以下以外では押せないよう変更
- 観戦画面ヘッダーをワイドロゴへ差し替え
- 観戦画面のチャット吹き出ししっぽをテキスト背面へ調整
- 観戦画面で被ダメージ時にハート画像へ簡易アニメーションを追加
