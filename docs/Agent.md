# Agent.md
# このリポジトリ用：自動開発エージェント運用ルール（日本語）

## 目的
このリポジトリは「PDFスライド + 音声（m4a等）→ MP4動画」を自動生成するツールを作る。

### 提供する機能
1. **CLI ツール** - PDFと音声を入力すると、1コマンドでMP4が生成される
2. **Slide Sync Editor（Web UI）** - ブラウザでマーカー編集・動画生成
3. **AI支援機能** - 概要欄/キーポイント/クイズ生成（OpenAI + Gemini）

### 重要な体験
- PDFと音声を入力すると、1コマンドでMP4が生成される（等間隔のスライド切替でOK）
- 必要に応じて `timings.csv` でスライド表示秒数を上書きできる
- Slide Sync Editorで手動マーカーを打ち、`markers.json` を反映できる
- READMEだけで第三者が再現できる（依存インストール含む）

詳細は requirements.md を正とする。

---

## 現在の進捗状況

| Phase | 内容 | 状態 |
|-------|------|------|
| 0 | リポジトリ初期化 | ✅ Done |
| 1 | 等間隔MP4生成 | ✅ Done |
| 2 | timings.csv / markers.json 対応 | ✅ Done |
| 3 | Slide Sync Editor（Web UI） | ✅ Done |
| 4 | README整備 | ✅ Done |
| 5 | 使い勝手向上 | ⏳ Todo |
| 6 | AI自動マーカー生成 | ⏳ Todo |

---

## 既知のバグ（優先度順）

| ID | 症状 | ファイル | 優先度 |
|----|------|----------|--------|
| BUG-001 | Gemini PDF分析が動作しない | `server.js:259-320` | P0 |
| BUG-002 | 動画が保存されない | 調査中 | P0 |
| BUG-003 | OpenAI AI機能が動作しない | `server.js:322-348` | P1 |

詳細は `Tasks.md` を参照。

---

## エージェントの基本姿勢（超重要）
- **チャットでタスク粒度の逐次報告は禁止。**
  - 進捗は `Tasks.md` に記録すること。
  - チャット/最終メッセージは「何をしたか」「どう確認するか」「PR情報」のみを簡潔に日本語で書く。
- **DoD達成までやり切る。** 途中で止めない。
  - 実装 → テスト → 失敗なら修正 → 再テスト を繰り返す（自動ループ）。
- **不明点があっても"納品優先"で前に進む。**
  - ただし要件逸脱や安全性（秘密情報漏洩）の可能性がある場合は止まって相談する。

---

## 作業開始時の手順
1. `HANDOVER.md` と `Tasks.md` を読み、次に着手するタスクを1つ決める（優先度P0→P1）。
2. 新しいブランチを作成する（mainへの直コミット禁止）
   - ブランチ名例：`task/T-000-smoke` / `task/T-010-cli-core`
3. そのタスクの DoD（完了条件）とテスト手順を `Tasks.md` に **DOING** として明記する。

---

## Git運用（必須）
- **コミットは随時（小さく）行う。**
  - 目安：1つの意味のある変更（CLI実装、README追記、エラーハンドリング追加など）ごとに1コミット。
- コミットメッセージは日本語で簡潔に：
  - 例：`feat: PDF+音声→MP4生成の等間隔パイプラインを追加`
  - 例：`fix: ffmpeg未導入時のエラーメッセージ改善`
  - 例：`docs: READMEにbrew手順と実行例を追記`
- タスク完了時：
  1) `Tasks.md` を **DONE** に更新
  2) PRを作成（※mainへpushしない。ブランチpush→PRはOK）
  3) PR本文に「変更概要 / テスト方法 / DoDチェック」を書く
- **pushは禁止ではない**（PRにはブランチpushが必要）が、**mainへのpushは絶対禁止**。

---

## テスト方針（必須：タスクレベルの自動検証）

### CLIテスト
- `node bin/slidecast.js --help` が動くこと
- 依存コマンドチェックが効くこと（`ffmpeg` / `ffprobe` / `pdftoppm`）
- 代表入力でMP4が生成されること（ローカルで再現可能な手順をREADMEに記載）

### Webエディタテスト
- `npx playwright test` でUIテスト（10ケース）を実行
- サーバー起動: `node server.js` → http://localhost:3001

### スモーク確認（最重要）
- 小さめのPDF（数ページ）＋短い音声（数十秒〜数分）で実行し、
  - `output.mp4` が生成される
  - 音声が最後まで鳴る
  - スライドが最後まで切り替わる
  を確認する。

### ダミーデータの使用
- **テストは必ずダミーデータを使用する**
- 実素材（長時間音声など）は最終確認のみに使用
- 詳細は `Tasks.md` の「テストルール」セクションを参照

---

## ローカル実行のルール

