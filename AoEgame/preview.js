import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { loadPerson, personMesh } from "./people.js?v=play43";

const SHELL = [
    ["wood", "../models/wood.png"],
    ["plaster", "../models/plaster.png"],
    ["brick", "../models/brick.png"],
    ["rock", "../models/brick.png"]
];

const KITS = new Set([
    "lorsmanor-courtyard", "small-house1", "barracks", "farm",
    "salt-works-ex", "storehouse", "blacksmith"
]);

const NAMED = {
    militia: { skin: ["../models/meshy/militia.skin.bin", "../models/meshy/militia.skin.png"] },
    villager: { skin: ["../models/meshy/villager.skin.bin", "../models/meshy/villager.skin.png"] },
    bear: { file: "../models/creatures/_glb/bear-idle.glb" },
    wolf: { file: "../models/creatures/_glb/wolf-idle.glb" },
    warg: { file: "../models/creatures/_glb/warg-idle.glb" },
    fox: { file: "../models/fox full.glb" },
    deer: { file: "../models/creatures/_glb/deer-idle.glb" },
    rat: { file: "../models/creatures/_glb/rat-idle.glb" },
    snake: { file: "../models/snake.glb" },
    eagle: { file: "../models/egle.glb" },
    spider: { file: "../models/creatures/_glb/spider-idle.glb" },
    wasp: { file: "../models/creatures/_glb/wasp-idle.glb" },
    centipede: { file: "../models/creatures/_glb/centipede-idle.glb" },
    ooze: { file: "../models/creatures/_glb/ooze-idle.glb" },
    rhino: { file: "../models/creatures/_glb/rhino-idle.glb" },
    mammoth: { file: "../models/creatures/_glb/mammoth-idle.glb" },
    cow: { file: "../models/cow/cow.glb" },
    dragon: { file: "../models/dragon/dragon.glb" },
    horse: { file: "../models/horse/horse.glb" },
    horse2: { file: "../models/horse.glb" },
    ch10: { baked: ["../models/kaykit/ch10-0.bin", "../models/kaykit/ch10-0.png"] },
    crossbow: { file: "../tools/Meshy_AI_lowpoly_medieval_crossbow_20261102_texture_a0475ada/Meshy_AI_model.glb" },
    spear: { file: "../tools/Meshy_AI_lowpoly_medieval_spear_20261102_texture_f72770c0/Meshy_AI_model.glb" },
    mace: { file: "../tools/Meshy_AI_lowpoly_medieval_mace_20261102_texture_5d63fe2a/Meshy_AI_model.glb" },
    musket: { file: "../tools/Meshy_AI_lowpoly_medieval_musket_20261102_texture_b96c6c21/Meshy_AI_model.glb" },
    halberd: { image: "weapons pack/3D_fantasy_weapons_pack/previews/halberd.gif" }
};

let renderer;
let scene;
let camera;
let token = 0;
let lookCenter = null;
let lookFit = 1;
let lookDist = 1;

function stage() {
    if (renderer) return;
    const canvas = document.getElementById("look-canvas");
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(640, 480, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xc8d0c0);
    scene.add(new THREE.HemisphereLight(0xfff6ea, 0x6a7a58, 1.25));
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.35);
    sun.position.set(4, 8, 5);
    scene.add(sun);
    camera = new THREE.PerspectiveCamera(35, 640 / 480, 0.01, 500);
}

function clearStage() {
    if (!scene) return;
    const drop = scene.children.filter((child) => !child.isLight);
    drop.forEach((child) => {
        scene.remove(child);
        child.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            const materials = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
            materials.forEach((material) => {
                if (material.map) material.map.dispose();
                material.dispose();
            });
        });
    });
}

function placeLook() {
    const dist = lookDist;
    const center = lookCenter;
    camera.position.set(center.x + dist * 0.85, center.y + dist * 0.35, center.z + dist);
    camera.near = Math.max(dist / 100, 0.01);
    camera.far = Math.max(dist * 20, 50);
    camera.updateProjectionMatrix();
    camera.lookAt(center);
    renderer.render(scene, camera);
}

