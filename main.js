let scene, camera, renderer, mesh;

scene = new THREE.Scene();
camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
boxGeometry = new THREE.BoxGeometry(2, 2, 2);
material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
mesh = new THREE.Mesh(boxGeometry, material);
canva = document.getElementById("canvas");
renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canva });

startScene();
animate();

function startScene() {
    let light = new THREE.AmbientLight(0xffaaff);
    
    scene.add(mesh);
    light.position.set(10, 10, 10);
    scene.add(light);
    camera.position.set(0, 0, 5);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    renderer.setClearColor(0xEEEEEE);
    renderer.setSize(window.innerWidth, window.innerHeight);

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    mesh.rotation.y += 0.01;

    renderer.render(scene, camera);
}
