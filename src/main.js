import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * 🍵 UKTTBS: THE DEEP STEEP - WORLD CLASS WEBGL JOURNEY
 * Merging the 7-Act Story (Roots, Pillars, Ethos, 100 Club) into pure 3D Space.
 */

// 1. SCENE & RENDERER SETUP
const CANVAS = document.querySelector('#bg');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#020403', 0.015); 

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 0, 100);

const renderer = new THREE.WebGLRenderer({
  canvas: CANVAS,
  // Removed animation and cinematic JS imports and references
  // The following imports and code have been removed to eliminate animation and cinematic effects.
  // import * as THREE from 'three';
  // import { gsap } from 'gsap';
  // import { ScrollTrigger } from 'gsap/ScrollTrigger';
  // gsap.registerPlugin(ScrollTrigger);
  // ...
  // The rest of the code remains unchanged.

