/**
 * Hero tree — organic growth line animation.
 *
 * The tree grows from the ground up. Each .branch group carries a
 * `data-t` attribute (0..1) marking the trunk progress at which its
 * base sits. The branch is delayed so it only starts extending when
 * the rising trunk has actually reached that height. Within a branch
 * the order is: limb → twigs → leaves (each waits for its parent).
 *
 * Result: the tree feels like it's growing, not like separate lines
 * appearing in sequence.
 */

import { gsap }          from "https://esm.sh/gsap@3.12.5";
import { ScrollTrigger } from "https://esm.sh/gsap@3.12.5/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Timing constants — tune here
const TRUNK_START = 0.4;
const TRUNK_DUR   = 3.2;   // slow rise — feels like growth
const LIMB_DUR    = 1.4;   // each limb extends
const TWIG_DUR    = 0.7;
const LEAF_DUR    = 0.5;
const LIMB_EASE   = "power2.out";   // accel from trunk, decel at tip
const TRUNK_EASE  = "power1.inOut"; // smooth rise

function init() {
  const hero = document.querySelector(".hero");
  if (!hero) return;

  const stage     = hero.querySelector(".story-stage");
  const content   = hero.querySelector(".hero__content");
  const scrollCue = hero.querySelector(".scroll-cue");

  const echo   = hero.querySelector(".t-echo");
  const trunk  = hero.querySelector(".t-trunk");
  const branches = hero.querySelectorAll(".branch");

  const allLines  = hero.querySelectorAll(".t-echo, .t-trunk, .t-limb, .t-twig");
  const allLeaves = hero.querySelectorAll(".leaf");
  const crown     = hero.querySelector(".leaf--crown");

  if (reduceMotion) {
    gsap.set(allLines, { strokeDashoffset: 0 });
    gsap.set(allLeaves, { opacity: 1, scale: 1 });
    gsap.set(stage, { opacity: 0.5 });
    gsap.set(content, { opacity: 1, y: 0 });
    gsap.set(scrollCue, { opacity: 1 });
    return;
  }

  // Initial hidden state
  gsap.set(allLines,  { strokeDashoffset: 1 });
  gsap.set(allLeaves, { opacity: 0, scale: 0, transformOrigin: "center" });
  gsap.set(content,   { opacity: 0, y: 24 });
  gsap.set(scrollCue, { opacity: 0 });

  const tl = gsap.timeline();

  // 1. Echo silhouette drifts in behind the trunk
  tl.to(echo, {
    strokeDashoffset: 0,
    duration: TRUNK_DUR + 0.6,
    ease: "power1.inOut",
  }, TRUNK_START - 0.2);

  // 2. Trunk rises from base
  tl.to(trunk, {
    strokeDashoffset: 0,
    duration: TRUNK_DUR,
    ease: TRUNK_EASE,
  }, TRUNK_START);

  // 3. Each branch grows when the trunk reaches its base height
  let latestEnd = TRUNK_START + TRUNK_DUR;

  branches.forEach((branch) => {
    const t = parseFloat(branch.dataset.t || "0.5");
    // When does the trunk reach this height? Account for TRUNK_EASE
    // (power1.inOut ≈ symmetric). Linear approximation is close enough
    // and feels natural once the limb starts growing.
    const baseTime = TRUNK_START + TRUNK_DUR * t;

    const limb  = branch.querySelector(".t-limb");
    const twigs = branch.querySelectorAll(".t-twig");
    const leaves = branch.querySelectorAll(".leaf");

    // Limb extends from the trunk outward
    tl.to(limb, {
      strokeDashoffset: 0,
      duration: LIMB_DUR,
      ease: LIMB_EASE,
    }, baseTime);

    const limbEnd = baseTime + LIMB_DUR * 0.75; // overlap twigs slightly

    // Twigs sprout from the tip of the limb
    tl.to(twigs, {
      strokeDashoffset: 0,
      duration: TWIG_DUR,
      ease: "power2.out",
      stagger: 0.12,
    }, limbEnd);

    const twigsEnd = limbEnd + TWIG_DUR + (twigs.length - 1) * 0.12;

    // Leaves bloom at the tips
    tl.to(leaves, {
      opacity: 1,
      scale: 1,
      duration: LEAF_DUR,
      ease: "back.out(2)",
      stagger: 0.08,
    }, twigsEnd - 0.1);

    const branchEnd = twigsEnd + LEAF_DUR + (leaves.length - 1) * 0.08;
    if (branchEnd > latestEnd) latestEnd = branchEnd;
  });

  // 4. Crown leaf pulse
  if (crown) {
    gsap.to(crown, {
      scale: 1.3,
      duration: 2.4,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
      delay: latestEnd + 0.2,
    });
  }

  // 5. Stage dims and headline reveals, slightly overlapping the end
  const dimAt = Math.max(latestEnd - 0.8, TRUNK_START + TRUNK_DUR);
  tl.to(stage,   { opacity: 0.5, duration: 1.4, ease: "power2.inOut" }, dimAt);
  tl.to(content, { opacity: 1, y: 0, duration: 1.2, ease: "power3.out" }, dimAt + 0.3);
  tl.to(scrollCue, { opacity: 1, duration: 0.6 }, dimAt + 0.9);

  // Scroll parallax
  gsap.to(stage, {
    y: -40,
    ease: "none",
    scrollTrigger: {
      trigger: hero,
      start: "top top",
      end: "bottom top",
      scrub: true,
    },
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