### CLI実行例
```bash
# 等間隔
node ./bin/slidecast.js --pdf ./input/slides.pdf --audio ./input/audio.m4a --out ./dist/output.mp4

# timings指定（任意）
node ./bin/slidecast.js --pdf ./input/slides.pdf --audio ./input/audio.m4a --timings ./input/timings.csv --out ./dist/output.mp4

# markers指定（任意）
node ./bin/slidecast.js --pdf ./input/slides.pdf --audio ./input/audio.m4a --markers ./input/markers.json --out ./dist/output.mp4
```

### Webエディタ起動
```bash
node server.js
# → http://localhost:3001
```

- 失敗したら修正→再実行を必ず行う。
- `--dry-run` / `--keep-work` がある場合は、デバッグに活用する。

---

## PR作成ルール（必須）
- PRは「タスク単位」で1本。
- PRタイトル：`T-XXX: <タスク名>`
- PR本文テンプレ：
  - 目的（requirementsにどう効くか）
  - 変更点（箇条書き）
  - 動作確認（コマンド・入力例）
  - DoDチェックリスト（✅で埋める）
- PRは **Draft** でも良い（最初はDraft推奨）。

---

## 出力ルール（チャットでの報告）
- 最終メッセージは日本語で、以下のみ：
  1) 何をしたか（3〜7行）
  2) どう確認するか（コマンド）
  3) PR情報（タイトル/概要）
- タスク粒度の逐次ログは書かない（必要ならTasks.mdやPRに残す）。

---

## MCP（Model Context Protocol）連携

このリポジトリでは以下のMCPツールが利用可能。

### MCP fetch（外部ドキュメント参照）

外部ドキュメントをその場で取得・確認できる。

#### いつ使うか
- **ffmpeg/ffprobe のオプション確認**
- **pdftoppm のオプション確認**
- **OpenAI / Gemini API の形式確認**
- **その他CLIツールの公式ドキュメント**

### 参照すべき公式URL（優先度順）
| ツール | URL |
|--------|-----|
| ffmpeg concat demuxer | https://ffmpeg.org/ffmpeg-formats.html#concat |
| ffmpeg codecs | https://ffmpeg.org/ffmpeg-codecs.html |
| ffprobe | https://ffmpeg.org/ffprobe.html |
| pdftoppm (poppler) | https://poppler.freedesktop.org/ |
| OpenAI API | https://platform.openai.com/docs/api-reference |
| Gemini API | https://ai.google.dev/gemini-api/docs |

#### 注意点
- **推測で書かない** — オプションや形式に迷ったら必ず公式を引く
- **エラー発生時** — まず公式ドキュメントで正しい構文を確認する

### MCP Playwright（ブラウザ自動化）

**※現在は未設定。設定後に利用可能。**

Playwright MCPを使うと、ブラウザ操作を自動化してWebエディタのテストや動作確認が可能になる。

#### いつ使うか
- **Webエディタの動作確認** — マーカー追加、動画生成、AI機能のE2Eテスト
- **生成動画の再生確認** — ブラウザで動画を開いて再生できるか確認
- **UIの視覚的な確認** — スクリーンショットを撮ってレイアウト崩れをチェック
- **既存のPlaywrightテストの補完** — `tests/editor.spec.js` と併用

#### 使用例
```javascript
// Webエディタを起動してマーカーを追加
await page.goto('http://localhost:3001');
await page.click('#load-files-btn');
// ... マーカー追加操作など
await page.screenshot({ path: 'screenshot.png' });
```

#### 注意点
- **サーバー起動が必要** — `node server.js` でサーバーを起動してから実行
- **既存テストとの使い分け** — `npx playwright test` は回帰テスト、MCP Playwrightはインタラクティブな確認・デバッグに使う

---

## ファイル構成

```
slidecast-pipeline/
├── bin/
│   └── slidecast.js      # CLI ツール本体
├── editor/
│   └── index.html        # Web エディタ（HTML/CSS/JS一体）
├── server.js             # Express サーバー（API）
├── docs/
│   ├── Agent.md          # このファイル（運用ルール）
│   ├── requirement.md    # 要件定義
│   ├── demo-script.md    # デモ動画用台本
│   └── HANDOVER.md       # 引き継ぎドキュメント
├── Tasks.md              # タスク管理・バグ追跡
├── README.md             # 使い方
├── .env                  # APIキー（git管理外）
└── tests/
    └── editor.spec.js    # Playwright UIテスト
```

---

## 環境セットアップ

```bash
# 依存ツール
brew install ffmpeg poppler

# npm依存
npm install

# APIキー設定
cp .env.example .env
# .env を編集:
# OPENAI_API_KEY=sk-xxx
# GEMINI_API_KEY=AIza...

# サーバー起動
node server.js
# → http://localhost:3001
```
