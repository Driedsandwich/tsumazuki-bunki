import { chromium, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { practice } from "../src/core/practice";

const base = process.env.APP_URL || "http://127.0.0.1:5173";
const out = process.env.ARTIFACT_DIR || "verification/polish";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const checks: string[] = [];
const errors: string[] = [];
const externalRequests: string[] = [];
const frames: object[] = [];
async function start(page: Page) {
  await page.goto(base);
  await page.getByRole("button", { name: "見本で試す" }).click();
}
async function confirm(page: Page) {
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "原因の候補を見る →" })
    .click();
}
async function answer(page: Page, value?: string) {
  if (value !== undefined) await page.locator("#branch-answer").fill(value);
  else
    await page
      .getByRole("button", { name: "見本の答えを入れる" })
      .click();
  await page.getByRole("button", { name: "この答えで候補を絞る →" }).click();
}
async function widthCheck(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function snapshot(
  page: Page,
  selector: string,
  name: string,
  time: number,
) {
  const target = page.locator(selector);
  await target.scrollIntoViewIfNeeded();
  // Observe visibility first, then sample the real CSS animation timeline.
  if (
    selector === ".answer-sheet" ||
    selector === ".conclusion" ||
    selector === ".return-unit"
  )
    await expect(target).toHaveClass(/ink-entered/);
  if (selector === ".transcript-panel")
    await expect(target.locator(".review-line").first()).toHaveClass(
      /ink-entered/,
    );
  const animations = await target.evaluate(
    (el, time) =>
      el.getAnimations({ subtree: true }).map((animation) => {
        const timing = animation.effect!.getComputedTiming();
        animation.pause();
        animation.currentTime = Math.min(time, Number(timing.endTime));
        return {
          name: (animation as CSSAnimation).animationName,
          sampledMs: animation.currentTime,
          endMs: timing.endTime,
        };
      }),
    time,
  );
  await target.screenshot({ path: `${out}/${name}.png`, animations: "allow" });
  frames.push({
    file: `${name}.png`,
    selector,
    viewport: page.viewportSize(),
    timelineMs: time,
    animations,
  });
}
try {
  for (const width of [390, 1280]) {
    for (const reduced of [false, true]) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        reducedMotion: reduced ? "reduce" : "no-preference",
      });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (route) => {
        if (new URL(route.request().url()).origin !== new URL(base).origin) {
          externalRequests.push(route.request().url());
          return route.abort();
        }
        return route.continue();
      });
      const label = `${width}px / ${reduced ? "reduced" : "normal"}`;
      await start(page);
      expect(await page.locator(".broken-label, .conclusion").count()).toBe(0);
      await widthCheck(page);
      await confirm(page);
      await expect(page.locator(".is-broken")).toHaveCount(1);
      await expect(page.locator(".candidate-card")).toHaveCount(2);
      await widthCheck(page);
      checks.push(
        `${label}: review has no premature diagnosis; confirmed sheet marks one broken line`,
      );
      await answer(page, "?");
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(page.locator(".branch-reveal")).toHaveCount(0);
      checks.push(`${label}: invalid answer never triggers a match flourish`);
      await answer(page);
      await expect(page.locator(".branch-feedback")).toBeFocused();
      await expect(page.locator(".comparison-card.is-match")).toHaveCount(1);
      await expect(
        page.locator(".comparison-card.is-ruled-out .pen-strike"),
      ).toHaveCount(1);
      await expect(page.locator(".conclusion")).toContainText(
        "かっこの後ろでマイナスを落とす",
      );
      await widthCheck(page);
      checks.push(
        `${label}: immediate focused outcome, matched answer and rejected candidate remain visible`,
      );
      const questions = practice("minus-tail");
      await page.locator("#practice-0").fill("999");
      await page.locator(".practice").first().getByRole("button").click();
      await expect(page.locator(".practice-correct")).toHaveCount(0);
      await page.locator("#practice-0").fill(questions[0].answer);
      await page.locator(".practice").first().getByRole("button").click();
      await expect(page.locator(".practice-correct .pen-circle")).toHaveCount(
        1,
      );
      await page.locator("#practice-0").fill("999");
      await expect(page.locator(".practice-correct .pen-circle")).toHaveCount(
        0,
      );
      checks.push(
        `${label}: correct answer alone gets a circle; editing invalidates it`,
      );
      for (let i = 0; i < 3; i++) {
        await page.locator(`#practice-${i}`).fill(questions[i].answer);
        await page.locator(".practice").nth(i).getByRole("button").click();
      }
      await expect(page.locator(".practice-correct")).toHaveCount(3);
      await expect(page.locator(".completion")).toBeVisible();
      await widthCheck(page);
      checks.push(`${label}: all three checks complete without overflow`);
      if (reduced) {
        expect(await page.evaluate(() => document.getAnimations().length)).toBe(
          0,
        );
        const offsets = await page
          .locator(".pen-mark path")
          .evaluateAll((nodes) =>
            nodes.map((el) => getComputedStyle(el).strokeDashoffset),
          );
        expect(offsets.every((value) => value === "0px" || value === "0")).toBe(
          true,
        );
        checks.push(`${label}: no animations; all ink fully visible`);
      } else {
        const timings = await page.evaluate(() =>
          document
            .getAnimations()
            .map((a) => Number(a.effect!.getComputedTiming().endTime)),
        );
        expect(timings.length).toBeGreaterThan(0);
        expect(timings.every((ms) => ms <= 600)).toBe(true);
        checks.push(`${label}: every retained flourish ends within 600ms`);
        if (width === 390)
          await snapshot(
            page,
            ".practice-section",
            "390-practice-finished",
            1000,
          );
      }
      await page.getByRole("button", { name: "最初に戻る" }).click();
      await start(page);
      await confirm(page);
      await answer(page, "999");
      await expect(
        page.getByRole("heading", { name: "特定できない", exact: true }),
      ).toBeVisible();
      await expect(
        page.locator(".is-match, .conclusion, .practice"),
      ).toHaveCount(0);
      await expect(page.locator(".comparison-card.is-ruled-out")).toHaveCount(
        2,
      );
      checks.push(
        `${label}: unmatched response rules out both, with no invented conclusion`,
      );
      await page.close();
    }
  }
  // Capture normal motion at exact timeline positions, without changing app code or durations.
  for (const width of [390, 1280]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: "no-preference",
    });
    await page.goto(base);
    await snapshot(page, ".home-overview", `${width}-home`, 1000);
    await start(page);
    if (width === 1280) {
      await snapshot(page, ".transcript-panel", "1280-transcript-mid", 180);
      await snapshot(
        page,
        ".transcript-panel",
        "1280-transcript-finished",
        1000,
      );
    }
    await confirm(page);
    if (width === 1280) {
      await snapshot(page, ".answer-sheet", "1280-red-pen-mid", 280);
      await snapshot(page, ".answer-sheet", "1280-red-pen-finished", 1000);
    }
    await answer(page);
    await snapshot(page, ".branch-reveal", `${width}-branch-mid`, 260);
    await snapshot(page, ".branch-reveal", `${width}-branch-finished`, 1000);
    if (width === 390) {
      await snapshot(page, ".conclusion", "390-conclusion-mid", 180);
      await snapshot(page, ".conclusion", "390-conclusion-finished", 1000);
      await snapshot(page, ".return-unit", "390-return-mid", 180);
      await snapshot(page, ".return-unit", "390-return-finished", 1000);
    }
    await page.close();
  }
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
  writeFileSync(`${out}/frames.json`, JSON.stringify(frames, null, 2));
  const result = {
    checks: checks.length,
    passed: checks.length,
    results: checks,
    browserErrors: errors,
    externalRequests,
    frames: frames.length,
  };
  writeFileSync(`${out}/motion-results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
