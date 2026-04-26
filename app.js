gsap.registerPlugin(ScrollTrigger);

// ==========================================
// 1. PRELOADER & SETUP
// ==========================================
let progress = 0;
const counterEl = document.querySelector('.counter');
const preloader = document.querySelector('.preloader');

// Isolate and configure texts
// Note: We bypass SplitType on the Hero H1 completely to stop layout shifts
// We only use SplitType for specific other titles like the 100 Club and Footer
const clubSplitText = new SplitType(document.querySelector('.club-content h2'), { types: 'chars' });
const footerSplitText = new SplitType(document.querySelector('.parallax-footer h2'), { types: 'chars' });
gsap.set([clubSplitText.chars, footerSplitText.chars], { y: 110 });

// For Horizontal huge titles, we will split them inline so they stagger wildly:
const hugeTitles = document.querySelectorAll('.huge-title');
const hugeSplits = [];
hugeTitles.forEach(title => {
    const split = new SplitType(title, { types: 'chars' });
    hugeSplits.push(split);
    // Setting insane starting states for braver animations
    gsap.set(split.chars, { opacity: 0, scale: 2.5, rotationY: 90, z: -500 });
});

// Instant kick-off so user doesn't wait
progress = 1;
counterEl.textContent = progress + "%";

// Loading Loop
let loadingInterval = setInterval(() => {
  progress += Math.floor(Math.random() * 5) + 1;
  if(progress >= 100) {
    progress = 100;
    clearInterval(loadingInterval);
    counterEl.textContent = progress + "%";
    
    gsap.to(preloader, {
      yPercent: -100,
      duration: 1.2,
      ease: "power4.inOut",
      onComplete: initSite
    });
  } else {
    counterEl.textContent = progress + "%";
  }
}, 30);

function initSite() {
  document.body.classList.remove('loading');
  initLenis();
  if (window.innerWidth > 768) {
    initCursor();
    initMagnetic();
  }
  initMenuOverlay();
  initScrollAnims();
  initTextScramble();
  initShareHub();
  initParticles();
  
  // Clean Hero reveal without random resizing
  gsap.to('.hero-word', {
    y: 0, stagger: 0.15, duration: 1.2, ease: "power4.out", delay: 0.1
  });
  
  // Safely fade in without snapping FOUC
  gsap.to(".fade-in", {opacity: 1, y:0, duration: 1, delay: 0.8, stagger: 0.2});
}

// ==========================================
// 2. PARTICLES FOR 100 CLUB
// ==========================================
function initParticles() {
  if(typeof particlesJS !== "undefined") {
    particlesJS("particles-js", {
      "particles": {
        "number": { "value": 50, "density": { "enable": true, "value_area": 800 } },
        "color": { "value": "#ffffff" },
        "shape": { "type": "circle" },
        "opacity": { "value": 0.2, "random": false },
        "size": { "value": 3, "random": true },
        "line_linked": { "enable": true, "distance": 150, "color": "#ffffff", "opacity": 0.15, "width": 1 },
        "move": { "enable": true, "speed": 1, "direction": "none", "random": false, "straight": false, "out_mode": "out", "bounce": false }
      },
      "interactivity": {
        "detect_on": "canvas",
        "events": { "onhover": { "enable": true, "mode": "grab" }, "onclick": { "enable": false }, "resize": true },
        "modes": { "grab": { "distance": 200, "line_linked": { "opacity": 0.4 } } }
      },
      "retina_detect": true
    });
  }
}

// ==========================================
// 3. LENIS SMOOTH SCROLL
// ==========================================
function initLenis() {
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), 
    smooth: true
  });
  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => { lenis.raf(time * 1000); });
  gsap.ticker.lagSmoothing(0);
}

// ==========================================
// 4. CURSOR PHYSICS
// ==========================================
function initCursor() {
  const cursor = document.querySelector('.cursor');
  const follower = document.querySelector('.cursor-follower');
  
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let followerX = mouseX, followerY = mouseY;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    gsap.set(cursor, { x: mouseX, y: mouseY });
  });

  gsap.ticker.add(() => {
    followerX += (mouseX - followerX) * 0.15;
    followerY += (mouseY - followerY) * 0.15;
    gsap.set(follower, { x: followerX, y: followerY });
  });

  const hoverables = document.querySelectorAll('a, button, .magnetic, .hero-title');
  hoverables.forEach(el => {
    el.addEventListener('mouseenter', () => follower.classList.add('hovered'));
    el.addEventListener('mouseleave', () => follower.classList.remove('hovered'));
  });
}

