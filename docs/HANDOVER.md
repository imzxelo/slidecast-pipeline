# 引き継ぎドキュメント（次のセッション用）

## プロジェクト概要
**Slidecast Pipeline** - PDFスライドと音声ファイルからMP4動画を生成するツール

### 主要コンポーネント
1. **CLI ツール** (`bin/slidecast.js`) - コマンドラインからMP4生成
2. **Web エディタ** (`editor/index.html` + `server.js`) - ブラウザでマーカー編集＆動画生成
3. **AI支援機能** - 概要欄/キーポイント/クイズ生成（OpenAI GPT-5.2 + Gemini 3.0 Flash）

---

## 現在のブランチ・PR状況

- **ブランチ**: `task/T-020-slide-sync-editor`
- **PR**: https://github.com/imzxelo/slidecast-pipeline/pull/2
- **状態**: マージ待ち

---

## バグ修正履歴（2026-01-10）

### BUG-001: Gemini PDF分析が動作しない ✅ 修正済み
- **原因**: `config.thinkingConfig.thinkingBudget` に無効な値 `"minimal"` を渡していた
- **修正内容**:
  - `thinkingConfig` を削除
  - モデルを `gemini-2.0-flash` に変更

### BUG-002: 動画保存問題 ❓ 再現不可
- **調査結果**: サーバー側の動画生成APIは正常動作

### BUG-003: OpenAI GPT-5.2 AI機能が動作しない ✅ 修正済み
- **原因**: Responses APIのレスポンス取得方法が間違っていた
- **修正内容**:
  - `data.output_text` → `data.output[0].content[0].text` に変更

---

## 完了済み機能

### Phase 1-4: 基本機能 ✅
- PDF→PNG変換（pdftoppm）
- 音声duration取得（ffprobe）
- 等間隔/マーカー指定での動画生成（ffmpeg）
- Slide Sync Editor（マーカー編集UI）
- Playwrightテスト（10ケース）

### UI機能 ✅
- PDF表示（PDF.js）
- 音声再生/シーク（HTML5 Audio）
- マーカー追加・編集・削除
- markers.json Export/Import
- 動画生成ボタン
- ローディングアニメーション（クレーンゲーム風）

### UX改善 ✅
- マーカー追加後に自動で次のスライドへ
- マーカー一覧にサムネイル表示
- 動画生成時に音声自動停止
- t=0マーカーがない場合の自動補完

---

## 次にやるべきこと（優先順）

### 1. Phase 6: AI自動マーカー生成
- [ ] Gemini でスライド内容を要約
- [ ] Whisper/Speech-to-Text で音声文字起こし
- [ ] AIがスライドと音声をマッチングしてマーカー自動生成

### 3. UX向上
- [ ] 簡易波形表示
- [ ] マーカーのドラッグ&ドロップ編集

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
│   ├── Agent.md          # エージェント運用ルール
│   ├── requirement.md    # 要件定義
│   ├── demo-script.md    # デモ動画用台本
│   └── HANDOVER.md       # この引き継ぎドキュメント
├── Tasks.md              # タスク管理・バグ追跡
├── README.md             # 使い方
├── .env                  # APIキー（git管理外）
├── .env.example          # APIキーテンプレート
└── tests/
    ├── editor.spec.js    # Playwright UIテスト
    └── screenshot.spec.js
```

---

## 重要なコード箇所

### server.js
| 行番号 | 内容 |
|--------|------|
| 1-25 | 初期化・APIキー読み込み |
| 86-130 | computeMarkerPlan（マーカー計算） |
| 174-244 | /api/generate（動画生成API） |
| 259-320 | summarizeSlides（Gemini PDF分析）※要修正 |
| 322-348 | callOpenAI（GPT-5.2呼び出し）※要修正 |
| 351-456 | AI支援エンドポイント |
| 458-494 | /api/ai/analyze（PDF分析エンドポイント） |

### editor/index.html
| 行番号 | 内容 |
|--------|------|
| 1-800 | CSS スタイル |
| 860-910 | ローディングモーダル・AIパネルHTML |
| 960-1000 | renderThumbnails（サムネイル生成） |
| 1072-1094 | addMarker（マーカー追加＋次スライド自動切替） |
| 1357-1365 | AI関連DOM要素 |
| 1501-1550 | PDF分析（Gemini）ボタンハンドラ |

---

## 環境セットアップ

```bash
# 依存ツール
brew install ffmpeg poppler

# npm依存
npm install

# APIキー設定
cp .env.example .env
# .env を編集して以下を設定:
# OPENAI_API_KEY=sk-xxx
# GEMINI_API_KEY=AIza...

# サーバー起動
node server.js
# → http://localhost:3001

# テスト
npx playwright test
```

---

## APIキー

| サービス | 環境変数 | 用途 |
|----------|----------|------|
| OpenAI | OPENAI_API_KEY | AI生成（概要欄/キーポイント/クイズ） |
| Gemini | GEMINI_API_KEY | PDF分析 |

---

## 対象ユーザー

**あずまさん**（高齢者向け教材作成者）
- UIは日本語
- プロフェッショナル・高級感のあるデザイン
- 操作は分かりやすく

---

## 参考リンク

- [OpenAI Responses API](https://platform.openai.com/docs/api-reference)
- [Gemini API](https://ai.google.dev/gemini-api/docs)
- [ffmpeg concat demuxer](https://ffmpeg.org/ffmpeg-formats.html#concat)
- [PDF.js](https://mozilla.github.io/pdf.js/)

---

## 最後に確認したこと（2026-01-10）

1. t=0マーカー自動補完は実装済み
2. **Gemini API修正済み** - `thinkingConfig` を削除、モデルを `gemini-2.0-flash` に変更
3. **OpenAI API修正済み** - レスポンス取得を正しい形式 `data.output[0].content[0].text` に修正
4. 動画生成APIは正常動作（curlでMP4生成を確認）
5. PRはマージ待ち状態
