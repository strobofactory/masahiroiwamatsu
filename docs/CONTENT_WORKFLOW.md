# NOMAD FIELD — Content Workflow

NOMAD FIELDは、管理画面型CMSを使わず、Markdown + GitHub + Vercelで運用します。

## 推奨フロー

1. 岩松正浩が、体験・メモ・写真・音声書き起こしなど一次素材を用意する。
2. ChatGPT / Codexに「NOMAD FIELDの記事にする」と依頼する。
3. AIは一次素材を優先し、一般論を本人の体験として補わない。
4. `src/content/notes/<slug>.md` に `draft: true` で下書きを作る。
5. 内容を確認・修正する。
6. 公開承認後だけ `draft: false` に変更する。
7. mainブランチへのcommitでVercelが自動デプロイする。
8. 公開後、RSS・sitemap・個別記事URLが自動更新される。

## このチャットでの依頼例

- 「このメモをNOMAD FIELDの記事にしてください。まだ下書きで」
- 「この写真3枚を使って記事にしてください」
- 「この記事を公開してください」
- 「昨日の記事に追記して更新日を入れてください」

## URL

記事ファイル名がURLになります。

`src/content/notes/nagasaki-coffee.md`

→ `https://www.masahiroiwamatsu.com/notes/nagasaki-coffee/`

## 画像

記事用画像は原則 `public/images/notes/` に置き、Markdown frontmatterでは `/images/notes/...` で参照します。

例:

```yaml
image: "/images/notes/nagasaki-coffee.jpg"
imageAlt: "長崎の焙煎スペースに置かれたコーヒー豆と焙煎機"
imageCaption: "Nagasaki, 2026"
```

画像を設定すると、記事ページのメイン画像とOGP/Twitter画像に利用されます。

## 記事メタデータ

公開記事には自動的に以下が出力されます。

- canonical URL
- meta description
- Open Graph
- Twitter Card
- Schema.org `BlogPosting`
- 公開日 / 更新日
- 著者: Masahiro Iwamatsu / 岩松正浩
- タグ

## 編集原則

NOMAD FIELDの価値は記事量ではなく原典性です。AIは文章整理・翻訳・構成には使いますが、本人が経験していない出来事、未確認の事実、架空の発言を一次情報として追加しません。
