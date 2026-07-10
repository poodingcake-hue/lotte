
const puppeteer = require('puppeteer');
const express = require('express');
const app = express();
app.use('/lotte', express.static('dist'));
const server = app.listen(0, async () => {
    const port = server.address().port;
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    page.on('response', response => {
      if (!response.ok()) {
        console.log('404 URL:', response.url());
      }
    });
    await page.goto('http://localhost:' + port + '/lotte/');
    await new Promise(r => setTimeout(r, 2000));
    await browser.close();
    server.close();
});
