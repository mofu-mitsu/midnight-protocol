import * as THREE from 'three';
export const scene=new THREE.Scene();scene.background=new THREE.Color(0x050913);scene.fog=new THREE.FogExp2(0x050913,.018);
export const clock=new THREE.Clock();
export const interactables=[];
export const npcAgents=[];
let focusedNpc=null;
window.addEventListener('npc-focus',e=>{focusedNpc=e.detail?.item||null;if(focusedNpc){const a=npcAgents.find(n=>n.interactable===focusedNpc);if(a){a.wait=9999;a.walking=false;}}});
window.addEventListener('npc-unfocus',()=>{if(focusedNpc){const a=npcAgents.find(n=>n.interactable===focusedNpc);if(a)a.wait=1.5;}focusedNpc=null;});
const roamingZones={street:[[-5,-7],[5,-12],[-4,-22],[4,-31],[0,-44],[-5,-52],[4,-66],[0,-82]],sidewalk:[[-5,-15],[-3,-27],[-5,-39],[-3,-52],[-5,-68]],alley:[[3,-13],[5,-21],[3,-34],[5,-45],[3,-60],[5,-74]]};
function registerRoamer({object,name,kind,route,speed=1.1,idleMin=1,idleMax=4,interactable=null}){const agent={object,name,kind,route:route.map(p=>new THREE.Vector3(p[0],0,p[1])),targetIndex:Math.floor(Math.random()*route.length),speed,wait:Math.random()*3+1,walking:false,interactable};npcAgents.push(agent);return agent;}
export function updateNPCs(dt,playerPosition){for(const a of npcAgents){if(focusedNpc&&a.interactable===focusedNpc){const dx=playerPosition.x-a.object.position.x,dz=playerPosition.z-a.object.position.z;a.object.rotation.y=Math.atan2(dx,dz)+(a.kind==='observer'?Math.PI:0);a.walking=false;if(a.vrm){const h=a.vrm.humanoid;const la=h?.getNormalizedBoneNode('leftUpperArm'),ra=h?.getNormalizedBoneNode('rightUpperArm');if(la)la.rotation.z=1.18;if(ra)ra.rotation.z=-1.18;a.vrm.update(dt);}continue;}a.wait-=dt;if(a.wait>0){a.walking=false;continue;}let target=a.route[a.targetIndex];const dx=target.x-a.object.position.x,dz=target.z-a.object.position.z,dist=Math.hypot(dx,dz);if(dist<.45){a.targetIndex=(a.targetIndex+1)%a.route.length;a.wait=1+Math.random()*3;a.walking=false;if(Math.random()<.35&&a.interactable)window.dispatchEvent(new CustomEvent('npc-idle-event',{detail:{name:a.name}}));continue;}a.walking=true;const step=Math.min(dist,a.speed*dt);a.object.position.x+=dx/dist*step;a.object.position.z+=dz/dist*step;a.object.rotation.y=Math.atan2(dx,dz)+(a.kind==='observer'?Math.PI:0);if(a.kind==='caterpillar'){a.object.position.y=.04+Math.sin(performance.now()*.008)*.06;}else if(a.kind==='darling'){a.object.position.y=Math.abs(Math.sin(performance.now()*.006))*.06;}else if(a.kind==='observer'){a.object.position.y=0;if(a.vrm){const humanoid=a.vrm.humanoid;const swing=Math.sin(performance.now()*.009*a.speed)*.42*(a.walking?1:0);const leftArm=humanoid?.getNormalizedBoneNode('leftUpperArm'),rightArm=humanoid?.getNormalizedBoneNode('rightUpperArm'),leftLeg=humanoid?.getNormalizedBoneNode('leftUpperLeg'),rightLeg=humanoid?.getNormalizedBoneNode('rightUpperLeg');if(leftArm)leftArm.rotation.z=1.18+swing*.12;if(rightArm)rightArm.rotation.z=-1.18-swing*.12;if(leftLeg)leftLeg.rotation.x=swing;if(rightLeg)rightLeg.rotation.x=-swing;a.vrm.update(dt);}}
if(playerPosition&&a.object.position.distanceTo(playerPosition)<2.8&&Math.random()<.002){a.wait=2+Math.random()*3;a.walking=false;}
}}
const mat=(color,emissive=0x000000,roughness=.8)=>new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:.7,roughness});
function box(w,h,d,material,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m}
export function createWorld(){
scene.add(new THREE.HemisphereLight(0x9dcfff,0x090711,1.2));const moon=new THREE.DirectionalLight(0x8ccfff,1.4);moon.position.set(-20,35,15);scene.add(moon);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,220),mat(0x101723));ground.rotation.x=-Math.PI/2;ground.position.z=-55;scene.add(ground);
const road=box(15,.08,190,mat(0x111923),0,.01,-55);road.material.roughness=.35;
for(let x=-7;x<=7;x+=3.5){const line=box(.035,.02,185,mat(0x304b58,0x153b48),x,.07,-55);line.material.transparent=true;line.material.opacity=.5}
for(let z=15;z>-150;z-=8){box(.12,.025,2.4,mat(0x9f9a66,0x645b23),0,.08,z)}
const palette=[0x101a30,0x17152b,0x11232e,0x1b1a2c,0x172536];
for(let side of [-1,1])for(let z=15;z>-145;z-=10){const x=side*(11+Math.random()*4),w=5+Math.random()*8,h=8+Math.random()*28,d=6+Math.random()*5;const b=box(w,h,d,mat(palette[Math.floor(Math.random()*palette.length)]),x,h/2,z);b.userData.building=true;
for(let yy=2;yy<h-1;yy+=2.1)for(let xx=-w/2+.8;xx<w/2-.3;xx+=1.35){if(Math.random()>.35){const win=box(.48,.8,.04,mat([0x4a9caf,0x9c6d9e,0xc4a968][Math.floor(Math.random()*3)],0x173a4b),x+xx,yy,z+side*(d/2+.03));win.material.emissiveIntensity=.6}}
if(Math.random()>.35){const sign=box(w*.65,1.2,.16,mat(0x092a39,0x007e9c),x,h*.55,z+side*(d/2+.18));sign.userData.sign=true;}
}
// Walk-in building: a small lit lobby behind an obvious cyan entrance.
const lobby=new THREE.Group();lobby.position.set(10,0,-28);scene.add(lobby);
const floor=new THREE.Mesh(new THREE.BoxGeometry(7,.16,8),mat(0x243344));floor.position.set(0,.08,0);lobby.add(floor);
for(const [x,z,w,d] of [[-3.45,0,.12,8],[3.45,0,.12,8],[0,-3.95,7,.12],[0,3.95,7,.12]]){const wall=new THREE.Mesh(new THREE.BoxGeometry(w,3,d),mat(0x172536));wall.position.set(x,1.5,z);lobby.add(wall);}
const ceiling=new THREE.Mesh(new THREE.BoxGeometry(7,.12,8),mat(0x101b2a));ceiling.position.y=3;lobby.add(ceiling);
const lamp=new THREE.PointLight(0x58dcff,2.2,12);lamp.position.set(0,2.7,0);lobby.add(lamp);
const desk=new THREE.Mesh(new THREE.BoxGeometry(2,.9,.65),mat(0x26384a));desk.position.set(0,.5,-1.6);lobby.add(desk);
const doorLight=box(1.7,2.5,.12,mat(0x0b5063,0x00b8dd),10,1.25,-23.9);
const doorGlow=new THREE.PointLight(0x26dfff,1.8,8);doorGlow.position.set(10,1.5,-23.4);scene.add(doorGlow);
const doorGroup=new THREE.Group();doorGroup.position.set(10,0,-24);scene.add(doorGroup);
interactables.push({object:doorGroup,name:'ネオン・アーカイブ',type:'建物入口',hint:'Eキー / タップで入る',description:'街の記録を保管する小さな施設。中には端末と休憩スペースがある。',weights:{C:1,S:1},position:doorGroup.position,kind:'building',interior:lobby});
for(let z=9;z>-120;z-=18){for(let side of [-1,1]){const pole=box(.12,4,.12,mat(0x253847),side*7.9,2,z);const lamp=new THREE.PointLight(side===1?0x39dfff:0xff58be,1.4,12);lamp.position.set(side*7.8,4,z);scene.add(lamp);box(.5,.08,.25,mat(0x8df4ff,0x31cfff),side*7.8,4,z)}}
const grid=new THREE.GridHelper(180,90,0x16404d,0x142637);grid.position.set(0,.04,-55);grid.material.transparent=true;grid.material.opacity=.22;scene.add(grid);

