import { spawn } from 'child_process';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9334;

const chrome = spawn(chromePath, [
  '--headless',
  `--remote-debugging-port=${port}`,
  '--no-sandbox',
  '--disable-gpu',
  'about:blank'
]);

setTimeout(async () => {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json`);
    const pages = await listRes.json();
    const wsUrl = pages[0].webSocketDebuggerUrl;

    const ws = new WebSocket(wsUrl);

    let step = 0;
    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));
      ws.send(JSON.stringify({ id: 3, method: 'Page.navigate', params: { url: 'http://localhost:5173/' } }));
    };

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Page.loadEventFired') {
        setTimeout(() => {
          // Check cards in DOM and click card 1
          ws.send(JSON.stringify({
            id: 10,
            method: 'Runtime.evaluate',
            params: {
              expression: `(() => {
                const cards = document.querySelectorAll('.mission-card');
                const hub = document.getElementById('mission-hub');
                const overlay = document.getElementById('game-overlay');
                const cardsCount = cards.length;
                // Click 2-boss card (index 6)
                if (cards[6]) cards[6].click();
                return {
                  cardsCount,
                  hubDisplay: hub.style.display,
                  hubHidden: hub.classList.contains('hidden'),
                  overlayHidden: overlay.classList.contains('hidden'),
                  currentStage: window.currentStage || 'unknown'
                };
              })()`,
              returnByValue: true
            }
          }));
        }, 500);
      }

      if (msg.id === 10) {
        console.log('Evaluate result after click:', msg.result.result.value);
        ws.close();
        chrome.kill();
        process.exit(0);
      }
    };
  } catch (err) {
    console.error('Test error:', err);
    chrome.kill();
    process.exit(1);
  }
}, 1000);
