/**
 * Lenis smooth scroll — initialised once, forwarded into the GSAP
 * ticker so ScrollTrigger stays perfectly in sync.
 *
 * Bypassed when:
 *   - the user prefers reduced motion
 *   - <body> does not have the `data-cine` attribute
 */
import Lenis from "https://esm.sh/lenis@1.1.14";
import { gsap, ScrollTrigger } from "./gsap-setup.js";

let lenisInstance = null;

export function initLenis() {
  if (lenisInstance) return lenisInstance;

  const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) return null;
  if (!document.body.hasAttribute("data-cine")) return null;

  lenisInstance = new Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // exponential out
    smoothWheel: true,
    wheelMultiplier: 1,
    lerp: 0.1,
    touchMultiplier: 1.6,
  });

  // Forward Lenis frames into GSAP's ticker.
  lenisInstance.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenisInstance.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // Expose for scene modules that need to lock scroll (e.g. menu open).
  window.__lenis = lenisInstance;
  return lenisInstance;
}

export function getLenis() { return lenisInstance; }

export function lockScroll(lock = true) {
  if (!lenisInstance) return;
  if (lock) lenisInstance.stop(); else lenisInstance.start();
}
