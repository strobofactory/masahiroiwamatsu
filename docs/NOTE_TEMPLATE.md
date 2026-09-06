# FIELD NOTE TEMPLATE

新しい記事は `src/content/notes/<slug>.md` として作成します。

```md
---
title: "記事タイトル"
description: "検索・SNS・AI向けの要約。80〜140文字程度を目安にする。"
pubDate: 2026-09-06
# updatedDate: 2026-09-07
tags: ["AI", "Media"]
draft: true
# image: "/images/notes/example.jpg"
# imageAlt: "画像の内容を具体的に説明"
# imageCaption: "撮影場所や補足。不要なら削除"
---

導入本文。

## 見出し

本文。

## 見出し

本文。
```

## 公開ルール

- ファイル名は英数字とハイフンのみを推奨します。例: `nagasaki-field-note.md`
- 下書きは `draft: true`。公開時だけ `draft: false` にします。
- `description` は本文の単純な抜粋ではなく、記事が何の一次情報を含むかを明確に書きます。
- 画像を指定する場合、アクセシビリティのため `imageAlt` は必須です。
- 事実・固有名詞・日付は確認できたものだけを書きます。
- AIが補完した一般論を、本人の体験のように書かないでください。
- 公開後に内容を実質変更した場合は `updatedDate` を追加します。
