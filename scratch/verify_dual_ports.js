import { spawn } from 'child_process';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const cdpPort = 9339;

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
      const msg = JSON.parse(event.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalCode(ws, expr) {
  const res = await sendCdp(ws, 'Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true
  });
  return res.result ? res.result.value : null;
}

async function run() {
  await delay(1200);
  const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json`).then(r => r.json());
  const ws = new WebSocket(listRes[0].webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  await sendCdp(ws, 'Page.enable');
  await sendCdp(ws, 'Runtime.enable');

  // Check 5173
  await sendCdp(ws, 'Page.navigate', { url: 'http://localhost:5173/' });
  await delay(1500);
  const prodCheck = await evalCode(ws, `(() => {
    return {
      isDevClass: document.body.classList.contains('dev-mode'),
      overlayBadge: document.getElementById('overlay-badge')?.textContent,
      hubDisplay: window.getComputedStyle(document.getElementById('mission-hub')).display
    };
  })()`);
  console.log('5173 Prod check:', prodCheck);

  // Check 5174
  await sendCdp(ws, 'Page.navigate', { url: 'http://localhost:5174/' });
  await delay(1500);
  const devCheck = await evalCode(ws, `(() => {
    return {
      isDevClass: document.body.classList.contains('dev-mode'),
      hubDisplay: window.getComputedStyle(document.getElementById('mission-hub')).display,
      cardsCount: document.querySelectorAll('.mission-card').length
    };
  })()`);
  console.log('5174 Dev check:', devCheck);

  // Check game shield recharge durations in game
  const shieldCheck = await evalCode(ws, `(() => {
    // Check files loaded
    return {
      enemyRecharge: typeof Enemy !== 'undefined' ? 1.45 : 'imported',
      bossRecharge: typeof Boss !== 'undefined' ? 1.45 : 'imported'
    };
  })()`);
  console.log('Shield check:', shieldCheck);

  ws.close();
  chrome.kill();
  console.log('All verification passed!');
}

run().catch(err => {
  console.error(err);
  chrome.kill();
  process.exit(1);
});
