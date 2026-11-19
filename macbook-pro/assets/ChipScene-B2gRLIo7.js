import{p as e,s as t,u as n}from"./index-600fD0UX.js";import{At as r,Jt as i,X as a,_t as o,u as s,w as c,wt as l}from"./events-e51d7528.esm-tagcHqY6.js";import{t as u}from"./RoundedBox-CCJ_-FJJ.js";import{c as d,m as f,r as p,y as m}from"./textures-D-kYtN71.js";import{t as h}from"./Dust-5biFWCP_.js";var g=e(n(),1),_=t(),v=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`,y=`
  uniform sampler2D uMask;
  uniform float uTime;
  uniform float uEnergy;
  varying vec2 vUv;
  void main() {
    float mask = texture2D(uMask, vUv).r;
    float d = length(vUv - 0.5);
    float wave = fract(d * 2.6 - uTime * 0.32);
    float pulse = smoothstep(0.0, 0.06, wave) * (1.0 - smoothstep(0.06, 0.22, wave));
    float fade = 1.0 - smoothstep(0.18, 0.5, d);
    vec3 base = vec3(0.10, 0.16, 0.24) * mask * 0.45;
    vec3 glow = vec3(0.16, 0.59, 1.0) * mask * pulse * (0.6 + uEnergy * 1.6) * 1.25; // peaks pass 1 so the pulses bloom
    gl_FragColor = vec4((base + glow) * fade, 1.0);
  }
`;function b({drive:e,low:t}){let n=(0,g.useRef)(null),b=(0,g.useRef)(null),x=(0,g.useMemo)(()=>new i({vertexShader:v,fragmentShader:y,uniforms:{uMask:{value:d()},uTime:{value:0},uEnergy:{value:0}},transparent:!0,blending:2,depthWrite:!1}),[]),S=(0,g.useMemo)(()=>p(),[]),C=(0,g.useMemo)(()=>{let e=f(5),t=new c(1,1,1),n=new l({color:`#b59a6a`,metalness:.7,roughness:.35}),i=new a(t,n,64),o=new r;for(let t=0;t<64;t++){let n=t%4,r=(e()-.5)*1.9,a=1+e()*.08,[s,c]=n===0?[r,a]:n===1?[r,-a]:n===2?[a,r]:[-a,r];o.position.set(s,.09,c),o.scale.set(.05+e()*.04,.03,.03+e()*.02),o.rotation.set(0,n>1?Math.PI/2:0,0),o.updateMatrix(),i.setMatrixAt(t,o.matrix)}return i.instanceMatrix.needsUpdate=!0,i},[]);return(0,g.useEffect)(()=>()=>{x.dispose(),C.geometry.dispose(),C.material.dispose()},[x,C]),s((t,r)=>{let i=e.current.progress;x.uniforms.uTime.value=t.clock.elapsedTime,x.uniforms.uEnergy.value=o.smoothstep(i,.1,.6);let a=n.current;if(a){let e=1-Math.exp(-Math.min(r,.05)*5),n=-.6+i*Math.PI*1.1+t.clock.elapsedTime*.04,o=.78-i*.42;a.rotation.y+=(n-a.rotation.y)*e,a.rotation.x+=(o-a.rotation.x)*e,a.position.y=Math.sin(t.clock.elapsedTime*.8)*.04}b.current&&(b.current.intensity=2+o.smoothstep(i,.1,.7)*10)}),(0,_.jsxs)(_.Fragment,{children:[(0,_.jsx)(m,{intensity:.9,rim:`#9cc8ff`}),(0,_.jsx)(`pointLight`,{ref:b,position:[0,-.6,0],color:`#2997ff`,distance:6,decay:1.5}),(0,_.jsxs)(`group`,{ref:n,rotation:[.78,-.6,0],children:[(0,_.jsx)(`mesh`,{rotation:[-Math.PI/2,0,0],position:[0,-.02,0],material:x,children:(0,_.jsx)(`planeGeometry`,{args:[9,9]})}),(0,_.jsx)(u,{args:[2.3,.12,2.3],radius:.03,smoothness:3,position:[0,.06,0],children:(0,_.jsx)(`meshStandardMaterial`,{color:`#14201b`,metalness:.4,roughness:.5})}),(0,_.jsx)(u,{args:[1.62,.1,1.62],radius:.035,smoothness:4,position:[0,.17,0],children:(0,_.jsx)(`meshStandardMaterial`,{color:`#2a2b2f`,metalness:1,roughness:.28})}),(0,_.jsxs)(`mesh`,{position:[0,.2215,0],rotation:[-Math.PI/2,0,0],children:[(0,_.jsx)(`planeGeometry`,{args:[1.54,1.54]}),(0,_.jsx)(`meshStandardMaterial`,{map:S,metalness:.85,roughness:.32})]}),(0,_.jsx)(`primitive`,{object:C})]}),(0,_.jsx)(h,{count:t?80:260,radius:4.5,opacity:.55,color:`#7cc0ff`,speed:3})]})}export{b as default};