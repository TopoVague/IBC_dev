import * as THREE from "three";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import getLayer from './getLayer.js';

const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, w / h, 1, 100000);
camera.position.z = 20000;
camera.position.y = 10000;
camera.position.x = 10000;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.update();

function init(geometry) {
  const material = new THREE.MeshNormalMaterial();
  //const material = new THREE.MeshStandardMaterial({
  //  color: 0xffffff
  //});
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const sunlight = new THREE.DirectionalLight(0xffffff);
  sunlight.position.y = 100000;
  sunlight.position.z = 300000;
  scene.add(sunlight);

  const filllight = new THREE.DirectionalLight(0xffffff);
  filllight.position.x = 10000;
  filllight.position.y = 20000;
  filllight.position.z = 30000;
  scene.add(filllight);

  // Sprites BG
  const gradientBackground = getLayer({
    hue: 0.6,
    numSprites: 8,
    opacity: 0.2,
    radius: 10,
    size: 24,
    z: -10.5,
  });
  scene.add(gradientBackground);

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();
}

const loader = new OBJLoader();
loader.load("../assets/models/3dModuleTest1.obj", (obj) => init(obj.children[0].geometry));

function handleWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', handleWindowResize, false);