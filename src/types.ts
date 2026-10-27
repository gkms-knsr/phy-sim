export type Kind = "linear" | "incline" | "projectile" | "spring" | "collision";
export type Params = Record<string, number>;
export type Mode = "intuitive" | "learn" | "detail";
export interface Frame {
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  kinetic: number;
  potential: number;
  energy: number;
  friction: number;
  normal: number;
  momentum: number;
  s?: number;
  v?: number;
  a?: number;
  regime?: string;
  x2?: number;
  vx2?: number;
  landed?: boolean;
  collided?: boolean;
  impulse?: boolean;
}
export interface Result {
  kind: Kind;
  params: Params;
  dt: number;
  duration: number;
  events: Frame[];
  meta: Record<string, number | null>;
  frames: Frame[];
}
export interface ParamSpec {
  key: string;
  label: string;
  symbol: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
}
export interface Preset {
  name: string;
  description: string;
  values: Params;
}
export interface Experiment {
  id: Kind;
  name: string;
  short: string;
  english: string;
  description: string;
  params: ParamSpec[];
  presets: Preset[];
  assumptions: string;
  hint: string;
}
export interface Visibility {
  force: boolean;
  velocity: boolean;
  acceleration: boolean;
  trail: boolean;
  grid: boolean;
}
export const EMPTY: Frame = {
  t: 0,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  ax: 0,
  ay: 0,
  kinetic: 0,
  potential: 0,
  energy: 0,
  friction: 0,
  normal: 0,
  momentum: 0,
};
