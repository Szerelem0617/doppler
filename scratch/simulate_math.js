// Simulation of Shield weakpoint hits in STAGE 2-s8
// Parameters from game:
const c = 1100; // bullet speed
const fireInterval = 0.22; // s
const omega = (Math.PI / 3) / 0.22; // ~4.7599856 rad/s ~272.727 deg/s
const rotationPeriod = (Math.PI * 2) / omega; // 1.32 s
const count = 8;
const angleStep = (Math.PI * 2) / count; // PI/4 = 45 deg
const tolerance = Math.max(0.22, Math.min(0.38, angleStep * 0.42)); // ~0.32987 rad ~18.9 deg
const playerSpeed = 220;
const blinkDist = 300;

console.log({
  omega,
  degPerSec: omega * 180 / Math.PI,
  rotationPeriod,
  angleStepDeg: angleStep * 180 / Math.PI,
  toleranceDeg: tolerance * 180 / Math.PI
});
