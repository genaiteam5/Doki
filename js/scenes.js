/* ============================================================
   DOKI · eye2 — Three.js studio scenes (Second White style)
   Procedural 3D for the umbrella & book detail stages.
   - soft studio lighting on a transparent canvas (CSS gradient = infinite bg)
   - idle motion (umbrella slow spin, book floating) + drag to rotate
   - render loop runs only while a page is open (doki:open / doki:close)
   ============================================================ */
import * as THREE from "three";

const scenes = {};
let rafId = null;
const clock = new THREE.Clock();

/* ---------- lighting shared by every scene ---------- */
function addLights(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d9d2, 0.95));
  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(3.2, 5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.4);
  fill.position.set(-4, 2, -2.5);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
}

const matte = (color, rough = 0.55) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.0 });

/* ---------- umbrella model ---------- */
function buildUmbrella() {
  const g = new THREE.Group();
  const purple = matte(0x6E5DD6, 0.5);
  const dark = matte(0x2A2733, 0.6);

  // canopy: 8-panel open cone
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.62, 8, 1, true), purple);
  canopy.material.side = THREE.DoubleSide;
  canopy.position.y = 0.58;
  g.add(canopy);

  // little tips at the 8 rim corners
  const tipGeo = new THREE.SphereGeometry(0.05, 12, 12);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const tip = new THREE.Mesh(tipGeo, purple);
    tip.position.set(Math.cos(a) * 1.4, 0.27, Math.sin(a) * 1.4);
    g.add(tip);
  }

  // ferrule (top spike)
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 12), dark);
  ferrule.position.y = 1.02;
  g.add(ferrule);

  // pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.85, 16), dark);
  pole.position.y = -0.35;
  g.add(pole);

  // J-hook handle
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.04, 14, 28, Math.PI), dark);
  hook.position.set(0.17, -1.27, 0);
  hook.rotation.z = Math.PI;
  g.add(hook);

  g.position.y = 0.15;
  const update = (dt, t, dragging) => {
    if (!dragging) g.rotation.y += dt * 0.5;
  };
  return { group: g, update, camZ: 4.5 };
}

/* ---------- book model (floating) ---------- */
function buildBook() {
  const g = new THREE.Group();
  const cover = matte(0xC56B4A, 0.6);     // terracotta cover
  const pages = matte(0xFAF7F0, 0.85);    // cream pages
  const spine = matte(0xA9542F, 0.6);

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.0, 0.38), cover);
  g.add(body);

  // page block — slightly thinner (hidden front/back), pushed to the fore-edge
  const pg = new THREE.Mesh(new THREE.BoxGeometry(1.46, 1.96, 0.3), pages);
  pg.position.x = 0.05;
  g.add(pg);

  // spine strip on the left
  const sp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.0, 0.4), spine);
  sp.position.x = -0.69;
  g.add(sp);

  g.rotation.y = -0.5;
  const baseY = 0;
  const update = (dt, t, dragging) => {
    if (!dragging) g.rotation.y += dt * 0.35;
    g.position.y = baseY + Math.sin(t * 1.1) * 0.12;     // weightless float
    g.rotation.x = Math.sin(t * 0.7) * 0.06;
  };
  return { group: g, update, camZ: 4.7 };
}

const BUILDERS = { umbrella: buildUmbrella, book: buildBook };

/* ---------- per-product scene setup ---------- */
function ensureScene(product) {
  if (scenes[product]) return scenes[product];
  const stage = document.querySelector(`.sw-stage[data-scene="${product}"]`);
  if (!stage) return null;
  const canvas = stage.querySelector("canvas");

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (err) {
    console.warn("WebGL unavailable:", err);
    canvas.style.display = "none";
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  addLights(scene);

  const built = BUILDERS[product]();
  scene.add(built.group);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, built.camZ);
  camera.lookAt(0, 0, 0);

  const o = { stage, canvas, renderer, scene, camera, group: built.group, update: built.update,
    active: false, dragging: false, lastX: 0, lastY: 0 };
  scenes[product] = o;

  // drag to rotate
  const down = (e) => { o.dragging = true; o.lastX = e.clientX; o.lastY = e.clientY; canvas.setPointerCapture?.(e.pointerId); };
  const move = (e) => {
    if (!o.dragging) return;
    o.group.rotation.y += (e.clientX - o.lastX) * 0.008;
    o.group.rotation.x = Math.max(-0.6, Math.min(0.6, o.group.rotation.x + (e.clientY - o.lastY) * 0.006));
    o.lastX = e.clientX; o.lastY = e.clientY;
  };
  const up = (e) => { o.dragging = false; canvas.releasePointerCapture?.(e.pointerId); };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);

  resize(o);
  return o;
}

function resize(o) {
  const w = o.stage.clientWidth || 1, h = o.stage.clientHeight || 1;
  o.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  o.renderer.setSize(w, h, false);
  o.camera.aspect = w / h;
  o.camera.updateProjectionMatrix();
}

function loop() {
  rafId = requestAnimationFrame(loop);
  const dt = clock.getDelta(), t = clock.elapsedTime;
  let any = false;
  for (const k in scenes) {
    const o = scenes[k];
    if (!o.active) continue;
    any = true;
    o.update(dt, t, o.dragging);
    o.renderer.render(o.scene, o.camera);
  }
  if (!any) { cancelAnimationFrame(rafId); rafId = null; }
}

/* ---------- wake / sleep on page open / close ---------- */
window.addEventListener("doki:open", (e) => {
  const p = e.detail && e.detail.product;
  if (p !== "umbrella" && p !== "book") return;
  const o = ensureScene(p);
  if (!o) return;
  resize(o);
  o.active = true;
  clock.getDelta();           // swallow the gap so float/spin don't jump
  if (!rafId) loop();
});
window.addEventListener("doki:close", (e) => {
  const o = scenes[e.detail && e.detail.product];
  if (o) o.active = false;
});
window.addEventListener("resize", () => {
  for (const k in scenes) if (scenes[k].active) resize(scenes[k]);
});
