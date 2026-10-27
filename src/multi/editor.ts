import type { Scene, LabObject, ObjectKind } from "./types";
export const blankScene = (): Scene => ({
  title: "新しい自由実験",
  g: 9.8,
  duration: 12,
  objects: [],
  connections: [],
  external: [],
});
export function newObject(
  kind: ObjectKind,
  id: string,
  x = 0,
  y = 0,
): LabObject {
  return {
    id,
    kind,
    label: {
      mass: "質点",
      block: "ブロック",
      platform: "動く台",
      wall: "固定壁",
      floor: "床",
      incline: "斜面",
      anchor: "固定支点",
      pulley: "固定滑車",
    }[kind],
    x,
    y,
    vx: 0,
    vy: 0,
    mass: kind === "platform" ? 4 : 1,
    width: kind === "platform" ? 12 : 0.8,
    height: kind === "platform" ? 0.6 : 0.8,
    mus: 0.5,
    muk: 0.3,
    angle: 30,
    support: "",
  };
}
export function removeItem(scene: Scene, id: string): Scene {
  const removedLinks = scene.connections.filter(
    (c) => c.id !== id && c.a !== id && c.b !== id && c.pulley !== id,
  );
  return {
    ...scene,
    objects: scene.objects
      .filter((o) => o.id !== id)
      .map((o) => (o.support === id ? { ...o, support: "" } : o)),
    connections: removedLinks,
    external: scene.external.filter((f) => f.id !== id && f.body !== id),
  };
}
export function moveObject(
  scene: Scene,
  id: string,
  x: number,
  y: number,
  model: string,
): Scene {
  const target = scene.objects.find((o) => o.id === id);
  if (!target) return scene;
  const clone = structuredClone(scene),
    by = Object.fromEntries(clone.objects.map((o) => [o.id, o])),
    item = by[id];
  const clamp = (v: number) => Math.max(-30, Math.min(30, v));
  x = clamp(x);
  y = clamp(y);
  if (model === "platform") {
    if (item.kind === "platform") {
      const dx = x - item.x;
      item.x = x;
      clone.objects.filter((o) => o.support === id).forEach((o) => (o.x += dx));
    } else if (item.support && by[item.support]?.kind === "platform")
      item.x = x;
    else {
      item.x = x;
      item.y = y;
    }
  } else if (model === "springs") {
    item.x = x;
  } else if (model === "pulley") {
    const link = clone.connections.find((c) => c.kind === "rope"),
      pulley = link ? by[link.pulley] : null;
    if (link && pulley) {
      if (item.kind === "pulley") {
        const dx = x - item.x,
          dy = y - item.y;
        clone.objects.forEach((o) => {
          o.x += dx;
          o.y += dy;
        });
      } else if ([link.a, link.b].includes(id)) {
        const slope = clone.objects.find((o) => o.kind === "incline"),
          angle = ((slope?.angle || 0) * Math.PI) / 180;
        const first = id === link.a,
          ex = first && slope ? -Math.cos(angle) : 0,
          ey = first && slope ? -Math.sin(angle) : -1;
        const ox = pulley.x + (first ? -0.4 : 0.4),
          oy = pulley.y;
        const q = Math.max(
          0.5,
          Math.min(link.rest - 0.5, (x - ox) * ex + (y - oy) * ey),
        );
        item.x = ox + q * ex;
        item.y = oy + q * ey;
        const other = by[first ? link.b : link.a],
          otherFirst = !first,
          oeX = otherFirst && slope ? -Math.cos(angle) : 0,
          oeY = otherFirst && slope ? -Math.sin(angle) : -1;
        const otherOrigin = pulley.x + (otherFirst ? -0.4 : 0.4),
          oq = link.rest - q;
        other.x = otherOrigin + oq * oeX;
        other.y = pulley.y + oq * oeY;
      } else {
        item.x = x;
        item.y = y;
      }
    }
  } else {
    item.x = x;
    item.y = y;
  }
  return clone;
}
