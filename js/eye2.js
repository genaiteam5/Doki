/* ============================================================
   DOKI — eyes wall interactions
   Drives the pre-built collage tiles in eye2.html:
   - every tile's pupils track the cursor (smooth lerp)
   - 4 doors (D=fan, C=umbrella, E=book, G=brand story) zoom into a page
   - the rest play a goblin trick + a teasing toast
   Requires GSAP.
   ============================================================ */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const TINTS = { fan: "#2E7D5B", umbrella: "#5B49B8", book: "#C0563B" };
  const TRICK_MSGS = [
    "낄낄… 그 눈은 가짜라네.",
    "속았지! 도깨비의 장난.",
    "여긴 문이 아니야 👀",
    "히죽, 헛다리짚었군.",
    "다른 눈을 찾아보게.",
    "그 눈은 졸고 있을 뿐.",
  ];

  const veil    = document.getElementById("veil");
  const toastEl = document.getElementById("toast");
  const hintEl  = document.getElementById("hint");

  // per-product veil colour for the zoom-in
  const VEIL = { fan: "#3DAB9B", umbrella: "#0E0E0E", book: "#0E0E0E", brand: "#3DAB9B" };

  let locked = false;
  let seq = 0;
  let openDetail = null;
  let opener = null;          // the eye state that opened the current page
  const eyeStates = [];

  /* ---------- wire up every eye tile ---------- */
  document.querySelectorAll(".eye").forEach((el) => {
    const gaze = el.querySelector(".gaze");
    const blinker = el.querySelector(".blinker");
    if (!gaze) return;
    const door = el.dataset.door === "true";
    const product = el.dataset.product || null;

    const state = {
      el, gaze, blinker,
      svg: el.querySelector("svg"),
      mx: parseFloat(el.dataset.mx) || 8,
      my: parseFloat(el.dataset.my) || 8,
      biasY: parseFloat(el.dataset.biasy) || 0,
      cur: { x: 0, y: 0 },
      tar: { x: 0, y: 0 },
      busy: false,
      door, product,
    };
    eyeStates.push(state);

    const fire = () => (door ? openDoor(state) : trick(state));
    el.addEventListener("click", fire);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fire(); }
    });
  });

  /* ---------- cursor tracking ---------- */
  const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  window.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener("touchmove", (e) => {
    if (e.touches[0]) { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; }
  }, { passive: true });

  function setGaze(s) {
    s.gaze.setAttribute("transform", `translate(${s.cur.x.toFixed(2)} ${s.cur.y.toFixed(2)})`);
  }

  function tick() {
    for (const s of eyeStates) {
      if (s.busy) continue;
      const r = s.el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = mouse.x - cx, dy = mouse.y - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, dist / 320);
      s.tar.x = (dx / dist) * s.mx * reach;
      s.tar.y = (dy / dist) * s.my * reach + s.biasY; // biasY: a resting upward look (umbrella)
      if (s.tar.y > s.my) s.tar.y = s.my;
      if (s.tar.y < -s.my) s.tar.y = -s.my;
      s.cur.x += (s.tar.x - s.cur.x) * 0.12;
      s.cur.y += (s.tar.y - s.cur.y) * 0.12;
      setGaze(s);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ---------- gag helpers ---------- */
  function gazeTo(s, x, y, opts = {}) {
    return gsap.to(s.cur, { x, y, duration: opts.duration ?? 0.3, ease: opts.ease ?? "power2.out",
      onUpdate: () => setGaze(s) });
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
    const gag = GAGS[(seq++ ) % GAGS.length];
    const done = () => gsap.to(s.cur, { x: 0, y: 0, duration: 0.4, ease: "power2.out",
      onUpdate: () => setGaze(s), onComplete: () => { s.busy = false; } });
    const tl = gsap.timeline({ onComplete: done });

    if (gag === "blink") {
      tl.add(blink(s, 3, 0.09));
    } else if (gag === "rollUp") {
      tl.add(gazeTo(s, 0, -s.my, { duration: 0.16 }))
        .add(gazeTo(s, s.mx, -s.my * 0.3, { duration: 0.16 }))
        .add(gazeTo(s, -s.mx, s.my, { duration: 0.16 }))
        .add(gazeTo(s, 0, -s.my, { duration: 0.16 }));
    } else if (gag === "cross") {
      const r = s.el.getBoundingClientRect();
      const dir = (r.left + r.width / 2) > window.innerWidth / 2 ? -1 : 1;
      tl.add(gazeTo(s, dir * s.mx, s.my * 0.4, { duration: 0.12, ease: "back.out(3)" }))
        .to(s.el, { rotation: "+=2", duration: 0.05, yoyo: true, repeat: 5, transformOrigin: "50% 50%" }, "<");
    } else if (gag === "spin") {
      const o = { a: 0 };
      tl.to(o, { a: Math.PI * 2, duration: 0.6, ease: "power1.inOut",
        onUpdate: () => { s.cur.x = Math.cos(o.a) * s.mx; s.cur.y = Math.sin(o.a) * s.my; setGaze(s); } });
    } else { // shake
      tl.to(s.el, { x: -7, duration: 0.06, repeat: 5, yoyo: true })
        .to(s.el, { x: 0, duration: 0.08 })
        .add(blink(s, 1, 0.1), "<");
    }
    showToast(TRICK_MSGS[seq % TRICK_MSGS.length]);
  }

  /* ---------- real eye: zoom into its own product page ---------- */
  function openDoor(s) {
    if (locked) return;
    locked = true;
    s.busy = true;
    hideHint();

    const product = s.product;
    const detail = document.getElementById("detail-" + product);
    if (!detail) { locked = false; s.busy = false; return; }
    opener = s;

    const r = s.el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const corners = [[0, 0], [innerWidth, 0], [0, innerHeight], [innerWidth, innerHeight]];
    const maxDist = Math.max(...corners.map(([px, py]) => Math.hypot(px - cx, py - cy)));
    const scale = (maxDist / 20) * 1.15;

    veil.style.background = VEIL[product] || "#0E0E0E";
    veil.style.left = cx + "px";
    veil.style.top = cy + "px";

    prepDetail(detail);

    const tl = gsap.timeline({
      onComplete: () => {
        detail.scrollTop = 0;
        gsap.to(detail, { opacity: 1, duration: 0.45, ease: "power2.out" });
        gsap.to(veil, { opacity: 0, duration: 0.5, delay: 0.15, ease: "power2.out",
          onComplete: () => gsap.set(veil, { scale: 0, opacity: 1 }) });
        // tell the 3D scenes / stage to wake up, then arm the magazine reveals
        window.dispatchEvent(new CustomEvent("doki:open", { detail: { product } }));
        if (window.__dokiActivateScene) window.__dokiActivateScene(product);
        initMag(detail);
        locked = false;
      },
    });

    // umbrella: the upward gaze rolls back to centre before being pulled in
    let z = 0;
    if (product === "umbrella") {
      tl.add(gazeTo(s, 0, -s.my, { duration: 0.22, ease: "power2.out" }))
        .add(gazeTo(s, 0, 0, { duration: 0.30, ease: "power2.inOut" }));
      z = 0.52;
    } else {
      tl.to(s.gaze, { duration: 0.3, onUpdate: () => setGaze(s) }, 0);
    }
    tl.to(s.svg, { scale: 9, duration: 0.7, ease: "power3.in", transformOrigin: "50% 50%" }, z)
      .to(veil, { scale, duration: 0.7, ease: "power3.in" }, z + 0.18);
  }

  function prepDetail(detail) {
    gsap.set(detail, { opacity: 0 });
    detail.classList.add("is-open");
    detail.setAttribute("aria-hidden", "false");
    openDetail = detail;
  }
  function closeDetail() {
    const detail = openDetail;
    if (!detail) return;
    const product = detail.id.replace("detail-", "");
    window.dispatchEvent(new CustomEvent("doki:close", { detail: { product } }));
    gsap.killTweensOf(detail);
    // page fades while the giant eye smoothly scales back into the 9-grid
    if (opener) gsap.to(opener.svg, { scale: 1, duration: 0.7, ease: "power3.out" });
    gsap.to(detail, { opacity: 0, duration: 0.45, ease: "power2.in",
      onComplete: () => {
        detail.classList.remove("is-open");
        detail.setAttribute("aria-hidden", "true");
        eyeStates.forEach((s) => { gsap.set(s.svg, { scale: 1 }); s.busy = false; });
        openDetail = null; opener = null;
      } });
  }
  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeDetail));
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && openDetail) closeDetail(); });

  /* ---------- magazine scroll reveals (GSAP ScrollTrigger) ---------- */
  const hasST = !!window.ScrollTrigger;
  if (hasST) gsap.registerPlugin(window.ScrollTrigger);
  function initMag(detail) {
    if (detail._magDone || !hasST) return;
    detail._magDone = true;
    detail.querySelectorAll(".sw-mag [data-rise]").forEach((el) => {
      gsap.from(el, { opacity: 0, y: 64, duration: 1, ease: "power3.out",
        scrollTrigger: { trigger: el, scroller: detail, start: "top 90%", once: true } });
    });
    window.ScrollTrigger.refresh();
  }

  /* ---------- toast + hint ---------- */
  let toastTimer;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1700);
  }
  let hintGone = false;
  function hideHint() {
    if (hintGone) return;
    hintGone = true;
    gsap.to(hintEl, { opacity: 0, duration: 0.6 });
  }

  /* ---------- intro + idle blink ---------- */
  if (!reduceMotion) {
    gsap.from(".tile", { opacity: 0, duration: 0.7, ease: "power2.out",
      stagger: { each: 0.06, from: "random" } });
    const idleBlink = () => {
      const calm = eyeStates.filter((s) => !s.busy && !locked);
      if (calm.length) {
        const s = calm[Math.floor((performance.now() / 97) % calm.length)];
        s.busy = true;
        blink(s, 1, 0.1).eventCallback("onComplete", () => { s.busy = false; });
      }
      gsap.delayedCall(2.6 + (performance.now() % 9) / 3, idleBlink);
    };
    gsap.delayedCall(3, idleBlink);
  }
})();
