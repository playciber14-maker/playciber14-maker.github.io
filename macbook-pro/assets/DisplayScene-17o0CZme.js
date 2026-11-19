import{o as e,p as t,s as n,u as r}from"./index-600fD0UX.js";import{Jt as i,_t as a,h as o,u as s}from"./events-e51d7528.esm-tagcHqY6.js";import{t as c}from"./MacBook-3SH8hwlQ.js";import{u as l,y as u}from"./textures-D-kYtN71.js";var d=t(r(),1),f=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`,p=`
  precision highp float;
  uniform float uTime;
  uniform float uFrom;
  uniform float uTo;
  uniform float uMix;
  uniform float uAspect;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
    return v;
  }
  float stars(vec2 uv, float density) {
    vec2 g = uv * density;
    vec2 id = floor(g);
    float h = hash(id);
    vec2 c = fract(g) - 0.5 - (vec2(hash(id + 1.3), hash(id + 7.1)) - 0.5) * 0.6;
    float s = smoothstep(0.06, 0.0, length(c)) * step(0.92, h);
    return s * (0.6 + 0.4 * sin(uTime * 2.0 + h * 40.0));
  }

  vec3 aurora(vec2 uv) {
    vec3 col = mix(vec3(0.004, 0.01, 0.03), vec3(0.01, 0.04, 0.07), uv.y);
    col += stars(uv * vec2(uAspect, 1.0), 60.0) * 0.8;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float x = uv.x * (1.6 + fi * 0.4) + uTime * (0.04 + fi * 0.015);
      float band = fbm(vec2(x, fi * 3.1 + uTime * 0.05));
      float y = 0.45 + band * 0.4 - fi * 0.08;
      float curtain = smoothstep(y - 0.35, y, uv.y) * smoothstep(y + 0.04, y, uv.y);
      float rays = 0.6 + 0.4 * sin(uv.x * 90.0 + band * 20.0 + uTime);
      vec3 tint = mix(vec3(0.1, 1.0, 0.55), vec3(0.15, 0.6, 1.0), fi * 0.5 + uv.y * 0.3);
      col += tint * curtain * rays * (0.55 - fi * 0.12);
    }
    float hills = 0.12 + fbm(vec2(uv.x * 3.0, 1.0)) * 0.12;
    col = mix(col, vec3(0.0), smoothstep(hills + 0.005, hills, uv.y));
    return col;
  }

  vec3 ocean(vec2 uv) {
    vec2 p = uv * vec2(uAspect, 1.0) * 3.0;
    float t = uTime * 0.25;
    float c = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 q = p + vec2(fbm(p + t + fi), fbm(p - t * 0.7 + fi * 2.0));
      c += pow(1.0 - abs(sin(fbm(q * 1.7) * 9.0)), 6.0) * (0.5 - fi * 0.12);
    }
    vec3 deep = mix(vec3(0.0, 0.03, 0.08), vec3(0.0, 0.16, 0.32), uv.y);
    vec3 col = deep + vec3(0.25, 0.65, 1.0) * c * (0.4 + uv.y * 0.8);
    col += vec3(0.4, 0.75, 1.0) * pow(max(0.0, 1.0 - length(uv - vec2(0.5, 1.15))), 4.0) * 0.8;
    return col;
  }

  vec3 dunes(vec2 uv) {
    vec3 sky = mix(vec3(0.98, 0.55, 0.25), vec3(0.18, 0.12, 0.28), smoothstep(0.35, 1.0, uv.y));
    vec2 sp = vec2(0.68, 0.48 + sin(uTime * 0.05) * 0.02);
    float sun = smoothstep(0.08, 0.075, length((uv - sp) * vec2(uAspect, 1.0)));
    vec3 col = sky + vec3(1.0, 0.85, 0.6) * sun;
    col += vec3(1.0, 0.6, 0.3) * pow(max(0.0, 1.0 - length((uv - sp) * vec2(uAspect, 1.0))), 6.0) * 0.6;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float h = 0.42 - fi * 0.09 + sin(uv.x * (3.0 + fi * 1.7) + fi * 2.0 + uTime * 0.02 * (fi + 1.0)) * 0.05 + fbm(vec2(uv.x * 4.0 + fi, fi)) * 0.05;
      vec3 sand = mix(vec3(0.75, 0.38, 0.18), vec3(0.22, 0.08, 0.05), fi / 3.0);
      float lit = 0.75 + 0.25 * sin(uv.x * 12.0 + fi);
      col = mix(col, sand * lit, smoothstep(h + 0.004, h, uv.y));
    }
    return col;
  }

  vec3 nebula(vec2 uv) {
    vec2 p = (uv - 0.5) * vec2(uAspect, 1.0) * 2.2;
    float t = uTime * 0.03;
    float n = fbm(p * 1.4 + vec2(t, -t));
    float m = fbm(p * 2.6 - n * 1.5 + t);
    vec3 col = vec3(0.005, 0.005, 0.02);
    col += vec3(0.85, 0.2, 0.55) * pow(m, 3.0) * 1.8;
    col += vec3(0.15, 0.45, 1.0) * pow(n, 2.5) * 1.4;
    col += vec3(1.0, 0.85, 0.7) * pow(max(0.0, m * n), 4.0) * 3.0;
    col += stars(uv * vec2(uAspect, 1.0), 90.0);
    return col;
  }

  vec3 sceneColor(float id, vec2 uv) {
    if (id < 0.5) return aurora(uv);
    if (id < 1.5) return ocean(uv);
    if (id < 2.5) return dunes(uv);
    return nebula(uv);
  }

  void main() {
    vec2 uv = vUv;
    vec3 a = sceneColor(uFrom, uv);
    vec3 b = sceneColor(uTo, uv);
    vec3 col = mix(a, b, smoothstep(0.0, 1.0, uMix));
    // a soft moving reflection across the glass
    float sweep = smoothstep(0.12, 0.0, abs(uv.x - uv.y * 0.35 - fract(uTime * 0.05) * 1.8 + 0.4));
    col += vec3(1.0) * sweep * 0.035;
    // gentle vignette
    col *= 0.85 + 0.15 * smoothstep(0.9, 0.3, length(uv - 0.5));
    // colours are authored directly in display space
    gl_FragColor = vec4(col, 1.0);
  }
