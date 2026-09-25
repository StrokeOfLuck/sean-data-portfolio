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
script += '\n globalThis.test = {parseSource, resetState, executeStep, transferHtml, flowValues, instructionLessons, displayedInstruction, current: () => flowNodeForInstruction(displayedInstruction()), state: () => state};\n})();';
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
  assert.equal(sim.flowValues().divide, 'Waiting for division');
  assert.equal(sim.flowValues().multiply, 'Waiting for multiplication');
  assert.equal(sim.flowValues().adjustment, 'Waiting for remainder');
  const route = [sim.current()];
  while (!sim.state().halted && sim.state().count < 500) {
    sim.executeStep();
    const entry = sim.state().history.at(-1);
    const values = sim.flowValues();
    assert.ok(!/undefined|NaN/.test(JSON.stringify(values)));
    if (entry.line.flowNode === 'divide') {
      assert.equal(values.divide, `C ${sim.state().registers.C} · A ${sim.state().registers.A} remaining`);
    }
    if (entry.line.flowNode === 'multiply' && entry.line.op === 'ADD') {
      assert.ok(values.multiply.endsWith('awaiting DAA'));
    }
    assert.equal(sim.displayedInstruction().sourceIndex, sim.state().history.at(-1).line.sourceIndex, 'Highlight must match the executed instruction, including jumps and calls');
    const transfer = sim.transferHtml(sim.state().history.at(-1));
    assert.ok(sim.instructionLessons[sim.state().history.at(-1).line.op]?.how, 'Every executed instruction needs a teaching explanation');
    assert.ok(!/undefined|NaN|not written/.test(transfer), `Invalid transfer display: ${transfer}`);
    assert.ok(transfer.includes('→'), 'Transfer display needs a direction');
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
input.value = '25';
sim.resetState();
sim.executeStep();
let trace = sim.state().history.at(-1);
assert.equal(trace.writes.HL.before, 0);
assert.equal(trace.writes.HL.after, 0x2000);
sim.executeStep();
trace = sim.state().history.at(-1);
assert.equal(trace.reads['2000h'], 25);
assert.equal(trace.reads.HL, 0x2000);
assert.equal(trace.writes.A.before, 0);
assert.equal(trace.writes.A.after, 25);
while (!sim.state().halted) sim.executeStep();
trace = sim.state().history.find(entry => Object.hasOwn(entry.writes, '2001h'));
assert.equal(trace.reads.A, 0x77);
assert.equal(trace.writes['2001h'].before, undefined);
assert.equal(trace.writes['2001h'].after, 0x77);
sim.resetState();
assert.equal(sim.state().history.length, 0);
console.log('PASS: actual input/address reads, register transfers, BCD output writes, and reset trace verified.');
