import { test, expect, Page } from "@playwright/test";
const ready = async (page: Page) =>
  expect(
    page.getByRole("button", { name: "自由実験を再生", exact: true }),
  ).toBeEnabled({ timeout: 30000 });
const preset = async (page: Page, name: string) => {
  await page
    .locator(".multi-presets")
    .getByRole("button", { name: new RegExp(name) })
    .click();
  await ready(page);
};
test("entry, coupled platform, body force diagram, derivation and return to legacy", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "自由実験・連成運動" }).click();
  await ready(page);
  await expect(
    page.getByRole("heading", { name: /自由実験室.*連成運動/ }),
  ).toBeVisible();
  await page.getByRole("slider", { name: "自由実験の時刻" }).fill("1");
  await expect(page.locator(".multi-body-data")).toContainText("1.60");
  await page.getByTestId("multi-load").click();
  await expect(page.locator(".free-body .card-heading")).toContainText(
    "物体 m",
  );
  await page.getByRole("button", { name: "式の導出を見る" }).click();
  await expect(page.getByLabel("式の段階的な導出")).toContainText("上の物体");
  await page.getByRole("button", { name: "次のステップへ" }).click();
  await page.getByRole("button", { name: "系全体を選択" }).click();
  await expect(page.locator(".force-terms")).toContainText("内力として相殺");
  await expect(page.locator(".katex-error")).toHaveCount(0);
  await page.screenshot({
    path: "artifacts/multi-platform.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "自由実験を再生", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "自由実験を一時停止" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "基本実験に戻る" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "等加速度",
  );
  expect(errors).toEqual([]);
});
test("all eight presets, normal modes, per-body charts, unilateral rope and initial edits", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#free");
  await ready(page);
  const names = [
    "台の上の物体（摩擦なし）",
    "台の上の物体（静止摩擦あり）",
    "台の上の物体（滑りあり）",
    "2物体を1本のばねで接続",
    "2物体を3本のばねで接続",
    "2物体の滑車問題",
    "斜面と滑車を組み合わせた問題",
    "ばねで接続された3物体",
  ];
  for (const name of names) {
    await preset(page, name);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.locator(".katex-error")).toHaveCount(0);
    await expect(
      page.locator(".multi-graph .recharts-line-curve").first(),
    ).toHaveAttribute("d", /[0-9]/);
    await page.getByRole("slider", { name: "自由実験の時刻" }).fill("0.5");
    await page
      .getByRole("combobox", { name: "グラフの物理量" })
      .selectOption("energy");
    await expect(page.locator(".multi-body-data tbody tr")).toHaveCount(
      name.includes("3物体") ? 3 : 2,
    );
  }
  await preset(page, "2物体を3本のばねで接続");
  await expect(page.locator(".multi-modes")).toContainText("同位相");
  await expect(page.locator(".multi-modes")).toContainText("逆位相");
  await page
    .getByRole("button", { name: "このモードで初期変位を設定" })
    .nth(1)
    .click();
  await ready(page);
  await page.screenshot({
    path: "artifacts/multi-springs.png",
    fullPage: true,
  });
  await preset(page, "2物体の滑車問題");
  await page
    .locator(".multi-inventory")
    .getByRole("button", { name: /rope/ })
    .click();
  const length = page.getByRole("spinbutton", {
    name: "糸の長さ",
    exact: true,
  });
  await length.fill("7");
  await length.press("Enter");
  await ready(page);
  await expect(page.locator(".multi-status")).toContainText("たるんで");
  await page.screenshot({ path: "artifacts/multi-pulley.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("palette drag and drop, spring endpoint connections, selection edits and unsupported configurations", async ({
  page,
}) => {
  await page.goto("/#free");
  await ready(page);
  await page.getByRole("button", { name: "空の実験をつくる" }).click();
  await page.getByRole("button", { name: "質点を追加", exact: true }).click();
  await ready(page);
  const mass = page.getByRole("spinbutton", { name: "質量", exact: true });
  await mass.fill("2");
  await mass.press("Enter");
  await ready(page);
  await page.getByRole("button", { name: "質点を追加", exact: true }).click();
  await ready(page);
  await page.getByRole("button", { name: "ばねを追加", exact: true }).click();
  await page.getByTestId("multi-mass1").click();
  await page.getByTestId("multi-mass2").click();
  await ready(page);
  await expect(page.locator(".multi-inventory")).toContainText("mass1 ↔ mass2");
  const k = page.getByRole("spinbutton", { name: "ばね定数", exact: true });
  await k.fill("12");
  await k.press("Enter");
  await ready(page);
  const wall = page.getByRole("button", { name: "固定壁を追加", exact: true });
  await wall.dragTo(page.getByRole("img", { name: "自由実験の配置エリア" }), {
    targetPosition: { x: 30, y: 150 },
  });
  await expect(page.getByRole("alert")).toContainText("構成");
  await expect(
    page.getByRole("button", { name: "自由実験を再生", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "選択したオブジェクトを削除" })
    .click();
  await ready(page);
});
test("external force handle, body drag and save/import round trip", async ({
  page,
}) => {
  await page.goto("/#free");
  await ready(page);
  await page.getByRole("button", { name: "空の実験をつくる" }).click();
  await page.getByRole("button", { name: "質点を追加", exact: true }).click();
  await ready(page);
  await page.getByRole("button", { name: "外力を追加", exact: true }).click();
  await ready(page);
  const handle = page.locator('[data-testid^="force-"] circle');
  const box = await handle.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width / 2 + 20,
    box!.y + box!.height / 2 - 10,
  );
  await page.mouse.up();
  await ready(page);
  expect(
    Number(
      await page.getByRole("spinbutton", { name: "外力 Fᵧ" }).inputValue(),
    ),
  ).toBeGreaterThan(0);
  const object = page.getByTestId("multi-mass1"),
    o = await object.boundingBox();
  await page.mouse.move(o!.x + o!.width / 2, o!.y + o!.height / 2);
  await page.mouse.down();
  await page.mouse.move(o!.x + o!.width / 2 + 25, o!.y + o!.height / 2);
  await page.mouse.up();
  await ready(page);
  const promise = page.waitForEvent("download");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  const download = await promise;
  const path = await download.path();
  await page.getByRole("button", { name: "空の実験をつくる" }).click();
  await page.locator("input[type=file]").setInputFiles(path!);
  await ready(page);
  await expect(page.getByTestId("multi-mass1")).toBeVisible();
});
test("free lab mobile layout and invalid scene import rejection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#free");
  await ready(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ objects: [{ id: "a", kind: "mass", mass: 0 }] }),
    ),
  });
  await expect(page.locator(".toast")).toContainText("mass");
  await expect(
    page.getByRole("button", { name: "自由実験を再生", exact: true }),
  ).toBeEnabled();
  await page.screenshot({ path: "artifacts/multi-mobile.png", fullPage: true });
});
