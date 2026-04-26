/**
 * Universal scene — applies scroll-triggered reveals + parallax to any
 * section that opts in with data-scene="reveals".
 *
 * Hooks (add to any element inside the section):
 *   [data-reveal="words"]      → word-by-word reveal on enter
 *   [data-reveal="lines"]      → line-by-line reveal on enter
 *   [data-reveal="up"]         → fade + slide-up on enter (default)
 *   [data-reveal="fade"]       → simple fade in
 *   [data-reveal="stagger"]    → stagger direct children
 *   [data-parallax="0.25"]     → translateY scrub with given factor
 *   [data-scale-in]            → scale from 1.08 → 1 on enter
 *   [data-reveal-delay="0.2"]  → delay in seconds
 */
import { gsap, ScrollTrigger } from "../lib/gsap-setup.js";
import { splitText } from "../lib/split.js";

export default function reveals() {
  const sections = document.querySelectorAll("[data-scene='reveals']");
  if (!sections.length) runStandalone(); // allow data-reveal anywhere
  sections.forEach(setupSection);
}

// Run reveals even when the parent section doesn't opt in —
// individual [data-reveal] elements still work.
function runStandalone() {
  document.querySelectorAll("[data-reveal]").forEach(wireReveal);
  document.querySelectorAll("[data-parallax]").forEach(wireParallax);
  document.querySelectorAll("[data-scale-in]").forEach(wireScale);
}

function setupSection(section) {
  section.querySelectorAll("[data-reveal]").forEach(wireReveal);
  section.querySelectorAll("[data-parallax]").forEach(wireParallax);
  section.querySelectorAll("[data-scale-in]").forEach(wireScale);
}

function wireReveal(el) {
  if (el.__revealed) return;
  el.__revealed = true;

  const mode  = el.getAttribute("data-reveal") || "up";
  const delay = parseFloat(el.getAttribute("data-reveal-delay") || "0");

  const trigger = { trigger: el, start: "top 85%", toggleActions: "play none none none" };

  if (mode === "words" || mode === "lines" || mode === "chars") {
    const items = splitText(el, mode);
    gsap.set(items, { yPercent: 110, opacity: 0 });
    gsap.to(items, {
      yPercent: 0, opacity: 1,
      duration: 1.0, ease: "expo.out",
      stagger: mode === "chars" ? 0.02 : 0.06,
      delay,
      scrollTrigger: trigger,
    });
    return;
  }
  if (mode === "stagger") {
    const kids = [...el.children];
    gsap.set(kids, { y: 28, opacity: 0 });
    gsap.to(kids, {
      y: 0, opacity: 1,
      duration: 0.9, ease: "power3.out",
      stagger: 0.09, delay,
      scrollTrigger: trigger,
    });
    return;
  }
  if (mode === "fade") {
    gsap.set(el, { opacity: 0 });
    gsap.to(el, { opacity: 1, duration: 1.1, delay, ease: "power2.out", scrollTrigger: trigger });
    return;
  }
  // default "up"
  // Removed for redesign: reveals scene module.
  gsap.to(el, {
