// Requires Playwright and Chromium. Run: node scripts/test-schism-viewport.cjs
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
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try {
  browser=await chromium.launch({headless:true});
  for(const dpr of [1,2]) {
   const context=await browser.newContext({viewport:{width:1591,height:904},deviceScaleFactor:dpr});
   const page=await context.newPage();
   await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
   await page.locator('html.game-ready').waitFor({state:'attached',timeout:60000});
   const dimensions=()=>page.locator('#canvas').evaluate(c=>({width:c.width,height:c.height,fit:getComputedStyle(c).objectFit}));
   assert.deepEqual(await dimensions(),{width:800,height:648,fit:'contain'});
   await page.waitForTimeout(300);
   if(process.env.SCHISM_SCREENSHOT && dpr===1)await page.screenshot({path:process.env.SCHISM_SCREENSHOT});
   await page.setViewportSize({width:864,height:486});
   await page.waitForTimeout(150);
   assert.deepEqual(await dimensions(),{width:800,height:648,fit:'contain'},'resizing must scale the same world view');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await context.close();
   console.log(`PASS: consistent desktop game viewport at DPR ${dpr}, large and small windows.`);
  }
 }finally{if(browser)await browser.close();server.closeAllConnections();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
