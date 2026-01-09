# slidecast-pipeline

PDFスライドと音声ファイルからMP4動画を生成するツール

## 機能

- **CLI ツール**: コマンドラインから動画を生成
- **Web エディタ**: ブラウザでマーカーを設定して動画を生成
- **AI 支援機能**: 動画の概要欄やクイズを自動生成（オプション）

## インストール

```bash
npm install
```

## 使い方

### Web エディタ（推奨）

```bash
node server.js
```

ブラウザで http://localhost:3001 を開き、PDF と音声ファイルをアップロードしてマーカーを設定します。

### CLI ツール

```bash
# 等間隔でスライド切り替え
node bin/slidecast.js --pdf スライド.pdf --audio 音声.m4a --out 出力.mp4

# マーカーファイルを使用
node bin/slidecast.js --pdf スライド.pdf --audio 音声.m4a --markers markers.json --out 出力.mp4
```

## AI 支援機能の設定

動画生成中に AI 支援機能（概要欄生成、キーポイント抽出、クイズ生成）を使用するには、OpenAI API キーが必要です。GPT-5.2 モデルを使用します。

### API キーの取得

1. [OpenAI Platform](https://platform.openai.com/api-keys) にアクセス
2. アカウントを作成またはログイン
3. API Keys ページで新しいキーを作成

### API キーの設定

プロジェクトルートの `.env` ファイルを編集してください：

```bash
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
```

その後、サーバーを起動します：

```bash
node server.js
```

API キーが設定されていない場合でも、動画生成機能は通常通り使用できます。AI 機能のみが無効になります。

## 依存関係

- Node.js 18+
- ffmpeg
- pdftoppm (poppler-utils)

### macOS

```bash
brew install ffmpeg poppler
```

### Ubuntu/Debian

```bash
sudo apt-get install ffmpeg poppler-utils
```

## テスト

```bash
npx playwright test
```

## ライセンス

MIT
