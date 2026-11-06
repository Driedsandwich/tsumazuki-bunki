import { createServer } from "node:http";
import assert from "node:assert/strict";
import handler from "../api/analyze.js";
process.env.AI_PROVIDER = "mock";
const server = createServer((req, res) => void handler(req, res));
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const url = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(url);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).mode, "mock");
  const result = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      problem: "9x+7=43",
      text: "9x=50\nx=50/9",
      words: "",
    }),
  });
  assert.equal(result.status, 200);
  const payload = await result.json();
  assert.equal(payload.transcript.lines[0].expression, "9x=50");
  assert.equal(payload.calls, 0);
  assert.equal(result.headers.get("cache-control"), "no-store");
  console.log(
    "Bundled Node ESM function: health + fresh mock transcription + no-store PASS",
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}
