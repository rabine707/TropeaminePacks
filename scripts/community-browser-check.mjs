// Run only with the synthetic localhost fixture; see docs/earn-ink/README.md.
import { fileURLToPath } from "node:url";
const { chromium } = await import(
  process.env.TROPEAMINE_PLAYWRIGHT_MODULE ?? "playwright"
);
import { writeFile, readFile } from "node:fs/promises";
const root = fileURLToPath(new URL("..", import.meta.url));
const user = "00000000-0000-4000-8000-000000000001",
  admin = "00000000-0000-4000-8000-000000000003";
const token = (id) =>
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  ) +
  "." +
  Buffer.from(
    JSON.stringify({
      sub: id,
      aud: "authenticated",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 86400,
      iat: Math.floor(Date.now() / 1000),
    }),
  ).toString("base64url") +
  "." +
  Buffer.from("fixture-only-signature").toString("base64url");
const browser = await chromium.launch({
  ...(process.env.TROPEAMINE_CHROMIUM
    ? { executablePath: process.env.TROPEAMINE_CHROMIUM }
    : {}),
  headless: true,
  args: [
    "--no-sandbox",
    "--no-zygote",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--use-gl=disabled",
  ],
});
const errors = [];
async function context(id, viewport) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  const session = {
    access_token: token(id),
    refresh_token: "fixture-refresh",
    token_type: "bearer",
    expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    user: {
      id,
      aud: "authenticated",
      role: "authenticated",
      email: "collector@example.invalid",
      user_metadata: {},
      app_metadata: { provider: "email", providers: ["email"] },
      identities: [],
      created_at: "2026-01-01T00:00:00Z",
    },
  };
  await ctx.addCookies([
    {
      name: "sb-127-auth-token",
      value:
        "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"),
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await ctx.addInitScript((s) => {
    try {
      localStorage.setItem("sb-127-auth-token", JSON.stringify(s));
    } catch {}
  }, session);
  return ctx;
}
const ctx = await context(user, { width: 1440, height: 1000 });
const page = await ctx.newPage();
page.on("pageerror", (e) => {
  errors.push(e.message);
  console.log("PAGE ERROR", e.message);
});
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("CONSOLE", msg.text());
});
await page.goto("http://127.0.0.1:3000/quests");
await page.getByText("Fund the obsession.", { exact: true }).waitFor();
await page.getByText("6/6 owned cards", { exact: true }).waitFor();
await page.waitForTimeout(4500);
await page.screenshot({
  path: root + "/docs/earn-ink/desktop.png",
  fullPage: true,
});

await page
  .locator(".quest-card")
  .filter({ hasText: "Free Ink. Because you showed up." })
  .getByRole("button", { name: "Claim reward" })
  .click();
await page
  .getByText("Mission claimed. +100 Ink added!", { exact: true })
  .waitFor();
for (const title of ["Show off your favorites.", "The inner circle."]) {
  await page
    .locator(".quest-card")
    .filter({ hasText: title })
    .getByRole("button", { name: "Claim reward" })
    .click();
  await page
    .locator(".quest-card")
    .filter({ hasText: title })
    .getByText("Claimed", { exact: true })
    .waitFor();
}
await page
  .getByRole("button", { name: "Pick the next obsession", exact: true })
  .click();
await page.getByLabel("Character name", { exact: true }).fill("Henry Turner");
await page.getByLabel("Book or series", { exact: true }).fill("Maple Hills");
await page.getByRole("button", { name: /Send idea/ }).click();
await page.getByText(/Idea saved privately/).waitFor();
await page.goto("http://127.0.0.1:3000/requests");
await page.getByRole("heading", { name: "Fourth Wing", exact: true }).waitFor();
if (
  await page.getByRole("heading", { name: "Henry Turner", exact: true }).count()
)
  throw new Error("Unpublished character leaked");
await page.screenshot({
  path: root + "/docs/earn-ink/requests-desktop.png",
  fullPage: true,
});
await page.goto("http://127.0.0.1:3000/quests");
await page
  .getByRole("button", { name: "Romantasy favorites", exact: true })
  .click();
await page.getByText("Vote saved. +25 Ink added!", { exact: true }).waitFor();
await page
  .getByRole("button", { name: "Sports romance casts", exact: true })
  .click();
