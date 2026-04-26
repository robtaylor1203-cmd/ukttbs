// Removed for redesign: tunnel scene module.
  if (words.length) {
    tl.to(words, { yPercent: 0, opacity: 1, stagger: 0.05, duration: 0.4 }, 0.1)
      .to(words, { yPercent: -40, opacity: 0, stagger: 0.03, duration: 0.4 }, 0.8);
  }

  return () => tl.scrollTrigger?.kill();
}
