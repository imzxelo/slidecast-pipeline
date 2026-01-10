# Tasks.md — Slidecast Pipeline Tasks

## 目標（納品ライン）
PDF + 音声 → MP4 を **1コマンドで生成**できる。
等間隔に加えて、**手動マーカーによる同期**ができる。
Slide Sync Editorで `markers.json` を作成し、CLIへ渡せる。
**AI支援機能**で動画制作を効率化する。

---

## Git / PR 情報

| 項目 | 値 |
|------|-----|
| 現在のブランチ | `task/T-023-ai-auto-markers` |
| PR | [#5 T-023: AI自動マーカー生成機能](https://github.com/imzxelo/slidecast-pipeline/pull/5) |
| PR状態 | ⏳ **OPEN** |

### PR履歴
| PR | タイトル | 状態 |
|----|----------|------|
| [#2](https://github.com/imzxelo/slidecast-pipeline/pull/2) | T-020: Slide Sync Editor完成 | ✅ MERGED |
| [#3](https://github.com/imzxelo/slidecast-pipeline/pull/3) | T-021: API バグ修正（Gemini/OpenAI） | ✅ MERGED |
| [#4](https://github.com/imzxelo/slidecast-pipeline/pull/4) | T-022: CLI 使い勝手向上 - 進捗表示追加 | ✅ MERGED |
| [#5](https://github.com/imzxelo/slidecast-pipeline/pull/5) | T-023: AI自動マーカー生成機能 (Phase 6) | ⏳ OPEN |

### 最近のコミット履歴（task/T-023-ai-auto-markers）
```
df828ff feat: AI自動マーカー生成UX改善 + パフォーマンス最適化
0bc9196 feat: AI自動マーカー生成機能を追加 (Phase 6)
```

---

## 現在の進行状況

| Phase | 内容 | 状態 |
|-------|------|------|
| 0 | リポジトリ初期化 | ✅ Done |
| 1 | 等間隔MP4生成 | ✅ Done |
| 2 | timings.csv / markers.json 対応 | ✅ Done |
| 3 | Slide Sync Editor（ローカルWeb） | ✅ Done |
| 4 | README整備 | ✅ Done |
| 5 | 使い勝手向上 | ✅ Done |
| 6 | AI自動マーカー生成 | 🔄 In Progress |

---

## 既知のバグ（修正済み）

### BUG-001: Gemini PDF分析が動作しない ✅ 修正済み
- **症状**: 「PDF分析（Gemini）」ボタンを押してもローディングが永遠に続く
- **原因**: `config.thinkingConfig.thinkingBudget` に無効な値 `"minimal"` を渡していた
- **修正内容** (2026-01-10):
  - `thinkingConfig` を削除
  - モデルを `gemini-2.0-flash` に変更

### BUG-002: 動画が保存されない ❓ 再現不可
- **症状**: 動画生成が完了しても、ファイルがダウンロードされない
- **調査結果** (2026-01-10):
  - サーバー側の動画生成APIは正常動作（MP4ファイルが正しく生成される）
  - フロントエンドのダウンロード処理も問題なし
  - 環境依存の問題の可能性あり（ブラウザのダウンロード設定等）

### BUG-003: OpenAI GPT-5.2 AI機能が動作しない ✅ 修正済み
- **症状**: AI支援機能のボタンを押してもローディングが続く
- **原因**: Responses APIのレスポンス取得方法が間違っていた
  - 誤: `data.output_text`
  - 正: `data.output[0].content[0].text`
- **修正内容** (2026-01-10):
  - レスポンス取得を正しい形式に修正

---

## 完了した変更履歴

### 2026-01-10: API バグ修正

#### 修正内容
- [x] **BUG-001: Gemini API修正**
  - 原因: `config.thinkingConfig.thinkingBudget` に無効な値 `"minimal"`（文字列）を渡していた
  - 修正: `thinkingBudget: 0`（整数）に変更、モデルは `gemini-3-flash-preview` を維持
  - コミット: `39ef366`, 追加修正あり

- [x] **BUG-003: OpenAI API修正**
  - 原因: Responses APIのレスポンス取得方法が間違っていた
  - 修正: `data.output_text` → `data.output[0].content[0].text`
  - コミット: `39ef366`

- [x] **BUG-002: 動画保存問題調査**
  - 結果: サーバー側の動画生成APIは正常動作（再現不可）
  - curlテストでMP4ファイル正常生成を確認

---

### 2026-01-09: Phase 3 拡張 + AI統合

#### 追加機能
- [x] **UI画面から直接動画生成・ダウンロード**
  - Expressサーバー（server.js）を追加
  - `/api/generate` エンドポイントでPDF+音声→MP4変換
  - multerによるファイルアップロード対応

- [x] **ローディングアニメーション（クレーンゲーム風）**
  - 動画生成中に楽しいアニメーションを表示
  - 進捗率とステータスメッセージを表示
  - 箱がコンテナに落ちていくビジュアル

- [x] **AI支援機能パネル**
  - 概要欄を生成（OpenAI GPT-5.2）
  - キーポイント抽出
  - クイズを生成
  - アニメーションとAIパネルの切り替え機能

- [x] **OpenAI GPT-5.2 Responses API統合**
  - 推論モード（reasoning: { effort: 'medium' }）対応
  - .envファイルからAPIキー読み込み

- [x] **Gemini 3.0 Flash PDF分析機能**（未動作）
  - @google/genai パッケージ追加
  - 各スライドを画像として読み取り、内容を要約
  - `/api/ai/analyze` エンドポイント追加

- [x] **PlaywrightによるUIテスト**
  - 10テストケース実装
  - `npx playwright test` で実行可能

#### UX改善
- [x] **マーカー追加後に自動で次のスライドへ進む**
- [x] **マーカー一覧にスライドサムネイル画像を表示**
- [x] **動画生成時に音声を自動停止**
- [x] **t=0マーカーがない場合、スライド1を自動補完**

#### UIデザイン変更
- [x] **プロフェッショナル・高級感のあるデザイン**
  - ネイビー×ゴールド×オフホワイトの配色
  - Noto Sans JPフォント
  - 高齢者向けに読みやすいUI

#### ドキュメント
- [x] **README.md整備**
  - インストール手順
  - CLI/Webエディタの使い方
  - API設定方法
- [x] **デモ動画用台本**（docs/demo-script.md）

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

## Phase 2: timings.csv / markers.json 対応 ✅
- [x] `--timings` オプション追加（CSV: `index,seconds`、indexは1始まり）
- [x] 指定スライドは秒数固定、未指定は残り時間を均等配分
- [x] 指定合計 > 音声長 ならエラー
- [x] 未指定0枚で残り時間がある場合は最後スライドへ加算
- [x] `--markers` オプション追加（JSON: `{ markers: [{ t, slide }, ...] }`）
- [x] `dur = next.t - current.t`、最後は `audioDuration - last.t`
- [x] durが負/0ならエラー（どのマーカーが問題か表示）
- [x] markersの順序に従ってスライドを並べ替え可能（飛び/戻り対応）
- [x] `--timings` と `--markers` の併用はエラー

**DoD**: `--timings` と `--markers` のどちらでもMP4生成が成立する

---

## Phase 3: Slide Sync Editor（ローカルWeb）✅

### 基本機能
- [x] PDF表示（ページ送り/サムネイル一覧）
- [x] 音声再生/停止/シーク（キーボード操作対応）
- [x] マーカー追加（Mキー）と一覧編集（t/slide/削除）
- [x] markers.json Export/Import
- [x] プログレスバー上にマーカー位置を表示

### 動画生成機能
- [x] UI画面から直接動画生成・ダウンロード
- [x] Expressサーバー（server.js）
- [x] ローディングアニメーション（クレーンゲーム風）
- [x] 動画生成時に音声を自動停止

### AI支援機能
- [x] 概要欄生成（OpenAI GPT-5.2）
- [x] キーポイント抽出
- [x] クイズ生成
- [x] PDF分析（Gemini 3.0 Flash）✅ 修正済み
- [x] アニメーション/AIパネル切り替え

### UX改善
- [x] マーカー追加後に次のスライドへ自動切り替え
- [x] マーカー一覧にスライドサムネイル表示
- [x] t=0マーカーがない場合の自動補完

### テスト
- [x] PlaywrightによるUIテスト（10テストケース）
- [ ] 可能なら簡易波形表示（未実装・オプション）

**DoD**: サンプルPDF+音声でマーカーを打ち、markers.jsonを出力できる。UI画面から動画生成も可能。

---

## Phase 4: README整備 ✅
- [x] インストール手順（`brew install ffmpeg poppler`）
- [x] 基本的な使い方（等間隔 / timings / markers）
- [x] Slide Sync Editorの起動方法
- [x] AI支援機能の設定方法（OpenAI/Gemini API キー）
- [ ] markers.jsonの詳細な使い方
- [ ] トラブルシューティング（依存不足、変換失敗など）

**DoD**: READMEだけで第三者が実行できる

---

## Phase 5: 使い勝手向上 ✅
- [x] `--workdir` 指定対応（未指定時はタイムスタンプ付き一時dir）
- [x] `--dry-run` 対応（計算結果・コマンドを表示して終了）
- [x] 進捗表示（処理中のステップを出力）

**DoD**: `--dry-run` で何が実行されるか事前確認できる ✅

---

## Phase 6: AI自動マーカー生成 🔄（進行中）

### 6-1. PDF内容分析
- [x] Gemini 3.0 Flash でスライド画像を読み取り（既存）
- [x] 各スライドの内容を要約してキャッシュ（既存）
- [x] `/api/ai/analyze` エンドポイント（既存）
- [x] **並列処理で高速化**（15スライド: 5分→10秒）

### 6-2. 音声文字起こし
- [x] Whisper API で音声をテキスト化
- [x] タイムスタンプ付きのトランスクリプト生成
- [x] `/api/ai/transcribe` エンドポイント追加
- [x] **25MB超の音声ファイルを自動圧縮**（ffmpeg使用）
- [x] **OpenAI SDK使用でファイルアップロード修正**

### 6-3. 自動マーカー生成
- [x] AIがスライド内容と音声テキストをマッチング（GPT-5.2）
- [x] 適切なタイミングでマーカーを自動配置
- [x] `/api/ai/auto-markers` エンドポイント追加
- [x] **マーカーを時間順にソート**

### 6-4. UI統合
- [x] 「AI自動マーカー生成」セクションを追加（目立つ位置に配置）
- [x] **PDF/音声読み込み時に自動でAI分析開始**（ボタン不要）
- [x] 進捗状況のリアルタイム表示（処理中/完了/エラー）
- [x] マーカー生成結果を直接適用（確認ダイアログ削除）

### 6-5. パフォーマンス最適化
- [x] **動画生成高速化**（35分→数分: `-preset ultrafast`, `-tune stillimage`）
- [x] PDF分析並列処理（30倍高速化）
- [x] E2Eテスト追加（Playwright）

**DoD**: PDFと音声をアップロードすると、AIが自動でマーカーを提案する

---

## 今後追加したい機能（バックログ）

### 高優先度
- [ ] 簡易波形表示（オーディオビジュアライザー）
- [ ] マーカーのドラッグ&ドロップ編集
- [ ] アンドゥ/リドゥ機能

### 中優先度
- [ ] 複数プロジェクトの保存/読み込み
- [ ] 動画プレビュー機能
- [ ] エクスポート形式の選択（MP4/WebM等）

### 低優先度
- [ ] 多言語対応
- [ ] ダークモード
- [ ] キーボードショートカットのカスタマイズ

---

## 技術スタック

### フロントエンド
- HTML/CSS/JavaScript（バニラ）
- PDF.js（PDF表示）
- HTML5 Audio API

### バックエンド
- Node.js + Express
- multer（ファイルアップロード）
- dotenv（環境変数）

### 外部API
- OpenAI GPT-5.2 Responses API（AI生成）✅
- Gemini 3.0 Flash (gemini-3-flash-preview)（PDF分析）✅

### ツール
- ffmpeg/ffprobe（動画生成）
- pdftoppm（PDF→PNG変換）
- Playwright（UIテスト）

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

# UIテスト
npx playwright test
```

### 実素材での最終確認
- 実素材は **成果物の品質確認** にのみ使用
- エージェントが自動テストで実素材を使うことは禁止

---

## 環境設定

### 必須
```bash
brew install ffmpeg poppler
npm install
```

### APIキー設定（.env）
```
OPENAI_API_KEY=sk-xxx
GEMINI_API_KEY=AIza...
```

### サーバー起動
```bash
node server.js
# → http://localhost:3001
```
