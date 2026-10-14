import { spawn } from 'child_process';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const cdpPort = 9365;

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
  return res.result ? res.result.value : res;
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

    console.log('Navigating to http://localhost:5174/?dev ...');
    await sendCdp(ws, 'Page.navigate', { url: 'http://localhost:5174/?dev' });
    await delay(1200);

    // Mock API returning kvBound: false (simulating Cloudflare Pages without KV bound)
    console.log('\n[SIMULATION] Intercepting /api/leaderboard to return kvBound: false...');
    await evalInPage(ws, `
      window.LEADERBOARD_API_URL = '/mock-unbound-api';
      // Mock fetch
      const origFetch = window.fetch;
      window.fetch = async (url, opts) => {
        if (String(url).includes('leaderboard') || String(url).includes('mock-unbound-api')) {
          return new Response(JSON.stringify({
            total: 0,
            items: [],
            kvBound: false,
            warning: 'GAME_KV 未在 Cloudflare 后台绑定'
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return origFetch(url, opts);
      };
      // Reset pilot
      localStorage.removeItem('doppler_pilot_name');
      localStorage.removeItem('doppler_leaderboard_cache');
    `);

    // 1. Submit score with pilot name "Phoenix_One"
    console.log('\nSubmitting score for "Phoenix_One" with clearTime: 14.250...');
    const submitRes = await evalInPage(ws, `
      (async () => {
        const { leaderboard } = await import('/src/game/Leaderboard.js');
        const res = await leaderboard.submitScore('Phoenix_One', 14.250);
        return {
          rank: res.rank,
          total: res.total,
          savedPilot: localStorage.getItem('doppler_pilot_name')
        };
      })()
    `);
    console.log('Submit Result:', submitRes);

    // 2. Open Leaderboard modal
    console.log('\nOpening Leaderboard modal and checking if "Phoenix_One" is visible in table...');
    const modalCheck = await evalInPage(ws, `
      (async () => {
        const { leaderboard } = await import('/src/game/Leaderboard.js');
        await leaderboard.openModal();
        await new Promise(r => setTimeout(r, 400));

        const myRow = document.querySelector('.lb-row.is-me');
        const rows = Array.from(document.querySelectorAll('#lb-table-body tr')).map(r => r.innerText.replace(/\\n/g, ' | '));
        const cloudTag = document.getElementById('lb-cloud-tag');

        return {
          hasMyRow: Boolean(myRow),
          myRowText: myRow ? myRow.innerText.replace(/\\n/g, ' | ') : null,
          allRows: rows,
          cloudTagText: cloudTag ? cloudTag.innerText : null
        };
      })()
    `);
    console.log('Modal display check:', modalCheck);

    if (!modalCheck.hasMyRow) {
      throw new Error('FAILED: "Phoenix_One" is NOT visible in the table after submission!');
    }

    console.log('\n✓ VERIFIED: Record is 100% visible in the table even when Cloudflare KV is not bound!');
    ws.close();
    chrome.kill();
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    chrome.kill();
    process.exit(1);
  }
}, 800);
