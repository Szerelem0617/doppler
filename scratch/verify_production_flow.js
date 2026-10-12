import { spawn } from 'child_process';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9338;

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  '--no-sandbox',
  '--disable-gpu',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--window-size=1280,800',
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
    const listRes = await fetch(`http://127.0.0.1:${port}/json`);
    const pages = await listRes.json();
    const wsUrl = pages[0].webSocketDebuggerUrl;

    const ws = new WebSocket(wsUrl);

    await new Promise(r => { ws.onopen = r; });

    await sendCdp(ws, 'Runtime.enable');
    await sendCdp(ws, 'Page.enable');
    await sendCdp(ws, 'Emulation.setFocusEmulationEnabled', { enabled: true });

    console.log('Navigating to http://localhost:5173/ ...');
    await sendCdp(ws, 'Page.navigate', { url: 'http://localhost:5173/' });
    await delay(1200);
    await sendCdp(ws, 'Page.bringToFront');

    // 1. 验证生产发布版默认界面元素是否彻底精简隐藏
    const prodUiCheck = await evalInPage(ws, `(() => {
      const levelSelector = document.querySelector('.level-selector');
      const tasBox = document.querySelector('.tas-control-box');
      const missionHub = document.querySelector('#mission-hub');
      const hubBtn = document.querySelector('#hub-btn');
      const overlay = document.querySelector('#game-overlay');
      const startBtn = document.querySelector('#start-btn');

      return {
        levelSelectorDisplay: window.getComputedStyle(levelSelector).display,
        tasBoxDisplay: window.getComputedStyle(tasBox).display,
        missionHubDisplay: window.getComputedStyle(missionHub).display,
        hubBtnDisplay: window.getComputedStyle(hubBtn).display,
        overlayVisible: overlay && overlay.style.display !== 'none',
        startBtnText: startBtn ? startBtn.textContent : ''
      };
    })()`);

    console.log('1. Production UI Elements Check:', prodUiCheck);
    if (
      prodUiCheck.levelSelectorDisplay !== 'none' ||
      prodUiCheck.tasBoxDisplay !== 'none' ||
      prodUiCheck.missionHubDisplay !== 'none' ||
      prodUiCheck.hubBtnDisplay !== 'none'
    ) {
      throw new Error('Dev/TAS/Hub elements are not properly hidden in production mode!');
    }
    console.log('✓ Dev/TAS/Hub elements are strictly hidden in production mode.');

    // 2. 点击开始游戏，进入第 1 次第一关 (Entry 1: 奇数次)
    console.log('2. Starting Stage 1 (Entry 1 - Odd)...');
    await evalInPage(ws, `document.querySelector('#start-btn').click()`);
    await delay(300);

    const initialOddCheck = await evalInPage(ws, `(() => {
      const playerY = window.player ? window.player.y : null;
      const isRestricted = window.input ? window.input.movementRestricted : null;
      return { playerY, isRestricted };
    })()`);
    console.log('Initial Odd Entry Check:', initialOddCheck);
    if (!initialOddCheck.isRestricted) {
      throw new Error('Expected movement to be restricted on 1st entry!');
    }

    // 模拟按 W 键
    await sendCdp(ws, 'Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyW', key: 'w' });
    await delay(100);

    const oddPressCheck = await evalInPage(ws, `(() => {
      const toast = document.querySelector('#movement-locked-toast');
      const isToastVisible = toast && toast.style.display !== 'none';
      const toastTitle = toast ? toast.querySelector('.toast-title')?.textContent.trim() : '';
      const playerY = window.player ? window.player.y : null;
      return { isToastVisible, toastTitle, playerY };
    })()`);
    console.log('Odd Entry W Press Check:', oddPressCheck);
    await sendCdp(ws, 'Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyW', key: 'w' });

    if (!oddPressCheck.isToastVisible || oddPressCheck.toastTitle !== '稍等') {
      throw new Error(`Toast was not shown as expected! Found: ${JSON.stringify(oddPressCheck)}`);
    }
    if (oddPressCheck.playerY !== 710) {
      throw new Error(`Player moved when restricted! playerY: ${oddPressCheck.playerY}`);
    }
    console.log('✓ Stage 1 (Entry 1): Movement locked before shield break, "稍等" toast shown correctly!');

    // 等待 6 发子弹打破护盾
    console.log('Waiting for Sentinel Core shield to break...');
    for (let i = 0; i < 70; i++) {
      await evalInPage(ws, `for (let s = 0; s < 6; s++) window.physicsStep(window.FIXED_DT)`);
      await delay(50);
      const status = await evalInPage(ws, `(() => {
        const shield = window.enemyTarget?.shield;
        return {
          isBroken: shield?.isBroken || shield?.isShattering,
          remainingWeakpoints: shield?.weakpoints?.filter(w => w === true)?.length,
          isRestricted: window.input?.movementRestricted,
          bullets: window.player?.bullets?.length,
          aliveBullets: window.player?.bullets?.filter(b => b.alive)?.length,
          timerText: document.querySelector('#timer-digits')?.textContent
        };
      })()`);
      if (i % 10 === 0) {
        console.log(`[Wait shield break step ${i * 6} frames] status:`, status);
      }
      if (status?.isRestricted === false) break;
    }

    const shieldBrokenCheck = await evalInPage(ws, `(() => {
      const shield = window.enemyTarget.shield;
      return {
        isBroken: shield.isBroken || shield.isShattering,
        isRestricted: window.input.movementRestricted
      };
    })()`);
    console.log('Shield Broken Check:', shieldBrokenCheck);
    if (shieldBrokenCheck.isRestricted !== false) {
      throw new Error('Movement was not unrestricted after shield broke!');
    }
    console.log('✓ Movement restriction lifted immediately upon shield break!');

    // 按 W 键验证现在可以自由移动
    await sendCdp(ws, 'Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyW', key: 'w' });
    await evalInPage(ws, `for (let s = 0; s < 10; s++) window.physicsStep(window.FIXED_DT)`);
    await sendCdp(ws, 'Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyW', key: 'w' });

    const afterMoveCheck = await evalInPage(ws, `(() => ({ playerY: window.player.y }))()`);
    console.log('After Move Player Y:', afterMoveCheck);
    if (afterMoveCheck.playerY >= 710) {
      throw new Error('Player did not move after restriction was lifted!');
    }
    console.log('✓ Player moved freely after shield break!');

    // 检查 Stage 1 运行中的计时器是否大于 0
    const liveTimerCheck = await evalInPage(ws, `document.querySelector('#timer-digits')?.textContent`);
    console.log('Stage 1 Live Timer:', liveTimerCheck);
    if (!liveTimerCheck || liveTimerCheck === '00:00.00') {
      throw new Error(`Stage 1 timer was still 00:00.00! Got: ${liveTimerCheck}`);
    }
    console.log('✓ Stage 1 Timer is running properly (> 00:00.00)!');

    // 直接击毁第一关敌机以验证结算流转
    console.log('Defeating Stage 1 enemy...');
    await evalInPage(ws, `window.enemyTarget.takeDamage(999, window.freqMeter, performance.now()); window.physicsStep(window.FIXED_DT);`);
    await delay(1200);

    const stage1VictoryCheck = await evalInPage(ws, `(() => {
      const title = document.querySelector('#overlay-title')?.textContent;
      const btn = document.querySelector('#start-btn')?.textContent;
      const desc = document.querySelector('#overlay-desc')?.textContent;
      return { title, btn, desc };
    })()`);
    console.log('Stage 1 Victory Overlay Check:', stage1VictoryCheck);
    if (stage1VictoryCheck.title !== 'STAGE 1 CLEARED' || stage1VictoryCheck.btn !== '进入下一关') {
      throw new Error(`Unexpected Stage 1 Victory: ${JSON.stringify(stage1VictoryCheck)}`);
    }
    if (!stage1VictoryCheck.desc.includes('TIME:') || stage1VictoryCheck.desc.includes('00:00.00')) {
      throw new Error(`Stage 1 victory time is invalid: ${stage1VictoryCheck.desc}`);
    }
    console.log('✓ Stage 1 Victory shows "STAGE 1 CLEARED" and "进入下一关", timer is recorded correctly!');

    // 3. 点击进入第二关 (Stage 2)
    console.log('3. Entering Stage 2...');
    await evalInPage(ws, `document.querySelector('#start-btn').click()`);
    await delay(300);

    const stage2Check = await evalInPage(ws, `(() => {
      return {
        currentStage: window.currentStage,
        isBoss: window.enemyTarget && window.enemyTarget.phaseWeakpoints !== undefined,
        isRestricted: window.input.movementRestricted
      };
    })()`);
    console.log('Stage 2 Check:', stage2Check);
    if (stage2Check.currentStage !== '2-boss' || !stage2Check.isBoss) {
      throw new Error('Did not transition to 2-boss correctly!');
    }
    if (stage2Check.isRestricted) {
      throw new Error('Movement should NOT be restricted in Stage 2!');
    }
    console.log('✓ Stage 2 is ready, movement is unrestricted.');

    // 4. 测试第二关失败后是否循环回到第一关 (Entry 2: 偶数次)
    console.log('Simulating Defeat in Stage 2 to test loop back to Stage 1...');
    await evalInPage(ws, `window.player.takeDamage(999); window.physicsStep(window.FIXED_DT);`);
    await delay(400);

    const stage2DefeatCheck = await evalInPage(ws, `(() => {
      const title = document.querySelector('#overlay-title')?.textContent;
      const btn = document.querySelector('#start-btn')?.textContent;
      return { title, btn };
    })()`);
    console.log('Stage 2 Defeat Overlay:', stage2DefeatCheck);
    if (stage2DefeatCheck.title !== 'GAME OVER' || stage2DefeatCheck.btn !== '重新开始') {
      throw new Error(`Unexpected Defeat overlay: ${JSON.stringify(stage2DefeatCheck)}`);
    }

    // 点击重新开始 (此时应从第一关重新开始，且这是第 2 次进入第一关 -> 偶数次！)
    console.log('4. Restarting from Stage 2 Defeat -> Entering Stage 1 (Entry 2 - Even)...');
    await evalInPage(ws, `document.querySelector('#start-btn').click()`);
    await delay(300);

    const evenEntryCheck = await evalInPage(ws, `(() => {
      return {
        currentStage: window.currentStage,
        isRestricted: window.input.movementRestricted
      };
    })()`);
    console.log('Even Entry Check:', evenEntryCheck);
    if (evenEntryCheck.currentStage !== '1') {
      throw new Error(`Expected currentStage to be '1', got: ${evenEntryCheck.currentStage}`);
    }
    if (evenEntryCheck.isRestricted !== false) {
      throw new Error(`Even entry into Stage 1 must NOT be restricted! Got: ${evenEntryCheck.isRestricted}`);
    }

    // 模拟按 W 键，验证偶数次不出现“稍等”，且战机自由移动
    await sendCdp(ws, 'Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyW', key: 'w' });
    await delay(100);
    const evenPressCheck = await evalInPage(ws, `(() => {
      const toast = document.querySelector('#movement-locked-toast');
      const isToastVisible = toast && toast.style.display !== 'none' && toast.classList.contains('visible');
      return { isToastVisible };
    })()`);
    await sendCdp(ws, 'Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyW', key: 'w' });

    console.log('Even Entry Toast Check:', evenPressCheck);
    if (evenPressCheck.isToastVisible) {
      throw new Error('Toast "稍等" should NOT appear on even entry into Stage 1!');
    }
    console.log('✓ Stage 1 (Entry 2 - Even): No restriction! Player moves freely without toast!');

    // 5. 再次重开第一关 (Entry 3: 奇数次) 验证交替逻辑
    console.log('5. Triggering restart of Stage 1 to test Entry 3 (Odd)...');
    await evalInPage(ws, `window.player.takeDamage(999); window.physicsStep(window.FIXED_DT);`);
    await delay(400);
    await evalInPage(ws, `document.querySelector('#start-btn').click()`);
    await delay(300);

    const entry3Check = await evalInPage(ws, `(() => {
      return {
        currentStage: window.currentStage,
        isRestricted: window.input.movementRestricted
      };
    })()`);
    console.log('Entry 3 Check:', entry3Check);
    if (entry3Check.isRestricted !== true) {
      throw new Error(`Entry 3 must be restricted! Got: ${entry3Check.isRestricted}`);
    }
    console.log('✓ Stage 1 (Entry 3 - Odd): Restricted again as expected!');

    // 6. 验证第二关通关 (Victory) 后也会循环回到第一关
    console.log('6. Testing Stage 2 Victory loop back to Stage 1...');
    // 击败第一关
    await evalInPage(ws, `window.enemyTarget.takeDamage(999, window.freqMeter, performance.now()); window.physicsStep(window.FIXED_DT);`);
    await delay(1200);
    await evalInPage(ws, `document.querySelector('#start-btn').click()`);
    await delay(300);

    // 此时进入 Stage 2，直接击败 Boss
    console.log('Defeating Stage 2 Boss...');
    await evalInPage(ws, `window.enemyTarget.die(); window.physicsStep(window.FIXED_DT);`);
    await delay(1200);

    const stage2VictoryCheck = await evalInPage(ws, `(() => {
      const title = document.querySelector('#overlay-title')?.textContent;
      const btn = document.querySelector('#start-btn')?.textContent;
      return { title, btn };
    })()`);
    console.log('Stage 2 Victory Overlay:', stage2VictoryCheck);
    if (stage2VictoryCheck.title !== 'STAGE 2 CLEARED' || stage2VictoryCheck.btn !== '重新开始') {
      throw new Error(`Unexpected Stage 2 Victory overlay! Found: ${JSON.stringify(stage2VictoryCheck)}`);
    }

    // 点击重新开始 -> 验证回到第一关 (Entry 4: 偶数次)
    await evalInPage(ws, `document.querySelector('#start-btn').click()`);
    await delay(300);

    const entry4Check = await evalInPage(ws, `(() => {
      return {
        currentStage: window.currentStage,
        isRestricted: window.input.movementRestricted
      };
    })()`);
    console.log('Entry 4 Check (After Boss Victory):', entry4Check);
    if (entry4Check.currentStage !== '1' || entry4Check.isRestricted !== false) {
      throw new Error(`Expected Stage 1 with no restriction after Boss Victory! Got: ${JSON.stringify(entry4Check)}`);
    }
    console.log('✓ Stage 2 Victory successfully loops back to Stage 1 with Entry 4 (Even - unrestricted)!');

    console.log('\n========================================');
    console.log('🎉 ALL PRODUCTION FLOW & RESTRICTION TESTS PASSED PERFECTLY!');
    console.log('========================================\n');

    ws.close();
    chrome.kill();
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    chrome.kill();
    process.exit(1);
  }
}, 800);