function initMagnetic() {
  const magnetics = document.querySelectorAll('.magnetic');
  magnetics.forEach(el => {
    el.addEventListener('mousemove', (e) => {
      const pos = el.getBoundingClientRect();
      const x = e.clientX - pos.left - pos.width / 2;
      const y = e.clientY - pos.top - pos.height / 2;
      gsap.to(el, { x: x * 0.4, y: y * 0.4, duration: 0.5, ease: "power3.out" });
    });
    el.addEventListener('mouseleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.3)" });
    });
  });
}

// ==========================================
// 5. TEXT SCRAMBLE CYBER EFFECT
// ==========================================
function initTextScramble() {
  const scrambleBtns = document.querySelectorAll('.scramble-btn');
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  
  scrambleBtns.forEach(btn => {
    let interval = null;
    btn.addEventListener('mouseenter', event => {
      let iteration = 0;
      clearInterval(interval);
      // Accessing the text node safely, avoiding modifying the icon <i> element
      const textNode = event.currentTarget.childNodes[0]; 
      const originalText = event.currentTarget.dataset.text;
      if(!originalText) return;

      interval = setInterval(() => {
        textNode.nodeValue = originalText
          .split("")
          .map((letter, index) => {
            if(letter === " ") return " ";
            if(index < iteration) return originalText[index];
            return letters[Math.floor(Math.random() * 26)];
          })
          .join("") + " "; // space padding for icon
        
        if(iteration >= originalText.length){ 
          clearInterval(interval);
        }
        iteration += 1 / 2;
      }, 30);
    });
  });
}

// ==========================================
// 6. MENU OVERLAY
// ==========================================
function initMenuOverlay() {
  const toggleBtn = document.querySelector('.menu-toggle');
  const overlay = document.querySelector('.menu-overlay');
  const menuLinks = document.querySelectorAll('.nav-links li a');
  const navFooter = document.querySelector('.nav-footer');
  const menuBg = document.querySelector('.menu-bg');
  
  let menuOpen = false;

  toggleBtn.addEventListener('click', () => {
    menuOpen = !menuOpen;
    toggleBtn.classList.toggle('active');
    overlay.classList.toggle('open');
    
    if(menuOpen) {
      gsap.to(menuLinks, { clipPath: "polygon(0 0, 100% 0, 100% 100%, 0% 100%)", duration: 1.2, stagger: 0.1, ease: "power4.out", delay: 0.2 });
      gsap.to(navFooter, { opacity: 1, y: 0, duration: 1, delay: 0.6, ease: "power3.out" });
    } else {
      gsap.to(menuLinks, { clipPath: "polygon(0 0, 100% 0, 100% 0%, 0% 0%)", duration: 0.5 });
      gsap.to(navFooter, { opacity: 0, y: 20, duration: 0.5 });
    }
  });

  menuLinks.forEach(link => {
    link.addEventListener('mouseenter', (e) => {
      const bgUrl = e.currentTarget.dataset.img;
      if(bgUrl) {
        menuBg.style.backgroundImage = `url('${bgUrl}')`;
        menuBg.style.opacity = '0.35';
      }
    });
    link.addEventListener('mouseleave', () => {
      menuBg.style.opacity = '0.15';
    });
  });
}

