(() => {
  const root = document.querySelector("[data-assembly-simulator]");
  if (!root) return;

  const sourceUrl = root.dataset.source;
  const elements = {
    input: root.querySelector("[data-assembly-input]"),
    load: root.querySelector("[data-assembly-load]"),
    step: root.querySelector("[data-assembly-step]"),
    run: root.querySelector("[data-assembly-run]"),
    reset: root.querySelector("[data-assembly-reset]"),
    toggle: root.querySelector("[data-assembly-source-toggle]"),
    flowToggle: root.querySelector("[data-assembly-flow-toggle]"),
    codeToggle: root.querySelector("[data-assembly-code-toggle]"),
    panelTitle: root.querySelector("[data-assembly-panel-title]"),
    flow: root.querySelector("[data-assembly-flow]"),
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
  let panelView = "flow";
  let lastFlowNode = null;

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
      last: `Loaded ${input}°C (${hex8(input)}) into memory address 2000h.`
    };

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
        Math.min(sourceLines.length - 13, activeSource - 6)
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
        const active = index === activeSource && !state.halted ? " is-active" : "";

        return `<div class="assembly-code-line ${kind}${active}">
          <span class="assembly-line-number">${String(index + 1).padStart(3, "0")}</span>
          <span class="assembly-source-text">${formattedLine(raw)}</span>
        </div>`;
      })
      .join("");
  }

  function flowNodeForInstruction(line) {
    if (state.halted) return "halt";
    if (!line) return "halt";

    const sourceLine = line.sourceIndex + 1;
    if (sourceLine <= 14) return "load";
    if (sourceLine <= 18) return "zero-check";
    if (sourceLine <= 23) return "range-check";
    if (sourceLine <= 29) return "divide";
    if ((sourceLine >= 31 && sourceLine <= 37) || (sourceLine >= 109 && sourceLine <= 114)) {
      return "remainder-4";
    }
    if ((sourceLine >= 38 && sourceLine <= 39) || (sourceLine >= 115 && sourceLine <= 120)) {
      return "remainder-3";
    }
    if ((sourceLine >= 40 && sourceLine <= 41) || (sourceLine >= 122 && sourceLine <= 126)) {
      return "remainder-2";
    }
    if ((sourceLine >= 42 && sourceLine <= 43) || (sourceLine >= 129 && sourceLine <= 133)) {
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

  function setChoice(name, selected) {
    elements.flow
      .querySelectorAll(`[data-flow-choice="${name}"]`)
      .forEach((choice) => {
        choice.classList.toggle("is-selected", selected);
        if (selected) choice.setAttribute("aria-current", "true");
        else choice.removeAttribute("aria-current");
      });
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
    const activeNode = flowNodeForInstruction(program[state.pc]);
    state.flowVisited.add(activeNode);

    elements.flow.querySelectorAll("[data-flow-node]").forEach((node) => {
      const name = node.dataset.flowNode;
      node.classList.toggle("is-active", name === activeNode);
      node.classList.toggle("is-visited", state.flowVisited.has(name));
      if (name === activeNode) node.setAttribute("aria-current", "step");
      else node.removeAttribute("aria-current");
    });

    setChoice("zero-yes", input === 0);
    setChoice("zero-no", input !== 0);
    setChoice("below5-yes", input > 0 && input < 5);
    setChoice("below5-no", input >= 5);
    [0, 1, 2, 3, 4].forEach((value) => {
      setChoice(`remainder-${value}`, remainder === value && input !== 0);
    });

    setFlowText("[data-flow-input-value]", `${input}°C · ${hex8(input)}`);
    setFlowText(
      "[data-flow-range-value]",
      input === 0
        ? "Handled by the zero branch"
        : input < 5
          ? "Skip repeated subtraction"
          : "Use repeated subtraction"
    );
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

    if (panelView === "flow" && activeNode !== lastFlowNode) {
      const activeElement = elements.flow.querySelector(
        `[data-flow-node="${activeNode}"]`
      );
      if (activeElement) {
        const targetTop = Math.max(
          0,
          activeElement.offsetTop - elements.flow.clientHeight / 2 + activeElement.offsetHeight / 2
        );
        elements.flow.scrollTo({ top: targetTop, behavior: state.count ? "smooth" : "auto" });
      }
      lastFlowNode = activeNode;
    }
  }

  function setPanelView(view) {
    panelView = view;
    const showFlow = view === "flow";
    elements.flow.hidden = !showFlow;
    elements.code.hidden = showFlow;
    elements.toggle.hidden = showFlow;
    elements.panelTitle.textContent = showFlow ? "PROGRAM FLOW" : "PROJECT TO STANDARD.ASM";
    elements.flowToggle.classList.toggle("is-selected", showFlow);
    elements.codeToggle.classList.toggle("is-selected", !showFlow);
    elements.flowToggle.setAttribute("aria-pressed", String(showFlow));
    elements.codeToggle.setAttribute("aria-pressed", String(!showFlow));

    if (showFlow) {
      lastFlowNode = null;
      renderFlow();
    } else {
      renderCode();
    }
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

  function render() {
    renderCode();
    renderFlow();
    const registerNames = ["A", "B", "C", "D", "E", "H", "L"];

    elements.registers.innerHTML =
      registerNames
        .map(
          (name) => `<div class="assembly-register">
            <span>${name}</span><strong>${hex8(state.registers[name])}</strong>
          </div>`
        )
        .join("") +
      `<div class="assembly-register"><span>HL</span><strong>${hex16(hl())}</strong></div>`;

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

  elements.load.addEventListener("click", resetState);
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
    showAllSource = !showAllSource;
    elements.toggle.textContent = showAllSource
      ? "Follow execution"
      : "Show all source";
    elements.toggle.setAttribute("aria-pressed", String(showAllSource));
    renderCode();
  });
  elements.flowToggle.addEventListener("click", () => setPanelView("flow"));
  elements.codeToggle.addEventListener("click", () => setPanelView("code"));
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
