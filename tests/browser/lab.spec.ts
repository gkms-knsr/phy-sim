import { test, expect, Page } from "@playwright/test";
async function ready(page: Page) {
  await expect(
    page.getByRole("button", { name: "再生", exact: true }),
  ).toBeEnabled();
}
async function time(page: Page, t: number) {
  await page
    .getByRole("slider", { name: "実験時刻", exact: true })
    .fill(String(t));
}
test("linear playback, exact step, reset, parameter validation and drag", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await ready(page);
  await page.screenshot({ path: "artifacts/desktop.png", fullPage: true });
  await page.getByRole("button", { name: "1ステップ進む" }).click();
  await expect(page.locator(".time-display strong")).toContainText("0.01");
  await time(page, 2);
  await expect(page.locator(".measurements>div").first()).toContainText("6.00");
  await page.getByRole("button", { name: "再生", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "一時停止", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "一時停止", exact: true }).click();
  await page.getByRole("button", { name: "リセット", exact: true }).click();
  await expect(page.locator(".time-display strong")).toContainText("0.00");
  const a = page.getByRole("spinbutton", { name: "加速度 数値", exact: true });
  await a.fill("99");
  await a.press("Enter");
  await ready(page);
  await expect(a).toHaveValue("5");
  const box = await page.getByTestId("body").boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 70, box!.y + box!.height / 2);
  await page.mouse.up();
  await ready(page);
  expect(
    Number(
      await page
        .getByRole("spinbutton", { name: "初期位置 数値", exact: true })
        .inputValue(),
    ),
  ).toBeGreaterThan(1);
  await page.getByRole("button", { name: "ダークモード" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(errors).toEqual([]);
});
test("all experiments, presets, learning modes, graphs and CSV", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  for (const name of ["斜面上の物体", "放物運動", "ばね振動", "2物体の衝突"]) {
    await page
      .getByRole("navigation", { name: "実験選択" })
      .getByRole("button", { name: new RegExp(name) })
      .click();
    await ready(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
    await expect(page.locator(".katex-error")).toHaveCount(0);
    await time(page, 2);
    await page.getByRole("button", { name: "速度", exact: true }).click();
    await page.getByRole("button", { name: "詳細モード", exact: true }).click();
    await expect(page.locator(".detail-notes")).toBeVisible();
    await page.screenshot({ path: `artifacts/${name}.png`, fullPage: true });
    await page.getByRole("button", { name: "直感モード", exact: true }).click();
    await expect(page.locator(".insight-box")).toBeVisible();
    await page.getByRole("button", { name: "学習モード", exact: true }).click();
  }
  await page.getByRole("button", { name: /完全非弾性衝突/ }).click();
  await ready(page);
  await expect(
    page.getByRole("spinbutton", { name: "反発係数 数値" }),
  ).toHaveValue("0");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /実験データをCSVで保存/ }).click();
  expect((await download).suggestedFilename()).toBe("physica-collision.csv");
});
test("incline handle and projectile velocity handle update initial conditions", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /斜面上の物体/ })
    .click();
  await ready(page);
  const handle = await page.getByTestId("angle-handle").boundingBox();
  await page.mouse.move(
    handle!.x + handle!.width / 2,
    handle!.y + handle!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handle!.x + handle!.width / 2,
    handle!.y + handle!.height / 2 + 40,
  );
  await page.mouse.up();
  await ready(page);
  expect(
    Number(
      await page
        .getByRole("spinbutton", { name: "斜面の角度 数値" })
        .inputValue(),
    ),
  ).toBeGreaterThan(30);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /放物運動/ })
    .click();
  await ready(page);
  const v = await page
    .getByTestId("velocity-handle")
    .locator("circle")
    .boundingBox();
  await page.mouse.move(v!.x + v!.width / 2, v!.y + v!.height / 2);
  await page.mouse.down();
  await page.mouse.move(v!.x + v!.width / 2 + 25, v!.y + v!.height / 2 - 10);
  await page.mouse.up();
  await ready(page);
  expect(
    Number(
      await page
        .getByRole("spinbutton", { name: "初速の大きさ 数値" })
        .inputValue(),
    ),
  ).toBeGreaterThan(12);
});
test("mobile layout, dark mode persistence and guide keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await ready(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "使い方", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "ダークモード" }).click();
  await page.reload();
  await ready(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: "artifacts/mobile-dark.png", fullPage: true });
});

