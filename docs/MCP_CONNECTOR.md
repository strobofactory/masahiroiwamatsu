# NOMAD FIELD Remote MCP Connector

Claude.aiの通常チャットからNOMAD FIELDの記事を読み、新規下書きの作成と既存下書きの更新だけを行う専用Remote MCPです。

## 実装範囲

- 接続先: `https://www.masahiroiwamatsu.com/api/mcp`
- Transport: MCP Streamable HTTP（stateless JSON response）
- ツール: `list_articles`、`get_article`、`create_draft`、`update_draft` の4つだけ
- 保存先: `strobofactory/masahiroiwamatsu` のサーバー設定済みブランチにある `src/content/notes/<slug>.md`
- 認証: Auth0のAuthorization Code + S256 PKCEを使う事前登録OAuthクライアント
- 公開と削除: MCPでは未提供

MCPは既存のStudio Cookieを使いません。`api/studio/publish.js` も呼ばないため、公開・翻訳・他言語ファイル更新は発生しません。GitHubのrepository、branch、file pathをツール引数で変更することもできません。

## 本番利用前の重要事項

このGitHub repositoryは公開されています。`draft: true` はWebサイト、RSS、sitemap、記事ページから除外するためのフラグであり、秘密保持機能ではありません。`main` の `src/content/notes/` に保存した下書き本文はGitHub上で第三者が閲覧できます。

秘密の原稿を扱う場合は、本番接続前に保存先の方針を別途決める必要があります。この実装はrepositoryをprivateへ変更せず、別CMSにも移行しません。

## Auth0を採用した理由

ClaudeのCustom Connectorは、DCRを実装しなくても、追加時に事前登録済みOAuth Client ID / Secretを指定できます。Auth0に認可サーバーを委ねることで、認可コードの短い有効期限と一度限りの利用、PKCE、redirect URIの厳密検証、トークン発行・失効をVercelのプロセスメモリやローカルファイルに置かずに管理できます。

MCP resource server側でも次を検証します。

- JWT署名（RS256、Auth0 JWKS）
- `iss`、`aud`、`exp`
- `azp` / `client_id` がClaude専用の事前登録clientと一致すること
- `articles:read` と `drafts:write` scope
- `sub` が `MCP_OWNER_SUB` と完全一致すること

OAuth Client IDだけでは権限を与えません。別ユーザーが同じAuth0ログイン画面を通ってトークンを得ても、所有者の`sub`と一致しなければ403で拒否します。

初期版では`offline_access`をadvertiseせず、refresh tokenを発行しません。access token失効後はClaude側で再接続します。これにより長期トークンの管理を減らせます。

参考:

- [Claude Custom Connector](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [Claude connector authentication](https://claude.com/docs/connectors/building/authentication)
- [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [Auth0 MCP resource parameter compatibility](https://auth0.com/ai/docs/mcp/guides/resource-param-compatibility-profile)
- [Auth0 access token validation](https://auth0.com/docs/secure/tokens/access-tokens/validate-access-tokens)

## Auth0の準備（ユーザー操作・本番承認後）

Auth0は新しい外部サービスです。2026年9月時点のFree planは月額$0でクレジットカード不要、最大25,000 MAUと案内されていますが、契約条件は設定時に[公式料金ページ](https://auth0.com/pricing)で再確認してください。本番設定は所有者の承認後に行います。

1. Auth0 Dashboardでtenantを作成または選択します。tenant作成自体はこの変更では行いません。
2. **Settings > Advanced > Settings** で **Resource Parameter Compatibility Profile** を有効にします。MCPクライアントがRFC 8707の`resource`を送った際、これをaccess tokenのaudienceとして使うために必須です。Dynamic Client Registrationは有効にしません。
3. **Applications > APIs > Create API** でAPIを作成します。
   - Name: `NOMAD FIELD Drafts`
   - Identifier: `https://www.masahiroiwamatsu.com/api/mcp`
   - Signing algorithm: `RS256`
   - **Permissions**: `articles:read`（記事読取）、`drafts:write`（下書き作成・更新）
   - 公開・削除permissionは作りません。
4. **Applications > Applications > Create Application** で `NOMAD FIELD Claude Connector` を作成し、種類は **Regular Web Applications** を選びます。
5. Applicationの **Settings** を設定します。
   - **Allowed Callback URLs**: `https://claude.ai/api/mcp/auth_callback` の完全一致1件だけ。wildcard、localhost、Preview URLは追加しません。
   - **Application Type**: `Regular Web Application`
   - **Token Endpoint Authentication Method**: `POST`（ClaudeにClient Secretを入力するconfidential client）
6. **Advanced Settings > Grant Types** では `Authorization Code` だけを本用途に使用します。初期版では`Refresh Token`を使用せず、`Client Credentials`、Password、Implicit grantも使用しません。
7. TenantのOAuth discovery documentで `code_challenge_methods_supported` に `S256` が含まれることを確認します。ClaudeはAuthorization Code flowでS256 PKCEを送ります。
8. 対象APIについて、Claude Applicationが `articles:read` と `drafts:write` を要求できるようにします。
9. 所有者本人で一度Auth0へログインします。**User Management > Users > 所有者ユーザー > Details** に表示される `user_id` を控えます。これはaccess tokenの`sub`です。
10. APIの **Settings > Token Settings** でAccess Token Lifetimeを短時間（推奨3600秒）にします。

初期版ではrefresh tokenを発行しません。access token失効後はClaudeのConnectorから再接続します。失効させる場合は **User Management > Users > 所有者ユーザー > Authorized Applications** で `NOMAD FIELD Claude Connector` の **Revoke** を実行し、Claude側でもDisconnectします。その後に再接続すると新しい認可になります。

Auth0 Free planの通常機能だけを使い、Organizations、Enterprise Connections、Pro MFA、Custom Token Exchange、専用custom domainなどのtrial・有料機能には依存しません。使用するのはRegular Web Application、Custom API、Authorization Code + PKCE、RS256 JWT/JWKS、scope、resource parameter互換設定、user grantの失効です。契約画面にtrial表示がある場合も、有料機能を有効にせずFreeへ切り替えてから設定内容を再確認します。

Auth0のClient SecretをGitHubやVercelへ保存しません。ClaudeのCustom Connector追加画面のAdvanced settingsにだけ入力します。

## Vercel Environment Variables

**Vercel Dashboard > strobofactory's projects > masahiroiwamatsu > Settings > Environment Variables** で設定します。値は管理画面へ直接入力し、チャットへ貼らず、GitHubへcommitしないでください。

```text
GITHUB_TOKEN=<fine-grained token; Contents read/write for this repository only>
MCP_RESOURCE_URL=https://www.masahiroiwamatsu.com/api/mcp
MCP_SITE_BASE_URL=https://www.masahiroiwamatsu.com
MCP_GITHUB_BRANCH=main
MCP_OAUTH_ISSUER=https://<tenant>.auth0.com/
MCP_OAUTH_JWKS_URL=https://<tenant>.auth0.com/.well-known/jwks.json
MCP_OAUTH_CLIENT_ID=<Claude専用Auth0 ApplicationのClient ID>
MCP_OWNER_SUB=auth0|...
MCP_RATE_LIMIT_PER_MINUTE=60
```

`GITHUB_TOKEN`、`MCP_OWNER_SUB`はSensitive扱いにします。`MCP_OAUTH_CLIENT_ID`は秘密ではありませんが、Vercelで一元管理します。Auth0 Client SecretはVercelへ設定しません。

設定不足時は503となり、認証なしには切り替わりません。実際のrequest URLと`MCP_RESOURCE_URL`が一致しないdeploymentも503で無効化します。`VERCEL_ENV=preview`で`MCP_GITHUB_BRANCH=main`になっている場合も503で停止し、Previewから本番branchへ書き込みません。

Previewで試す場合は、本番と分離したブランチとPreview URLを必ず設定します。

```text
MCP_RESOURCE_URL=https://<preview-host>/api/mcp
MCP_SITE_BASE_URL=https://<preview-host>
MCP_GITHUB_BRANCH=codex/nomad-field-mcp-drafts
```

非`main`ブランチで本番Studio URLを設定すると安全側で停止します。保存結果の`editorUrl`もPreview URLになります。

Preview接続検証ではAuth0 API Identifierも`https://<preview-host>/api/mcp`と完全一致させる必要があります。本番用Identifierと混在させません。最初は認証済みの`initialize`、`tools/list`、`list_articles`、`get_article`だけで確認し、書込テストは公開範囲を理解した非機密ダミー原稿について別途承認を得てから行います。

## Vercel Firewall

関数内に認証済み所有者単位の固定window rate limitがあります。ただしserverless instanceごとの補助防御です。Vercel WAFは、無効なtokenを含む外部リクエストがFunctionとAuth0/JWKS処理へ到達する前に、送信元IP単位で抑制する役割を担います。

現在、対象`masahiroiwamatsu` projectのteamはVercel **Pro** planで、WAF rate limitingを利用できます。設定する場合も **Project > masahiroiwamatsu > Firewall > Configure > New Rule** で、このprojectの次の1ルールだけに限定します。

- If: Request Path equals `/api/mcp`
- Then: Rate Limit
- Strategy: Fixed Window
- Time Window: 60 seconds
- Request Limit: 60
- Key: IP
- Exceeded action: 429

`/.well-known/oauth-protected-resource`、公開ページ、`/studio/`、既存`/api/studio/*`には適用しません。最初はLogで条件一致を確認し、課金画面を確認してからRate Limitをpublishします。この指示ではFirewall設定を変更していません。

Vercelのrate limitingは全planで利用でき、現在は100万allowed requests/月を含み、超過は地域により100万件あたり$0.50からと案内されています。初回はDashboardでPricing dialogへの同意が必要です。詳細は[Vercel WAF Rate Limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)を確認してください。

監査ログには時刻、ランダムrequest ID、ハッシュ化した所有者ID、ツール名、成否、slug、エラーコードだけを出します。access token、GitHub token、記事本文、Auth0 Client Secretは出しません。

## Claude.aiへの接続

本番deploymentと上記設定を承認・完了した後に行います。

1. Claude.aiの **Customize > Connectors** を開きます。
2. **+ > Add custom connector**を選びます。
3. **Remote MCP URL**に `https://www.masahiroiwamatsu.com/api/mcp` を入力します。
4. **Advanced settings > OAuth Client ID / OAuth Client Secret** にAuth0 Applicationの値を、Auth0画面から直接コピーして入力します。チャットや文書を経由しません。
5. Connectし、所有者のAuth0アカウントで認可します。
6. 通常チャットでコネクタを有効にします。

接続解除はClaudeのConnectorsからDisconnectします。即時失効が必要な場合はAuth0で該当user grantをrevokeします。再接続は同じ手順で新しい認可を行います。

## 保存時の挙動

- `create_draft`は必ず`draft: true`で新規`.md`を作ります。同じslugの別内容は409で拒否します。
- `update_draft`は`get_article`が返したGit blob SHAを`version`として必須にします。
- 省略した項目は保持します。`image`、`imageAlt`、`imageCaption`、`updatedDate`の空文字は明示的な消去です。title、description、body、pubDateは空にできません。
- 公開済み記事、存在しない記事、`.mdx`、未知または複雑なFrontmatterは変更しません。
- Contents APIのSHA付きPUTで保存時点の競合を検出します。
- 保存後にGitHubから読み戻し、内容が一致した場合だけ成功を返します。
- 同内容の再試行は新しいcommitを作らず`replayed: true`を返します。
- 成功結果はGitHub保存確認とWeb反映未確認を分け、下書きの公開URLは返しません。

## ローカル検証

テストは機密情報を含まないメモリ上のダミー原稿だけを使います。GitHub本番データには書き込みません。

```bash
npm test
npm run build
```

`npm test`には公式MCP TypeScript SDKのClientとStreamable HTTP transportを使った`initialize`、`tools/list`、`tools/call`の実通信テストが含まれます。
