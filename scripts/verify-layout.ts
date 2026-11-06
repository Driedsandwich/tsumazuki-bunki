import { chromium, expect } from "@playwright/test";
import { samples } from "../src/core/samples";
const browser = await chromium.launch();
let checks = 0;
const issues: string[] = [];
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.on("pageerror", (e) => issues.push(e.message));
    await page.goto(process.env.APP_URL || "http://127.0.0.1:5173");
    async function check() {
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      // Every visible button and text field preserves the requested tap height.
      const small = await page
        .locator('button,input:not([type="checkbox"]),textarea,summary')
        .evaluateAll((nodes) =>
          nodes
            .filter(
              (el) =>
                el.getClientRects().length &&
                el.getBoundingClientRect().height < 44,
            )
            .map((el) => el.outerHTML),
        );
      expect(small).toEqual([]);
      checks++;
    }
    await check();
    for (const sample of samples) {
      await page
        .getByRole("button", { name: new RegExp(sample.title) })
        .click();
      await check();
      await page.getByRole("checkbox").check();
      await page
        .getByRole("button", { name: "原因の候補を見る →" })
        .click();
      await check();
      if (
        await page
          .getByRole("button", { name: "見本の答えを入れる" })
          .count()
      ) {
        await page
          .getByRole("button", { name: "見本の答えを入れる" })
          .click();
        await page
          .getByRole("button", { name: "この答えで候補を絞る →" })
          .click();
        await check();
      }
      await page.getByRole("button", { name: "最初に戻る" }).click();
    }
    // Long but valid expressions should wrap between terms rather than overflow.
    await page
      .getByLabel("問題の式", { exact: true })
      .fill("2x+3x+4x+5x+6x+7x+8x+9x+10x+11x+12x+13x=200");
    await page
      .getByLabel("生徒の途中式")
      .fill("2x+3x+4x+5x+6x+7x+8x+9x+10x+11x+12x+13x=201");
    await page.getByRole("button", { name: "途中式を確認する →" }).click();
    await check();
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "原因の候補を見る →" })
      .click();
    await check();
    await page.close();
  }
  expect(issues).toEqual([]);
  console.log(
    JSON.stringify({
      checks,
      passed: checks,
      viewports: [390, 1280],
      minControlHeight: 44,
      browserErrors: issues,
    }),
  );
} finally {
  await browser.close();
}
