// Solana Actions endpoint: GET = blink metadata, POST = unsigned buy transaction.
import { send, getQuery, getBody, origin, HttpError } from "../../lib/http.js";
import { getToken, isMint, fmtUsd } from "../../lib/stonkfun.js";
import { buildBuyTx, DEFAULT_SLIP_BPS } from "../../lib/buy.js";

const PRESETS = ["0.1", "0.5", "1"];

function fail(res, e) {
  const status = e instanceof HttpError ? e.status : 500;
  if (!(e instanceof HttpError)) console.error("[buy]", e);
  send(res, status >= 400 && status < 600 ? status : 500, { message: e instanceof HttpError ? e.message : "Internal error building the transaction" });
}

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") return send(res, 200, {});
    const q = getQuery(req);
    const mint = String(q.mint || "").trim();
    if (!isMint(mint)) throw new HttpError(400, "Invalid mint address");
    const slip = q.slip !== undefined ? String(q.slip) : undefined;

    if (req.method === "GET") {
      const t = await getToken(mint);
      if (!t) throw new HttpError(400, "Unknown mint: not a StonkFun coin");
      const base = `${origin(req)}/api/actions/buy?mint=${mint}${slip ? `&slip=${encodeURIComponent(slip)}` : ""}`;
      const icon = t.img && t.img.startsWith("https://") ? t.img : `${origin(req)}/favicon.png`;
      return send(res, 200, {
        type: "action",
        icon,
        title: `$${t.sym} · ${t.name}`,
        description: `Market cap ${fmtUsd(t.mcap)} · paired with ${t.quote.sym || "SOL"} · bought through BEACON`,
        label: "Buy",
        links: {
          actions: [
            ...PRESETS.map((a) => ({ type: "transaction", label: `${a} SOL`, href: `${base}&amount=${a}` })),
            {
              type: "transaction",
              label: "Buy",
              href: `${base}&amount={amount}`,
              parameters: [{ name: "amount", label: "SOL amount", type: "number", required: true, min: 0.001 }],
            },
          ],
        },
      }, { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" });
    }

    if (req.method === "POST") {
      const body = await getBody(req);
      const account = body?.account;
      if (!account || typeof account !== "string") throw new HttpError(400, "Missing account");
      const amount = q.amount ?? body?.data?.amount; // spec 2.x may also send params in body.data
      if (amount === undefined || amount === "") throw new HttpError(400, "Missing amount");
      const r = await buildBuyTx({ mint, account, amount, slipBps: slip ?? DEFAULT_SLIP_BPS });
      return send(res, 200, {
        type: "transaction",
        transaction: r.base64,
        message: `Buying $${r.token.sym} with ${Number(amount)} SOL`,
      }, { "Cache-Control": "no-store" });
    }

    throw new HttpError(405, "Method not allowed");
  } catch (e) {
    return fail(res, e);
  }
}