test("API validates physical limits and returns exact event limits", async ({
  request,
}) => {
  for (const body of [
    { kind: "spring", params: { m: 0 } },
    { kind: "collision", params: { e: 1.1 } },
    { kind: "incline", params: { mus: 0.1, muk: 0.5 } },
    { kind: "linear", params: { a: "bad" } },
  ])
    expect((await request.post("/api/simulate", { data: body })).status()).toBe(
      400,
    );
  const response = await request.post("/api/simulate", {
    data: { kind: "collision", params: { e: 0 } },
  });
  expect(response.ok()).toBe(true);
  const result = await response.json();
  expect(result.frames).toHaveLength(3601);
  expect(result.events).toHaveLength(2);
  expect(result.events[0].t).toBe(result.events[1].t);
  expect(result.events[1].vx).toBeCloseTo(result.events[1].vx2, 10);
  expect(result.events[0].momentum).toBeCloseTo(result.events[1].momentum, 10);
});

test("all presets, display toggles and zoom/pan controls work without external services", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  await page.goto("/");
  await ready(page);
  for (const name of [
    "等加速度運動",
    "斜面上の物体",
    "放物運動",
    "ばね振動",
    "2物体の衝突",
  ]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: new RegExp(name) })
      .click();
    await ready(page);
    const presets = page.locator(".preset");
    for (let i = 0; i < (await presets.count()); i++) {
      await presets.nth(i).click();
      await ready(page);
      await expect(page.getByRole("alert")).toHaveCount(0);
    }
    await expect(page.locator(".katex-error")).toHaveCount(0);
    if (name === "斜面上の物体") {
      await page.getByRole("button", { name: /動摩擦で滑る/ }).click();
      await ready(page);
      await time(page, 0.1);
      expect(
        await page.locator(".explanation annotation").allTextContents(),
      ).toContain(String.raw`f_k=-\mu_kN\,\operatorname{sgn}(v_s)`);
      await page.getByRole("button", { name: /静止摩擦で止まる/ }).click();
      await ready(page);
      await time(page, 3);
      await expect(page.locator(".explanation-intro")).toContainText("静止");
    }
    if (name === "ばね振動") {
      const box = await page.getByTestId("body").boundingBox();
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        box!.x + box!.width / 2 - 25,
        box!.y + box!.height / 2,
      );
      await page.mouse.up();
      await ready(page);
    }
    if (name === "2物体の衝突") {
      const box = await page.getByTestId("body2").boundingBox();
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        box!.x + box!.width / 2 + 25,
        box!.y + box!.height / 2,
      );
      await page.mouse.up();
      await ready(page);
    }
  }
  for (const label of ["速度", "加速度", "力", "軌跡", "グリッド"]) {
    await page.getByRole("checkbox", { name: label, exact: true }).uncheck();
    await expect(
      page.getByRole("checkbox", { name: label, exact: true }),
    ).not.toBeChecked();
  }
  await page.getByRole("button", { name: "拡大", exact: true }).click();
  await page.getByRole("button", { name: "縮小", exact: true }).click();
  await page.getByRole("button", { name: "視点を移動", exact: true }).click();
  const svg = await page.locator(".simulation").boundingBox();
  await page.mouse.move(svg!.x + 100, svg!.y + 100);
  await page.mouse.down();
  await page.mouse.move(svg!.x + 160, svg!.y + 120);
  await page.mouse.up();
  await page
    .getByRole("button", { name: "物体を中央に表示", exact: true })
    .click();
  expect(errors).toEqual([]);
});
