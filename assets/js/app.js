// app.js — GSAP, ScrollTrigger, Lenis scroll logic

gsap.registerPlugin(ScrollTrigger);

// Lenis smooth scroll
const lenis = new Lenis({
  smooth: true,
  direction: 'vertical',
  gestureOrientation: 'vertical',
  lerp: 0.1,
  wheelMultiplier: 1.1,
  infinite: false,
});
function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// Hero Zoom Section
const heroBg = document.querySelector('.hero-bg');
const heroContent = document.querySelector('.hero-content');
if (heroBg && heroContent) {
  gsap.timeline({
    scrollTrigger: {
      trigger: '.hero-zoom',
      start: 'top top',
      end: 'bottom top',
      scrub: 1,
    }
  })
    .to(heroBg, { scale: 1.15, filter: 'brightness(0.7)', ease: 'power2.out' }, 0)
    .to(heroContent, { opacity: 0, y: -80, ease: 'power1.out' }, 0);
}

// Horizontal Scroll Lock Section
const horizContainer = document.querySelector('.horiz-container');
const panels = gsap.utils.toArray('.panel');
if (horizContainer && panels.length > 1) {
  gsap.to(horizContainer, {
    xPercent: -100 * (panels.length - 1),
    ease: 'none',
    scrollTrigger: {
      trigger: '.horizontal-scroll',
      start: 'top top',
      end: () => `+=${horizContainer.offsetWidth - window.innerWidth}`,
      pin: true,
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    }
  });
}

// Parallax Footer Section
const footerContent = document.querySelector('.footer-content');
if (footerContent) {
  gsap.fromTo(footerContent, {
    y: 80,
    opacity: 0.6
  }, {
    y: 0,
    opacity: 1,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: '.parallax-footer',
      start: 'top bottom',
      end: 'top center',
      scrub: 0.5,
    }
  });
}
