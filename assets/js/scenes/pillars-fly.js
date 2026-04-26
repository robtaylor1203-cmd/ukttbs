// Removed for redesign: pillars-fly scene module.
      end: "+=160%",
      scrub: 1.1,
      pin: stage,
      pinSpacing: true,
      anticipatePin: 1,
    },
    defaults: { ease: "none" },
  });

  // Header drifts gently upward across the act.
  if (header) tl.fromTo(header, { yPercent: 0 }, { yPercent: -20, opacity: 0.85 }, 0);

  // Each card converges to rest.
  cards.forEach((card, i) => {
    tl.to(card, {
      x: 0, y: 0, z: 0,
      rotationX: 0, rotationY: 0, rotationZ: 0,
      opacity: 1, filter: "blur(0px)",
      duration: 0.7,
    }, 0.1 + i * 0.12);
  });

  // Hold + gentle lift on the way out.
  tl.to(cards, { y: -40, opacity: 0.85, duration: 0.3 }, 0.9);

  return () => tl.scrollTrigger?.kill();
}
