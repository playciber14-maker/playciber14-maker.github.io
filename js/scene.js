// 3D-фон: «ядро» из частиц с шумовой деформацией, каркасная оболочка, кольца и звёздное поле.
// Реагирует на мышь и прокрутку. На слабых устройствах облегчается, без WebGL — CSS-градиент.

import * as THREE from "three";

const canvas = document.getElementById("scene");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isSmall = window.matchMedia("(max-width: 767px)").matches;
const lowPower = isSmall || (navigator.hardwareConcurrency || 8) <= 4;

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

if (!canvas || !hasWebGL()) {
  document.documentElement.classList.add("no-webgl");
} else {
  try {
    init();
  } catch (err) {
    console.error("3D-сцена не запустилась:", err);
    document.documentElement.classList.add("no-webgl");
  }
}

function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2));
  renderer.setClearColor(0x05060a, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05060a, 0.045);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 7);

  const ACCENT = new THREE.Color("#3cf2d6");
  const ACCENT_2 = new THREE.Color("#8b6cff");

  // Группа, которую двигаем целиком
  const rig = new THREE.Group();
  scene.add(rig);

  /* ---------- Ядро из частиц ---------- */
  const detail = lowPower ? 22 : 40;
  const coreGeo = new THREE.IcosahedronGeometry(1.5, detail);
  const coreMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uColorA: { value: ACCENT },
      uColorB: { value: ACCENT_2 },
      uPulse: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uPulse;
      varying float vNoise;

      // 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT)
      vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
      vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
      vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
      vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
      float snoise(vec3 v){
        const vec2 C=vec2(1.0/6.0,1.0/3.0);
        const vec4 D=vec4(0.0,0.5,1.0,2.0);
        vec3 i=floor(v+dot(v,C.yyy));
        vec3 x0=v-i+dot(i,C.xxx);
        vec3 g=step(x0.yzx,x0.xyz);
        vec3 l=1.0-g;
        vec3 i1=min(g.xyz,l.zxy);
        vec3 i2=max(g.xyz,l.zxy);
        vec3 x1=x0-i1+C.xxx;
        vec3 x2=x0-i2+C.yyy;
        vec3 x3=x0-D.yyy;
        i=mod289(i);
        vec4 p=permute(permute(permute(
          i.z+vec4(0.0,i1.z,i2.z,1.0))
          +i.y+vec4(0.0,i1.y,i2.y,1.0))
          +i.x+vec4(0.0,i1.x,i2.x,1.0));
        float n_=0.142857142857;
        vec3 ns=n_*D.wyz-D.xzx;
        vec4 j=p-49.0*floor(p*ns.z*ns.z);
        vec4 x_=floor(j*ns.z);
        vec4 y_=floor(j-7.0*x_);
        vec4 x=x_*ns.x+ns.yyyy;
        vec4 y=y_*ns.x+ns.yyyy;
        vec4 h=1.0-abs(x)-abs(y);
        vec4 b0=vec4(x.xy,y.xy);
        vec4 b1=vec4(x.zw,y.zw);
        vec4 s0=floor(b0)*2.0+1.0;
        vec4 s1=floor(b1)*2.0+1.0;
        vec4 sh=-step(h,vec4(0.0));
        vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
        vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
        vec3 p0=vec3(a0.xy,h.x);
        vec3 p1=vec3(a0.zw,h.y);
        vec3 p2=vec3(a1.xy,h.z);
        vec3 p3=vec3(a1.zw,h.w);
        vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
        p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
        vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
        m=m*m;
        return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
      }

      void main(){
        vec3 p = position;
        float n = snoise(normalize(p) * 1.4 + vec3(0.0, uTime * 0.18, uTime * 0.12));
        float n2 = snoise(normalize(p) * 3.2 - vec3(uTime * 0.25));
        float d = n * 0.32 + n2 * 0.08 + uPulse * 0.15;
        p += normalize(p) * d;
        vNoise = n;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (2.2 + n * 1.4) * uPixelRatio * (6.0 / -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying float vNoise;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float r = length(c);
        if (r > 0.5) discard;
        float glow = smoothstep(0.5, 0.0, r);
        vec3 col = mix(uColorB, uColorA, smoothstep(-0.6, 0.6, vNoise));
        gl_FragColor = vec4(col, glow * 0.55);
      }
    `,
  });
  const core = new THREE.Points(coreGeo, coreMat);
  rig.add(core);

  /* ---------- Каркасная оболочка ---------- */
  const shell = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.35, 1)),
    new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.16 })
  );
  rig.add(shell);

  /* ---------- Кольца ---------- */
  const ringMat = (color, opacity) =>
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.006, 8, 200), ringMat(ACCENT_2, 0.55));
  ring1.rotation.set(1.2, 0.3, 0);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.004, 8, 200), ringMat(ACCENT, 0.35));
  ring2.rotation.set(-0.9, -0.6, 0.4);
  rig.add(ring1, ring2);

  // Спутники на кольцах
  const satGeo = new THREE.SphereGeometry(0.045, 12, 12);
  const sat1 = new THREE.Mesh(satGeo, new THREE.MeshBasicMaterial({ color: ACCENT_2 }));
  const sat2 = new THREE.Mesh(satGeo, new THREE.MeshBasicMaterial({ color: ACCENT }));
  ring1.add(sat1);
  ring2.add(sat2);

  /* ---------- Звёздное поле ---------- */
  const starCount = lowPower ? 900 : 2200;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 8 + Math.random() * 30;
    const t = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(ph) * Math.cos(t);
    starPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(t);
    starPos[i * 3 + 2] = r * Math.cos(ph) - 10;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0x9aa6c4, size: 0.05, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false })
  );
  scene.add(stars);

  /* ---------- Размер ---------- */
  let layoutX = 0;
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    coreMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    // На широких экранах ядро справа от текста, на узких — по центру и мельче
    // Половина видимой ширины сцены на глубине ядра (камера на z=7)
    const halfW = 7 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    layoutX = w >= 900 ? halfW * 0.6 : halfW * 0.5; // на телефоне ядро выглядывает справа
    const s = w >= 1300 ? 1 : w >= 900 ? 0.82 : w >= 560 ? 0.8 : 0.66;
    rig.scale.setScalar(s);
  }
  resize();
  window.addEventListener("resize", resize);

  /* ---------- Мышь и прокрутка ---------- */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener(
    "pointermove",
    (e) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true }
  );

  let scrollP = 0;
  let scrollTarget = 0;
  const readScroll = () => {
    scrollTarget = Math.min(window.scrollY / window.innerHeight, 2);
  };
  readScroll();
  window.addEventListener("scroll", readScroll, { passive: true });

  // Пульс при клике по кнопкам
  let pulse = 0;
  document.addEventListener("click", (e) => {
    if (e.target.closest(".btn")) pulse = 1;
  });

  /* ---------- Цикл ---------- */
  const start = performance.now();
  let running = true;

  function frame() {
    const t = (performance.now() - start) / 1000;

    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    scrollP += (scrollTarget - scrollP) * 0.08;
    pulse *= 0.94;

    const p1 = Math.min(scrollP, 1); // 0..1 в пределах первого экрана

    coreMat.uniforms.uTime.value = t;
    coreMat.uniforms.uPulse.value = pulse;

    core.rotation.y = t * 0.08 + mouse.x * 0.4;
    core.rotation.x = mouse.y * 0.25;
    shell.rotation.y = -t * 0.05 + mouse.x * 0.2;
    shell.rotation.z = t * 0.03;
    ring1.rotation.z = t * 0.12;
    ring2.rotation.z = -t * 0.09;
    sat1.position.set(Math.cos(t * 0.7) * 3.1, Math.sin(t * 0.7) * 3.1, 0);
    sat2.position.set(Math.cos(-t * 0.5 + 2) * 3.6, Math.sin(-t * 0.5 + 2) * 3.6, 0);
    stars.rotation.y = t * 0.01 + mouse.x * 0.05;
    stars.rotation.x = mouse.y * 0.03;

    // Прокрутка: камера влетает в ядро, ядро уезжает в центр и вглубь
    rig.position.x = layoutX * (1 - p1);
    rig.position.y = p1 * 0.4;
    rig.rotation.x = scrollP * 0.6;
    camera.position.z = 7 - p1 * 1.6 + Math.max(scrollP - 1, 0) * 1.5;
    camera.position.x = mouse.x * 0.3;
    camera.position.y = -mouse.y * 0.2;
    camera.lookAt(rig.position.x * 0.5, 0, 0);

    // После первого экрана фон притухает, чтобы текст читался
    canvas.style.opacity = String(1 - p1 * 0.72);

    renderer.render(scene, camera);
  }

  function loop() {
    if (!running) return;
    frame();
    requestAnimationFrame(loop);
  }

  if (reduceMotion) {
    // Без анимации: один кадр + перерисовка при прокрутке и ресайзе
    frame();
    const redraw = () => requestAnimationFrame(frame);
    window.addEventListener("scroll", redraw, { passive: true });
    window.addEventListener("resize", redraw);
  } else {
    loop();
    document.addEventListener("visibilitychange", () => {
      const wasRunning = running;
      running = !document.hidden;
      if (running && !wasRunning) loop();
    });
  }

  // Если WebGL-контекст потерян — показываем запасной фон
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    running = false;
    document.documentElement.classList.add("no-webgl");
  });

}
