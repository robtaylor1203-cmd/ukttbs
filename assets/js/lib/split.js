/**
 * Tiny SplitText replacement (no paid plugin).
 * Splits an element's text content into wrapped spans for animation.
 *
 *   splitText(el, "words");   // wraps each word
 *   splitText(el, "chars");   // wraps each character
 *   splitText(el, "lines");   // wraps each visual line (measures layout)
 *
 * Returns an array of the wrapper spans so callers can stagger them.
 * Preserves whitespace and accessibility (original text restored via
 * `aria-label`).
 */

export function splitText(el, mode = "words") {
  if (!el) return [];
  const raw = el.textContent.trim();
  el.setAttribute("aria-label", raw);

  if (mode === "chars") {
    return wrapChars(el, raw);
  }
  if (mode === "words") {
    return wrapWords(el, raw);
  }
  if (mode === "lines") {
    return wrapLines(el);
  }
  return [];
}

function wrapWords(el, raw) {
  const frag = document.createDocumentFragment();
  const words = raw.split(/(\s+)/);
  const spans = [];
  words.forEach(tok => {
    if (/^\s+$/.test(tok)) {
      frag.appendChild(document.createTextNode(" "));
      return;
    }
    const mask = document.createElement("span");
    mask.className = "line-mask";
    const inner = document.createElement("span");
    inner.className = "word";
    inner.setAttribute("aria-hidden", "true");
    inner.textContent = tok;
    mask.appendChild(inner);
    frag.appendChild(mask);
    spans.push(inner);
  });
  el.textContent = "";
  el.appendChild(frag);
  return spans;
}

function wrapChars(el, raw) {
  const frag = document.createDocumentFragment();
  const spans = [];
  [...raw].forEach(ch => {
    if (ch === " ") { frag.appendChild(document.createTextNode(" ")); return; }
    const s = document.createElement("span");
    s.className = "char";
    s.setAttribute("aria-hidden", "true");
    s.textContent = ch;
    frag.appendChild(s);
    spans.push(s);
  });
  el.textContent = "";
  el.appendChild(frag);
  return spans;
}

/**
 * Line-splitting: first words-wrap, then group consecutive words that
 * share a `offsetTop` into a line mask. Robust enough for display type.
 */
function wrapLines(el) {
  const wordSpans = wrapWords(el, el.textContent.trim());
  // Force a layout read, then group by offsetTop bucket.
  const lines = new Map();
  wordSpans.forEach(w => {
    // Each word is inside its own .line-mask — unwrap for re-grouping.
    const bucket = Math.round(w.offsetTop);
    if (!lines.has(bucket)) lines.set(bucket, []);
    lines.get(bucket).push(w);
  });

  // Re-assemble: one .line-mask per bucket, containing a .line-inner span.
  el.innerHTML = "";
  const innerSpans = [];
  [...lines.keys()].sort((a, b) => a - b).forEach(k => {
    const group = lines.get(k);
    const mask = document.createElement("span");
    mask.className = "line-mask";
    const inner = document.createElement("span");
    inner.className = "line-inner";
    inner.textContent = group.map(w => w.textContent).join(" ");
    inner.setAttribute("aria-hidden", "true");
    mask.appendChild(inner);
    el.appendChild(mask);
    el.appendChild(document.createTextNode(" "));
    innerSpans.push(inner);
  });
  return innerSpans;
}
