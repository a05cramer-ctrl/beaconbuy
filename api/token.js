// Compact coin JSON for the frontend. GET ?mint=
import { send, getQuery, HttpError } from "../lib/http.js";
import { getToken, isMint } from "../lib/stonkfun.js";
import { connection } from "../lib/rpc.js";
import { loadPool } from "../lib/launchlab.js";
import { routeOf } from "../lib/buy.js";

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") return send(res, 200, {});
    if (req.method !== "GET") throw new HttpError(405, "Method not allowed");
    const mint = String(getQuery(req).mint || "").trim();
    if (!isMint(mint)) throw new HttpError(400, "Invalid mint address");
    const t = await getToken(mint);
    if (!t) throw new HttpError(404, "Unknown mint: not a StonkFun coin");
    let route = t.graduated ? "jupiter" : null;
    let poolStatus = null;
    try {
      const ctx = await loadPool(connection(), mint, t.quote.mint);
      route = routeOf(ctx);
      poolStatus = ctx ? ctx.status : null;
    } catch {
      route = route || (t.quote.mint === "So11111111111111111111111111111111111111112" ? "curve-sol" : "curve-swap");
    }
    return send(res, 200, {
      mint: t.mint, name: t.name, sym: t.sym, img: t.img, quote: t.quote,
      mcap: t.mcap, vol24: t.vol24, price: t.price, change24: t.change24,
      status: t.status, graduated: t.graduated, mode: t.mode, createdAt: t.createdAt, pool: t.pool,
      route, poolStatus,
    }, { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (!(e instanceof HttpError)) console.error("[token]", e);
    return send(res, status, { message: e instanceof HttpError ? e.message : "Internal error" });
  }
}
