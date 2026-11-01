# BEACON backend

Vercel Node 20 functions (ESM). The only runtime dependency is `@solana/web3.js@1.99.0`. No Raydium SDK: the LaunchLab
layouts and curve math are ported to BigInt in `lib/launchlab.js` and checked against `@raydium-io/raydium-sdk-v2` on
live pools (`../backend-test/xcheck-curve.mjs`, 12/12 pools equal, base transfer fees 0/100/300 bps included).

## Endpoints

| Route | What it does |
|---|---|
| `GET /api/actions/buy?mint=` | Solana Actions metadata (blink card): 0.1 / 0.5 / 1 SOL buttons + a custom `{amount}` field |
| `POST /api/actions/buy?mint=&amount=[&slip=bps]` body `{account}` | `{type:"transaction", transaction, message}`: an unsigned v0 tx, fee payer = account, fresh blockhash |
| `OPTIONS /api/actions/*` | 200 + Actions/CORS headers |
| `GET /api/token?mint=` | compact coin JSON for the frontend, `route` = `curve-sol` / `curve-swap` / `jupiter`, s-maxage 10 |
| `GET /api/trending` | top 24 StonkFun coins by 24h volume, s-maxage 30 |
| `/actions.json` | maps `/b/*` → `/api/actions/buy?mint=*` and `/api/actions/**` → itself |
| `/b/:mint` | rewritten to `/b.html` for people (not caught: `/actions.json`, `/api/*`) |
| `/api/actions/buy/:mint` | path-style alias of the action (rewrite), for an `actions.json` that avoids a query string in `apiPath` |

Errors always come back as `{message}` with 4xx/5xx and the same headers.

## Buy routing (one transaction every time)

- **curve-sol**: pool on the bonding curve, quote SOL. Create ATAs (idempotent), wrap SOL into WSOL, `buy_exact_in`, close WSOL.
- **curve-swap**: pool on the curve, other quote (STONK, xStocks, ZEC...). Jupiter ExactIn SOL→quote
  (slippage `min(slip, 300)` bps), then `buy_exact_in` spending Jupiter's `otherAmountThreshold`, compiled with Jupiter's
  ALTs. If the tx is over 1232 bytes it re-quotes with fewer Jupiter accounts (32 → 24 → 16 → 12).
- **jupiter**: pool migrated/migrating (status ≠ 0) or no LaunchLab pool found. Jupiter SOL→coin directly.

Defaults: slippage 1500 bps (`?slip=` 1..5000), compute limit 200k / 700k / 600k by route, priority price
`PRIORITY_MICROLAMPORTS` (default 100000). Optional fee: `FEE_WALLET` gets `FEE_BPS` (default 50) of the SOL amount,
taken out of the amount (1 SOL at 50 bps → 0.005 to the fee wallet, 0.995 into the buy).

## Env vars

| Var | Needed | Notes |
|---|---|---|
| `HELIUS_API_KEY` | strongly recommended | RPC `https://mainnet.helius-rpc.com/?api-key=…` |
| `RPC_URL` | if no Helius key | any mainnet RPC. Without either, the public RPC is used and rate-limits fast |
| `JUP_API_KEY` | recommended | uses `api.jup.ag` with `x-api-key`; without it `lite-api.jup.ag`, which 429s under load |
| `FEE_WALLET` | optional | turns the fee on |
| `FEE_BPS` | optional | default 50, capped at 1000 |
| `PRIORITY_MICROLAMPORTS` | optional | default 100000 |
| `PUBLIC_ORIGIN` | optional | e.g. `https://beacon.xyz`. Forces absolute hrefs; otherwise taken from the Host header |

## Test (needs internet: run where Solana RPC, Jupiter and stonkfun.xyz are reachable)

```
cd beacon && npm i @raydium-io/raydium-sdk-v2@0.2.79-alpha @solana/spl-token@0.4.15 @solana/web3.js@1.99.0 bn.js@5.2.5
(cd site && npm i)
RPC_URL=https://solana-rpc.publicnode.com node backend-test/xcheck-curve.mjs
RPC_URL=https://solana-rpc.publicnode.com node backend-test/run.mjs <funded wallet pubkey>
```
