import type { IncomingMessage, ServerResponse } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createProvider } from "./providers";
import { transcribe, type ReadInput } from "../src/core/provider";
type Request = IncomingMessage & { body?: unknown };
const MAX_BODY = 3_600_000;
export function validateInput(raw: unknown): ReadInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("input");
  const v = raw as Record<string, unknown>;
  if (
    typeof v.problem !== "string" ||
    !v.problem.trim() ||
    v.problem.length > 240 ||
    typeof v.words !== "string" ||
    v.words.length > 1000
  )
    throw new Error("fields");
  const hasImage =
    typeof v.image === "string" &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(v.image) &&
    v.image.length <= 3_500_000;
  const hasText =
    typeof v.text === "string" &&
    v.text.trim().length > 0 &&
    v.text.length <= 5000;
  if (
    hasImage === hasText ||
    (v.image !== undefined && !hasImage) ||
    (v.text !== undefined && !hasText)
  )
    throw new Error("source");
  if (
    v.sampleId !== undefined &&
    (typeof v.sampleId !== "string" || !/^s[1-5]$/.test(v.sampleId))
  )
    throw new Error("sample");
  return {
    problem: v.problem,
    words: v.words,
    ...(hasImage ? { image: v.image as string } : { text: v.text as string }),
    ...(v.sampleId ? { sampleId: v.sampleId as string } : {}),
  };
}
export function rateTicket(
  cookie: string | undefined,
  secret: string,
  max: number,
  now = Date.now(),
) {
  const window = Math.floor(now / 60000),
    token = cookie?.match(/(?:^|;\s*)branch_rate=([^;]+)/)?.[1];
  let count = 0;
  if (token && token.length < 180) {
    const [w, c, sig] = token.split("."),
      expected = createHmac("sha256", secret).update(`${w}.${c}`).digest("hex");
    if (
      sig &&
      /^[a-f0-9]{64}$/.test(sig) &&
      timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) &&
      Number(w) === window &&
      /^\d+$/.test(c)
    )
      count = Number(c);
  }
  const allowed = count < max,
    value = `${window}.${allowed ? count + 1 : count}`,
    sig = createHmac("sha256", secret).update(value).digest("hex");
  return {
    allowed,
    cookie: `branch_rate=${value}.${sig}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=60`,
    retryAfter: 60 - (Math.floor(now / 1000) % 60),
  };
}
// Retain only short-lived hashed connection counters, never images, answers, or raw IPs.
const windows = new Map<string, { window: number; count: number }>();
export function ipTicket(key: string, max: number, now = Date.now()): boolean {
  const window = Math.floor(now / 600000);
  for (const [k, v] of windows) if (v.window !== window) windows.delete(k);
  const old = windows.get(key);
  if (!old && windows.size >= 5000) return false;
  const count = (old?.count || 0) + 1;
  windows.set(key, { window, count });
  return count <= max;
}
async function readBody(req: Request) {
  if (req.body !== undefined) {
    const s =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(s) > MAX_BODY) throw new Error("size");
    return JSON.parse(s);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > MAX_BODY) throw new Error("size");
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function handler(req: Request, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const reply = (status: number, data: unknown) => {
    res.statusCode = status;
    res.end(JSON.stringify(data));
  };
  const real = Boolean(
    process.env.AI_PROVIDER && process.env.AI_PROVIDER !== "mock",
  );
  if (req.method === "GET")
    return reply(200, { mode: real ? "live" : "mock", maxCalls: 2 });
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return reply(405, { error: "POST で送信してください。" });
  }
  if (req.headers.origin) {
    try {
      if (new URL(req.headers.origin).host !== req.headers.host)
        return reply(403, { error: "このサイトから送信してください。" });
    } catch {
      return reply(403, { error: "送信元が不正です。" });
    }
  }
  if (!req.headers["content-type"]?.startsWith("application/json"))
    return reply(415, { error: "JSON で送信してください。" });
  const secret = process.env.RATE_LIMIT_SECRET;
  if (real && (!secret || secret.length < 32))
    return reply(503, {
      error: "サーバーの回数制限の設定が必要です。手入力はそのまま使えます。",
    });
  const max = Math.min(
    30,
    Math.max(1, Number(process.env.RATE_LIMIT_MAX) || 8),
  );
  const rate = rateTicket(req.headers.cookie, secret || "mock-free-local", max);
  res.setHeader(
    "Set-Cookie",
    rate.cookie + (process.env.VERCEL ? "; Secure" : ""),
  );
  const ip = String(
    req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown",
  )
    .split(",")[0]
    .trim();
  const key = createHmac("sha256", secret || "mock-free-local")
    .update(ip)
    .digest("hex");
  if (
    !rate.allowed ||
    (real && !ipTicket(key, Math.max(1, Number(process.env.IP_RATE_MAX) || 60)))
  ) {
    res.setHeader("Retry-After", real ? 600 : rate.retryAfter);
    return reply(429, {
      error:
        "読み取り回数の上限です。手入力で続けるか、しばらく待ってください。",
    });
  }
  let input: ReadInput;
  try {
    input = validateInput(await readBody(req));
  } catch {
    return reply(400, {
      error: "問題・途中式・画像の形式や大きさを確認してください。",
    });
  }
  try {
    return reply(200, await transcribe(input, createProvider()));
  } catch {
    return reply(503, {
      error: "AI の設定を確認できません。途中式を手入力して続けてください。",
    });
  }
}