// ==========================================
// 7. GSAP SCROLL SYSTEM
// ==========================================
function initScrollAnims() {
  // Hero
  gsap.to(".hero-bg", {
    scale: 1.2, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
  });
  
  // Note: Hero content fadeout triggers
  gsap.to(".hero-content", {
    y: -150, opacity: 0, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "center top", scrub: true }
  });

  // Horizontal Protocol
  const pinWrap = document.querySelector(".pin-wrap");
  const panels = gsap.utils.toArray(".panel");
  const progressLine = document.querySelector(".timeline-progress");

  gsap.set(pinWrap, { width: `${100 * panels.length}vw` });

  const horizontalTween = gsap.to(panels, {
    xPercent: -100 * (panels.length - 1),
    ease: "none",
    scrollTrigger: {
      trigger: ".horizontal-scroll", 
      pin: true, 
      scrub: 1,
      end: () => "+=" + window.innerWidth * panels.length,
      onUpdate: (self) => {
        gsap.to(progressLine, { width: `${self.progress * 100}%`, duration: 0.1 });
      }
    }
  });

  // Advanced Panel Effects Mapping
  panels.forEach((panel, i) => {
    // Reveal panel images from behind the veil scaling up
    const imgInner = panel.querySelector('.img-inner');
    gsap.fromTo(imgInner, 
      { scale: 1.5, opacity: 0 },
      {
        scale: 1, opacity: 1, duration: 1.5, ease: "power2.out",
        scrollTrigger: {
          trigger: panel,
          containerAnimation: horizontalTween,
          start: "left 70%",
          toggleActions: "play none none reverse"
        }
      }
    );

    // Bigger, Bolder, Braver Text Reveals
    if (hugeSplits[i]) {
      gsap.to(hugeSplits[i].chars, {
        opacity: 1,
        scale: 1,
        rotationY: 0,
        z: 0,
        stagger: 0.1,
        duration: 2,
        ease: "expo.out",
        scrollTrigger: {
          trigger: panel,
          containerAnimation: horizontalTween,
          start: "left 55%", 
          toggleActions: "play none none reverse"
        }
      });
    }

    // Content Box Slide Up
    const contentBox = panel.querySelector(".content-box");
    gsap.fromTo(contentBox, 
       { y: 50, opacity: 0 },
       { y: 0, opacity: 1, duration: 1, ease: "power3.out", scrollTrigger: { trigger: panel, containerAnimation: horizontalTween, start: "left 60%", toggleActions: "play none none reverse" } }
    );
  });

  // Vertical 100 Club
  gsap.fromTo(".club-bg", { y: "-20%" }, { y: "20%", ease: "none", scrollTrigger: { trigger: ".club-hundred", start: "top bottom", end: "bottom top", scrub: true } });
  gsap.to(clubSplitText.chars, {
     y: 0, stagger: 0.05, duration: 0.8, ease: "power4.out",
     scrollTrigger: { trigger: ".club-hundred", start: "top 75%", toggleActions: "play none none reverse" }
  });
  gsap.to(".fade-in-up", {
     y: 0, opacity: 1, duration: 1, stagger: 0.2, ease: "power3.out", scrollTrigger: { trigger: ".club-hundred", start: "top 60%" }
  });

  // Marquee
  gsap.to(".marquee-content", {
    xPercent: -50, ease: "none",
    scrollTrigger: { trigger: ".raffle-section", start: "top bottom", end: "bottom top", scrub: 1 }
  });

  // Parallax Footer
  gsap.fromTo(".footer-bg", { y: "-20%" }, { y: "20%", ease: "none", scrollTrigger: { trigger: ".parallax-footer", start: "top bottom", end: "bottom top", scrub: true } });
  
  gsap.to(footerSplitText.chars, {
    y: 0, stagger: 0.05, duration: 0.8, ease: "power4.out",
    scrollTrigger: { trigger: ".parallax-footer", start: "top 80%", toggleActions: "play none none reverse" }
  });
}

// ==========================================
// 8. SHARE HUB
// ==========================================
function initShareHub() {
  const shareBtn = document.querySelector('.share-btn');
  const modal = document.querySelector('.share-modal');
  let open = false;

  shareBtn.addEventListener('click', () => {
    if (window.innerWidth < 768 && navigator.share) {
      navigator.share({ title: 'UKTTBS', url: window.location.href }).catch(console.error);
      return;
    }
    open = !open;
    modal.classList.toggle('active', open);
  });

  document.querySelector('.copy-link').addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href);
    modal.classList.remove('active'); open = false; showToast();
  });
  
  document.querySelector('.twitter').addEventListener('click', () => {
    window.open(`https://twitter.com/intent/tweet?url=${window.location.href}`, '_blank');
  });

  document.querySelector('.linkedin').addEventListener('click', () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${window.location.href}`, '_blank');
  });
}

function showToast() {
  const toast = document.querySelector('.toast');
  toast.classList.add('active');
  setTimeout(() => toast.classList.remove('active'), 2500);
}
