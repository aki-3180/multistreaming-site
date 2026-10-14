# セキュリティテスト チェックリスト

このサイト（および類似の静的/クライアントサイド Web アプリ）に対して脆弱性テストを
行うときに確認すべき項目をまとめたもの。**次回はこのファイルを更新しながら使う。**

---

## 0. 鉄則（最初に必ず読む）

1. **構成を先に確定する。構成が「どの脆弱性クラスが成立するか」を決める。**
   テストの前にアーキテクチャを特定しないと、存在しない層（DB・サーバー・自前認証）を
   延々と叩いて空振りする。各カテゴリには「**該当しない条件 (N/A)**」を併記してある。

2. **ソースがあるならホワイトボックス（コード精査）を優先する。**
   本番 URL へブラインドでペイロードを投げるブラックボックステストは、
   (a) 精度が低い（バックエンドが見えない）、(b) 本番データ/ログを汚す、
   (c) WAF・レート制限に当たる、(d) 権限/スコープの問題がある。
   コードを読めば「どの行がなぜ危険か」を特定でき、修正パッチまで出せる。

3. **「見つからなかった」と「そもそも存在しない」を分けて報告する。**
   前者は「安全の確認」、後者は「攻撃面が無い」。混同すると誤った安心感につながる。

4. **対象が自分の資産（または明示的に許可された対象）であることを確認する。**
   他者のサイトへの能動的攻撃テストは許可が前提。

---

## 1. 事前調査（Recon / 攻撃面の特定）

| 確認 | 方法 | 判断 |
|------|------|------|
| 静的サイトか / SSR か / SPA+API か | デプロイ構成、`server.*`、フレームワーク | バックエンドの有無が後続すべてを左右 |
| バックエンド通信の有無 | `grep -nE 'fetch\(|XMLHttpRequest|WebSocket|sendBeacon' app.js` | 0件なら自前 API・DB 無し |
| 認証方式 | 自前 / OAuth / 第三者埋め込みへ委譲 / なし | セッション・CSRF・パスワード系の該当可否を決める |
| 秘密情報の混入 | `grep -niE 'api[_-]?key|secret|token|password|bearer'` | クライアント配布物に秘密を置いていないか |
| 外部スクリプト/CDN | `grep -nE '<script|<link' index.html` | サプライチェーン・SRI の対象 |
| データフロー | **source（入力）→ sink（出力/実行）** の対応を洗う | XSS/インジェクションの核心 |

**source（入力源）の例**: URL パラメータ, `location.hash`, フォーム入力, `localStorage`/`sessionStorage`,
`postMessage`, Cookie, 外部 API レスポンス。
**sink（危険な出力/実行先）の例**: `innerHTML`/`outerHTML`/`insertAdjacentHTML`, `document.write`,
`eval`/`new Function`/文字列 `setTimeout`, `location`/`location.href`, `element.setAttribute('href'|'src')`,
`a.href`, テンプレートの属性補間, DB クエリ, OS コマンド, ファイルパス。

---

## 2. カテゴリ別チェック

### 2.1 SQL / NoSQL / コマンドインジェクション
- **確認**: ユーザー入力がサーバー側クエリ・OS コマンドに連結されていないか。
  パラメータ化クエリ / プリペアドステートメントを使っているか。
- **N/A 条件**: バックエンド・DB・サーバー側処理が存在しない（= `fetch` 等が無い純粋な静的サイト）。
  注入対象のクエリが1つも無ければ原理的に成立しない。

### 2.2 XSS（クライアントサイド主戦場）
- **入力側**: 全ての source が **allowlist 検証**を通っているか（`[a-z0-9_]` 等の厳格な正規表現で、
  不一致は reject）。拒否ではなく「エスケープして通す」場合はエスケープ漏れを疑う。
- **出力側**:
  - ユーザー由来データを **`textContent` で描画**しているか（安全）。
  - `innerHTML` にユーザー由来データを入れていないか。入れる場合は**属性の外へ出られないか**
    （`id="${x}"` → `x` に `"` が入ると属性ブレイクアウト）。sink 直前のサニタイズも確認。
  - DOM clobbering / `javascript:` スキームの URL（`href`/`src` に `javascript:` や `data:` が入らないか）。
