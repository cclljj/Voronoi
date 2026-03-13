import { test, expect } from "@playwright/test";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5f2xwAAAAASUVORK5CYII=",
  "base64"
);

test.beforeEach(async ({ page }) => {
  await page.route("**/config.json", async (route) => {
    const response = {
      dataUrl: "/data/data.csv",
      refreshIntervalMs: 2000,
      polling: { maxIntervalMs: 300000 },
      map: {
        center: [23.77, 120.88],
        zoom: 8,
        minZoom: 5,
        maxZoom: 19,
        tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution:
          '&copy; <a target="_blank" rel="noopener noreferrer" href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      },
      ui: {
        initialTypes: ["AirBox", "AirBoxK", "CI_Taiwan", "LASS", "MAPS", "Malfunction"]
      }
    };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response)
    });
  });

  await page.route("**://*.tile.openstreetmap.org/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: ONE_PIXEL_PNG
    });
  });
});

test("renders map, supports interaction and updates without full reload", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator(".voronoi-cell").first()).toBeVisible({ timeout: 10000 });

  const bootId = await page.evaluate(() => window.__appDebug.bootId);

  await page.evaluate(() => {
    const firstCell = document.querySelector(".voronoi-cell");
    firstCell?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await expect(page.locator("#selected-panel")).toContainText("PM2.5 bucket");

  const pathCountBefore = await page.locator(".voronoi-cell").count();
  await page.locator('input[name="sensor-type"][value="AirBox"]').first().uncheck();
  await expect
    .poll(async () => page.locator(".voronoi-cell").count())
    .not.toBe(pathCountBefore);

  await expect
    .poll(async () => page.evaluate(() => window.__appDebug.refreshCount), { timeout: 6000 })
    .toBeGreaterThan(1);

  const bootIdAfter = await page.evaluate(() => window.__appDebug.bootId);
  expect(bootIdAfter).toBe(bootId);
});
