/* ============================================================
   DOKI — 물건 도깨비  /  interactive home
   - 6 scattered eyes, pupils track the cursor (smooth lerp)
   - 3 fake eyes  -> goblin trick (blink / roll / cross / spin)
   - 3 real eyes  -> zoom-in transition into the product gallery
   Requires GSAP (loaded in index.html).
   ============================================================ */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- eye-pair tile styles (viewBox 0 0 200 140) ----------
     palette + bold flat shapes taken from the reference collage
     (image/eye.jpg). each pair of pupils tracks the cursor together.
     rx/ry = sclera radii, pr = pupil radius, pf = pupil fill,
     mx/my = how far the pupils may travel, speckle = textured tile. */
  const TYPES = {
    green:   { bg: "#1FA24C", rx: 36, ry: 31, pr: 15, pf: "#14110E", mx: 15, my: 12 },
    skyblue: { bg: "#52C3EE", rx: 42, ry: 26, pr: 13, pf: "#14110E", mx: 19, my: 8,  speckle: true },
    night:   { bg: "#141414", rx: 29, ry: 35, pr: 13, pf: "#B7E2F4", mx: 10, my: 17 },
    cobalt:  { bg: "#2E78C8", rx: 27, ry: 35, pr: 12, pf: "#14110E", mx: 9,  my: 17 },
    lime:    { bg: "#8DC63F", rx: 45, ry: 47, pr: 15, pf: "#14110E", mx: 21, my: 21 },
    yellow:  { bg: "#F2CB35", rx: 42, ry: 14, pr: 11, pf: "#14110E", mx: 19, my: 4 },
    moss:    { bg: "#A6C84C", rx: 30, ry: 27, pr: 8,  pf: "#14110E", mx: 15, my: 11, speckle: true },
    pool:    { bg: "#1F66C2", rx: 31, ry: 31, pr: 13, pf: "#14110E", mx: 14, my: 14 },
  };

  /* ---------- the curated tile layout (loose, airy 3 + 3) ---------- */
  // door:true -> real product door ; product = which card to focus
  const EYES = [
    { x: 72, y: 25, size: 320, rot: -4,  type: "green",   door: true,  product: "fan" },
    { x: 90, y: 58, size: 220, rot:  6,  type: "yellow",  door: false },
    { x: 50, y: 29, size: 230, rot: -8,  type: "moss",    door: false, hideMobile: true },
    { x: 30, y: 71, size: 250, rot:  4,  type: "skyblue", door: false },
    { x: 62, y: 74, size: 300, rot: -3,  type: "cobalt",  door: true,  product: "umbrella" },
    { x: 86, y: 40, size: 250, rot:  3,  type: "lime",    door: true,  product: "book" },
  ];

  const TINTS = { fan: "#2E7D5B", umbrella: "#5B49B8", book: "#C0563B" };

  const TRICK_MSGS = [
    "낄낄… 그 눈은 가짜라네.",
    "속았지! 도깨비의 장난.",
    "여긴 문이 아니야 👀",
    "히죽, 헛다리짚었군.",
    "다른 눈을 찾아보게.",
    "그 눈은 졸고 있을 뿐.",
  ];

  /* ---------- DOM refs ---------- */
  const eyesLayer = document.getElementById("eyes");
  const veil      = document.getElementById("veil");
  const gallery   = document.getElementById("gallery");
  const grid      = document.getElementById("grid");
  const toastEl   = document.getElementById("toast");
  const hintEl    = document.getElementById("hint");
  const backBtn   = document.getElementById("backbtn");

  let uid = 0;
  const eyeStates = [];
  let locked = false; // true during a zoom transition

  /* ---------- build one eye-pair tile ---------- */
  const LX = 60, RX = 140, CY = 70; // eye centres in the 200x140 viewBox

  function speckles(id, color) {
    // a few faint dots to echo the textured tiles in the reference
    const pts = [[24, 30], [170, 26], [40, 110], [156, 112], [100, 22], [186, 70], [14, 78]];
    return pts.map(([x, y], i) =>
      `<circle cx="${x}" cy="${y}" r="${2 + (i % 3)}" fill="${color}" opacity="0.18"/>`).join("");
  }

  function buildEye(cfg) {
    const id = `eye${uid++}`;
    const t = TYPES[cfg.type] || TYPES.green;
    const clL = `clL-${id}`, clR = `clR-${id}`;
    const speckleColor = t.bg === "#141414" ? "#FFFFFF" : "#000000";
    const sparkFill = t.pf === "#14110E" ? `<circle class="spark" cx="-${t.pr * 0.34}" cy="-${t.pr * 0.34}" r="${t.pr * 0.3}"/>` : "";

    const el = document.createElement("div");
    el.className = "eye" + (cfg.hideMobile ? " eye--hideMobile" : "");
    el.style.left = cfg.x + "%";
    el.style.top = cfg.y + "%";
    el.style.setProperty("--size", cfg.size + "px");
    el.style.setProperty("--rot", cfg.rot + "deg");
    if (cfg.door) {
      el.dataset.door = "true";
      el.style.setProperty("--door-tint", TINTS[cfg.product]);
    }
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", cfg.door ? "도깨비 눈 (문)" : "도깨비 눈");
    el.setAttribute("tabindex", "0");

    el.innerHTML = `
      <svg viewBox="0 0 200 140" preserveAspectRatio="xMidYMid slice">
        <defs>
          <clipPath id="${clL}"><ellipse cx="${LX}" cy="${CY}" rx="${t.rx}" ry="${t.ry}"/></clipPath>
          <clipPath id="${clR}"><ellipse cx="${RX}" cy="${CY}" rx="${t.rx}" ry="${t.ry}"/></clipPath>
        </defs>
        <rect class="tilebg" x="0" y="0" width="200" height="140" rx="16" fill="${t.bg}"/>
        ${t.speckle ? speckles(id, speckleColor) : ""}
        <ellipse class="sclera" cx="${LX}" cy="${CY}" rx="${t.rx}" ry="${t.ry}"/>
        <ellipse class="sclera" cx="${RX}" cy="${CY}" rx="${t.rx}" ry="${t.ry}"/>
        <g class="gaze">
          <g clip-path="url(#${clL})">
            <g transform="translate(${LX} ${CY})">
              <circle class="pupil" cx="0" cy="0" r="${t.pr}" fill="${t.pf}"/>${sparkFill}
            </g>
          </g>
          <g clip-path="url(#${clR})">
            <g transform="translate(${RX} ${CY})">
              <circle class="pupil" cx="0" cy="0" r="${t.pr}" fill="${t.pf}"/>${sparkFill}
            </g>
          </g>
        </g>
        <g class="blinker">
          <rect x="${LX - t.rx}" y="${CY - t.ry - 2}" width="${t.rx * 2}" height="${t.ry * 2 + 4}" fill="${t.bg}" clip-path="url(#${clL})"/>
          <rect x="${RX - t.rx}" y="${CY - t.ry - 2}" width="${t.rx * 2}" height="${t.ry * 2 + 4}" fill="${t.bg}" clip-path="url(#${clR})"/>
        </g>
      </svg>`;

    eyesLayer.appendChild(el);

    const state = {
      el,
      svg: el.querySelector("svg"),
      gaze: el.querySelector(".gaze"),
      blinker: el.querySelector(".blinker"),
      mx: t.mx,
      my: t.my,
      pr: t.pr,
      cur: { x: 0, y: 0 },
      tar: { x: 0, y: 0 },
      busy: false,           // pause tracking during a gag
      cfg,
    };
    eyeStates.push(state);

    const fire = () => (cfg.door ? openDoor(state) : trick(state));
    el.addEventListener("click", fire);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fire(); }
    });

    return state;
  }

  EYES.forEach(buildEye);

  /* ---------- cursor tracking ---------- */
  const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  window.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener("touchmove", (e) => {
    if (e.touches[0]) { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; }
  }, { passive: true });

  function computeTargets() {
    for (const s of eyeStates) {
      if (s.busy) continue;
      const r = s.el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = mouse.x - cx;
      const dy = mouse.y - cy;
      const dist = Math.hypot(dx, dy) || 1;
      // ease in the gaze: fully extended once cursor is ~340px away
      const reach = Math.min(1, dist / 340);
      s.tar.x = (dx / dist) * s.mx * reach;
      s.tar.y = (dy / dist) * s.my * reach;
    }
  }

  function tick() {
    computeTargets();
    for (const s of eyeStates) {
      if (s.busy) continue;
      s.cur.x += (s.tar.x - s.cur.x) * 0.12;
      s.cur.y += (s.tar.y - s.cur.y) * 0.12;
      s.gaze.setAttribute("transform", `translate(${s.cur.x.toFixed(2)} ${s.cur.y.toFixed(2)})`);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ---------- helpers to drive the gaze with GSAP during gags ---------- */
  function gazeTo(s, x, y, opts = {}) {
    return gsap.to(s.cur, {
      x, y,
      duration: opts.duration ?? 0.3,
      ease: opts.ease ?? "power2.out",
      onUpdate: () => s.gaze.setAttribute("transform", `translate(${s.cur.x.toFixed(2)} ${s.cur.y.toFixed(2)})`),
    });
  }
  function blink(s, times = 1, speed = 0.12) {
    const tl = gsap.timeline();
    for (let i = 0; i < times; i++) {
      tl.to(s.blinker, { scaleY: 1, duration: speed, ease: "power1.in" })
        .to(s.blinker, { scaleY: 0, duration: speed, ease: "power1.out" });
    }
    return tl;
  }

  /* ---------- fake eye: goblin trick ---------- */
  const GAGS = ["blink", "rollUp", "cross", "spin", "shake"];

  function trick(s) {
    if (s.busy || locked) return;
    s.busy = true;
    hideHint();
    const gag = GAGS[(uid + eyeStates.indexOf(s) + Math.floor(performance.now())) % GAGS.length];
    const done = () => { gsap.to(s.cur, { x: 0, y: 0, duration: 0.4, ease: "power2.out",
      onUpdate: () => s.gaze.setAttribute("transform", `translate(${s.cur.x} ${s.cur.y})`),
      onComplete: () => { s.busy = false; } }); };

    const tl = gsap.timeline({ onComplete: done });

    if (gag === "blink") {
      tl.add(blink(s, 3, 0.09));
    } else if (gag === "rollUp") {
      tl.add(gazeTo(s, 0, -s.my, { duration: 0.18 }))
        .add(gazeTo(s, s.mx, -s.my * 0.3, { duration: 0.18 }))
        .add(gazeTo(s, -s.mx, s.my, { duration: 0.18 }))
        .add(gazeTo(s, 0, -s.my, { duration: 0.18 }));
    } else if (gag === "cross") {
      // dart toward the screen centre like a cross-eyed look, then jitter
      const dir = s.cfg.x > 50 ? -1 : 1;
      tl.add(gazeTo(s, dir * s.mx, s.my * 0.4, { duration: 0.12, ease: "back.out(3)" }))
        .to(s.el, { rotation: `+=2`, duration: 0.05, yoyo: true, repeat: 5, transformOrigin: "50% 50%" }, "<");
    } else if (gag === "spin") {
      const o = { a: 0 };
      tl.to(o, { a: Math.PI * 2, duration: 0.6, ease: "power1.inOut",
        onUpdate: () => {
          s.cur.x = Math.cos(o.a) * s.mx; s.cur.y = Math.sin(o.a) * s.my;
          s.gaze.setAttribute("transform", `translate(${s.cur.x} ${s.cur.y})`);
        } });
    } else { // shake = "nope"
      tl.to(s.el, { x: -7, duration: 0.06, repeat: 5, yoyo: true })
        .to(s.el, { x: 0, duration: 0.08 })
        .add(blink(s, 1, 0.1), "<");
    }

    showToast(TRICK_MSGS[Math.floor((performance.now() / 53) % TRICK_MSGS.length)]);
  }

  /* ---------- real eye: zoom into the gallery ---------- */
  function openDoor(s) {
    if (locked) return;
    locked = true;
    s.busy = true;
    hideHint();

    const r = s.el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    // veil expands from the eye centre to cover the viewport
    const corners = [[0, 0], [window.innerWidth, 0], [0, window.innerHeight], [window.innerWidth, window.innerHeight]];
    const maxDist = Math.max(...corners.map(([px, py]) => Math.hypot(px - cx, py - cy)));
    const scale = (maxDist / 20) * 1.15; // veil base radius is 20px

    veil.style.left = cx + "px";
    veil.style.top = cy + "px";

    prepGallery(s.cfg.product);

    const tl = gsap.timeline({
      onComplete: () => {
        gallery.scrollTop = 0;
        focusCard(s.cfg.product);
        gsap.to(gallery, { opacity: 1, duration: 0.45, ease: "power2.out" });
        gsap.to(veil, { opacity: 0, duration: 0.5, delay: 0.15, ease: "power2.out",
          onComplete: () => { gsap.set(veil, { scale: 0, opacity: 1 }); } });
        locked = false;
      },
    });

    // pull the pupil wide open + zoom the whole eye in as we get sucked through it
    tl.to(s.gaze, { duration: 0.4, ease: "power2.in",
        onUpdate: () => s.gaze.setAttribute("transform", "translate(0 0)") }, 0)
      .to(s.svg, { scale: 9, duration: 0.7, ease: "power3.in", transformOrigin: "50% 50%" }, 0)
      .to(s.svg.querySelectorAll(".pupil"), { attr: { r: 80 }, duration: 0.6, ease: "power3.in" }, 0.05)
      .to(veil, { scale, duration: 0.7, ease: "power3.in" }, 0.18)
      .set(gallery, { className: "gallery is-open" });
  }

  function prepGallery(product) {
    gsap.set(gallery, { opacity: 0 });
    gallery.classList.add("is-open");
    gallery.setAttribute("aria-hidden", "false");
    document.querySelectorAll(".card.is-focus").forEach((c) => c.classList.remove("is-focus"));
  }

  function focusCard(product) {
    const card = document.getElementById("card-" + product);
    if (!card) return;
    card.classList.add("is-focus");
    if (window.matchMedia("(max-width: 860px)").matches) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  /* ---------- close gallery ---------- */
  function closeGallery() {
    gsap.killTweensOf(gallery);
    gsap.to(gallery, { opacity: 0, duration: 0.4, ease: "power2.in",
      onComplete: () => {
        gallery.classList.remove("is-open");
        gallery.setAttribute("aria-hidden", "true");
        // reset every eye that was opened
        eyeStates.forEach((s) => {
          gsap.set(s.svg, { scale: 1 });
          gsap.set(s.svg.querySelectorAll(".pupil"), { attr: { r: s.pr } });
          s.busy = false;
        });
      } });
  }
  backBtn.addEventListener("click", closeGallery);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && gallery.classList.contains("is-open")) closeGallery();
  });

  /* ---------- toast ---------- */
  let toastTimer;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1700);
  }

  /* ---------- hint fade ---------- */
  let hintGone = false;
  function hideHint() {
    if (hintGone) return;
    hintGone = true;
    gsap.to(hintEl, { opacity: 0, duration: 0.6 });
  }

  /* ---------- intro + idle life ---------- */
  if (!reduceMotion) {
    gsap.from(".eye", { scale: 0, opacity: 0, duration: 0.9, ease: "back.out(1.6)",
      stagger: { each: 0.08, from: "random" }, delay: 0.15 });
    gsap.from(".hero__kicker, .hero__sub", { y: 16, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.1, delay: 0.2 });

    // occasional involuntary blink from a random calm eye
    const idleBlink = () => {
      const calm = eyeStates.filter((s) => !s.busy && !locked);
      if (calm.length) {
        const s = calm[Math.floor((performance.now() / 97) % calm.length)];
        s.busy = true;
        blink(s, 1, 0.1).eventCallback("onComplete", () => { s.busy = false; });
      }
      gsap.delayedCall(2.4 + (performance.now() % 9) / 3, idleBlink);
    };
    gsap.delayedCall(3, idleBlink);
  }
})();
