import * as THREE from 'three';
import { scene, clock, createWorld, spawnCharacters, loadObserverNPC, updateNPCs, updateCityLife } from './world.js';
import { setupControls } from './controls.js';
import { setupInteractions } from './interactions.js';
import { setupUI } from './ui.js';
import { ResultsController } from './results.js';

const host = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
host.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(76, innerWidth / innerHeight, 0.1, 260);
camera.position.set(0, 1.65, 10);
scene.add(camera);

createWorld();
spawnCharacters();
loadObserverNPC();

const controls = setupControls(camera, renderer);
const interactions = setupInteractions(camera);
setupUI(interactions);
const resultsController = new ResultsController();

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
});

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  controls.update(dt);
  updateNPCs(dt, camera.position);
  updateCityLife(dt);
  interactions.update();

  renderer.render(scene, camera);
}

animate();
