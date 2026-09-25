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
      last: `Loaded ${input}°C (${hex8(input)}) into memory address 2000h.`
    };

    showAllSource = false;
    elements.toggle.textContent = "Show all source";
    elements.toggle.setAttribute("aria-pressed", "false");
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
