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

## 緊急で修正が必要なバグ

### BUG-001: Gemini PDF分析が動作しない 🔴
- **ファイル**: `server.js` (259-320行付近)
- **症状**: 「PDF分析（Gemini）」ボタンを押すとローディングが永遠に続く
- **原因推定**: @google/genai パッケージのAPI呼び出し形式が間違っている
- **修正方針**:
  ```javascript
  // 現在のコード（間違い？）
  const response = await geminiClient.models.generateContent({...})

  // 正しい形式を公式ドキュメントで確認する
  // https://ai.google.dev/gemini-api/docs
  ```

### BUG-002: OpenAI GPT-5.2 AI機能が動作しない
- **ファイル**: `server.js` (322-348行付近)
- **症状**: AI支援ボタンを押すとローディングが続く
- **原因推定**: OpenAI Responses API の形式が間違っている
- **現在のコード**:
  ```javascript
  const response = await fetch('https://api.openai.com/v1/responses', {...})
  return data.output_text;  // ← このフィールド名が正しいか確認
  ```

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

### 1. バグ修正（P0）
- [ ] Gemini API呼び出しを修正
- [ ] OpenAI Responses API呼び出しを修正
- [ ] サーバーログでエラー詳細を確認

### 2. Phase 6: AI自動マーカー生成
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

## 最後に確認したこと（2026-01-09）

1. t=0マーカー自動補完は実装済み（サーバー再起動で反映）
2. Gemini/OpenAI APIは未動作（API呼び出し形式の修正が必要）
3. Tasks.md にバグ・変更履歴・将来計画を集約済み
4. PRはマージ待ち状態
