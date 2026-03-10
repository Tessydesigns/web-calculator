const display = document.getElementById("display");
const historyEl = document.getElementById("history");
const keys = document.querySelector(".keys");

let justCalculated = false;
let lastWasError = false;

const OPS = new Set(["+", "-", "*", "/"]);
const SAFE_CHARS = /^[0-9+\-*/().\s]+$/;

function setDisplay(v) {
  display.value = v;
}

function getDisplay() {
  return display.value;
}

function isOp(ch) {
  return OPS.has(ch);
}

function showError(message = "Error") {
  historyEl.textContent = message;
  setDisplay("Error");
  lastWasError = true;
  justCalculated = true;
}

function clearErrorIfNeeded() {
  if (lastWasError) {
    setDisplay("");
    historyEl.textContent = "";
    lastWasError = false;
    justCalculated = false;
  }
}

function clearAll() {
  setDisplay("");
  historyEl.textContent = "";
  justCalculated = false;
  lastWasError = false;
  display.focus();
}

function backspace() {
  if (lastWasError) {
    clearAll();
    return;
  }

  justCalculated = false;
  setDisplay(getDisplay().slice(0, -1));
}

function lastNumberChunk(expr) {
  return expr.split(/[\+\-\*\/\(\)]/).pop();
}

function canAddCloseParen(expr) {
  let balance = 0;

  for (const ch of expr) {
    if (ch === "(") balance++;
    if (ch === ")") balance--;
    if (balance < 0) return false;
  }

  return balance > 0;
}

function appendToken(token) {
  clearErrorIfNeeded();

  let expr = getDisplay();

  if (justCalculated && (/^[0-9.]$/.test(token) || token === "(")) {
    expr = "";
    historyEl.textContent = "";
    justCalculated = false;
  }

  if (justCalculated && isOp(token)) {
    justCalculated = false;
  }

  if (expr === "" && token === ".") {
    setDisplay("0.");
    return;
  }

  const last = expr.slice(-1);

  if (expr === "" && isOp(token) && token !== "-") return;

  if (token === ")") {
    if (!expr) return;
    if (isOp(last) || last === "(" || last === ".") return;
    if (!canAddCloseParen(expr)) return;
  }

  if (token === ".") {
    const chunk = lastNumberChunk(expr);
    if (chunk.includes(".")) return;

    if (chunk === "" || chunk === "-") {
      setDisplay(expr + "0.");
      return;
    }
  }

  if (isOp(token)) {
    if (!expr) {
      if (token === "-") setDisplay("-");
      return;
    }

    if (last === "(" && token !== "-") return;

    if (isOp(last)) {
      if (token === "-" && last !== "-") {
        setDisplay(expr + token);
        return;
      }

      setDisplay(expr.slice(0, -1) + token);
      return;
    }
  }

  setDisplay(expr + token);
}

function tokenize(expr) {
  const tokens = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    if (ch === " ") {
      i++;
      continue;
    }

    if ("()+-*/".includes(ch)) {
      if (ch === "-") {
        const prev = tokens[tokens.length - 1];
        const unary =
          !prev ||
          (typeof prev === "string" &&
            "()+-*/".includes(prev) &&
            prev !== ")");

        if (unary) {
          const next = expr[i + 1];

          if (next === "(") {
            tokens.push("0");
            tokens.push("-");
            i++;
            continue;
          }

          let num = "-";
          i++;

          while (i < expr.length && /[0-9.]/.test(expr[i])) {
            num += expr[i++];
          }

          if (num === "-" || num === "-.") throw new Error("Bad number");
          if (num.split(".").length > 2) throw new Error("Bad number");

          tokens.push(num);
          continue;
        }
      }

      tokens.push(ch);
      i++;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let num = "";

      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i++];
      }

      if (num === ".") throw new Error("Bad number");
      if (num.split(".").length > 2) throw new Error("Bad number");

      tokens.push(num);
      continue;
    }

    throw new Error("Bad char");
  }

  return tokens;
}

function toRPN(tokens) {
  const out = [];
  const stack = [];
  const prec = { "+": 1, "-": 1, "*": 2, "/": 2 };

  for (const t of tokens) {
    if (!isNaN(t)) {
      out.push(t);
    } else if (t in prec) {
      while (
        stack.length &&
        stack[stack.length - 1] in prec &&
        prec[stack[stack.length - 1]] >= prec[t]
      ) {
        out.push(stack.pop());
      }
      stack.push(t);
    } else if (t === "(") {
      stack.push(t);
    } else if (t === ")") {
      while (stack.length && stack[stack.length - 1] !== "(") {
        out.push(stack.pop());
      }

      if (!stack.length) throw new Error("Mismatched");
      stack.pop();
    } else {
      throw new Error("Bad token");
    }
  }

  while (stack.length) {
    const op = stack.pop();
    if (op === "(" || op === ")") throw new Error("Mismatched");
    out.push(op);
  }

  return out;
}

function evalRPN(rpn) {
  const stack = [];

  for (const t of rpn) {
    if (!isNaN(t)) {
      stack.push(Number(t));
      continue;
    }

    const b = stack.pop();
    const a = stack.pop();

    if (a === undefined || b === undefined) {
      throw new Error("Invalid");
    }

    let res;

    switch (t) {
      case "+":
        res = a + b;
        break;
      case "-":
        res = a - b;
        break;
      case "*":
        res = a * b;
        break;
      case "/":
        if (b === 0) throw new Error("Divide by zero");
        res = a / b;
        break;
      default:
        throw new Error("Bad op");
    }

    stack.push(res);
  }

  if (stack.length !== 1 || !Number.isFinite(stack[0])) {
    throw new Error("Invalid");
  }

  return stack[0];
}

function formatResult(n) {
  const rounded = Math.round((n + Number.EPSILON) * 1e12) / 1e12;
  return String(rounded);
}

function equals() {
  clearErrorIfNeeded();

  const expr = getDisplay().trim();
  if (!expr) return;

  if (!SAFE_CHARS.test(expr)) {
    showError("Invalid characters");
    return;
  }

  const last = expr.slice(-1);
  if (isOp(last) || last === "(" || last === ".") {
    showError("Incomplete expression");
    return;
  }

  try {
    const tokens = tokenize(expr);
    const rpn = toRPN(tokens);
    const result = evalRPN(rpn);

    historyEl.textContent = expr;
    setDisplay(formatResult(result));

    justCalculated = true;
    lastWasError = false;
  } catch (err) {
    const message =
      err && err.message ? err.message : "Error";
    showError(message);
  }
}

keys.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const action = btn.dataset.action;
  const value = btn.dataset.value;

  if (action === "clear") return clearAll();
  if (action === "backspace") return backspace();
  if (action === "equals") return equals();
  if (value) return appendToken(value);
});

document.addEventListener("keydown", (e) => {
  const k = e.key;

  if (k === "Enter") {
    e.preventDefault();
    equals();
    return;
  }

  if (k === "Backspace") {
    e.preventDefault();
    backspace();
    return;
  }

  if (k === "Escape") {
    e.preventDefault();
    clearAll();
    return;
  }

  if (/^[0-9]$/.test(k) || ["+", "-", "*", "/", "(", ")", "."].includes(k)) {
    e.preventDefault();
    appendToken(k);
  }
});

setDisplay("");
display.focus();