// Branching cross streets and urban props
const sideRoadMat=mat(0x0b121d);
for(const z of [-30,-62,-94]){box(42,.07,6,sideRoadMat,0,.015,z);for(let x=-18;x<=18;x+=5){box(1.2,.025,.08,mat(0x3b6974,0x15313b),x,.07,z);}}
function streetProp(name,type,x,z,color,description,weights,kind='prop'){
 const g=new THREE.Group();g.position.set(x,0,z);const base=mat(0x172637),glow=mat(color,color);
 if(name.includes('自販機')){const body=new THREE.Mesh(new THREE.BoxGeometry(.9,1.8,.65),base);body.position.y=.9;g.add(body);const panel=new THREE.Mesh(new THREE.PlaneGeometry(.65,1.15),new THREE.MeshBasicMaterial({color}));panel.position.set(0,1.05,.331);g.add(panel);for(let i=0;i<6;i++){const dot=new THREE.Mesh(new THREE.BoxGeometry(.13,.12,.02),new THREE.MeshBasicMaterial({color:[0xff75c8,0x72f6ff,0xffd36e][i%3]}));dot.position.set(-.2+(i%3)*.2,.65+Math.floor(i/3)*.22,.35);g.add(dot);}}
 else if(name.includes('ベンチ')){const seat=new THREE.Mesh(new THREE.BoxGeometry(1.7,.12,.45),base);seat.position.y=.55;g.add(seat);for(const x of [-.65,.65]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.12,.55,.12),glow);leg.position.set(x,.27,0);g.add(leg)}}
 else if(name.includes('バス停')){const pole=new THREE.Mesh(new THREE.BoxGeometry(.08,2.3,.08),glow);pole.position.y=1.15;g.add(pole);const sign=new THREE.Mesh(new THREE.BoxGeometry(.7,.9,.08),base);sign.position.set(0,1.9,0);g.add(sign);const face=new THREE.Mesh(new THREE.PlaneGeometry(.5,.68),new THREE.MeshBasicMaterial({color}));face.position.set(0,1.9,.05);g.add(face)}
 else if(name.includes('信号')){const pole=new THREE.Mesh(new THREE.BoxGeometry(.1,2.5,.1),base);pole.position.y=1.25;g.add(pole);const boxy=new THREE.Mesh(new THREE.BoxGeometry(.35,.8,.22),base);boxy.position.set(0,2.15,0);g.add(boxy);for(let i=0;i<3;i++){const lamp=new THREE.Mesh(new THREE.SphereGeometry(.08,10,8),new THREE.MeshBasicMaterial({color:[0xff345f,0xffc94f,0x52ff9c][i]}));lamp.position.set(0,2.4-i*.25,.13);g.add(lamp)}}
 else if(name.includes('ゴミ箱')){const bin=new THREE.Mesh(new THREE.CylinderGeometry(.28,.24,.8,12),base);bin.position.y=.4;g.add(bin);const lid=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.08,12),glow);lid.position.y=.84;g.add(lid)}
 else {const body=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.4,.12),base);body.position.y=.7;g.add(body);const face=new THREE.Mesh(new THREE.PlaneGeometry(.9,1.1),new THREE.MeshBasicMaterial({color}));face.position.set(0,.8,.07);g.add(face)}
 scene.add(g);interactables.push({object:g,name,type,hint:'Eキー / タップで調べる',description,weights,position:g.position,kind});
}
streetProp('夜光自販機','生活設備',-6,-19,0x72f6ff,'冷たい飲み物と、売り切れ表示の甘いパン。買う？それとも機械の裏を調べる？',{S:1,I:1});
streetProp('雨宿りベンチ','休憩場所',6,-32,0xff75c8,'濡れたベンチ。誰かが小さなメモを置いていった。',{S:2,I:1});
streetProp('無人バス停','交通設備',-6,-48,0x9f9aff,'時刻表には、存在しない路線「0番線」が記されている。',{C:1,I:1});
streetProp('路上ゴミ箱','生活設備',6,-54,0x78ffb3,'ゴミ箱の中から、微かな電子音が聞こえる。',{D:1,C:1});
streetProp('点滅信号','交通設備',-6,-68,0xff5c7a,'信号が赤・青・赤・青と高速で切り替わる。渡る？止まる？',{D:1,C:1},'chaos');
streetProp('ネオン広告板','街の看板',6,-82,0xb7a0ff,'広告の人物が、こちらを見ている気がする。',{I:2,C:1});
const anomaly={position:new THREE.Vector3(0,0,-96),object:new THREE.Group(),name:'歪曲した交差点',type:'都市異常',hint:'Eキー / タップで接触',description:'道路の先が折れ曲がって見える。観測ログには「未定義の選択肢」が出現している。',weights:{D:1,I:1,S:1,C:1},kind:'chaos'};
anomaly.object.position.copy(anomaly.position);scene.add(anomaly.object);
const ring=new THREE.Mesh(new THREE.TorusGeometry(1.7,.035,8,48),new THREE.MeshBasicMaterial({color:0xff43c6}));ring.rotation.x=Math.PI/2;ring.position.y=.12;anomaly.object.add(ring);
const anomalyLight=new THREE.PointLight(0xff43c6,2,12);anomalyLight.position.y=1.5;anomaly.object.add(anomalyLight);interactables.push(anomaly);

