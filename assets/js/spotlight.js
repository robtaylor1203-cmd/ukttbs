/**
 * Global cursor spotlight — updates CSS vars --mx/--my on the root
 * and on every [data-spotlight] element, rAF-throttled for cheap
 * per-card lighting.
 */
const root = document.documentElement;

let pending = false;
let lastX = 0, lastY = 0;

function paint() {
  pending = false;
  root.style.setProperty("--mx", `${(lastX / window.innerWidth) * 100}%`);
  root.style.setProperty("--my", `${(lastY / window.innerHeight) * 100}%`);

  document.querySelectorAll("[data-spotlight]").forEach((el) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((lastX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((lastY - r.top)  / r.height) * 100}%`);
  });
}

function onMove(e) {
  lastX = e.clientX; lastY = e.clientY;
  if (pending) return;
  pending = true;
  requestAnimationFrame(paint);
}

window.addEventListener("pointermove", onMove, { passive: true });
window.addEventListener("pointerdown", onMove, { passive: true });
