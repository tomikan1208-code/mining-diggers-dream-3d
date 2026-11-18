export const LAND = Object.freeze({
  halfWidth: 35.5, front: 10.4, back: -12.4, bottom: -12.8, slice: -2.66,
});
export const SHAFT = Object.freeze({
  floor: -6.22, roof: -2.89, back: 7.18, track: 8.68,
  first: 16.42, cell: 1.02, startRamp: 20.35, portal: 26.40, grade: 1.05,
});
export const GOLD = Object.freeze({ y: SHAFT.floor + 1.38, z: LAND.front - .04, scale: 1.42 });
export const ABYSS = Object.freeze({ x: .55, y: -11.23, z: 9.72 });
export const CAMP = Object.freeze({
  houseX: 16.75, houseZ: -4.03, standX: 14.7, standZ: .20,
  mill: 12.95, millZ: -.96, plot: 8.76, yard: 22.14, yardZ: -.37, powerX: 17.93, powerZ: .25,
  arrivalX: 34.45, pathZ: 2.45,
});
export const groundY = .15;

export function rampY(x) {
  return SHAFT.floor + (Math.abs(x) - SHAFT.startRamp) * SHAFT.grade;
}

export function roadZ(x) {
  const bend = Math.max(0, (Math.abs(x) - 25) / (LAND.halfWidth - 25));
  return CAMP.pathZ + Math.cos(x * .48) * .46 * (1 - bend) - 6.5 * bend ** 2;
}
