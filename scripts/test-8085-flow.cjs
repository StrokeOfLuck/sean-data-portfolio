// Run with node scripts/test-8085-flow.cjs. No browser or dependencies required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const asset = name => path.join(root, 'projects/assets/8085-assembly', name);
const page = fs.readFileSync(path.join(root, 'projects/8085-assembly.qmd'), 'utf8');
const nodes = [...page.matchAll(/data-flow-node="([^"]+)"/g)].map(m => m[1]);
const edges = new Set([...page.matchAll(/data-flow-from="([^"]+)" data-flow-to="([^"]+)"/g)].map(m => `${m[1]}:${m[2]}`));
// Isolate the existing interpreter and instruction-to-diagram mapping from rendering.
let script = fs.readFileSync(asset('8085-project-v3.js'), 'utf8');
script = script.slice(0, script.indexOf('  function render()')) + '  function render() {}\n';
script += '\n globalThis.test = {parseSource, resetState, executeStep, current: () => flowNodeForInstruction(program[state.pc]), state: () => state};\n})();';
const input = { value: '25' };
const noop = { textContent: '', setAttribute() {} };
const context = { document: { querySelector: () => ({ dataset: {}, querySelector: selector => selector === '[data-assembly-input]' ? input : noop }) }, window: { clearInterval() {} } };
vm.createContext(context);
vm.runInContext(script, context);
const sim = context.test;
sim.parseSource(fs.readFileSync(asset('project-to-standard.asm'), 'utf8'));
const coverage = new Set();
for (let celsius = 0; celsius <= 37; celsius++) {
  input.value = String(celsius);
  sim.resetState();
  const route = [sim.current()];
  while (!sim.state().halted && sim.state().count < 500) {
    sim.executeStep();
    const current = sim.current();
    assert.ok(nodes.includes(current), `Missing diagram node ${current}`);
    if (route.at(-1) !== current) {
      const edge = `${route.at(-1)}:${current}`;
      assert.ok(edges.has(edge), `${celsius}°C has no drawn connection for ${edge}`);
      coverage.add(edge);
      route.push(current);
    }
  }
  const state = sim.state();
  assert.ok(state.halted, `${celsius}°C did not halt`);
  const bcd = state.memory[0x2001];
  assert.ok((bcd & 15) <= 9 && (bcd >> 4) <= 9, 'Invalid BCD');
  assert.equal((bcd >> 4) * 10 + (bcd & 15), Math.round(celsius * 9 / 5 + 32));
  if (celsius === 0) assert.deepEqual(route, ['load','zero-check','zero-store','halt']);
  else {
    assert.equal(route.includes('divide'), celsius >= 5);
    for (let r = 1; r <= 4; r++) assert.equal(route.includes(`save-${r}`), celsius % 5 === r);
  }
}
for (const edge of edges) if (edge !== 'start:load') assert.ok(coverage.has(edge), `Uncovered connection ${edge}`);
console.log('PASS: all 38 inputs produce correct BCD, halt, and follow drawn branches; every executable connection covered.');
