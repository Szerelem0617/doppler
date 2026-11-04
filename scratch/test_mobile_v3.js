import { spawn } from 'child_process';
import fs from 'fs';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const cdpPort = 9370;

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${cdpPort}`,
  '--no-sandbox',
  '--disable-gpu',
  '--disable-extensions',
  '--user-data-dir=/tmp/cdp-test-profile-' + Date.now(),
  '--window-size=393,852',
  '--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
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
  return res.result ? res.result.value : res;
}

async function connectWithRetry(retries = 15, interval = 300) {
  for (let i = 0; i < retries; i++) {
    try {
      const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json`);
      const pages = await listRes.json();
      const pageTarget = pages.find(p => p.type === 'page') || pages[0];
      if (pageTarget && pageTarget.webSocketDebuggerUrl) {
        return pageTarget.webSocketDebuggerUrl;
      }
    } catch (e) {}
    await delay(interval);
  }
  throw new Error('Failed to connect to Chrome CDP after retries');
}

(async () => {
  try {
    const wsUrl = await connectWithRetry();
    const ws = new WebSocket(wsUrl);
    await new Promise(r => { ws.onopen = r; });

    await sendCdp(ws, 'Runtime.enable');
    await sendCdp(ws, 'Page.enable');

    console.log('[TEST] Navigating to http://localhost:5174/ ...');
    await sendCdp(ws, 'Page.navigate', { url: 'http://localhost:5174/' });
    await delay(2000);

    // ==========================================
    // TEST 1: 开局自由移动验证 (死限制已移除)
    // ==========================================
    console.log('\n[TEST 1] Verifying Stage 1 Start Movement Freedom (死限制已移除)...');
    await evalInPage(ws, `
      (() => {
        window.tas.ctx.switchStage('1');
        window.tas.ctx.startGame();
      })()
    `);
    await delay(300);

    const initialStage1 = await evalInPage(ws, `
      ({
        stage: window.currentStage,
        shieldIntact: !window.enemyTarget.shield.isBroken,
        movementRestricted: window.input.movementRestricted,
        playerPos: { x: window.player.x, y: window.player.y }
      })
    `);
    console.log('Stage 1 initial state before shield break:', initialStage1);

    if (initialStage1.movementRestricted) {
      throw new Error('Input is still restricted at stage 1 start!');
    }

    // Now push virtual joystick right BEFORE shield break
    console.log('Simulating pushing joystick right while shield is 100% intact...');
    await evalInPage(ws, `
      (() => {
        const zone = document.getElementById('mobile-joystick-zone');
        const touch = new Touch({ identifier: 301, target: zone, clientX: 120, clientY: 720 });
        zone.dispatchEvent(new TouchEvent('touchstart', { touches: [touch], changedTouches: [touch], bubbles: true, cancelable: true }));
        const moveTouch = new Touch({ identifier: 301, target: zone, clientX: 160, clientY: 720 });
        window.dispatchEvent(new TouchEvent('touchmove', { touches: [moveTouch], changedTouches: [moveTouch], bubbles: true, cancelable: true }));
      })()
    `);
    for (let i = 0; i < 20; i++) {
      await evalInPage(ws, `window.physicsStep(window.FIXED_DT)`);
    }

    const movedStage1 = await evalInPage(ws, `
      ({
        x: window.player.x,
        vx: window.player.vx,
        toastVisible: document.getElementById('movement-locked-toast') && getComputedStyle(document.getElementById('movement-locked-toast')).display !== 'none'
      })
    `);
    console.log('Player movement state during early Stage 1:', movedStage1);

    if (movedStage1.vx <= 0 || movedStage1.x <= initialStage1.playerPos.x) {
      throw new Error('Player failed to move right at stage 1 start! Movement restriction is still active!');
    }
    if (movedStage1.toastVisible) {
      throw new Error('"稍等" toast appeared! Movement lock was supposed to be completely removed!');
    }
    console.log('✓ VERIFIED: Player moves freely at stage 1 start with zero restrictions or lock toast!');

    // Release joystick
    await evalInPage(ws, `
      (() => {
        const zone = document.getElementById('mobile-joystick-zone');
        const endTouch = new Touch({ identifier: 301, target: zone, clientX: 0, clientY: 0 });
        window.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [endTouch], bubbles: true }));
      })()
    `);

    // ==========================================
    // TEST 2: 第一关打破护盾后的提示（手机端只用摇杆和按钮提示）
    // ==========================================
    console.log('\n[TEST 2] Verifying Stage 1 Shield-Broken Prompt (手机端纯摇杆与闪现按钮图示)...');
    // Trigger shield break
    await evalInPage(ws, `
      (() => {
        window.enemyTarget.shield.isBroken = true;
        window.enemyTarget.shield.justBroken = true;
        window.enemyTarget.shield.hp = 0;
        window.physicsStep(window.FIXED_DT);
      })()
    `);
    await delay(300);

    const promptCheck = await evalInPage(ws, `
      (() => {
        const prompt = document.getElementById('freeze-prompt');
        const desktopGuide = document.querySelector('.freeze-desktop-guide');
        const mobileGuide = document.querySelector('.freeze-mobile-guide');
        const joystickIllu = document.querySelector('.freeze-illu-box.joystick-illu');
        const btnIllu = document.querySelector('.freeze-illu-box.btn-illu');
        const desktopTip = document.querySelector('.freeze-desktop-tip');
        const mobileTip = document.querySelector('.freeze-mobile-tip');

        return {
          isTimeFrozen: window.isTimeFrozen,
          promptDisplay: getComputedStyle(prompt).display,
          desktopGuideDisplay: getComputedStyle(desktopGuide).display,
          mobileGuideDisplay: getComputedStyle(mobileGuide).display,
          hasJoystickIllu: !!joystickIllu,
          hasBtnIllu: !!btnIllu,
          desktopTipDisplay: getComputedStyle(desktopTip).display,
          mobileTipDisplay: getComputedStyle(mobileTip).display,
          mobileTipText: mobileTip ? mobileTip.textContent.trim() : ''
        };
      })()
    `);
    console.log('Freeze prompt state on mobile screen:', promptCheck);

    if (promptCheck.promptDisplay === 'none') {
      throw new Error('Freeze prompt did not display on shield break!');
    }
    if (promptCheck.desktopGuideDisplay !== 'none') {
      throw new Error(`Desktop keyboard guide is visible on mobile (display: ${promptCheck.desktopGuideDisplay})! Should be hidden!`);
    }
    if (promptCheck.mobileGuideDisplay === 'none') {
      throw new Error('Mobile guide is NOT visible on mobile!');
    }
    if (!promptCheck.hasJoystickIllu || !promptCheck.hasBtnIllu) {
      throw new Error('Joystick or Button illustration element is missing from mobile prompt!');
    }
    console.log('✓ VERIFIED: Shield-break prompt on mobile shows ONLY joystick & action button illustrations, keyboard WASD is completely hidden!');

    // Capture screenshot of mobile shield break prompt
    const ssPrompt = await sendCdp(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/Users/feng/.gemini/antigravity/brain/f5ab6a17-68be-44e9-b0bf-8f6424d8925b/mobile_shield_break_prompt.png', Buffer.from(ssPrompt.data, 'base64'));
    console.log('Saved prompt screenshot to mobile_shield_break_prompt.png');

    // Dismiss freeze prompt by tapping blink
    await evalInPage(ws, `
      (() => {
        const btn = document.getElementById('mobile-blink-btn');
        btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      })()
    `);
    await evalInPage(ws, `window.physicsStep(window.FIXED_DT)`);

    // ==========================================
    // TEST 3: 闪现 MOBA 式充能视觉提示 (英雄联盟 / 王者荣耀风)
    // ==========================================
    console.log('\n[TEST 3] Verifying MOBA-style Cooldown & Charging Visuals (类似王者荣耀/LOL充能)...');
    
    // Now trigger blink to start 5s cooldown
    await evalInPage(ws, `
      (() => {
        window.input.triggerBlink();
        window.physicsStep(window.FIXED_DT);
        window.updateHUD();
      })()
    `);
    await delay(120);

    const cdActiveState = await evalInPage(ws, `
      (() => {
        const btn = document.getElementById('mobile-blink-btn');
        const sweep = document.getElementById('blink-cd-sweep');
        const ringBar = document.getElementById('blink-charge-ring-bar');
        const cdText = document.getElementById('blink-cd-text');

        return {
          blinkCdTimer: window.player.blinkCdTimer,
          isCoolingClass: btn.classList.contains('cooling'),
          isReadyClass: btn.classList.contains('ready'),
          cdDeg: btn.style.getPropertyValue('--cd-deg'),
          cdText: cdText ? cdText.textContent.trim() : '',
          ringDashOffset: ringBar ? ringBar.style.strokeDashoffset : '',
          sweepVisible: sweep && getComputedStyle(sweep).opacity > 0.5
        };
      })()
    `);
    console.log('Blink button charging state immediately after blink:', cdActiveState);

    if (cdActiveState.blinkCdTimer <= 0) {
      throw new Error('Blink cooldown was not activated!');
    }
    if (!cdActiveState.isCoolingClass) {
      throw new Error('Blink button does not have .cooling class during cooldown!');
    }
    if (!cdActiveState.sweepVisible) {
      throw new Error('MOBA conic sweep overlay is not visible during cooldown!');
    }
    if (!cdActiveState.cdDeg) {
      throw new Error('--cd-deg CSS custom property not set on blink button!');
    }
    if (!cdActiveState.cdText.includes('s')) {
      throw new Error(`CD countdown text missing seconds format: "${cdActiveState.cdText}"`);
    }
    console.log(`✓ VERIFIED: Active cooldown visual verified! Radial sweep deg: ${cdActiveState.cdDeg}, Ring offset: ${cdActiveState.ringDashOffset}, CD text: ${cdActiveState.cdText}`);

    // Capture screenshot during charging
    const ssCharge = await sendCdp(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/Users/feng/.gemini/antigravity/brain/f5ab6a17-68be-44e9-b0bf-8f6424d8925b/mobile_blink_charging.png', Buffer.from(ssCharge.data, 'base64'));
    console.log('Saved charging screenshot to mobile_blink_charging.png');

    // Fast-forward physics to charge completion (5 seconds)
    console.log('Fast-forwarding physics past 5.0s cooldown to test ready burst...');
    for (let i = 0; i < 310; i++) {
      await evalInPage(ws, `window.physicsStep(window.FIXED_DT)`);
    }
    await evalInPage(ws, `window.updateHUD()`);

    const cdReadyState = await evalInPage(ws, `
      (() => {
        const btn = document.getElementById('mobile-blink-btn');
        const cdText = document.getElementById('blink-cd-text');
        const ringBar = document.getElementById('blink-charge-ring-bar');

        return {
          blinkCdTimer: window.player.blinkCdTimer,
          isCoolingClass: btn.classList.contains('cooling'),
          isReadyClass: btn.classList.contains('ready'),
          cdText: cdText ? cdText.textContent.trim() : '',
          ringDashOffset: ringBar ? ringBar.style.strokeDashoffset : ''
        };
      })()
    `);
    console.log('Blink button state after charge completion:', cdReadyState);

    if (cdReadyState.blinkCdTimer > 0 || cdReadyState.isCoolingClass || !cdReadyState.isReadyClass) {
      throw new Error('Blink button did not return to READY state after cooldown finished!');
    }
    if (cdReadyState.cdText !== '') {
      throw new Error(`CD text should be empty when ready, got: "${cdReadyState.cdText}"`);
    }
    console.log('✓ VERIFIED: Cooldown completed! Button seamlessly returned to READY state with flash burst!');

    console.log('\n🎉 ALL 3 USER REQUIREMENTS VERIFIED PERFECTLY!');
    ws.close();
    chrome.kill();
    process.exit(0);
  } catch (err) {
    console.error('Test execution failed:', err);
    chrome.kill();
    process.exit(1);
  }
})();
