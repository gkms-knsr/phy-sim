import type { Scene, Force } from "./types";
export interface InteractionSettings {
  positionStep: number;
  forceStep: number;
  sensitivity: number;
}
export const defaultInteraction: InteractionSettings = {
  positionStep: 0.5,
  forceStep: 1,
  sensitivity: 0.5,
};
export interface VectorSettings {
  force: boolean;
  velocity: boolean;
  acceleration: boolean;
  trail: boolean;
  grid: boolean;
  scale: number;
  labels: boolean;
  kinds: Record<Force["kind"], boolean>;
}
export const defaultVectors = (): VectorSettings => ({
  force: true,
  velocity: false,
  acceleration: false,
  trail: false,
  grid: true,
  scale: 1,
  labels: true,
  kinds: {
    gravity: true,
    normal: true,
    friction: true,
    spring: true,
    tension: true,
    external: true,
    contact: true,
    fixed: true,
  },
});
export const forceNames: Record<Force["kind"], string> = {
  gravity: "重力",
  normal: "垂直抗力",
  friction: "摩擦力",
  spring: "ばね力",
  tension: "張力",
  external: "外力",
  contact: "接触力",
  fixed: "固定支点の力",
};
/** Round displacement, rather than the absolute coordinate: clicks and locked axes stay put. */
export function snapDelta(delta: number, step: number) {
  return step > 0
    ? Number((Math.round(delta / step) * step).toFixed(10))
    : delta;
}
export function dragPosition(
  scene: Scene,
  id: string,
  start: { x: number; y: number },
  delta: { x: number; y: number },
  model: string,
  settings: InteractionSettings,
) {
  let dx = delta.x * settings.sensitivity,
    dy = delta.y * settings.sensitivity;
  const o = scene.objects.find((o) => o.id === id),
    rope = scene.connections.find((c) => c.kind === "rope");
  if (model === "pulley" && rope && [rope.a, rope.b].includes(id)) {
    const slope = scene.objects.find((o) => o.kind === "incline"),
      a = ((slope?.angle || 0) * Math.PI) / 180;
    const e =
      id === rope.a && slope
        ? { x: -Math.cos(a), y: -Math.sin(a) }
        : { x: 0, y: -1 };
    const distance = snapDelta(dx * e.x + dy * e.y, settings.positionStep);
    return { x: start.x + distance * e.x, y: start.y + distance * e.y };
  }
  dx = snapDelta(dx, settings.positionStep);
  dy = snapDelta(dy, settings.positionStep);
  if (
    model === "springs" ||
    (model === "platform" &&
      o &&
      (o.kind === "platform" ||
        scene.objects.some((a) => a.id === o.support && a.kind === "platform")))
  )
    dy = 0;
  return {
    x: Number((start.x + dx).toFixed(10)),
    y: Number((start.y + dy).toFixed(10)),
  };
}
export function dragForce(
  start: { fx: number; fy: number },
  delta: { x: number; y: number },
  settings: InteractionSettings,
) {
  const clamp = (v: number) => Math.max(-100, Math.min(100, v));
  return {
    fx: clamp(
      start.fx + snapDelta(delta.x * settings.sensitivity, settings.forceStep),
    ),
    fy: clamp(
      start.fy + snapDelta(delta.y * settings.sensitivity, settings.forceStep),
    ),
  };
}
export function forceIsVisible(kind: Force["kind"], settings: VectorSettings) {
  return settings.force && settings.kinds[kind];
}
export function inferEditorModel(scene: Scene) {
  if (scene.objects.some((o) => o.kind === "platform")) return "platform";
  if (scene.connections.some((c) => c.kind === "rope")) return "pulley";
  if (
    scene.connections.length &&
    scene.connections.every((c) => c.kind === "spring")
  )
    return "springs";
  return "free";
}
export function readInteraction(): InteractionSettings {
  try {
    const value = JSON.parse(
      localStorage.getItem("physica-interaction") || "null",
    );
    return {
      positionStep: [0.01, 0.05, 0.1, 0.25, 0.5, 1].includes(
        value?.positionStep,
      )
        ? value.positionStep
        : defaultInteraction.positionStep,
      forceStep: [0.1, 0.5, 1, 5].includes(value?.forceStep)
        ? value.forceStep
        : defaultInteraction.forceStep,
      sensitivity: [0.25, 0.5, 1, 2].includes(value?.sensitivity)
        ? value.sensitivity
        : defaultInteraction.sensitivity,
    };
  } catch {
    return { ...defaultInteraction };
  }
}
export function readVectors(): VectorSettings {
  const fallback = defaultVectors();
  try {
    const value = JSON.parse(localStorage.getItem("physica-vectors") || "null");
    if (!value) return fallback;
    for (const key of [
      "force",
      "velocity",
      "acceleration",
      "trail",
      "grid",
      "labels",
    ] as const)
      if (typeof value[key] === "boolean") fallback[key] = value[key];
    if ([0.25, 0.5, 1, 1.5, 2].includes(value.scale))
      fallback.scale = value.scale;
    for (const key of Object.keys(fallback.kinds) as Force["kind"][])
      if (typeof value.kinds?.[key] === "boolean")
        fallback.kinds[key] = value.kinds[key];
    return fallback;
  } catch {
    return fallback;
  }
}
