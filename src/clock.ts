/** Physics is sampled at fixed dt. Rendering may skip samples, never changes them. */
export function nextTime(
  time: number,
  elapsed: number,
  speed: number,
  duration: number,
) {
  return Math.min(duration, Math.max(0, time) + Math.max(0, elapsed) * speed);
}
export function frameIndex(time: number, dt: number, count: number) {
  return Math.min(count - 1, Math.max(0, Math.floor((time + 1e-10) / dt)));
}
export function format(value: number, digits = 2) {
  return (Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value).toFixed(digits);
}
