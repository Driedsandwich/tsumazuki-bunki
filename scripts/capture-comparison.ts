import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const dir = resolve(process.env.ARTIFACT_DIR || "verification/a1");
const data = (path: string) =>
  `data:image/png;base64,${readFileSync(`${dir}/${path}`).toString("base64")}`;
const panels = [
  { name: "01　答案の読み取り", image: "img1", screen: "review" },
  { name: "02　原因を見分ける", image: "img2", screen: "branch" },
];
const html = `<!doctype html><html lang="ja"><meta charset="UTF-8"><title>A1 見本と実装の比較</title><style>
*{box-sizing:border-box}body{margin:0;padding:40px;background:#F7F3E8;color:#243447;font-family:'Noto Sans CJK JP',sans-serif;width:1800px}h1{font-size:36px;margin:0 0 12px}h2{font-size:26px;margin:0 0 20px}p{font-size:18px;margin:8px 0 24px}section{border-top:1px solid #c8bbaa;padding-top:24px;margin-top:32px}.grid{display:grid;grid-template-columns:330px 300px 1fr;gap:24px}.cell{min-width:0}.tag{display:block;font-size:18px;font-weight:700;margin-bottom:12px}.frame{height:840px;overflow:hidden;background:#fffefa;border:1px solid #d5ccbd;border-radius:8px}.frame img{width:100%;display:block}.desktop img{width:100%}.result-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px}.result-grid .frame{height:auto;background:transparent}.result-grid img{width:100%}.note{color:#C33E3E;font-size:16px}a{color:inherit}footer{font-size:16px;margin-top:24px}
</style><body><h1>A1「答案に戻る」｜見本と実装の比較</h1><p>方眼の答案を主役に、赤ペンの印と規則の再現を重ねる。数式・判定は既存の見本②のデータです。</p><p class="note">01・02は画面上部の抜粋、03はPC全体を縮小表示。390px・1280pxの全画面PNGを screenshots に同梱しています。</p>
${panels.map((p) => `<section><h2>${p.name}</h2><div class="grid"><div class="cell"><span class="tag">A1 見本</span><div class="frame"><img src="${data(`references/${p.image}.png`)}"></div></div><div class="cell"><span class="tag">実装 · 390px（上部）</span><div class="frame"><img src="${data(`screenshots/390-${p.screen}.png`)}"></div></div><div class="cell"><span class="tag">実装 · 1280px（上部）</span><div class="frame desktop"><img src="${data(`screenshots/1280-${p.screen}.png`)}"></div></div></div></section>`).join("")}
<section><h2>03　指導のまとめ</h2><div class="result-grid"><div><span class="tag">A1 見本</span><div class="frame"><img src="${data("references/img3.png")}"></div><p>答案7列・注釈5列。原因、根拠、戻る単元、3つの確認問題を答案の横に配置。</p><p class="note">既存の判定を維持：追加問題は答えの値を照合。未入力の途中式を生成せず、照合済みの範囲を明記しています。</p></div><div><span class="tag">実装 · 1280px（全体）</span><div class="frame"><img src="${data("screenshots/1280-result.png")}"></div></div></div></section><footer>背景 #F7F3E8 / 紙 #FFFEFA / 本文 #243447 / 訂正 #C33E3E / 格子 #E6DECF　｜　外部フォント・新規依存なし</footer></body></html>`;
writeFileSync(`${dir}/comparison.html`, html);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1800, height: 1000 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((img) => img.decode()));
  });
  await page.screenshot({ path: `${dir}/comparison.png`, fullPage: true });
} finally {
  await browser.close();
}