- **`postMessage` 受信**: `event.origin` を**厳格に検証**しているか（前方一致や `indexOf` は不可。完全一致 or 厳格な正規表現）。
- **`postMessage` 送信**: `targetOrigin` に `'*'` を使っていないか（宛先を固定する）。
- **CSP**: XSS の多層防御として CSP があるか（2.6 参照）。
- **テスト用ペイロード（自分の資産に対してのみ）**:
  `<script>alert(1)</script>`, `"><img src=x onerror=alert(1)>`, `javascript:alert(1)`,
  `'"><svg onload=alert(1)>`, hash に `#"><img src=x onerror=alert(1)>`。
  → 入力欄・URL パラメータ・`#`ハッシュ・保存名（プリセット等）・エラー表示に投入し、
  DOM に生の `<`/`>`/`"` のまま反映される箇所を探す。
- **N/A 条件**: なし（クライアントサイド JS がある限り常に対象）。

### 2.3 ディレクトリトラバーサル / パストラバーサル
- **確認**: ユーザー入力がファイルパスに使われる箇所で `../`・`..\`・URL エンコード（`%2e%2e%2f`）・
  二重エンコードを弾けるか。正規化後に許可ルート配下にあることを検証しているか
  （`startsWith(ROOT + path.sep)` で**兄弟ディレクトリ名のプレフィックス一致**も塞ぐ）。
- **N/A 条件**: パスを受け取る処理が無い（静的ホスティングでファイル名パラメータが無い）。
  ただしローカル dev サーバー（`server.mjs` 等）があれば別途確認。

### 2.4 セッションハイジャック
- **確認**: セッション ID の乱数品質（予測不可能性）、Cookie 属性（`HttpOnly`/`Secure`/`SameSite`）、
  タイムアウト・ログアウトでの失効、固定化（session fixation）対策。
- **N/A 条件**: 自前セッションを持たない（認証を第三者埋め込みに委譲し、自前 Cookie が無い）。
  この場合、認証状態は第三者ドメインの Cookie にあり、こちらの JS からは読めない。

### 2.5 CSRF
- **確認**: 状態変更リクエスト（POST/PUT/DELETE）に CSRF トークン or `SameSite` Cookie or
  Origin/Referer 検証があるか。GET で副作用を起こしていないか。
- **N/A 条件**: 状態変更するサーバーエンドポイント・自前 Cookie が無い。
  （`localStorage` のクライアント状態は CSRF 対象外 — Cookie のように自動送信されない。）

### 2.6 HTTP セキュリティヘッダー
実測: `curl -sS -D - -o /dev/null https://<対象>/`
- [ ] `Content-Security-Policy` — スクリプト/フレーム/接続先を allowlist。`object-src 'none'`,
      `base-uri 'self'`, `frame-ancestors`（クリックジャッキング対策）。
      **埋め込みを使うサイトは `frame-src` に各プレーヤー/チャットのオリジンを過不足なく列挙**し、
      必ず**プレビュー環境で実機確認**（ブロックされると映像/チャットが消える）。
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options`（`frame-ancestors` の後方互換）
- [ ] `Referrer-Policy`（`strict-origin-when-cross-origin` 等）
- [ ] `Strict-Transport-Security`（HSTS）
- [ ] `Permissions-Policy`（不要な `geolocation`/`camera`/`microphone` を無効化）
- [ ] `Cross-Origin-Opener-Policy`（`same-origin`）
- 補足: Vercel は設定が無いと最小限のデフォルトしか付けない → `vercel.json` の `headers` で明示。
- 注意: `X-XSS-Protection` は**現在非推奨**（モダンブラウザは無視、過去に脆弱性も）。
  `0` で明示無効化するか、付けずに CSP に任せる。

### 2.7 パスワードポリシー
- **確認**: 最小長・複雑さ・既知漏洩パスワード拒否（HIBP 等）・レート制限・
  ハッシュ（bcrypt/scrypt/argon2、平文/MD5/SHA1 不可）・リセットフローの安全性。
- **N/A 条件**: 自前のアカウント/パスワード機構が無い（認証を第三者に委譲）。

### 2.8 エラーメッセージ / 情報漏えい
- **確認**: スタックトレース・内部パス・SQL エラー・フレームワークバージョン・
  サーバーソフト名がユーザーに出ていないか。ユーザー向けは汎用文言に。
- **確認**: 列挙攻撃を助ける差分（「ユーザー不在」vs「パスワード不一致」）を出していないか。

### 2.9 その他（構成に応じて）
- **クリックジャッキング**: `frame-ancestors`/`X-Frame-Options`（2.6）。
- **オープンリダイレクト**: `?next=`/`?url=` 等をそのまま `location` に使っていないか。
- **iframe sandbox**: 埋め込みに `sandbox` を付け、`allow-top-navigation`/`allow-popups` を与えない。
  ※ `allow-scripts allow-same-origin` の併用は**同一オリジン**を枠内に入れると sandbox 自己解除の穴になる。
  別オリジンの埋め込みなら親に影響しないので可。
- **サプライチェーン / SRI**: 外部 `<script>`/`<link>` に `integrity`（SRI）を付けられるか
  （バージョン固定の CDN のみ。頻繁に変わる公式 SDK は CSP で許可元を絞る方針に）。
- **Service Worker**: 同一オリジンのみ・意図しないキャッシュ汚染（別オリジンを掴まない）か。
- **クライアントストレージ**: `localStorage`/`sessionStorage` に秘密・トークンを置いていないか。
- **依存関係**: `npm audit` / 既知 CVE（ライブラリを使う場合）。
- **（バックエンドがあれば追加）**: 認可（IDOR / 権限昇格）、SSRF、レート制限、
  ファイルアップロード検証、CORS 設定（`Access-Control-Allow-Origin: *` + credentials 不可）。

---

## 3. よく使う grep / コマンド

```bash
# --- sink（危険な出力/実行先） ---
grep -nE 'innerHTML|outerHTML|insertAdjacentHTML|document\.write' app.js
grep -nE 'eval\(|new Function|setTimeout\([^,]*["\x27]|setInterval\([^,]*["\x27]' app.js
grep -nE 'location\.(href|assign|replace)|window\.open|\.src *=|setAttribute\(' app.js

