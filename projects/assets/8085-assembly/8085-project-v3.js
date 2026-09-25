(() => {
  const root = document.querySelector("[data-assembly-simulator]");
  if (!root) return;

  const sourceUrl = root.dataset.source;
  const elements = {
    inspector: root.querySelector("[data-assembly-inspector]"),
    input: root.querySelector("[data-assembly-input]"),
    explain: root.querySelector("[data-assembly-explain]"),
    load: root.querySelector("[data-assembly-load]"),
    step: root.querySelector("[data-assembly-step]"),
    run: root.querySelector("[data-assembly-run]"),
    speed: root.querySelector("[data-assembly-speed]"),
    mercury: root.querySelector("[data-assembly-mercury]"),
    reset: root.querySelector("[data-assembly-reset]"),
    toggle: root.querySelector("[data-assembly-source-toggle]"),
    flow: root.querySelector("[data-assembly-flow]"),
    follow: root.querySelector("[data-assembly-follow]"),
    expand: root.querySelector("[data-assembly-expand]"),
    code: root.querySelector("[data-assembly-code]"),
    registers: root.querySelector("[data-assembly-registers]"),
    steps: root.querySelector("[data-assembly-step-count]"),
    zero: root.querySelector("[data-assembly-zero]"),
    carry: root.querySelector("[data-assembly-carry]"),
    memoryInput: root.querySelector("[data-assembly-memory-input]"),
    memoryOutput: root.querySelector("[data-assembly-memory-output]"),
    result: root.querySelector("[data-assembly-result]"),
    bcdStorage: root.querySelector("[data-assembly-bcd-storage]"),
    bcdDigits: root.querySelector("[data-assembly-bcd-digits]"),
    bcdHelp: root.querySelector("[data-assembly-bcd-help]"),
    phase: root.querySelector("[data-assembly-phase]"),
    detail: root.querySelector("[data-assembly-detail]")
  };

  let sourceLines = [];
  let program = [];
  let labels = {};
  let state = null;
  let timer = null;
  let showAllSource = false;
  let lastFlowNode = null;
  let inspection = null;

  const hex8 = (value) =>
    `${((value ?? 0) & 0xff).toString(16).toUpperCase().padStart(2, "0")}h`;

  const hex16 = (value) =>
    `${((value ?? 0) & 0xffff).toString(16).toUpperCase().padStart(4, "0")}h`;

  const parseHex = (value) => Number.parseInt(value.replace(/h$/i, ""), 16);

  function parseSource(source) {
    sourceLines = source.replace(/^\s*\n|\s+$/g, "").split(/\r?\n/);
    program = [];
    labels = {};
    let pendingLabels = [];
    let flowNode = "load";

    sourceLines.forEach((raw, sourceIndex) => {
      const trimmed = raw.trim();
      const section = trimmed.match(/^; Flow: ([a-z0-9-]+)$/);
      if (section) { flowNode = section[1]; return; }
      if (!trimmed || trimmed.startsWith("//")) return;

      const codeOnly = raw.split(";")[0].trim();
      if (!codeOnly) return;

      if (codeOnly.endsWith(":")) {
        pendingLabels.push(codeOnly.slice(0, -1));
        return;
      }

      const match = codeOnly.match(/^([A-Z]+)\s*(.*)$/i);
      if (!match) return;

      const instruction = {
        op: match[1].toUpperCase(),
        operands: match[2]
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        raw,
        sourceIndex,
        flowNode
      };

      pendingLabels.forEach((label) => {
        labels[label] = program.length;
      });
      pendingLabels = [];
      program.push(instruction);
    });
  }

  function hl() {
    return ((state.registers.H << 8) | state.registers.L) & 0xffff;
  }

  function setHL(value) {
    state.registers.H = (value >> 8) & 0xff;
    state.registers.L = value & 0xff;
  }

  function valueOf(key) {
    return key === "M" ? state.memory[hl()] ?? 0 : state.registers[key];
  }

  function setValue(key, value) {
    const clean = value & 0xff;
    if (key === "M") state.memory[hl()] = clean;
    else state.registers[key] = clean;
  }

  function stopRun() {
    if (timer) window.clearInterval(timer);
    timer = null;
    elements.run.textContent = "Run";
  }

  function resetState() {
    stopRun();
    const input = Math.max(
      0,
      Math.min(37, Number.parseInt(elements.input.value || "0", 10))
    );

    elements.input.value = String(input);
    state = {
      registers: { A: 0, B: 0, C: 0, D: 0, E: 0, H: 0, L: 0 },
      flags: { Z: 0, CY: 0, AC: 0 },
      memory: { 0x2000: input },
      pc: 0,
      calls: [],
      count: 0,
      halted: false,
      flowVisited: new Set(["load"]),
      flowEdges: new Set(),
      last: `Loaded ${input}°C (${hex8(input)}) into memory address 2000h.`
    };

    inspection = null;
    state.history = [];
    showAllSource = false;
    elements.toggle.textContent = "Show all source";

    lastFlowNode = null;
    render();
  }

  function setCompare(value) {
    const accumulator = state.registers.A;
    state.flags.Z = accumulator === value ? 1 : 0;
    state.flags.CY = accumulator < value ? 1 : 0;
    state.flags.AC =
      (accumulator & 0x0f) < (value & 0x0f) ? 1 : 0;
  }

  function add(value) {
    const before = state.registers.A;
    const total = before + value;
    state.flags.AC =
      ((before & 0x0f) + (value & 0x0f)) > 0x0f ? 1 : 0;
    state.flags.CY = total > 0xff ? 1 : 0;
    state.registers.A = total & 0xff;
    state.flags.Z = state.registers.A === 0 ? 1 : 0;
  }

  function decimalAdjustAccumulator() {
    const before = state.registers.A;
    let correction = 0;

    if ((before & 0x0f) > 9 || state.flags.AC) correction += 0x06;
    if (before > 0x99 || state.flags.CY) correction += 0x60;

    const total = before + correction;
    state.flags.CY = total > 0xff || correction >= 0x60 ? 1 : 0;
    state.flags.AC =
      ((before & 0x0f) + (correction & 0x0f)) > 0x0f ? 1 : 0;
    state.registers.A = total & 0xff;
    state.flags.Z = state.registers.A === 0 ? 1 : 0;
  }

  function executeStep() {
    if (!state || state.halted) return;

    const line = program[state.pc];
    if (!line) {
      state.halted = true;
      render();
      return;
    }

    if (inspection) {
      inspection = null;
      showAllSource = false;
      elements.toggle.textContent = "Show all source";

    }
    const before = snapshot();
    const access = instructionAccess(line);
    const [first, second] = line.operands;
    let next = state.pc + 1;

    switch (line.op) {
      case "LXI":
        setHL(parseHex(second));
        break;
      case "MOV":
        setValue(first, valueOf(second));
        break;
      case "MVI":
        setValue(first, parseHex(second));
        break;
      case "CMP":
        setCompare(valueOf(first));
        break;
      case "CZ":
        if (state.flags.Z) {
          state.calls.push(next);
          next = labels[first];
        }
        break;
      case "JC":
        if (state.flags.CY) next = labels[first];
        break;
      case "JNC":
        if (!state.flags.CY) next = labels[first];
        break;
      case "JZ":
        if (state.flags.Z) next = labels[first];
        break;
      case "JNZ":
        if (!state.flags.Z) next = labels[first];
        break;
      case "SUB": {
        const value = valueOf(first);
        const before = state.registers.A;
        state.registers.A = (before - value) & 0xff;
        state.flags.CY = before < value ? 1 : 0;
        state.flags.Z = state.registers.A === 0 ? 1 : 0;
        break;
      }
      case "INR":
        state.registers[first] = (state.registers[first] + 1) & 0xff;
        state.flags.Z = state.registers[first] === 0 ? 1 : 0;
        break;
      case "DCR":
        state.registers[first] = (state.registers[first] - 1) & 0xff;
        state.flags.Z = state.registers[first] === 0 ? 1 : 0;
        break;
      case "ADD":
        add(valueOf(first));
        break;
      case "DAA":
        decimalAdjustAccumulator();
        break;
      case "RZ":
        if (state.flags.Z && state.calls.length) next = state.calls.pop();
        break;
      case "HLT":
        state.halted = true;
        next = state.pc;
        stopRun();
        break;
      default:
        break;
    }

    state.last = line.raw.trim();
    state.pc = next;
    state.count += 1;
    const after = snapshot();
    state.history.push({ line, step: state.count, after,
      reads: Object.fromEntries(access.reads.map(key => [key, before[key]])),
      writes: Object.fromEntries(access.writes.map(key => [key, {before: before[key], after: after[key]}])) });
    render();
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formattedLine(raw) {
    if (!raw) return "&nbsp;";
    if (raw.trim().startsWith("//")) return escapeHtml(raw);

    const semicolon = raw.indexOf(";");
    const code = semicolon >= 0 ? raw.slice(0, semicolon) : raw;
    const comment = semicolon >= 0 ? raw.slice(semicolon) : "";
    const codeHtml = escapeHtml(code).replace(
      /^([0-9A-Z_]+:)/,
      '<span class="assembly-label-text">$1</span>'
    );

    return (
      codeHtml +
      (comment
        ? `<span class="assembly-inline-comment">${escapeHtml(comment)}</span>`
        : "")
    );
  }

  function displayedInstruction() {
    return state.history.at(-1)?.line ?? program[state.pc];
  }

  function renderCode() {
    if (!state) return;

    const activeSource = displayedInstruction()?.sourceIndex ?? 0;
    let indexes;

    if (showAllSource) {
      indexes = sourceLines.map((_, index) => index);
    } else {
      const start = Math.max(
        0,
        Math.min(sourceLines.length - 13, (inspection?.indexes[0] ?? activeSource) - 6)
      );
      indexes = Array.from(
        { length: Math.min(13, sourceLines.length - start) },
        (_, offset) => start + offset
      );
    }

    elements.code.innerHTML = indexes
      .map((index) => {
        const raw = sourceLines[index];
        const kind = !raw.trim()
          ? "assembly-blank-line"
          : raw.trim().startsWith("//")
            ? "assembly-comment-line"
            : "";
        const inspected = inspection?.indexes.includes(index) ? " is-inspected" : "";
        const active = index === activeSource ? " is-active" : "";

        return `<div class="assembly-code-line ${kind}${active}${inspected}" data-source-index="${index}">
          <span class="assembly-line-number">${String(index + 1).padStart(3, "0")}</span>
          <span class="assembly-source-text">${formattedLine(raw)}</span>
        </div>`;
      })
      .join("");
    if (!showAllSource) elements.code.scrollTop = 0;
  }

  function flowNodeForInstruction(line) {
    return line?.flowNode ?? "halt";
  }

  function setFlowText(selector, value) {
    const target = elements.flow.querySelector(selector);
    if (target) target.textContent = value;
  }

  // Preserve each phase's latest real register values as execution moves on.
  function flowValues() {
    const latest = node => state.history.findLast(entry => entry.line.flowNode === node);
    const divide = latest("divide");
    const product = latest("multiply");
    const addition = latest("add-remainder");
    const saved = state.history.findLast(entry => entry.line.flowNode.startsWith("save-") && entry.writes.B);
    return {
      divide: divide ? `C ${divide.after.C} · A ${divide.after.A} remaining` : latest("remainder-4") ? "Skipped: input is less than 5" : "Waiting for division",
      multiply: product ? `A ${hex8(product.after.A)}${product.line.op === "ADD" ? " · awaiting DAA" : ""}` : "Waiting for multiplication",
      adjustment: addition ? `B ${hex8(addition.after.B)} · A ${hex8(addition.after.A)}${addition.line.op === "ADD" ? " · awaiting DAA" : ""}` : saved ? `Saved in B: ${hex8(saved.after.B)}` : "Waiting for remainder"
    };
  }

  function renderFlow() {
    if (!state || !elements.flow) return;

    const input = state.memory[0x2000] ?? 0;
    const values = flowValues();
    const activeNode = flowNodeForInstruction(displayedInstruction());
    state.flowVisited.add(activeNode);
    if (lastFlowNode && activeNode !== lastFlowNode) {
      state.flowEdges.add(`${lastFlowNode}:${activeNode}`);
    }
    elements.flow.querySelectorAll("[data-flow-from]").forEach((edge) => {
      const key = `${edge.dataset.flowFrom}:${edge.dataset.flowTo}`;
      edge.classList.toggle("is-traversed", state.flowEdges.has(key));
      edge.classList.toggle("is-active", state.flowEdges.has(key) && edge.dataset.flowTo === activeNode);
    });

    elements.flow.querySelectorAll("[data-flow-node]").forEach((node) => {
      const name = node.dataset.flowNode;
      node.classList.toggle("is-inspected", inspection?.node === name);
      node.classList.toggle("is-active", name === activeNode);
      node.classList.toggle("is-visited", state.flowVisited.has(name));
      if (name === activeNode) node.setAttribute("aria-current", "step");
      else node.removeAttribute("aria-current");
    });

    setFlowText("[data-flow-input-value]", `${input}°C · ${hex8(input)}`);
    setFlowText(
      "[data-flow-division-value]",
      values.divide
    );
    setFlowText(
      "[data-flow-multiply-value]",
      values.multiply
    );
    setFlowText("[data-flow-adjustment-value]", values.adjustment);

    if (state.memory[0x2001] == null) {
      setFlowText("[data-flow-output-value]", "Waiting for output");
    } else {
      const bcd = state.memory[0x2001];
      const decoded = ((bcd >> 4) & 0x0f) * 10 + (bcd & 0x0f);
      setFlowText(
        "[data-flow-output-value]",
        `${decoded}°F · BCD ${hex8(bcd)}`
      );
    }

    if (!inspection && activeNode !== lastFlowNode && elements.follow.checked) {
      const activeElement = elements.flow.querySelector(
        `[data-flow-node="${activeNode}"]`
      );
      if (activeElement) {
        const bounds = activeElement.getBoundingClientRect();
        const viewport = elements.flow.getBoundingClientRect();
        const targetTop = Math.max(0, elements.flow.scrollTop + bounds.top - viewport.top - elements.flow.clientHeight / 2 + bounds.height / 2);
        const targetLeft = bounds.left < viewport.left || bounds.right > viewport.left + elements.flow.clientWidth
          ? Math.max(0, elements.flow.scrollLeft + bounds.left - viewport.left - elements.flow.clientWidth / 2 + bounds.width / 2)
          : elements.flow.scrollLeft;
        // Scroll only this panel; avoid overlapping animations during Run.
        elements.flow.scrollTo({ top: targetTop, left: targetLeft, behavior: "auto" });
      }
    }
    lastFlowNode = activeNode;
  }

  function phaseName(raw) {
    if (state.halted) return "Complete";
    if (/LXI H,2000|MOV A,M|MVI D,00|CMP D|CZ LOOP_ZERO/.test(raw)) {
      return "Read input";
    }
    if (/LOOP_D|SUB B|INR  C|MVI C,00|MVI B,05|JC LESS_5/.test(raw)) {
      return "Divide";
    }
    if (/FOUND|MVI D,04|MVI E,03|MVI H,02|MVI L,01|CMP [DEHL]|CZ [1-4]_FOUND/.test(raw)) {
      return "Remainder";
    }
    if (/LOOP_M|DCR C|ADD H|MVI C,9/.test(raw)) return "Multiply";
    if (/LOOP_ADD35|ADD B|MVI H,32|DAA/.test(raw)) return "BCD arithmetic";
    return "Store result";
  }

  // Instruction explanations and examples for this simulator.
  const instructionLessons = {
    MOV: {name: "Move (copy)", how: "Read the operands as destination, source. MOV copies the source byte into the destination; it does not empty the source. M means the memory location addressed by H and L together, not a separate register.", effect: "Only the destination byte is replaced. The source and flags stay unchanged."},
    MVI: {name: "Move immediate", how: "Immediate means the value is written directly in the instruction. MVI loads that number into the destination instead of looking for it in another register. In this program, the numbers are hexadecimal even when the h suffix is omitted.", effect: "The destination is replaced by the supplied byte. Flags stay unchanged."},
    LXI: {name: "Load register pair immediate", how: "Two 8-bit registers can hold one 16-bit value. In LXI H,2000h, H receives 20h and L receives 00h. Together HL now points to address 2000h. Setting the address does not read the byte stored there; a later MOV instruction does that.", effect: "H and L change. Memory, A and the flags stay unchanged."},
    CMP: {name: "Compare", how: "Think of CMP as a subtraction used only to ask a question. It checks A minus the other value, but discards the answer. The flags tell a later instruction whether A is smaller, equal or larger: smaller gives CY=1 and Z=0; equal gives CY=0 and Z=1; larger gives both 0.", effect: "Neither operand changes. Flags are updated; this page displays Zero (Z) and Carry (CY)."},
    ADD: {name: "Add to accumulator", how: "A is both an input and the destination. ADD H adds the byte in H to the byte already in A, then keeps the result in A. The source register retains its value. If the sum exceeds 255, A holds the low eight bits and Carry records the overflow.", effect: "A and arithmetic flags change. The source register stays unchanged. BCD addition is followed by DAA in this program."},
    SUB: {name: "Subtract from accumulator", how: "SUB B means A minus B, not B minus A. The difference replaces A; B stays available for the next subtraction. If A is smaller than B, the subtraction needs a borrow, CY becomes 1 and the eight-bit result wraps around. Repeated subtraction by five is how this program divides.", effect: "A and arithmetic flags change. The source register stays unchanged."},
    INR: {name: "Increment", how: "Increment means add one. INR C increases C by one and stores the answer back in C. Here, C counts how many times five has been subtracted. An eight-bit counter wraps from FFh to 00h.", effect: "The selected register and some arithmetic flags change. Carry is preserved; Zero indicates whether the new value is zero."},
    DCR: {name: "Decrement", how: "Decrement means subtract one. DCR C reduces C by one and stores the answer back in C. A following JZ can stop a loop when the counter reaches zero. If decremented again, 00h wraps to FFh.", effect: "The selected register and some arithmetic flags change. Carry is preserved; Zero indicates whether the new value is zero."},
    DAA: {name: "Decimal adjust accumulator", how: "Binary-coded decimal uses each four-bit half of a byte for a decimal digit. Ordinary binary addition can leave a digit outside 0–9. DAA corrects A after BCD addition, using its digits and the auxiliary-carry and carry flags to decide on corrections of 06h and 60h. It is not a general binary-to-decimal conversion.", effect: "A and arithmetic flags can change. The intended result is BCD: for example, 77h represents decimal 77 when interpreted as BCD."},
    JC: {name: "Jump if carry", how: "Read the Carry flag left by an earlier instruction. If CY is 1, continue at the named label; if it is 0, execute the next instruction in order. Following CMP, a carry means A was smaller than the compared value.", effect: "The execution path may change. The jump does not change registers, memory or flags."},
    JNC: {name: "Jump if no carry", how: "No carry means CY is 0. If that condition holds, continue at the named label. Otherwise, proceed to the next instruction. Here, after comparing the remainder with five, JNC loops back while A is still at least five.", effect: "The execution path may change. The jump reads Carry without changing it."},
    JZ: {name: "Jump if zero", how: "The instruction checks the Zero flag, not A directly. If Z is 1, execution continues at the named label. If Z is 0, it continues in order. A previous comparison or arithmetic instruction determines what Zero means at this point.", effect: "The execution path may change. Registers, memory and flags stay unchanged."},
    JNZ: {name: "Jump if not zero", how: "Not zero means Z is 0. Jump to the label when that is true; otherwise continue with the next instruction. The flag describes the most recent instruction that updated it, so the position of the test matters.", effect: "The execution path may change. The jump reads Zero without changing it."},
    CZ: {name: "Call if zero", how: "A call is a detour with a way back. If Z is 1, remember where to resume and enter the named subroutine. If Z is 0, continue normally. The 8085 stores the return address on its stack; this small simulator keeps an internal list of return positions.", effect: "A taken call changes the execution path and saves a return position. It does not change the flags."},
    RZ: {name: "Return if zero", how: "If Z is 1, leave the subroutine and resume immediately after the instruction that called it. If Z is 0, continue inside the subroutine. In the remainder routines, CMP A first compares A with itself, deliberately setting Z to 1 so RZ returns.", effect: "A taken return restores the saved execution position. The return itself leaves registers and flags unchanged."},
    HLT: {name: "Halt", how: "Halt stops the instruction sequence. It does not clear the calculation or erase memory. In this simulator, the result remains at 2001h so you can inspect it; Restart or Load temperature starts a fresh run.", effect: "Execution stops. The final registers, flags and memory values remain available."}
  };

  function executionSummary(entry) {
    if (!entry) return state.last;
    const { op, operands } = entry.line;
    const [a, b] = operands;
    const descriptions = {
      LXI: `Set HL to memory address ${b}.`,
      MOV: `Copy ${b === "M" ? "the value at address HL" : b} into ${a === "M" ? "memory at address HL" : a}.`,
      MVI: `Set ${a} to ${b}.`,
      CMP: `Compare A with ${a} without changing A. Z = 1 if equal; CY = 1 if A is smaller.`,
      SUB: `Subtract ${a} from A.`,
      ADD: `Add ${a} to A.`,
      INR: `Increase ${a} by one.`,
      DCR: `Decrease ${a} by one.`,
      DAA: "Adjust A to binary-coded decimal (BCD).",
      JNC: `Carry ${entry.reads.CY}: ${entry.reads.CY === 0 ? "jump to " + a : "continue to the next instruction"}.`,
      JC: `Carry ${entry.reads.CY}: ${entry.reads.CY === 1 ? "jump to " + a : "continue to the next instruction"}.`,
      JZ: `Zero ${entry.reads.Z}: ${entry.reads.Z === 1 ? "jump to " + a : "continue to the next instruction"}.`,
      JNZ: `Zero ${entry.reads.Z}: ${entry.reads.Z === 0 ? "jump to " + a : "continue to the next instruction"}.`,
      CZ: `Zero ${entry.reads.Z}: ${entry.reads.Z === 1 ? "call " + a : "continue to the next instruction"}.`,
      RZ: entry.reads.Z === 1 ? "Return from the subroutine." : "Continue without returning.",
      HLT: "Stop execution; the result is stored at 2001h."
    };
    return `${op}${operands.length ? " " + operands.join(",") : ""} — ${descriptions[op] || "Instruction completed."}`;
  }

  function snapshot() {
    return { ...state.registers, ...state.flags, HL: hl(),
      "2000h": state.memory[0x2000], "2001h": state.memory[0x2001] };
  }

  // Track the accesses performed by this project's interpreter, including writes
  // that leave a value unchanged. Memory operands also read the HL address pair.
  function instructionAccess(line) {
    const reads = new Set(), writes = new Set();
    const [a, b] = line.operands;
    function operand(key, destination = false) {
      if (key === "M") {
        ["H", "L", "HL"].forEach(k => reads.add(k));
        (destination ? writes : reads).add(hex16(hl()));
      } else {
        (destination ? writes : reads).add(key);
        if (destination && (key === "H" || key === "L")) writes.add("HL");
      }
    }
    const flags = (...keys) => keys.forEach(k => writes.add(k));
    switch (line.op) {
      case "LXI": ["H", "L", "HL"].forEach(k => writes.add(k)); break;
      case "MOV": operand(b); operand(a, true); break;
      case "MVI": operand(a, true); break;
      case "CMP": operand("A"); operand(a); flags("Z", "CY", "AC"); break;
      case "ADD": operand("A"); operand(a); operand("A", true); flags("Z", "CY", "AC"); break;
      case "SUB": operand("A"); operand(a); operand("A", true); flags("Z", "CY"); break;
      case "INR": case "DCR": operand(a); operand(a, true); flags("Z"); break;
      case "DAA": ["A", "AC", "CY"].forEach(k => reads.add(k)); operand("A", true); flags("Z", "CY", "AC"); break;
      case "JC": case "JNC": reads.add("CY"); break;
      case "CZ": case "RZ": case "JZ": case "JNZ": reads.add("Z"); break;
    }
    return { reads: [...reads], writes: [...writes] };
  }

  const explanations = {
    load: "HL points to 2000h. MOV A,M copies the Celsius input into accumulator A.",
    "zero-check": "Compare A with zero. A matching input calls the special 32°F routine.",
    "zero-store": "Zero Celsius converts directly to BCD 32, stored at 2001h.",
    "range-check": "Inputs below five skip division; their quotient is zero.",
    divide: "Repeatedly subtract five from A. C counts the quotient; A retains the remainder.",
    quotient: "Copy the quotient from C into A and H for repeated addition.",
    multiply: "Repeatedly add the quotient in H. DAA keeps the running result in binary-coded decimal.",
    "add-remainder": "Add the rounded remainder contribution saved in B, then adjust to BCD.",
    "add-32": "Add the Fahrenheit offset of 32 using BCD arithmetic.",
    store: "Point HL at 2001h and copy the final BCD Fahrenheit value from A into memory.",
    halt: "Stop execution. The converted temperature remains at memory address 2001h."
  };
  const roles = {
    A: "Accumulator: input, remainder, arithmetic and final result.",
    B: "Holds five during division, then the rounded remainder contribution.",
    C: "Counts the quotient, then counts multiplication iterations.",
    D: "Comparison constant for zero and remainder four.",
    E: "Comparison constant for remainder three.",
    H: "High address byte, comparison constant and saved quotient at different stages.",
    L: "Low address byte and comparison constant at different stages.",
    HL: "Combined H and L registers. Memory instructions use this pair as an address.",
    Z: "Zero flag: comparisons and arithmetic set it; conditional calls and jumps read it.",
    CY: "Carry flag: comparisons, subtraction and addition set it; branches and DAA read it.",
    "2000h": "Celsius input loaded by the controls and read by MOV A,M.",
    "2001h": "Output memory: the two-digit BCD Fahrenheit result written by MOV M,A."
  };
  function displayValue(key, value) {
    return value == null ? "not written" : ["Z", "CY", "AC"].includes(key) ? String(value) : key === "HL" ? hex16(value) : hex8(value);
  }
  function traceHtml(entry) {
    const reads = Object.entries(entry.reads).map(([k,v]) => `${k} ${displayValue(k,v)}`).join(" · ");
    const writes = Object.entries(entry.writes).map(([k,v]) => `${k} ${displayValue(k,v.before)} → ${displayValue(k,v.after)}`).join(" · ");
    return `<p><strong>Step ${entry.step} · line ${entry.line.sourceIndex + 1}</strong> <code>${escapeHtml(entry.line.raw.split(";")[0].trim())}</code></p>` +
      (reads ? `<p>Read: ${reads}</p>` : "") + (writes ? `<p>Wrote: ${writes}</p>` : "");
  }
  function renderInspector() {
    const latest = state.history.at(-1);
    elements.inspector.innerHTML = inspection
      ? `<strong>${escapeHtml(inspection.title)}</strong><p>${escapeHtml(inspection.description)}</p>${inspection.html || ""}<button type="button" data-inspection-return>Return to execution</button>`
      : `<strong>Explore the program</strong><p>${latest ? "Blue marks the instruction just executed. Click a chart step or value to inspect it." : "Ready to begin: blue marks the first instruction. Press Step to execute it."}</p>${latest ? traceHtml(latest) : "<p>Dashed blue marks your inspection selection.</p>"}`;
  }
  function inspect(selection) {
    if (!state) return;
    stopRun();
    inspection = selection;
    showAllSource = true;


    if (flowDialog.open) flowDialog.close();
    render();
    const row = elements.code.querySelector(`[data-source-index="${selection.indexes[0]}"]`);
    if (row) elements.code.scrollTop += row.getBoundingClientRect().top - elements.code.getBoundingClientRect().top - 20;
    elements.inspector.focus({ preventScroll: true });
    elements.inspector.scrollIntoView({ block: "nearest" });
  }
  function inspectFlow(name) {
    const indexes = program.filter(line => flowNodeForInstruction(line) === name).map(line => line.sourceIndex);
    const latest = [...state.history].reverse().find(entry => indexes.includes(entry.line.sourceIndex));
    const description = explanations[name] || (name.startsWith("save-")
      ? "Save the rounded remainder contribution in B for addition after multiplication."
      : `Compare the remainder in A with ${name.split("-")[1]}. A match calls the corresponding save routine.`);
    inspect({ node: name, indexes, title: `Inspecting ${name.replaceAll("-", " ")} · paused`, description,
      html: latest ? traceHtml(latest) : "<p>This section has not executed since the last load.</p>" });
  }
  function inspectState(key) {
    const history = [...state.history].reverse();
    const read = history.find(entry => Object.hasOwn(entry.reads, key));
    const write = history.find(entry => Object.hasOwn(entry.writes, key));
    const entries = [...new Set([read, write].filter(Boolean))].sort((a,b) => b.step - a.step);
    inspect({ indexes: entries.map(entry => entry.line.sourceIndex),
      title: `${key} · ${displayValue(key, snapshot()[key])} · paused`, description: roles[key],
      html: entries.length ? entries.map(entry => `<button type="button" data-inspect-line="${entry.line.sourceIndex}">${entry === write ? "Last write" : "Last read"}${entry === read && entry === write ? " and read" : ""} · line ${entry.line.sourceIndex + 1}</button>${traceHtml(entry)}`).join("")
        : `<p>${key === "2000h" ? "Loaded by the temperature control." : "Initial value."} No instruction has read or written this value yet.</p>` });
  }

  function transferHtml(entry) {
    const chip = (label, value, kind = "read") => `<span class="assembly-transfer-chip ${kind}"><small>${escapeHtml(label)}</small><b>${escapeHtml(String(value))}</b></span>`;
    const arrow = '<span class="assembly-transfer-arrow" aria-label="to">→</span>';
    const number = (key, value) => `${displayValue(key, value)}${value != null && !["HL", "Z", "CY", "AC"].includes(key) ? ` · ${value} decimal` : ""}`;
    if (!entry) return chip("Celsius input", `${state.memory[0x2000]}°C`) + arrow + chip("Memory 2000h", hex8(state.memory[0x2000]), "write");
    const {op, operands: [a,b]} = entry.line;
    const mem = hex16(entry.reads.HL);
    const operand = key => key === "M" ? mem : key;
    const source = key => chip(key.endsWith("h") ? `Memory ${key}` : key, number(key, entry.reads[key]));
    const target = key => chip(key.endsWith("h") ? `Memory ${key}` : key, number(key, entry.writes[key]?.after), "write");
    if (op === "MOV" && a === "M" && mem === "2001h") {
      const value = entry.reads[b];
      const output = `${hex8(value)} · ${(value >> 4) * 10 + (value & 15)}°F BCD`;
      return chip(b, output) + arrow + chip("Memory 2001h", output, "write");
    }
    if (op === "MOV") return source(operand(b)) + arrow + target(operand(a));
    if (op === "MVI" || op === "LXI") return chip("Constant", op === "LXI" ? hex16(parseHex(b)) : number(a, parseHex(b))) + arrow + target(op === "LXI" ? "HL" : operand(a));
    if (["ADD", "SUB"].includes(op)) return source("A") + `<span>${op === "ADD" ? "+" : "−"}</span>` + source(a) + arrow + target("A");
    if (["INR", "DCR"].includes(op)) return source(a) + `<span>${op === "INR" ? "+" : "−"} 1</span>` + arrow + target(a);
    if (op === "CMP") return source("A") + `<span>${entry.reads.A === entry.reads[a] ? "=" : entry.reads.A < entry.reads[a] ? "<" : ">"}</span>` + source(a) + arrow + chip("Flags", `Z ${entry.writes.Z.after} · CY ${entry.writes.CY.after}`, "write");
    if (op === "DAA") return chip("A before DAA", hex8(entry.reads.A)) + arrow + chip("A after DAA", `${hex8(entry.writes.A.after)} · BCD`, "write");
    if (op === "HLT") {
      const result = state.memory[0x2001];
      return chip("Memory 2001h", hex8(result)) + arrow + chip("Fahrenheit result", `${(result >> 4) * 10 + (result & 15)}°F`, "write");
    }
    const flag = Object.hasOwn(entry.reads, "CY") ? "CY" : "Z";
    const taken = op === "JNC" || op === "JNZ" ? entry.reads[flag] === 0 : entry.reads[flag] === 1;
    return chip(flag === "CY" ? "Carry flag" : "Zero flag", entry.reads[flag]) + arrow + chip("Next", taken ? (op === "RZ" ? "Return" : a) : "Continue", "write");
  }

  function renderAccess(entry) {
    root.querySelectorAll("[data-inspect-state]").forEach(card => {
      const key = card.dataset.inspectState;
      const read = !!entry && Object.hasOwn(entry.reads, key);
      const write = !!entry && Object.hasOwn(entry.writes, key);
      card.classList.toggle("was-read", read);
      card.classList.toggle("was-written", write);
      let badge = card.querySelector(".assembly-access-badge");
      if (!badge) { badge = document.createElement("small"); badge.className = "assembly-access-badge"; card.append(badge); }
      badge.textContent = read && write ? "Read + written" : read ? "Read" : write ? "Written" : "";
      card.classList.toggle("value-changed", write && entry.writes[key].before !== entry.writes[key].after);
    });
  }

  function render() {
    renderInspector();
    renderCode();
    renderFlow();
    const registerNames = ["A", "B", "C", "D", "E", "H", "L"];

    elements.registers.innerHTML =
      registerNames
        .map(
          (name) => `<button type="button" class="assembly-register" data-inspect-state="${name}" aria-label="Inspect register ${name}">
            <span>${name}</span><strong>${hex8(state.registers[name])}</strong>
          </button>`
        )
        .join("") +
      `<button type="button" class="assembly-register" data-inspect-state="HL" aria-label="Inspect register pair HL"><span>HL</span><strong>${hex16(hl())}</strong></button>`;

    elements.steps.textContent = `${state.count} ${state.count === 1 ? "step" : "steps"}`;
    elements.zero.textContent = state.flags.Z;
    elements.carry.textContent = state.flags.CY;
    elements.memoryInput.textContent = `${hex8(state.memory[0x2000])} · ${state.memory[0x2000]}°C`;
    elements.memoryOutput.textContent =
      state.memory[0x2001] == null ? "Not written" : `${hex8(state.memory[0x2001])} · BCD`;

    if (state.memory[0x2001] == null) {
      elements.result.textContent = "Waiting…";
      elements.mercury.style.height = "0%";
      elements.bcdStorage.textContent = "Output will be stored at 2001h.";
      elements.bcdDigits.textContent = "BCD stores each decimal digit separately.";
    } else {
      const bcd = state.memory[0x2001];
      const decoded = ((bcd >> 4) & 0x0f) * 10 + (bcd & 0x0f);
      elements.result.textContent = `${decoded}°F`;
      elements.mercury.style.height = `${8 + ((decoded - 32) / 67) * 92}%`;
      elements.bcdStorage.textContent = `Stored as ${hex8(bcd)} (BCD) at 2001h`;
      elements.bcdDigits.textContent = `BCD stores each decimal digit separately: ${bcd >> 4} tens + ${bcd & 15} ones = ${decoded}.`;
    }

    const entry = state.history.at(-1);
    elements.phase.textContent = entry ? `This step · ${entry.line.op}` : "Input loaded";
    elements.explain.disabled = !entry;
    elements.explain.textContent = entry ? `Explain ${entry.line.op}` : "Explain instruction";
    elements.detail.innerHTML = `<span class="assembly-transfer">${transferHtml(entry)}</span><small class="assembly-transfer-summary">${escapeHtml(executionSummary(entry))}</small>`;
    renderAccess(entry);
    elements.step.disabled = state.halted;
  }

  root.addEventListener("click", event => {
    const value = event.target.closest("[data-inspect-state]");
    if (value && state) inspectState(value.dataset.inspectState);
    if (event.target.closest("[data-inspection-return]")) {
      inspection = null; showAllSource = false;
      elements.toggle.textContent = "Show all source";
   render();
      elements.step.focus();
    }
    const line = event.target.closest("[data-inspect-line]");
    if (line && inspection) inspect({ ...inspection, indexes: [Number(line.dataset.inspectLine)] });
  });
  elements.flow.querySelectorAll("[data-flow-node]").forEach(node => {
    const name = node.dataset.flowNode;
    node.setAttribute("role", "button"); node.setAttribute("tabindex", "0");
    node.setAttribute("aria-label", `Inspect ${name.replaceAll("-", " ")} code`);
    node.addEventListener("click", () => { if (state) inspectFlow(name); });
    node.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (state) inspectFlow(name); }
    });
  });
  elements.load.addEventListener("click", resetState);
  const flowDialog = document.createElement("dialog");
  flowDialog.className = "assembly-flow-dialog";
  flowDialog.setAttribute("aria-label", "Expanded program flowchart");
  document.body.append(flowDialog);
  const flowHome = document.createComment("Program flowchart position");
  elements.flow.before(flowHome);
  elements.expand.addEventListener("click", () => {
    if (flowDialog.open) {
      flowDialog.close();
      return;
    }
    flowDialog.append(elements.flow);
    elements.expand.textContent = "Close chart";
    flowDialog.showModal();
    lastFlowNode = null;
    renderFlow();
    elements.expand.focus();
  });
  flowDialog.addEventListener("close", () => {
    flowHome.after(elements.flow);
    elements.expand.textContent = "Expand chart";
    if (inspection) elements.inspector.focus();
    else elements.expand.focus();
    lastFlowNode = null;
    renderFlow();
  });
  elements.follow.addEventListener("change", () => {
    lastFlowNode = null;
    renderFlow();
  });
  elements.reset.addEventListener("click", resetState);
  elements.step.addEventListener("click", executeStep);
  function startRun() {
    if (!state) return;
    if (state.halted) resetState();
    elements.run.textContent = "Pause";
    timer = window.setInterval(() => {
      executeStep();
      if (state.halted || state.count > 500) stopRun();
    }, Number(elements.speed.value));
  }
  root.querySelectorAll("[data-assembly-example]").forEach(button => {
    button.addEventListener("click", () => {
      if (!state) return;
      elements.input.value = button.dataset.assemblyExample;
      resetState();
    });
  });
  elements.speed.addEventListener("change", () => {
    if (timer) { stopRun(); startRun(); }
  });
  elements.run.addEventListener("click", () => {
    if (timer) {
      stopRun();
      return;
    }

    startRun();
  });
  const lessonDialog = document.createElement("dialog");
  lessonDialog.className = "assembly-lesson-dialog";
  lessonDialog.setAttribute("aria-labelledby", "assembly-lesson-title");
  document.body.append(lessonDialog);
  lessonDialog.addEventListener("click", event => {
    if (event.target.closest("[data-lesson-close]")) lessonDialog.close();
  });
  lessonDialog.addEventListener("close", () => elements.explain.focus());
  elements.explain.addEventListener("click", () => {
    const entry = state?.history.at(-1);
    if (!entry) return;
    stopRun();
    const lesson = instructionLessons[entry.line.op];
    lessonDialog.innerHTML = `<header><h2 id="assembly-lesson-title">${entry.line.op} — ${lesson.name}</h2><button type="button" data-lesson-close>Close explanation</button></header>
      <p>${lesson.how}</p><h3>What changes?</h3><p>${lesson.effect}</p>
      <h3>This instruction in your run</h3><div class="assembly-transfer">${transferHtml(entry)}</div>
      <p>${escapeHtml(executionSummary(entry))}</p>${traceHtml(entry)}
      <footer>The values above come from this run. This simulator implements the instructions and flag behavior needed by this project, rather than a complete 8085.</footer>`;
    lessonDialog.showModal();
    lessonDialog.querySelector("[data-lesson-close]").focus();
  });

  const bcdDialog = document.createElement("dialog");
  bcdDialog.className = "assembly-lesson-dialog";
  bcdDialog.setAttribute("aria-labelledby", "assembly-bcd-title");
  document.body.append(bcdDialog);
  bcdDialog.addEventListener("click", event => {
    if (event.target.closest("[data-bcd-close]")) bcdDialog.close();
  });
  bcdDialog.addEventListener("close", () => elements.bcdHelp.focus());
  elements.bcdHelp.addEventListener("click", () => {
    if (!state) return;
    stopRun();
    const stored = state.memory[0x2001];
    const value = stored ?? 0x77;
    const tens = value >> 4, ones = value & 15, decoded = tens * 10 + ones;
    bcdDialog.innerHTML = `<header><h2 id="assembly-bcd-title">BCD — Binary-Coded Decimal</h2><button type="button" data-bcd-close>Close explanation</button></header>
      <p>One byte has eight bits. BCD uses its two four-bit halves to store two separate decimal digits: tens on the left, ones on the right.</p>
      <h3>${stored == null ? "Example (not an output yet)" : "Your stored result"}</h3>
      <div class="assembly-transfer"><span class="assembly-transfer-chip"><small>Tens · ${tens.toString(2).padStart(4,"0")}</small><b>${tens}</b></span><span class="assembly-transfer-chip"><small>Ones · ${ones.toString(2).padStart(4,"0")}</small><b>${ones}</b></span><span class="assembly-transfer-arrow">→</span><span class="assembly-transfer-chip write"><small>Decimal value</small><b>${decoded}</b></span></div>
      <p>${tens} tens + ${ones} ones = <strong>${decoded}</strong>. ${stored == null ? "For example, this could represent 77°F." : "In this program, that means " + decoded + "°F."}</p>
      <h3>Why the “h” can be confusing</h3>
      <p>The suffix h writes the byte in hexadecimal. Interpreted as an ordinary binary number, <strong>${hex8(value)} = ${value} decimal</strong>. Interpreted as BCD digits, that same byte represents <strong>${decoded}</strong>. The bits are identical; their meaning depends on the encoding.</p>
      <p>Each BCD digit must be 0–9. My original assembly program uses the Intel 8085’s <strong>DAA (Decimal Adjust Accumulator)</strong> instruction after addition to keep the result in BCD form. The browser simulator reproduces that behavior. DAA is not a general conversion from binary to decimal.</p>`;
    bcdDialog.showModal();
    bcdDialog.querySelector("[data-bcd-close]").focus();
  });

  const sourceDialog = document.createElement("dialog");
  sourceDialog.className = "assembly-source-dialog";
  sourceDialog.setAttribute("aria-labelledby", "assembly-source-dialog-title");
  sourceDialog.innerHTML = `<div class="assembly-source-dialog-header">
    <strong id="assembly-source-dialog-title">Original assembly source</strong>
    <button type="button" data-source-close>Close source</button>
    <a href="${sourceUrl}" download>Download the assembly source</a>
    <small>Full program · execution pauses while you read</small>
    </div><div class="assembly-code-view" tabindex="0" aria-label="Complete assembly source"></div>`;
  document.body.append(sourceDialog);
  sourceDialog.querySelector("[data-source-close]").addEventListener("click", () => sourceDialog.close());
  sourceDialog.addEventListener("close", () => elements.toggle.focus());
  elements.toggle.addEventListener("click", () => {
    if (!state) return;
    stopRun();
    const code = sourceDialog.querySelector(".assembly-code-view");
    code.innerHTML = sourceLines.map((raw, index) => {
      const active = displayedInstruction()?.sourceIndex === index ? " is-active" : "";
      const kind = raw.trim().startsWith("//") ? " assembly-comment-line" : "";
      return `<div class="assembly-code-line${active}${kind}"><span class="assembly-line-number">${String(index + 1).padStart(3, "0")}</span><span class="assembly-source-text">${formattedLine(raw)}</span></div>`;
    }).join("");
    sourceDialog.showModal();
    code.scrollTop = 0;
    sourceDialog.querySelector("[data-source-close]").focus();
  });
  elements.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") resetState();
  });

  fetch(sourceUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`Could not load source (${response.status})`);
      return response.text();
    })
    .then((source) => {
      parseSource(source);
      resetState();
    })
    .catch((error) => {
      elements.detail.textContent = error.message;
      elements.phase.textContent = "Source unavailable";
      elements.load.disabled = true;
      elements.step.disabled = true;
      elements.run.disabled = true;
      elements.reset.disabled = true;
    });
})();
