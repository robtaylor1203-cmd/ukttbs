
// Removed for redesign: hero parallax scene module.
  /* ---- THE DIVE ----
     Pin the hero for ~1.8 extra viewports and scrub a timeline
     that rushes the camera forward through the layered scene. */
  const dive = gsap.timeline({
    scrollTrigger: {
      trigger: hero,
      start: "top top",
      end: "+=180%",
      scrub: 1.1,
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
    },
    defaults: { ease: "none" },
  });

  // Depth-driven translate, scale and progressive blur per layer.
  layers.forEach((layer) => {
    if (layer.classList.contains("parallax__layer--sky") ||
        layer.classList.contains("parallax__layer--sun") ||
        layer.classList.contains("parallax__layer--fog")) return;
    const depth = parseFloat(layer.getAttribute("data-depth") || "0.2");
    const baseBlur = parseFloat(layer.getAttribute("data-blur") || "0");
    const yPush  = -depth * 220;           // vh — negative lifts past camera
    const scale  = 1 + depth * 1.6;         // closer layers scale more
    const blurTo = baseBlur + depth * 14;   // closer layers haze out
    dive.to(layer, { y: `${yPush}vh`, scale, filter: `blur(${blurTo}px)` }, 0);
  });

  // Sky/sun recede.
  const sky = hero.querySelector(".parallax__layer--sky");
  const sun = hero.querySelector(".parallax__layer--sun");
  const heroFog = hero.querySelector(".parallax__layer--fog");
  if (sky) dive.to(sky, { opacity: 0.25, scale: 0.95 }, 0);
  if (sun) dive.to(sun, { opacity: 0.15, scale: 1.25 }, 0);
  if (heroFog) dive.to(heroFog, { opacity: 1.2, y: "-8vh" }, 0);

  // Hero text drifts and fades early.
  if (inner) {
    dive.to(inner, { yPercent: -14, opacity: 0.6 }, 0)
        .to(inner, { yPercent: -40, opacity: 0, scale: 1.1 }, 0.35);
  }

  // Closing vignette.
  if (vignette) dive.to(vignette, { opacity: 1 }, 0.3);

  // Foreground leaf detaches, grows and fills the frame.
  if (bigleaf) {
    gsap.set(bigleaf, { opacity: 0, scale: 0.1, rotate: -12, filter: "blur(8px)" });
    dive.to(bigleaf, { opacity: 0.35, scale: 0.35, rotate: -8, filter: "blur(6px)" }, 0.2)
        .to(bigleaf, { opacity: 0.9,  scale: 0.9,  rotate: -2, filter: "blur(2px)" }, 0.55)
        .to(bigleaf, { opacity: 1,    scale: 1.4,  rotate:  2, filter: "blur(0px)" }, 0.85);
  }

  return () => dive.scrollTrigger?.kill();
}