`;function m(){return new i({vertexShader:f,fragmentShader:p,uniforms:{uTime:{value:0},uFrom:{value:0},uTo:{value:0},uMix:{value:1},uAspect:{value:1.53}},toneMapped:!1})}var h=n();function g({scene:t,reduced:n,low:r}){let i=(0,d.useRef)({lid:Math.PI/2+.06,explode:0}),f=(0,d.useMemo)(()=>m(),[]),p=(0,d.useRef)(t),{camera:g,size:_}=o();return(0,d.useEffect)(()=>()=>f.dispose(),[f]),(0,d.useEffect)(()=>{if(p.current===t)return;let r=f.uniforms;r.uFrom.value=p.current,r.uTo.value=t,r.uMix.value=0,p.current=t;let i=e.to(r.uMix,{value:1,duration:n?.01:1.4,ease:`power2.inOut`});return()=>void i.kill()},[t,f,n]),s(e=>{f.uniforms.uTime.value=n?8:e.clock.elapsedTime;let t=_.width/Math.max(1,_.height),r=Math.tan(a.degToRad(15)),i=2.25/(2*r),o=3.25/(2*r*t),s=Math.max(i,o),c=e.clock.elapsedTime,u=+!n,d=l.baseH+1.07;g.position.set(Math.sin(c*.15)*.25*u,d+Math.sin(c*.11)*.05*u,l.hingeZ+s),g.lookAt(0,d,l.hingeZ)}),(0,h.jsxs)(h.Fragment,{children:[(0,h.jsx)(u,{intensity:.55}),(0,h.jsx)(c,{drive:i,screenMaterial:f,low:r,followSize:!1})]})}export{g as default};