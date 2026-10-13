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
export function updateNPCs(dt,playerPosition){for(const a of npcAgents){if(focusedNpc&&a.interactable===focusedNpc){const dx=playerPosition.x-a.object.position.x,dz=playerPosition.z-a.object.position.z;a.object.rotation.y=Math.atan2(dx,dz);a.walking=false;if(a.vrm){const h=a.vrm.humanoid;const la=h?.getNormalizedBoneNode('leftUpperArm'),ra=h?.getNormalizedBoneNode('rightUpperArm');if(la)la.rotation.z=.95;if(ra)ra.rotation.z=-.95;a.vrm.update(dt);}continue;}a.wait-=dt;if(a.wait>0){a.walking=false;continue;}let target=a.route[a.targetIndex];const dx=target.x-a.object.position.x,dz=target.z-a.object.position.z,dist=Math.hypot(dx,dz);if(dist<.45){a.targetIndex=(a.targetIndex+1)%a.route.length;a.wait=1+Math.random()*3;a.walking=false;if(Math.random()<.35&&a.interactable)window.dispatchEvent(new CustomEvent('npc-idle-event',{detail:{name:a.name}}));continue;}a.walking=true;const step=Math.min(dist,a.speed*dt);a.object.position.x+=dx/dist*step;a.object.position.z+=dz/dist*step;a.object.rotation.y=Math.atan2(dx,dz);if(a.kind==='caterpillar'){a.object.position.y=.04+Math.sin(performance.now()*.008)*.06;}else if(a.kind==='darling'){a.object.position.y=Math.abs(Math.sin(performance.now()*.006))*.06;}else if(a.kind==='observer'){a.object.position.y=0;if(a.vrm){const humanoid=a.vrm.humanoid;const swing=Math.sin(performance.now()*.009*a.speed)*.42*(a.walking?1:0);const leftArm=humanoid?.getNormalizedBoneNode('leftUpperArm'),rightArm=humanoid?.getNormalizedBoneNode('rightUpperArm'),leftLeg=humanoid?.getNormalizedBoneNode('leftUpperLeg'),rightLeg=humanoid?.getNormalizedBoneNode('rightUpperLeg');if(leftArm)leftArm.rotation.z=.95+swing*.18;if(rightArm)rightArm.rotation.z=-.95-swing*.18;if(leftLeg)leftLeg.rotation.x=swing;if(rightLeg)rightLeg.rotation.x=-swing;a.vrm.update(dt);}}
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
for(let z=9;z>-120;z-=18){for(let side of [-1,1]){const pole=box(.12,4,.12,mat(0x253847),side*7.9,2,z);const lamp=new THREE.PointLight(side===1?0x39dfff:0xff58be,1.4,12);lamp.position.set(side*7.8,4,z);scene.add(lamp);box(.5,.08,.25,mat(0x8df4ff,0x31cfff),side*7.8,4,z)}}
const grid=new THREE.GridHelper(180,90,0x16404d,0x142637);grid.position.set(0,.04,-55);grid.material.transparent=true;grid.material.opacity=.22;scene.add(grid);
makeTerminal(0,-8,0x62f4ff,'公共端末','未読の通知が一件。差出人は表示されていない。',{C:2,D:1});
makeTerminal(-5,-24,0xff75c8,'忘失物ボックス','中には古い学生証と、書きかけのメモが入っている。',{S:2,I:1});
makeTerminal(5,-38,0xb7a0ff,'監視カメラ制御盤','この区画のカメラを一時停止できそうだ。',{D:2,C:1});
makeTerminal(0,-57,0xffcc75,'自販機','甘い菓子パンが売り切れずに残っている。',{S:1,I:1});
makeTerminal(-3,-75,0x78ffb3,'路地の異常','壁に、存在しないはずの通りの地図が投影されている。',{C:2,I:1});
}
function makeTerminal(x,z,color,name,description,weights){const g=new THREE.Group();g.position.set(x,0,z);const body=new THREE.Mesh(new THREE.BoxGeometry(.75,1.6,.5),mat(0x172a3b));body.position.y=.8;g.add(body);const face=new THREE.Mesh(new THREE.PlaneGeometry(.52,.8),new THREE.MeshBasicMaterial({color}));face.position.set(0,1.02,.261);g.add(face);const glow=new THREE.PointLight(color,1.3,5);glow.position.y=1.5;g.add(glow);scene.add(g);interactables.push({object:g,name,type:'端末',hint:'Eキー / タップで調べる',description,weights,position:g.position,kind:'terminal'});}
export function makeCaterpillar(){const g=new THREE.Group();for(let i=0;i<5;i++){const r=.34-i*.025;const s=new THREE.Mesh(new THREE.SphereGeometry(r,20,14),new THREE.MeshStandardMaterial({color:i===0?0x98f36c:0x55b84b,roughness:.4,emissive:0x163e12}));s.position.set(0,.45, i*.34);g.add(s)}const eyeMat=new THREE.MeshBasicMaterial({color:0x111111});for(const x of [-.12,.12]){const e=new THREE.Mesh(new THREE.SphereGeometry(.055,10,8),eyeMat);e.position.set(x,.55,-.25);g.add(e)}for(const x of [-.13,.13]){const a=new THREE.Mesh(new THREE.CylinderGeometry(.018,.025,.22),mat(0x80e75d));a.position.set(x,.77,-.22);a.rotation.z=x>0?-.35:.35;g.add(a)}g.position.set(3,0,-17);scene.add(g);const item={object:g,name:'LSI芋虫',type:'観測個体',hint:'Eキー / タップで観察',description:'「感情も行動も、観測できる変数に分解すればよい。……ところで、なぜ君はここで立ち止まった？」',weights:{C:2,S:1},position:g.position,kind:'caterpillar'};interactables.push(item);registerRoamer({object:g,name:'LSI芋虫',kind:'caterpillar',route:roamingZones.alley,speed:.55,interactable:item});}
function makeDarling(){const g=new THREE.Group();const yellow=new THREE.MeshStandardMaterial({color:0xffdf46,roughness:.28,emissive:0x4a2f00,emissiveIntensity:.3});const head=new THREE.Mesh(new THREE.SphereGeometry(.62,32,24),yellow);head.scale.set(1,.9,.62);head.position.y=1.5;g.add(head);const white=new THREE.MeshBasicMaterial({color:0xffffff});const black=new THREE.MeshBasicMaterial({color:0x3c2430});const pink=new THREE.MeshBasicMaterial({color:0xff8eaa});for(const x of [-.22,.22]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.115,20,16),white);eye.position.set(x,1.58,.51);g.add(eye);const pupil=new THREE.Mesh(new THREE.SphereGeometry(.064,16,12),black);pupil.position.set(x,1.57,.605);g.add(pupil);const shine=new THREE.Mesh(new THREE.SphereGeometry(.025,8,8),white);shine.position.set(x-.025,1.61,.65);g.add(shine);const cheek=new THREE.Mesh(new THREE.SphereGeometry(.09,12,8),pink);cheek.scale.set(1,.5,.3);cheek.position.set(x*1.8,1.36,.51);g.add(cheek)}
// Tiny curved frown and oversized blue tears make the 🥺 expression readable in 3D.
const mouth=new THREE.Mesh(new THREE.TorusGeometry(.095,.025,8,20,Math.PI),black);mouth.position.set(0,1.31,.57);mouth.rotation.z=Math.PI;g.add(mouth);for(const x of [-.36,.36]){const tear=new THREE.Mesh(new THREE.SphereGeometry(.09,14,12),new THREE.MeshStandardMaterial({color:0x8fe8ff,transparent:true,opacity:.9,metalness:.2,roughness:.1,emissive:0x176a94}));tear.scale.set(.65,1.25,.55);tear.position.set(x,1.23,.54);g.add(tear)}
const body=new THREE.Mesh(new THREE.SphereGeometry(.32,20,16),yellow);body.scale.set(.8,1.1,.7);body.position.y=.83;g.add(body);for(const x of [-.38,.38]){const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.09,.4,4,8),yellow);arm.position.set(x,.83,0);arm.rotation.z=x<0?-.7:.7;g.add(arm)}for(const x of [-.16,.16]){const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.09,.3,4,8),yellow);leg.position.set(x,.25,0);g.add(leg)}g.position.set(-3,0,-18);scene.add(g);const item={object:g,name:'ダーリンちゃん',type:'感情観測個体',hint:'Eキー / タップで話しかける',description:'「……ダーリン、来てくれたの？🥺 ねえ、ちょっとだけでいいから、私の話を聞いて？」',weights:{I:2,S:1},position:g.position,kind:'darling'};interactables.push(item);registerRoamer({object:g,name:'ダーリンちゃん',kind:'darling',route:roamingZones.street,speed:1.05,interactable:item});}
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
