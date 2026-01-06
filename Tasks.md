# Tasks.md — Slidecast Pipeline Tasks (CLI-only)

## 目標（納品ライン）
PDF + 音声 → MP4 を **1コマンドで生成**できる。
同期は等間隔でOK。必要ならCSVで秒数調整できる。

現在の進行状況：Phase 1（DOING）

## 作業中（DOING）
- Phase 1: 等間隔MP4生成
  - DoD: PDF + m4a から `output.mp4` が生成され、音声とスライドが最後まで再生される
  - テスト: `node bin/slidecast.js --help` と代表入力での生成確認

---

## Phase 0: リポジトリ初期化
- [x] Node.jsプロジェクト作成（`package.json`）
- [x] `.gitignore` 作成（`dist/`, `work/`, `node_modules/`, `*.DS_Store`）
- [x] `bin/slidecast.js` 雛形（引数パース/--help）

完了条件：
- `node bin/slidecast.js --help` が動く

---

## Phase 1: P0（等間隔MP4生成）を完成させる（最優先）
- [ ] `pdftoppm` でPDF→PNG生成（workdirに保存）
- [ ] 生成PNGをページ順で列挙（`slide-0001.png` などゼロ埋め推奨）
- [ ] `ffprobe` で音声duration（秒）取得
- [ ] 等間隔duration配分を計算（合計が音声durationになるように、端数は最後に寄せる）
- [ ] `concat.txt` 生成（ffmpeg concat demuxer形式、最後のfile重複を忘れない）
- [ ] ffmpegで無音動画生成 → 音声合体 → `--out` にMP4出力
- [ ] `--keep-work` が無い場合はworkdir削除

完了条件：
- PDF + m4a で `output.mp4` が生成され、音声が最後まで鳴りスライドが最後まで切り替わる

---

## Phase 2: P1（timings.csv対応）を追加する
- [ ] `--timings` を受け取れるようにする
- [ ] CSV読み込み（headerあり想定：`index,seconds`。indexは1始まり）
- [ ] 指定スライドは秒数固定
- [ ] 未指定スライドは残り時間を均等配分
- [ ] 指定合計が音声長超過ならエラー
- [ ] 未指定0枚で残り時間がある場合は最後スライドへ加算（または警告して加算）

完了条件：
- 任意スライドだけ長く/短くした指定が反映される

---

## Phase 3: 使い勝手（納品の安定性）
- [ ] `--workdir` 指定対応（指定が無ければタイムスタンプ付き作業dir）
- [ ] `--dry-run` 対応（計算結果・生成コマンドを表示して終了）
- [ ] 依存コマンド存在チェック（ffmpeg/ffprobe/pdftoppm）

完了条件：
- 依存が無い時に「brew install ffmpeg poppler」を案内して止まる
- `--dry-run` で何をするか見える

---

## Phase 4: README整備（第三者が再現できる）
- [ ] インストール手順（brew）
- [ ] 使い方（等間隔 / timings）
- [ ] よくある失敗（依存不足、PDF変換失敗、音声duration取得失敗）
- [ ] 出力仕様（dist/workの扱い、keep-workの挙動）

完了条件：
- READMEだけ読めば第三者が実行できる

---

## Phase 5: 動作確認（最低限）
- [ ] 受領素材（PDF + m4a）で実行しMP4生成
- [ ] スライド枚数が多い場合（例：30枚）でも破綻しない
- [ ] CSV指定で2〜3枚だけ長くして反映される

完了条件：
- 納品できるMP4が1本できる