# --- postMessage（origin 検証・targetOrigin） ---
grep -nE "postMessage|addEventListener\(['\"]message|\.origin" app.js

# --- source / 入力検証 ---
grep -nE 'location\.(hash|search)|URLSearchParams|localStorage|sessionStorage' app.js
grep -nE 'function normalizeKey|replace\(/\[\^' app.js   # allowlist 検証の所在

# --- バックエンド通信・秘密情報・外部読み込み ---
grep -nE 'fetch\(|XMLHttpRequest|WebSocket|sendBeacon' app.js
grep -niE 'api[_-]?key|secret|token|password|bearer' app.js index.html
grep -nE '<script|<link' index.html

# --- ヘッダー実測 ---
curl -sS -D - -o /dev/null https://<対象>/
```

CSP の静的評価には Google の CSP Evaluator（https://csp-evaluator.withgoogle.com/）も使える。

---

## 4. このプロジェクトのベースライン（2026-10-14 時点）

次回はここを**差分の基準**にする（構成が変わったら更新）。

- **構成**: 100% クライアントサイドの静的サイト。`fetch`/XHR/WebSocket ゼロ、
  DB・自前バックエンド・自前認証・秘密情報なし。認証は Twitch/YouTube/Kick 埋め込みへ委譲。
- **判定**:
  | 項目 | 判定 |
  |------|------|
  | SQLi | N/A（DB・バックエンド無し） |
  | XSS | 脆弱性なし。入力は `normalizeKey` の allowlist、描画は `textContent` 中心、`innerHTML` は静的＋`domId()` 二重サニタイズ |
  | トラバーサル | 本番 N/A。dev `server.mjs` は `startsWith(ROOT+sep)` に強化済み |
  | セッション | N/A（自前セッション無し） |
  | CSRF | N/A（状態変更エンドポイント・自前 Cookie 無し） |
  | ヘッダー | `vercel.json` で CSP 等を整備済み（**CSP はプレビューで実機確認必須**） |
  | パスワード | N/A（アカウント機構無し） |
  | エラー | 問題なし（汎用文言のみ） |
- **実施済みの強化**: `vercel.json`（CSP/XFO/nosniff/Referrer-Policy/Permissions-Policy/HSTS/COOP）、
  YouTube 宛 `postMessage` の `targetOrigin` 固定、dev サーバーのパス判定強化。
- **構成が変わったら要再評価**: バックエンド/API を足す、フォーム送信を足す、
  自前ログイン/Cookie を足す、外部 CDN を足す — いずれも上表の N/A が N/A でなくなる。

---

## 5. 報告テンプレート

```
## 対象 / 構成
- URL / リポジトリ / アーキテクチャ（静的 or SSR、バックエンド有無、認証方式）

## 判定サマリー（項目 × 判定: 脆弱性あり / なし / N/A + 理由）

## 詳細（項目ごと）
- 確認した source → sink の経路
- 該当コード（file:line）
- リスク（現実的な攻撃経路を1つ示す。far-fetch なら「低」と明記）
- 修正案（具体コード / 設定）

## 実施した強化と、デプロイ前に人間が確認すべきこと
```
