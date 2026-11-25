# Visualizador WEG W22

Protótipo web para explorar um motor elétrico industrial inspirado na linha WEG W22. Apresenta nove componentes em um visualizador 3D e permite posicionar, mover e inspecionar o motor em realidade aumentada no navegador.

O modelo foi criado em um projeto aberto pelo **Unity Hub**, editado no **Unity Editor** e organizado no prefab `Motor_W22.prefab`. Depois, os assets do prefab foram convertidos em `motor-w22.glb`. O GLB publicado contém **47 malhas, 11 conjuntos de peças e 11 materiais**.

## Integrantes

- Bruno Athanazio Ferreira
- Eduardo Tamborelli Ferreira Lino
- Vinicius Deretti
- Matheus de Borba

**Créditos especiais para Gustavo Schmitt Hatschbach.**

## Executar o visualizador

1. Instale o Git e o Python 3, caso ainda não estejam disponíveis.
2. No terminal, clone o repositório e inicie o servidor local na pasta que contém o `index.html`.

```powershell
git clone https://github.com/BrunoAthanazio/Ra-Rv.git
cd Ra-Rv
py -m http.server 8000 --bind 127.0.0.1
```

3. Abra [http://localhost:8000](http://localhost:8000). Em Linux ou macOS, use `python3` no lugar de `py`. O [Live Server do VS Code](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) é outra opção de servidor local.

O site usa HTML, CSS e JavaScript nativos. O GLB já vem no repositório, então Unity, NumPy e compilação do front-end são dispensáveis para executar o visualizador. Abra a página pelo servidor HTTP para que o navegador possa buscar o modelo com `fetch`.

## Explorar o motor

### No visualizador 3D

- Arraste o motor para girá-lo. No desktop, use a roda do mouse para ajustar o zoom.
- Selecione um componente na lista rolável à esquerda ou clique diretamente na peça. O visualizador destaca a seleção e a ficha à direita apresenta os detalhes. Em telas estreitas, as seções ficam empilhadas.
- Use **Montado** para ver o conjunto, **Explodido** para separar as peças e **Interno** para inspecionar o interior com a carcaça, as tampas e a proteção do ventilador translúcidas.
- Use **Reiniciar** para restaurar a vista e limpar a seleção.

### Em realidade aumentada

Use um navegador compatível com **WebXR immersive-ar**, **Hit Test** e **DOM Overlay**. Para Chrome no Android, confira a compatibilidade do aparelho com ARCore e mantenha o **Google Play Services para AR** instalado e habilitado. Acesse o site em HTTPS no aparelho. Em desenvolvimento via USB, o encaminhamento de porta do Chrome DevTools permite usar `http://localhost:8000` no Android. O endereço HTTP do computador na rede local geralmente não oferece o contexto seguro exigido. [Requisitos do WebXR no Android](https://developers.google.com/ar/develop/webxr/requirements) · [Dispositivos compatíveis](https://developers.google.com/ar/devices)

1. Toque em **Ver no meu espaço**, conceda as permissões solicitadas e aponte a câmera para uma área plana do piso.
2. Aguarde o motor aparecer. O scanner confirma uma superfície quase horizontal com pelo menos três leituras de altura compatível ao longo de no mínimo 90 ms. O ponto lido pode se deslocar pelo piso durante a confirmação. Depois de posicionar o motor, o site encerra o hit-test e usa a posição escolhida como referência durante a sessão.
3. Use o **joystick esquerdo** para girar o motor na horizontal ou alterar sua altura. Pequenos desvios laterais em gestos verticais são filtrados. O motor pode descer até o piso.
4. Use o **joystick direito** para deslocar o motor para os lados em relação à câmera. Para cima, o motor se afasta. Para baixo, se aproxima. Os dois joysticks aceitam as setas quando estão em foco.
5. Use **Explodir motor** ou **Montar motor** para alternar as vistas. Toque em uma peça para exibir seu nome e descrição. A peça fica opaca e em destaque, e as demais ficam translúcidas. Toque de novo na peça ou em uma área vazia para limpar a seleção.
6. Use **Sair da realidade aumentada** para encerrar a sessão.

## Etapas do projeto, em ordem cronológica

| Etapa | Ferramentas e recursos usados | O que foi feito |
| --- | --- | --- |
| 1. Criação do modelo | Unity Hub, Unity Editor, prefab e assets da Unity | O motor foi organizado em conjuntos independentes, cada um com suas malhas, materiais e deslocamento para a vista explodida. |
| 2. Preparação dos arquivos | Arquivo ZIP, `unzip`, terminal Bash e `rg` | O pacote foi extraído e inspecionado para localizar o prefab, os arquivos `.asset`, `.mat` e `.meta`. Os GUIDs dos arquivos `.meta` vinculam as referências do prefab aos assets. |
| 3. Conversão e inspeção | Python 3, NumPy, `pathlib`, `re`, `collections`, `json`, `struct`, glTF 2.0/GLB e GLTF/GLB Viewer para VS Code | Um script leu os assets serializados da Unity, converteu os eixos, reorganizou vértices e índices, traduziu os materiais para PBR e gravou os deslocamentos em `extras.explosionOffset`. A extensão permite inspecionar o resultado diretamente no editor. |
| 4. Integração 3D | HTML, JavaScript, Fetch API, buffers tipados, WebGL, GLSL e Canvas 2D | O leitor do GLB foi integrado ao renderizador. Foram implementados iluminação, sombras, seleção de peças, vistas montada, explodida e interna e transições animadas. |
| 5. Interface e referências | CSS, catálogo público WEG, Exa, `curl`, Python/Pillow, WebP, Arial/Helvetica | A interface recebeu a paleta azul, tipografia sem serifa, cards e foto do catálogo. A imagem foi recortada, redimensionada e salva em WebP. O layout evoluiu para componentes à esquerda, motor ao centro e ficha à direita. A tipografia e os cards são adaptações do projeto inspiradas nas referências públicas. |
| 6. Realidade aumentada | WebXR Device API, Hit Test, DOM Overlay, Pointer Events, DOMMatrix, WebGL e GLSL | A experiência evoluiu de posicionamento por superfície para confirmação rápida do piso, sombra de contato, seleção por raio, painel de detalhes, transparência e dois joysticks. |
| 7. Validação de cada entrega | Codex, Python HTTP Server, Chromium com Playwright, Node.js, Chrome headless, Chrome DevTools Protocol, SwiftShader, Bash e PowerShell | Foram testados carregamento, fallback Canvas, vistas, seleção, animação e layout responsivo. Sessões WebXR simuladas exercitaram posicionamento, gestos, transparência e perda breve de leitura. |
| 8. Versionamento e publicação | Git e GitHub | O site foi versionado em commits na `main`. Para repetir a publicação, hospede os arquivos estáticos por HTTPS, por exemplo com GitHub Pages. |

### Marcos no Git

| Commit | Mudança publicada |
| --- | --- |
| [`ea7d976`](https://github.com/BrunoAthanazio/Ra-Rv/commit/ea7d976) | Base do visualizador. |
| [`94a9239`](https://github.com/BrunoAthanazio/Ra-Rv/commit/94a9239) | Animação de separação e reunião das peças. |
| [`f3ba628`](https://github.com/BrunoAthanazio/Ra-Rv/commit/f3ba628) | Reformulação visual inspirada no catálogo WEG. |
| [`ee3c090`](https://github.com/BrunoAthanazio/Ra-Rv/commit/ee3c090) e [`383cf21`](https://github.com/BrunoAthanazio/Ra-Rv/commit/383cf21) | Sombreamento, seleção e descrição em AR, compatibilidade com versões anteriores do HTML e mudança da coluna de componentes. |
| [`f32fba4`](https://github.com/BrunoAthanazio/Ra-Rv/commit/f32fba4) e [`dacc666`](https://github.com/BrunoAthanazio/Ra-Rv/commit/dacc666) | Três colunas, lista com rolagem, joysticks e filtro para ajuste de altura. |
| [`2485b04`](https://github.com/BrunoAthanazio/Ra-Rv/commit/2485b04) | Leitura estável da superfície, joysticks nos cantos e deslocamento lateral. |
| [`cc8d8f1`](https://github.com/BrunoAthanazio/Ra-Rv/commit/cc8d8f1) | Transparência das demais peças durante a seleção em AR. |
| [`011928a`](https://github.com/BrunoAthanazio/Ra-Rv/commit/011928a) | Confirmação mais rápida de piso com tolerância a perdas breves de leitura. |

## Reproduzir a conversão do Unity para GLB

Para regenerar exatamente a geometria original, obtenha com o grupo o projeto Unity ou o pacote original de assets. O repositório público fornece o GLB final. A versão do Unity Editor usada originalmente não está registrada no repositório. Se receber o projeto completo, consulte `ProjectSettings/ProjectVersion.txt` para abrir a versão correta pelo Unity Hub.

1. Abra o projeto no Unity Hub e confira o prefab `Assets/Prefabs/Motor_W22.prefab` no Unity Editor.
2. Preserve a árvore de `Assets/`, incluindo `Prefabs/`, `Meshes/`, `Materials/` e os respectivos arquivos `.meta`. Confira os 11 conjuntos e mantenha o campo `explosionOffset` em cada conjunto. Os rolamentos dianteiro e traseiro correspondem a um item na interface. O mesmo vale para as duas tampas.
3. Salve o script do apêndice como `converter_w22.py`, de preferência fora da pasta do projeto. Em um ambiente Python com NumPy, passe a pasta **Assets** e o caminho de saída.

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install numpy
.\.venv\Scripts\python.exe .\converter_w22.py "C:/caminho/projeto-unity/Assets" .\motor-w22.glb
```

4. No Linux ou macOS, use `python3 -m venv .venv` e `./.venv/bin/python` para instalar o NumPy e executar o script. Gere primeiro em uma pasta separada se quiser preservar o GLB publicado para comparação.
5. Inspecione o GLB no VS Code, compare as contagens com o original e teste as vistas no site. Para verificar a conformidade do arquivo com a especificação glTF, use o [glTF Validator do Khronos](https://github.khronos.org/glTF-Validator/).

### Visualizar o GLB no Visual Studio Code

Instale a extensão **GLTF/GLB Viewer**, da **OHZI Interactive Studio**, para inspecionar em 3D o modelo convertido dos assets da Unity. [GLTF/GLB Viewer no Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=OHZIInteractiveStudio.ohzi-vscode-glb-viewer)

1. No VS Code, abra **Extensões**, pesquise por `OHZIInteractiveStudio.ohzi-vscode-glb-viewer` e instale a extensão.
2. No explorador de arquivos do VS Code, clique em `motor-w22.glb`. Se o visualizador não abrir automaticamente, clique com o botão direito e escolha **Abrir com → GLTF/GLB Viewer**.
3. Arraste com o botão esquerdo para girar o motor, use o botão direito para deslocar a câmera e a roda do mouse para ajustar o zoom. Confira a hierarquia, as geometrias e os materiais nos painéis do visualizador.

### Estrutura esperada pelo leitor web

O leitor `modelo-unity.js` foi escrito para este GLB. Os nós raiz da cena precisam ter os nomes `Housing`, `Shaft`, `Rotor`, `Stator`, `TerminalBox`, `FrontBearing`, `RearBearing`, `FrontEndShield`, `RearEndShield`, `CoolingFan` e `FanCover`. Cada conjunto precisa de `translation`, `children` e `extras.explosionOffset`.

Cada filho visual aponta para uma malha e possui sua translação local. As malhas usam triângulos indexados em, no máximo, 16 bits, posições e normais `Float32` armazenadas em buffers contíguos e materiais com `baseColorFactor`, `metallicFactor` e `roughnessFactor`. O conversor grava também as coordenadas UV. O site calcula o ponto inferior do modelo e aplica um fator de escala visual ao carregar a malha, com um fator adicional no modo AR. Essas escalas ainda precisam ser calibradas com um motor real para uso dimensional.

Ao criar um modelo diferente no Unity, confira rotações, escalas, layouts de vértices, nomes e referências de materiais. O script histórico é específico para os assets originais, que usam rotações locais neutras, escala unitária e vértices com oito valores por registro. Para outro pipeline ou malhas comprimidas, adapte o conversor e o leitor juntos.

<details>
<summary>Apêndice — script de conversão recuperado do histórico</summary>

A versão abaixo mantém o algoritmo da conversão original, recebe caminhos pela linha de comando e inclui a correção usada na leitura dos índices hexadecimais. O teste de regeneração integral requer o pacote original de assets.

```python
import argparse
import re,json,struct,collections
from pathlib import Path
import numpy as np
parser = argparse.ArgumentParser(description='Converte o prefab W22 da Unity para GLB.')
parser.add_argument('assets', type=Path)
parser.add_argument('output', type=Path)
args = parser.parse_args()
root = args.assets
out = args.output
guid={re.search(r'^guid: (\w+)',p.read_text(),re.M)[1]:p.with_suffix('') for p in root.rglob('*.meta')}
pref=(root/'Prefabs/Motor_W22.prefab').read_text()
docs=re.split(r'^--- !u!(\d+) &(\d+)\n',pref,flags=re.M)[1:]
objects={};trans={};bygo=collections.defaultdict(dict)
def field(s,k):return re.search(r'^  '+k+r': (.*)$',s,re.M)[1]
def fid(v):return int(re.search(r'fileID: (\d+)',v)[1])
def vec(s):return np.array([float(x) for x in re.findall(r'[xyz]: ([^,}]+)',s)])
for typ,i,s in zip(docs[::3],docs[1::3],docs[2::3]):
 i=int(i)
 if typ=='1':objects[i]=field(s,'m_Name')
 elif typ=='4':trans[i]=(fid(field(s,'m_GameObject')),fid(field(s,'m_Father')),vec(field(s,'m_LocalPosition')))
 if typ!='1':bygo[fid(field(s,'m_GameObject'))][typ]=s
goTransform={v[0]:i for i,v in trans.items()}
def chain(i):
 while i:
  go,i,pos=trans[i]
  yield go,pos
def reflect(v):return v*np.array([1,1,-1])
g={'asset':{'version':'2.0','generator':'Motor W22 prefab conversion'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'materials':[],'accessors':[],'bufferViews':[]}
blob=bytearray()
def accessor(a,typ,component,target):
 while len(blob)%4:blob.append(0)
 view=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':a.nbytes,'target':target});blob.extend(a.tobytes())
 acc={'bufferView':view,'type':typ,'componentType':component,'count':len(a)}
 if typ=='VEC3':acc.update(min=a.min(axis=0).tolist(),max=a.max(axis=0).tolist())
 g['accessors'].append(acc);return len(g['accessors'])-1
nodes={};mats={}
for go,com in bygo.items():
 if '33' not in com or '23' not in com:continue
 mesh=guid[re.search(r'm_Mesh: .*?guid: (\w+)',com['33'])[1]]
 mat=guid[re.search(r'm_Materials:\s*- .*?guid: (\w+)',com['23'])[1]]
 hier=list(chain(goTransform[go]));owner=next(n for n,pos in hier if 'explosionOffset:' in bygo[n].get('114',''))
 group=objects[owner]
 origin=reflect(sum(p for n,p in chain(goTransform[owner])))
 if group not in nodes:
  behavior=bygo[owner]['114'];off=reflect(vec(field(behavior,'explosionOffset')))
  nodes[group]=len(g['nodes']);g['scenes'][0]['nodes'].append(nodes[group]);g['nodes'].append({'name':group,'translation':origin.tolist(),'children':[],'extras':{'explosionOffset':off.tolist()}})
 if mat not in mats:
  s=mat.read_text();color=[float(n) for n in re.search(r'_BaseColor: \{r: ([^,]+), g: ([^,]+), b: ([^,]+)',s).groups()]
  linear=[v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in color]
  mats[mat]=len(g['materials']);g['materials'].append({'name':mat.stem,'pbrMetallicRoughness':{'baseColorFactor':linear+[1],'metallicFactor':float(re.search('_Metallic: (.*)',s)[1]),'roughnessFactor':1-float(re.search('_Smoothness: (.*)',s)[1])}})
 s=mesh.read_text()
 data=np.frombuffer(bytes.fromhex(re.search(r'_typelessdata: (\w+)',s)[1]),'<f4').reshape(-1,8).copy();assert len(data)==int(re.search(r'm_VertexCount: (\d+)',s)[1]);data[:,[2,5]]*=-1;data[:,7]=1-data[:,7]
 indices=np.frombuffer(bytes.fromhex(re.search(r'm_IndexBuffer: ([0-9a-fA-F]+)',s)[1]),'<u2').reshape(-1,3).copy()
 # Match glTF's counterclockwise front faces to the reflected Unity normals.
 a,b,c=data[indices[:,0],:3],data[indices[:,1],:3],data[indices[:,2],:3]
 winding=(np.cross(b-a,c-a)*data[indices[:,0],3:6]).sum(axis=1)
 if np.sum(winding)<0:indices=indices[:,[0,2,1]]
 data,remap=np.unique(data,axis=0,return_inverse=True);indices=remap.reshape(-1)[indices].astype('<u2').flatten()
 attr={key:accessor(data[:,col],typ,5126,34962) for key,col,typ in [('POSITION',slice(0,3),'VEC3'),('NORMAL',slice(3,6),'VEC3'),('TEXCOORD_0',slice(6,8),'VEC2')]}
 prim={'attributes':attr,'indices':accessor(indices,'SCALAR',5123,34963),'material':mats[mat]};idx=len(g['meshes'])
 g['meshes'].append({'name':mesh.stem,'primitives':[prim]});g['nodes'][nodes[group]]['children'].append(len(g['nodes']))
 g['nodes'].append({'name':objects[go],'translation':(reflect(sum(p for n,p in hier))-origin).tolist(),'mesh':idx})
while len(blob)%4:blob.append(0)
g['buffers']=[{'byteLength':len(blob)}];js=json.dumps(g,separators=(',',':')).encode();js+=b' '*(-len(js)%4)
out.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(js)+len(blob))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(blob),b'BIN\0')+blob)
print(nodes.keys(),len(g['meshes']),len(mats),len(blob),sum(a['count']//3 for a in g['accessors'] if a['type']=='SCALAR'))
for group in nodes:
 n=g['nodes'][nodes[group]]
 bounds=[]
 for k in n['children']:
  ch=g['nodes'][k];acc=g['accessors'][g['meshes'][ch['mesh']]['primitives'][0]['attributes']['POSITION']]
  bounds+=list(np.array([acc['min'],acc['max']])+ch['translation']+np.array(n['translation']))
 print(group,np.min(bounds,axis=0),np.max(bounds,axis=0),n['extras'])
```

</details>

## Arquivos do site

| Arquivo | Responsabilidade |
| --- | --- |
| `index.html` | Estrutura da página, controles, descrições dos componentes e painel de realidade aumentada. |
| `visualizador.css` | Layout responsivo, tipografia, cards, rolagem da lista e aparência dos joysticks. |
| `motor-w22.glb` | Geometria, materiais, hierarquia e deslocamentos do modelo convertido. |
| `modelo-unity.js` | Leitura do cabeçalho e dos buffers do GLB, associação entre conjuntos e peças, escala de exibição e altura da base. |
| `motor3d.js` | Iluminação, sombras, animação, seleção de malhas, renderização WebGL e fallback Canvas 2D, sessão WebXR e controles. |
| `w22-weg.webp` | Foto ilustrativa do motor, derivada de uma imagem do catálogo WEG. |
| `README.md` | Instruções para executar, reproduzir, testar e publicar. |

## Testar, diagnosticar e publicar

- **Sintaxe.** Com Node.js, execute `node --check modelo-unity.js` e `node --check motor3d.js`.
- **Carregamento.** No Chrome DevTools, confirme que CSS, JavaScript, GLB e foto retornam HTTP 200. Se aparecer “Falha ao abrir o modelo”, confirme que a página está sendo servida por HTTP e que o GLB está ao lado do HTML.
- **Interface.** Confira as vistas, a seleção, o botão **Reiniciar**, a ordem das colunas no desktop e a rolagem da lista de componentes. As verificações automatizadas no Chrome cobriram larguras de 320, 390, 768 e 1440 px durante o desenvolvimento.
- **AR simulada.** O teste comparou os estados do visualizador e do WebGL com sessões WebXR simuladas via Chrome DevTools Protocol. Os scripts temporários de teste foram usados fora do repositório.
- **AR em aparelho real.** Teste com o Android em HTTPS, confirme a detecção do piso, experimente os joysticks e selecione peças nas duas vistas. Se a sessão não abrir, verifique as permissões, a disponibilidade do ARCore e o suporte a Hit Test e DOM Overlay. O tempo até o primeiro ponto válido depende do aparelho e do ambiente.
- **Publicação.** No seu repositório GitHub, abra **Settings → Pages** e selecione a publicação pela branch `main` e pasta raiz, se esse for o local do `index.html`. Abra a URL HTTPS informada pelo GitHub e confira se os arquivos estáticos carregam. [Configurar a origem de publicação no GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) · [Configurar HTTPS no GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)

## Referências e limites do protótipo

- [Manual do Unity Hub](https://docs.unity3d.com/es/current/Manual/GettingStartedUnityHub.html)
- [Especificação glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- [WebXR Device API](https://www.w3.org/TR/webxr/) · [Hit Test](https://www.w3.org/TR/webxr-hit-test-1/) · [DOM Overlay](https://www.w3.org/TR/webxr-dom-overlays-1/)
- [Catálogo WEG](https://www.weg.net/catalog/weg/BR/pt/IR3-Premium/c/BR_MT_3PHASE_LV_IR3PREMIUM) · [Imagem original da WEG](https://static.weg.net/medias/images/h12/haf/MKT_WMO_EU_IMAGE_3PHASE_W22_RAL5009_225_355_B3T_50C_1200Wx1200H.jpg)

Para usar o modelo em engenharia, valide a variante comercial, as dimensões, a geometria, os materiais e a escala em AR com os desenhos e as especificações do fabricante. O projeto atual se destina a demonstração e exploração visual.
