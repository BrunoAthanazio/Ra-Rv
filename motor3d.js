(async () => {
  // Encontra a área de renderização e cria os canvases usados pelos renderizadores.
  const host = document.querySelector('.motor-wrap');
  if (!host) return;
  const canvas = document.createElement('canvas');
  canvas.id = 'motor3d';
  canvas.setAttribute('aria-label', 'Modelo 3D interativo de um motor elétrico industrial');
  host.append(canvas);
  const ctx = canvas.getContext('2d');
  const glCanvas=document.createElement('canvas');glCanvas.id='motor3dgl';glCanvas.setAttribute('aria-label','Visualização 3D detalhada do motor');host.append(glCanvas);
  const gl=glCanvas.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:false});
  const stage = document.querySelector('#stage');
  const partCards = document.querySelectorAll('.part-card');
  let yaw = -.69, pitch = .20, zoom = 1, dragging = false, moved = false, sx = 0, sy = 0, lx = 0, ly = 0;
  const status=document.createElement('span');
  status.className='model-status';status.setAttribute('role','status');
  status.textContent='Carregando motor W22…';host.append(status);
  // Aguarda o modelo local antes de iniciar a renderização.
  let model;
  try{model=await carregarMotorW22('./motor-w22.glb')}
  catch(error){status.textContent='Falha ao abrir o modelo. Sirva a pasta por HTTP e recarregue.';console.error(error);return}
  status.remove();
  const {surfaces,offsets,floor}=model;
  // Mapeia as malhas do modelo para os componentes selecionáveis na interface.
  const componentForMesh={housing:'casing',stator:'stator',rotor:'rotor',shaft:'shaft',bearingL:'bearings',bearingR:'bearings',endcapL:'endcaps',endcapR:'endcaps',fan:'fan',fanGuard:'fanGuard',terminal:'terminal',terminalLid:'terminal'};
  const colorCache=new Map();
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let explosion=Number(stage.classList.contains('exploded'));
  let cutaway=Number(stage.classList.contains('internal'));
  let transition=null;
  // Interpola as transições entre as vistas montada, explodida e interna.
  function advanceView(now){
    if(!transition)return;
    const {start,duration,from,to,fromCut,toCut}=transition;
    const t=reducedMotion.matches?1:Math.min(1,Math.max(0,(now-start)/duration));
    const ease=t*t*(3-2*t);
    explosion=from+(to-from)*ease;
    cutaway=fromCut+(toCut-fromCut)*ease;
    if(t===1){explosion=to;cutaway=toCut;transition=null}
  }
  function changeView(){
    const now=performance.now();
    advanceView(now);
    const to=Number(stage.classList.contains('exploded'));
    const toCut=Number(stage.classList.contains('internal'));
    if(transition?.to===to && transition.toCut===toCut)return;
    const distance=Math.max(Math.abs(to-explosion),Math.abs(toCut-cutaway));
    transition=distance?{start:now,duration:850*distance,from:explosion,to,fromCut:cutaway,toCut}:null;
    scheduleDraw();
  }
  function partOffset(part){
    return explosion===0?zeroOffset:offsets[part].map(value=>value*explosion);
  }
  function framing(w,h){
    return Math.min(w/(4.55+8.45*explosion),h/(3.45+.20*explosion))*zoom;
  }
  function transparent(part){
    return cutaway>0 && ['housing','fanGuard','endcapL','endcapR'].includes(part);
  }
  let drawQueued=false;
  function scheduleDraw(){if(drawQueued)return;drawQueued=true;requestAnimationFrame(()=>{drawQueued=false;advanceView(performance.now());draw();if(transition)scheduleDraw()})}
  let glProgram=null,glParts=[];
  // The light sees the motor from above and to the left. Its texture stores the
  // highest surface along each ray, shared by the castings and the floor.
  // Shaders e utilitários do renderizador WebGL da visualização principal.
  const lightProjection = `
    uniform float lightWidth;
    vec2 lightUV(vec3 p) {
      return vec2((p.x + .42*p.y)/lightWidth, (p.z - .32*p.y)/4.8) + .5;
    }
  `;
  const studioVertex = `
    attribute vec3 p, n, c;
    uniform vec2 viewport;
    uniform float scale, yaw, pitch;
    uniform vec3 offset;
    varying vec3 world, local, normal, tint;
    void main() {
      local=p; world=p+offset; normal=n; tint=c;
      float cy=cos(yaw), sy=sin(yaw), cp=cos(pitch), sp=sin(pitch);
      float x=world.x*cy-world.z*sy, z=world.x*sy+world.z*cy;
      float y=world.y*cp-z*sp, depth=world.y*sp+z*cp;
      float w=1.0-depth*.033;
      gl_Position=vec4(vec2(x,y)*2.0*scale/viewport,-depth*.065,w);
    }
  `;
  const studioFragment = `
    precision highp float;
    varying vec3 world, local, normal, tint;
    uniform float opacity, selected, floorPass, metallic, roughness;
    uniform vec3 eye;
    uniform sampler2D shadowMap, grainMap;
    ${lightProjection}
    float shadowAt(float radius){
      vec2 uv=lightUV(world);
      float h=texture2D(shadowMap,uv).r*6.0-2.0;
      float spread=max(radius*.52,radius*max(0.0,h-world.y));
      float sum=0.0;
      for(int i=0;i<12;i++){
        float f=float(i)+.5;
        vec2 tap=vec2(cos(f*2.4),sin(f*2.4))*sqrt(f/12.0);
        float depth=texture2D(shadowMap,uv+tap*spread/vec2(lightWidth,4.8)).r*6.0-2.0;
        sum+=smoothstep(.028,.065,depth-world.y);
      }
      return sum/12.0;
    }
    // Broad studio panels form continuous highlights around curved metal.
    vec3 reflection(vec3 r,float metal){
      float sky=smoothstep(-.46,.65,r.y);
      vec3 ambient=mix(vec3(.09,.12,.16),vec3(.66,.75,.86),sky);
      float softbox=pow(max(0.0,dot(r,normalize(vec3(-.48,.8,.58)))),mix(6.0,15.0,metal));
      float strip=exp(-pow((r.y-.36)*5.8,2.0))*smoothstep(-.45,.45,r.z);
      return ambient+vec3(1.14,1.03,.91)*softbox+vec3(.91,.98,1.0)*strip;
    }
    void main(){
      if(floorPass>.5){
        float contact=exp(-pow(world.x/1.07,4.0)-pow((abs(world.z)-.56)/.18,2.0));
        float ambient=exp(-dot(world.xz*vec2(.79,1.15),world.xz*vec2(.79,1.15)));
        gl_FragColor=vec4(.115,.16,.21,min(.76,shadowAt(.13)*.35+contact*.36+ambient*.16));
        return;
      }
      vec3 v=normalize(eye-world*.033), n=normalize(normal);
      if(dot(n,v)<0.0)n=-n;
      bool paint=tint.b>tint.r*1.5 && tint.b>tint.g*1.12;
      float metal=metallic;
      vec2 uv=vec2(local.x+.63*local.z,local.y+.71*local.z)*7.0;
      vec3 grain=texture2D(grainMap,uv).rgb-.5;
      n=normalize(n+grain*(paint?.115:.027));
      vec3 albedo=tint;
      float visibility=1.0-shadowAt(.024);
      vec3 key=normalize(vec3(-.42,1.0,.32));
      float direct=max(dot(n,key),0.0)*visibility;
      vec3 reflected=reflection(reflect(-v,n),1.0-roughness);
      float fresnel=pow(1.0-max(0.0,dot(n,v)),4.0);
      vec3 diffuse=albedo*(.35+.18*n.y+.84*direct+.18*max(0.0,n.z))*(1.0-.82*metal);
      vec3 spec=reflected*mix(vec3(.072+.19*fresnel),albedo,metal)*(.63+.37*visibility);
      vec3 color=(diffuse+spec)*(1.0+grain.x*(paint?.095:.034));
      if(selected>.5)color=mix(color,vec3(.23,.76,.97),.44);
      gl_FragColor=vec4(color,opacity);
    }
  `;
  let studio, shadow, shadowTarget, ground, lastShadowMode;
  const shadowSize=1024;
  const zeroOffset=[0,0,0];

  // Cria programas e buffers WebGL reutilizados na cena.
  function programInfo(vertex,fragment,attributes,uniforms,context=gl){
    const gl=context;
    const program=gl.createProgram();
    for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
      const shader=gl.createShader(type);
      gl.shaderSource(shader,source);
      gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program,shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    const a={},u={};
    for(const name of attributes)a[name]=gl.getAttribLocation(program,name);
    for(const name of uniforms)u[name]=gl.getUniformLocation(program,name);
    return {program,a,u};
  }
  function upload(data,context=gl){
    const gl=context;
    const buffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
    return buffer;
  }
  function materialTextures(){
    const noise=document.createElement('canvas');
    noise.width=noise.height=128;
    const context=noise.getContext('2d'),pixels=context.createImageData(128,128);
    let seed=1357;
    for(let i=0;i<pixels.data.length;i++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      pixels.data[i]=i%4===3?255:seed>>>24;
    }
    context.putImageData(pixels,0,0);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,noise);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.activeTexture(gl.TEXTURE0);
  }
  function initGlRenderer(){
    if(!gl)return;
    studio=programInfo(studioVertex,studioFragment,['p','n','c'],
      ['viewport','scale','yaw','pitch','offset','eye','selected','opacity','floorPass','lightWidth','shadowMap','grainMap','metallic','roughness']);
    shadow=programInfo(`attribute vec3 p;uniform vec3 offset;varying float height;
      ${lightProjection}
      void main(){vec3 q=p+offset;height=(q.y+2.0)/6.0;gl_Position=vec4(lightUV(q)*2.0-1.0,1.0-2.0*height,1.0);}`,
      'precision highp float;varying float height;void main(){gl_FragColor=vec4(vec3(height),1.0);}', ['p'],['offset','lightWidth']);
    glParts=modelBuffers(gl);
    const floorVertices=[];
    for(const [x,z] of [[-10,-7],[10,-7],[10,7],[-10,-7],[10,7],[-10,7]])
      floorVertices.push(x,floor-.001,z,0,1,0);
    ground={buffer:upload(floorVertices),count:6,rgb:[1,1,1],metal:0,rough:1};
    materialTextures();
    const tex=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,shadowSize,shadowSize,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    for(const key of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,key,gl.NEAREST);
    for(const key of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,key,gl.CLAMP_TO_EDGE);
    shadowTarget=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,shadowTarget);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
    const depth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,depth);
    gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,shadowSize,shadowSize);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Shadow framebuffer incomplete');
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
    gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    glProgram=studio.program;host.classList.add('gl-ready');
  }
  function renderPart(item,info,off){
    gl.uniform3fv(info.u.offset,off);
    gl.bindBuffer(gl.ARRAY_BUFFER,item.buffer);
    gl.enableVertexAttribArray(info.a.p);gl.vertexAttribPointer(info.a.p,3,gl.FLOAT,false,24,0);
    if(info===studio){
      gl.enableVertexAttribArray(info.a.n);gl.vertexAttribPointer(info.a.n,3,gl.FLOAT,false,24,12);
      gl.disableVertexAttribArray(info.a.c);gl.vertexAttrib3fv(info.a.c,item.rgb);
      gl.uniform1f(info.u.metallic,item.metal);gl.uniform1f(info.u.roughness,item.rough);
    }
    if(item.indexBuffer){
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,item.indexBuffer);
      gl.drawElements(gl.TRIANGLES,item.count,gl.UNSIGNED_SHORT,0);
    }else gl.drawArrays(gl.TRIANGLES,0,item.count);
  }
  // Renderiza o modelo com materiais, iluminação e sombras.
  function drawGl(){
    const w=host.clientWidth,h=host.clientHeight;
    if(!w||!h)return;
    const d=Math.min(devicePixelRatio||1,2),pw=Math.round(w*d),ph=Math.round(h*d);
    if(glCanvas.width!==pw||glCanvas.height!==ph){glCanvas.width=pw;glCanvas.height=ph}
    const exploded=explosion>0,internal=cutaway>0;
    const selected=document.querySelector('.part-card.active')?.dataset.card;
    const lightWidth=5.6+9.4*explosion;
    const shadowMode=internal?-1-explosion:explosion;
    if(lastShadowMode!==shadowMode){
      gl.bindFramebuffer(gl.FRAMEBUFFER,shadowTarget);gl.viewport(0,0,shadowSize,shadowSize);
      gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(shadow.program);gl.uniform1f(shadow.u.lightWidth,lightWidth);
      for(const item of glParts)if(!transparent(item.part))renderPart(item,shadow,partOffset(item.part));
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);lastShadowMode=shadowMode;
    }
    gl.viewport(0,0,pw,ph);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(studio.program);
    const u=studio.u;
    gl.uniform1i(u.shadowMap,0);gl.uniform1i(u.grainMap,1);
    gl.uniform1f(u.lightWidth,lightWidth);gl.uniform2f(u.viewport,w,h);
    gl.uniform1f(u.scale,framing(w,h));
    gl.uniform1f(u.yaw,yaw);gl.uniform1f(u.pitch,pitch);
    gl.uniform3f(u.eye,Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
    if(pitch>.015){
      gl.enable(gl.BLEND);gl.depthMask(false);gl.uniform1f(u.floorPass,1);
      renderPart(ground,studio,zeroOffset);
    }
    gl.uniform1f(u.floorPass,0);gl.disable(gl.BLEND);gl.depthMask(true);
    for(const shell of [false,true]){
      if(shell){gl.enable(gl.BLEND);gl.depthMask(false)}
      gl.uniform1f(u.opacity,shell?1-.87*cutaway:1);
      for(const item of glParts){
        if(transparent(item.part)!==shell)continue;
        const hiddenCore=!exploded&&!internal&&['rotor','stator'].includes(item.part);
        if(hiddenCore)continue;
        gl.uniform1f(u.selected,componentForMesh[item.part]===selected?1:0);
        renderPart(item,studio,partOffset(item.part));
      }
    }
    // Selecting a concealed core in assembled mode retains the inspection overlay.
    if(!internal&&!exploded&&['rotor','stator'].includes(selected)){
      gl.disable(gl.DEPTH_TEST);gl.uniform1f(u.opacity,.83);gl.uniform1f(u.selected,1);
      for(const item of glParts)if(item.part===selected)renderPart(item,studio,zeroOffset);
      gl.enable(gl.DEPTH_TEST);
    }
    gl.disable(gl.BLEND);gl.depthMask(true);
  }
  function resize(){const r=host.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));canvas.style.width=r.width+'px';canvas.style.height=r.height+'px';ctx.setTransform(d,0,0,d,0,0);draw()}
  // Project indexed vertices once per surface for picking and the software renderer.
  // Projeta as superfícies para o renderizador 2D de compatibilidade.
  function projectScene(w,h){
    const exploded=explosion>0,internal=cutaway>0;
    const selected=document.querySelector('.part-card.active')?.dataset.card;
    const scale=framing(w,h);
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    const result=[];
    for(const surface of surfaces){
      const {part,vertices}=surface;
      if(!exploded&&!internal&&['rotor','stator'].includes(part)&&selected!==part)continue;
      const off=partOffset(part), points=new Float32Array(vertices.length/2);
      for(let i=0,j=0;i<vertices.length;i+=6,j+=3){
        const x=vertices[i]+off[0],y=vertices[i+1]+off[1],z=vertices[i+2]+off[2];
        const rz=x*sy+z*cy,depth=y*sp+rz*cp, k=scale/(1-depth*.033);
        points[j]=w/2+(x*cy-z*sy)*k;points[j+1]=h/2-(y*cp-rz*sp)*k;points[j+2]=depth;
      }
      result.push({surface,points});
    }
    return result;
  }
  function draw(){
    if(glProgram){drawGl();return}
    const w=host.clientWidth,h=host.clientHeight;
    ctx.clearRect(0,0,w,h);
    const selected=document.querySelector('.part-card.active')?.dataset.card,faces=[];
    for(const {surface,points} of projectScene(w,h)){
      const {indices,vertices,part,rgb}=surface;
      for(let i=0;i<indices.length;i+=3){
        const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
        if((points[b]-points[a])*(points[c+1]-points[a+1])>(points[b+1]-points[a+1])*(points[c]-points[a]))continue;
        const n=2*a+3,level=Math.round(24*(.49+.58*Math.max(0,-.4*vertices[n]+.81*vertices[n+1]+.42*vertices[n+2])));
        const key=surface.name+':'+level;
        if(!colorCache.has(key))colorCache.set(key,'rgb('+rgb.map(v=>Math.min(255,Math.round(v*255*level/24))).join(',')+')');
        faces.push({points,a,b,c,z:points[a+2]+points[b+2]+points[c+2],alpha:transparent(part)?1-.84*cutaway:1,
          color:componentForMesh[part]===selected?'#559fcb':colorCache.get(key)});
      }
    }
    faces.sort((a,b)=>a.z-b.z);
    for(const f of faces){
      const {points:p,a,b,c}=f;ctx.globalAlpha=f.alpha;ctx.fillStyle=f.color;ctx.beginPath();
      ctx.moveTo(p[a],p[a+1]);ctx.lineTo(p[b],p[b+1]);ctx.lineTo(p[c],p[c+1]);ctx.closePath();ctx.fill();
    }
    ctx.globalAlpha=1;
  }
  try{initGlRenderer()}catch(error){console.warn('WebGL renderer unavailable; using canvas fallback.',error);glProgram=null}
  new ResizeObserver(resize).observe(host);resize();new MutationObserver(changeView).observe(stage,{attributes:true,attributeFilter:['class']});
  // Seleciona o canvas ativo e conecta gestos, seleção e controles do modelo.
  const dragCanvas=glProgram?glCanvas:canvas;
  dragCanvas.addEventListener('pointerdown',e=>{e.stopPropagation();dragging=true;moved=false;sx=lx=e.clientX;sy=ly=e.clientY;dragCanvas.setPointerCapture(e.pointerId)});
  dragCanvas.addEventListener('pointermove',e=>{e.stopPropagation();if(!dragging)return;yaw-=(e.clientX-lx)*.009;pitch=Math.max(-.55,Math.min(.55,pitch+(e.clientY-ly)*.006));lx=e.clientX;ly=e.clientY;if(Math.hypot(e.clientX-sx,e.clientY-sy)>5)moved=true;scheduleDraw()});
  dragCanvas.addEventListener('pointerup',event=>{
    event.stopPropagation();dragging=false;if(moved)return;
    const r=dragCanvas.getBoundingClientRect(),x=event.clientX-r.left,y=event.clientY-r.top;
    let pick=null,nearest=-Infinity;
    for(const {surface,points:p} of projectScene(r.width,r.height)){
      if(transparent(surface.part))continue;
      const ids=surface.indices;
      for(let i=0;i<ids.length;i+=3){
        const a=3*ids[i],b=3*ids[i+1],c=3*ids[i+2];
        const bx=p[b]-p[a],by=p[b+1]-p[a+1],cx=p[c]-p[a],cy=p[c+1]-p[a+1],det=bx*cy-by*cx;
        if(Math.abs(det)<.0001)continue;
        const u=((x-p[a])*cy-(y-p[a+1])*cx)/det,v=(bx*(y-p[a+1])-by*(x-p[a]))/det;
        if(u<0||v<0||u+v>1)continue;
        const depth=(1-u-v)*p[a+2]+u*p[b+2]+v*p[c+2];
        if(depth>nearest){nearest=depth;pick=componentForMesh[surface.part]}
      }
    }
    if(pick)document.querySelector('[data-card="'+pick+'"]')?.click();
  });
  document.getElementById('resetBtn').addEventListener('click',()=>{yaw=-.69;pitch=.20;zoom=1;scheduleDraw()});
  dragCanvas.addEventListener('pointercancel',()=>dragging=false);dragCanvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.72,Math.min(1.55,zoom*(e.deltaY>0?.92:1.08)));scheduleDraw()},{passive:false});
  partCards.forEach(card=>card.addEventListener('click',scheduleDraw));host.classList.add('webgl-ready');

  // Immersive WebXR renderer: camera passthrough is supplied by the XR device.
  // Estado e controles específicos da sessão de realidade aumentada.
  let xrSession=null, xrCanvas=null, xrGl=null;
  let immersiveArSupport=null;
  if(navigator.xr?.isSessionSupported)navigator.xr.isSessionSupported('immersive-ar').then(value=>{immersiveArSupport=value}).catch(()=>{immersiveArSupport=false});
  let xrYaw=0;
  const xrAngle=document.getElementById('xrAngle'),xrAngleValue=document.getElementById('xrAngleValue'),xrExplode=document.getElementById('xrExplode');
  const xrHint=document.getElementById('xrHint'), xrPartInfo=document.getElementById('xrPartInfo');
  const xrPartName=document.getElementById('xrPartName'), xrPartDescription=document.getElementById('xrPartDescription');
  for(const id of ['xrExit','xrControls']){
    document.getElementById(id).addEventListener('beforexrselect',event=>event.preventDefault());
  }
  xrAngle?.addEventListener('input',()=>{xrYaw=Number(xrAngle.value)*Math.PI/180;xrAngleValue.value=`${xrAngle.value}°`;xrAngleValue.textContent=`${xrAngle.value}°`});
  function syncXrExplodeLabel(){xrExplode.textContent=stage.classList.contains('exploded')?'Montar motor':'Explodir motor'}
  xrExplode.addEventListener('click',()=>{const view=stage.classList.contains('exploded')?'assembled':'exploded';document.querySelector(`.view-btn[data-view="${view}"]`)?.click();syncXrExplodeLabel()});
  syncXrExplodeLabel();
  // Liga controles na tela e no teclado ao posicionamento do modelo em AR.
  function bindJoystick(id,lockVertical=false){
    const element=document.getElementById(id);
    const axes={x:0,y:0};
    let pointer=null;
    const keys=new Set();
    const supportedKeys=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
    function move(x,y){
      const length=Math.max(1,Math.hypot(x,y));
      axes.x=x/length;axes.y=y/length;
      element?.style.setProperty('--stick-x',`${axes.x*44}px`);
      element?.style.setProperty('--stick-y',`${axes.y*44}px`);
    }
    function reset(){
      const captured=pointer;
      pointer=null;
      keys.clear();
      move(0,0);
      if(element?.hasPointerCapture(captured))element.releasePointerCapture(captured);
    }
    function movePointer(event){
      if(event.pointerId!==pointer)return;
      const box=element.getBoundingClientRect();
      const x=(event.clientX-box.left-box.width/2)/50;
      const y=(event.clientY-box.top-box.height/2)/50;
      // Suppress slight horizontal drift near the vertical axis.
      const filteredX=lockVertical?Math.sign(x)*Math.max(0,Math.abs(x)-.36*Math.abs(y)):x;
      move(filteredX,y);
    }
    element?.addEventListener('pointerdown',event=>{
      if(pointer!==null || event.button!==0)return;
      event.preventDefault();
      keys.clear();
      pointer=event.pointerId;
      element.setPointerCapture(pointer);
      movePointer(event);
    });
    element?.addEventListener('pointermove',movePointer);
    for(const type of ['pointerup','pointercancel','lostpointercapture']){
      element?.addEventListener(type,event=>{if(event.pointerId===pointer)reset()});
    }
    for(const type of ['keydown','keyup']){
      element?.addEventListener(type,event=>{
        if(!supportedKeys.includes(event.key))return;
        event.preventDefault();
        if(pointer!==null)return;
        if(type==='keydown')keys.add(event.key);
        else keys.delete(event.key);
        move(Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')),
          Number(keys.has('ArrowDown'))-Number(keys.has('ArrowUp')));
      });
    }
    element?.addEventListener('blur',reset);
    return {axes,reset};
  }
  const moveStick=bindJoystick('xrMoveStick',true);
  const depthStick=bindJoystick('xrDepthStick');
  function multiply4(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o}
  function translate4(x,y,z){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1])}
  function rotateY4(a){const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1])}
  function scale4(s){return new Float32Array([s,0,0,0,0,s,0,0,0,0,s,0,0,0,0,1])}
  // Shaders, interseções e buffers usados para desenhar o modelo em AR.
  const xrVertex = `
    attribute vec3 p, n;
    uniform mat4 mvp, modelView;
    varying vec3 normal, position;
    void main(){
      gl_Position=mvp*vec4(p,1.0);
      normal=mat3(modelView)*n;
      position=(modelView*vec4(p,1.0)).xyz;
    }
  `;
  const xrFragment = `
    precision mediump float;
    uniform vec3 color, key;
    uniform float selected, metallic, roughness, opacity;
    varying vec3 normal, position;
    void main(){
      vec3 n=normalize(normal), view=normalize(-position);
      float diffuse=max(dot(n,key),0.0);
      float rim=pow(1.0-max(dot(n,view),0.0),3.0);
      float gloss=pow(max(dot(n,normalize(key+view)),0.0),mix(56.0,10.0,roughness));
      vec3 albedo=mix(color,vec3(.24,.73,.97),selected*.5);
      vec3 lit=albedo*(.55+.6*diffuse)+mix(vec3(.18),color,metallic)*gloss+.09*rim;
      gl_FragColor=vec4(lit,opacity);
    }
  `;
  const xrShadowVertex = `
    attribute vec3 p;
    uniform mat4 mvp;
    varying vec2 uv;
    void main(){uv=p.xz;gl_Position=mvp*vec4(p,1.0);}
  `;
  const xrShadowFragment = `
    precision mediump float;
    varying vec2 uv;
    uniform float strength;
    void main(){
      float radius=length(uv);
      float opacity=(1.0-smoothstep(.22,1.0,radius))*strength;
      gl_FragColor=vec4(0.0,0.0,0.0,opacity);
    }
  `;
  function xrPartVisible(part,selected){
    return explosion>0 || (part!=='stator' && part!=='rotor') || selected===part;
  }
  function xrRayHit(vertices,indices,origin,direction,limit){
    let closest=limit;
    for(let i=0;i<indices.length;i+=3){
      const a=indices[i]*6,b=indices[i+1]*6,c=indices[i+2]*6;
      const abx=vertices[b]-vertices[a],aby=vertices[b+1]-vertices[a+1],abz=vertices[b+2]-vertices[a+2];
      const acx=vertices[c]-vertices[a],acy=vertices[c+1]-vertices[a+1],acz=vertices[c+2]-vertices[a+2];
      const px=direction.y*acz-direction.z*acy,py=direction.z*acx-direction.x*acz,pz=direction.x*acy-direction.y*acx;
      const determinant=abx*px+aby*py+abz*pz;
      if(Math.abs(determinant)<1e-8)continue;
      const tx=origin.x-vertices[a],ty=origin.y-vertices[a+1],tz=origin.z-vertices[a+2];
      const u=(tx*px+ty*py+tz*pz)/determinant;
      if(u<0 || u>1)continue;
      const qx=ty*abz-tz*aby,qy=tz*abx-tx*abz,qz=tx*aby-ty*abx;
      const v=(direction.x*qx+direction.y*qy+direction.z*qz)/determinant;
      if(v<0 || u+v>1)continue;
      const distance=(acx*qx+acy*qy+acz*qz)/determinant;
      if(distance>0 && distance<closest)closest=distance;
    }
    return closest;
  }
  function modelBuffers(context){
    return surfaces.map(surface=>{
      const buffer=context.createBuffer(),indexBuffer=context.createBuffer();
      context.bindBuffer(context.ARRAY_BUFFER,buffer);
      context.bufferData(context.ARRAY_BUFFER,surface.vertices,context.STATIC_DRAW);
      context.bindBuffer(context.ELEMENT_ARRAY_BUFFER,indexBuffer);
      context.bufferData(context.ELEMENT_ARRAY_BUFFER,surface.indices,context.STATIC_DRAW);
      return {...surface,buffer,indexBuffer,count:surface.indices.length};
    });
  }
  // Inicia a sessão AR, posiciona o motor e encerra os recursos ao sair.
  async function startXR(){
    if(!navigator.xr){notify('WebXR não está disponível neste navegador. Abra o link em um navegador compatível com AR.');return}
    if(immersiveArSupport===false){notify('O Chrome não está oferecendo sessões WebXR AR neste tablet. Confira o Google Play Services para AR e as permissões do Chrome.');return}
    let phase='preparar o contexto gráfico';
    try{
      xrCanvas=document.createElement('canvas');xrGl=xrCanvas.getContext('webgl',{alpha:true,antialias:true})||xrCanvas.getContext('experimental-webgl',{alpha:true,antialias:true});if(!xrGl)throw Error('WebGL indisponível');
      const init={requiredFeatures:['hit-test','dom-overlay'],domOverlay:{root:document.getElementById('xrOverlay')}};
      // requestSession must be called in the original button gesture; awaiting
      // capability checks or context preparation first loses transient activation.
      phase='abrir a sessão immersive-ar';
      const sessionRequest=navigator.xr.requestSession('immersive-ar',init);
      xrSession=await sessionRequest;window.motorXRSession=xrSession;
      phase='preparar o WebGL para XR';
      if(xrGl.makeXRCompatible)await xrGl.makeXRCompatible();
      const gl=xrGl,buffers=modelBuffers(gl);
      const material=programInfo(xrVertex,xrFragment,['p','n'],['mvp','modelView','color','key','selected','metallic','roughness','opacity'],gl);
      const contactShadow=programInfo(xrShadowVertex,xrShadowFragment,['p'],['mvp','strength'],gl);
      const shadowPlane=upload([-1,0,-1, 1,0,-1, -1,0,1, 1,0,1],gl);
      phase='criar a camada de imagem AR';
      const layer=new XRWebGLLayer(xrSession,gl,{alpha:true,antialias:true});xrSession.updateRenderState({baseLayer:layer});
      phase='obter a referência espacial';
      let referenceSpace;
      try{referenceSpace=await xrSession.requestReferenceSpace('local-floor')}
      catch(error){if(error?.name!=='NotSupportedError')throw error;referenceSpace=await xrSession.requestReferenceSpace('local')}
      phase='iniciar o hit-test';
      const viewerSpace=await xrSession.requestReferenceSpace('viewer');const hitSource=await xrSession.requestHitTestSource({space:viewerSpace});
      phase='preparar a interface AR';
      let placed=null, inverseModel=null, renderedParts=[], selected=null;
      let floorScan=null;
      let previousTime=null, x=0, z=0, height=0;
      xrYaw=0;
      if(xrAngle && xrAngleValue){xrAngle.value='0';xrAngleValue.value='0°';xrAngleValue.textContent='0°'}
      moveStick.reset();
      depthStick.reset();
      syncXrExplodeLabel();
      const showPartPanel=xrPartInfo && xrPartName && xrPartDescription;
      const placementHint='Aponte a câmera para uma área plana do piso.';
      const scanningHint='Piso detectado. Posicionando o motor…';
      const selectionHint='Toque em uma peça para ver seus detalhes.';
      if(showPartPanel)xrPartInfo.hidden=true;
      xrHint.hidden=false;
      xrHint.textContent=placementHint;
      document.body.classList.add('xr-active');
      xrSession.addEventListener('select',event=>{
        if(!inverseModel)return;
        const ray=event.frame.getPose(event.inputSource.targetRaySpace,referenceSpace);
        if(!ray)return;
        const matrix=ray.transform.matrix;
        const origin=inverseModel.transformPoint(new DOMPoint(matrix[12],matrix[13],matrix[14]));
        const direction=inverseModel.transformPoint(new DOMPoint(-matrix[8],-matrix[9],-matrix[10],0));
        let distance=Infinity, picked=null;
        for(const {item,off} of renderedParts){
          const localOrigin={x:origin.x-off[0],y:origin.y-off[1],z:origin.z-off[2]};
          const hit=xrRayHit(item.vertices,item.indices,localOrigin,direction,distance);
          if(hit<distance){distance=hit;picked=componentForMesh[item.part]}
        }
        const previous=selected;
        selected=picked===previous?null:picked;
        if(selected)selectPart(selected);
        else if(previous && typeof clearPartSelection==='function')clearPartSelection();
        const detail=details[selected];
        if(showPartPanel){
          if(detail){
            xrPartName.textContent=detail.title;
            xrPartDescription.textContent=detail.text;
          }
          xrPartInfo.hidden=!detail;
          xrHint.hidden=Boolean(detail);
        }else{
          xrHint.textContent=detail?`${detail.title} · ${detail.text}`:selectionHint;
        }
      });
      gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(0,0,0,0);
      gl.depthFunc(gl.LEQUAL);
      gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      const arButton=document.getElementById('arBtn');
      const session=xrSession;
      session.addEventListener('end',()=>{
        moveStick.reset();
        depthStick.reset();
        document.body.classList.remove('xr-active');
        arButton.textContent='Ver no meu espaço';
        xrSession=null;window.motorXRSession=null;scheduleDraw();
      },{once:true});
      arButton.textContent='Sair da realidade aumentada';
      session.requestAnimationFrame(function frame(time,xrFrame){
        if(xrSession!==session)return;
        session.requestAnimationFrame(frame);
        const pose=xrFrame.getViewerPose(referenceSpace);
        if(!pose){inverseModel=null;previousTime=null;floorScan=null;return}
        const dt=previousTime===null?0:Math.max(0,Math.min(.05,(time-previousTime)/1000));
        previousTime=time;
        if(!placed){
          let point=null;
          for(const hit of xrFrame.getHitTestResults(hitSource)){
            const hitPose=hit.getPose(referenceSpace);
            const matrix=hitPose?.transform.matrix;
            if(matrix && matrix[5]>=.96){point=[matrix[12],matrix[13],matrix[14]];break}
          }
          if(floorScan && time-floorScan.last>250)floorScan=null;
          if(point){
            const [hitX,hitY,hitZ]=point;
            // The hit moves across the same floor as the viewer moves. Compare only height.
            if(!floorScan || Math.abs(hitY-floorScan.height)>.045){
              floorScan={height:hitY,start:time,last:time,count:1};
            }else{
              floorScan.last=time;
              floorScan.count++;
              floorScan.height+=(hitY-floorScan.height)/floorScan.count;
              if(floorScan.count>=3 && time-floorScan.start>=90){
                placed=translate4(hitX,floorScan.height,hitZ);
                hitSource.cancel();
              }
            }
          }
          const hint=placed?selectionHint:floorScan?scanningHint:placementHint;
          if(xrHint.textContent!==hint)xrHint.textContent=hint;
        }
        advanceView(performance.now());
        let model=null, groundModel=null;
        if(placed){
          xrYaw=(xrYaw+moveStick.axes.x*1.8*dt)%(2*Math.PI);
          height=Math.min(2,Math.max(0,height-moveStick.axes.y*.65*dt));
          const cameraMatrix=pose.transform?.matrix;
          if(cameraMatrix && depthStick.axes.x){
            const horizontal=Math.hypot(cameraMatrix[0],cameraMatrix[2]);
            if(horizontal>.001){
              const step=depthStick.axes.x*.95*dt/horizontal;
              x+=cameraMatrix[0]*step;z+=cameraMatrix[2]*step;
            }
          }
          const camera=pose.transform?.position;
          if(camera && depthStick.axes.y){
            const dx=placed[12]+x-camera.x,dz=placed[14]+z-camera.z;
            const distance=Math.hypot(dx,dz);
            if(distance>.001){
              const movement=-depthStick.axes.y*.95*dt;
              const step=movement>0?Math.min(movement,Math.max(0,6-distance))
                :Math.max(movement,Math.min(0,.35-distance));
              x+=dx/distance*step;z+=dz/distance*step;
            }
          }
          const anchored=multiply4(translate4(x,0,z),placed);
          groundModel=multiply4(anchored,multiply4(rotateY4(xrYaw),multiply4(scale4(.25),translate4(0,-floor,0))));
          model=multiply4(translate4(0,height,0),groundModel);
        }
        if(model){
          inverseModel=DOMMatrix.fromFloat32Array(model).inverse();
          renderedParts=buffers.filter(item=>xrPartVisible(item.part,selected))
            .map(item=>({item,off:partOffset(item.part)}));
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);
        for(const view of pose.views){
          const vp=layer.getViewport(view);
          gl.viewport(vp.x,vp.y,vp.width,vp.height);gl.scissor(vp.x,vp.y,vp.width,vp.height);
          gl.enable(gl.SCISSOR_TEST);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
          if(!model)continue;
          const viewMatrix=view.transform.inverse.matrix;
          const modelView=multiply4(viewMatrix,model);
          const projection=view.projectionMatrix;

          const shadowTransform=translate4(.18,floor+.003,-.12);
          shadowTransform[0]=2.8+4.1*explosion;
          shadowTransform[10]=1.65;
          gl.useProgram(contactShadow.program);
          gl.bindBuffer(gl.ARRAY_BUFFER,shadowPlane);
          gl.enableVertexAttribArray(contactShadow.a.p);
          gl.vertexAttribPointer(contactShadow.a.p,3,gl.FLOAT,false,0,0);
          const shadowView=multiply4(viewMatrix,groundModel);
          gl.uniformMatrix4fv(contactShadow.u.mvp,false,multiply4(projection,multiply4(shadowView,shadowTransform)));
          gl.uniform1f(contactShadow.u.strength,.28/(1+height*3));
          gl.depthMask(false);
          gl.enable(gl.BLEND);
          gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
          gl.disable(gl.BLEND);
          gl.depthMask(true);

          const {a,u}=material;
          gl.useProgram(material.program);
          const light=new DOMPoint(-.42,1,.32,0).matrixTransform(DOMMatrix.fromFloat32Array(viewMatrix));
          const length=Math.hypot(light.x,light.y,light.z);
          gl.uniform3f(u.key,light.x/length,light.y/length,light.z/length);
          const parts=renderedParts.map(({item,off})=>({
            item, partView:multiply4(modelView,translate4(...off)),
            active:componentForMesh[item.part]===selected
          }));
          function drawPart({item,partView,active}){
            gl.bindBuffer(gl.ARRAY_BUFFER,item.buffer);
            gl.enableVertexAttribArray(a.p);gl.vertexAttribPointer(a.p,3,gl.FLOAT,false,24,0);
            gl.enableVertexAttribArray(a.n);gl.vertexAttribPointer(a.n,3,gl.FLOAT,false,24,12);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,item.indexBuffer);
            gl.uniformMatrix4fv(u.modelView,false,partView);
            gl.uniformMatrix4fv(u.mvp,false,multiply4(projection,partView));
            gl.uniform3fv(u.color,item.rgb);
            gl.uniform1f(u.metallic,item.metal);
            gl.uniform1f(u.roughness,item.rough);
            gl.uniform1f(u.selected,active?1:0);
            gl.drawElements(gl.TRIANGLES,item.count,gl.UNSIGNED_SHORT,0);
          }
          gl.uniform1f(u.opacity,1);
          for(const part of parts){
            if(!selected || part.active)drawPart(part);
          }
          if(selected){
            const ghosts=parts.filter(part=>!part.active);
            // Keep just the nearest ghost surface to avoid stacking translucent faces.
            gl.colorMask(false,false,false,false);
            for(const part of ghosts)drawPart(part);
            gl.colorMask(true,true,true,true);
            gl.depthMask(false);
            gl.enable(gl.BLEND);
            gl.uniform1f(u.opacity,.22);
            for(const part of ghosts)drawPart(part);
            gl.disable(gl.BLEND);
            gl.depthMask(true);
          }
        }
      });
    }catch(error){console.error(`Falha ao ${phase}:`,error);document.body.classList.remove('xr-active');if(xrSession){try{await xrSession.end()}catch{}}xrSession=null;window.motorXRSession=null;const name=error?.name||'Erro';let message;if(name==='NotAllowedError')message='A sessão foi bloqueada. Permita a câmera para este site nas configurações do Chrome e tente novamente.';else if(name==='NotSupportedError'&&phase==='abrir a sessão immersive-ar')message='O Chrome não abriu a sessão AR. Confirme se o Google Play Services para AR está instalado e atualizado.';else if(name==='NotSupportedError'&&phase==='iniciar o hit-test')message='A sessão AR abriu, mas o Chrome não disponibilizou o hit-test. Confira as atualizações do Chrome e do Google Play Services para AR.';else if(name==='SecurityError')message='Abra o protótipo pelo link HTTPS e inicie a sessão pelo botão.';else message=`Falha ao ${phase} (${name}): ${error?.message||'tente atualizar o Chrome e o Google Play Services para AR.'}`;notify(message);}
  }
  window.startMotorXR=startXR;
})();
