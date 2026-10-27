export type ObjectKind =
  | "mass"
  | "block"
  | "platform"
  | "wall"
  | "floor"
  | "incline"
  | "anchor"
  | "pulley";
export interface LabObject {
  id: string;
  kind: ObjectKind;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  width: number;
  height: number;
  mus: number;
  muk: number;
  angle: number;
  support: string;
}
export interface Connection {
  id: string;
  kind: "spring" | "rope";
  a: string;
  b: string;
  k: number;
  rest: number;
  pulley: string;
}
export interface ExternalForce {
  id: string;
  body: string;
  fx: number;
  fy: number;
}
export interface Scene {
  title: string;
  objects: LabObject[];
  connections: Connection[];
  external: ExternalForce[];
  g: number;
  duration: number;
}
export interface Force {
  kind:
    | "external"
    | "gravity"
    | "spring"
    | "friction"
    | "normal"
    | "tension"
    | "contact"
    | "fixed";
  fx: number;
  fy: number;
  label: string;
  pair: string;
  source: string;
}
export interface BodyState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  forces: Force[];
  q?: number;
}
export interface MultiFrame {
  t: number;
  bodies: BodyState[];
  kinetic: number;
  potential: number;
  energy: number;
  dissipated: number;
  px: number;
  py: number;
  cx: number;
  cy: number;
  cax: number;
  cay: number;
  regime?: string;
  tension?: number;
  ropeLength?: number;
}
export interface ModeShape {
  omega: number;
  frequency: number;
  period: number | null;
  vector: number[];
}
export interface MultiResult {
  supported: boolean;
  model: string;
  reasons: string[];
  assumptions: string[];
  equations: string[];
  derivation: string[];
  frames: MultiFrame[];
  events: MultiFrame[];
  dt: number;
  duration: number;
  meta: Record<string, unknown>;
  modes: ModeShape[];
  warning: string;
}
export interface MultiPreset {
  id: string;
  name: string;
  description: string;
  scene: Scene;
}
export const isDynamic = (o: LabObject) =>
  ["mass", "block", "platform"].includes(o.kind);
export const forceColors: Record<Force["kind"], string> = {
  gravity: "#5d8bc0",
  normal: "#57946f",
  friction: "#cd6b63",
  tension: "#40a3a2",
  spring: "#9771ad",
  external: "#aa7e38",
  contact: "#57946f",
  fixed: "#7b877a",
};
