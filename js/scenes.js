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

// materials read off the product photos: natural wood + matte off-white
const WOOD = 0xC7A472, WOOD_L = 0xD8C097, WHITE = 0xF0EFEA;
// regions matched top→bottom: first match wins, last (bound-less) is catch-all.
// ny = height 0..1, nr = distance from the vertical axis 0..1.
const MODELS = {
  // "fan dobe" STL is Z-up → stand it with rotX; wood only on splayed legs
  fan: { url: "models/fan.obj", color: 0xEAEAE6, fit: 3.4, rotX: -Math.PI / 2, regions: [
    { to: 0.52, rFrom: 0.34, color: WOOD, rough: 0.62 },   // tripod legs
    { color: WHITE, rough: 0.42, metal: 0.06 },             // head, pole, blades
  ] },
  // model sits tip-up/handle-down, so the wood hook handle is the BOTTOM band
  umbrella: { url: "models/umbrella.obj", color: 0x6E5DD6, fit: 3.3, regions: [
    { to: 0.20, color: WOOD_L, rough: 0.6 },                // hook handle (bottom)
    { color: WHITE, rough: 0.5 },                           // shaft + canopy
  ] },
  // light birch plywood
  book: { url: "models/book.obj", color: 0xC56B4A, fit: 3.0, regions: [
    { color: WOOD_L, rough: 0.62 },
  ] },
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
  obj.updateMatrixWorld(true);         // these exports are already Y-up
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = fit / Math.max(size.x, size.y, size.z);
  obj.position.sub(center);
  const holder = new THREE.Group(); holder.add(obj); holder.scale.setScalar(s); pivot.add(holder);
}

/* split a merged mesh into materials by height band (no UVs needed) —
   lets the single-colour exports show wood legs/handle vs white body */
function buildRegioned(obj, regions) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const minY = box.min.y, hY = (box.max.y - box.min.y) || 1;
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  const maxR = Math.max(box.max.x - cx, box.max.z - cz, 1e-4);
  const buckets = regions.map(() => []);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  obj.traverse((m) => {
    if (!m.isMesh || !m.geometry) return;
    const pos = m.geometry.attributes.position, mw = m.matrixWorld;
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i).applyMatrix4(mw);
      b.fromBufferAttribute(pos, i + 1).applyMatrix4(mw);
      c.fromBufferAttribute(pos, i + 2).applyMatrix4(mw);
      const mx = (a.x + b.x + c.x) / 3, my = (a.y + b.y + c.y) / 3, mz = (a.z + b.z + c.z) / 3;
      const ny = (my - minY) / hY;
      const nr = Math.hypot(mx - cx, mz - cz) / maxR;
      let ri = regions.findIndex((r) =>
        ny >= (r.from ?? 0) && ny < (r.to ?? 1.0001) &&
        nr >= (r.rFrom ?? 0) && nr < (r.rTo ?? 1.0001));
      if (ri < 0) ri = regions.length - 1;
      buckets[ri].push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    }
  });
  const group = new THREE.Group();
  regions.forEach((r, i) => {
    if (!buckets[i].length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(buckets[i], 3));
    g.computeVertexNormals();
    const mat = matte(r.color, r.rough ?? 0.55, r.metal ?? 0);
    mat.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
  });
  return group;
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

  loader.load(cfg.url,
    (obj) => {
      if (objIsValid(obj)) {
        try {
          if (cfg.rotX) { obj.rotation.x = cfg.rotX; obj.updateMatrixWorld(true); }
          const model = buildRegioned(obj, cfg.regions);   // wood/white by height band
          fitToStage(model, cfg.fit, pivot);
          o.float = (product === "book");
          finish();
        } catch (e) { console.warn("OBJ build failed → procedural", product, e); useProc(); }
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