makeTerminal(0,-8,0x62f4ff,'公共端末','未読の通知が一件。差出人は表示されていない。',{C:2,D:1});
makeTerminal(-5,-24,0xff75c8,'忘失物ボックス','中には古い学生証と、書きかけのメモが入っている。',{S:2,I:1});
makeTerminal(5,-38,0xb7a0ff,'監視カメラ制御盤','この区画のカメラを一時停止できそうだ。',{D:2,C:1});
makeTerminal(0,-57,0xffcc75,'自販機','甘い菓子パンが売り切れずに残っている。',{S:1,I:1});
makeTerminal(-3,-75,0x78ffb3,'路地の異常','壁に、存在しないはずの通りの地図が投影されている。',{C:2,I:1});
}
function makeTerminal(x,z,color,name,description,weights){const g=new THREE.Group();g.position.set(x,0,z);const body=new THREE.Mesh(new THREE.BoxGeometry(.75,1.6,.5),mat(0x172a3b));body.position.y=.8;g.add(body);const face=new THREE.Mesh(new THREE.PlaneGeometry(.52,.8),new THREE.MeshBasicMaterial({color}));face.position.set(0,1.02,.261);g.add(face);const glow=new THREE.PointLight(color,1.3,5);glow.position.y=1.5;g.add(glow);scene.add(g);interactables.push({object:g,name,type:'端末',hint:'Eキー / タップで調べる',description,weights,position:g.position,kind:'terminal'});}
export function makeCaterpillar(){const g=new THREE.Group();for(let i=0;i<5;i++){const r=.34-i*.025;const s=new THREE.Mesh(new THREE.SphereGeometry(r,20,14),new THREE.MeshStandardMaterial({color:i===0?0x98f36c:0x55b84b,roughness:.4,emissive:0x163e12}));s.position.set(0,.45, i*.34);g.add(s)}const eyeMat=new THREE.MeshBasicMaterial({color:0x111111});for(const x of [-.12,.12]){const e=new THREE.Mesh(new THREE.SphereGeometry(.055,10,8),eyeMat);e.position.set(x,.55,-.25);g.add(e)}for(const x of [-.13,.13]){const a=new THREE.Mesh(new THREE.CylinderGeometry(.018,.025,.22),mat(0x80e75d));a.position.set(x,.77,-.22);a.rotation.z=x>0?-.35:.35;g.add(a)}g.position.set(3,0,-17);scene.add(g);const item={object:g,name:'LSI芋虫',type:'観測個体',hint:'Eキー / タップで観察',description:'「感情も行動も、観測できる変数に分解すればよい。……ところで、なぜ君はここで立ち止まった？」',weights:{C:2,S:1},position:g.position,kind:'caterpillar'};interactables.push(item);registerRoamer({object:g,name:'LSI芋虫',kind:'caterpillar',route:roamingZones.alley,speed:.55,interactable:item});}
function makeDarling(){
 const g=new THREE.Group();
 const yellow=new THREE.MeshStandardMaterial({color:0xffdf46,roughness:.55,emissive:0x332000,emissiveIntensity:.12});
 // Compact body, with a flat emoji face rather than protruding facial parts.
 const body=new THREE.Mesh(new THREE.SphereGeometry(.32,24,18),yellow);body.scale.set(.9,1.05,.78);body.position.y=.72;g.add(body);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.52,32,24),yellow);head.scale.set(1,.94,.72);head.position.y=1.42;g.add(head);
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
 const ctx=canvas.getContext('2d');ctx.clearRect(0,0,512,512);
 ctx.font='390px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('🥺',256,270);
 const faceTexture=new THREE.CanvasTexture(canvas);faceTexture.colorSpace=THREE.SRGBColorSpace;
 const face=new THREE.Mesh(new THREE.PlaneGeometry(.76,.76),new THREE.MeshBasicMaterial({map:faceTexture,transparent:true,depthWrite:false}));
 face.position.set(0,1.43,.385);g.add(face);
 for(const x of [-.31,.31]){const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.065,.28,4,8),yellow);arm.position.set(x,.78,0);arm.rotation.z=x<0?-.35:.35;g.add(arm)}
 for(const x of [-.15,.15]){const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.075,.24,4,8),yellow);leg.position.set(x,.19,0);g.add(leg)}
 g.position.set(-3,0,-18);scene.add(g);
 const item={object:g,name:'ダーリンちゃん',type:'感情観測個体',hint:'Eキー / タップで話しかける',description:'「……ダーリン、来てくれたの？🥺 ねえ、ちょっとだけでいいから、私の話を聞いて？」',weights:{I:2,S:1},position:g.position,kind:'darling'};
 interactables.push(item);registerRoamer({object:g,name:'ダーリンちゃん',kind:'darling',route:roamingZones.street,speed:1.05,interactable:item});
}
export function spawnCharacters(){makeCaterpillar();makeDarling();}
// VRoid Studioで書き出したNPC用VRMをリポジトリからロードする。
export async function loadObserverNPC(){
 try{
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const {VRMLoaderPlugin}=await import('three-vrm');
  const loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser));
  loader.load('./assets/models/npcs/observer.vrm',gltf=>{
   const vrm=gltf.userData.vrm;if(!vrm){console.warn('observer.vrm was loaded, but VRM metadata is missing.');return;}
   const model=vrm.scene;model.name='観測者の子';model.scale.setScalar(1);model.position.set(-4,0,-12);scene.add(model);
   const item={object:model,name:'観測者',type:'都市住人',hint:'Eキー / タップで話しかける',description:'「……この街、どこまで続いているんだろう。少し歩いてみようかな。」',weights:{S:1,I:1},position:model.position,kind:'observer',vrm};
   interactables.push(item);registerRoamer({object:model,name:'観測者',kind:'observer',route:roamingZones.sidewalk,speed:.72,interactable:item});npcAgents[npcAgents.length-1].vrm=vrm;
   window.observerVRM=vrm;window.dispatchEvent(new CustomEvent('observer-model-loaded'));
  },undefined,error=>console.info('NPCモデル未配置: assets/models/npcs/observer.vrm',error));
 }catch(error){console.warn('VRM loader unavailable or model not uploaded yet.',error);}
}
