// Carrega e converte o modelo GLB exportado do Motor_W22.prefab.
// O arquivo usa malhas indexadas e não depende de texturas externas.
async function carregarMotorW22(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Falha ao carregar o GLB: ' + response.status);
  const bytes = await response.arrayBuffer();
  const header = new DataView(bytes);
  if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2)
    throw new Error('GLB inválido');
  const jsonLength = header.getUint32(12, true);
  const doc = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, jsonLength)));
  const binary = 28 + jsonLength;
  // Cria a visualização tipada dos dados geométricos armazenados no GLB.
  function attribute(id) {
    const a = doc.accessors[id], view = doc.bufferViews[a.bufferView];
    const Type = a.componentType === 5123 ? Uint16Array : Float32Array;
    return new Type(bytes, binary + (view.byteOffset || 0) + (a.byteOffset || 0),
      a.count * ({VEC3: 3, SCALAR: 1}[a.type]));
  }
  // Relaciona os nomes do modelo às chaves usadas pela interface.
  const components = {
    Housing:'housing', Shaft:'shaft', Rotor:'rotor', Stator:'stator', TerminalBox:'terminal',
    FrontBearing:'bearingL', RearBearing:'bearingR', FrontEndShield:'endcapL',
    RearEndShield:'endcapR', CoolingFan:'fan', FanCover:'fanGuard'
  };
  const scale=.70, surfaces=[], offsets={};
  let floor=Infinity;
  // Percorre grupos, malhas e primitivas para preparar as superfícies.
  for (const id of doc.scenes[doc.scene].nodes) {
    const group=doc.nodes[id], part=components[group.name];
    offsets[part]=group.extras.explosionOffset.map(v=>v*scale);
    for (const child of group.children) {
      const node=doc.nodes[child], mesh=doc.meshes[node.mesh];
      for (const prim of mesh.primitives) {
        const pos=attribute(prim.attributes.POSITION), normals=attribute(prim.attributes.NORMAL);
        const pbr=doc.materials[prim.material].pbrMetallicRoughness;
        const rgb=pbr.baseColorFactor.slice(0,3).map(v=>v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055);
        const translation=node.translation.map((v,k)=>v+group.translation[k]);
        const vertices=new Float32Array(pos.length*2);
        for(let i=0;i<pos.length;i+=3) {
          for(let k=0;k<3;k++){
            vertices[2*i+k]=(pos[i+k]+translation[k])*scale;
            vertices[2*i+k+3]=normals[i+k];
          }
          floor=Math.min(floor,vertices[2*i+1]);
        }
        surfaces.push({name:mesh.name,part,vertices,indices:attribute(prim.indices),rgb,
          metal:pbr.metallicFactor,rough:pbr.roughnessFactor});
      }
    }
  }
  return {surfaces,offsets,floor};
}
