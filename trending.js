// Top StonkFun coins by 24h volume (max 24). GET
import { send, HttpError } from "../lib/http.js";
import { getTrending } from "../lib/stonkfun.js";

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") return send(res, 200, {});
    if (req.method !== "GET") throw new HttpError(405, "Method not allowed");
    const rows = (await getTrending(24)).slice(0, 24).map((t) => ({
      mint: t.mint, name: t.name, sym: t.sym, img: t.img, quote: t.quote,
      mcap: t.mcap, vol24: t.vol24, change24: t.change24, status: t.status,
    }));
    return send(res, 200, rows, { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return send(res, status, { message: e instanceof HttpError ? e.message : "Internal error" });
  }
}
