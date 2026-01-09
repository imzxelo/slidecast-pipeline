# Tasks.md — Slidecast Pipeline Tasks

## 目標（納品ライン）
PDF + 音声 → MP4 を **1コマンドで生成**できる。
等間隔に加えて、**手動マーカーによる同期**ができる。
Slide Sync Editorで `markers.json` を作成し、CLIへ渡せる。

---

## 現在の進行状況

| Phase | 内容 | 状態 |
|-------|------|------|
| 0 | リポジトリ初期化 | ✅ Done |
| 1 | 等間隔MP4生成 | ✅ Done |
| 2 | timings.csv / markers.json 対応 | 🔄 Doing |
| 3 | Slide Sync Editor（ローカルWeb） | 🔄 Doing |
| 4 | README整備 | ⏳ Todo |
| 5 | 使い勝手向上 | ⏳ Todo |

---

## Phase 0: リポジトリ初期化 ✅
- [x] Node.jsプロジェクト作成（`package.json`）
- [x] `.gitignore` 作成
- [x] `bin/slidecast.js` 雛形（引数パース/--help）

**DoD**: `node bin/slidecast.js --help` が動く

---

## Phase 1: 等間隔MP4生成 ✅

### 1-1. 依存コマンドチェック
- [x] `ffmpeg` / `ffprobe` / `pdftoppm` の存在確認
- [x] 無ければ `brew install ffmpeg poppler` を案内して終了

### 1-2. PDF→PNG変換
- [x] `pdftoppm -png` でPDF→PNG生成
- [x] workdir（一時ディレクトリ）に `slide-0001.png` 形式で保存

### 1-3. 音声duration取得
- [x] `ffprobe` で音声長（秒）を取得
- [x] 取得失敗時はエラー終了

### 1-4. duration配分計算
- [x] 音声長 ÷ スライド枚数 で等間隔計算
- [x] 端数は最後のスライドに寄せる（合計=音声長を厳守）

### 1-5. ffmpegで動画生成
- [x] concat demuxer用の `concat.txt` 生成
- [x] 画像→無音動画→音声合体でMP4出力
- [x] H.264/AAC、yuv420pで互換性重視

### 1-6. 後処理
- [x] `--keep-work` が無ければworkdir削除

**DoD**: `node bin/slidecast.js --pdf X --audio Y --out Z` で音声が最後まで鳴り、スライドが最後まで切り替わるMP4が生成される

---

## Phase 2: timings.csv / markers.json 対応 🔄
- [ ] `--timings` オプション追加（CSV: `index,seconds`、indexは1始まり）
- [ ] 指定スライドは秒数固定、未指定は残り時間を均等配分
- [ ] 指定合計 > 音声長 ならエラー
- [ ] 未指定0枚で残り時間がある場合は最後スライドへ加算
- [ ] `--markers` オプション追加（JSON: `{ markers: [{ t, slide }, ...] }`）
- [ ] `dur = next.t - current.t`、最後は `audioDuration - last.t`
- [ ] durが負/0ならエラー（どのマーカーが問題か表示）
- [ ] markersの順序に従ってスライドを並べ替え可能（飛び/戻り対応）
- [ ] `--timings` と `--markers` の併用はエラー

**DoD**: `--timings` と `--markers` のどちらでもMP4生成が成立する

---

## Phase 3: Slide Sync Editor（ローカルWeb）🔄
- [ ] PDF表示（ページ送り/サムネイル一覧）
- [ ] 音声再生/停止/シーク（キーボード操作対応）
- [ ] マーカー追加（Mキー）と一覧編集（t/slide/削除）
- [ ] markers.json Export/Import
- [ ] 可能なら簡易波形表示

**DoD**: サンプルPDF+音声でマーカーを打ち、markers.jsonを出力できる

---

## Phase 4: README整備 ⏳
- [ ] インストール手順（`brew install ffmpeg poppler`）
- [ ] 基本的な使い方（等間隔 / timings / markers）
- [ ] Slide Sync Editorの起動方法
- [ ] markers.jsonの使い方
- [ ] トラブルシューティング（依存不足、変換失敗など）

**DoD**: READMEだけで第三者が実行できる

---

## Phase 5: 使い勝手向上 ⏳
- [ ] `--workdir` 指定対応（未指定時はタイムスタンプ付き一時dir）
- [ ] `--dry-run` 対応（計算結果・コマンドを表示して終了）
- [ ] 進捗表示（処理中のステップを出力）

**DoD**: `--dry-run` で何が実行されるか事前確認できる

---

## テストルール

### 基本方針
- **テストは必ずダミーデータを使用する**
- 実際の素材（長時間音声など）は最終確認のみに使用する
- ダミーデータでの動作確認を優先し、コンテキスト負荷と処理時間を最小化する

### ダミーデータの作成方法
```bash
# ダミーPDF（3ページ）を作成
node -e "
const PDFDocument = require('pdfkit');
const fs = require('fs');
const doc = new PDFDocument();
doc.pipe(fs.createWriteStream('test-input/dummy.pdf'));
for (let i = 1; i <= 3; i++) {
  if (i > 1) doc.addPage();
  doc.fontSize(48).text('Slide ' + i, 100, 250);
}
doc.end();
"

# ダミー音声（10秒の無音）を作成
ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 10 -q:a 9 -acodec libmp3lame test-input/dummy.mp3
```

### テスト実行
```bash
# ダミーデータでテスト
node bin/slidecast.js --pdf test-input/dummy.pdf --audio test-input/dummy.mp3 --out test-output/test.mp4
```

### 実素材での最終確認
- 実素材は **成果物の品質確認** にのみ使用
- エージェントが自動テストで実素材を使うことは禁止
