const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`[Browser Console ${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.log(`[Browser Uncaught Error] ${err.toString()}`);
  });

  page.on('requestfailed', request => {
    console.log(`[Browser Request Failed] ${request.url()} - ${request.failure().errorText}`);
  });

  console.log("Navigating to index.html...");
  await page.goto('file:///c:/Users/SERAT/Desktop/새 폴더 (2)/lotte/index.html', { waitUntil: 'networkidle0', timeout: 30000 });
  
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
  console.log("Done.");
})();
