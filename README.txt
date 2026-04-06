あまおと丸バトル / v4

【今回の追加】
・外部同期の土台を追加しました
・ローカル同期(localStorage + BroadcastChannel)はそのまま使えます
・Supabase を使う場合は js/config.js を編集してください
・観戦画面は、ボディカードを大きめ・発動スキルカードを小さめに調整しました
・観戦画面は左右とも「ボディ + そのターンの発動スキル」を横並びで表示します

【ローカル試運転】
1. ZIPを展開
2. master.html を開く
3. index.html を2つ開く
4. spectator.html を開く
5. ルームコードをそろえて試運転

【外部同期を使う場合】
1. Supabase で新規プロジェクトを作成
2. SQL エディタで次を実行

create table if not exists public.room_states (
  room_code text primary key,
  state_json jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.room_states enable row level security;

create policy "public read room states"
on public.room_states
for select
using (true);

create policy "public write room states"
on public.room_states
for insert
with check (true);

create policy "public update room states"
on public.room_states
for update
using (true)
with check (true);

3. Project URL と anon key を控える
4. js/config.js を開いて、mode を "supabase" に変更
5. supabaseUrl と supabaseAnonKey を入力
6. 同じファイル一式を GitHub Pages などに置く

【補足】
・今の外部同期は、Supabase の room_states テーブルをポーリングして同期する方式です
・まずは本番前の試運転用として使いやすい構成です
・高頻度アクセスや本格運用をする場合は、後で Realtime や認証を足す余地があります
