# 勤怠管理 Discord Bot

Discord上で勤怠管理を行うためのボットです。

## 機能

- **業務開始**: `t!start` コマンドで業務開始時刻を記録
- **休憩管理**: `t!break-start` と `t!break-end` コマンドで休憩時間を管理
- **業務終了**: `t!end` コマンドで業務終了、勤務時間を表示
- **状況確認**: `t!status` コマンドで現在の勤務状況を確認
- **ユーザ別管理**: ユーザごとに独立した勤怠データを管理
- **自動通知**: 1時間おきに経過時間を通知
- **自動終了**: 日本時間の日付変更時（午前0時）に自動で業務終了

## セットアップ

1. 依存関係をインストール:
```bash
npm install
```

2. 環境変数を設定:
`.env.example` を `.env` にコピーして、Discord Bot Token を設定してください。

```bash
cp .env.example .env
```

3. Discord Bot Token の取得:
   - [Discord Developer Portal](https://discord.com/developers/applications) でアプリケーションを作成
   - Bot を作成してトークンを取得
   - 必要な権限: `Send Messages`, `Read Message History`

4. Bot を起動:
```bash
node index.js
```

## コマンド一覧

| コマンド | 説明 |
|----------|------|
| `t!start` | 業務開始 |
| `t!break-start` | 休憩開始 |
| `t!break-end` | 休憩終了 |
| `t!end` | 業務終了 |
| `t!status` | 現在の勤務状況確認 |

## デプロイメント

このボットはRailwayで24時間稼働可能です：

1. GitHubリポジトリをRailwayに接続
2. 環境変数 `DISCORD_TOKEN` を設定
3. 自動デプロイで運用開始

## 注意事項

- 勤務データはメモリ上に保存されるため、ボット再起動時にデータは消失します
- 日本時間（Asia/Tokyo）を基準に動作します
- 1時間おきの通知は休憩中は行われません
- ユーザごとに独立した勤怠管理が行われます