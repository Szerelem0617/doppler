import { spawn } from 'child_process';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const cdpPort = 9345;

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${cdpPort}`,
  '--no-sandbox',
  '--disable-gpu',
  'about:blank'
]);

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

let msgId = 1;
function sendCdp(ws, method, params = {}) {
  const id = msgId++;
  return new Promise((resolve, reject) => {
    const handler = (event) => {
      const data = JSON.parse(event.data);
      if (data.id === id) {
        ws.removeEventListener('message', handler);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalInPage(ws, expr) {
  const res = await sendCdp(ws, 'Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true
  });
  return res.result.value;
}

setTimeout(async () => {
  try {
    const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json`);
    const pages = await listRes.json();
    const wsUrl = pages[0].webSocketDebuggerUrl;

    const ws = new WebSocket(wsUrl);
    await new Promise(r => { ws.onopen = r; });

    await sendCdp(ws, 'Runtime.enable');
    await sendCdp(ws, 'Page.enable');
    await sendCdp(ws, 'Emulation.setFocusEmulationEnabled', { enabled: true });

    console.log('Navigating to http://localhost:4173/ ...');
    await sendCdp(ws, 'Page.navigate', { url: 'http://localhost:4173/' });
    await delay(1200);

    // 1. 开始第一关
    console.log('Starting Stage 1 via click...');
    await evalInPage(ws, `document.getElementById('start-btn').click()`);
    await delay(300);

    // 故意让玩家扣一滴血 (测试后续破盾是否会回血)
    const checkPlayer = await evalInPage(ws, `(() => {
      return {
        hasPlayer: !!window.player,
        hp: window.player ? window.player.hp : null
      };
    })()`);
    console.log('Player existence check:', checkPlayer);

    console.log('Damaging player by 1 HP (3 -> 2)...');
    await evalInPage(ws, `window.player.takeDamage(1)`);
    const hpAfterDmg = await evalInPage(ws, `window.player.hp`);
    console.log('Player HP after damage:', hpAfterDmg);
    if (hpAfterDmg !== 2) throw new Error(`Expected HP 2, got ${hpAfterDmg}`);

    // 等待 6 发子弹击破护盾
    console.log('Waiting for shield to break...');
    for (let i = 0; i < 100; i++) {
      await evalInPage(ws, `for (let s = 0; s < 6; s++) window.physicsStep(window.FIXED_DT)`);
      const isBroken = await evalInPage(ws, `window.enemyTarget.shield.isBroken || window.enemyTarget.shield.isShattering`);
      if (isBroken) break;
      await delay(40);
    }

    // 2. 验证破盾后绝对没有回血机制！
    const hpAfterBreak = await evalInPage(ws, `window.player.hp`);
    console.log('Player HP after shield break:', hpAfterBreak);
    if (hpAfterBreak !== 2) {
      throw new Error(`Player should NOT heal on shield break! Expected 2, got ${hpAfterBreak}`);
    }
    console.log('✓ Verified: No healing on shield break! HP stayed at 2.');

    // 解除时停 (按 W 键)
    console.log('Dismissing freeze prompt via KeyW...');
    await sendCdp(ws, 'Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyW', key: 'w' });
    await delay(100);

    // 击败第一关敌人
    console.log('Defeating Stage 1 enemy...');
    await evalInPage(ws, `window.enemyTarget.takeDamage(100, window.freqMeter, Date.now())`);
    
    // 步进几帧让死亡结算触发
    for (let i = 0; i < 40; i++) {
      await evalInPage(ws, `for (let s = 0; s < 6; s++) window.physicsStep(window.FIXED_DT)`);
      await delay(40);
      const isOverlayVisible = await evalInPage(ws, `document.getElementById('game-overlay').style.display !== 'none'`);
      if (isOverlayVisible) break;
    }

    // 3. 验证第一关结算界面的提示文案
    const victoryOverlay = await evalInPage(ws, `(() => {
      const btn = document.getElementById('start-btn');
      const title = document.getElementById('overlay-title');
      return {
        title: title.textContent.trim(),
        btnText: btn.textContent.trim()
      };
    })()`);
    console.log('Stage 1 Victory Overlay:', victoryOverlay);
    if (victoryOverlay.title !== 'STAGE 1 CLEARED') {
      throw new Error(`Expected STAGE 1 CLEARED, got ${victoryOverlay.title}`);
    }
    if (victoryOverlay.btnText !== '按任意键进入下一关') {
      throw new Error(`Expected "按任意键进入下一关", got "${victoryOverlay.btnText}"`);
    }
    console.log('✓ Verified: Victory prompt says "按任意键进入下一关" with no mouse text.');

    // 4. 验证按任意键 (例如空格键 Space) 能直接进入第二关，无需鼠标点击！
    await delay(300); // 确保超过 150ms 防抖
    console.log('Pressing Space key to advance to Stage 2...');
    await sendCdp(ws, 'Input.dispatchKeyEvent', { type: 'keyDown', code: 'Space', key: ' ' });
    await delay(300);

    // 5. 验证第二关开局状态与战机位置
    const stage2State = await evalInPage(ws, `(() => {
      const p = window.player;
      const b = window.enemyTarget;
      const isBossInside = Math.hypot(p.x - b.x, p.y - b.y) <= b.shield.radius;
      return {
        currentStage: window.currentStage,
        playerX: p.x,
        playerY: p.y,
        playerHp: p.hp,
        isInsideShield: p.isInsideShield,
        isBossInside: isBossInside,
        bossX: b.x,
        bossY: b.y,
        shieldRadius: b.shield.radius
      };
    })()`);
    console.log('Stage 2 Starting State:', stage2State);

    if (stage2State.currentStage !== '2-boss') {
      throw new Error(`Expected currentStage to be 2-boss, got ${stage2State.currentStage}`);
    }
    if (stage2State.playerX !== 400 || stage2State.playerY !== 710) {
      throw new Error(`Expected player to spawn at (400, 710), got (${stage2State.playerX}, ${stage2State.playerY})`);
    }
    if (stage2State.isBossInside || stage2State.isInsideShield) {
      throw new Error(`Player must NOT spawn inside boss shield circle!`);
    }
    console.log('✓ Verified: Stage 2 player spawns at (400, 710), exactly identical to Stage 1, and NOT inside Boss circle!');

    ws.close();
    chrome.kill();
    console.log('🎉 ALL 3 CHECKS VERIFIED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('Error during test:', err);
    chrome.kill();
    process.exit(1);
  }
}, 500);
