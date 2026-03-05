const display = document.getElementById("display");
const historyEl = document.getElementById("history");
const keys = document.querySelector(".keys");

let justCalculated = false;
let lastWasError = false;

const OPS = new Set(["+", "-", "*", "/"]);
const SAFE_CHARS = /^[0-9+\-*/().\s]+$/;

function setDisplay(v) { display.value = v; }
function getDisplay() { return display.value; }

function isOp(ch) { return OPS.has(ch); }

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
  setDisplay(getDisplay().slice(0, -1));
}

function lastNumberChunk(expr) {
  // chunk since last operator or parenthesis
  return expr.split(/[\+\-\*\/\(\)]/).pop();
}

function canAddCloseParen(expr) {
  // You can only close if there's an unmatched "("
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

  // After "=", typing a number/dot/"(" starts a new expression
  if (justCalculated && (/^[0-9.]$/.test(token) || token === "(")) {
    expr = "";
    historyEl.textContent = "";
    justCalculated = false;
  }

  // After "=", typing an operator continues from result
  if (justCalculated && isOp(token)) {
    justCalculated = false;
  }

  // If display is empty and token is "." start with "0."
  if (expr === "" && token === ".") {
    setDisplay("0.");
    return;
  }

  const last = expr.slice(-1);

  // Prevent starting with an operator except "-"
  if (expr === "" && isOp(token) && token !== "-") return;

  // Parentheses rules
  if (token === ")") {
    if (!expr) return;
    if (isOp(last) || last === "(" || last === ".") return;
    if (!canAddCloseParen(expr)) return;
  }

  // Decimal: only one dot per number chunk
  if (token === ".") {
    const chunk = lastNumberChunk(expr);
    if (chunk.includes(".")) return;
    if (chunk === "" || chunk === "-") {
      // e.g. after "(" or operator, allow "0."
      setDisplay(expr + "0.");
      return;
    }
  }

  // Operators: replace if last is operator (except allow "-” as unary after operator or "(")
  if (isOp(token)) {
    if (!expr) return;

    // Don't allow operator right after "("
    if (last === "(" && token !== "-") return;

    if (isOp(last)) {
      // allow "* -2" style unary minus
      if (token === "-" && last !== "-") {
        setDisplay(expr + token);
        return;
      }
      // otherwise replace the operator
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

    if (ch === " ") { i++; continue; }

    if ("()+-*/".includes(ch)) {
      // Unary minus handling
      if (ch === "-") {
        const prev = tokens[tokens.length - 1];
        const unary = !prev || (typeof prev === "string" && ("()+-*/".includes(prev) && prev !== ")"));
        if (unary) {
          let num = "-";
          i++;
          while (i < expr.length && /[0-9.]/.test(expr[i])) num += expr[i++];
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
      while (i < expr.length && /[0-9.]/.test(expr[i])) num += expr[i++];
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
        (stack[stack.length - 1] in prec) &&
        prec[stack[stack.length - 1]] >= prec[t]
      ) out.push(stack.pop());
      stack.push(t);
    } else if (t === "(") {
      stack.push(t);
    } else if (t === ")") {
      while (stack.length && stack[stack.length - 1] !== "(") out.push(stack.pop());
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
  const s = [];
  for (const t of rpn) {
    if (!isNaN(t)) { s.push(Number(t)); continue; }

    const b = s.pop();
    const a = s.pop();
    if (a === undefined || b === undefined) throw new Error("Invalid");

    let res;
    switch (t) {
      case "+": res = a + b; break;
      case "-": res = a - b; break;
      case "*": res = a * b; break;
      case "/":
        if (b === 0) throw new Error("Divide by zero");
        res = a / b;
        break;
      default: throw new Error("Bad op");
    }
    s.push(res);
  }

  if (s.length !== 1 || !Number.isFinite(s[0])) throw new Error("Invalid");
  return s[0];
}

function formatResult(n) {
  const rounded = Math.round((n + Number.EPSILON) * 1e12) / 1e12;
  return String(rounded);
}

function equals() {
  clearErrorIfNeeded();

  const expr = getDisplay().trim();
  if (!expr) return;

  // quick safety check
  if (!SAFE_CHARS.test(expr)) {
    historyEl.textContent = "Error";
    setDisplay("Error");
    lastWasError = true;
    justCalculated = true;
    return;
  }

  // don't evaluate if ends with operator or open paren or dot
  const last = expr.slice(-1);
  if (isOp(last) || last === "(" || last === ".") {
    historyEl.textContent = "Error";
    setDisplay("Error");
    lastWasError = true;
    justCalculated = true;
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
  } catch {
    historyEl.textContent = "Error";
    setDisplay("Error");
    lastWasError = true;
    justCalculated = true;
  }
}

// Clicks
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

// Keyboard
document.addEventListener("keydown", (e) => {
  const k = e.key;

  if (k === "Enter") { e.preventDefault(); equals(); return; }
  if (k === "Backspace") { backspace(); return; }
  if (k === "Escape") { clearAll(); return; }

  if (/^[0-9]$/.test(k) || ["+", "-", "*", "/", "(", ")", "."].includes(k)) {
    appendToken(k);
  }
});

// Start
setDisplay("");
display.focus();
