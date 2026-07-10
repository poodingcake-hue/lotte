const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('c:/Users/SERAT/Desktop/새 폴더 (2)/lotte/index.html', 'utf-8');
const dataJson = JSON.parse(fs.readFileSync('c:/Users/SERAT/Desktop/새 폴더 (2)/lotte/data.json', 'utf-8').replace(/^\uFEFF/,''));
const backendJson = JSON.parse(fs.readFileSync('c:/Users/SERAT/Desktop/새 폴더 (2)/lotte/backend.json', 'utf-16le').replace(/^\uFEFF/,''));

const virtualConsole = new jsdom.VirtualConsole();

const dom = new JSDOM(html, { 
    runScripts: "dangerously", 
    virtualConsole,
    url: "file:///c:/Users/SERAT/Desktop/새 폴더 (2)/lotte/index.html",
    beforeParse(window) {
        window.history.replaceState = () => {};
        window.history.pushState = () => {};
        window.fetch = async (url) => {
            if (url.includes('data.json')) return { ok: true, json: async () => dataJson };
            if (url.includes('action=getAll')) return { ok: true, json: async () => backendJson };
            return { ok: true, json: async () => ({}) };
        };
    }
});

setTimeout(() => {
    const scroller = dom.window.document.getElementById("dateScroller");
    const container = dom.window.document.getElementById("scheduleContainer");
    console.log("dateScroller HTML length:", scroller ? scroller.innerHTML.length : "null");
    console.log("scheduleContainer HTML length:", container ? container.innerHTML.length : "null");
}, 2000);