await page.getByText("Vote saved.", { exact: true }).waitFor();
const mobile = await context(user, { width: 390, height: 844 });
const mp = await mobile.newPage();
await mp.goto("http://127.0.0.1:3000/quests");
await mp.getByText("6/6 owned cards", { exact: true }).waitFor();
await mp.waitForTimeout(4500);
await mp.screenshot({
  path: root + "/docs/earn-ink/mobile.png",
  fullPage: true,
});
const width = await mp.evaluate(() => ({
  viewport: innerWidth,
  scroll: document.documentElement.scrollWidth,
}));
if (width.scroll > width.viewport)
  throw new Error("Mobile overflow " + JSON.stringify(width));
const ac = await context(admin, { width: 1440, height: 1000 });
const ap = await ac.newPage();
await ap.goto("http://127.0.0.1:3000/admin/community");
await ap.getByRole("heading", { name: "Henry Turner", exact: true }).waitFor();
await ap.screenshot({
  path: root + "/docs/earn-ink/admin-desktop.png",
  fullPage: true,
});
// The Studio uses its existing draft/local catalog; seed synthetic owned artwork
// with a real local image, then exercise all three full-resolution PNG formats.
await page.goto("http://127.0.0.1:3000/binder");
await page.getByRole("heading", { name: "My binder", exact: true }).waitFor();
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("tropeamine-packs-v1"));
  raw.cards[0].id = "10000000-0000-4000-8000-000000000001";
  raw.wallet.owned = Array.from(
    { length: 6 },
    (_, i) => `10000000-0000-4000-8000-00000000000${i + 1}`,
  );
  raw.cards[0].image = "/card-backs/2DAD99D8-884D-4CD0-A564-10DF78C2F37E.png";
  localStorage.setItem("tropeamine-packs-v1", JSON.stringify(raw));
  localStorage.setItem(
    "tropeamine-showcase-draft-v1",
    JSON.stringify({
      preset: "story",
      bg: "plum",
      elements: [
        {
          id: "fixture-element",
          kind: "card",
          cardId: raw.cards[0].id,
          side: "front",
          x: 540,
          y: 960,
          w: 400,
          h: 600,
          rotation: 0,
          z: 1,
        },
      ],
      snap: true,
    }),
  );
});
await page.goto("http://127.0.0.1:3000/showcase/create");
await page.getByRole("button", { name: "Save PNG", exact: true }).waitFor();
await page
  .getByText("Your last showcase draft was restored.", { exact: true })
  .waitFor();
for (const [format, w, h] of [
  ["Story", 1080, 1920],
  ["Square", 1080, 1080],
  ["Landscape", 1200, 630],
]) {
  const control = page.getByRole("button", { name: format, exact: true });
  if (await control.count()) await control.click();
  else
    await page.getByRole("combobox").first().selectOption(format.toLowerCase());
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save PNG", exact: true }).click();
  const download = await downloaded;
  await download.saveAs("/tmp/tropeamine-" + format + ".png");
  const png = await readFile("/tmp/tropeamine-" + format + ".png");
  if (png.readUInt32BE(16) !== w || png.readUInt32BE(20) !== h)
    throw new Error("Bad PNG dimensions " + format);
  console.log("PNG", format, png.length, w, h);
  await page.getByText(/PNG handed to your browser/).waitFor();
  console.log(
    "EXPORT NOTICE",
    await page.getByText(/PNG handed to your browser/).innerText(),
  );
  if (
    format === "Story" &&
    !(await page
      .getByText(/PNG handed to your browser/)
      .innerText()
      .then((t) => t.includes("+100 Ink")))
  )
    throw new Error("First export did not earn 100 Ink");
  if (
    format !== "Story" &&
    (await page
      .getByText(/PNG handed to your browser/)
      .innerText()
      .then((t) => t.includes("+100 Ink")))
  )
    throw new Error("Repeat export paid twice");
}
await writeFile(
  root + "/docs/earn-ink/browser-results.json",
  JSON.stringify(
    {
      viewport: width,
      errors,
      checks: [
        "daily claim",
        "existing first/six milestones",
        "private character submission",
        "approved Requests rendering",
        "poll reward and vote change",
        "admin inbox authorization",
        "Story 1080×1920 export",
        "Square 1080×1080 export",
        "Landscape 1200×630 export",
        "first download +100 Ink and repeat downloads +0",
      ],
    },
    null,
    2,
  ),
);
console.log("Browser checks passed", errors);
await browser.close();
