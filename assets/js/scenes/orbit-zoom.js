// Removed for redesign: orbit-zoom scene module.
      end: "+=160%",
      scrub: 1.1,
      pin: stage,
      pinSpacing: true,
      anticipatePin: 1,
    },
    defaults: { ease: "none" },
  });

  // Rings + centrepiece zoom into focus.
  tl.to(scene, { scale: 1, opacity: 1, filter: "blur(0px)" }, 0);

  // Copy gently lifts.
  if (copy) tl.fromTo(copy, { y: 20, opacity: 0.4 }, { y: 0, opacity: 1 }, 0.1);

  // Satellite labels blip in one after another.
  labels.forEach((l, i) => {
    tl.to(l, { opacity: 1, y: 0, duration: 0.15 }, 0.35 + i * 0.08);
  });

  // CTA rises at the end.
  if (cta) tl.to(cta, { opacity: 1, y: 0 }, 0.75);

  // Final push: scale slightly beyond 1 to give a sense of passing through.
  tl.to(scene, { scale: 1.08, opacity: 0.85, filter: "blur(2px)" }, 0.9);

  return () => tl.scrollTrigger?.kill();
}