function frame(object) {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const point = new THREE.Vector3();
    let posed = false;
    object.traverse((node) => {
        if (!node.isSkinnedMesh || !node.skeleton) return;
        node.skeleton.update();
        const bones = node.skeleton.bones;
        for (let i = 0; i < bones.length; i++) {
            point.setFromMatrixPosition(bones[i].matrixWorld);
            box.expandByPoint(point);
            posed = true;
        }
    });
    if (!posed || box.isEmpty()) box.setFromObject(object);
    else box.expandByScalar(box.getSize(point).y * 0.12);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 0.0001) * 0.5;
    lookCenter = center;
    lookFit = radius / Math.sin((camera.fov * Math.PI) / 360);
    lookDist = lookFit;
    placeLook();
}

function zoomLook(outward) {
    if (!lookCenter) return;
    const next = lookDist * (outward ? 1.7 : 0.6);
    lookDist = Math.min(lookFit * 1.7, Math.max(lookFit * 0.6, next));
    placeLook();
}

function kitGeometry(floats, cx, cz) {
    const count = floats.length / 6;
    const pos = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const color = new Float32Array(count * 3);
    for (let v = 0; v < count; v++) {
        const i = v * 6;
        pos[v * 3] = floats[i] - cx;
        pos[v * 3 + 1] = floats[i + 1];
        pos[v * 3 + 2] = floats[i + 2] - cz;
        uv[v * 2] = floats[i + 3];
        uv[v * 2 + 1] = floats[i + 4];
        color[v * 3] = color[v * 3 + 1] = color[v * 3 + 2] = floats[i + 5];
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geom.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geom.setAttribute("color", new THREE.BufferAttribute(color, 3));
    geom.computeVertexNormals();
    return geom;
}

function loadTexture(url) {
    return new Promise((resolve, reject) => {
        new THREE.TextureLoader().load(url, (tex) => {
            tex.flipY = false;
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.wrapS = THREE.ClampToEdgeWrapping;
            tex.wrapT = THREE.ClampToEdgeWrapping;
            resolve(tex);
        }, undefined, reject);
    });
}

async function loadKit(id) {
    const meta = await fetch("../models/kitbuild/" + id + ".meta.json").then((res) => {
        if (!res.ok) throw new Error("missing");
        return res.json();
    });
    const group = new THREE.Group();
    for (let i = 0; i < SHELL.length; i++) {
        const matName = SHELL[i][0];
        if (!(meta.materials || []).some((item) => item.mat === matName)) continue;
        const [buf, tex] = await Promise.all([
            fetch("../models/kitbuild/" + id + "-" + matName + ".bin").then((res) => res.arrayBuffer()),
            loadTexture(SHELL[i][1])
        ]);
        const mat = new THREE.MeshStandardMaterial({
            map: tex,
            vertexColors: true,
            roughness: 0.86,
            side: THREE.DoubleSide
        });
        group.add(new THREE.Mesh(kitGeometry(new Float32Array(buf), meta.cx, meta.cz), mat));
    }
    if (!group.children.length) throw new Error("empty");
    return group;
}

async function loadBaked(url, textureUrl) {
    const buf = await fetch(url).then((res) => {
        if (!res.ok) throw new Error("missing");
        return res.arrayBuffer();
    });
    const view = new DataView(buf);
    const count = view.getUint32(4, true);
    const frame = new Float32Array(buf, 8, count * 6);
    const pos = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    for (let v = 0; v < count; v++) {
        pos[v * 3] = frame[v * 6];
        pos[v * 3 + 1] = frame[v * 6 + 1];
        pos[v * 3 + 2] = frame[v * 6 + 2];
        uv[v * 2] = frame[v * 6 + 3];
        uv[v * 2 + 1] = frame[v * 6 + 4];
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geom.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geom.computeVertexNormals();
    const tex = await loadTexture(textureUrl);
    return new THREE.Mesh(geom, new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.86,
        side: THREE.DoubleSide
    }));
}

