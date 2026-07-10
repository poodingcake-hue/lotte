
const puppeteer = require('puppeteer');
const express = require('express');
const app = express();
app.use(express.static('dist'));
const server = app.listen(0, async () => {
    const port = server.address().port;
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    await page.goto(http://localhost:/lotte/);
    await browser.close();
    server.close();
});
