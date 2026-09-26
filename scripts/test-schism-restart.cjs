// Render projects/game-design-sandbox.qmd first. Requires Playwright and Chromium.
// Run: node scripts/test-schism-restart.cjs
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
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try {
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:844,height:600},isMobile:true,hasTouch:true});
  const logs=[];const errors=[];
  page.on('console',msg=>logs.push(msg.text()));page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/projects/game-design-sandbox.html`);
  const restart=page.locator('[data-restart]');
  assert.equal(await restart.textContent(),'Restart level');
  assert.equal(await restart.isDisabled(),true);
  await page.locator('[data-game-launch]').click();
  const frame=page.frameLocator('[data-game-frame]');
  await frame.locator('html.game-ready').waitFor({state:'attached',timeout:60000});
  await page.waitForFunction(()=>!document.querySelector('[data-restart]').disabled);
  const game=page.frames().find(f=>f.url().includes('/play/index.html'));
  await game.evaluate(()=>{
   window.resetTestMarker='same running game';window.resetKeys=[];
   for(const type of ['keydown','keyup']) document.getElementById('canvas').addEventListener(type,e=>{if(e.code==='KeyR')resetKeys.push(type);});
  });
  // Move a character away from the starting point before asking Godot to reset.
  await frame.locator('#canvas').focus();
  await page.keyboard.down('ArrowLeft');await page.waitForTimeout(450);await page.keyboard.up('ArrowLeft');
  let navigations=0;page.on('framenavigated',f=>{if(f===game)navigations++;});
  await restart.click();
  await page.waitForTimeout(500);
  assert.equal(await game.evaluate(()=>resetTestMarker),'same running game');
  assert.equal(navigations,0,'level restart must not reload the iframe');
  assert.deepEqual(await game.evaluate(()=>resetKeys),['keydown','keyup']);
  const resets=logs.filter(x=>/Resetting to section:|Reset player:/.test(x));
  assert.ok(resets.some(x=>x.includes('Resetting to section:')),'Godot must execute its reset manager');
  assert.ok(resets.some(x=>x.includes('Player Black')));
  assert.ok(resets.some(x=>x.includes('Player White')));
  console.log(resets.join('\n'));
  await restart.click();await page.waitForTimeout(250);
  assert.equal(navigations,0);
  assert.equal(await restart.isEnabled(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: original Godot level reset, both players reset, key released, no iframe reload, repeat restart.');
 } finally {if(browser)await browser.close();server.closeAllConnections();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