function loadFile(url) {
    return new Promise((resolve, reject) => {
        if (/\.fbx$/i.test(url)) {
            const manager = new THREE.LoadingManager();
            manager.setURLModifier((path) => {
                if (/House_texture_atlas\.png/i.test(path)) return "../models/houses/House_texture_atlas.png?v=atlas1";
                return path;
            });
            new FBXLoader(manager).load(encodeURI(url), (object) => {
                const started = Date.now();
                const wait = () => {
                    let pending = false;
                    object.traverse((node) => {
                        if (!node.isMesh || !node.material) return;
                        const materials = Array.isArray(node.material) ? node.material : [node.material];
                        materials.forEach((material) => {
                            const map = material && material.map;
                            if (map && (!map.image || !map.image.complete)) pending = true;
                        });
                    });
                    if (!pending || Date.now() - started > 4000) resolve(object);
                    else setTimeout(wait, 40);
                };
                wait();
            }, undefined, reject);
            return;
        }
        new GLTFLoader().load(encodeURI(url), (gltf) => resolve(gltf.scene), undefined, reject);
    });
}

function showImage(url) {
    const img = document.getElementById("look-img");
    const canvas = document.getElementById("look-canvas");
    return new Promise((resolve, reject) => {
        img.onload = () => {
            img.hidden = false;
            canvas.hidden = true;
            resolve();
        };
        img.onerror = () => reject(new Error("missing"));
        img.alt = "";
        img.src = encodeURI(url);
    });
}

function pictureFor(model, name) {
    const raw = String(model || "").trim();
    const called = String(name || "").trim().toLowerCase();
    if (/\.(gif|png|jpe?g|webp)$/i.test(raw)) return { image: raw };
    if (/\.fbx$/i.test(raw)) return { file: raw };
    if (/\.(glb|gltf)$/i.test(raw)) {
        if (raw.indexOf("3D_fantasy_weapons_pack/models/") >= 0) {
            return { image: raw.replace("/models/", "/previews/").replace(/\.glb$/i, ".gif"), file: raw };
        }
        return { file: raw };
    }
    if (NAMED[raw]) return NAMED[raw];
    if (KITS.has(raw)) return { kit: raw };
    if (NAMED[called]) return NAMED[called];
    return null;
}

function note(text) {
    document.getElementById("look-note").textContent = text;
}

async function openLook(title, model, name) {
    const mine = ++token;
    const dialog = document.getElementById("look");
    const img = document.getElementById("look-img");
    const canvas = document.getElementById("look-canvas");
    document.getElementById("look-title").textContent = title || "Graphic";
    img.hidden = true;
    img.removeAttribute("src");
    canvas.hidden = true;
    document.getElementById("look-zoom").hidden = true;
    lookCenter = null;
    note("Loading…");
    if (!dialog.open) dialog.showModal();
    const found = pictureFor(model, name);
    if (!found) {
        note("No picture is stored for this one yet.");
        return;
    }
    try {
        if (found.image) {
            try {
                await showImage(found.image);
                if (mine !== token) return;
                note("");
                return;
            } catch (err) {
                if (!found.file) throw err;
            }
        }
        stage();
        clearStage();
        canvas.hidden = false;
        img.hidden = true;
        let object;
        if (found.skin) object = personMesh(await loadPerson(found.skin[0], found.skin[1]));
        else if (found.baked) object = await loadBaked(found.baked[0], found.baked[1]);
        else if (found.kit) object = await loadKit(found.kit);
        else object = await loadFile(found.file);
        if (mine !== token) return;
        scene.add(object);
        frame(object);
        document.getElementById("look-zoom").hidden = false;
        note("");
    } catch (err) {
        if (mine !== token) return;
        canvas.hidden = true;
        note("No picture is stored for this one yet.");
    }
}

document.getElementById("look").addEventListener("close", () => {
    token += 1;
    lookCenter = null;
    clearStage();
});
document.getElementById("look-out").addEventListener("click", () => zoomLook(true));
document.getElementById("look-in").addEventListener("click", () => zoomLook(false));

window.AoeLook = { open: openLook };
