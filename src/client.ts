import type { ReadInput, ReadResult } from "./core/provider";
export async function read(input: ReadInput): Promise<ReadResult> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(53000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error || "読み取りに失敗しました。手入力で続けてください。",
    );
  return data;
}
/** Resizing also strips photograph metadata. Only the resulting data URL is sent. */
export async function prepareImage(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("JPEG・PNG・WebP の画像を選んでください。");
  if (file.size > 12_000_000)
    throw new Error("画像は 12 MB 以下にしてください。");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("画像を開けませんでした。");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", 0.85);
    if (url.length > 3_500_000)
      throw new Error("画像が大きすぎます。式の部分を切り取ってください。");
    return url;
  } finally {
    bitmap.close();
  }
}
