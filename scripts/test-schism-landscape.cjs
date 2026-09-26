// Render projects/game-design-sandbox.qmd first. Requires Playwright and Chromium.
// Run: node scripts/test-schism-landscape.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../_site');
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
  const url = `http://127.0.0.1:${server.address().port}/projects/game-design-sandbox.html`;
  for (const fallback of [false, true]) {
   const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
   await context.addInitScript(fallback => {
    window.orientationRequests = []; window.unlockCount = 0;
    Object.defineProperty(screen.orientation, 'lock', {value: async direction => {
     orientationRequests.push(direction);
     if (fallback) throw new DOMException('Unsupported','NotSupportedError');
    }});
    Object.defineProperty(screen.orientation, 'unlock', {value: () => { unlockCount++; }});
    if (fallback) Object.defineProperty(Element.prototype, 'requestFullscreen', {value: undefined});
   }, fallback);
   const page = await context.newPage();
   const errors = []; page.on('pageerror', e => errors.push(e.message));
   await page.goto(url);
   const mode = page.locator('[data-landscape-mode]');
   assert.equal(await mode.textContent(),'Play side by side ↔');
   await mode.click();
   await page.waitForFunction(()=>orientationRequests.length === 1);
   assert.deepEqual(await page.evaluate(()=>orientationRequests),['landscape']);
   assert.equal(await page.evaluate(()=>!!document.fullscreenElement),!fallback);
   assert.equal(await mode.getAttribute('aria-pressed'),'true');
   assert.match(await page.locator('[data-landscape-hint]').textContent(), /Turn your phone sideways/);
   const game = page.frameLocator('[data-game-frame]');
   await game.locator('html.game-ready').waitFor({state:'attached',timeout:60000});
   const client = await context.newCDPSession(page);
   await client.send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true,screenOrientation:{type:'landscapePrimary',angle:90}});
   await page.waitForTimeout(250);
   assert.match(await page.locator('[data-landscape-hint]').textContent(),/Kiki on the left/);
   const geometry = await game.locator('#canvas').evaluate(canvas => {
    const c=canvas.getBoundingClientRect();const pads=[...document.querySelectorAll('.touch-pad')].map(e=>e.getBoundingClientRect());
    return {separate:pads[0].right<=c.left && pads[1].left>=c.right,visible:pads.every(r=>r.top>=0&&r.bottom<=innerHeight)};
   });
   assert.deepEqual(geometry,{separate:true,visible:true});
   if (process.env.SCHISM_SCREENSHOT) {
    const shot=await client.send('Page.captureScreenshot',{format:'png'});
    await fs.writeFile(process.env.SCHISM_SCREENSHOT,Buffer.from(shot.data,'base64'));
   }
   const originalSrc = await page.locator('[data-game-frame]').getAttribute('src');
   await mode.click();
   await page.waitForFunction(()=>!document.fullscreenElement);
   assert.equal(await mode.getAttribute('aria-pressed'),'false');
   assert.equal(await page.locator('[data-game-frame]').getAttribute('src'),originalSrc,'leaving mode preserves the running game');
   assert.equal(await page.evaluate(()=>document.body.classList.contains('side-by-side-open')),false);
   assert.ok(await page.evaluate(()=>unlockCount>0));
   await mode.click();
   await page.waitForFunction(()=>orientationRequests.length === 2);
   if (fallback) await page.locator('[data-close]').click();
   else await page.evaluate(()=>document.exitFullscreen());
   await page.waitForFunction(()=>document.querySelector('[data-landscape-mode]').getAttribute('aria-pressed')==='false');
   if (fallback) assert.equal(await page.locator('[data-game-frame]').getAttribute('src'),null);
   assert.deepEqual(errors,[]);
   console.log(`PASS: ${fallback?'unsupported browser fallback':'fullscreen + orientation request'}, layout, exit, and cleanup`);
   await context.close();
  }
 } finally { if(browser) await browser.close(); server.closeAllConnections();server.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
