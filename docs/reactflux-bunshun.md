# Nextfluxから移植した文春・Chrome翻訳対応

対象: `electh/ReactFlux` の `f4dfd1c9999d1d72a1164d7fbbe08da972e4ab1b`。
移植元: `kazu756/nextflux` の `441315a`（Chrome翻訳）、`008ceb5`（画像）、`9707868`（複数ページ本文）。

## 変更内容

- 本文HTMLが変わるときに本文のDOMを置き換え、Chrome翻訳が変更したテキストノードをReactが差分更新する際の衝突を避けます。既読・スターだけの更新では本文を置き換えません。
- 文春CDN画像だけを画像Workerへ振り分けます。Miniflux標準の画像プロキシURLも、設定したサーバーとパスに一致する場合のみ解決します。
- 本文・サムネイル・ライトボックスのURLを記事の整形時に統一します。対象画像のsrcset/pictureによるWorkerの迂回も防ぎます。
- 文春の全文取得だけを記事Workerへ振り分け、同一記事の公開ページを最大5ページまで結合します。途中のページ取得や記事識別に失敗した場合、表示中の本文を保持します。
- 有料・認証が必要な本文は対象外です。Worker未設定時と文春以外の記事は従来のMiniflux全文取得を使用します。
- 取得中に記事やログインセッションが切り替わった場合の結果の破棄は、ReactFlux既存のリクエスト管理を維持しています。

## Cloudflare Pages

1. ReactFluxをForkし、この変更を取り込みます。
2. Cloudflare PagesでForkしたリポジトリを接続します。
3. Node.jsは22.22以上（推奨24）、インストールは `pnpm install --frozen-lockfile`、ビルドは `pnpm build`、出力は `build` を指定します。
4. ビルド環境変数を設定し、再デプロイします。

```dotenv
VITE_BUNSHUN_IMAGE_WORKER_URL=https://nextflux-bunshun-images.nago687-7e7.workers.dev
VITE_BUNSHUN_ARTICLE_WORKER_URL=https://nextflux-bunshun-articles.nago687-7e7.workers.dev
```

上記はNextfluxで使っている既存WorkerのURLです。この変更ではWorkerやPagesへのデプロイは行っていません。
環境変数は公開されるビルド設定です。APIトークンを入れないでください。

既存の記事Workerを共用する場合、**そのWorkerの `ALLOWED_ORIGINS` にReactFluxの公開URLのオリジンを追加する必要があります**。Nextfluxの既存オリジンも残してください。例:

```text
https://nextflux-8zh.pages.dev,https://YOUR-REACTFLUX.pages.dev
```

`YOUR-REACTFLUX` は実際のPages名に置き換えます。プロトコルとホストだけを指定し、末尾の `/` やパスは付けません。
画像Workerの実装にはオリジンの許可設定はありません。

## 別Workerとして運用する場合

同梱の `workers/bunshun-images` と `workers/bunshun-articles` は別名 `reactflux-bunshun-*` で用意しています。既存のNextflux Workerを上書きしません。

記事Workerの `workers/bunshun-articles/wrangler.jsonc` の `ALLOWED_ORIGINS` を実際のReactFluxオリジンへ変更してから、リポジトリのルートで次を実行します。

```sh
pnpm install --frozen-lockfile
pnpm dlx wrangler@4.153.0 deploy --config workers/bunshun-images/wrangler.jsonc
pnpm dlx wrangler@4.153.0 deploy --config workers/bunshun-articles/wrangler.jsonc
```

この場合は作成された2つのWorker URLをPagesの環境変数へ設定してください。

## ローカル動作確認

`.env.example` を `.env.local` へコピーし、必要なWorker URLを設定します。
記事Workerにはローカルのオリジンも許可してください（例 `http://127.0.0.1:3000`）。

```sh
pnpm test:articles
pnpm lint
pnpm build
pnpm dev
```

全文取得はReactFluxの既存ボタンまたは既定の `D` キーを使います。Nextfluxと同じ `G` にしたい場合は「設定 → キーボードショートカット」で変更できます。

## 公開後の確認

- 文春の通常本文・一覧の画像・拡大画像が表示されること。
- 文春記事93048、93131、93233等で全文取得を行い、公開ページの末尾まで結合されること。
- 文春以外の記事の画像と全文取得が従来通り使えること。
- Chromeで英語記事を日本語へ翻訳し、全文取得・記事切替・既読・スター操作でクラッシュしないこと。
- Workerの許可オリジン違いなどで取得が失敗した際、元の本文が保持されること。

自動テストは33件（画像URL判定、画像Worker、本文抽出・結合、CORS、サイズ・タイムアウト、画像表示用HTMLの整形）。実際のChrome翻訳および公開Pagesでの動作確認は、デプロイ後に必要です。
