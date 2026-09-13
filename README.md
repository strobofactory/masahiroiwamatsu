# NOMAD FIELD — masahiroiwamatsu.com

Masahiro Iwamatsu（岩松正浩）の公式アーカイブ。AI、映像、健康、アプリ、旅、コーヒー、出版など、実際に見て、作って、試した一次情報を長期的に残すためのAstroサイトです。

## Production

- Site: https://www.masahiroiwamatsu.com/
- Notes: https://www.masahiroiwamatsu.com/notes/
- About: https://www.masahiroiwamatsu.com/about/
- Private Studio: https://www.masahiroiwamatsu.com/studio/
- RSS: https://www.masahiroiwamatsu.com/rss.xml
- AI-readable summary: https://www.masahiroiwamatsu.com/llms.txt

## Stack

- Astro
- Vercel static deployment + Vercel Functions
- Astro Content Collections
- Markdown / MDX
- GitHub Contents API
- Bunny Storage（写真）
- Bunny Stream + signed TUS upload（動画）
- RSS
- Sitemap
- Schema.org Person / Organization / WebSite / BlogPosting metadata
- Mailchimp（購読URL接続予定）

## NOMAD FIELD Studio

普段の投稿は `/studio/` だけで完結させます。

1. Claudeで記事を書く
2. Studioに原稿を貼る
3. 写真・動画をドラッグ&ドロップ
4. 必要な位置へ「本文に挿入」
5. 「下書き保存」または「公開」

写真はブラウザ側で最大2400pxのWebPへ自動変換・圧縮してからBunny Storageへ送ります。動画はVercelを経由せず、サーバーで生成した短時間の署名を使ってブラウザからBunny StreamへTUS方式で直接アップロードします。

Studioはパスワード＋HttpOnly Cookieで保護し、`robots.txt` と `noindex` でもクロール対象外にしています。

### Vercel Environment Variables

Production環境に以下を設定します。値はGitHubへcommitしません。

```text
STUDIO_PASSWORD=
STUDIO_SESSION_SECRET=
GITHUB_TOKEN=

BUNNY_STORAGE_ZONE=
BUNNY_STORAGE_PASSWORD=
BUNNY_STORAGE_CDN_URL=https://your-pull-zone.b-cdn.net
BUNNY_STORAGE_HOSTNAME=storage.bunnycdn.com

BUNNY_STREAM_LIBRARY_ID=
BUNNY_STREAM_API_KEY=
```

`STUDIO_SESSION_SECRET` は長いランダム文字列を使います。`GITHUB_TOKEN` はこのリポジトリのContentsを読み書きできるfine-grained tokenを使用します。

### Bunny one-time setup

写真用:
- Bunny Storage Zoneを1つ作成
- Pull Zone/CDNを接続
- Storage Zone名、Password、CDN URLをVercelへ設定

動画用:
- Bunny Stream Video Libraryを1つ作成
- Library IDとStream API KeyをVercelへ設定
- 必要ならSecurityで `www.masahiroiwamatsu.com` をAllowed Referrerに設定

## Publishing model

Studioの公開操作はGitHub Contents APIを使って `src/content/notes/` にMarkdownを保存します。mainブランチへのcommit後、Vercelが自動デプロイします。

手動で作成する場合も、新規記事は原則 `draft: true` で下書きを作り、公開時に `draft: false` へ変更します。

詳細:
- `docs/CONTENT_WORKFLOW.md`
- `docs/NOTE_TEMPLATE.md`
- `docs/MCP_CONNECTOR.md`（Claude.ai Remote MCPによる下書き入稿）
- `AGENTS.md`

## Article metadata

記事には以下を設定できます。

```yaml
title: "記事タイトル"
description: "記事の要約"
pubDate: 2026-09-06
updatedDate: 2026-09-07
tags: ["AI", "Media"]
draft: false
image: "https://media.example.com/cover.webp"
imageAlt: "画像の説明"
imageCaption: "任意のキャプション"
```

記事ページではcanonical、OGP/Twitter Card、Schema.org `BlogPosting`、公開日・更新日を自動出力します。

## External destinations

- BOOKS → Amazon author page
- STROBOFACTORY → https://www.strobofactory.net/
- NEXT ACADEMY → https://nextacademy.mykajabi.com/
- HAPIVERI → https://hapiveri.com/
- HAPIVERI Healthcare.ai → https://www.hapiveri-healthcare.ai/

## Local development

```bash
npm install
npm run dev
```

Vercel Functionsを含めたStudioのローカル確認にはVercel CLIを使用します。

## Remaining setup

1. Vercel Environment Variablesを設定してStudioを有効化
2. Bunny Storage / Streamを作成
3. Mailchimpの購読URLを接続
4. 正式ロゴへ差し替え
5. 本人写真または正式OGPビジュアルを決定
6. 実際のFIELD NOTESを継続追加
