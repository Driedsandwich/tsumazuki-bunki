import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const output = process.env.ARTIFACT_DIR || "verification/a1";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const checks: {
  viewport: number;
  screen: string;
  width: number;
  passed: boolean;
}[] = [];
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: width === 390 ? 844 : 900 },
      deviceScaleFactor: 1,
    });
    await page.goto(process.env.APP_URL || "http://127.0.0.1:5173");
    async function capture(screen: string) {
      await page.evaluate(() => document.fonts.ready);
      const actual = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(actual).toBeLessThanOrEqual(width);
      checks.push({ viewport: width, screen, width: actual, passed: true });
      await page.screenshot({
        path: `${output}/${width}-${screen}.png`,
        fullPage: true,
      });
    }
    await capture("home");
    await page.getByRole("button", { name: /同じ誤答、違う原因/ }).click();
    await capture("review");
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "原因の候補を見る →" })
      .click();
    await capture("branch");
    await page
      .getByRole("button", { name: "見本の答えを入れる" })
      .click();
    await page.getByRole("button", { name: "この答えで候補を絞る →" }).click();
    await expect(
      page.getByRole("heading", { name: "指導のまとめ", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture("result");
    await page.close();
  }
  writeFileSync(
    `${output}/layout-results.json`,
    JSON.stringify({ checks: checks.length, results: checks }, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
