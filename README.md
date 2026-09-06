# NOMAD FIELD — masahiroiwamatsu.com

Masahiro Iwamatsu（岩松正浩）の公式アーカイブ。AI、映像、健康、アプリ、旅、コーヒー、出版など、実際に見て、作って、試した一次情報を長期的に残すためのAstroサイトです。

## Production

- Site: https://www.masahiroiwamatsu.com/
- Notes: https://www.masahiroiwamatsu.com/notes/
- About: https://www.masahiroiwamatsu.com/about/
- RSS: https://www.masahiroiwamatsu.com/rss.xml
- AI-readable summary: https://www.masahiroiwamatsu.com/llms.txt

## Stack

- Astro
- Vercel static deployment
- Astro Content Collections
- Markdown / MDX
- RSS
- Sitemap
- Schema.org Person / Organization / WebSite / BlogPosting metadata
- Mailchimp（購読URL接続予定）

## Publishing model

NOMAD FIELDは管理画面型CMSを使わず、**Markdown + GitHub + Vercel**で運用します。

新規記事は `src/content/notes/` に作成します。原則として `draft: true` で下書きを作り、公開指示後に `draft: false` へ変更します。mainブランチへのcommit後、Vercelが自動デプロイします。

詳細:
- `docs/CONTENT_WORKFLOW.md`
- `docs/NOTE_TEMPLATE.md`
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
image: "/images/notes/example.jpg"
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

## Remaining setup

1. Mailchimpの購読URLを接続
2. 正式ロゴへ差し替え
3. 本人写真または正式OGPビジュアルを決定
4. 実際のFIELD NOTESを継続追加
