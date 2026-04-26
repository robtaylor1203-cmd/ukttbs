// Removed for redesign: ethos-dive scene module.
      const span = to - from;
      words.forEach((w, i) => {
        const threshold = from + (span * i) / Math.max(1, words.length - 1);
        if (p >= threshold) w.classList.add("is-on");
        else w.classList.remove("is-on");
      });

      // Eyebrow fades out after a quarter through.
      if (eyebrow) gsap.set(eyebrow, { opacity: 1 - Math.max(0, (p - 0.25) / 0.25), y: -p * 20 });

      // Cite fades in at 85%+.
      if (cite) {
        const q = Math.max(0, (p - 0.85) / 0.15);
        gsap.set(cite, { opacity: q, y: (1 - q) * 16 });
      }

      // Background drifts + subtly scales.
      if (bg) gsap.set(bg, { y: `${-p * 12}vh`, scale: 1 + p * 0.08, opacity: 1 - p * 0.2 });
      if (leaves) gsap.set(leaves, { y: `${-p * 24}vh`, rotate: p * 6, opacity: 0.35 - p * 0.2 });
    },
  });

  return () => st?.kill();
}
