// Requires Playwright and Chromium. Run: node scripts/test-schism-touch.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../projects/assets/game-design-sandbox/play');
const server = http.createServer(async (req, res) => {
 const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
 if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
 try {
  const body = await fs.readFile(file);
  res.setHeader('Content-Type', ({'.wasm':'application/wasm','.js':'text/javascript','.css':'text/css','.html':'text/html'})[path.extname(file)] || 'application/octet-stream');
  res.end(body);
 } catch { res.writeHead(404).end(); }
});
(async () => {
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 let browser;
 try {
  browser = await chromium.launch({headless:true});
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const context = await browser.newContext({viewport:{width:390,height:380},isMobile:true,hasTouch:true});
  const page = await context.newPage();
  await page.goto(url);
  await page.locator('html.game-ready').waitFor({state:'attached',timeout:60000});
  assert.equal(await page.locator('.touch-key:visible').count(), 8);
  await page.evaluate(() => {
   window.inputLog = [];
   for (const type of ['keydown','keyup']) document.getElementById('canvas').addEventListener(type, e => inputLog.push(`${type}:${e.code}`));
  });
  const client = await context.newCDPSession(page);
  const point = async (code, id) => {
   const box = await page.locator(`[data-code="${code}"]`).boundingBox();
   return {x:box.x+box.width/2,y:box.y+box.height/2,id};
  };
  const right = await point('KeyD',1), jump = await point('KeyW',2), left = await point('ArrowLeft',3);
  await client.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[right,jump,left]});
  assert.equal(await page.locator('.is-held').count(),3,'move + jump + second player');
  assert.deepEqual(await page.evaluate(()=>inputLog),['keydown:KeyD','keydown:KeyW','keydown:ArrowLeft']);
  await client.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[jump]});
  assert.equal(await page.locator('.is-held').count(),2,'releasing jump must preserve both movement inputs');
  await client.send('Input.dispatchTouchEvent', {type:'touchCancel',touchPoints:[]});
  assert.equal(await page.locator('.is-held').count(),0);
  assert.deepEqual((await page.evaluate(()=>inputLog.filter(e=>e.startsWith('keyup:')))).sort(),['keyup:ArrowLeft','keyup:KeyD','keyup:KeyW']);
  await client.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[right]});
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  assert.equal(await page.locator('.is-held').count(),0,'blur releases movement');
  await client.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
  await page.setViewportSize({width:844,height:284});
  const layout = await page.evaluate(() => {
   const c=document.getElementById('canvas').getBoundingClientRect();
   const pads=[...document.querySelectorAll('.touch-pad')].map(e=>e.getBoundingClientRect());
   return {overlap:pads[0].right>c.left || pads[1].left<c.right,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert.deepEqual(layout,{overlap:false,overflow:false});
  await context.close();
  const desktop = await browser.newContext({viewport:{width:1152,height:648}});
  const desktopPage = await desktop.newPage(); await desktopPage.goto(url);
  await desktopPage.locator('html.game-ready').waitFor({state:'attached',timeout:60000});
  assert.equal(await desktopPage.locator('.touch-controls').evaluate(e=>getComputedStyle(e).display),'none');
  await desktop.close();
  console.log('PASS: simultaneous input, independent release, cancellation, blur, landscape layout, desktop controls.');
 } finally { if (browser) await browser.close(); server.closeAllConnections(); server.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });

