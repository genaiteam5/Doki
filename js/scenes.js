/* ============================================================
   DOKI · eye2 — Three.js studio scenes (Second White style)
   Tries to load the real models (models/*.obj) with OBJLoader; the
   supplied files are Rhino NURBS exports (fan has 0 polygon faces),
   which OBJLoader can't render, so we validate the geometry and fall
   back to clean procedural models. Drop a triangulated .obj/.glb in
   and it will be used automatically.
   - infinite off-white studio, soft shadows, idle Y-spin + drag
   - fan blades spin on their own axis (팬 날개만 무한 회전)
   - render loop runs only while a page is open (doki:open/close)
   ============================================================ */
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const MODELS = {
  fan:      { url: "models/fan.obj",      color: 0xEAEAE6, rough: 0.5,  metal: 0.1, fit: 3.4 },
  umbrella: { url: "models/umbrella.obj", color: 0x6E5DD6, rough: 0.5,  metal: 0.05, fit: 3.3 },
  book:     { url: "models/book.obj",     color: 0xC56B4A, rough: 0.62, metal: 0.0,  fit: 3.0 },
};

const scenes = {};
let rafId = null;
const clock = new THREE.Clock();
const loader = new OBJLoader();
const matte = (c, r = 0.55, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });

/* ---------- lighting ---------- */
function addLights(scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdcdcd4, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(3.4, 6, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5; key.shadow.camera.far = 22;
  const d = 4.5;
  key.shadow.camera.left = -d; key.shadow.camera.right = d; key.shadow.camera.top = d; key.shadow.camera.bottom = -d;
  key.shadow.bias = -0.0004; key.shadow.radius = 6;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-5, 2.5, -2);
  scene.add(fill);
}

/* ---------- procedural fallback models ---------- */
function shadowed(mesh) { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }

function procFan() {
  const g = new THREE.Group();
  const body = matte(0xEDEDE9, 0.45), wood = matte(0xC9A079, 0.6), dark = matte(0x2b2b28, 0.5);
  // cage ring (vertical, facing camera)
  const cage = shadowed(new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.055, 18, 60), body));
  cage.position.y = 1.15; g.add(cage);
  const cage2 = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.03, 14, 48), body));
  cage2.position.y = 1.15; cage2.material = matte(0xEDEDE9, 0.5); g.add(cage2);
  // blades — their own group, spins on Z
  const blades = new THREE.Group(); blades.position.set(0, 1.15, 0.04);
  for (let i = 0; i < 3; i++) {
    const blade = shadowed(new THREE.Mesh(new THREE.CircleGeometry(0.82, 24, 0, Math.PI / 2.6), wood));
    blade.rotation.z = (i / 3) * Math.PI * 2;
    blades.add(blade);
  }
  g.add(blades);
  const hub = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 24), body));
  hub.rotation.x = Math.PI / 2; hub.position.set(0, 1.15, 0.06); g.add(hub);
  // neck + stand
  const neck = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 16), body));
  neck.position.y = 0.7; g.add(neck);
  const hipped = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16), body));
  hipped.position.y = 0.45; g.add(hipped);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.03, 1.5, 12), wood));
    leg.position.set(Math.cos(a) * 0.42, -0.25, Math.sin(a) * 0.42);
    leg.rotation.z = -Math.cos(a) * 0.32; leg.rotation.x = Math.sin(a) * 0.32;
    g.add(leg);
  }
  g.position.y = -0.35;
  return { group: g, blades };
}

function procUmbrella() {
  const g = new THREE.Group();
  const purple = matte(0x6E5DD6, 0.5); purple.side = THREE.DoubleSide;
  const dark = matte(0x2A2733, 0.6);
  const canopy = shadowed(new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.62, 8, 1, true), purple));
  canopy.position.y = 0.58; g.add(canopy);
  const tipGeo = new THREE.SphereGeometry(0.05, 12, 12);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const t = shadowed(new THREE.Mesh(tipGeo, purple));
    t.position.set(Math.cos(a) * 1.4, 0.27, Math.sin(a) * 1.4); g.add(t);
  }
  g.add(shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 12), dark))).position.y = 1.02;
  const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.85, 16), dark));
  pole.position.y = -0.35; g.add(pole);
  const hook = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.04, 14, 28, Math.PI), dark));
  hook.position.set(0.17, -1.27, 0); hook.rotation.z = Math.PI; g.add(hook);
  g.position.y = 0.15;
  return { group: g, blades: null };
}

function procBook() {
  const g = new THREE.Group();
  const cover = matte(0xC56B4A, 0.6), pages = matte(0xFAF7F0, 0.85), spine = matte(0xA9542F, 0.6);
  g.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.0, 0.38), cover)));
  const pg = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.46, 1.96, 0.3), pages)); pg.position.x = 0.05; g.add(pg);
  const sp = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.0, 0.4), spine)); sp.position.x = -0.69; g.add(sp);
  g.rotation.y = -0.5;
  return { group: g, blades: null, float: true };
}
const PROC = { fan: procFan, umbrella: procUmbrella, book: procBook };

/* ---------- validate an OBJ has a usable, finite mesh ---------- */
function objIsValid(obj) {
  let ok = false;
  obj.traverse((c) => {
    if (ok || !c.isMesh || !c.geometry) return;
    const p = c.geometry.attributes.position;
    if (!p || p.count < 4) return;
    let bad = false;
    for (let i = 0; i < Math.min(p.count, 600); i++)
      if (!Number.isFinite(p.getX(i)) || !Number.isFinite(p.getY(i)) || !Number.isFinite(p.getZ(i))) { bad = true; break; }
    if (!bad) ok = true;
  });
  return ok;
}

function fitToStage(obj, fit, pivot) {
  obj.rotation.x = -Math.PI / 2;       // Rhino Z-up → Y-up
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = fit / Math.max(size.x, size.y, size.z);
  obj.position.sub(center);
  const holder = new THREE.Group(); holder.add(obj); holder.scale.setScalar(s); pivot.add(holder);
}

/* ---------- scene setup ---------- */
function ensureScene(product) {
  if (scenes[product]) return scenes[product];
  const stage = document.querySelector(`.sw-stage[data-scene="${product}"]`);
  if (!stage) return null;
  const canvas = stage.querySelector("canvas");
  const cfg = MODELS[product];

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true }); }
  catch (err) { console.warn("WebGL unavailable", err); canvas.style.display = "none"; return null; }
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  addLights(scene);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -1.35; ground.receiveShadow = true; scene.add(ground);

  const pivot = new THREE.Group(); scene.add(pivot);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.5, 6); camera.lookAt(0, 0, 0);

  const o = { stage, canvas, renderer, scene, camera, pivot, blades: null, float: false,
    active: false, dragging: false, lastX: 0, lastY: 0 };
  scenes[product] = o;

  const useProc = () => {
    const built = PROC[product]();
    pivot.add(built.group);
    o.blades = built.blades; o.float = !!built.float;
    finish();
  };
  const finish = () => { o.loaded = true; stage.classList.add("is-loaded"); if (o.active) resize(o); };

  const mat = matte(cfg.color, cfg.rough, cfg.metal);
  loader.load(cfg.url,
    (obj) => {
      if (objIsValid(obj)) {
        obj.traverse((c) => { if (c.isMesh) { c.material = mat; c.castShadow = true; c.receiveShadow = true; } });
        try { fitToStage(obj, cfg.fit, pivot); finish(); }
        catch (e) { console.warn("OBJ fit failed → procedural", product, e); useProc(); }
      } else { console.warn(`models/${product}.obj has no renderable mesh (NURBS) → procedural`); useProc(); }
    },
    undefined,
    () => { console.warn(`models/${product}.obj load failed → procedural`); useProc(); }
  );

  const down = (e) => { o.dragging = true; o.lastX = e.clientX; o.lastY = e.clientY; canvas.setPointerCapture?.(e.pointerId); };
  const move = (e) => {
    if (!o.dragging) return;
    o.pivot.rotation.y += (e.clientX - o.lastX) * 0.008;
    o.pivot.rotation.x = Math.max(-0.5, Math.min(0.5, o.pivot.rotation.x + (e.clientY - o.lastY) * 0.005));
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
  o.camera.aspect = w / h; o.camera.updateProjectionMatrix();
}

function loop() {
  rafId = requestAnimationFrame(loop);
  const dt = clock.getDelta(), t = clock.elapsedTime;
  let any = false;
  for (const k in scenes) {
    const o = scenes[k];
    if (!o.active) continue;
    any = true;
    if (!o.dragging) o.pivot.rotation.y += dt * 0.4;                 // idle spin (whole model)
    if (o.blades) o.blades.rotation.z += dt * 7;                     // blade-only infinite spin
    if (o.float) o.pivot.position.y = Math.sin(t * 1.1) * 0.12;       // weightless float (book)
    o.renderer.render(o.scene, o.camera);
  }
  if (!any) { cancelAnimationFrame(rafId); rafId = null; }
}

function activate(p) {
  const o = ensureScene(p);
  if (!o) return;
  resize(o); o.active = true; clock.getDelta();
  if (!rafId) loop();
}

window.addEventListener("doki:open", (e) => { const p = e.detail && e.detail.product; if (MODELS[p]) activate(p); });
window.addEventListener("doki:close", (e) => { const o = scenes[e.detail && e.detail.product]; if (o) o.active = false; });
window.addEventListener("resize", () => { for (const k in scenes) if (scenes[k].active) resize(scenes[k]); });

const openNow = document.querySelector(".detail.is-open");
if (openNow) { const p = openNow.id.replace("detail-", ""); if (MODELS[p]) activate(p); }
window.__dokiActivateScene = activate;    // lets the page nudge a scene awake after open
