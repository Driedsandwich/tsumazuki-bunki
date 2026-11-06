import { chromium, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.env.APP_URL || "http://127.0.0.1:5173";
const out = process.env.ARTIFACT_DIR || "verification/onboarding";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const results: string[] = [];
const errors: string[] = [];
const externalRequests: string[] = [];
const cost =
  "このページを使っても、あなたにお金はかかりません（AI の代金は作者が持ちます）。見本は AI を呼びません。";
async function stage(page: Page, value: number) {
  await expect(page.locator('.steps [aria-current="step"] b')).toHaveText(
    String(value),
  );
  await expect(page.locator(".journey-current")).toHaveText(
    `いま ${value} / 3`,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function capture(page: Page, width: number, screen: string) {
  // Scroll through actual content so entrance effects have run before the full-page capture.
  for (const target of await page
    .locator(".ink-reveal, .answer-sheet, .conclusion, .return-unit")
    .all()) {
    await target.scrollIntoViewIfNeeded();
  }
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `${out}/${width}-${screen}.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.evaluate(() => scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.screenshot({
    path: `${out}/${width}-${screen}-viewport.png`,
    animations: "disabled",
  });
}
try {
  for (const width of [390, 1280]) {
    for (const mode of ["mock", "live"]) {
      const page = await browser.newPage({
        viewport: { width, height: width === 390 ? 844 : 900 },
      });
      const label = `${width}px / ${mode}`;
      let posts = 0;
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", async (route) => {
        const request = route.request();
        if (new URL(request.url()).origin !== new URL(base).origin) {
          externalRequests.push(request.url());
          return route.abort();
        }
        if (new URL(request.url()).pathname === "/api/analyze") {
          if (request.method() === "POST") {
            posts++;
            return route.fulfill({
              json: {
                calls: 1,
                mode: "live",
                manual: false,
                message: "読み取った途中式を確認してください。",
                transcript: {
                  lines: [
                    { expression: "x=5", unreadable: false, confidence: 1 },
                  ],
                  hints: [],
                },
              },
            });
          }
          return route.fulfill({ json: { mode } });
        }
        return route.continue();
      });
      await page.goto(base);
      await expect(page.locator(".mode")).toContainText(
        mode === "live" ? "AI" : "見本・手入力",
      );
      await stage(page, 1);
      await expect(
        page.getByRole("button", { name: "見本で試す", exact: true }),
      ).toBeInViewport();
      await expect(page.locator(".intro .cost-notice")).toContainText(cost);
      await expect(page.locator(".intro .cost-notice")).toBeInViewport();
      await expect(page.locator(".intro .cost-notice")).toContainText(
        "入力する欄もありません",
      );
      await expect(page.locator(".steps li")).toHaveCount(3);
      results.push(
        `${label}: first viewport has sample CTA, cost notice and three-stage guide`,
      );
      if (mode === "mock") await capture(page, width, "01-home");
      await page
        .getByRole("button", { name: "見本で試す", exact: true })
        .click();
      await stage(page, 1);
      await expect(
        page.getByRole("button", { name: "原因の候補を見る →" }),
      ).toBeDisabled();
      await expect(page.locator(".review-page > .notice")).toContainText(
        "チェック",
      );
      results.push(
        `${label}: review stays in stage 1 and explains the required checkbox`,
      );
      if (mode === "mock") await capture(page, width, "01-review");
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "原因の候補を見る →" }).click();
      await stage(page, 2);
      await page.getByRole("button", { name: "見分ける一問へ ↓" }).click();
      await expect(page.locator("#probe-heading")).toBeFocused();
      await expect(page.locator("#probe-heading")).toBeInViewport();
      results.push(`${label}: stage 2 has a working jump to the next question`);
      if (mode === "mock") await capture(page, width, "02-branch");
      await page
        .getByRole("button", { name: "見本の答えを入れる", exact: true })
        .click();
      await page
        .getByRole("button", { name: "この答えで候補を絞る →" })
        .click();
      await stage(page, 3);
      await expect(page.locator(".conclusion")).toContainText(
        "かっこの後ろでマイナスを落とす",
      );
      await expect(page.locator(".return-unit")).toContainText("戻る単元");
      expect(posts).toBe(0);
      results.push(
        `${label}: sample reaches conclusion and return unit with zero AI POSTs`,
      );
      await page.getByRole("button", { name: "結論と戻る単元へ ↓" }).click();
      await expect(page.locator("#conclusion-heading")).toBeFocused();
      await expect(page.locator("#conclusion-heading")).toBeInViewport();
      results.push(`${label}: final screen links directly to the conclusion`);
      if (mode === "mock") await capture(page, width, "03-result");
      await page
        .getByRole("button", { name: "最初に戻る", exact: true })
        .click();
      await stage(page, 1);
      await expect(
        page.getByRole("button", { name: "見本で試す", exact: true }),
      ).toBeInViewport();
      results.push(`${label}: restart returns to the initial viewport`);
      await page
        .getByRole("button", { name: "見本で試す", exact: true })
        .click();
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "原因の候補を見る →" }).click();
      await page
        .getByRole("button", { name: "見本の答えを入れる", exact: true })
        .click();
      await page
        .getByRole("button", { name: "この答えで候補を絞る →" })
        .click();
      await page
        .getByRole("button", { name: "自分の入力で試す", exact: true })
        .click();
      await stage(page, 1);
      await expect(page.locator("#problem")).toBeFocused();
      await expect(page.locator("#problem")).toBeInViewport();
      await expect(page.locator("#problem")).toHaveValue("");
      await expect(page.locator("#work")).toHaveValue("");
      results.push(
        `${label}: own-input action clears sample and focuses the visible input`,
      );
      await page.locator("#problem").fill("-4x=20");
      await page.locator("#work").fill("x=5");
      await page.getByRole("button", { name: "途中式を確認する →" }).click();
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "原因の候補を見る →" }).click();
      await stage(page, 3);
      await expect(page.locator(".conclusion")).toContainText(
        "割る係数のマイナスを落とす",
      );
      expect(posts).toBe(0);
      results.push(`${label}: own typed input reaches conclusion without AI`);
      if (mode === "live") {
        await page
          .getByRole("button", { name: "自分の入力で試す", exact: true })
          .click();
        await page.locator("#problem").fill("-4x=20");
        await page.locator("#work").fill("x=5");
        await page.locator("#words").fill("4で割った");
        const ai = page.getByRole("button", {
          name: "AI で読む（数秒かかります）",
          exact: true,
        });
        await expect(ai).toBeEnabled();
        await expect(page.locator(".new-answer .cost-notice")).toContainText(
          cost,
        );
        const gap = await ai.evaluate(
          (el) =>
            el.getBoundingClientRect().top -
            document
              .querySelector(".new-answer .cost-notice")!
              .getBoundingClientRect().bottom,
        );
        expect(gap).toBeLessThan(200);
        await ai.click();
        await expect(
          page.getByRole("heading", { name: "入れた答案を確認", exact: true }),
        ).toBeVisible();
        expect(posts).toBe(1);
        results.push(
          `${label}: AI action clearly labeled beside cost notice; one local stub request`,
        );
        await page.getByRole("button", { name: "← 入力へ戻る" }).click();
        await page.getByRole("button", { name: "途中式を確認する →" }).click();
        expect(posts).toBe(1);
        results.push(
          `${label}: spent read returns to manual input without another AI request`,
        );
      }
      await page.close();
    }
  }
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
  const result = {
    checks: results.length,
    passed: results.length,
    results,
    browserErrors: errors,
    externalRequests,
    realProviderTested: false,
    screenshots: 16,
  };
  writeFileSync(
    `${out}/onboarding-results.json`,
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
