/** Reward completion follows PNG generation + successful browser handoff.
 * An anchor click does not prove the file reached disk. Neither proof of posting
 * nor a client boolean is treated as authority; the DB checks a short-lived token.
 */
export async function exportWithReward(
  generate: () => Promise<Blob>,
  handoff: (blob: Blob) => Promise<void>,
  begin: () => Promise<{ token?: string }>,
  complete: (token: string) => Promise<{ awarded?: number }>,
) {
  const blob = await generate();
  if (blob.type !== "image/png" || blob.size === 0)
    throw new Error("PNG could not be created.");
  // Reward unavailability must never prevent exporting artwork.
  let token: string | undefined;
  let rewardError = false;
  try {
    token = (await begin()).token;
  } catch {
    rewardError = true;
  }
  await handoff(blob);
  let awarded = 0;
  if (token) {
    try {
      awarded = (await complete(token)).awarded ?? 0;
    } catch {
      rewardError = true;
    }
  }
  return { awarded, rewardError };
}
export function pngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("PNG could not be created.")),
        "image/png",
      );
    } catch (error) {
      reject(error);
    }
  });
}
export async function downloadPng(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tropeamine-showcase-${Date.now()}.png`;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
