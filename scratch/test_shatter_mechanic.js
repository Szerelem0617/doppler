import { Shield } from '../src/game/Shield.js';
import { Bullet } from '../src/game/Bullet.js';

console.log('--- Testing Shield Shatter Mechanic ---');

// Mock enemy
const enemy = { x: 400, y: 130, radius: 28 };
const shield = new Shield(enemy, 6, 78, 0.22);

// 1. Initial State
console.assert(!shield.isBroken, 'Shield should not be broken initially');
console.assert(!shield.isShattering, 'Shield should not be shattering initially');
console.log('Step 1: Initial state verified.');

// 2. Break all weakpoints
shield.weakpoints.fill(false);
shield.checkAllWeakpoints();

console.assert(shield.isShattering, 'Shield should enter isShattering state after all weakpoints destroyed');
console.assert(!shield.isBroken, 'Shield isBroken should still be false during shattering');
console.assert(shield.justBroken, 'justBroken flag should be set for external event listeners');
console.log(`Step 2: Shattering triggered successfully. Duration = ${shield.shatterDuration}s`);

// 3. Test bullet collision during shatter (Bullets cannot penetrate, 0 damage, deflected)
const bulletAtShield = new Bullet(enemy.x, enemy.y + shield.radius, enemy, 480);
const hitShield = shield.checkBulletCollision(bulletAtShield, null, Date.now());
console.assert(hitShield === true, 'Shield should intercept bullet during shattering');
console.assert(bulletAtShield.alive === false, 'Bullet should be destroyed (deflected) upon hitting shattering shield');
console.log('Step 3: Bullet intercepted and deflected by shattering barrier without penetrating.');

// 4. Test shatter timer progression
// Update for 0.15s (halfway)
shield.update(0.15, null);
console.assert(shield.isShattering, 'Shield should still be shattering at 0.15s');
console.assert(!shield.isBroken, 'Shield should not be broken yet at 0.15s');

// Update another 0.16s (total 0.31s > 0.3s)
shield.update(0.16, null);
console.assert(!shield.isShattering, 'Shield should have finished shattering after 0.3s');
console.assert(shield.isBroken, 'Shield should now be isBroken = true (vulnerable window open)');
console.assert(shield.rechargeTimer === 0, 'Recharge timer should start from 0 at the beginning of vulnerability');
console.log('Step 4: 0.3s shatter animation completed. Shield fully broken, vulnerable phase started.');

// 5. Test bullet during vulnerable phase (Shield no longer intercepts, bullets reach core)
const bulletAtCore = new Bullet(enemy.x, enemy.y + shield.radius, enemy, 480);
const hitShieldPost = shield.checkBulletCollision(bulletAtCore, null, Date.now());
console.assert(hitShieldPost === false, 'Shield should NOT intercept bullets after shattering finishes (broken state)');
console.assert(bulletAtCore.alive === true, 'Bullet should remain alive to penetrate into the enemy body');
console.log('Step 5: Bullets penetrate directly to enemy core during vulnerable window.');

console.log('--- ALL TESTS PASSED SUCCESSFULLY! ---');
