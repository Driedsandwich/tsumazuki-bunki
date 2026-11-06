import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { samples } from "../src/core/samples";
import { getRule } from "../src/core/rules";
import { practice } from "../src/core/practice";
const base = process.env.APP_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({ headless: true });
const results: { name: string; passed: boolean }[] = [];
const errors: string[] = [];
mkdirSync("verification", { recursive: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
page.on("pageerror", (e) => errors.push(e.message));
async function checkWidth() {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
async function confirm() {
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "原因の候補を見る →" }).click();
}
try {
  await page.goto(base);
  await expect(
    page.getByRole("heading", { name: "その誤答、 どこでつまずいた？" }),
  ).toBeVisible();
  await checkWidth();
  await page.screenshot({
    path: "verification/mobile-home.png",
    fullPage: true,
  });
  for (const sample of samples) {
    await page.getByRole("button", { name: new RegExp(sample.title) }).click();
    await expect(page.locator(".answer-image")).toBeVisible();
    expect(
      await page
        .locator(".answer-image")
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "原因の候補を見る →" }),
    ).toBeDisabled();
    if (sample.id === "s2")
      await page.screenshot({
        path: "verification/mobile-review.png",
        fullPage: true,
      });
    await confirm();
    if (
      await page.getByRole("button", { name: "見本の答えを入れる" }).count()
    ) {
      await checkWidth();
      await page.screenshot({
        path: "verification/mobile-branch.png",
        fullPage: true,
      });
      await page.getByRole("button", { name: "見本の答えを入れる" }).click();
      await page
        .getByRole("button", { name: "この答えで候補を絞る →" })
        .click();
    }
    await expect(
      page.getByRole("heading", {
        name: getRule(sample.expected).name,
        exact: true,
      }),
    ).toBeVisible();
    const questions = practice(sample.expected);
    for (let i = 0; i < 3; i++) {
      await page.locator(`#practice-${i}`).fill(questions[i].answer);
      await page
        .locator(".practice")
        .nth(i)
        .getByRole("button", { name: "確かめる", exact: true })
        .click();
    }
    await expect(page.getByText("3 問とも一致しました。")).toBeVisible();
    await checkWidth();
    if (sample.id === "s2")
      await page.screenshot({
        path: "verification/mobile-result.png",
        fullPage: true,
      });
    results.push({
      name: `${sample.id}: sample → review → diagnosis → practice completion`,
      passed: true,
    });
    await page.getByRole("button", { name: "最初に戻る" }).click();
  }
  // Entirely new input, never present in the sample list.
  await page.getByLabel("問題の式", { exact: true }).fill("7x+5=26");
  await page.getByLabel("生徒の途中式").fill("7x=31\nx=31/7");
  await page.getByRole("button", { name: "途中式を確認する →" }).click();
  await confirm();
  await expect(
    page.getByRole("heading", {
      name: "移項しても符号がそのまま",
      exact: true,
    }),
  ).toBeVisible();
  results.push({ name: "fresh typed equation", passed: true });
  await page.getByRole("button", { name: "最初に戻る" }).click();
  await page.getByLabel("問題の式", { exact: true }).fill("2x=10");
  await page.getByLabel("生徒の途中式").fill("x=123");
  await page.getByRole("button", { name: "途中式を確認する →" }).click();
  await confirm();
  await expect(
    page.getByRole("heading", { name: "特定できない", exact: true }),
  ).toBeVisible();
  expect(await page.locator(".practice").count()).toBe(0);
  results.push({ name: "unknown gives no invented cause", passed: true });
  await page.getByRole("button", { name: "途中式を直す" }).click();
  await page.locator("#line-0").fill("x=5");
  await confirm();
  await expect(
    page.getByRole("heading", { name: "途中式の答えは変わっていません" }),
  ).toBeVisible();
  results.push({ name: "manual correction recomputes outcome", passed: true });
  await page.getByRole("button", { name: "最初に戻る" }).click();
  await page.getByLabel("問題の式", { exact: true }).fill("0.5x+1=3");
  await page.getByLabel("生徒の途中式").fill("x=?");
  await page.getByRole("button", { name: "途中式を確認する →" }).click();
  await page.getByRole("checkbox").check();
  await expect(
    page.getByRole("button", { name: "原因の候補を見る →" }),
  ).toBeDisabled();
  await page.locator("#line-0").fill("x=4");
  await confirm();
  await expect(
    page.getByRole("heading", { name: "途中式の答えは変わっていません" }),
  ).toBeVisible();
  results.push({
    name: "unreadable line requires correction; decimals exact",
    passed: true,
  });
  await page.getByRole("button", { name: "最初に戻る" }).click();
  // Mock refuses new image rather than returning a fabricated transcription.
  await page.getByLabel("問題の式", { exact: true }).fill("2x=10");
  await page.locator("#photo").setInputFiles({
    name: "new-answer.png",
    mimeType: "image/png",
    buffer: await page.screenshot(),
  });
  await expect(page.locator(".answer-image")).toBeVisible();
  await page.getByRole("button", { name: "途中式を確認する →" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "現在は新しい写真を読み取れません",
  );
  results.push({
    name: "arbitrary photo in mock explicitly refuses OCR",
    passed: true,
  });
  await page.reload();
  await expect(page.getByLabel("問題の式", { exact: true })).toHaveValue("");
  expect(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
  ).toBe(0);
  results.push({
    name: "reload clears student data; no browser persistent storage",
    passed: true,
  });
  await page.setViewportSize({ width: 320, height: 740 });
  await checkWidth();
  await page.screenshot({
    path: "verification/mobile-320.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await checkWidth();
  await page.screenshot({
    path: "verification/desktop-home.png",
    fullPage: true,
  });
  results.push({
    name: "320 / 390 / 1280 px layouts do not overflow",
    passed: true,
  });
  // Simulate a LIVE response to verify correction, hints, retry ownership, and fallback UX.
  let posts = 0;
  await page.route("**/api/analyze", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { mode: "live", maxCalls: 2 } });
    posts++;
    return route.fulfill({
      json: {
        mode: "live",
        calls: 2,
        manual: false,
        message: "形式修正後の書き起こしです。",
        transcript: {
          lines: [{ expression: "3x=?", unreadable: true, confidence: 0.3 }],
          hints: [],
        },
      },
    });
  });
  await page.reload();
  await expect(
    page.getByText("写真・生徒の言葉を AI で読み取り可能", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("問題の式", { exact: true }).fill("3x+4=19");
  await page.getByLabel("生徒の途中式").fill("3x=23");
  await page.getByLabel("生徒の言葉").fill("移項しました");
  await page
    .getByRole("button", { name: "AI で読む（数秒かかります）" })
    .click();
  await expect(page.getByText(/要確認/)).toBeVisible();
  await page.locator("#line-0").fill("3x=23");
  await confirm();
  await expect(
    page.getByRole("heading", {
      name: "移項しても符号がそのまま",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "途中式を直す" }).click();
  await page.getByRole("button", { name: "← 入力へ戻る" }).click();
  await page.getByRole("button", { name: "途中式を確認する →" }).click();
  expect(posts).toBe(1);
  results.push({
    name: "live response stub: low-confidence correction and no client retry",
    passed: true,
  });
  await page.unroute("**/api/analyze");
  await page.route("**/api/analyze", async (route) =>
    route.fulfill({
      json:
        route.request().method() === "GET"
          ? { mode: "live" }
          : {
              mode: "live",
              calls: 2,
              manual: true,
              transcript: null,
              message:
                "書き起こしの形式を確認できませんでした。途中式を手入力して続けてください。",
            },
    }),
  );
  await page.reload();
  await expect(
    page.getByText("写真・生徒の言葉を AI で読み取り可能", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("問題の式", { exact: true }).fill("-4x=20");
  await page.getByLabel("生徒の途中式").fill("x=5");
  await page.getByLabel("生徒の言葉").fill("4で割った");
  await page
    .getByRole("button", { name: "AI で読む（数秒かかります）" })
    .click();
  await expect(page.getByRole("alert")).toContainText("手入力");
  await page.getByRole("button", { name: "途中式を確認する →" }).click();
  await confirm();
  await expect(
    page.getByRole("heading", {
      name: "割る係数のマイナスを落とす",
      exact: true,
    }),
  ).toBeVisible();
  results.push({
    name: "live response stub: failure falls back through to conclusion",
    passed: true,
  });
  expect(errors).toEqual([]);
  writeFileSync(
    "verification/ui-results.json",
    JSON.stringify(
      {
        base,
        checks: results.length,
        results,
        browserErrors: errors,
        realProviderTested: false,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      checks: results.length,
      passed: results.length,
      browserErrors: errors,
    }),
  );
} finally {
  await browser.close();
}
