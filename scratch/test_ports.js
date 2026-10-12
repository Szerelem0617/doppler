import puppeteer from 'puppeteer';

async function verify() {
  const browser = await puppeteer.launch({ headless: 'new' });
  try {
    // 1. Verify Port 5173 (Production Mode)
    const pageProd = await browser.newPage();
    await pageProd.goto('http://localhost:5173/');
    await pageProd.waitForSelector('#game-overlay');
    const isProdOn5173 = await pageProd.evaluate(() => {
      const isDevModeClass = document.body.classList.contains('dev-mode');
      const overlayBadge = document.getElementById('overlay-badge')?.textContent;
      const overlayTitle = document.getElementById('overlay-title')?.textContent;
      const hubDisplay = window.getComputedStyle(document.getElementById('mission-hub')).display;
      return { isDevModeClass, overlayBadge, overlayTitle, hubDisplay };
    });
    console.log('Port 5173 (Production):', isProdOn5173);

    // 2. Verify Port 5174 (Development Mode)
    const pageDev = await browser.newPage();
    await pageDev.goto('http://localhost:5174/');
    await pageDev.waitForSelector('#mission-hub');
    const isDevOn5174 = await pageDev.evaluate(() => {
      const isDevModeClass = document.body.classList.contains('dev-mode');
      const hubDisplay = window.getComputedStyle(document.getElementById('mission-hub')).display;
      const cards = document.querySelectorAll('.mission-card').length;
      return { isDevModeClass, hubDisplay, cards };
    });
    console.log('Port 5174 (Development):', isDevOn5174);

    // 3. Verify Recharge Duration in Game (1.45s)
    const rechargeDurations = await pageProd.evaluate(() => {
      // Create instances to check their config
      return {
        // Will check in window if exposed or verify via code
      };
    });

  } finally {
    await browser.close();
  }
}

verify().catch(console.error);
