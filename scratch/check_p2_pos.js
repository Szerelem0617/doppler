import { Boss } from '../src/game/Boss.js';
import { Player } from '../src/game/Player.js';
import { STAGE_STRATEGIES } from '../src/tas/strategies.js';

const w = 800;
const h = 800;
const dt = 1 / 60;

const boss = new Boss(w / 2, 130, {
  phaseSequence: [7, 5, 8, 4, 9],
  phaseHps: [7, 7, 8, 9, 11],
  enableBullets: true
});
const player = new Player(w / 2, h - 90, boss);
player.autoFire = true;
const strategy = STAGE_STRATEGIES['2-boss'];
const state = strategy.init();

const inputManager = {
  keys: {},
  skill1Triggered: false,
  consumeSkill1() {
    if (this.skill1Triggered) {
      this.skill1Triggered = false;
      return true;
    }
    return false;
  },
  consumeBlink() { return this.consumeSkill1(); },
  consumeSkill2() { return this.consumeBlink(); },
  consumeShield() { return false; },
  consumeSkill3() { return false; },
  consumeToggleFire() { return false; },
  getMovementVector() {
    let dx = 0, dy = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;
    if (dx !== 0 && dy !== 0) {
      const inv = 0.70710678;
      return { x: dx * inv, y: dy * inv };
    }
    return { x: dx, y: dy };
  }
};

let elapsed = 0;
while (elapsed < 9.0 && !boss.isDead) {
  elapsed += dt;
  const phase = boss.currentPhaseIndex;
  const inputs = strategy.update({ player, enemy: boss }, elapsed, state);
  if (inputs.actions) {
    for (const act of inputs.actions) {
      if (act === 'skill1' || act === 'skill2' || act === 'blink') {
        inputManager.skill1Triggered = true;
      }
    }
  }
  inputManager.keys = inputs.keys || {};
  player.update(dt, inputManager, w, h, boss.bullets);
  boss.update(dt, elapsed * 1000, player, { recordHit() {}, getFrequency() { return 4; }, update() {} });

  if (phase === 2) {
    const dist = Math.hypot(player.x - boss.x, player.y - boss.y);
    console.log(`t=${elapsed.toFixed(3)} p2Time=${(elapsed - state.p2StartTime).toFixed(3)} y=${player.y.toFixed(1)} dist=${dist.toFixed(1)} wpsLeft=${boss.shield.weakpoints.filter(w=>w.alive).length} broken=${boss.shield.isBroken} shat=${boss.shield.isShattering}`);
  }

  for (const bullet of player.bullets) {
    if (!bullet.alive) continue;
    if (!boss.shield.isBroken) {
      boss.shield.checkBulletCollision(bullet, { recordHit() {}, getFrequency() { return 4; } }, elapsed * 1000);
    } else {
      const dist = Math.hypot(bullet.x - boss.x, bullet.y - boss.y);
      if (dist <= boss.radius + 6) {
        bullet.alive = false;
        boss.takeDamage(1, { recordHit() {}, getFrequency() { return 4; } }, elapsed * 1000);
      }
    }
  }
}
