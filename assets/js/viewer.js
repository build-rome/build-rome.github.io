/* Interactive scene viewer: a glTF mesh (meshopt-compressed) in the paper's
   flat-shaded normal colouring, orbit controls that
   start at the input photo's camera, and a "Loading NN%" badge on a white
   stage while the mesh downloads.

   Markup:
     <div class="viewer" data-base="assets/demo" data-scene="<stem>">…</div>
   with assets/demo/<stem>/{<stem>_hi.glb, ref_camera.json, input.jpg, thumb.jpg}.
   Sibling .demo-thumb[data-scene] buttons switch scenes. Nothing loads until the
   viewer scrolls into view, so the page stays light. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

// Camera-space normal colours exactly as the paper figures and the videos
// (build_rome MeshRenderer "normal"): the normal in the OpenCV camera frame
// (x right, y down, z forward), flipped so it points AWAY from the camera
// (dot(n, p) > 0), then (n + 1) / 2. GL camera space is (x right, y up,
// z backward), so OpenCV = (x, -y, -z).
const normalMaterial = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  vertexShader: `
    varying vec3 vP;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vP = mv.xyz;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    varying vec3 vP;
    void main() {
      // flat per-face normal from screen-space derivatives (the renders are flat-shaded too;
      // interpolated vertex normals flip near silhouettes and speckle)
      vec3 nGL = normalize(cross(dFdx(vP), dFdy(vP)));
      vec3 n = vec3(nGL.x, -nGL.y, -nGL.z);       // GL camera space -> OpenCV camera frame
      vec3 p = vec3(vP.x, -vP.y, -vP.z);
      if (dot(n, p) < 0.0) n = -n;                // the renders keep the normal pointing away from the camera
      gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
    }`,
});

async function start(el) {
  const base = el.dataset.base;
  el.classList.add("is-loading");
  const W = el.clientWidth, H = el.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  el._viewer = { renderer };                            // for debugging / tests
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(W, H);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0xffffff, 1);                   // white, like the renders
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  let ref = await (await fetch(`${base}/${el.dataset.scene}/ref_camera.json`)).json();
  const camera = new THREE.PerspectiveCamera(ref.fov, W / H, 0.05, 2000);
  camera.position.set(...ref.pos);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...ref.target);
  controls.enableDamping = true;
  // idle motion: a slow swing of +-30 degrees around the home view (never behind the
  // scene). Any input pauses it; it resumes, from the current view, after 4 idle seconds.
  const SWING_DEG = 30, SWING_PERIOD_S = 24;
  let idle = true, idleTimer = null, swingT0 = null, swingBase = 0;
  const pauseSwing = () => { idle = false; clearTimeout(idleTimer); idleTimer = setTimeout(() => { idle = true; swingT0 = null; }, 4000); };
  for (const ev of ["pointerdown", "wheel", "keydown", "touchstart"]) renderer.domElement.addEventListener(ev, pauseSwing, { passive: true });
  const offset = new THREE.Vector3();
  function swing(now) {
    if (!idle) return;
    const az = controls.getAzimuthalAngle();
    if (swingT0 === null) { swingT0 = now; swingBase = az; }
    const target = swingBase + THREE.MathUtils.degToRad(SWING_DEG) * Math.sin((now - swingT0) / 1000 / SWING_PERIOD_S * 2 * Math.PI);
    const delta = target - az;
    // rotate the camera about the target's vertical axis by delta
    offset.copy(camera.position).sub(controls.target);
    const c = Math.cos(delta), s_ = Math.sin(delta);
    offset.set(offset.x * c + offset.z * s_, offset.y, -offset.x * s_ + offset.z * c);
    camera.position.copy(controls.target).add(offset);
    camera.lookAt(controls.target);
  }

  // WASD (+ Q/E down/up, Shift = faster) flies the camera; the orbit target moves with
  // it so mouse orbiting keeps working from the new position. Keys are listened to
  // on the viewer element (click it first) so they never hijack the page.
  renderer.domElement.tabIndex = 0;
  renderer.domElement.style.outline = "none";
  const keys = new Set();
  renderer.domElement.addEventListener("keydown", (e) => {
    if ("wasdqeWASDQE".includes(e.key) && e.key.length === 1) { keys.add(e.key.toLowerCase()); e.preventDefault(); }
    if (e.key === "Shift") keys.add("shift");
  });
  renderer.domElement.addEventListener("keyup", (e) => { keys.delete(e.key.toLowerCase()); if (e.key === "Shift") keys.delete("shift"); });
  renderer.domElement.addEventListener("blur", () => keys.clear());
  renderer.domElement.addEventListener("pointerdown", () => renderer.domElement.focus());
  const clock = new THREE.Clock();
  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), move = new THREE.Vector3();
  let sceneScale = 10;                                    // metres; set from the mesh bbox once it loads
  function fly() {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!keys.size) return;
    // cross the scene in ~6 s at normal speed (Shift: 3x); small rooms walk, big landmarks fly
    const speed = Math.max(0.5, sceneScale / 6) * (keys.has("shift") ? 3 : 1) * dt;
    camera.getWorldDirection(fwd);
    right.crossVectors(fwd, camera.up).normalize();
    move.set(0, 0, 0);
    if (keys.has("w")) move.add(fwd);
    if (keys.has("s")) move.sub(fwd);
    if (keys.has("d")) move.add(right);
    if (keys.has("a")) move.sub(right);
    if (keys.has("e")) move.y += 1;
    if (keys.has("q")) move.y -= 1;
    if (move.lengthSq() === 0) return;
    move.normalize().multiplyScalar(speed);
    camera.position.add(move);
    controls.target.add(move);
  }

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let current = null, generation = 0, lastPivotGen = -1;
  const dispose = (root) => root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  const show = (gen) => (gltf) => {
    if (gen !== generation) { dispose(gltf.scene); return; }      // a newer scene was requested
    gltf.scene.traverse((o) => { if (o.isMesh) o.material = normalMaterial; });
    if (current) { scene.remove(current); dispose(current); }
    current = gltf.scene;
    scene.add(current);
    const bb = new THREE.Box3().setFromObject(current);
    sceneScale = bb.getSize(new THREE.Vector3()).length();   // bbox diagonal, metres
    el._viewer.sceneScale = sceneScale;
    const firstLevel = pivot === null;
    pivot = bb.getCenter(new THREE.Vector3());
    if (firstLevel || gen !== lastPivotGen) { lastPivotGen = gen; goHome(); }
    camera.far = Math.max(2000, sceneScale * 20); camera.updateProjectionMatrix();
    el._viewer.scene = scene; el._viewer.camera = camera; el._viewer.controls = controls;
    renderer.render(scene, camera);                         // draw once before revealing (no white flash)
    el.classList.remove("is-loading");
  };
  let pivot = null;                                       // scene centre (bbox), set when the mesh loads
  const goHome = () => {
    swingT0 = null;
    if (typeof clearMeasure === "function") clearMeasure();
    // input-photo pose, but orbiting around the scene centre: the target is the point on the
    // view ray closest to the scene centre (so the view is unchanged and rotation feels right)
    camera.position.set(...ref.pos);
    const dir = new THREE.Vector3(...ref.target).sub(camera.position).normalize();
    let t = 10;
    if (pivot) t = Math.max(0.5, pivot.clone().sub(camera.position).dot(dir));
    controls.target.copy(camera.position).addScaledVector(dir, t);
    controls.update();
  };
  async function loadScene(stem) {
    const gen = ++generation;
    el.classList.add("is-loading");
    el.dataset.scene = stem;
    // drop the old mesh right away; .is-loading hides the canvas so a blank stage with the
    // loading badge shows instead of the previous scene still swinging
    if (current) { scene.remove(current); dispose(current); current = null; }
    // white stage + "Loading NN%" until the full-detail mesh is in (no low-res stand-in, no poster);
    // the mesh request starts right away, in parallel with the (tiny) camera file
    el.dataset.progress = "";
    const refReq = fetch(`${base}/${stem}/ref_camera.json`).then((r) => r.json());
    const meshReq = new Promise((resolve, reject) => loader.load(`${base}/${stem}/${stem}_hi.glb`, resolve,
      (xhr) => { if (gen === generation && xhr.lengthComputable) el.dataset.progress = `${Math.min(99, Math.round(100 * xhr.loaded / xhr.total))}%`; },
      reject));
    ref = await refReq;
    if (gen !== generation) return;
    camera.fov = ref.fov; camera.updateProjectionMatrix();
    pivot = null;
    goHome();
    meshReq.then(show(gen), (e) => console.warn("viewer: load failed", e));
  }
  el._viewer.loadScene = loadScene;
  loadScene(el.dataset.scene);

  const reset = el.querySelector(".viewer-reset");
  if (reset) reset.addEventListener("click", goHome);

  // --- measure: pick two points on the mesh and show their distance (the meshes are metric) ---
  const measureBtn = el.querySelector(".viewer-measure");
  const label = document.createElement("div");
  label.className = "viewer-measure-label";
  label.hidden = true;
  el.appendChild(label);
  const raycaster = new THREE.Raycaster();
  const MEASURE = 0xff9a86;                               // coral, reads on the blue/green/pink normal colours
  const markerMat = new THREE.MeshBasicMaterial({ color: MEASURE, depthTest: false, depthWrite: false });
  const lineMat = new THREE.LineBasicMaterial({ color: MEASURE, depthTest: false, depthWrite: false });
  let measuring = false, pts = [], markers = [], line = null;
  function clearMeasure() {
    markers.forEach((m) => scene.remove(m));
    if (line) { scene.remove(line); line.geometry.dispose(); }
    pts = []; markers = []; line = null; label.hidden = true;
  }
  function setMeasuring(on) {
    measuring = on;
    if (measureBtn) { measureBtn.classList.toggle("is-active", on); measureBtn.setAttribute("aria-pressed", on); }
    el.classList.toggle("is-measuring", on);
    if (!on) clearMeasure();
  }
  if (measureBtn) measureBtn.addEventListener("click", () => setMeasuring(!measuring));
  renderer.domElement.addEventListener("keydown", (e) => { if (e.key === "Escape" && measuring) setMeasuring(false); });
  const ndc = new THREE.Vector2();
  function pick(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(current, true)[0];
    if (!hit) return;
    if (pts.length === 2) clearMeasure();                 // a third click starts a new measurement
    pts.push(hit.point.clone());
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), markerMat);
    m.position.copy(hit.point); m.renderOrder = 10;
    scene.add(m); markers.push(m);
    if (pts.length === 2) {
      line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat);
      line.renderOrder = 9;
      scene.add(line);
      label.textContent = `${pts[0].distanceTo(pts[1]).toFixed(2)} m`;
      label.hidden = false;
    }
  }
  // a click is a pointerdown/up pair that barely moved (so orbit drags never place points)
  let downX = 0, downY = 0;
  renderer.domElement.addEventListener("pointerdown", (e) => { downX = e.clientX; downY = e.clientY; });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!measuring || !current || e.button !== 0) return;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 4) return;
    pick(e);
  });
  const mid = new THREE.Vector3();
  function updateMeasure() {
    // markers keep a constant on-screen size; the label sits at the line's midpoint
    for (const m of markers) m.scale.setScalar(m.position.distanceTo(camera.position) * 0.006);
    if (pts.length !== 2) return;
    mid.addVectors(pts[0], pts[1]).multiplyScalar(0.5).project(camera);
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    label.style.left = `${(mid.x + 1) / 2 * w}px`;
    label.style.top = `${(1 - mid.y) / 2 * h}px`;
    label.hidden = mid.z > 1;                               // behind the camera
  }
  const onResize = () => {
    const w = el.clientWidth, h = el.clientHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
  };
  addEventListener("resize", onResize);
  let visible = true;
  const loop = (now) => { if (!visible) return; fly(); swing(now); controls.update(); updateMeasure(); renderer.render(scene, camera); };
  renderer.setAnimationLoop(loop);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      const v = entries.some((e) => e.isIntersecting);
      if (v !== visible) { visible = v; swingT0 = null; renderer.setAnimationLoop(v ? loop : null); }
      el._viewer.visible = visible;
    }, { rootMargin: "100px" }).observe(el);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) swingT0 = null; });
}

document.querySelectorAll(".viewer").forEach((el) => {
  const btn = el.querySelector(".viewer-start");
  const demo = el.closest(".demo");
  const thumbs = demo ? [...demo.querySelectorAll(".demo-thumb")] : [];
  let started = null;
  const begin = () => { if (!started) { if (btn) btn.remove(); started = start(el); } return started; };
  // start as soon as the viewer scrolls into view (no button); fall back to the button if present and no IO
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { io.disconnect(); begin(); } }, { rootMargin: "200px" });
    io.observe(el);
    if (btn) btn.addEventListener("click", begin, { once: true });
  } else if (btn) btn.addEventListener("click", begin, { once: true });
  else begin();
  // hover preview: the input photo at a readable size, floating above the hovered thumbnail
  if (demo && thumbs.length) {                          // hidden on touch devices by CSS (hover: none)
    const pv = document.createElement("figure");
    pv.className = "demo-preview";
    pv.innerHTML = "<img alt=\"\">";
    demo.style.position = "relative";
    demo.appendChild(pv);
    const pvImg = pv.querySelector("img");
    thumbs.forEach((t) => {
      t.addEventListener("pointerenter", () => {
        pvImg.src = `${el.dataset.base}/${t.dataset.scene}/input.jpg`;   // the strip shows 128 px thumbs
        const r = t.getBoundingClientRect(), d = demo.getBoundingClientRect();
        // centred over the thumbnail, bottom edge just above it, kept inside the demo block
        const x = Math.min(Math.max(r.left + r.width / 2 - d.left, 136), d.width - 136);
        pv.style.left = `${x}px`;
        pv.style.top = `${r.top - d.top}px`;
        pv.classList.add("is-on");
      });
      t.addEventListener("pointerleave", () => pv.classList.remove("is-on"));
    });
  }
  thumbs.forEach((t) => t.addEventListener("click", async () => {
    thumbs.forEach((x) => x.classList.toggle("is-active", x === t));
    const stem = t.dataset.scene;
    if (!started) {                      // not started yet: just retarget the first load
      el.dataset.scene = stem;
      return;
    }
    await started;
    el._viewer.loadScene(stem);
  }));
});
