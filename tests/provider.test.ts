import { describe, it, expect, vi, afterEach } from "vitest";
import { createServer } from "node:http";
import { handler, validateInput, rateTicket, ipTicket } from "../server/http";
import { createProvider } from "../server/providers";
import {
  transcribe,
  validateTranscript,
  type Provider,
} from "../src/core/provider";
const input = { problem: "3x+4=19", words: "移項したから", text: "3x=23" };
const valid = {
  lines: [{ expression: "3x=23", unreadable: false, confidence: 0.9 }],
  hints: [{ ruleId: "move-sign", quote: "移項した" }],
};
afterEach(() => {
  vi.unstubAllEnvs();
});
describe("transcription boundary", () => {
  it("requires exact quotes, known rule IDs and bounded fields", () => {
    expect(validateTranscript(valid, input.words).lines).toHaveLength(1);
    for (const bad of [
      null,
      [],
      {},
      { ...valid, lines: [] },
      {
        ...valid,
        lines: [{ expression: "x=1", unreadable: "no", confidence: 1 }],
      },
      {
        ...valid,
        lines: [{ expression: "x=1", unreadable: false, confidence: NaN }],
      },
      {
        ...valid,
        lines: [{ expression: "x=1", unreadable: false, confidence: 1.1 }],
      },
      { ...valid, hints: [{ ruleId: "move-sign", quote: "架空" }] },
      { ...valid, hints: [{ ruleId: "invented", quote: "移項" }] },
    ])
      expect(() => validateTranscript(bad, input.words)).toThrow();
  });
  it("retries malformed output exactly once then falls back to manual entry", async () => {
    const read = vi.fn().mockResolvedValue({ bad: true });
    const result = await transcribe(input, { name: "live", read });
    expect(read).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ calls: 2, manual: true, transcript: null });
  });
  it("recovers on the one permitted retry", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(valid);
    const result = await transcribe(input, { name: "live", read });
    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls[1][1]).toBe(true);
    expect(result).toMatchObject({ calls: 2, manual: false });
  });
  it("does not retry network failures", async () => {
    const read = vi.fn().mockRejectedValue(new Error("network"));
    expect((await transcribe(input, { name: "live", read })).manual).toBe(true);
    expect(read).toHaveBeenCalledTimes(1);
  });
  it("does not replace arbitrary photos with sample answers", async () => {
    const p = createProvider({});
    expect(
      (
        await transcribe(
          { ...input, text: undefined, image: "data:image/png;base64,AAAA" },
          p,
        )
      ).manual,
    ).toBe(true);
    const s = await transcribe(
      {
        ...input,
        text: undefined,
        image: "data:image/png;base64,AAAA",
        sampleId: "s2",
      },
      p,
    );
    expect(s).toMatchObject({ mode: "mock", calls: 0, manual: false });
    expect(s.transcript?.lines[0].expression).toBe("-x+3=5");
  });
  it("passes arbitrary mock text through without assigning causes", async () => {
    const r = await transcribe(
      { ...input, text: "7x-4=17\nx=3" },
      createProvider({}),
    );
    expect(r.transcript?.lines.map((l) => l.expression)).toEqual([
      "7x-4=17",
      "x=3",
    ]);
    expect(r.transcript?.hints).toEqual([]);
  });
  it("sends an image data URL through the OpenAI-compatible provider", async () => {
    const send = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(valid) } }],
          }),
        ),
      );
    const p = createProvider(
      {
        AI_PROVIDER: "openai",
        AI_API_KEY: "test-placeholder",
        AI_MODEL: "vision-test",
        AI_BASE_URL: "https://example.test/v1",
      },
      send,
    );
    const r = await transcribe(
      { ...input, text: undefined, image: "data:image/png;base64,AAAA" },
      p,
    );
    expect(r.manual).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
    const [url, init] = send.mock.calls[0];
    expect(url).toBe("https://example.test/v1/chat/completions");
    const body = JSON.parse(init.body);
    expect(body.messages[1].content[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/png;base64,AAAA" },
    });
    expect(body.model).toBe("vision-test");
  });
  it("treats invalid JSON as format failure and caps actual HTTP calls", async () => {
    const send = vi.fn().mockResolvedValue(new Response(""));
    send.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: "not json" } }] }),
        ),
    );
    const p = createProvider(
      {
        AI_PROVIDER: "openai",
        AI_API_KEY: "test-placeholder",
        AI_MODEL: "test",
      },
      send,
    );
    expect((await transcribe(input, p)).calls).toBe(2);
    expect(send).toHaveBeenCalledTimes(2);
  });
  it("does not retry provider HTTP errors or expose their body", async () => {
    const send = vi
      .fn()
      .mockResolvedValue(new Response("sensitive input", { status: 500 }));
    const r = await transcribe(
      input,
      createProvider(
        {
          AI_PROVIDER: "openai",
          AI_API_KEY: "test-placeholder",
          AI_MODEL: "test",
        },
        send,
      ),
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(r)).not.toContain("sensitive");
    expect(r.manual).toBe(true);
  });
  it("rejects missing config and insecure endpoint", () => {
    expect(() => createProvider({ AI_PROVIDER: "openai" })).toThrow();
    expect(() =>
      createProvider({
        AI_PROVIDER: "openai",
        AI_API_KEY: "test-placeholder",
        AI_MODEL: "test",
        AI_BASE_URL: "http://example.test",
      }),
    ).toThrow();
  });
});
describe("request boundary and rate limits", () => {
  it("accepts one source only and validates sizes", () => {
    expect(validateInput(input)).toEqual(input);
    for (const bad of [
      { ...input, image: "data:image/png;base64,AAAA" },
      { ...input, text: "" },
      { ...input, text: "x".repeat(5001) },
      { ...input, problem: "x".repeat(241) },
      { ...input, words: 2 },
      { ...input, text: undefined, image: "https://example.test/image.png" },
    ])
      expect(() => validateInput(bad)).toThrow();
  });
  it("counts signed cookies and resets in the next minute", () => {
    const a = rateTicket(undefined, "test", 1, 120000),
      b = rateTicket(a.cookie, "test", 1, 120001);
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(false);
    expect(rateTicket(a.cookie, "test", 1, 180001).allowed).toBe(true);
    expect(rateTicket(a.cookie, "other", 1, 120001).allowed).toBe(true);
  });
  it("limits hashed IP counters and resets expired windows", () => {
    expect(ipTicket("test-key", 1, 0)).toBe(true);
    expect(ipTicket("test-key", 1, 1)).toBe(false);
    expect(ipTicket("test-key", 1, 600000)).toBe(true);
  });
  it("serves health, mock transcript and safe HTTP errors", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    const server = createServer((req, res) => {
      void handler(req, res);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address() as { port: number },
      url = `http://127.0.0.1:${address.port}`;
    try {
      expect(await (await fetch(url)).json()).toMatchObject({
        mode: "mock",
        maxCalls: 2,
      });
      expect((await fetch(url, { method: "DELETE" })).status).toBe(405);
      expect((await fetch(url, { method: "POST", body: "hello" })).status).toBe(
        415,
      );
      expect(
        (
          await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Origin: "https://other.test",
            },
            body: JSON.stringify(input),
          })
        ).status,
      ).toBe(403);
      const post = (data: unknown) =>
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      const ok = await post(input);
      expect(ok.headers.get("cache-control")).toBe("no-store");
      expect(await ok.json()).toMatchObject({
        mode: "mock",
        calls: 0,
        manual: false,
      });
      expect((await post({})).status).toBe(400);
      expect(
        (await post({ ...input, text: "x".repeat(3_600_001) })).status,
      ).toBe(400);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
    }
  });
});
