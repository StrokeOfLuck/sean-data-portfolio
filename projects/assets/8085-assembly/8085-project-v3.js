(() => {
  const root = document.querySelector("[data-assembly-simulator]");
  if (!root) return;

  const sourceUrl = root.dataset.source;
  const elements = {
    inspector: root.querySelector("[data-assembly-inspector]"),
    input: root.querySelector("[data-assembly-input]"),
    load: root.querySelector("[data-assembly-load]"),
    step: root.querySelector("[data-assembly-step]"),
    run: root.querySelector("[data-assembly-run]"),
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

    sourceLines.forEach((raw, sourceIndex) => {
      const trimmed = raw.trim();
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
        sourceIndex
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
    elements.toggle.setAttribute("aria-pressed", "false");
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
      elements.toggle.setAttribute("aria-pressed", "false");
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
    state.history.push({ line, step: state.count,
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

  function renderCode() {
    if (!state) return;

    const activeSource =
      program[state.pc]?.sourceIndex ??
      program[Math.max(0, state.pc - 1)]?.sourceIndex ??
      0;
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
        const active = index === activeSource && !state.halted ? " is-active" : "";

        return `<div class="assembly-code-line ${kind}${active}${inspected}" data-source-index="${index}">
          <span class="assembly-line-number">${String(index + 1).padStart(3, "0")}</span>
          <span class="assembly-source-text">${formattedLine(raw)}</span>
        </div>`;
      })
      .join("");
    if (!showAllSource) elements.code.scrollTop = 0;
  }

  function flowNodeForInstruction(line) {
    if (!line) return "halt";

    const sourceLine = line.sourceIndex + 1;
    if (sourceLine <= 14) return "load";
    if (sourceLine <= 18) return "zero-check";
    if (sourceLine <= 23) return "range-check";
    if (sourceLine <= 29) return "divide";
    if (sourceLine >= 109 && sourceLine <= 114) return "save-4";
    if (sourceLine >= 115 && sourceLine <= 120) return "save-3";
    if (sourceLine >= 122 && sourceLine <= 126) return "save-2";
    if (sourceLine >= 129 && sourceLine <= 133) return "save-1";
    if (sourceLine >= 31 && sourceLine <= 37) {
      return "remainder-4";
    }
    if (sourceLine >= 38 && sourceLine <= 39) {
      return "remainder-3";
    }
    if (sourceLine >= 40 && sourceLine <= 41) {
      return "remainder-2";
    }
    if (sourceLine >= 42 && sourceLine <= 43) {
      return "remainder-1";
    }
    if (sourceLine >= 46 && sourceLine <= 48) return "quotient";
    if (sourceLine >= 49 && sourceLine <= 54) return "multiply";
    if (sourceLine >= 56 && sourceLine <= 58) return "add-remainder";
    if (sourceLine >= 59 && sourceLine <= 61) return "add-32";
    if (sourceLine >= 81 && sourceLine <= 85) return "store";
    if (sourceLine >= 87 && sourceLine <= 105) return "zero-store";
    return "halt";
  }

  function setFlowText(selector, value) {
    const target = elements.flow.querySelector(selector);
    if (target) target.textContent = value;
  }

  function renderFlow() {
    if (!state || !elements.flow) return;

    const input = state.memory[0x2000] ?? 0;
    const quotient = Math.floor(input / 5);
    const remainder = input % 5;
    const remainderAdjustments = [0, 2, 4, 5, 7];
    const adjustment = remainderAdjustments[remainder];
    const activeNode = state.halted ? "halt" : flowNodeForInstruction(program[state.pc]);
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
      `Quotient ${quotient} · remainder ${remainder}`
    );
    setFlowText(
      "[data-flow-multiply-value]",
      `${quotient} × 9 = ${quotient * 9}`
    );
    setFlowText("[data-flow-adjustment-value]", `Add ${adjustment}`);

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
      : `<strong>Explore the program</strong><p>Click a flowchart step or processor value to inspect its code. Solid blue marks the next instruction; dashed blue marks your selection.</p>${latest ? traceHtml(latest) : ""}`;
  }
  function inspect(selection) {
    if (!state) return;
    stopRun();
    inspection = selection;
    showAllSource = true;
    elements.toggle.textContent = "Follow execution";
    elements.toggle.setAttribute("aria-pressed", "true");
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
    elements.memoryInput.textContent = hex8(state.memory[0x2000]);
    elements.memoryOutput.textContent =
      state.memory[0x2001] == null ? "--" : hex8(state.memory[0x2001]);

    if (state.memory[0x2001] == null) {
      elements.result.textContent = "Waiting…";
    } else {
      const bcd = state.memory[0x2001];
      const decoded = ((bcd >> 4) & 0x0f) * 10 + (bcd & 0x0f);
      elements.result.textContent = `${decoded}°F · BCD ${hex8(bcd)}`;
    }

    elements.phase.textContent = phaseName(program[state.pc]?.raw || "");
    elements.detail.textContent = state.last;
    elements.step.disabled = state.halted;
  }

  root.addEventListener("click", event => {
    const value = event.target.closest("[data-inspect-state]");
    if (value && state) inspectState(value.dataset.inspectState);
    if (event.target.closest("[data-inspection-return]")) {
      inspection = null; showAllSource = false;
      elements.toggle.textContent = "Show all source";
      elements.toggle.setAttribute("aria-pressed", "false"); render();
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
  elements.run.addEventListener("click", () => {
    if (timer) {
      stopRun();
      return;
    }

    if (state.halted) resetState();
    elements.run.textContent = "Pause";
    timer = window.setInterval(() => {
      executeStep();
      if (state.halted || state.count > 500) stopRun();
    }, 120);
  });
  elements.toggle.addEventListener("click", () => {
    inspection = null;
    showAllSource = !showAllSource;
    renderInspector();
    renderFlow();
    elements.toggle.textContent = showAllSource
      ? "Follow execution"
      : "Show all source";
    elements.toggle.setAttribute("aria-pressed", String(showAllSource));
    renderCode();
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
