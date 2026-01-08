# Tasks.md — Slidecast Pipeline Tasks (CLI-only)

## 目標（納品ライン）
PDF + 音声 → MP4 を **1コマンドで生成**できる。
同期は等間隔でOK。必要ならCSVで秒数調整できる。

---

## 現在の進行状況

| Phase | 内容 | 状態 |
|-------|------|------|
| 0 | リポジトリ初期化 | ✅ Done |
| 1 | 等間隔MP4生成 | 🔄 Doing |
| 2 | timings.csv対応 | ⏳ Todo |
| 3 | 使い勝手向上 | ⏳ Todo |
| 4 | README整備 | ⏳ Todo |

---

## Phase 0: リポジトリ初期化 ✅
- [x] Node.jsプロジェクト作成（`package.json`）
- [x] `.gitignore` 作成
- [x] `bin/slidecast.js` 雛形（引数パース/--help）

**DoD**: `node bin/slidecast.js --help` が動く

---

## Phase 1: 等間隔MP4生成 🔄

### 1-1. 依存コマンドチェック
- [ ] `ffmpeg` / `ffprobe` / `pdftoppm` の存在確認
- [ ] 無ければ `brew install ffmpeg poppler` を案内して終了

### 1-2. PDF→PNG変換
- [ ] `pdftoppm -png` でPDF→PNG生成
- [ ] workdir（一時ディレクトリ）に `slide-0001.png` 形式で保存

### 1-3. 音声duration取得
- [ ] `ffprobe` で音声長（秒）を取得
- [ ] 取得失敗時はエラー終了

### 1-4. duration配分計算
- [ ] 音声長 ÷ スライド枚数 で等間隔計算
- [ ] 端数は最後のスライドに寄せる（合計=音声長を厳守）

### 1-5. ffmpegで動画生成
- [ ] concat demuxer用の `concat.txt` 生成
- [ ] 画像→無音動画→音声合体でMP4出力
- [ ] H.264/AAC、yuv420pで互換性重視

### 1-6. 後処理
- [ ] `--keep-work` が無ければworkdir削除

**DoD**: `node bin/slidecast.js --pdf X --audio Y --out Z` で音声が最後まで鳴り、スライドが最後まで切り替わるMP4が生成される

---

## Phase 2: timings.csv対応 ⏳
- [ ] `--timings` オプション追加
- [ ] CSV読み込み（`index,seconds` 形式、indexは1始まり）
- [ ] 指定スライドは秒数固定、未指定は残り時間を均等配分
- [ ] 指定合計 > 音声長 ならエラー
- [ ] 未指定0枚で残り時間がある場合は最後スライドへ加算

**DoD**: 任意スライドだけ長く/短くした指定が反映される

---

## Phase 3: 使い勝手向上 ⏳
- [ ] `--workdir` 指定対応（未指定時はタイムスタンプ付き一時dir）
- [ ] `--dry-run` 対応（計算結果・コマンドを表示して終了）
- [ ] 進捗表示（処理中のステップを出力）

**DoD**: `--dry-run` で何が実行されるか事前確認できる

---

## Phase 4: README整備 ⏳
- [ ] インストール手順（`brew install ffmpeg poppler`）
- [ ] 基本的な使い方（等間隔 / timings指定）
- [ ] トラブルシューティング（依存不足、変換失敗など）

**DoD**: READMEだけで第三者が実行できる
