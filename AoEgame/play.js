import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { natureData } from "./generated_terrain%20Big%20map.js?v=map3";
import { loadPerson, personMesh } from "./people.js?v=play43";
import { kindById, loadKitShell, makeMapShape, makeStandIn, plantModel } from "./map-props.js?v=obj5";
import { loadPathPaint, makeGroundMaterial, setPathFrame } from "./ground-look.js?v=look2";
import { loadPackTrees, packTree, treeRoll } from "./pack-trees.js?v=trees1";

const MANOR = "lorsmanor-courtyard";
const SHELL = [
    ["wood", "../models/wood.png"],
    ["plaster", "../models/plaster.png"],
    ["brick", "../models/brick.png"],
    ["rock", "../models/brick.png"]
];

const groundColors = {
    "ground-grass": 0x5fa040,
    "ground-rocky": 0x8fa080,
    "ground-gravel": 0x9a968c,
    "ground-dirt": 0x8b6a40,
    "ground-sand": 0xd8c08a,
    "ground-marsh": 0x4a5a30
};

const note = document.getElementById("note");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec8ee);
scene.add(new THREE.HemisphereLight(0xfff4e0, 0x3d6b28, 1.15));
const sun = new THREE.DirectionalLight(0xfff0d0, 1.1);
sun.position.set(40, 80, 20);
scene.add(sun);

const terrain = new THREE.Group();
scene.add(terrain);

// The island exported in newmapfromex. The flat plateau save is left alone.
const BOARD_URL = "newmapfromex/manual.glb?v=1";
const BOARD_SEA = 141;
const playTest = new URLSearchParams(location.search).get("playtest") === "1";
if (playTest) {
    document.title = "Play test";
    const rules = document.querySelector("#bar p:not(#note)");
    if (rules) rules.textContent = "In this play test a building or a person goes down as soon as you click the ground, for the side you are leading, and nothing is taken from the stock. The rest of the match is the same. " + rules.textContent;
}
let board = null;
let viewFar = 220;

// Faction markers in the editor file are editor steps. One step is 16 m on the real island.
const MAP_ACROSS = 16;
const MAP_UP = 4;
const AREA = {
    forest: true,
    water: true,
    river: true,
    path: true,
    road: true,
    cliff: true,
    "ground-grass": true,
    "ground-rocky": true,
    "ground-gravel": true,
    "ground-dirt": true,
    "ground-sand": true,
    "ground-marsh": true
};
for (let i = 0; i < natureData.length; i++) {
    const item = natureData[i];
    item.px *= MAP_ACROSS;
    item.pz *= MAP_ACROSS;
    if (Number.isFinite(item.py)) item.py *= MAP_UP;
    if (AREA[item.type] && item.s) item.s *= MAP_ACROSS;
}

const factionCubes = natureData.filter((item) => item.type === "cube" && (item.s || 1) < 3);
let factionPair = factionCubes.slice(0, 2);
let factionGap = Infinity;
for (let i = 0; i < factionCubes.length; i++) {
    for (let j = i + 1; j < factionCubes.length; j++) {
        const gap = Math.hypot(factionCubes[i].px - factionCubes[j].px, factionCubes[i].pz - factionCubes[j].pz);
        if (gap < factionGap) {
            factionGap = gap;
            factionPair = [factionCubes[i], factionCubes[j]];
        }
    }
}
const teams = factionPair.slice().sort((a, b) => b.px - a.px);
const mapBox = new THREE.Box3(new THREE.Vector3(-4200, -80, -4200), new THREE.Vector3(4200, 220, 4200));

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.3, 9000);
const look = new THREE.Vector3(teams[0] ? teams[0].px + 2 : 0, 2, teams[0] ? teams[0].pz + 14 : 0);
const pitch = 1.2;
let yaw = 0;
let dist = 58;
const manors = [];
let pilot = null;
let lookYaw = 0;
let lookPitch = 0;
let eye = 1.2;
let inHead = false;
const eyeScratch = new THREE.Vector3();
const wallRay = new THREE.Raycaster();

function walkerHead() {
    if (!pilot || !pilot.body) return null;
    if (pilot.headBone) return pilot.headBone;
    let head = null;
    pilot.body.traverse((obj) => {
        if (obj.name === "mixamorigHead") head = obj;
    });
    if (head) pilot.headBone = head;
    return head;
}

function placeCamera() {
    if (pilot) {
        const fx = Math.sin(lookYaw);
        const fz = Math.cos(lookYaw);
        const cp = Math.cos(lookPitch);
        const aim = 8;
        if (inHead) {
            const head = walkerHead();
            const ahead = 0.36;
            let x = pilot.x + fx * ahead;
            let y = pilot.group.position.y + eye;
            let z = pilot.z + fz * ahead;
            if (head) {
                head.getWorldPosition(eyeScratch);
                x = eyeScratch.x + fx * ahead;
                y = eyeScratch.y + 0.02;
                z = eyeScratch.z + fz * ahead;
            }
            camera.position.set(x, y, z);
            camera.lookAt(x + fx * cp * aim, y + Math.sin(lookPitch) * aim, z + fz * cp * aim);
            return;
        }
        const headY = pilot.group.position.y + eye;
        const back = 2.3;
        camera.position.set(pilot.x - fx * back, headY + 0.42, pilot.z - fz * back);
        camera.lookAt(
            pilot.x + fx * cp * aim,
            headY + Math.sin(lookPitch) * aim,
            pilot.z + fz * cp * aim
        );
        return;
    }
    const cp = Math.cos(pitch);
    const aimY = board ? heightAt(look.x, look.z) + 8 : look.y;
    camera.position.set(
        look.x + Math.sin(yaw) * cp * dist,
        aimY + Math.sin(pitch) * dist,
        look.z + Math.cos(yaw) * cp * dist
    );
    camera.lookAt(look.x, aimY, look.z);
}

function mapScale() {
    const half = Math.tan((camera.fov * Math.PI / 180) / 2);
    const reach = dist / Math.max(0.45, Math.sin(pitch));
    return (2 * half * reach) / Math.max(1, renderer.domElement.clientHeight);
}

function panBy(dx, dy, scale) {
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    const foreX = -Math.sin(yaw);
    const foreZ = -Math.cos(yaw);
    look.x = Math.max(mapBox.min.x, Math.min(mapBox.max.x, look.x + (-dx * rightX + dy * foreX) * scale));
    look.z = Math.max(mapBox.min.z, Math.min(mapBox.max.z, look.z + (-dx * rightZ + dy * foreZ) * scale));
}

function boardHeight(x, z) {
    const u = (x - board.minX) / board.span;
    const v = (z - board.minZ) / board.span;
    if (u < 0 || v < 0 || u > 1 || v > 1) return BOARD_SEA - 8;
    const n = board.n;
    const fx = u * (n - 1);
    const fz = v * (n - 1);
    const i = Math.min(n - 2, Math.max(0, Math.floor(fx)));
    const j = Math.min(n - 2, Math.max(0, Math.floor(fz)));
    const tx = fx - i;
    const tz = fz - j;
    const h = board.heights;
    const i00 = j * n + i;
    const h00 = h[i00];
    const h10 = h[i00 + 1];
    const h01 = h[i00 + n];
    const h11 = h[i00 + n + 1];
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
}

function heightAt(x, z) {
    if (board) return boardHeight(x, z);
    const world = window.World;
    return world ? world.heightAt(x, z) : 0;
}

function groundStep(x, z) {
    if (!pilot || landStep === 16) return 16;
    const reach = window.__aoeNearReach || 0;
    if (reach && Math.hypot(x - landMarkX, z - landMarkZ) <= reach) return 2;
    return 8;
}

function latticeHeight(x, z) {
    if (board) return boardHeight(x, z);
    const step = groundStep(x, z);
    const x0 = Math.floor(x / step) * step;
    const z0 = Math.floor(z / step) * step;
    const tx = (x - x0) / step;
    const tz = (z - z0) / step;
    const h00 = heightAt(x0, z0);
    const h10 = heightAt(x0 + step, z0);
    const h01 = heightAt(x0, z0 + step);
    const h11 = heightAt(x0 + step, z0 + step);
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
}

function porchAt(x, z) {
    let y = null;
    for (let i = 0; i < floorPads.length; i++) {
        const pad = floorPads[i];
        if (x < pad.minX || z < pad.minZ || x > pad.minX + pad.w || z > pad.minZ + pad.d) continue;
        if (y == null || pad.y > y) y = pad.y;
    }
    return y;
}

function feetAt(x, z) {
    let ground = latticeHeight(x, z);
    const porch = porchAt(x, z);
    if (porch != null) ground = Math.max(ground, porch);
    const world = window.World;
    const deck = world && world.bridgeDeck ? world.bridgeDeck(x, z) : null;
    return deck == null ? ground : Math.max(ground, deck);
}

function stairAt(x, z, feet) {
    let best = null;
    const list = [];
    if (home && home.rooms && home.rooms.floors) list.push(home);
    if (cpuHome && cpuHome.rooms && cpuHome.rooms.floors) list.push(cpuHome);
    for (let i = 0; i < built.length; i++) {
        if (built[i].rooms && built[i].rooms.floors) list.push(built[i]);
    }
    for (let i = 0; i < list.length; i++) {
        const entry = list[i];
        const floors = entry.rooms.floors;
        const lx = x - entry.x;
        const lz = z - entry.z;
        const reach = Math.max(entry.hx || MANOR_HX, entry.hz || MANOR_HZ) + 3;
        if (Math.abs(lx) > reach || Math.abs(lz) > reach) continue;
        const base = entry.group ? entry.group.position.y : (entry.y || 0);
        for (let s = 0; s < floors.length; s++) {
            const sol = floors[s];
            if (lx < sol.x - 0.12 || lx > sol.x + sol.w + 0.12 || lz < sol.z - 0.12 || lz > sol.z + sol.d + 0.12) continue;
            const y = base + sol.y;
            if (y > feet + 0.5) continue;
            if (best == null || y > best) best = y;
        }
    }
    return best;
}

function inWater(x, z) {
    if (board) return boardHeight(x, z) < BOARD_SEA;
    const world = window.World;
    if (!world || !world.wet) return false;
    if (world.bridgeDeck && world.bridgeDeck(x, z) != null) return false;
    return world.wet(x, z);
}

function coverAt(x, z) {
    if (!board || !board.cover) return inWater(x, z) ? 0 : 1;
    const u = (x - board.minX) / board.span;
    const v = (z - board.minZ) / board.span;
    if (u < 0 || v < 0 || u > 1 || v > 1) return 0;
    if (boardHeight(x, z) < BOARD_SEA) return 0;
    const n = board.n;
    const i = Math.min(n - 1, Math.max(0, Math.round(u * (n - 1))));
    const j = Math.min(n - 1, Math.max(0, Math.round(v * (n - 1))));
    return board.cover[j * n + i];
}

function closedGround(x, z) {
    return inWater(x, z) || coverAt(x, z) === 3;
}

function canStep(x, z, nx, nz) {
    if (!closedGround(nx, nz)) return true;
    if (!closedGround(x, z)) return false;
    return heightAt(nx, nz) >= heightAt(x, z) - 0.05;
}

function markerGeometry(type) {
    const forest = type === "forest";
    let geom;
    if (forest) geom = new THREE.CylinderGeometry(3, 3, 0.6, 16);
    else if (type === "cliff") geom = new THREE.BoxGeometry(1, 4, 1);
    else if (type === "water") geom = new THREE.CylinderGeometry(1.6, 1.6, 0.18, 14);
    else if (type === "river") geom = new THREE.CylinderGeometry(0.9, 0.9, 0.3, 12);
    else if (type === "ore") geom = new THREE.DodecahedronGeometry(1.6);
    else if (groundColors[type]) geom = new THREE.CylinderGeometry(1, 1, 0.15, 16);
    else geom = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 10);
    const lift = forest ? 0.3 : type === "water" ? 0.16 : type === "cliff" ? 2 : type === "ore" ? 1.15 : groundColors[type] ? 0.1 : 0.2;
    geom.translate(0, lift, 0);
    return geom;
}

const markerCache = {};
function natureMesh(item) {
    if (item.type !== "ore") return null;
    const key = item.type;
    if (!markerCache[key]) {
        const color = groundColors[key] || (key === "forest" ? 0x2f6b2a : key === "water" ? 0x2f7fd0 : key === "cliff" ? 0x6f675c : key === "path" ? 0x8a6a3c : key === "ore" ? 0xd4a52a : 0x9a9a92);
        markerCache[key] = {
            geom: markerGeometry(key),
            mat: new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.9,
                transparent: key === "forest" || key === "water" || !!groundColors[key],
                opacity: key === "forest" ? 0.55 : key === "water" ? 0.72 : groundColors[key] ? 0.45 : 1,
                depthWrite: !groundColors[key] && key !== "water"
            })
        };
    }
    const mesh = new THREE.Mesh(markerCache[key].geom, markerCache[key].mat);
    mesh.position.set(item.px, key === "ore" ? heightAt(item.px, item.pz) : item.py, item.pz);
    mesh.rotation.y = item.ry || 0;
    const wide = item.s || 1;
    const tall = key === "ore" ? wide : (groundColors[key] || key === "forest" || key === "water" ? 1 : wide);
    mesh.scale.set(wide, tall, wide);
    return mesh;
}

if (!BOARD_URL) natureData.forEach((item) => {
    const mesh = natureMesh(item);
    if (mesh) scene.add(mesh);
});

function treeFile(url) {
    const split = (url || "").indexOf(":");
    if (split < 1) return "";
    const kind = url.slice(0, split);
    const id = url.slice(split + 1);
    if (kind === "megakit") return "../models/nature-megakit/glTF/" + encodeURIComponent(id) + ".gltf";
    if (kind === "deciduous") return "../models/3D_deciduous_trees_pack/3D_deciduous_trees_pack/models/" + encodeURIComponent(id) + ".glb";
    return "";
}

const treeLoader = new GLTFLoader();
const treeModels = {};
function loadTree(url) {
    if (!treeModels[url]) {
        treeModels[url] = new Promise((resolve, reject) => {
            treeLoader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
        });
    }
    return treeModels[url];
}

function placeTrees() {
    natureData.forEach((item) => {
        if (item.type !== "tree") return;
        const file = treeFile(item.url);
        if (!file) return;
        loadTree(file).then((source) => {
            const mesh = source.clone(true);
            mesh.traverse((child) => {
                if (!child.isMesh || !child.material) return;
                const list = Array.isArray(child.material) ? child.material : [child.material];
                list.forEach((mat) => {
                    mat.metalness = 0;
                    mat.roughness = 1;
                    mat.side = THREE.DoubleSide;
                });
            });
            mesh.position.set(item.px, heightAt(item.px, item.pz), item.pz);
            mesh.rotation.y = item.ry || 0;
            const wide = item.s || 1;
            mesh.scale.set(wide, wide, wide);
            scene.add(mesh);
        }).catch(() => {});
    });
}
if (!BOARD_URL) placeTrees();

const rockFiles = ["Rock_Medium_1", "Rock_Medium_2", "Rock_Medium_3"];
if (!BOARD_URL) Promise.all(rockFiles.map((id) => loadTree("../models/nature-megakit/glTF/" + encodeURIComponent(id) + ".gltf"))).then((models) => {
    natureData.forEach((item, index) => {
        if (item.type !== "cylinder") return;
        for (let k = 0; k < 4; k++) {
            const mesh = models[(index + k) % models.length].clone(true);
            mesh.traverse((child) => {
                if (!child.isMesh || !child.material) return;
                const list = Array.isArray(child.material) ? child.material : [child.material];
                list.forEach((mat) => {
                    mat.metalness = 0;
                    mat.roughness = 1;
                    mat.side = THREE.DoubleSide;
                });
            });
            const ang = k * 1.7 + index;
            const rad = k === 0 ? 0 : 2.4;
            const x = item.px + Math.cos(ang) * rad;
            const z = item.pz + Math.sin(ang) * rad;
            mesh.position.set(x, heightAt(x, z), z);
            mesh.rotation.y = ang;
            const wide = 1.5 + (k % 3) * 0.35;
            mesh.scale.set(wide, wide, wide);
            scene.add(mesh);
        }
    });
}).catch(() => {});

const woods = new THREE.Group();
scene.add(woods);
let woodMarkX = 1e9;
let woodMarkZ = 1e9;
let woodToken = 0;
const woodFiles = ["CommonTree_1", "CommonTree_2", "CommonTree_3", "TwistedTree_2", "TwistedTree_3"];
let woodModels = null;

function loadWoodModels() {
    if (!woodModels) {
        woodModels = Promise.all(woodFiles.map((id) => loadTree("../models/nature-megakit/glTF/" + encodeURIComponent(id) + ".gltf")));
    }
    return woodModels;
}

function refreshWoods() {
    if (board || BOARD_URL) return;
    const world = window.World;
    if (!world || !world.trees) return;
    const x = pilot ? pilot.x : look.x;
    const z = pilot ? pilot.z : look.z;
    if (Math.hypot(x - woodMarkX, z - woodMarkZ) < 36 && woods.children.length) return;
    woodMarkX = x;
    woodMarkZ = z;
    const near = [];
    for (let i = 0; i < world.trees.length; i++) {
        const tree = world.trees[i];
        if (!tree.forest && !tree.edit) continue;
        const d = Math.hypot(tree.x - x, tree.z - z);
        if (d > 260) continue;
        near.push({ tree: tree, d: d });
    }
    near.sort((a, b) => a.d - b.d);
    const pick = near.slice(0, 180);
    const token = ++woodToken;
    loadWoodModels().then((models) => {
        if (token !== woodToken) return;
        while (woods.children.length) woods.remove(woods.children[0]);
        for (let i = 0; i < pick.length; i++) {
            const spot = pick[i].tree;
            const src = models[Math.abs(Math.floor(spot.x) * 3 + Math.floor(spot.z)) % models.length];
            const mesh = src.clone(true);
            mesh.traverse((child) => {
                if (!child.isMesh || !child.material) return;
                const list = Array.isArray(child.material) ? child.material : [child.material];
                list.forEach((mat) => {
                    mat.metalness = 0;
                    mat.roughness = 1;
                    mat.side = THREE.DoubleSide;
                });
            });
            const y = heightAt(spot.x, spot.z);
            mesh.position.set(spot.x, y, spot.z);
            mesh.rotation.y = ((Math.floor(spot.x) * 17 + Math.floor(spot.z)) % 63) / 10;
            const wide = 0.85 + (Math.abs(Math.floor(spot.x + spot.z)) % 5) * 0.07;
            mesh.scale.set(wide, wide, wide);
            woods.add(mesh);
        }
    }).catch(() => {
        if (token === woodToken) woodMarkX = 1e9;
    });
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
        const shade = floats[i + 5];
        color[v * 3] = shade;
        color[v * 3 + 1] = shade;
        color[v * 3 + 2] = shade;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geom.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geom.setAttribute("color", new THREE.BufferAttribute(color, 3));
    geom.computeVertexNormals();
    return geom;
}

function loadTexture(url) {
    const loader = new THREE.TextureLoader();
    return new Promise((resolve, reject) => {
        loader.load(url, (tex) => {
            tex.flipY = false;
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.wrapS = THREE.ClampToEdgeWrapping;
            tex.wrapT = THREE.ClampToEdgeWrapping;
            resolve(tex);
        }, undefined, reject);
    });
}

function speck(g, s, count, a, b) {
    for (let i = 0; i < count; i++) {
        g.fillStyle = Math.random() < 0.5 ? a : b;
        g.fillRect((Math.random() * s) | 0, (Math.random() * s) | 0, 2, 2);
    }
}

function landTexture(paint) {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    paint(canvas.getContext("2d"), 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

const landTex = {
    grass: landTexture((g, s) => {
        g.fillStyle = "#4d7a3c";
        g.fillRect(0, 0, s, s);
        speck(g, s, 280, "rgba(28,68,22,0.42)", "rgba(156,196,92,0.34)");
    }),
    dirt: landTexture((g, s) => {
        g.fillStyle = "#8b7044";
        g.fillRect(0, 0, s, s);
        speck(g, s, 200, "rgba(70,48,24,0.4)", "rgba(196,164,110,0.35)");
    }),
    sand: landTexture((g, s) => {
        g.fillStyle = "#c6a56a";
        g.fillRect(0, 0, s, s);
        speck(g, s, 160, "rgba(150,110,60,0.35)", "rgba(230,210,160,0.4)");
    }),
    gravel: landTexture((g, s) => {
        g.fillStyle = "#5e5a53";
        g.fillRect(0, 0, s, s);
        speck(g, s, 180, "rgba(40,38,34,0.4)", "rgba(130,124,116,0.45)");
    }),
    marsh: landTexture((g, s) => {
        g.fillStyle = "#3d5a32";
        g.fillRect(0, 0, s, s);
        speck(g, s, 140, "rgba(20,40,18,0.4)", "rgba(90,120,70,0.35)");
    }),
    water: landTexture((g, s) => {
        g.fillStyle = "#2f6f9a";
        g.fillRect(0, 0, s, s);
        speck(g, s, 80, "rgba(180,220,240,0.25)", "rgba(20,60,90,0.25)");
    }),
    crag: landTexture((g, s) => {
        g.fillStyle = "#6d6a64";
        g.fillRect(0, 0, s, s);
        speck(g, s, 160, "rgba(40,38,36,0.45)", "rgba(150,146,140,0.35)");
    })
};
landTex.cobble = landTex.gravel;
landTex.townDirt = landTex.dirt;
landTex.townCobble = landTex.gravel;

function landMaterial(map, blend) {
    const mat = new THREE.MeshBasicMaterial({
        map: map,
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: !!blend,
        depthWrite: !blend
    });
    if (!blend) return mat;
    mat.customProgramCacheKey = function () { return "land-blend"; };
    mat.onBeforeCompile = function (shader) {
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nattribute float cover;\nvarying float vCover;")
            .replace("#include <begin_vertex>", "#include <begin_vertex>\nvCover = cover;");
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nvarying float vCover;")
            .replace("#include <opaque_fragment>", "#include <opaque_fragment>\ngl_FragColor.a *= vCover;");
    };
    return mat;
}

function landGeometry(floats, stride) {
    const count = floats.length / stride;
    const pos = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const color = new Float32Array(count * 3);
    const shade = new Float32Array(count);
    const cover = stride === 7 ? new Float32Array(count) : null;
    for (let i = 0; i < count; i++) {
        const o = i * stride;
        pos[i * 3] = floats[o];
        pos[i * 3 + 1] = floats[o + 1];
        pos[i * 3 + 2] = floats[o + 2];
        uv[i * 2] = floats[o + 3];
        uv[i * 2 + 1] = floats[o + 4];
        const tone = floats[o + 5];
        color[i * 3] = tone;
        color[i * 3 + 1] = tone;
        color[i * 3 + 2] = tone;
        shade[i] = tone;
        if (cover) cover[i] = floats[o + 6];
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geom.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geom.setAttribute("color", new THREE.BufferAttribute(color, 3));
    geom.setAttribute("shade", new THREE.BufferAttribute(shade, 1));
    if (cover) geom.setAttribute("cover", new THREE.BufferAttribute(cover, 1));
    return geom;
}

let landMarkX = Infinity;
let landMarkZ = Infinity;
let landStep = 0;

function srgbByte(value) {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function coverByte(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (min >= 200 && max - min <= 40) return 3;
    if (max - min <= 32 && min >= 70 && max < 200 && Math.abs(r - g) <= 22 && Math.abs(g - b) <= 28) return 2;
    return 1;
}

function sampleSurfaceColors(surface) {
    const uv = surface.geometry && surface.geometry.getAttribute("uv");
    const material = Array.isArray(surface.material) ? surface.material[0] : surface.material;
    const image = material && material.map && material.map.image;
    if (!uv || !image || !image.width) return null;
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, image.width, image.height).data;
    const colors = new Float32Array(uv.count * 3);
    const cover = new Uint8Array(uv.count);
    const w = image.width;
    const h = image.height;
    for (let i = 0; i < uv.count; i++) {
        const u = uv.getX(i) - Math.floor(uv.getX(i));
        const v = uv.getY(i) - Math.floor(uv.getY(i));
        const x = Math.min(w - 1, Math.max(0, Math.round(u * (w - 1))));
        const y = Math.min(h - 1, Math.max(0, Math.round((1 - v) * (h - 1))));
        const p = (y * w + x) * 4;
        colors[i * 3] = srgbByte(data[p]);
        colors[i * 3 + 1] = srgbByte(data[p + 1]);
        colors[i * 3 + 2] = srgbByte(data[p + 2]);
        cover[i] = coverByte(data[p], data[p + 1], data[p + 2]);
    }
    return { colors: colors, cover: cover };
}

function packedFloats(buffer, binAt, json, acc) {
    const view = json.bufferViews[acc.bufferView];
    const start = binAt + (view.byteOffset || 0) + (acc.byteOffset || 0);
    return new Float32Array(buffer, start, acc.count * 3);
}

function readIsland(buffer) {
    const view = new DataView(buffer);
    if (view.getUint32(0, true) !== 0x46546c67) throw new Error("map file");
    const jsonLen = view.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLen)));
    const binAt = 28 + jsonLen;
    const prim = json.meshes[0].primitives[0];
    const posAcc = json.accessors[prim.attributes.POSITION];
    if (!posAcc || posAcc.componentType !== 5126 || posAcc.type !== "VEC3") throw new Error("map positions");
    const n = Math.round(Math.sqrt(posAcc.count));
    if (n * n !== posAcc.count) throw new Error("map grid");
    const pos = packedFloats(buffer, binAt, json, posAcc);
    const heights = new Float32Array(posAcc.count);
    let minX = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < posAcc.count; i++) {
        const o = i * 3;
        const x = pos[o];
        heights[i] = pos[o + 1];
        const z = pos[o + 2];
        if (x < minX) minX = x;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (z > maxZ) maxZ = z;
    }
    let colors = null;
    let cover = null;
    const colAcc = prim.attributes.COLOR_0 != null ? json.accessors[prim.attributes.COLOR_0] : null;
    if (colAcc && colAcc.componentType === 5126 && colAcc.type === "VEC3" && colAcc.count === posAcc.count) {
        const col = packedFloats(buffer, binAt, json, colAcc);
        colors = new Float32Array(colAcc.count * 3);
        cover = new Uint8Array(colAcc.count);
        for (let i = 0; i < colAcc.count; i++) {
            const o = i * 3;
            colors[o] = col[o];
            colors[o + 1] = col[o + 1];
            colors[o + 2] = col[o + 2];
            cover[i] = coverByte(col[o] * 255, col[o + 1] * 255, col[o + 2] * 255);
        }
    }
    return { heights: heights, colors: colors, cover: cover, n: n, minX: minX, minZ: minZ, maxX: maxX, maxZ: maxZ, span: maxX - minX };
}

function finishBoard(island) {
    board = {
        heights: island.heights,
        colors: island.colors,
        cover: island.cover,
        n: island.n,
        minX: island.minX,
        minZ: island.minZ,
        span: island.span,
        sea: BOARD_SEA,
        walkAt: null
    };
    mapBox.min.set(island.minX, -40, island.minZ);
    mapBox.max.set(island.maxX, 420, island.maxZ);
    board.mapMesh = buildBoardGrid(0, 0, island.n - 1, island.n - 1, 4);
    terrain.add(board.mapMesh);
    setPathFrame(island.minX, island.minZ, island.maxX - island.minX, island.maxZ - island.minZ);
    addShoreFood();
    loadPathPaint();
    const sea = new THREE.Mesh(
        new THREE.PlaneGeometry(island.maxX - island.minX, island.maxZ - island.minZ),
        new THREE.MeshStandardMaterial({ color: 0x2a6d86, transparent: true, opacity: 0.62, roughness: 0.2, depthWrite: false })
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set((island.minX + island.maxX) / 2, BOARD_SEA, (island.minZ + island.maxZ) / 2);
    terrain.add(sea);
    viewFar = 1600;
}

function loadBoard() {
    return fetch(BOARD_URL).then((res) => {
        if (!res.ok) throw new Error("map missing");
        return res.arrayBuffer();
    }).then((buffer) => {
        finishBoard(readIsland(buffer));
    });
}

const boardMat = makeGroundMaterial();
const walkFog = new THREE.Fog(0x8ec8ee, 80, 210);
const backdropMap = new THREE.TextureLoader().load("fp-backdrop.png");
backdropMap.colorSpace = THREE.SRGBColorSpace;
backdropMap.wrapS = THREE.ClampToEdgeWrapping;
backdropMap.wrapT = THREE.ClampToEdgeWrapping;
backdropMap.offset.y = -0.12;
const backdrop = new THREE.Mesh(
    new THREE.CylinderGeometry(220, 220, 340, 64, 1, true),
    new THREE.MeshBasicMaterial({
        map: backdropMap,
        side: THREE.BackSide,
        fog: false,
        depthWrite: false
    })
);
backdrop.renderOrder = -1;
backdrop.visible = false;
scene.add(backdrop);

function placeBackdrop() {
    if (!pilot) {
        backdrop.visible = false;
        return;
    }
    backdrop.visible = true;
    backdrop.position.set(camera.position.x, camera.position.y, camera.position.z);
}

function buildBoardGrid(i0, j0, i1, j1, step) {
    const n = board.n;
    const jump = Math.max(1, step);
    const cols = Math.max(1, Math.floor((i1 - i0) / jump));
    const rows = Math.max(1, Math.floor((j1 - j0) / jump));
    const across = cols + 1;
    const down = rows + 1;
    const pos = new Float32Array(across * down * 3);
    const col = new Float32Array(across * down * 3);
    const uv = new Float32Array(across * down * 2);
    for (let row = 0; row < down; row++) {
        const gz = Math.min(n - 1, j0 + row * jump);
        for (let column = 0; column < across; column++) {
            const gx = Math.min(n - 1, i0 + column * jump);
            const src = gz * n + gx;
            const o = (row * across + column) * 3;
            pos[o] = board.minX + (gx / (n - 1)) * board.span;
            pos[o + 1] = board.heights[src];
            pos[o + 2] = board.minZ + (gz / (n - 1)) * board.span;
            const uo = (row * across + column) * 2;
            uv[uo] = pos[o] / 3.5;
            uv[uo + 1] = pos[o + 2] / 3.5;
            if (board.colors) {
                col[o] = board.colors[src * 3];
                col[o + 1] = board.colors[src * 3 + 1];
                col[o + 2] = board.colors[src * 3 + 2];
            } else {
                col[o] = 0.42;
                col[o + 1] = 0.55;
                col[o + 2] = 0.28;
            }
        }
    }
    const idx = new Uint32Array(cols * rows * 6);
    let t = 0;
    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < cols; column++) {
            const a = row * across + column;
            idx[t++] = a;
            idx[t++] = a + across;
            idx[t++] = a + 1;
            idx[t++] = a + 1;
            idx[t++] = a + across;
            idx[t++] = a + across + 1;
        }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geom.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geom.setIndex(new THREE.BufferAttribute(idx, 1));
    geom.computeVertexNormals();
    const mesh = new THREE.Mesh(geom, boardMat);
    mesh.receiveShadow = true;
    return mesh;
}

function stepBoardView() {
    if (!board || !board.mapMesh) return;
    board.mapMesh.visible = !pilot;
    if (!pilot) {
        if (board.walkMesh) board.walkMesh.visible = false;
        if (scene.fog === walkFog) scene.fog = null;
        if (camera.far !== 9000) {
            camera.far = 9000;
            camera.updateProjectionMatrix();
        }
        return;
    }
    if (scene.fog !== walkFog) scene.fog = walkFog;
    if (camera.far !== 480) {
        camera.far = 480;
        camera.updateProjectionMatrix();
    }
    const moved = !board.walkAt || Math.hypot(pilot.x - board.walkAt.x, pilot.z - board.walkAt.z) > 36;
    if (!moved && board.walkMesh) {
        board.walkMesh.visible = true;
        return;
    }
    const n = board.n;
    const metres = board.span / (n - 1);
    const reach = Math.ceil(220 / metres);
    const cx = Math.round(((pilot.x - board.minX) / board.span) * (n - 1));
    const cz = Math.round(((pilot.z - board.minZ) / board.span) * (n - 1));
    const next = buildBoardGrid(
        Math.max(0, cx - reach),
        Math.max(0, cz - reach),
        Math.min(n - 1, cx + reach),
        Math.min(n - 1, cz + reach),
        1
    );
    if (board.walkMesh) {
        terrain.remove(board.walkMesh);
        board.walkMesh.geometry.dispose();
    }
    board.walkMesh = next;
    terrain.add(next);
    board.walkAt = { x: pilot.x, z: pilot.z };
}

function dryHomes() {
    const spots = [];
    const n = board.n;
    const step = 8;
    for (let j = step; j < n - step; j += step) {
        for (let i = step; i < n - step; i += step) {
            const y = board.heights[j * n + i];
            if (y < BOARD_SEA + 4 || y > BOARD_SEA + 90) continue;
            if (board.cover && board.cover[j * n + i] !== 1) continue;
            const rise = Math.max(
                Math.abs(board.heights[j * n + i + 2] - y),
                Math.abs(board.heights[(j + 2) * n + i] - y)
            );
            if (rise > 4) continue;
            spots.push({
                x: board.minX + (i / (n - 1)) * board.span,
                z: board.minZ + (j / (n - 1)) * board.span
            });
        }
    }
    for (let i = spots.length - 1; i > 0; i--) {
        const k = Math.floor(Math.random() * (i + 1));
        const swap = spots[i];
        spots[i] = spots[k];
        spots[k] = swap;
    }
    const first = spots[0] || { x: 40, z: 40 };
    let second = null;
    let spare = null;
    for (let i = 1; i < spots.length; i++) {
        const gap = Math.hypot(spots[i].x - first.x, spots[i].z - first.z);
        if (gap > 140 && !spare) spare = spots[i];
        if (gap > 140 && gap < 420) {
            second = spots[i];
            break;
        }
    }
    if (!second) second = spare || spots[1] || { x: first.x + 180, z: first.z + 40 };
    return [first, second];
}

function refreshLand(force) {
    if (BOARD_URL) return;
    const world = window.World;
    const meshLib = window.LandMesh;
    if (!world || !meshLib) return;
    window.__aoeGround = true;
    const x = pilot ? pilot.x : look.x;
    const z = pilot ? pilot.z : look.z;
    const step = pilot ? 8 : 16;
    window.__aoeStep = step;
    window.__aoeNear = pilot ? 2 : 0;
    window.__aoeNearReach = pilot ? 48 : 0;
    window.__aoeReach = pilot ? 160 : 360;
    const moved = Math.hypot(x - landMarkX, z - landMarkZ);
    if (!force && step === landStep && moved < (pilot ? 20 : 140)) return;
    landMarkX = x;
    landMarkZ = z;
    landStep = step;
    const reach = window.__aoeReach;
    let built;
    try {
        built = meshLib.build(x, z, reach);
    } catch (err) {
        note.textContent = "The ground did not build. " + err.message;
        return;
    }
    while (terrain.children.length) {
        const child = terrain.children[0];
        terrain.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    }
    const names = Object.keys(built.meshes);
    for (let i = 0; i < names.length; i++) {
        const floats = built.meshes[names[i]];
        if (!floats || !floats.length) continue;
        const mesh = new THREE.Mesh(landGeometry(floats, 6), landMaterial(landTex[names[i]] || landTex.grass, false));
        mesh.receiveShadow = true;
        terrain.add(mesh);
    }
    const kinds = Object.keys(built.blends);
    for (let i = 0; i < kinds.length; i++) {
        const floats = built.blends[kinds[i]];
        if (!floats || !floats.length) continue;
        terrain.add(new THREE.Mesh(landGeometry(floats, 7), landMaterial(landTex[kinds[i]] || landTex.dirt, true)));
    }
    appendBridges();
}

function pushSpan(list, a, b, c, d) {
    list.push(...a, ...b, ...c, ...a, ...c, ...d);
}

function addBridgeSpan(list, bridge) {
    const hw = bridge.width / 2;
    const inner = hw - 0.45;
    const wall = 0.95;
    const pier = 1;
    const spring = bridge.water - 0.4;
    const wetLen = bridge.wetTo - bridge.wetFrom;
    const arches = Math.max(1, Math.round(wetLen / 18));
    const archLen = wetLen / arches;
    const top = (u) => window.World.deckY(bridge, u);
    const at = (along, across, y, u, v) => [
        bridge.x + bridge.dx * along - bridge.dz * across,
        y,
        bridge.z + bridge.dz * along + bridge.dx * across,
        u,
        v,
        0.9
    ];
    const bottom = (u) => {
        const w = u - bridge.wetFrom;
        if (w < 0 || w > wetLen) return -6;
        const k = Math.min(arches - 1, Math.floor(w / archLen));
        const f = w - k * archLen;
        if (Math.min(f, archLen - f) < pier) return -6;
        const rise = Math.max(0.5, Math.min(archLen * 0.45, top(bridge.wetFrom + (k + 0.5) * archLen) - 1.1 - spring));
        const g = (f - pier) / (archLen - pier * 2);
        return Math.min(top(u) - 0.6, spring + rise * Math.sin(Math.PI * g));
    };
    const cuts = [];
    for (let u = -bridge.half; u < bridge.half; u += 0.75) cuts.push(u);
    cuts.push(bridge.half);
    for (let k = 0; k <= arches; k++) {
        const edge = bridge.wetFrom + k * archLen;
        for (const side of [-pier, pier]) cuts.push(edge + side - 0.01, edge + side + 0.01);
    }
    const along = cuts.filter((u) => u >= -bridge.half && u <= bridge.half).sort((a, b) => a - b);
    for (let i = 1; i < along.length; i++) {
        const a = along[i - 1];
        const b = along[i];
        if (b - a < 1e-4) continue;
        const ta = top(a);
        const tb = top(b);
        const ba = bottom(a);
        const bb = bottom(b);
        const ua = a / 2.5;
        const ub = b / 2.5;
        for (const side of [-1, 1]) {
            pushSpan(list, at(a, side * hw, ba, ua, ba / 2.5), at(a, side * hw, ta + wall, ua, (ta + wall) / 2.5), at(b, side * hw, tb + wall, ub, (tb + wall) / 2.5), at(b, side * hw, bb, ub, bb / 2.5));
            pushSpan(list, at(a, side * inner, ta, ua, ta / 2.5), at(a, side * inner, ta + wall, ua, (ta + wall) / 2.5), at(b, side * inner, tb + wall, ub, (tb + wall) / 2.5), at(b, side * inner, tb, ub, tb / 2.5));
            pushSpan(list, at(a, side * inner, ta + wall, ua, 0), at(a, side * hw, ta + wall, ua, 0.18), at(b, side * hw, tb + wall, ub, 0.18), at(b, side * inner, tb + wall, ub, 0));
        }
        pushSpan(list, at(a, -inner, ta, ua, -inner / 2.5), at(a, inner, ta, ua, inner / 2.5), at(b, inner, tb, ub, inner / 2.5), at(b, -inner, tb, ub, -inner / 2.5));
        pushSpan(list, at(a, -hw, ba, ua, -hw / 2.5), at(a, hw, ba, ua, hw / 2.5), at(b, hw, bb, ub, hw / 2.5), at(b, -hw, bb, ub, -hw / 2.5));
    }
    for (const end of [-bridge.half, bridge.half]) {
        const t = top(end);
        for (const side of [-1, 1]) {
            pushSpan(list, at(end, side * inner, t, 0, 0), at(end, side * inner, t + wall, 0, 0.38), at(end, side * hw, t + wall, 0.18, 0.38), at(end, side * hw, t, 0.18, 0));
        }
    }
}

function appendBridges() {
    const world = window.World;
    if (!world || !world.bridgeList) return;
    const x = pilot ? pilot.x : look.x;
    const z = pilot ? pilot.z : look.z;
    const list = [];
    const bridges = world.bridgeList();
    for (let i = 0; i < bridges.length; i++) {
        if (Math.hypot(bridges[i].x - x, bridges[i].z - z) > 520) continue;
        addBridgeSpan(list, bridges[i]);
    }
    if (!list.length) return;
    terrain.add(new THREE.Mesh(landGeometry(new Float32Array(list), 6), landMaterial(landTex.gravel, false)));
}

async function placeManors() {
    if (BOARD_URL) await loadBoard();
    const meta = await fetch("../models/kitbuild/" + MANOR + ".meta.json").then((res) => {
        if (!res.ok) throw new Error("manor description missing");
        return res.json();
    });
    const parts = [];
    for (let i = 0; i < SHELL.length; i++) {
        const matName = SHELL[i][0];
        const found = (meta.materials || []).some((item) => item.mat === matName);
        if (!found) continue;
        const [buf, tex] = await Promise.all([
            fetch("../models/kitbuild/" + MANOR + "-" + matName + ".bin").then((res) => {
                if (!res.ok) throw new Error("missing " + matName);
                return res.arrayBuffer();
            }),
            loadTexture(SHELL[i][1])
        ]);
        const geom = kitGeometry(new Float32Array(buf), meta.cx, meta.cz);
        const mat = new THREE.MeshStandardMaterial({
            map: tex,
            vertexColors: true,
            roughness: 0.86,
            side: THREE.DoubleSide
        });
        parts.push({ geom: geom, mat: mat });
    }
    const houses = [];
    const homes = board ? dryHomes() : teams.map((team) => ({ x: team.px, z: team.pz }));
    const manorMap = mapGraphic("manor");
    const pad = manorPad();
    homes.forEach((team, index) => {
        const group = new THREE.Group();
        const y = heightAt(team.x, team.z);
        group.position.set(team.x, y, team.z);
        group.name = index === 0 ? "you" : "other";
        const shell = new THREE.Group();
        parts.forEach((part) => shell.add(new THREE.Mesh(part.geom, part.mat)));
        group.add(shell);
        scene.add(group);
        manors.push(group);
        const hx = pad.hx;
        const hz = pad.hz;
        fitMapModel(shell, hx, hz);
        const home = { x: team.x, z: team.z, y: y, group: group, player: index === 0, hx: hx, hz: hz, kitId: MANOR, fpModel: shell };
        shell.visible = !manorMap;
        houses.push(home);
        if (manorMap) {
            attachMapModel(group, manorMap, hx, hz, home).catch(() => {
                shell.visible = true;
                seatFloors();
            });
        }
        attachRooms(home, MANOR);
    });
    const playerHome = houses[0];
    look.set(playerHome.x + 2, playerHome.y, playerHome.z + 14);
    dist = 110;
    await startMatch(playerHome, houses[1] || null);
    if (board) {
        look.set(playerHome.x + 2, playerHome.y, playerHome.z + 14);
        dist = 110;
    }
    note.textContent = playTest
        ? "Play test. This is not the saved match. Choose Team A or Team B in the menu, then a building or a person, and click the ground. Right-click stops. Become player to walk up to them."
        : (board ? "The two manors are on flat ground, and this match starts new. Buildings stay off the grey rock and off the trees. Units can cross that rock and walk through trees, and they stop at the snow. " : "") + "Both manors keep adding houses, workers, and stores. You can still give orders. The two sides are at peace. Trees are wood, the shore is food, a farm is food, ore is gold, and the rock piles are stone.";
    return playerHome;
}

placeManors().catch((err) => {
    note.textContent = "The manor did not load. " + err.message;
});

const COST = 50;
let sheetCache = null;
function sheetTables() {
    if (sheetCache) return sheetCache;
    const api = window.AoeSheet;
    sheetCache = {
        units: api && api.read ? api.read() : null,
        buildings: api && api.buildings ? api.buildings() : null,
        player: api && api.player ? api.player() : null,
        factions: api && api.factions ? api.factions() : null,
        creatures: api && api.creatures ? api.creatures() : null
    };
    return sheetCache;
}
function dropSheetCache() {
    sheetCache = null;
}
function unitRow(kind) {
    const base = {
        hp: kind === "soldier" ? 40 : 20,
        attack: HIT,
        defence: 0,
        move: SPEED,
        cost: COST,
        w: kind === "soldier" ? 1.1 : 0.62,
        d: kind === "soldier" ? 0.63 : 0.4
    };
    const sheet = sheetTables().units;
    return (sheet && sheet[kind]) || base;
}
function unitCost(kind) {
    return unitRow(kind).cost;
}
function unitUse(kind) {
    const row = unitRow(kind);
    if (row && row.use === "military") return "military";
    if (row && row.use === "economical") return "economical";
    if (kind === "soldier") return "military";
    if (kind === "worker") return "economical";
    return "";
}
function militaryKind(kind) {
    if (kind === "soldier") return true;
    if (kind === "worker") return false;
    return unitUse(kind) === "military";
}
function workerKind(kind) {
    if (kind === "worker") return true;
    if (kind === "soldier") return false;
    return unitUse(kind) === "economical";
}
function playerRow() {
    const row = sheetTables().player;
    return row || { hp: 40, attack: 12, shot: 8, defence: 0, move: SPEED * 2, w: 1.1, d: 0.63, jump: 6.4 };
}
function jumpPower() {
    const n = Number(playerRow().jump);
    return Number.isFinite(n) ? Math.min(40, Math.max(0, n)) : 6.4;
}
function tuned(kind) {
    const spec = BUILDINGS[kind];
    if (!spec) return null;
    const next = Object.assign({ time: HOUSE_TIME }, spec);
    const buildings = sheetTables().buildings;
    const row = buildings ? buildings[kind] : null;
    if (!row) return next;
    next.wood = row.wood;
    next.hx = row.hx;
    next.hz = row.hz;
    if (row.time > 0) next.time = row.time;
    return next;
}
function manorPad() {
    const buildings = sheetTables().buildings;
    const row = buildings ? buildings.manor : null;
    return {
        hx: row ? row.hx : MANOR_HX,
        hz: row ? row.hz : MANOR_HZ
    };
}
function mapGraphic(kind) {
    const buildings = sheetTables().buildings;
    const row = buildings ? buildings[kind] : null;
    const map = row && row.map;
    return typeof map === "string" && /\.fbx$/i.test(map) ? map : "";
}
const mapLoads = {};
function houseLoader() {
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
        if (/House_texture_atlas\.png/i.test(url)) return "../models/houses/House_texture_atlas.png?v=atlas1";
        return url;
    });
    return new FBXLoader(manager);
}
function loadMapModel(url) {
    if (!mapLoads[url]) {
        mapLoads[url] = new Promise((resolve, reject) => {
            houseLoader().load(encodeURI(url), resolve, undefined, reject);
        });
    }
    return mapLoads[url];
}
function fitMapModel(object, hx, hz) {
    object.matrixAutoUpdate = true;
    object.position.set(0, 0, 0);
    object.scale.set(1, 1, 1);
    object.updateMatrix();
    const parent = object.parent;
    if (parent) parent.updateWorldMatrix(true, false);
    object.updateMatrixWorld(true);
    const origin = parent ? parent.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
    const box = new THREE.Box3().setFromObject(object);
    const wide = Math.max(0.01, box.max.x - box.min.x);
    const deep = Math.max(0.01, box.max.z - box.min.z);
    const sx = (hx * 2) / wide;
    const sz = (hz * 2) / deep;
    object.scale.set(sx, Math.min(sx, sz), sz);
    object.updateMatrix();
    object.updateMatrixWorld(true);
    let fitted = new THREE.Box3().setFromObject(object);
    const wantW = Math.max(0.01, hx * 2);
    const gotW = Math.max(0.01, fitted.max.x - fitted.min.x);
    if (gotW > wantW * 1.35 || gotW < wantW * 0.65) {
        object.scale.multiplyScalar(wantW / gotW);
        object.updateMatrix();
        object.updateMatrixWorld(true);
        fitted = new THREE.Box3().setFromObject(object);
    }
    object.position.set(
        origin.x - (fitted.min.x + fitted.max.x) / 2,
        origin.y - fitted.min.y,
        origin.z - (fitted.min.z + fitted.max.z) / 2
    );
    object.updateMatrix();
}
function addKitShell(group, parts, entry) {
    const shell = new THREE.Group();
    for (let i = 0; i < parts.length; i++) {
        const mesh = new THREE.Mesh(parts[i].geom, parts[i].mat);
        if (entry) mesh.userData.building = entry;
        shell.add(mesh);
    }
    group.add(shell);
    return shell;
}
function attachMapModel(group, url, hx, hz, entry) {
    return loadMapModel(url).then((src) => {
        if (!group.parent) return;
        const model = src.clone(true);
        group.add(model);
        fitMapModel(model, hx, hz);
        model.traverse((mesh) => {
            if (!mesh.isMesh) return;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if (entry) mesh.userData.building = entry;
        });
        model.visible = !pilot;
        if (entry) {
            entry.mapModel = model;
            if (entry.fpModel) entry.fpModel.visible = !!pilot;
        }
        seatFloors();
    });
}
const CARRY_MAX = 10;
const CARRY_TIME = 60;
const POP_MAX = 30;
const SPEED = 3.4;
const SIGHT = 100;
const LEASH = 200;
const REACH = 1.4;
const STAND = 1.15;
const BODY = 0.74;
const SLOTS = 4;
const SWING = 0.8;
const HIT = 8;
const HOUSE_TIME = 300;
const TRAIN_TIME = 60;
const trains = [];
let dayMin = 8 * 60;
const DAY_MINUTES = 24 * 60;
const HOUSE_BEDS = 20;
const TOWN_RANGE = 140;
const BUILDINGS = {
    house: { id: "small-house1", label: "Small house", wood: 20, hx: 3.28, hz: 4.29, workers: 5, soldiers: 0, town: true },
    barracks: { id: "barracks", label: "Barracks", wood: 100, hx: 14.26, hz: 9.09, workers: 0, soldiers: 15 },
    farm: { id: "farm", label: "Farm", wood: 100, hx: 8.81, hz: 18.43, workers: 0, soldiers: 0 },
    salt: { id: "salt-works-ex", label: "Salt works", wood: 100, hx: 11.06, hz: 14.33, workers: 0, soldiers: 0 },
    store: { id: "storehouse", label: "Storehouse", wood: 100, hx: 8.06, hz: 8.11, workers: 0, soldiers: 0 },
    smith: { id: "blacksmith", label: "Blacksmith", wood: 100, hx: 5, hz: 5, workers: 0, soldiers: 0, mesh: true }
};
const FARM_SLOTS = [
    { x: -5, z: 2 },
    { x: 0, z: 2 },
    { x: 5, z: 2 },
    { x: -2.5, z: 8 },
    { x: 2.5, z: 8 }
];
const FARM_DROP = { x: -0.25, z: -5.5 };
const MANOR_HX = 16.19;
const MANOR_HZ = 11.27;
const nodes = [];
natureData.forEach((item) => {
    if (item.type === "forest") nodes.push({ kind: "wood", x: item.px, z: item.pz, r: 3 * (item.s || 1) });
    if (item.type === "tree") nodes.push({ kind: "wood", x: item.px, z: item.pz, r: 3 });
    if (item.type === "water") nodes.push({ kind: "food", x: item.px, z: item.pz, r: 1.6 * (item.s || 1) });
    if (item.type === "ore") nodes.push({ kind: "gold", x: item.px, z: item.pz, r: 2.5 });
    if (item.type === "cylinder") nodes.push({ kind: "stone", x: item.px, z: item.pz, r: 6 });
});

let food = 200;
let wood = 0;
let gold = 0;
let iron = 0;
let salt = 0;
let stone = 0;
let fabric = 0;
let cpuFood = 200;
let cpuWood = 0;
let cpuGold = 0;
let cpuIron = 0;
let cpuSalt = 0;
let cpuStone = 0;
let cpuFabric = 0;
let home = null;
let cpuHome = null;
let led = "you";
let actors = null;
const kits = {};
let placing = null;
const built = [];
const sites = [];
const units = [];
const haulers = [];
const DEPOTS = { salt: true };
const HAUL_MINUTES = 360;
const HORSE_COST = 50;
const HORSE_TIME = 60;
const HORSE_HP = 30;
const GOODS = ["food", "wood", "gold", "stone", "iron", "salt", "fabric"];
let horseGltf = null;
let haulMark = -1;
let haulSave = null;
let nextId = 1;
let selected = [];
let manorSelected = false;
let selectedHouse = null;
const raycaster = new THREE.Raycaster();
const foodEl = document.getElementById("food");
const cpuFoodEl = document.getElementById("cpu-food");
const cpuWoodEl = document.getElementById("cpu-wood");
const cpuGoldEl = document.getElementById("cpu-gold");
const ironEl = document.getElementById("iron");
const saltEl = document.getElementById("salt");
const stoneEl = document.getElementById("stone");
const fabricEl = document.getElementById("fabric");
const cpuIronEl = document.getElementById("cpu-iron");
const cpuSaltEl = document.getElementById("cpu-salt");
const cpuStoneEl = document.getElementById("cpu-stone");
const cpuFabricEl = document.getElementById("cpu-fabric");
const woodEl = document.getElementById("wood");
const goldEl = document.getElementById("gold");
const popEl = document.getElementById("pop");
const soldierEl = document.getElementById("soldiers");
const cpuPopEl = document.getElementById("cpu-pop");
const cpuSoldierEl = document.getElementById("cpu-soldiers");
const trainNote = document.getElementById("train-note");
const selEl = document.getElementById("sel");
const workerBtn = document.getElementById("make-worker");
const soldierBtn = document.getElementById("make-soldier");
const buildBtns = {
    house: document.getElementById("make-house"),
    barracks: document.getElementById("make-barracks"),
    farm: document.getElementById("make-farm"),
    salt: document.getElementById("make-salt"),
    store: document.getElementById("make-store")
};
const guardBtn = document.getElementById("stance-guard");
const attackBtn = document.getElementById("stance-attack");
const horseBtn = document.getElementById("make-horse");
const boxEl = document.getElementById("box");
const MAP_FIGURE = 2.5;
const ringGeom = new THREE.RingGeometry(0.42, 0.62, 18);
ringGeom.rotateX(-Math.PI / 2);
const ringMat = new THREE.MeshBasicMaterial({ color: 0xf4e2a0, side: THREE.DoubleSide, depthTest: false });
const pickMat = new THREE.MeshBasicMaterial({ color: 0xfff6c2, side: THREE.DoubleSide, depthTest: false });
const foeMat = new THREE.MeshBasicMaterial({ color: 0x8a3030, side: THREE.DoubleSide, depthTest: false });
const selfMat = new THREE.MeshBasicMaterial({ color: 0x7eb6e0, side: THREE.DoubleSide, depthTest: false });
const padGeom = new THREE.BoxGeometry(BUILDINGS.house.hx * 2, 0.18, BUILDINGS.house.hz * 2);
const padMat = new THREE.MeshStandardMaterial({ color: 0x8d6b3a, roughness: 1 });
const ghost = new THREE.Mesh(padGeom, new THREE.MeshBasicMaterial({ color: 0x6dbf4a, transparent: true, opacity: 0.45, depthWrite: false }));
ghost.visible = false;
scene.add(ghost);
const townRing = new THREE.Mesh(
    new THREE.RingGeometry(TOWN_RANGE - 1.6, TOWN_RANGE, 72),
    new THREE.MeshBasicMaterial({ color: 0xf4e2a0, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
);
townRing.rotation.x = -Math.PI / 2;
townRing.visible = false;
scene.add(townRing);
let rally = null;
const rallyFlag = new THREE.Group();
const rallyPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 5, 6),
    new THREE.MeshStandardMaterial({ color: 0xf4e2a0, roughness: 0.7 })
);
rallyPole.position.y = 2.5;
const rallyCloth = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 1.2),
    new THREE.MeshStandardMaterial({ color: 0xc4513a, side: THREE.DoubleSide, roughness: 0.8 })
);
rallyCloth.position.set(1.1, 4.3, 0);
rallyFlag.add(rallyPole);
rallyFlag.add(rallyCloth);
rallyFlag.visible = false;
scene.add(rallyFlag);

function sideKind(side, kind) {
    let n = 0;
    for (let i = 0; i < units.length; i++) {
        if (units[i].side === side && units[i].kind === kind) n++;
    }
    return n;
}

function kindQueued(side, kind) {
    let n = 0;
    for (let i = 0; i < trains.length; i++) {
        if (trains[i].side === side && trains[i].kind === kind) n++;
    }
    return n;
}

function roleCount(side, military) {
    let n = 0;
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (unit.side !== side) continue;
        if (military ? militaryKind(unit.kind) : workerKind(unit.kind)) n++;
    }
    return n;
}

function roleQueued(side, military) {
    let n = 0;
    for (let i = 0; i < trains.length; i++) {
        if (trains[i].side !== side) continue;
        if (military ? militaryKind(trains[i].kind) : workerKind(trains[i].kind)) n++;
    }
    return n;
}

function roomFor(side, kind) {
    const military = militaryKind(kind);
    let cap = military ? 0 : POP_MAX;
    for (let i = 0; i < built.length; i++) {
        if ((built[i].side || "you") !== side) continue;
        const spec = BUILDINGS[built[i].kind];
        if (!spec) continue;
        cap += military ? (spec.soldiers || 0) : (spec.workers || 0);
    }
    return cap;
}

function housed(side, kind) {
    const military = militaryKind(kind);
    return roleCount(side, military) + roleQueued(side, military) < roomFor(side, kind);
}

function fielded(side, kind) {
    return roleCount(side, militaryKind(kind)) < roomFor(side, kind);
}

function showButton(button, visible) {
    if (button) button.hidden = !visible;
}

const trainBtns = {};

function trainButton(kind) {
    if (kind === "worker") return workerBtn;
    if (kind === "soldier") return soldierBtn;
    if (trainBtns[kind]) return trainBtns[kind];
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.train = kind;
    const name = document.createElement("b");
    const price = document.createElement("small");
    button.append(name, price);
    button.addEventListener("click", () => playTest ? beginPlaceUnit(kind) : train(kind));
    const box = document.getElementById("cmd-people");
    if (box) box.append(button);
    trainBtns[kind] = button;
    return button;
}

function paintTrain(kind, making, trainSide) {
    const button = trainButton(kind);
    const on = making.indexOf(kind) >= 0;
    showButton(button, !pilot && !placing && on);
    const name = button.querySelector("b");
    if (name) name.textContent = unitRow(kind).name || kind;
    const price = button.querySelector("small");
    if (price) price.textContent = billText(unitBill(kind));
    button.disabled = !(on && canPay(trainSide, unitBill(kind)) && housed(trainSide, kind));
}

function paintCommands() {
    const yourWorkers = selected.some((unit) => unit.side === led && workerKind(unit.kind));
    const depot = selectedHouse && DEPOTS[selectedHouse.kind] ? selectedHouse : null;
    const making = manorSelected ? madeBy("manor") : (selectedHouse ? madeBy(selectedHouse.kind) : []);
    const trainSide = manorSelected ? led : (selectedHouse ? (selectedHouse.side || "you") : led);
    const shown = {};
    for (let i = 0; i < making.length; i++) {
        paintTrain(making[i], making, trainSide);
        shown[making[i]] = true;
    }
    if (!shown.worker) showButton(workerBtn, false);
    if (!shown.soldier) showButton(soldierBtn, false);
    Object.keys(trainBtns).forEach((kind) => {
        if (!shown[kind]) showButton(trainBtns[kind], false);
    });
    showButton(horseBtn, !pilot && !placing && !!depot);
    if (horseBtn) {
        const lost = depot && depot.lostHorse && !(depot.horse && depot.horse.alive) && !(depot.horseLeft > 0);
        const horsePrice = horseBtn.querySelector("small");
        if (horsePrice) horsePrice.textContent = billText(horseBill());
        horseBtn.disabled = !lost || !canPay((depot && depot.side) || "you", horseBill());
    }
    const showBuild = !pilot && (yourWorkers || !!placing);
    Object.keys(buildBtns).forEach((key) => {
        const spec = tuned(key);
        const buildings = sheetTables().buildings;
        const row = buildings ? buildings[key] : null;
        const title = buildBtns[key].querySelector("b");
        if (title && row && row.name) title.textContent = row.name;
        const price = buildBtns[key].querySelector("small");
        if (price && spec) price.textContent = billText(buildingBill(key));
        buildBtns[key].hidden = !showBuild;
        buildBtns[key].disabled = !showBuild || !!placing || !kits[key] || !spec || !canPay(led, buildingBill(key));
    });
    const soldierPick = selected.filter((unit) => (unit.side === "you" || unit.side === "cpu") && militaryKind(unit.kind));
    showButton(guardBtn, !pilot && !placing && soldierPick.length > 0);
    showButton(attackBtn, !pilot && !placing && soldierPick.length > 0);
    guardBtn.disabled = !soldierPick.length;
    attackBtn.disabled = !soldierPick.length;
    const people = document.getElementById("cmd-people");
    const build = document.getElementById("cmd-build");
    const stance = document.getElementById("cmd-stance");
    const pane = document.getElementById("pane-commands");
    const title = document.getElementById("cmd-title");
    const open = (root) => !!(root && root.querySelector("button:not([hidden])"));
    if (people) people.hidden = !open(people);
    if (build) build.hidden = !open(build);
    if (stance) stance.hidden = !open(stance);
    if (pane) pane.hidden = !(people && !people.hidden) && !(build && !build.hidden) && !(stance && !stance.hidden);
    if (title) title.textContent = people && !people.hidden ? "Train" : build && !build.hidden ? "Build" : "Orders";
    if (playTest && !pilot) {
        ensureTestUnits();
        showButton(workerBtn, true);
        showButton(soldierBtn, true);
        workerBtn.disabled = false;
        soldierBtn.disabled = false;
        const workerPrice = workerBtn.querySelector("small");
        if (workerPrice) workerPrice.textContent = "free";
        const soldierPrice = soldierBtn.querySelector("small");
        if (soldierPrice) soldierPrice.textContent = "free";
        Object.keys(buildBtns).forEach((key) => {
            buildBtns[key].hidden = false;
            const price = buildBtns[key].querySelector("small");
            if (price) price.textContent = "free";
            buildBtns[key].disabled = !kits[key];
        });
        Object.keys(trainBtns).forEach((kind) => showButton(trainBtns[kind], false));
        if (people) people.hidden = false;
        if (build) build.hidden = false;
        if (pane) pane.hidden = false;
        if (title) title.textContent = "Place";
    }
}

function ensureTestUnits() {
    if (!playTest || ensureTestUnits.done) return;
    const sheet = sheetTables().units;
    if (!sheet) return;
    ensureTestUnits.done = true;
    const box = document.getElementById("cmd-people");
    Object.keys(sheet).forEach((id) => {
        if (id === "worker" || id === "soldier") return;
        const row = sheet[id];
        if (!row || (row.use !== "military" && row.use !== "economical")) return;
        const button = document.createElement("button");
        button.type = "button";
        const name = document.createElement("b");
        name.textContent = row.name || id;
        button.append(name);
        button.addEventListener("click", () => beginPlaceUnit(id));
        box.append(button);
    });
}

function stockBag(side) {
    if (side === "cpu") return { food: cpuFood, wood: cpuWood, gold: cpuGold, iron: cpuIron, salt: cpuSalt, stone: cpuStone, fabric: cpuFabric };
    return { food: food, wood: wood, gold: gold, iron: iron, salt: salt, stone: stone, fabric: fabric };
}

function writeBag(side, bag) {
    if (side === "cpu") {
        cpuFood = bag.food;
        cpuWood = bag.wood;
        cpuGold = bag.gold;
        cpuIron = bag.iron;
        cpuSalt = bag.salt;
        cpuStone = bag.stone;
        cpuFabric = bag.fabric;
        return;
    }
    food = bag.food;
    wood = bag.wood;
    gold = bag.gold;
    iron = bag.iron;
    salt = bag.salt;
    stone = bag.stone;
    fabric = bag.fabric;
}

const PAY = ["food", "wood", "gold", "stone", "iron", "salt", "fabric"];

function factionRow(side) {
    const rows = sheetTables().factions;
    if (!rows) return null;
    for (let i = 0; i < rows.length; i++) if (rows[i].id === side) return rows[i];
    return null;
}

function teamName(side) {
    const row = factionRow(side === "cpu" ? "cpu" : "you");
    if (row && row.name) return row.name;
    return side === "cpu" ? "Team B" : "Team A";
}

function withExtra(bill, costs) {
    if (!costs) return bill;
    Object.keys(costs).forEach((key) => {
        const n = Number(costs[key]);
        if (n > 0) bill[key] = (bill[key] || 0) + n;
    });
    return bill;
}

function canPay(side, bill) {
    if (playTest) return true;
    const bag = stockBag(side);
    for (let i = 0; i < PAY.length; i++) {
        const key = PAY[i];
        if ((bill[key] || 0) > (bag[key] || 0)) return false;
    }
    return true;
}

function spend(side, bill) {
    if (playTest) return;
    const bag = stockBag(side);
    for (let i = 0; i < PAY.length; i++) {
        const key = PAY[i];
        if ((bill[key] || 0) > 0) bag[key] = Math.max(0, (bag[key] || 0) - bill[key]);
    }
    writeBag(side, bag);
}

function billText(bill) {
    const parts = [];
    for (let i = 0; i < PAY.length; i++) {
        if ((bill[PAY[i]] || 0) > 0) parts.push(bill[PAY[i]] + " " + PAY[i]);
    }
    return parts.join(", ") || "0";
}

function unitBill(kind) {
    const row = unitRow(kind);
    return withExtra({ food: Math.max(0, Number(row.cost) || 0) }, row.costs);
}

function buildingBill(kind) {
    const spec = tuned(kind);
    const buildings = sheetTables().buildings;
    const row = buildings ? buildings[kind] : null;
    return withExtra({ wood: spec ? Math.max(0, Number(spec.wood) || 0) : 0 }, row && row.costs);
}

function horseRow() {
    const creatures = sheetTables().creatures;
    return creatures ? creatures.horse : null;
}

function horseBill() {
    const row = horseRow();
    const foodCost = row && Number.isFinite(Number(row.cost)) ? Number(row.cost) : HORSE_COST;
    return withExtra({ food: Math.max(0, foodCost) }, row && row.costs);
}

function madeBy(buildingId) {
    const rows = sheetTables().buildings;
    const row = rows && rows[buildingId];
    let list = row && Array.isArray(row.makesList) && row.makesList.length ? row.makesList : null;
    if (!list) {
        if (buildingId === "manor") list = ["worker"];
        else if (buildingId === "barracks") list = ["soldier"];
        else list = [];
    }
    const known = sheetTables().units;
    const out = [];
    for (let i = 0; i < list.length; i++) {
        const id = list[i];
        if (!id || out.indexOf(id) >= 0) continue;
        if (id !== "worker" && id !== "soldier") {
            const spec = known && known[id];
            if (!spec || (spec.use !== "military" && spec.use !== "economical")) continue;
        }
        out.push(id);
    }
    return out;
}

function refreshHud() {
    const bag = stockBag(led);
    const youTitle = document.getElementById("you-title");
    if (youTitle) youTitle.textContent = teamName(led);
    document.querySelectorAll("#menu-list [data-menu]").forEach((button) => {
        button.classList.toggle("led", button.dataset.menu === led);
    });
    if (document.activeElement !== foodEl) foodEl.value = String(Math.floor(bag.food));
    if (document.activeElement !== woodEl) woodEl.value = String(Math.floor(bag.wood));
    if (document.activeElement !== goldEl) goldEl.value = String(Math.floor(bag.gold));
    if (ironEl && document.activeElement !== ironEl) ironEl.value = String(Math.floor(bag.iron));
    if (saltEl && document.activeElement !== saltEl) saltEl.value = String(Math.floor(bag.salt));
    if (stoneEl && document.activeElement !== stoneEl) stoneEl.value = String(Math.floor(bag.stone));
    if (fabricEl && document.activeElement !== fabricEl) fabricEl.value = String(Math.floor(bag.fabric));
    if (cpuFoodEl && document.activeElement !== cpuFoodEl) cpuFoodEl.value = String(Math.floor(cpuFood));
    if (cpuWoodEl && document.activeElement !== cpuWoodEl) cpuWoodEl.value = String(Math.floor(cpuWood));
    if (cpuGoldEl && document.activeElement !== cpuGoldEl) cpuGoldEl.value = String(Math.floor(cpuGold));
    if (cpuIronEl && document.activeElement !== cpuIronEl) cpuIronEl.value = String(Math.floor(cpuIron));
    if (cpuSaltEl && document.activeElement !== cpuSaltEl) cpuSaltEl.value = String(Math.floor(cpuSalt));
    if (cpuStoneEl && document.activeElement !== cpuStoneEl) cpuStoneEl.value = String(Math.floor(cpuStone));
    if (cpuFabricEl && document.activeElement !== cpuFabricEl) cpuFabricEl.value = String(Math.floor(cpuFabric));
    popEl.textContent = "Workers " + roleCount(led, false) + " / " + roomFor(led, "worker");
    if (soldierEl) soldierEl.textContent = "Soldiers " + roleCount(led, true) + " / " + roomFor(led, "soldier");
    if (cpuPopEl) cpuPopEl.textContent = "Other workers " + roleCount("cpu", false) + " / " + roomFor("cpu", "worker");
    if (cpuSoldierEl) cpuSoldierEl.textContent = "Other soldiers " + roleCount("cpu", true) + " / " + roomFor("cpu", "soldier");
    if (trainNote) {
        const mine = trains.filter((job) => job.side === led);
        if (!mine.length) trainNote.textContent = "";
        else {
            const secs = Math.max(0, Math.ceil(mine[0].left));
            const clock = Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0");
            const who = unitRow(mine[0].kind).name || mine[0].kind;
            trainNote.textContent = "Recruiting " + who + " · " + clock + (mine.length > 1 ? " · " + mine.length + " in line" : "");
        }
    }
    paintCommands();
    if (pilot) {
        selEl.textContent = document.body.classList.contains("handheld")
            ? "Drag the view to look. The pad walks. Shoot looses the bow. Open the menu, then Pack, and choose Campaign."
            : "You. WASD walks, mouse looks. T is first person. Left-click draws the bow and looses an arrow. Open the menu, then Pack, for the sword.";
        return;
    }
    if (placing) {
        selEl.textContent = "Click the ground for the " + BUILDINGS[placing].label.toLowerCase() + ". Right-click cancels.";
        return;
    }
    if (selected.length) {
        if (selected.length === 1 && selected[0].side === "self") {
            selEl.textContent = "You. Right-click the ground to put yourself there.";
            return;
        }
        let workers = 0;
        let soldiers = 0;
        let soldierHp = null;
        let workerHp = null;
        for (let i = 0; i < selected.length; i++) {
            const unit = selected[i];
            if (unit.side === "self") continue;
            if (militaryKind(unit.kind)) {
                soldiers += 1;
                soldierHp = soldierHp == null ? unit.hp : Math.min(soldierHp, unit.hp);
            } else {
                workers += 1;
                workerHp = workerHp == null ? unit.hp : Math.min(workerHp, unit.hp);
            }
        }
        const lines = [];
        const lead = selected.find((unit) => unit.side === "you" || unit.side === "cpu");
        if (lead && lead.side !== led) lines.push(teamName(lead.side));
        if (selected.length === 1 && lead) {
            lines.push(unitRow(lead.kind).name || lead.kind);
            lines.push("health " + Math.max(0, Math.ceil(lead.hp)));
        } else {
            if (workers) lines.push(workers + (workers === 1 ? " worker" : " workers"));
            if (soldiers) lines.push(soldiers + (soldiers === 1 ? " soldier" : " soldiers"));
            if (soldiers) lines.push("soldier\nhealth " + Math.max(0, Math.ceil(soldierHp)));
            else lines.push("health " + Math.max(0, Math.ceil(workerHp)));
        }
        const carried = carrySummary(selected);
        if (carried) lines.push(carried);
        selEl.textContent = lines.join("\n");
    } else if (selectedHouse || manorSelected) {
        const house = selectedHouse;
        const label = manorSelected ? "Manor" : (BUILDINGS[house.kind] ? BUILDINGS[house.kind].label : house.kind);
        const lines = ["Building", label];
        const side = manorSelected ? led : (house.side || "you");
        if (side !== led) lines.push(teamName(side));
        const from = manorSelected ? "manor" : (house && house.kind);
        const linesOf = from ? madeBy(from) : [];
        const training = [];
        for (let i = 0; i < linesOf.length; i++) {
            const n = kindQueued(side, linesOf[i]);
            if (n) training.push(n + " " + (unitRow(linesOf[i]).name || linesOf[i]));
        }
        if (training.length) lines.push("training " + training.join(", "));
        if (house && DEPOTS[house.kind]) {
            lines.push(holdLine(house.hold));
            lines.push(horseLine(house));
        }
        const inside = houseMates(manorSelected ? sideBase(led) : house);
        if (inside) lines.push(inside + " garrisoned inside");
        selEl.textContent = lines.join("\n");
    } else {
        selEl.textContent = "Select a building or units.";
    }
}

function showRing(unit) {
    const picked = selected.indexOf(unit) >= 0;
    unit.ring.visible = picked || unit.side === "cpu" || unit.side === "self";
    const base = unit.ringScale || 1;
    unit.ring.scale.setScalar(picked ? base * 1.65 : base);
    if (picked) unit.ring.material = pickMat;
    else unit.ring.material = unit.side === "cpu" ? foeMat : unit.side === "self" ? selfMat : ringMat;
}

function setSelected(list) {
    selected = list;
    manorSelected = false;
    selectedHouse = null;
    for (let i = 0; i < units.length; i++) showRing(units[i]);
    refreshHud();
}

function bodyFor(kind) {
    if (actors[kind]) return actors[kind];
    const row = unitRow(kind);
    if (row && row.use === "military" && actors.soldier) return actors.soldier;
    if (row && row.use === "economical" && actors.worker) return actors.worker;
    return null;
}

const roster = {};
const rosterQueue = [];
let rosterBusy = false;
let rosterOpen = false;

function rosterFile(model) {
    const raw = String(model || "").trim();
    if (/\.(glb|gltf)$/i.test(raw)) return raw;
    return "";
}

function wantRoster(file) {
    if (!file || roster[file]) return;
    roster[file] = { pending: true };
    rosterQueue.push(file);
    if (rosterOpen) pumpRoster();
}

function queueRoster() {
    rosterOpen = true;
    for (let i = 0; i < units.length; i++) wantRoster(units[i].pendingModel);
    for (let i = 0; i < trains.length; i++) wantRoster(rosterFile(unitRow(trains[i].kind).model));
    pumpRoster();
}

function pumpRoster() {
    if (rosterBusy || !rosterQueue.length) return;
    rosterBusy = true;
    const file = rosterQueue.shift();
    setTimeout(() => beginRosterLoad(file), 800);
}

function beginRosterLoad(file) {
    let settled = false;
    const finish = (gltf) => {
        if (settled) return;
        settled = true;
        roster[file] = gltf ? { gltf: gltf } : { failed: true };
        if (roster[file].gltf) dressWaiting(file);
        rosterBusy = false;
        pumpRoster();
    };
    const timer = setTimeout(() => finish(null), 12000);
    new GLTFLoader().load(encodeURI(file), (gltf) => {
        clearTimeout(timer);
        finish(gltf);
    }, undefined, () => {
        clearTimeout(timer);
        finish(null);
    });
}

function dressWaiting(file) {
    const packed = roster[file];
    if (!packed || !packed.gltf) return;
    const waiting = [];
    for (let i = 0; i < units.length; i++) {
        if (units[i].side !== "self" && units[i].pendingModel === file) waiting.push(units[i]);
    }
    const step = () => {
        const unit = waiting.shift();
        if (!unit) return;
        if (unit.pendingModel === file) {
            try {
                attachFigure(unit, packed);
            } catch (err) {
                unit.pendingModel = "";
            }
        }
        if (waiting.length) setTimeout(step, 0);
    };
    setTimeout(step, 0);
}

function clipNamed(clips, pattern) {
    const names = Object.keys(clips);
    for (let i = 0; i < names.length; i++) if (pattern.test(names[i])) return names[i];
    return "";
}

function figurePose(model, gltf) {
    const mixer = new THREE.AnimationMixer(model);
    const clips = {};
    const animations = gltf.animations || [];
    for (let i = 0; i < animations.length; i++) clips[animations[i].name] = mixer.clipAction(animations[i]);
    const walkClip = clipNamed(clips, /walk/i) || clipNamed(clips, /run/i) || "";
    const idleClip = clipNamed(clips, /idle/i) || walkClip || Object.keys(clips)[0] || "";
    return { mixer: mixer, clips: clips, walkClip: walkClip, idleClip: idleClip };
}

function boneSpan(model) {
    const point = new THREE.Vector3();
    let low = null;
    let high = null;
    model.traverse((obj) => {
        if (!obj.isBone) return;
        obj.getWorldPosition(point);
        if (!low || point.y < low.y) low = point.clone();
        if (!high || point.y > high.y) high = point.clone();
    });
    if (!low || !high) return null;
    return { low: low, high: high };
}

function ensureLook(unit) {
    if (unit.look) return unit.look;
    const look = new THREE.Group();
    unit.group.add(look);
    unit.look = look;
    return look;
}

function applyLook(unit) {
    if (!unit.look) return;
    unit.look.scale.setScalar(pilot ? 1 : MAP_FIGURE);
}

function applyAllLooks() {
    for (let i = 0; i < units.length; i++) applyLook(units[i]);
}

function plantFigure(model, group) {
    const yaw = group.rotation.y;
    group.rotation.y = 0;
    model.position.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    group.updateMatrixWorld(true);
    const rest = boneSpan(model);
    if (!rest) {
        group.rotation.y = yaw;
        return;
    }
    const s = 1.75 / Math.max(0.4, rest.high.y - rest.low.y);
    model.scale.setScalar(s);
    group.updateMatrixWorld(true);
    const stood = boneSpan(model);
    const origin = group.getWorldPosition(new THREE.Vector3());
    model.position.x += origin.x - (stood.low.x + stood.high.x) / 2;
    model.position.z += origin.z - (stood.low.z + stood.high.z) / 2;
    model.position.y += origin.y - stood.low.y;
    group.rotation.y = yaw;
    group.updateMatrixWorld(true);
}

function attachFigure(unit, packed) {
    const model = cloneSkinned(packed.gltf.scene);
    const posed = figurePose(model, packed.gltf);
    model.traverse((mesh) => {
        if (!mesh.isMesh) return;
        mesh.castShadow = false;
        mesh.frustumCulled = false;
        mesh.userData.pick = true;
        mesh.userData.unit = unit;
    });
    if (unit.body && unit.body.parent) unit.body.parent.remove(unit.body);
    const look = ensureLook(unit);
    look.scale.setScalar(1);
    look.add(model);
    model.userData.unit = unit;
    unit.body = model;
    unit.actor = null;
    unit.mixer = posed.mixer;
    unit.clips = posed.clips;
    unit.idleClip = posed.idleClip;
    unit.walkClip = posed.walkClip;
    unit.pose = "";
    unit.pendingModel = "";
    if (posed.idleClip) playArcher(unit, posed.idleClip, false);
    posed.mixer.update(0);
    plantFigure(model, unit.group);
    applyLook(unit);
}

function spawnFigure(kind, x, z, side, packed, row) {
    const ring = new THREE.Mesh(ringGeom, side === "cpu" ? foeMat : side === "self" ? selfMat : ringMat);
    ring.position.y = 0.06;
    ring.visible = side === "cpu" || side === "self";
    const group = new THREE.Group();
    group.add(ring);
    group.position.set(x, heightAt(x, z), z);
    scene.add(group);
    const unit = {
        id: nextId++,
        side: side,
        kind: kind,
        x: x,
        z: z,
        yaw: 0,
        state: "idle",
        job: null,
        jobNode: null,
        goal: null,
        carry: 0,
        anim: 0,
        hp: row.hp,
        speed: row.move,
        attack: row.attack,
        defence: row.defence,
        stance: "guard",
        post: militaryKind(kind) ? { x: x, z: z } : null,
        targetId: null,
        orders: false,
        body: null,
        ring: ring,
        ringScale: Math.max(row.w || 1, row.d || 0.6) / 1.24,
        foot: Math.max(row.w || 0.6, row.d || 0.4) / 2,
        group: group,
        actor: null,
        mixer: null,
        clips: null,
        idleClip: "",
        walkClip: "",
        pose: "",
        pendingModel: ""
    };
    ring.scale.setScalar(unit.ringScale);
    units.push(unit);
    attachFigure(unit, packed);
    applyLook(unit);
    return unit;
}

function spawn(kind, x, z, side) {
    const row = unitRow(kind);
    const file = rosterFile(row.model);
    const packed = file && roster[file];
    if (packed && packed.gltf) return spawnFigure(kind, x, z, side, packed, row);
    const actor = bodyFor(kind);
    if (!actor) return null;
    const body = personMesh(actor);
    body.userData.pick = true;
    const ring = new THREE.Mesh(ringGeom, side === "cpu" ? foeMat : side === "self" ? selfMat : ringMat);
    ring.position.y = 0.06;
    ring.visible = side === "cpu" || side === "self";
    const group = new THREE.Group();
    const look = new THREE.Group();
    group.add(look);
    look.add(body);
    group.add(ring);
    group.position.set(x, heightAt(x, z), z);
    scene.add(group);
    fitMapModel(body, row.w / 2, row.d / 2);
    const unit = {
        id: nextId++,
        side: side,
        kind: kind,
        x: x,
        z: z,
        yaw: 0,
        state: "idle",
        job: null,
        jobNode: null,
        goal: null,
        carry: 0,
        anim: 0,
        hp: unitRow(kind).hp,
        speed: unitRow(kind).move,
        attack: unitRow(kind).attack,
        defence: unitRow(kind).defence,
        stance: "guard",
        post: militaryKind(kind) ? { x: x, z: z } : null,
        targetId: null,
        orders: false,
        body: body,
        ring: ring,
        ringScale: Math.max(row.w, row.d) / 1.24,
        foot: Math.max(row.w || 0.6, row.d || 0.4) / 2,
        group: group,
        look: look,
        actor: actor
    };
    ring.scale.setScalar(unit.ringScale);
    body.userData.unit = unit;
    units.push(unit);
    applyLook(unit);
    if (file && (!packed || packed.pending)) {
        unit.pendingModel = file;
        if (rosterOpen) wantRoster(file);
    }
    return unit;
}

let archerGltf = null;
const armGltf = {};
const ARMS = {
    sword: { name: "Sword", hand: "right", attack: "slash", file: "weapons pack/3D_fantasy_weapons_pack/models/knights_longsword.glb", scale: 0.55, pos: [0.21, 0.02, 0], rot: [0, Math.PI, 0] },
    axe: { name: "Axe", hand: "right", attack: "slash", file: "weapons pack/3D_fantasy_weapons_pack/models/dwarven_war_axe.glb", scale: 0.5, pos: [0.22, 0.02, 0], rot: [0, 0, 0] },
    halberd: { name: "Halberd", hand: "right", attack: "slash", file: "weapons pack/3D_fantasy_weapons_pack/models/halberd.glb", scale: 0.85, pos: [0.18, 0, -0.12], rot: [0, 0, 0] },
    mace: { name: "Mace", hand: "right", attack: "slash", file: "weapons pack/3D_fantasy_weapons_pack/models/spiked_mace.glb", scale: 0.42, pos: [0.05, 0.12, 0], rot: [0, 0, -1.57] },
    bow: { name: "Bow", hand: "left", attack: "arrow", file: "../models/meshy/medieval-wooden-bow.glb", scale: 1, pos: [0, 0, 0], rot: [Math.PI / 2, Math.PI, 0] },
    crossbow: { name: "Crossbow", hand: "left", attack: "crossbow", file: "../tools/Meshy_AI_lowpoly_medieval_crossbow_20261102_texture_a0475ada/Meshy_AI_model.glb", scale: 0.5, pos: [0.12, 0, 0.04], rot: [0, 3.14, 1.57] }
};
const ARM_ORDER = ["sword", "axe", "halberd", "mace", "bow", "crossbow"];
const ATTACK_POSES = { Right_Hand_Sword_Slash: true, Archery_Shot_1: true, Draw_and_Shoot_from_Back: true };

function loadGltf(url) {
    return new Promise((resolve) => {
        new GLTFLoader().load(encodeURI(url), (gltf) => resolve(gltf), undefined, () => resolve(null));
    });
}

function addArmProp(unit, id) {
    const spec = ARMS[id];
    const source = armGltf[id];
    if (!spec || !source || !unit || !unit.props || unit.props[id]) return;
    const prop = source.scene.clone(true);
    prop.scale.setScalar(spec.scale);
    prop.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    prop.rotation.set(spec.rot[0], spec.rot[1], spec.rot[2]);
    prop.visible = id === arm;
    prop.traverse((mesh) => {
        if (!mesh.isMesh) return;
        mesh.castShadow = false;
        mesh.frustumCulled = false;
    });
    const hand = spec.hand === "left" ? unit.leftHand : unit.rightHand;
    if (hand) hand.add(prop);
    unit.props[id] = prop;
}

let walkerJob = null;
function ensureWalker() {
    if (walkerJob) return walkerJob;
    walkerJob = loadGltf("../models/meshy/harlequin-player.glb").then((gltf) => {
        return loadGltf("../models/meshy/harlequin-man-at-arms.glb").then((older) => {
            const keep = ["Idle_02", "Archery_Shot_1", "Draw_and_Shoot_from_Back"];
            if (older) {
                keep.forEach((name) => {
                    if (gltf.animations.some((clip) => clip.name === name)) return;
                    const clip = older.animations.find((item) => item.name === name);
                    if (clip) gltf.animations.push(clip);
                });
            }
            return loadGltf("../models/meshy/harlequin-steps.glb").then((steps) => {
                if (steps) {
                    steps.animations.forEach((clip) => {
                        if (gltf.animations.some((item) => item.name === clip.name)) return;
                        gltf.animations.push(clip);
                    });
                }
                archerGltf = gltf;
            });
        });
    }).then(() => loadGltf(ARMS.sword.file)).then((sword) => {
        if (sword) armGltf.sword = sword;
        for (let i = 0; i < units.length; i++) {
            if (units[i].side === "self") dressArcher(units[i]);
        }
        let chain = Promise.resolve();
        ARM_ORDER.forEach((id) => {
            if (id === "sword") return;
            chain = chain.then(() => new Promise((resolve) => setTimeout(resolve, 700))).then(() => loadGltf(ARMS[id].file)).then((prop) => {
                if (!prop) return;
                if (id === "bow") {
                    const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.72 });
                    prop.scene.traverse((obj) => {
                        if (!obj.isMesh) return;
                        if (obj.geometry && !obj.geometry.getAttribute("normal")) obj.geometry.computeVertexNormals();
                        obj.material = wood;
                    });
                }
                armGltf[id] = prop;
                for (let i = 0; i < units.length; i++) addArmProp(units[i], id);
            });
        });
        return chain;
    });
    return walkerJob;
}

function fitArcher(model, group, row) {
    model.position.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    model.updateMatrixWorld(true);
    let head = null;
    let foot = null;
    model.traverse((obj) => {
        if (obj.name === "mixamorigHead") head = obj;
        if (obj.name === "mixamorigLeftFoot") foot = obj;
    });
    if (!head || !foot) return 1.5;
    const headY = head.getWorldPosition(new THREE.Vector3()).y;
    const footY = foot.getWorldPosition(new THREE.Vector3()).y;
    const tall = 1.8 * ((row && row.w) || 1.1) / 1.1;
    model.scale.setScalar(tall / Math.max(0.4, headY - footY + 0.18));
    model.updateMatrixWorld(true);
    const origin = group.getWorldPosition(new THREE.Vector3());
    const sole = foot.getWorldPosition(new THREE.Vector3());
    const top = head.getWorldPosition(new THREE.Vector3());
    model.position.x += origin.x - (sole.x + top.x) / 2;
    model.position.z += origin.z - (sole.z + top.z) / 2;
    model.updateMatrixWorld(true);
    let lowest = sole.y;
    model.traverse((obj) => {
        if (!obj.isMesh || !obj.geometry) return;
        if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
        const point = obj.geometry.boundingBox.min.clone();
        obj.localToWorld(point);
        if (point.y < lowest) lowest = point.y;
    });
    model.position.y += origin.y - lowest;
    model.updateMatrixWorld(true);
    return head.getWorldPosition(new THREE.Vector3()).y - origin.y;
}

function dressArcher(unit) {
    if (!archerGltf || unit.archer) return;
    const model = cloneSkinned(archerGltf.scene);
    let right = null;
    let left = null;
    model.traverse((obj) => {
        if (obj.isMesh) {
            obj.castShadow = true;
            obj.frustumCulled = false;
        }
        if (obj.name === "mixamorigRightHand") right = obj;
        if (obj.name === "mixamorigLeftHand") left = obj;
    });
    unit.props = {};
    unit.rightHand = right;
    unit.leftHand = left;
    ARM_ORDER.forEach((id) => addArmProp(unit, id));
    if (unit.body && unit.body.parent) unit.body.parent.remove(unit.body);
    const look = ensureLook(unit);
    look.scale.setScalar(1);
    look.add(model);
    model.userData.unit = unit;
    unit.body = model;
    unit.headBone = null;
    const mixer = new THREE.AnimationMixer(model);
    const clips = {};
    for (let i = 0; i < archerGltf.animations.length; i++) {
        const clip = archerGltf.animations[i];
        clips[clip.name] = mixer.clipAction(clip);
    }
    unit.mixer = mixer;
    unit.clips = clips;
    unit.archer = true;
    unit.pose = "";
    unit.bowHand = left;
    playArcher(unit, "Idle_02", false);
    mixer.update(0);
    unit.eyeHeight = fitArcher(model, unit.group, playerRow()) * 0.92;
    applyLook(unit);
}

function showArm(unit) {
    if (!unit || !unit.props) return;
    ARM_ORDER.forEach((id) => {
        if (unit.props[id]) unit.props[id].visible = id === arm;
    });
    unit.bowHand = arm === "bow" || arm === "crossbow" ? unit.leftHand : unit.rightHand;
}

function playArcher(unit, name, once) {
    const action = unit.clips && unit.clips[name];
    if (!action) return null;
    if (unit.pose === name && !once) return action;
    Object.keys(unit.clips).forEach((key) => {
        if (key !== name) unit.clips[key].stop();
    });
    action.reset();
    action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    action.clampWhenFinished = !!once;
    const pace = { Archery_Shot_1: 1.15, Draw_and_Shoot_from_Back: 1.8, Right_Hand_Sword_Slash: 1.35, Regular_Jump: 2.6 };
    action.timeScale = pace[name] || 1;
    action.play();
    unit.pose = name;
    return action;
}

function holdArcher(unit, dt) {
    if (unit.pose !== "Idle_02") playArcher(unit, "Idle_02", false);
    unit.mixer.update(dt);
}

function playerPose(unit) {
    if ((unit.hop || 0) > 0.04 || (unit.vy || 0) > 0.2) return "Regular_Jump";
    const forward = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
    const strafe = (keys.a || keys.arrowleft ? 1 : 0) - (keys.d || keys.arrowright ? 1 : 0);
    if (forward > 0) return "Walking";
    if (forward < 0) return "Walk_Backward_inplace";
    if (strafe > 0) return "Strafe_left_RT";
    if (strafe < 0) return "Strafe_right_RT";
    let gap = lookYaw - (unit.bodyYaw == null ? lookYaw : unit.bodyYaw);
    while (gap > Math.PI) gap -= Math.PI * 2;
    while (gap < -Math.PI) gap += Math.PI * 2;
    if (gap > 0.5) return "Idle_Step_Turn_Left";
    if (gap < -0.5) return "Idle_Turn_Right";
    return "Idle_02";
}

function stepArcher(unit, dt, moving) {
    const action = unit.pose && unit.clips ? unit.clips[unit.pose] : null;
    const jumping = unit.pose === "Regular_Jump" && action && action.isRunning() && ((unit.hop || 0) > 0.02 || (unit.vy || 0) > 0);
    const busy = jumping || !!(action && ATTACK_POSES[unit.pose] && action.isRunning());
    if (!busy) {
        const name = unit === pilot ? playerPose(unit) : (moving ? "Walking" : "Idle_02");
        playArcher(unit, name, name === "Regular_Jump");
    }
    unit.mixer.update(dt);
    if (!busy || !action) return;
    if (unit.pose === "Archery_Shot_1" || unit.pose === "Draw_and_Shoot_from_Back") {
        if (!unit.released && action.time >= (unit.releaseAt || 0.7)) {
            unit.released = true;
            looseArrow();
        }
        if (unit.pose === "Draw_and_Shoot_from_Back" && unit.released && action.time > unit.releaseAt + 0.45) action.stop();
    }
    if (!action.isRunning()) unit.pose = "";
}

function ensureSelf() {
    let unit = null;
    let fresh = false;
    for (let i = 0; i < units.length; i++) {
        if (units[i].side === "self") {
            unit = units[i];
            break;
        }
    }
    if (!unit) {
        if (!home || !actors) return null;
        unit = spawn("soldier", home.x - 8, home.z + 16, "self");
        unit.state = "idle";
        unit.job = null;
        unit.jobNode = null;
        unit.goal = null;
        fresh = true;
    }
    const row = playerRow();
    if (unit.look) unit.look.scale.setScalar(1);
    if (archerGltf) dressArcher(unit);
    else fitMapModel(unit.body, row.w / 2, row.d / 2);
    unit.ringScale = Math.max(row.w, row.d) / 1.24;
    unit.foot = Math.max(row.w || 0.6, row.d || 0.4) / 2;
    applyLook(unit);
    eye = unit.eyeHeight || 1.2 * (unit.body.scale.y || 1);
    showRing(unit);
    unit.speed = row.move;
    unit.maxHp = row.hp;
    if (fresh) unit.hp = row.hp;
    else if (unit.hp > row.hp) unit.hp = row.hp;
    return unit;
}

function showRally() {
    if (!rally) {
        rallyFlag.visible = false;
        return;
    }
    rallyFlag.visible = true;
    rallyFlag.position.set(rally.x, heightAt(rally.x, rally.z), rally.z);
}

function setRally(x, z) {
    rally = { x: x, z: z };
    showRally();
    refreshHud();
    writeSave();
}

function rallySlot() {
    let n = 0;
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (unit.side !== "you" || unit.state !== "move" || !unit.goal) continue;
        if (Math.hypot(unit.goal.x - rally.x, unit.goal.z - rally.z) < 8) n++;
    }
    return n;
}

function sideQueued(side) {
    let n = 0;
    for (let i = 0; i < trains.length; i++) if (trains[i].side === side) n++;
    return n;
}

function trainSpot(side, kind) {
    const base = side === "cpu" ? cpuHome : home;
    let fallback = base && madeBy("manor").indexOf(kind) >= 0 ? base : null;
    for (let i = 0; i < built.length; i++) {
        if ((built[i].side || "you") !== side) continue;
        if (madeBy(built[i].kind).indexOf(kind) < 0) continue;
        if (built[i].kind === "barracks") return built[i];
        if (!fallback) fallback = built[i];
    }
    return fallback || base;
}

function deliverTrain(side, kind) {
    const place = trainSpot(side, kind);
    if (!place || !fielded(side, kind)) return false;
    const ang = Math.PI * 0.5 + sideKind(side, kind) * 0.32;
    const reach = militaryKind(kind) && place.hx ? Math.max(place.hx, place.hz) + 3 : 22;
    const unit = spawn(kind, place.x + Math.cos(ang) * reach, place.z + Math.sin(ang) * reach, side);
    if (!unit) return false;
    if (side === "you" && rally) {
        const slot = rallySlot();
        const spread = slot === 0 ? 0 : 1.6;
        const turn = slot * 0.85;
        unit.job = null;
        unit.jobNode = null;
        unit.targetId = null;
        unit.goal = { x: rally.x + Math.cos(turn) * spread, z: rally.z + Math.sin(turn) * spread };
        unit.state = "move";
    }
    if (side === "you") refreshHud();
    return true;
}

function trainFor(side, kind, auto) {
    const base = side === "cpu" ? cpuHome : home;
    if (!auto) {
        const from = manorSelected ? "manor" : (selectedHouse && selectedHouse.kind);
        if (!from || madeBy(from).indexOf(kind) < 0) return;
        if (manorSelected && side !== led) return;
        if (!manorSelected && selectedHouse && (selectedHouse.side || "you") !== side) return;
    } else if (madeBy("manor").indexOf(kind) < 0) {
        const fromBarracks = militaryKind(kind) && ownedCount(built, "barracks", side) > 0 && madeBy("barracks").indexOf(kind) >= 0;
        if (!fromBarracks) return;
    }
    if (!actors || !base) return;
    if (auto && sideQueued(side) > 0) return;
    const bill = unitBill(kind);
    if (!canPay(side, bill)) return;
    if (!housed(side, kind)) return;
    spend(side, bill);
    trains.push({ side: side, kind: kind, left: trainSeconds(kind) });
    refreshHud();
    writeSave();
}

let trainClock = 0;
function stepTrains(dt) {
    const ticking = { you: false, cpu: false };
    for (let i = 0; i < trains.length; i++) {
        const job = trains[i];
        if (ticking[job.side]) continue;
        ticking[job.side] = true;
        if (!fielded(job.side, job.kind)) continue;
        job.left -= dt;
        if (job.left > 0) continue;
        if (deliverTrain(job.side, job.kind)) {
            trains.splice(i, 1);
            i--;
            writeSave();
        } else job.left = 0;
    }
    trainClock += dt;
    if (trainClock >= 0.25 && trains.some((job) => job.side === "you")) {
        trainClock = 0;
        refreshHud();
    }
}

function trainSeconds(kind) {
    const row = unitRow(kind);
    const cols = window.AoeSheet && window.AoeSheet.columns ? window.AoeSheet.columns("units") : [];
    let col = null;
    for (let i = 0; i < cols.length; i++) {
        if (String(cols[i].name || "").trim().toLowerCase() === "training time") col = cols[i];
    }
    const raw = col && row && row.extra ? row.extra[col.id] : "";
    if (raw === "" || raw == null) return TRAIN_TIME;
    const n = Number(raw);
    if (!Number.isFinite(n)) return TRAIN_TIME;
    return Math.max(0, Math.min(3600, n));
}

function train(kind) {
    const side = manorSelected ? led : (selectedHouse ? (selectedHouse.side || "you") : led);
    trainFor(side, kind);
}

workerBtn.addEventListener("click", () => playTest ? beginPlaceUnit("worker") : train("worker"));
soldierBtn.addEventListener("click", () => playTest ? beginPlaceUnit("soldier") : train("soldier"));
if (horseBtn) horseBtn.addEventListener("click", () => {
    if (horseBtn.disabled || !selectedHouse) return;
    trainHorse(selectedHouse);
});
let placingUnit = null;

function beginPlaceUnit(kind) {
    if (!playTest || !bodyFor(kind)) return;
    placing = null;
    townRing.visible = false;
    placingUnit = kind;
    ghost.geometry.dispose();
    ghost.geometry = new THREE.BoxGeometry(1.1, 0.18, 0.7);
    ghost.visible = false;
    const row = unitRow(kind);
    selEl.textContent = "Click the ground to put down " + (row.name || kind) + " for " + teamName(led) + ". Right-click stops.";
}

function beginPlace(kind) {
    const spec = tuned(kind);
    if (!spec || !kits[kind] || buildBtns[kind].disabled) return;
    placingUnit = null;
    placing = kind;
    ghost.geometry.dispose();
    ghost.geometry = new THREE.BoxGeometry(spec.hx * 2, 0.18, spec.hz * 2);
    ghost.visible = false;
    const base = sideBase(led);
    if (spec.town && base) {
        townRing.position.set(base.x, heightAt(base.x, base.z) + 0.25, base.z);
        townRing.visible = true;
    } else townRing.visible = false;
    refreshHud();
}
Object.keys(buildBtns).forEach((key) => buildBtns[key].addEventListener("click", () => beginPlace(key)));
function applyStock() {
    const nextFood = Math.floor(Number(foodEl.value));
    const nextWood = Math.floor(Number(woodEl.value));
    const nextGold = Math.floor(Number(goldEl.value));
    const nextIron = Math.floor(Number(ironEl.value));
    const nextSalt = Math.floor(Number(saltEl.value));
    const nextStone = Math.floor(Number(stoneEl.value));
    const nextFabric = Math.floor(Number(fabricEl.value));
    if (!Number.isFinite(nextFood) || !Number.isFinite(nextWood) || !Number.isFinite(nextGold)) return;
    if (!Number.isFinite(nextIron) || !Number.isFinite(nextSalt) || !Number.isFinite(nextStone) || !Number.isFinite(nextFabric)) return;
    writeBag(led, {
        food: Math.max(0, nextFood),
        wood: Math.max(0, nextWood),
        gold: Math.max(0, nextGold),
        iron: Math.max(0, nextIron),
        salt: Math.max(0, nextSalt),
        stone: Math.max(0, nextStone),
        fabric: Math.max(0, nextFabric)
    });
    refreshHud();
    writeSave();
}
[foodEl, woodEl, goldEl, ironEl, saltEl, stoneEl, fabricEl].forEach((el) => {
    if (el) el.addEventListener("input", applyStock);
});

function setStance(stance) {
    let changed = false;
    for (let i = 0; i < selected.length; i++) {
        const unit = selected[i];
        if (!militaryKind(unit.kind) || (unit.side !== "you" && unit.side !== "cpu")) continue;
        unit.stance = stance;
        if (stance === "guard") {
            unit.post = unit.state === "move" && unit.goal ? { x: unit.goal.x, z: unit.goal.z } : { x: unit.x, z: unit.z };
        } else if (unit.state === "back") unit.state = "idle";
        changed = true;
    }
    if (!changed) return;
    refreshHud();
    writeSave();
}
guardBtn.addEventListener("click", () => setStance("guard"));
attackBtn.addEventListener("click", () => setStance("attack"));

const SAVE_KEY = playTest ? "aoe-playtest-save" : (BOARD_URL ? "aoe-board-save" : "aoe-save");
let aGift = false;

let lined = false;

function musterAt(base, index, count, rowShift) {
    const hx = base.hx || MANOR_HX;
    const hz = base.hz || MANOR_HZ;
    const gap = 1.7;
    const n = Math.max(1, count);
    const cols = Math.min(n, 10);
    const span = (cols - 1) * gap;
    const col = index % cols;
    const row = Math.floor(index / cols) + (rowShift || 0);
    let x = base.x - span / 2 + col * gap;
    let z = base.z - hz - 4 - row * 1.8;
    const ground = base.y != null ? base.y : heightAt(base.x, base.z);
    for (let i = 0; i < 8; i++) {
        if (!inWater(x, z) && !closedGround(x, z) && Math.abs(heightAt(x, z) - ground) < 2) break;
        z -= 1.2;
    }
    if (inWater(x, z) || closedGround(x, z)) {
        const dry = dryNear(base.x, base.z + hz);
        return { x: dry.x + (col - (cols - 1) / 2) * gap, z: dry.z };
    }
    return { x: x, z: z };
}

function standUnit(unit, x, z) {
    unit.x = x;
    unit.z = z;
    unit.yaw = 0;
    unit.group.position.set(x, heightAt(x, z), z);
    unit.group.rotation.y = unit.yaw;
    unit.job = null;
    unit.jobNode = null;
    unit.goal = null;
    unit.state = "idle";
    unit.carry = unit.carry || 0;
}

function lineUpSide(side) {
    const base = sideBase(side);
    if (!base) return;
    const list = [];
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (unit.side !== side || unit.hp <= 0 || unit === pilot) continue;
        if (!workerKind(unit.kind) || unit.orders) continue;
        list.push(unit);
    }
    for (let i = 0; i < list.length; i++) {
        const spot = musterAt(base, i, list.length, 0);
        standUnit(list[i], spot.x, spot.z);
    }
}

function dryNear(x, z) {
    if (!inWater(x, z)) return { x: x, z: z };
    for (let ring = 6; ring <= 48; ring += 4) {
        for (let step = 0; step < 10; step++) {
            const ang = (step / 10) * Math.PI * 2;
            const nx = x + Math.cos(ang) * ring;
            const nz = z + Math.sin(ang) * ring;
            if (!inWater(nx, nz)) return { x: nx, z: nz };
        }
    }
    return { x: home.x, z: home.z };
}

function grantTeamA() {
    if (!home || !actors) return;
    for (let i = 0; i < 50; i++) {
        const ang = (i / 50) * Math.PI * 2;
        const ring = 16 + (i % 6) * 3;
        const spot = dryNear(home.x + Math.cos(ang) * ring, home.z + Math.sin(ang) * ring);
        spawn("worker", spot.x, spot.z, "you");
    }
    aGift = true;
}

function readSave() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        const data = raw ? JSON.parse(raw) : null;
        if (!data || data.map !== "manual" || !Array.isArray(data.units) || !data.units.length) return null;
        return data;
    } catch (err) {
        return null;
    }
}

function writeSave() {
    if (!actors || !home || !units.length) return;
    const data = {
        map: "manual",
        food: food,
        wood: wood,
        gold: gold,
        iron: iron,
        salt: salt,
        stone: stone,
        fabric: fabric,
        cpuFood: cpuFood,
        cpuWood: cpuWood,
        cpuGold: cpuGold,
        cpuIron: cpuIron,
        cpuSalt: cpuSalt,
        cpuStone: cpuStone,
        cpuFabric: cpuFabric,
        nextId: nextId,
        look: { x: look.x, z: look.z, yaw: yaw, dist: dist },
        rally: rally ? { x: rally.x, z: rally.z } : null,
        houses: Object.keys(kits).some((key) => kits[key]) ? built.filter((house) => !house.preview).map((house) => ({ kind: house.kind, side: house.side || "you", x: house.x, z: house.z, y: house.y })) : ((readSave() || {}).houses || []),
        pending: Object.keys(kits).some((key) => kits[key]) ? sites.map((site) => ({ kind: site.kind, side: site.side || "you", x: site.x, z: site.z, y: site.y, left: site.left })) : ((readSave() || {}).pending || []),
        aGift: aGift,
        lined: lined,
        campaignMark: appliedCampaign,
        clock: dayMin,
        depots: depotRows(),
        trains: trains.map((job) => ({ side: job.side, kind: job.kind, left: job.left })),
        units: units.map((unit) => ({
            id: unit.id,
            side: unit.side,
            kind: unit.kind,
            x: unit.x,
            z: unit.z,
            yaw: unit.yaw,
            state: unit === pilot ? "idle" : unit.state,
            job: unit.job,
            carry: unit.carry,
            hp: unit.hp,
            stance: militaryKind(unit.kind) ? unit.stance : null,
            post: unit.post ? { x: unit.post.x, z: unit.post.z } : null,
            target: unit.targetId || null,
            goal: unit.goal ? { x: unit.goal.x, z: unit.goal.z } : null,
            node: unit.jobNode ? { kind: unit.jobNode.kind, x: unit.jobNode.x, z: unit.jobNode.z } : null,
            orders: !!unit.orders,
            bed: unit.shelter ? { x: unit.shelter.x, z: unit.shelter.z } : null
        }))
    };
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (err) {
        /* the match still runs if the browser will not store it */
    }
}

function matchNode(saved) {
    if (!saved) return null;
    let best = null;
    let bestD = 2;
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.kind !== saved.kind) continue;
        const d = Math.hypot(node.x - saved.x, node.z - saved.z);
        if (d < bestD) {
            bestD = d;
            best = node;
        }
    }
    return best;
}

function restoreMatch(save) {
    haulSave = save;
    lined = !!save.lined;
    food = Number(save.food) || 0;
    wood = Number(save.wood) || 0;
    gold = Number(save.gold) || 0;
    iron = Number(save.iron) || 0;
    salt = Number(save.salt) || 0;
    stone = Number(save.stone) || 0;
    fabric = Number(save.fabric) || 0;
    cpuFood = Number(save.cpuFood) || 0;
    cpuWood = Number(save.cpuWood) || 0;
    cpuGold = Number(save.cpuGold) || 0;
    cpuIron = Number(save.cpuIron) || 0;
    cpuSalt = Number(save.cpuSalt) || 0;
    cpuStone = Number(save.cpuStone) || 0;
    cpuFabric = Number(save.cpuFabric) || 0;
    for (let i = 0; i < save.units.length; i++) {
        const row = save.units[i];
        if (row.side !== "you" && row.side !== "cpu" && row.side !== "self") continue;
        if (row.side === "cpu" && !cpuHome) continue;
        if (!workerKind(row.kind) && !militaryKind(row.kind)) continue;
        if (row.hp != null && Number(row.hp) <= 0) continue;
        const unit = spawn(row.kind, Number(row.x) || 0, Number(row.z) || 0, row.side);
        unit.id = row.id || unit.id;
        unit.yaw = Number(row.yaw) || 0;
        unit.group.rotation.y = unit.yaw;
        unit.job = row.job === "wood" || row.job === "food" || row.job === "gold" || row.job === "stone" ? row.job : null;
        unit.carry = Math.max(0, Math.min(CARRY_MAX, Number(row.carry) || 0));
        unit.goal = row.goal && Number.isFinite(row.goal.x) && Number.isFinite(row.goal.z) ? { x: row.goal.x, z: row.goal.z } : null;
        unit.jobNode = row.node && row.node.kind === "farm" && Number.isFinite(Number(row.node.x)) && Number.isFinite(Number(row.node.z))
            ? { kind: "farm", x: Number(row.node.x), z: Number(row.node.z), farm: null }
            : matchNode(row.node);
        if (militaryKind(unit.kind)) {
            unit.stance = row.stance === "attack" ? "attack" : "guard";
            unit.post = row.post && Number.isFinite(row.post.x) && Number.isFinite(row.post.z) ? { x: row.post.x, z: row.post.z } : { x: unit.x, z: unit.z };
            unit.targetId = Number(row.target) || null;
            if (Number.isFinite(Number(row.hp))) unit.hp = Math.max(1, Number(row.hp));
        } else if (Number.isFinite(Number(row.hp))) unit.hp = Math.max(1, Number(row.hp));
        const state = row.state;
        if (state === "inside" || state === "home") {
            unit.bedSave = row.bed && Number.isFinite(Number(row.bed.x)) && Number.isFinite(Number(row.bed.z))
                ? { x: Number(row.bed.x), z: Number(row.bed.z), inside: state === "inside" }
                : null;
            unit.state = "idle";
        } else if ((state === "goto" || state === "return") && unit.goal && (state !== "goto" || unit.jobNode)) unit.state = state;
        else if (state === "gather" && unit.jobNode) unit.state = "gather";
        else if (state === "move" && unit.goal) unit.state = "move";
        else if ((state === "chase" || state === "strike") && unit.targetId) unit.state = "chase";
        else if (state === "back" && unit.post) {
            unit.goal = { x: unit.post.x, z: unit.post.z };
            unit.state = "back";
        } else if (unit.carry > 0) {
            unit.goal = dropAt(unit);
            unit.state = "return";
        } else unit.state = "idle";
        unit.orders = !!row.orders;
    }
    let maxId = 0;
    for (let i = 0; i < units.length; i++) if (units[i].id > maxId) maxId = units[i].id;
    nextId = Math.max(maxId + 1, Number(save.nextId) || 1);
    if (save.look && Number.isFinite(save.look.x) && Number.isFinite(save.look.z)) {
        look.x = Math.max(mapBox.min.x, Math.min(mapBox.max.x, save.look.x));
        look.z = Math.max(mapBox.min.z, Math.min(mapBox.max.z, save.look.z));
        yaw = Number(save.look.yaw) || 0;
        dist = Math.max(16, Math.min(viewFar, Number(save.look.dist) || 58));
    }
    if (save.rally && Number.isFinite(Number(save.rally.x)) && Number.isFinite(Number(save.rally.z))) {
        rally = { x: Number(save.rally.x), z: Number(save.rally.z) };
        showRally();
    }
    restoreHouses(save);
    trains.length = 0;
    if (Array.isArray(save.trains)) {
        for (let i = 0; i < save.trains.length; i++) {
            const row = save.trains[i];
            if (!row || (row.side !== "you" && row.side !== "cpu")) continue;
            if (!workerKind(row.kind) && !militaryKind(row.kind)) continue;
            trains.push({ side: row.side, kind: row.kind, left: Math.max(0, Number(row.left) || TRAIN_TIME) });
        }
    }
    if (save.aGift) aGift = true;
    else grantTeamA();
    if (Number.isFinite(Number(save.clock))) dayMin = ((Number(save.clock) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    paintClock();
    if (!nightTime()) wakeAll();
}

const floorPads = [];

function dropPorch(group) {
    const mesh = group && group.userData && group.userData.porch;
    if (!mesh) return;
    group.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    group.userData.porch = null;
}

function seatFloors() {
    const world = window.World;
    if (!board && (!world || !world.bareHeight)) return;
    floorPads.length = 0;
    const seat = (x, z, hx, hz, group, record) => {
        if (!board && world && world.wet && world.wet(x, z)) return 0;
        if (!board && world && world.tooSteep && world.tooSteep(x, z)) return 0;
        const corners = [
            heightAt(x - hx, z - hz),
            heightAt(x + hx, z - hz),
            heightAt(x - hx, z + hz),
            heightAt(x + hx, z + hz)
        ];
        let y = 0;
        for (let i = 0; i < corners.length; i++) y += corners[i];
        y /= corners.length;
        if (group) {
            group.position.y = y;
            dropPorch(group);
        }
        if (record) record.y = y;
        shapeGround(x, z, y, hx, hz);
        floorPads.push({ minX: x - hx, minZ: z - hz, w: hx * 2, d: hz * 2, y: y });
        return y;
    };
    if (home && home.group) seat(home.x, home.z, home.hx || manorPad().hx, home.hz || manorPad().hz, home.group, home);
    if (cpuHome && cpuHome.group) seat(cpuHome.x, cpuHome.z, cpuHome.hx || manorPad().hx, cpuHome.hz || manorPad().hz, cpuHome.group, cpuHome);
    for (let i = 0; i < built.length; i++) {
        const entry = built[i];
        seat(entry.x, entry.z, entry.hx, entry.hz, entry.group, entry);
    }
    for (let i = 0; i < sites.length; i++) {
        const site = sites[i];
        const y = seat(site.x, site.z, site.hx, site.hz, null, site);
        if (site.mark) site.mark.position.y = y + 0.1;
    }
    if (!board && world && world.setLevelPads) world.setLevelPads(floorPads.slice());
}

async function startMatch(playerHome, otherHome) {
    home = playerHome;
    cpuHome = otherHome;
    try {
        await loadKits();
    } catch (err) {
        /* a missing kit stays off the build list; the others still place */
    }
    actors = {
        worker: await loadPerson("../models/meshy/villager.skin.bin", "../models/meshy/villager.skin.png"),
        soldier: await loadPerson("../models/meshy/militia.skin.bin", "../models/meshy/militia.skin.png")
    };
    const save = readSave();
    if (save) restoreMatch(save);
    else aGift = true;
    if (!playTest || !save) applyCampaign(save && save.campaignMark);
    if (!window.AoeSheet && !units.some((unit) => unit.side === "you")) spawn("worker", home.x + 4, home.z + 24, "you");
    if (!lined) {
        lineUpSide("you");
        lineUpSide("cpu");
        lined = true;
        cpuThink = -8;
    }
    bootHaulers();
    ensureSelf();
    seatFloors();
    refreshLand(true);
    refreshHud();
    writeSave();
    setTimeout(warmMatch, 1500);
}

let mapTrees = null;
let mapCards = null;
const treeSpots = [];
const MAP_TREE_FILES = [
    "2d TREES/isometric tiles/bigtree01.png",
    "2d TREES/isometric tiles/bigtree02.png",
    "2d TREES/isometric tiles/bigtree03.png",
    "2d TREES/isometric tiles/pine-none02.png",
    "2d TREES/isometric tiles/pine-none05.png",
    "2d TREES/isometric tiles/pine-none08.png"
];

function grassHere(x, z) {
    if (!board || !board.colors || coverAt(x, z) !== 1) return false;
    const u = (x - board.minX) / board.span;
    const v = (z - board.minZ) / board.span;
    const n = board.n;
    const i = Math.min(n - 1, Math.max(0, Math.round(u * (n - 1))));
    const j = Math.min(n - 1, Math.max(0, Math.round(v * (n - 1))));
    const o = (j * n + i) * 3;
    const r = board.colors[o];
    const g = board.colors[o + 1];
    const b = board.colors[o + 2];
    return g - Math.max(r, b) > 0.02;
}

function clearOfManor(x, z) {
    for (let i = 0; i < manors.length; i++) {
        const spot = manors[i].position;
        if (Math.hypot(x - spot.x, z - spot.z) < 46) return false;
    }
    return true;
}

function loadTreeCard(url) {
    return new Promise((resolve) => {
        new THREE.TextureLoader().load(encodeURI(url), (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            const image = texture.image;
            const canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(image, 0, 0);
            const data = ctx.getImageData(0, 0, image.width, image.height).data;
            let bottom = image.height - 1;
            for (let y = image.height - 1; y >= 0; y--) {
                let hit = false;
                for (let x = 0; x < image.width; x += 2) {
                    if (data[(y * image.width + x) * 4 + 3] > 24) {
                        hit = true;
                        break;
                    }
                }
                if (hit) {
                    bottom = y;
                    break;
                }
            }
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: texture,
                color: new THREE.Color(6.5, 6.5, 6.5),
                transparent: true,
                alphaTest: 0.2,
                depthWrite: true
            }));
            const tall = 14 * 1.3;
            sprite.scale.set(tall, tall * image.height / image.width, 1);
            sprite.center.set(0.5, (image.height - 1 - bottom) / image.height);
            resolve(sprite);
        }, undefined, () => resolve(null));
    });
}

function showMapTrees() {
    if (!board || mapTrees) return;
    const group = new THREE.Group();
    group.name = "map-trees";
    group.visible = !pilot;
    mapTrees = group;
    scene.add(group);
    Promise.all(MAP_TREE_FILES.map(loadTreeCard)).then((cards) => {
        const ready = cards.filter(Boolean);
        if (!ready.length || mapTrees !== group) return;
        const spots = [];
        function addTree(x, z, roll) {
            if (!grassHere(x, z) || !clearOfManor(x, z)) return;
            for (let i = 0; i < spots.length; i++) {
                if (Math.hypot(x - spots[i].x, z - spots[i].z) < 6) return;
            }
            const card = ready[Math.floor(roll * ready.length) % ready.length];
            const tree = card.clone();
            tree.position.set(x, heightAt(x, z), z);
            tree.userData.mark = { x: x, z: z };
            group.add(tree);
            spots.push({ x: x, z: z });
            treeSpots.push({ x: x, z: z, yaw: roll * Math.PI * 2, scale: 1, wood: true });
            addWoodSpot(x, z, 1);
        }
        const span = board.span;
        const seeds = [];
        for (let z = board.minZ + 40; z < board.minZ + span - 40; z += 78) {
            for (let x = board.minX + 40; x < board.minX + span - 40; x += 78) {
                if (treeRoll(x, z) > 0.55) continue;
                if (!grassHere(x, z) || !clearOfManor(x, z)) continue;
                seeds.push({ x: x, z: z });
            }
        }
        if (home) {
            const roll = treeRoll(home.x, home.z);
            seeds.push({
                x: home.x + Math.cos(roll * 6.28) * 72,
                z: home.z + Math.sin(roll * 6.28) * 72
            });
        }
        seeds.forEach((seed) => {
            const count = 6 + Math.floor(treeRoll(seed.x + 9, seed.z) * 5);
            for (let n = 0; n < count && spots.length < 240; n++) {
                const spin = treeRoll(seed.x + n * 13, seed.z - n * 7);
                const reach = 5 + treeRoll(seed.x - n, seed.z + n * 3) * 16;
                addTree(seed.x + Math.cos(spin * 6.28) * reach, seed.z + Math.sin(spin * 6.28) * reach, spin);
            }
        });
        if (pilot) {
            walkMarkX = 1e9;
            walkMarkZ = 1e9;
        }
    });
}

let walkTrees = null;
let walkToken = 0;
let walkBusy = false;
let walkMarkX = 1e9;
let walkMarkZ = 1e9;

function clearWalkTrees() {
    walkToken += 1;
    walkBusy = false;
    if (walkTrees) {
        scene.remove(walkTrees);
        walkTrees = null;
    }
    walkMarkX = 1e9;
    walkMarkZ = 1e9;
}

function refreshWalkTrees() {
    if (!pilot || !treeSpots.length) return;
    if ((walkTrees || walkBusy) && Math.hypot(pilot.x - walkMarkX, pilot.z - walkMarkZ) < 40) return;
    const x = pilot.x;
    const z = pilot.z;
    walkMarkX = x;
    walkMarkZ = z;
    const token = walkToken + 1;
    walkToken = token;
    walkBusy = true;
    loadPackTrees().then((models) => {
        if (token !== walkToken || !pilot || !models.length) {
            if (token === walkToken) walkBusy = false;
            return;
        }
        if (walkTrees) scene.remove(walkTrees);
        const group = new THREE.Group();
        group.name = "walk-trees";
        for (let i = 0; i < treeSpots.length; i++) {
            const spot = treeSpots[i];
            if (Math.hypot(spot.x - x, spot.z - z) > 230) continue;
            const tree = packTree(models, spot.x, spot.z).clone(true);
            tree.position.set(spot.x, heightAt(spot.x, spot.z), spot.z);
            tree.rotation.y = spot.yaw || 0;
            tree.scale.multiplyScalar(spot.scale || 1);
            group.add(tree);
        }
        walkTrees = group;
        walkBusy = false;
        scene.add(group);
    });
}

function showMapObjects() {
    if (!board) return;
    fetch("map-objects.json", { cache: "no-store" }).then((res) => res.ok ? res.json() : null).then(async (data) => {
        if (!data || data.map !== "newmap" || !Array.isArray(data.objects) || !data.objects.length) return;
        const templates = {};
        const group = new THREE.Group();
        group.name = "map-objects";
        scene.add(group);
        mapCards = new THREE.Group();
        mapCards.name = "map-cards";
        mapCards.visible = !pilot;
        scene.add(mapCards);
        for (let i = 0; i < data.objects.length; i++) {
            const item = data.objects[i];
            const kind = kindById(item.kind);
            if (!kind) continue;
            if (kind.kit) {
                if (!templates[kind.id]) templates[kind.id] = await loadKitShell(kind.kit);
                const shell = templates[kind.id].clone(true);
                shell.scale.multiplyScalar(Number(item.scale) || 1);
                shell.position.set(item.x, heightAt(item.x, item.z), item.z);
                shell.rotation.y = Number(item.yaw) || 0;
                group.add(shell);
                continue;
            }
            if (kind.shape) {
                if (!templates[kind.id]) templates[kind.id] = makeMapShape(kind);
                const mesh = templates[kind.id].clone(true);
                mesh.scale.multiplyScalar(Number(item.scale) || 1);
                mesh.position.set(item.x, heightAt(item.x, item.z), item.z);
                mesh.rotation.y = Number(item.yaw) || 0;
                group.add(mesh);
                continue;
            }
            if (kind.card) {
                if (!templates[kind.id]) templates[kind.id] = await loadTreeCard(kind.file);
                if (!templates[kind.id]) continue;
                const tree = templates[kind.id].clone();
                tree.scale.multiplyScalar(Number(item.scale) || 1);
                tree.position.set(item.x, heightAt(item.x, item.z), item.z);
                tree.userData.mark = { x: item.x, z: item.z };
                mapCards.add(tree);
                const wood = /tree|pine|palm|bamboo|tropical/.test(kind.id);
                const scale = Number(item.scale) || 1;
                treeSpots.push({
                    x: item.x,
                    z: item.z,
                    yaw: Number(item.yaw) || 0,
                    scale: scale,
                    wood: wood
                });
                if (wood) addWoodSpot(item.x, item.z, scale);
                continue;
            }
            if (!templates[kind.id]) {
                const gltf = kind.file ? await loadGltf(kind.file) : null;
                templates[kind.id] = gltf ? plantModel(gltf.scene) : makeStandIn(kind);
            }
            const mesh = templates[kind.id].clone(true);
            mesh.scale.multiplyScalar(Number(item.scale) || 1);
            mesh.position.set(item.x, heightAt(item.x, item.z), item.z);
            mesh.rotation.y = Number(item.yaw) || 0;
            group.add(mesh);
        }
    }).catch(() => {});
}

function warmMatch() {
    showMapObjects();
    showMapTrees();
    loadHorse().then(() => {
        bootHaulers();
        setTimeout(() => {
            showBlacksmith().then(() => setTimeout(queueRoster, 800));
        }, 800);
    });
}

document.getElementById("restart").addEventListener("click", () => {
    if (!window.confirm("Start this match over? The saved game will be replaced.")) return;
    localStorage.removeItem(SAVE_KEY);
    location.reload();
});
window.addEventListener("pagehide", writeSave);

let appliedCampaign = "";

function campaignMark() {
    const pack = {};
    ["you", "cpu"].forEach((side) => {
        const row = factionRow(side);
        if (!row) return;
        const goods = {};
        for (let i = 0; i < PAY.length; i++) goods[PAY[i]] = Number(row[PAY[i]]) || 0;
        pack[side] = { name: row.name, goods: goods, units: row.units || [], buildings: row.buildings || [] };
    });
    return JSON.stringify(pack);
}

function wantedCounts(lines) {
    const want = {};
    const list = Array.isArray(lines) ? lines : [];
    for (let i = 0; i < list.length; i++) {
        const id = list[i] && list[i].id;
        if (!id || id === "manor") continue;
        const count = Math.max(0, Math.min(24, Number(list[i].count) || 0));
        want[id] = (want[id] || 0) + count;
    }
    return want;
}

function dropSite(site) {
    const index = sites.indexOf(site);
    if (index >= 0) sites.splice(index, 1);
    if (site.mark) {
        scene.remove(site.mark);
        site.mark = null;
    }
}

function dropBuilding(entry) {
    if (!entry || entry.kind === "manor" || entry.preview) return;
    if (entry.horse) loseHorse(entry.horse);
    if (entry.group) scene.remove(entry.group);
    const at = built.indexOf(entry);
    if (at >= 0) built.splice(at, 1);
    const drawn = manors.indexOf(entry.group);
    if (drawn >= 0) manors.splice(drawn, 1);
    if (selectedHouse === entry) selectedHouse = null;
}

function giftBuilding(side, kind) {
    const spec = tuned(kind);
    const base = sideBase(side);
    if (!spec || !kits[kind] || !base) return false;
    let spot = null;
    const rings = kind === "house" ? Math.ceil((TOWN_RANGE - 24) / 8) + 1 : 4;
    const angles = kind === "house" ? 12 : 8;
    for (let ring = 0; ring < rings && !spot; ring++) {
        const dist = 24 + ring * 8;
        if (spec.town && dist > TOWN_RANGE - 4) break;
        for (let i = 0; i < angles; i++) {
            const ang = i * Math.PI * 2 / angles + ring;
            const x = base.x + Math.cos(ang) * dist;
            const z = base.z + Math.sin(ang) * dist;
            if (spotOk(x, z, spec, base) === "") {
                spot = { x: x, z: z };
                break;
            }
        }
    }
    if (!spot) return false;
    placeBuilding(kind, spot.x, heightAt(spot.x, spot.z), spot.z, side);
    return true;
}

function syncSideUnits(side, lines) {
    const want = wantedCounts(lines);
    const base = sideBase(side);
    Object.keys(want).forEach((kind) => {
        if (!bodyFor(kind)) delete want[kind];
    });
    const grouped = {};
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (unit.side !== side || unit.hp <= 0 || want[unit.kind] == null) continue;
        if (!grouped[unit.kind]) grouped[unit.kind] = [];
        grouped[unit.kind].push(unit);
    }
    Object.keys(grouped).forEach((kind) => {
        const list = grouped[kind];
        while (list.length > want[kind]) bury(list.pop());
    });
    if (!base) return;
    Object.keys(want).forEach((kind) => {
        let got = 0;
        for (let i = 0; i < units.length; i++) {
            if (units[i].side === side && units[i].kind === kind && units[i].hp > 0) got++;
        }
        for (let n = got; n < want[kind]; n++) {
            const spot = musterAt(base, n, want[kind], workerKind(kind) ? 0 : 1);
            spawn(kind, spot.x, spot.z, side);
        }
    });
}

function syncSideBuildings(side, lines) {
    const want = wantedCounts(lines);
    const kinds = Object.keys(want);
    for (let k = 0; k < kinds.length; k++) {
        const kind = kinds[k];
        if (kind === "manor" || !BUILDINGS[kind] || !kits[kind]) continue;
        const need = Math.min(4, want[kind]);
        for (let i = sites.length - 1; i >= 0; i--) {
            if ((sites[i].side || "you") === side && sites[i].kind === kind) dropSite(sites[i]);
        }
        const owned = [];
        for (let i = 0; i < built.length; i++) {
            const entry = built[i];
            if (entry.preview || entry.kind !== kind || (entry.side || "you") !== side) continue;
            owned.push(entry);
        }
        while (owned.length > need) dropBuilding(owned.pop());
        for (let n = owned.length; n < need; n++) {
            if (!giftBuilding(side, kind)) break;
        }
    }
}

function applyCampaign(previous) {
    if (!home || !actors) return false;
    const mark = campaignMark();
    if (!mark || mark === "{}" || mark === previous) return false;
    ["you", "cpu"].forEach((side) => {
        if (side === "cpu" && !cpuHome) return;
        const row = factionRow(side);
        if (!row) return;
        const bag = stockBag(side);
        for (let i = 0; i < PAY.length; i++) {
            const key = PAY[i];
            if (Number.isFinite(Number(row[key]))) bag[key] = Number(row[key]);
        }
        writeBag(side, bag);
        syncSideUnits(side, row.units);
        syncSideBuildings(side, row.buildings);
    });
    appliedCampaign = mark;
    refreshHud();
    writeSave();
    return true;
}

window.addEventListener("storage", (event) => {
    if (event.key !== "aoe-dev-sheet") return;
    dropSheetCache();
    if (playTest) return;
    applyCampaign(appliedCampaign);
});

function standAt(node, unit) {
    if (node && node.kind === "farm" && node.farm) return farmStand(node.farm, unit);
    const ang = unit.id * 1.3;
    let r = (node.stand > 0 ? node.stand : node.r) + 1.2;
    let x = node.x + Math.cos(ang) * r;
    let z = node.z + Math.sin(ang) * r;
    if (node.kind === "food") {
        for (let i = 0; i < 30 && inWater(x, z); i++) {
            r += 2;
            x = node.x + Math.cos(ang) * r;
            z = node.z + Math.sin(ang) * r;
        }
    }
    return { x: x, z: z };
}

function edgeOf(cx, cz, hx, hz, fromX, fromZ) {
    let dx = fromX - cx;
    let dz = fromZ - cz;
    let len = Math.hypot(dx, dz);
    if (len < 0.01) {
        dx = 0;
        dz = 1;
        len = 1;
    }
    const ux = dx / len;
    const uz = dz / len;
    const tx = Math.abs(ux) > 0.0001 ? (hx + 1.4) / Math.abs(ux) : Infinity;
    const tz = Math.abs(uz) > 0.0001 ? (hz + 1.4) / Math.abs(uz) : Infinity;
    const t = Math.min(tx, tz);
    const x = cx + ux * t;
    const z = cz + uz * t;
    return { x: x, z: z, d: Math.hypot(fromX - x, fromZ - z) };
}

function dropAt(unit) {
    if (unit.jobNode && unit.jobNode.kind === "farm" && unit.jobNode.farm) {
        const farm = unit.jobNode.farm;
        const shift = ((unit.id % 5) - 2) * 0.7;
        return { x: farm.x + FARM_DROP.x + shift, z: farm.z + FARM_DROP.z };
    }
    const base = unit.side === "cpu" && cpuHome ? cpuHome : home;
    const dx = unit.x - base.x;
    const dz = unit.z - base.z;
    const len = Math.hypot(dx, dz) || 1;
    let bestX = base.x + (dx / len) * 16;
    let bestZ = base.z + (dz / len) * 16;
    let bestD = Math.hypot(unit.x - bestX, unit.z - bestZ);
    if (unit.side === "you" || unit.side === "cpu") {
        for (let i = 0; i < built.length; i++) {
            const yard = built[i];
            if (!DEPOTS[yard.kind] || (yard.side || "you") !== unit.side) continue;
            const spot = edgeOf(yard.x, yard.z, yard.hx, yard.hz, unit.x, unit.z);
            if (spot.d < bestD) {
                bestD = spot.d;
                bestX = spot.x;
                bestZ = spot.z;
            }
        }
    }
    return { x: bestX, z: bestZ };
}

function emptyHold() {
    const hold = {};
    for (let i = 0; i < GOODS.length; i++) hold[GOODS[i]] = 0;
    return hold;
}

function copyHold(hold) {
    const next = emptyHold();
    if (!hold) return next;
    for (let i = 0; i < GOODS.length; i++) next[GOODS[i]] = Math.max(0, Math.round(Number(hold[GOODS[i]]) || 0));
    return next;
}

function holdSum(hold) {
    if (!hold) return 0;
    let n = 0;
    for (let i = 0; i < GOODS.length; i++) n += hold[GOODS[i]] || 0;
    return n;
}

const GOOD_LABEL = { food: "food", wood: "wood", gold: "gold", stone: "stone", iron: "iron", salt: "salt", fabric: "fabrics" };

function carrySummary(list) {
    const totals = {};
    for (let i = 0; i < list.length; i++) {
        const unit = list[i];
        const n = Math.floor(unit.carry || 0);
        if (n < 1 || !unit.job || !GOOD_LABEL[unit.job]) continue;
        totals[unit.job] = (totals[unit.job] || 0) + n;
    }
    const bits = [];
    for (let i = 0; i < GOODS.length; i++) {
        const key = GOODS[i];
        if (totals[key]) bits.push(totals[key] + " " + GOOD_LABEL[key]);
    }
    return bits.length ? "carrying " + bits.join(", ") : "";
}

function holdLine(hold) {
    const bits = [];
    for (let i = 0; i < GOODS.length; i++) {
        const n = Math.floor(hold && hold[GOODS[i]] || 0);
        if (n > 0) bits.push(n + " " + GOOD_LABEL[GOODS[i]]);
    }
    return bits.length ? bits.join(", ") + " stored" : "nothing stored";
}

function sideFood(side) {
    return side === "cpu" ? cpuFood : food;
}

function takeFood(side, amount) {
    if (side === "cpu") cpuFood = Math.max(0, cpuFood - amount);
    else food = Math.max(0, food - amount);
}

function addGood(side, kind, n) {
    if (n <= 0 || GOODS.indexOf(kind) < 0) return;
    if (side === "cpu") {
        if (kind === "wood") cpuWood += n;
        else if (kind === "food") cpuFood += n;
        else if (kind === "gold") cpuGold += n;
        else if (kind === "stone") cpuStone += n;
        else if (kind === "iron") cpuIron += n;
        else if (kind === "salt") cpuSalt += n;
        else if (kind === "fabric") cpuFabric += n;
    } else if (kind === "wood") wood += n;
    else if (kind === "food") food += n;
    else if (kind === "gold") gold += n;
    else if (kind === "stone") stone += n;
    else if (kind === "iron") iron += n;
    else if (kind === "salt") salt += n;
    else if (kind === "fabric") fabric += n;
}

function depotUnder(unit) {
    const side = unit.side === "cpu" ? "cpu" : "you";
    for (let i = 0; i < built.length; i++) {
        const yard = built[i];
        if (!DEPOTS[yard.kind] || (yard.side || "you") !== side) continue;
        if (Math.abs(unit.x - yard.x) <= yard.hx + 3 && Math.abs(unit.z - yard.z) <= yard.hz + 3) return yard;
    }
    return null;
}

function depositCarry(unit) {
    const gained = Math.round(unit.carry);
    const job = unit.job;
    unit.carry = 0;
    if (gained <= 0 || !job) return;
    const yard = depotUnder(unit);
    if (yard) {
        if (!yard.hold) yard.hold = emptyHold();
        if (GOODS.indexOf(job) >= 0) yard.hold[job] = (yard.hold[job] || 0) + gained;
        return;
    }
    addGood(unit.side === "cpu" ? "cpu" : "you", job, gained);
}

function manorGate(yard) {
    const base = sideBase(yard.side || "you");
    if (!base) return { x: yard.x, z: yard.z + yard.hz + 4 };
    return edgeOf(base.x, base.z, base.hx || manorPad().hx, base.hz || manorPad().hz, yard.x, yard.z);
}

function yardGate(yard) {
    const base = sideBase(yard.side || "you");
    const fromX = base ? base.x : yard.x;
    const fromZ = base ? base.z : yard.z + yard.hz + 8;
    return edgeOf(yard.x, yard.z, yard.hx, yard.hz, fromX, fromZ);
}

function depotRows() {
    const kitsReady = Object.keys(kits).some((key) => kits[key]);
    if (!kitsReady) return (readSave() || {}).depots || [];
    const rows = [];
    for (let i = 0; i < built.length; i++) {
        const yard = built[i];
        if (!DEPOTS[yard.kind]) continue;
        const horse = yard.horse;
        rows.push({
            x: yard.x,
            z: yard.z,
            hold: copyHold(yard.hold),
            horseDead: !!yard.lostHorse,
            horseLeft: yard.horseLeft || 0,
            phase: horse ? horse.phase : "wait",
            hx: horse ? horse.x : yard.x,
            hz: horse ? horse.z : yard.z,
            yaw: horse ? horse.yaw : 0,
            hp: horse ? horse.hp : 0,
            cargo: horse ? copyHold(horse.cargo) : null
        });
    }
    return rows;
}

function loadHorse() {
    return new Promise((resolve) => {
        new GLTFLoader().load("../models/horse/horse.glb", (gltf) => {
            horseGltf = gltf;
            resolve();
        }, undefined, () => resolve());
    });
}

function spawnHorse(yard, saved) {
    if (!horseGltf || !yard || yard.horse) return;
    const model = cloneSkinned(horseGltf.scene);
    model.traverse((mesh) => {
        if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.frustumCulled = false;
        }
    });
    const mixer = new THREE.AnimationMixer(model);
    let idle = null;
    let trot = null;
    const clips = horseGltf.animations || [];
    for (let i = 0; i < clips.length; i++) {
        if (clips[i].name === "Idle") idle = mixer.clipAction(clips[i]);
        if (clips[i].name === "Trot") trot = mixer.clipAction(clips[i]);
    }
    if (idle) idle.play();
    const group = new THREE.Group();
    group.add(model);
    const sized = horseRow();
    const horseWide = sized && Number.isFinite(sized.w) ? sized.w : 0.63;
    const horseDeep = sized && Number.isFinite(sized.d) ? sized.d : 3.21;
    const gate = yardGate(yard);
    const x = saved && Number.isFinite(Number(saved.hx)) ? Number(saved.hx) : gate.x;
    const z = saved && Number.isFinite(Number(saved.hz)) ? Number(saved.hz) : gate.z;
    group.position.set(x, feetAt(x, z), z);
    scene.add(group);
    fitMapModel(model, horseWide / 2, horseDeep / 2);
    const phase = saved && (saved.phase === "out" || saved.phase === "back") ? saved.phase : "wait";
    const horse = {
        haul: true,
        yard: yard,
        side: yard.side || "you",
        x: x,
        z: z,
        yaw: saved ? Number(saved.yaw) || 0 : 0,
        hp: saved && Number(saved.hp) > 0 ? Number(saved.hp) : (sized && Number(sized.hp) > 0 ? Number(sized.hp) : HORSE_HP),
        alive: true,
        phase: phase,
        cargo: copyHold(saved && saved.cargo),
        stuck: 0,
        speed: 6.4,
        foot: Math.max(horseWide, horseDeep) / 2,
        id: nextId++,
        group: group,
        mixer: mixer,
        idle: idle,
        trot: trot,
        moving: false
    };
    group.rotation.y = horse.yaw;
    haulers.push(horse);
    yard.horse = horse;
    yard.lostHorse = false;
}

function bootHaulers() {
    const rows = haulSave && Array.isArray(haulSave.depots) ? haulSave.depots : [];
    const seen = [];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        let yard = null;
        let bestD = 3;
        for (let j = 0; j < built.length; j++) {
            const place = built[j];
            if (!DEPOTS[place.kind] || seen.indexOf(place) >= 0) continue;
            const d = Math.hypot(place.x - Number(row.x), place.z - Number(row.z));
            if (d < bestD) {
                bestD = d;
                yard = place;
            }
        }
        if (!yard) continue;
        seen.push(yard);
        yard.hold = copyHold(row.hold);
        yard.horseLeft = Math.max(0, Number(row.horseLeft) || 0);
        yard.lostHorse = !!row.horseDead;
        if (yard.horseLeft > 0 || yard.lostHorse) continue;
        spawnHorse(yard, row);
    }
    for (let i = 0; i < built.length; i++) {
        const yard = built[i];
        if (!DEPOTS[yard.kind] || yard.horse || yard.horseLeft > 0 || yard.lostHorse) continue;
        if (!yard.hold) yard.hold = emptyHold();
        spawnHorse(yard);
    }
}

function loseHorse(horse) {
    if (!horse || !horse.alive) return;
    horse.alive = false;
    horse.hp = 0;
    horse.cargo = emptyHold();
    horse.phase = "wait";
    if (horse.group) scene.remove(horse.group);
    const yard = horse.yard;
    if (yard) {
        yard.horse = null;
        yard.lostHorse = true;
    }
    const at = haulers.indexOf(horse);
    if (at >= 0) haulers.splice(at, 1);
    refreshHud();
}

function setHorseClip(horse, moving) {
    if (horse.moving === moving) return;
    horse.moving = moving;
    if (moving) {
        if (horse.idle) horse.idle.fadeOut(0.2);
        if (horse.trot) horse.trot.reset().fadeIn(0.2).play();
    } else {
        if (horse.trot) horse.trot.fadeOut(0.2);
        if (horse.idle) horse.idle.reset().fadeIn(0.2).play();
    }
}

function giveCargo(side, cargo) {
    for (let i = 0; i < GOODS.length; i++) addGood(side, GOODS[i], Math.round(cargo && cargo[GOODS[i]] || 0));
}

function dispatchHaul() {
    for (let i = 0; i < built.length; i++) {
        const yard = built[i];
        if (!DEPOTS[yard.kind]) continue;
        const horse = yard.horse;
        if (!horse || !horse.alive || horse.phase !== "wait") continue;
        if (holdSum(yard.hold) <= 0) continue;
        horse.cargo = copyHold(yard.hold);
        yard.hold = emptyHold();
        horse.phase = "out";
    }
}

function stepHaulers(dt) {
    const mark = Math.floor(dayMin / HAUL_MINUTES);
    if (haulMark < 0) haulMark = mark;
    else if (mark !== haulMark) {
        haulMark = mark;
        dispatchHaul();
    }
    for (let i = 0; i < haulers.length; i++) {
        const horse = haulers[i];
        if (!horse.alive) continue;
        if (horse.mixer) horse.mixer.update(dt);
        if (horse.phase === "wait") {
            setHorseClip(horse, false);
            continue;
        }
        const goal = horse.phase === "out" ? manorGate(horse.yard) : yardGate(horse.yard);
        const there = arrive(horse, goal, 2.2, dt);
        horse.group.position.y = feetAt(horse.x, horse.z);
        setHorseClip(horse, !there);
        if (!there) continue;
        if (horse.phase === "out") {
            giveCargo(horse.side, horse.cargo);
            horse.cargo = emptyHold();
            horse.phase = "back";
        } else horse.phase = "wait";
        refreshHud();
    }
    for (let i = 0; i < built.length; i++) {
        const yard = built[i];
        if (!(yard.horseLeft > 0)) continue;
        yard.horseLeft -= dt;
        if (selectedHouse === yard) {
            const shown = Math.ceil(yard.horseLeft);
            if (shown !== yard.horseShown) {
                yard.horseShown = shown;
                refreshHud();
            }
        }
        if (yard.horseLeft > 0) continue;
        yard.horseLeft = 0;
        yard.lostHorse = false;
        spawnHorse(yard);
        refreshHud();
    }
}

function trainHorse(yard) {
    if (!yard || !DEPOTS[yard.kind]) return;
    if (yard.horse && yard.horse.alive) return;
    if (yard.horseLeft > 0) return;
    const side = yard.side || "you";
    const bill = horseBill();
    if (!canPay(side, bill)) return;
    spend(side, bill);
    yard.horseLeft = HORSE_TIME;
    yard.lostHorse = true;
    refreshHud();
    writeSave();
}

function retrainHorses(side) {
    if (!horseGltf) return;
    for (let i = 0; i < built.length; i++) {
        const yard = built[i];
        if (!DEPOTS[yard.kind] || (yard.side || "you") !== side) continue;
        if (yard.horse && yard.horse.alive) continue;
        if (yard.horseLeft > 0) continue;
        if (!yard.lostHorse) {
            spawnHorse(yard);
            continue;
        }
        if (!canPay(side, horseBill())) continue;
        trainHorse(yard);
    }
}

function horseLine(yard) {
    if (yard.horseLeft > 0) {
        const secs = Math.max(0, Math.ceil(yard.horseLeft));
        return "training a horse · " + Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0");
    }
    const horse = yard.horse;
    if (!horse || !horse.alive) return "horse lost";
    const load = holdSum(horse.cargo);
    const carried = load > 0 ? " with " + load : "";
    if (horse.phase === "out") return "horse on the way to the manor" + carried;
    if (horse.phase === "back") return "horse coming back";
    return "horse waiting";
}

async function loadKit(id) {
    const meta = await fetch("../models/kitbuild/" + id + ".meta.json").then((res) => {
        if (!res.ok) throw new Error(id + " description missing");
        return res.json();
    });
    const parts = [];
    for (let i = 0; i < SHELL.length; i++) {
        const matName = SHELL[i][0];
        if (!(meta.materials || []).some((item) => item.mat === matName)) continue;
        const [buf, tex] = await Promise.all([
            fetch("../models/kitbuild/" + id + "-" + matName + ".bin").then((res) => {
                if (!res.ok) throw new Error("missing " + matName);
                return res.arrayBuffer();
            }),
            loadTexture(SHELL[i][1])
        ]);
        const mat = new THREE.MeshStandardMaterial({
            map: tex,
            vertexColors: true,
            roughness: 0.86,
            side: THREE.DoubleSide
        });
        parts.push({ geom: kitGeometry(new Float32Array(buf), meta.cx, meta.cz), mat: mat });
    }
    if (!parts.length) throw new Error(id + " has no outdoor shell");
    return parts;
}

async function loadKits() {
    const keys = Object.keys(BUILDINGS);
    await Promise.all(keys.map(async (key) => {
        if (BUILDINGS[key].mesh) {
            kits[key] = null;
            return;
        }
        try {
            kits[key] = await loadKit(BUILDINGS[key].id);
        } catch (err) {
            kits[key] = null;
        }
    }));
}

let smithGltf = null;

function loadSmith() {
    return new Promise((resolve) => {
        new GLTFLoader().load("../models/meshy/blacksmith.glb", (gltf) => {
            smithGltf = gltf;
            resolve();
        }, undefined, () => resolve());
    });
}

async function showBlacksmith() {
    if (!home) return;
    await loadSmith();
    if (!smithGltf) return;
    const spec = tuned("smith") || BUILDINGS.smith;
    let spot = null;
    for (let ring = 0; ring < 6 && !spot; ring++) {
        const dist = 34 + ring * 8;
        for (let i = 0; i < 10; i++) {
            const ang = (i - 4.5) * 0.28;
            const x = home.x + Math.sin(ang) * dist;
            const z = home.z - Math.cos(ang) * dist;
            if (spotOk(x, z, spec, home) === "") {
                spot = { x: x, z: z };
                break;
            }
        }
    }
    if (!spot) return;
    const model = smithGltf.scene.clone(true);
    model.traverse((mesh) => {
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
    });
    const group = new THREE.Group();
    group.add(model);
    const y = heightAt(spot.x, spot.z);
    group.position.set(spot.x, y, spot.z);
    scene.add(group);
    fitMapModel(model, spec.hx, spec.hz);
    const entry = { kind: "smith", side: "you", x: spot.x, z: spot.z, y: y, hx: spec.hx, hz: spec.hz, group: group, preview: true };
    group.userData.building = entry;
    model.traverse((mesh) => {
        mesh.userData.building = entry;
    });
    built.push(entry);
}

function shapeGround(cx, cz, targetY, hx, hz) {
    const skirt = 2.2;
    const blend = (x, z, hy) => {
        const dx = Math.abs(x - cx);
        const dz = Math.abs(z - cz);
        if (dx > hx + skirt || dz > hz + skirt) return hy;
        const ox = Math.max(0, dx - hx);
        const oz = Math.max(0, dz - hz);
        const t = 1 - Math.min(1, Math.hypot(ox, oz) / skirt);
        if (t <= 0) return hy;
        return hy + (targetY - hy) * t;
    };
    terrain.traverse((mesh) => {
        if (!mesh.isMesh || !mesh.geometry || !mesh.geometry.attributes.position) return;
        const pos = mesh.geometry.attributes.position;
        if (pos.count < 80) return;
        let changed = false;
        for (let i = 0; i < pos.count; i++) {
            const next = blend(pos.getX(i), pos.getZ(i), pos.getY(i));
            if (next === pos.getY(i)) continue;
            pos.setY(i, next);
            changed = true;
        }
        if (!changed) return;
        pos.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
        mesh.geometry.computeBoundingBox();
        mesh.geometry.computeBoundingSphere();
    });
    if (!board) return;
    const n = board.n;
    const h = board.heights;
    const i0 = Math.max(0, Math.floor(((cx - hx - skirt) - board.minX) / board.span * (n - 1)));
    const i1 = Math.min(n - 1, Math.ceil(((cx + hx + skirt) - board.minX) / board.span * (n - 1)));
    const j0 = Math.max(0, Math.floor(((cz - hz - skirt) - board.minZ) / board.span * (n - 1)));
    const j1 = Math.min(n - 1, Math.ceil(((cz + hz + skirt) - board.minZ) / board.span * (n - 1)));
    for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
            const x = board.minX + (i / (n - 1)) * board.span;
            const z = board.minZ + (j / (n - 1)) * board.span;
            const idx = j * n + i;
            h[idx] = blend(x, z, h[idx]);
        }
    }
}

function hitsWater(x, z, hx, hz) {
    if (board) return false;
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.kind !== "food") continue;
        const cx = Math.max(x - hx, Math.min(node.x, x + hx));
        const cz = Math.max(z - hz, Math.min(node.z, z + hz));
        if (Math.hypot(node.x - cx, node.z - cz) <= node.r + 0.2) return true;
    }
    return false;
}

function overlaps(ax, az, ahx, ahz, bx, bz, bhx, bhz) {
    return Math.abs(ax - bx) < ahx + bhx + 0.4 && Math.abs(az - bz) < ahz + bhz + 0.4;
}

function footGround(x, z, hx, hz) {
    const spots = [[0, 0], [hx, 0], [-hx, 0], [0, hz], [0, -hz], [hx, hz], [-hx, hz], [hx, -hz], [-hx, -hz]];
    let worst = 1;
    for (let i = 0; i < spots.length; i++) {
        const kind = coverAt(x + spots[i][0], z + spots[i][1]);
        if (kind === 0) return 0;
        if (kind === 3) worst = 3;
        else if (kind === 2 && worst === 1) worst = 2;
    }
    return worst;
}

function spotOk(x, z, spec, anchor) {
    const base = anchor || home;
    if (hitsWater(x, z, spec.hx + 2.2, spec.hz + 2.2)) return "water";
    if (hitsTree(x, z, spec.hx, spec.hz)) return "tree";
    if (board) {
        const ground = footGround(x, z, spec.hx, spec.hz);
        if (ground === 0) return "water";
        if (ground === 2) return "rock";
        if (ground === 3) return "snow";
    }
    if (!playTest && spec.town && base && Math.hypot(x - base.x, z - base.z) > TOWN_RANGE) return "far";
    const pads = [];
    if (home) pads.push(home);
    if (cpuHome) pads.push(cpuHome);
    for (let i = 0; i < pads.length; i++) {
        if (overlaps(x, z, spec.hx, spec.hz, pads[i].x, pads[i].z, pads[i].hx || manorPad().hx, pads[i].hz || manorPad().hz)) return "busy";
    }
    for (let i = 0; i < built.length; i++) {
        if (overlaps(x, z, spec.hx, spec.hz, built[i].x, built[i].z, built[i].hx, built[i].hz)) return "busy";
    }
    for (let i = 0; i < sites.length; i++) {
        if (overlaps(x, z, spec.hx, spec.hz, sites[i].x, sites[i].z, sites[i].hx, sites[i].hz)) return "busy";
    }
    return "";
}

function placeBuilding(kind, x, y, z, side) {
    const parts = kits[kind];
    const spec = tuned(kind) || BUILDINGS[kind];
    if (!parts || !spec) return;
    const mapUrl = mapGraphic(kind);
    const group = new THREE.Group();
    group.position.set(x, y, z);
    scene.add(group);
    manors.push(group);
    const entry = { kind: kind, side: side === "cpu" ? "cpu" : "you", x: x, z: z, y: y, hx: spec.hx, hz: spec.hz, group: group, kitId: spec.id };
    group.userData.building = entry;
    const shell = addKitShell(group, parts, entry);
    fitMapModel(shell, spec.hx, spec.hz);
    entry.fpModel = shell;
    shell.visible = !mapUrl;
    if (mapUrl) {
        attachMapModel(group, mapUrl, spec.hx, spec.hz, entry).catch(() => {
            shell.visible = true;
            seatFloors();
        });
    }
    if (kind === "farm") entry.node = { kind: "farm", x: x, z: z, farm: entry };
    if (DEPOTS[kind]) {
        entry.hold = emptyHold();
        entry.horseLeft = 0;
        entry.lostHorse = false;
    }
    built.push(entry);
    if (DEPOTS[kind] && horseGltf) spawnHorse(entry);
    attachRooms(entry, spec.id);
}

const INSIDE_MATS = [
    ["furniture", "../models/furniture.png"],
    ["propcloth", "../models/propcloth.png"],
    ["propmetal", "../models/propmetal.png"],
    ["proppack", "../models/proppack.png"]
];
const roomPlans = {};
let doorMat = null;

function doorMaterial() {
    if (!doorMat) doorMat = new THREE.MeshStandardMaterial({ color: 0x6d4b2c, roughness: 0.82 });
    return doorMat;
}

let doorLeafJob = null;
function ensureDoorLeaves() {
    if (!doorLeafJob) {
        doorLeafJob = Promise.all([
            loadGltf("../models/village-megakit/glTF/Door_1_Round.gltf"),
            loadGltf("../models/village-megakit/glTF/Door_1_Flat.gltf")
        ]).then((pair) => ({ round: pair[0], flat: pair[1] }));
    }
    return doorLeafJob;
}

function placedDoors(physics) {
    if (!physics || !physics.doors) return [];
    const cx = physics.cx;
    const cz = physics.cz;
    return physics.doors.map((raw) => {
        const yaw = raw.yaw || 0;
        const c = Math.cos(yaw);
        const s = Math.sin(yaw);
        return {
            hingeX: (raw.x - cx) - 0.51 * c,
            hingeZ: (raw.z - cz) + 0.51 * s,
            x: raw.x - cx,
            z: raw.z - cz,
            y: raw.y || 0,
            yaw: yaw,
            wide: 1.2,
            shape: raw.shape === "round" ? "round" : "flat",
            open: 0,
            want: false
        };
    });
}

function localSolids(physics) {
    if (!physics) return [];
    const cx = physics.cx;
    const cz = physics.cz;
    return (physics.solids || []).filter((sol) => !sol.stair && sol.y1 > 1.2 && sol.y0 < 1.3 && Math.min(sol.w, sol.d) < 0.8).map((sol) => ({
        x: sol.x - cx,
        z: sol.z - cz,
        w: sol.w,
        d: sol.d
    }));
}

function placeFloors(physics, shell) {
    if (!physics || !physics.floors) return [];
    const cx = physics.cx || 0;
    const cz = physics.cz || 0;
    const sy = shell ? shell.scale.y : 1;
    const lift = shell ? shell.position.y : 0;
    return physics.floors.filter((sol) => Number.isFinite(sol.y)).map((sol) => {
        const x = sol.x - cx;
        const z = sol.z - cz;
        const at = kitToGroup(shell, x, z);
        const far = kitToGroup(shell, x + sol.w, z + sol.d);
        return {
            x: Math.min(at.x, far.x),
            z: Math.min(at.z, far.z),
            w: Math.abs(far.x - at.x),
            d: Math.abs(far.z - at.z),
            y: lift + sol.y * sy
        };
    });
}

function addDoorLeaf(group, door, leaves) {
    const src = leaves && (door.shape === "round" ? leaves.round : leaves.flat);
    const pivot = new THREE.Group();
    pivot.position.set(door.hingeX, door.y || 0, door.hingeZ);
    pivot.rotation.y = door.yaw;
    if (src && src.scene) {
        const leaf = src.scene.clone(true);
        leaf.traverse((mesh) => {
            if (!mesh.isMesh) return;
            mesh.castShadow = false;
            mesh.frustumCulled = false;
        });
        pivot.add(leaf);
    } else {
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.15, 0.08), doorMaterial());
        leaf.position.set(0.53, 1.08, 0);
        pivot.add(leaf);
    }
    group.add(pivot);
    door.pivot = pivot;
    door.open = 0;
    door.want = false;
}

function readRooms(id) {
    if (!roomPlans[id]) {
        roomPlans[id] = Promise.all([
            fetch("../models/kitbuild/" + id + ".meta.json").then((res) => res.ok ? res.json() : null),
            fetch("../models/kitbuild/" + id + ".physics.json").then((res) => res.ok ? res.json() : null)
        ]).then((pair) => ({ meta: pair[0], physics: pair[1] })).catch(() => null);
    }
    return roomPlans[id];
}

function kitToGroup(shell, x, z) {
    if (!shell) return { x: x, z: z };
    return {
        x: shell.position.x + x * shell.scale.x,
        z: shell.position.z + z * shell.scale.z
    };
}

function attachRooms(entry, id) {
    entry.kitId = id;
    readRooms(id).then((plan) => {
        if (!plan) return;
        const host = entry.fpModel || entry.group;
        const doors = placedDoors(plan.physics);
        const solids = localSolids(plan.physics).map((sol) => {
            const at = kitToGroup(entry.fpModel, sol.x, sol.z);
            const far = kitToGroup(entry.fpModel, sol.x + sol.w, sol.z + sol.d);
            return { x: Math.min(at.x, far.x), z: Math.min(at.z, far.z), w: Math.abs(far.x - at.x), d: Math.abs(far.z - at.z) };
        });
        return ensureDoorLeaves().then((leaves) => {
            doors.forEach((door) => {
                addDoorLeaf(host, door, leaves);
                const at = kitToGroup(entry.fpModel, door.x, door.z);
                door.x = at.x;
                door.z = at.z;
            });
            entry.rooms = {
                meta: plan.meta,
                physics: plan.physics,
                solids: solids,
                floors: placeFloors(plan.physics, entry.fpModel),
                doors: doors,
                fit: entry.fpModel ? { x: entry.fpModel.position.x, z: entry.fpModel.position.z, sx: entry.fpModel.scale.x, sz: entry.fpModel.scale.z } : null
            };
        });
    }).catch(() => null);
}

function buildingInside(entry, x, z) {
    const physics = entry.rooms && entry.rooms.physics;
    if (!physics || !physics.shell) return false;
    const shell = physics.shell;
    const fit = entry.rooms.fit || { x: 0, z: 0, sx: 1, sz: 1 };
    const lx = x - entry.x;
    const lz = z - entry.z;
    const minX = fit.x + (shell.minX - physics.cx) * fit.sx;
    const minZ = fit.z + (shell.minZ - physics.cz) * fit.sz;
    const maxX = minX + shell.w * fit.sx;
    const maxZ = minZ + shell.d * fit.sz;
    return lx > Math.min(minX, maxX) + 0.45 && lx < Math.max(minX, maxX) - 0.45 && lz > Math.min(minZ, maxZ) + 0.45 && lz < Math.max(minZ, maxZ) - 0.45;
}

function blockedByBuilding(x, z) {
    const list = built.slice();
    if (home && home.rooms) list.push(home);
    if (cpuHome && cpuHome.rooms) list.push(cpuHome);
    for (let i = 0; i < list.length; i++) {
        const entry = list[i];
        if (!entry.rooms) continue;
        const lx = x - entry.x;
        const lz = z - entry.z;
        if (Math.abs(lx) > (entry.hx || MANOR_HX) + 2 && Math.abs(lz) > (entry.hz || MANOR_HZ) + 2) continue;
        const solids = entry.rooms.solids;
        for (let s = 0; s < solids.length; s++) {
            const sol = solids[s];
            if (lx > sol.x - 0.22 && lx < sol.x + sol.w + 0.22 && lz > sol.z - 0.22 && lz < sol.z + sol.d + 0.22) return true;
        }
        const doors = entry.rooms.doors;
        for (let d = 0; d < doors.length; d++) {
            const door = doors[d];
            if (door.open > 0.75) continue;
            if (Math.hypot(lx - door.x, lz - door.z) < door.wide * 0.5 + 0.2) return true;
        }
    }
    return false;
}

function ensureInterior(entry) {
    if (entry.insideGroup) {
        entry.insideGroup.visible = true;
        return;
    }
    if (entry.insideLoading || !entry.rooms || !entry.rooms.meta) return;
    entry.insideLoading = true;
    const id = entry.kitId;
    const meta = entry.rooms.meta;
    const group = new THREE.Group();
    (entry.fpModel || entry.group).add(group);
    entry.insideGroup = group;
    const jobs = [];
    for (let i = 0; i < INSIDE_MATS.length; i++) {
        const matName = INSIDE_MATS[i][0];
        if (!(meta.materials || []).some((item) => item.mat === matName)) continue;
        jobs.push(Promise.all([
            fetch("../models/kitbuild/" + id + "-" + matName + ".bin").then((res) => res.ok ? res.arrayBuffer() : null),
            loadTexture(INSIDE_MATS[i][1])
        ]).then((pair) => {
            if (!pair[0]) return;
            const mat = new THREE.MeshStandardMaterial({
                map: pair[1],
                vertexColors: true,
                roughness: 0.9,
                side: THREE.DoubleSide
            });
            group.add(new THREE.Mesh(kitGeometry(new Float32Array(pair[0]), meta.cx, meta.cz), mat));
        }));
    }
    Promise.all(jobs).then(() => {
        entry.insideLoading = false;
        if (!pilot) group.visible = false;
    }).catch(() => {
        entry.insideLoading = false;
    });
}

function activateDoor() {
    if (!pilot) return;
    const list = built.slice();
    if (home && home.rooms) list.push(home);
    if (cpuHome && cpuHome.rooms) list.push(cpuHome);
    let best = null;
    let bestD = 2.2;
    for (let i = 0; i < list.length; i++) {
        const entry = list[i];
        if (!entry.rooms || !entry.rooms.doors) continue;
        const doors = entry.rooms.doors;
        for (let d = 0; d < doors.length; d++) {
            const door = doors[d];
            const dist = Math.hypot(pilot.x - (entry.x + door.x), pilot.z - (entry.z + door.z));
            if (dist < bestD) {
                bestD = dist;
                best = door;
            }
        }
    }
    if (best) best.want = !best.want;
}

function stepRooms() {
    const list = built.slice();
    if (home) list.push(home);
    if (cpuHome) list.push(cpuHome);
    for (let i = 0; i < list.length; i++) {
        const entry = list[i];
        if (entry.mapModel) entry.mapModel.visible = !pilot;
        if (entry.fpModel) entry.fpModel.visible = !!pilot || !entry.mapModel;
        if (!entry.rooms) continue;
        const inside = !!(pilot && buildingInside(entry, pilot.x, pilot.z));
        let show = inside;
        const doors = entry.rooms.doors;
        for (let d = 0; d < doors.length; d++) {
            const door = doors[d];
            const target = door.want ? 1 : 0;
            door.open += (target - door.open) * 0.25;
            if (door.pivot) door.pivot.rotation.y = door.yaw + door.open * 1.35;
            if (door.open > 0.35) show = true;
        }
        if (pilot && show) ensureInterior(entry);
        else if (entry.insideGroup) entry.insideGroup.visible = false;
    }
}

function addFoundation(site) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(site.hx * 2, 0.18, site.hz * 2), padMat);
    mark.position.set(site.x, site.y + 0.1, site.z);
    scene.add(mark);
    site.mark = mark;
}

function finishSite(site) {
    const index = sites.indexOf(site);
    if (index >= 0) sites.splice(index, 1);
    if (site.mark) {
        scene.remove(site.mark);
        site.mark = null;
    }
    placeBuilding(site.kind, site.x, site.y, site.z, site.side);
    seatFloors();
    refreshLand(true);
    refreshHud();
    writeSave();
}

function stepSites(dt) {
    for (let i = sites.length - 1; i >= 0; i--) {
        sites[i].left -= dt;
        if (sites[i].left <= 0) finishSite(sites[i]);
    }
}

function restoreHouses(save) {
    const done = Array.isArray(save.houses) ? save.houses : [];
    const waiting = Array.isArray(save.pending) ? save.pending : [];
    for (let i = 0; i < done.length; i++) {
        const row = done[i];
        const kind = BUILDINGS[row.kind] ? row.kind : "house";
        const spec = BUILDINGS[kind];
        const x = Number(row.x);
        const z = Number(row.z);
        const y = Number(row.y);
        if (!kits[kind] || !Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(y)) continue;
        placeBuilding(kind, x, y, z, row.side);
    }
    for (let i = 0; i < waiting.length; i++) {
        const row = waiting[i];
        const kind = BUILDINGS[row.kind] ? row.kind : "house";
        const spec = BUILDINGS[kind];
        const x = Number(row.x);
        const z = Number(row.z);
        const y = Number(row.y);
        if (!kits[kind] || !Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(y)) continue;
        const site = { kind: kind, side: row.side === "cpu" ? "cpu" : "you", x: x, z: z, y: y, hx: spec.hx, hz: spec.hz, left: Math.max(0, Number(row.left) || 0), mark: null };
        addFoundation(site);
        sites.push(site);
    }
    linkFarms();
    settleBeds();
}

function cancelPlace() {
    placing = null;
    placingUnit = null;
    ghost.visible = false;
    townRing.visible = false;
    refreshHud();
}

function bankCarry(unit) {
    const gained = Math.round(unit.carry);
    if (gained > 0) {
        const stock = unit.side === "cpu";
        if (unit.job === "wood") stock ? cpuWood += gained : wood += gained;
        if (unit.job === "food") stock ? cpuFood += gained : food += gained;
        if (unit.job === "gold") stock ? cpuGold += gained : gold += gained;
        if (unit.job === "stone") stock ? cpuStone += gained : stone += gained;
    }
    unit.carry = 0;
    unit.job = null;
    unit.jobNode = null;
}

function nearestBuilder(x, z) {
    const picked = selected.filter((unit) => unit.side === led && workerKind(unit.kind) && unit !== pilot);
    const pool = picked.length ? picked : units.filter((unit) => unit.side === led && workerKind(unit.kind) && unit !== pilot);
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < pool.length; i++) {
        const d = Math.hypot(pool[i].x - x, pool[i].z - z);
        if (d < bestD) {
            bestD = d;
            best = pool[i];
        }
    }
    return best;
}

function tryPlace(x, z) {
    const spec = tuned(placing);
    if (playTest && spec && kits[placing]) {
        const why = spotOk(x, z, spec, sideBase(led));
        if (why === "water") {
            selEl.textContent = "Not on water.";
            return;
        }
        if (why === "rock") {
            selEl.textContent = "Buildings stay off the rock.";
            return;
        }
        if (why === "tree") {
            selEl.textContent = "Not on a tree.";
            return;
        }
        if (why === "snow") {
            selEl.textContent = "Not on the snow.";
            return;
        }
        if (why === "far") {
            selEl.textContent = "Too far from the manor.";
            return;
        }
        if (why) {
            selEl.textContent = "Too close to a building.";
            return;
        }
        placeBuilding(placing, x, heightAt(x, z), z, led);
        seatFloors();
        refreshHud();
        writeSave();
        selEl.textContent = (spec.label || "Building") + " is down for " + teamName(led) + ". Click again, or right-click to stop.";
        return;
    }
    const bill = buildingBill(placing);
    if (!spec || !kits[placing] || !canPay(led, bill)) {
        selEl.textContent = (spec ? spec.label : "That building") + " needs " + billText(bill) + ".";
        return;
    }
    const why = spotOk(x, z, spec, sideBase(led));
    if (why === "water") {
        selEl.textContent = "Not on water.";
        return;
    }
    if (why === "rock") {
        selEl.textContent = "Buildings stay off the rock.";
        return;
    }
    if (why === "tree") {
        selEl.textContent = "Not on a tree.";
        return;
    }
    if (why === "snow") {
        selEl.textContent = "Not on the snow.";
        return;
    }
    if (why === "far") {
        selEl.textContent = "Too far from your manor.";
        return;
    }
    if (why) {
        selEl.textContent = "Too close to a building.";
        return;
    }
    const y = heightAt(x, z);
    spend(led, bill);
    const site = { kind: placing, side: led, x: x, z: z, y: y, hx: spec.hx, hz: spec.hz, left: spec.time, mark: null };
    addFoundation(site);
    sites.push(site);
    seatFloors();
    refreshLand(true);
    const builder = nearestBuilder(x, z);
    if (builder) {
        bankCarry(builder);
        builder.goal = { x: x, z: z + spec.hz + 1.3 };
        builder.state = "move";
    }
    cancelPlace();
    refreshHud();
    writeSave();
}

function putDownUnit(x, z) {
    const unit = spawn(placingUnit, x, z, led);
    if (!unit) return;
    if (militaryKind(unit.kind)) {
        unit.stance = "guard";
        unit.post = { x: x, z: z };
    }
    refreshHud();
    writeSave();
    const row = unitRow(placingUnit);
    selEl.textContent = (row.name || placingUnit) + " is down for " + teamName(led) + ". Click again, or right-click to stop.";
}

function moveGhost(event) {
    if (placingUnit) {
        const point = groundAt(event);
        if (!point) {
            ghost.visible = false;
            return;
        }
        ghost.visible = true;
        ghost.position.set(point.x, heightAt(point.x, point.z) + 0.16, point.z);
        ghost.material.color.setHex(0x6dbf4a);
        return;
    }
    if (!placing) return;
    const spec = tuned(placing);
    const point = groundAt(event);
    if (!point || !spec) {
        ghost.visible = false;
        return;
    }
    ghost.visible = true;
    ghost.position.set(point.x, heightAt(point.x, point.z) + 0.16, point.z);
    ghost.material.color.setHex(canPay(led, buildingBill(placing)) && spotOk(point.x, point.z, spec) === "" ? 0x6dbf4a : 0xc4513a);
}

function gatherNode(node) {
    if (!node) return false;
    if (!board) return true;
    if (node.kind === "wood") return !!node.tree;
    if (node.kind === "food") return !!node.shore;
    if (node.kind === "gold" || node.kind === "stone") return !!node.mine;
    return true;
}

function nearestOfKind(x, z, kind) {
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.kind !== kind || !gatherNode(node)) continue;
        const d = Math.hypot(node.x - x, node.z - z);
        if (d < bestD) {
            bestD = d;
            best = node;
        }
    }
    return best;
}

function sendToNode(unit, node) {
    unit.job = node.kind;
    unit.jobNode = node;
    unit.goal = standAt(node, unit);
    unit.state = "goto";
}

let cpuThink = 0;
let cpuWar = false;

function sideBase(side) {
    return side === "cpu" ? cpuHome : home;
}

function sideWood(side) {
    return side === "cpu" ? cpuWood : wood;
}

function takeWood(side, amount) {
    if (side === "cpu") cpuWood = Math.max(0, cpuWood - amount);
    else wood = Math.max(0, wood - amount);
}

function ownedCount(list, kind, side) {
    let n = 0;
    for (let i = 0; i < list.length; i++) {
        if ((list[i].side || "you") !== side) continue;
        if (!kind || list[i].kind === kind) n++;
    }
    return n;
}

function sideBusy(side) {
    for (let i = 0; i < sites.length; i++) if ((sites[i].side || "you") === side) return true;
    return false;
}

function ringSpot(origin, spec, base, start, rings) {
    const angles = 10;
    for (let ring = 0; ring < rings; ring++) {
        const dist = start + ring * 6;
        for (let i = 0; i < angles; i++) {
            const ang = i / angles * Math.PI * 2 + ring * 0.5;
            const x = origin.x + Math.cos(ang) * dist;
            const z = origin.z + Math.sin(ang) * dist;
            if (spotOk(x, z, spec, base) === "") return { x: x, z: z };
        }
    }
    return null;
}

function townEdge(base, anchor) {
    const dx = anchor.x - base.x;
    const dz = anchor.z - base.z;
    const len = Math.hypot(dx, dz) || 1;
    const dist = Math.max(20, TOWN_RANGE - 12);
    return { x: base.x + (dx / len) * dist, z: base.z + (dz / len) * dist };
}

function besideNode(base, node, spec) {
    const dx = base.x - node.x;
    const dz = base.z - node.z;
    const len = Math.hypot(dx, dz) || 1;
    const gap = (node.r || 2) + Math.max(spec.hx, spec.hz) + 4;
    const ang0 = Math.atan2(dz, dx);
    for (let i = 0; i < 10; i++) {
        const ang = ang0 + (i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.35);
        const x = node.x + Math.cos(ang) * gap;
        const z = node.z + Math.sin(ang) * gap;
        if (spotOk(x, z, spec, base) === "") return { x: x, z: z };
    }
    return null;
}

function farGather(base) {
    let best = null;
    let bestD = 48;
    const kinds = ["wood", "food", "gold", "stone"];
    for (let i = 0; i < kinds.length; i++) {
        const node = nearestOfKind(base.x, base.z, kinds[i]);
        if (!node) continue;
        const d = Math.hypot(node.x - base.x, node.z - base.z);
        if (d > bestD) {
            bestD = d;
            best = node;
        }
    }
    return best;
}

function cpuWorks() {
    for (let i = 0; i < built.length; i++) {
        if (built[i].kind === "salt" && (built[i].side || "you") === "cpu") return built[i];
    }
    return null;
}

function sidePlace(side, kind, prefer) {
    const spec = tuned(kind);
    const base = sideBase(side);
    const bill = buildingBill(kind);
    if (!spec || !kits[kind] || !base || !canPay(side, bill)) return false;
    if (side === "you" && placing) return false;
    let spot = null;
    if (prefer) {
        const gap = Math.max(spec.hx, spec.hz) + Math.max(prefer.hx || 0, prefer.hz || 0) + 4;
        if (spotOk(prefer.x, prefer.z, spec, base) === "") spot = { x: prefer.x, z: prefer.z };
        else spot = ringSpot(prefer, spec, base, gap, 8);
        if (!spot && spec.town) spot = ringSpot(townEdge(base, prefer), spec, base, 8, 5);
    } else if (kind === "salt") {
        const node = nearestOfKind(base.x, base.z, "wood") || nearestOfKind(base.x, base.z, "gold");
        if (node) spot = besideNode(base, node, spec);
    } else {
        const rings = kind === "house" ? Math.ceil((TOWN_RANGE - 24) / 8) + 1 : 4;
        const angles = kind === "house" ? 12 : 8;
        for (let ring = 0; ring < rings && !spot; ring++) {
            const dist = 24 + ring * 8;
            if (spec.town && dist > TOWN_RANGE - 4) break;
            for (let i = 0; i < angles; i++) {
                const ang = i * Math.PI * 2 / angles + ring;
                const x = base.x + Math.cos(ang) * dist;
                const z = base.z + Math.sin(ang) * dist;
                if (spotOk(x, z, spec, base) === "") {
                    spot = { x: x, z: z };
                    break;
                }
            }
        }
    }
    if (!spot) return false;
    spend(side, bill);
    const y = heightAt(spot.x, spot.z);
    const site = { kind: kind, side: side, x: spot.x, z: spot.z, y: y, hx: spec.hx, hz: spec.hz, left: spec.time, mark: null };
    addFoundation(site);
    sites.push(site);
    seatFloors();
    refreshLand(true);
    let builder = null;
    let bestD = Infinity;
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (unit.side !== side || !workerKind(unit.kind) || unit.orders) continue;
        const d = Math.hypot(unit.x - spot.x, unit.z - spot.z);
        if (d < bestD) {
            bestD = d;
            builder = unit;
        }
    }
    if (builder) {
        bankCarry(builder);
        builder.goal = { x: spot.x, z: spot.z + spec.hz + 1.3 };
        builder.state = "move";
    }
    refreshHud();
    writeSave();
    return true;
}

function marchCpu() {
    if (!home) return;
    const movers = [];
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (unit.side !== "cpu" || !militaryKind(unit.kind)) continue;
        if (unit.state !== "idle" && unit.state !== "back") continue;
        unit.stance = "attack";
        if (Math.hypot(unit.x - home.x, unit.z - home.z) > 70) movers.push(unit);
    }
    if (!movers.length) return;
    const point = { x: home.x, z: home.z + 22 };
    const slots = movers.length > 1 ? formationGoals(movers, point) : null;
    for (let i = 0; i < movers.length; i++) {
        const unit = movers[i];
        unit.targetId = null;
        unit.job = null;
        unit.jobNode = null;
        unit.goal = slots ? slots.get(unit) : point;
        unit.state = "move";
    }
}

function sendSideWork(unit, kind, yard, base) {
    if (kind === "food" && yard) {
        if (unit.carry > 0.2 && unit.state !== "return") bankCarry(unit);
        sendToFarm([unit], yard);
        if (unit.job === "food") return true;
    }
    let node = nearestOfKind(unit.x, unit.z, kind) || nearestOfKind(base.x, base.z, kind);
    if (!node && kind !== "wood") {
        kind = "wood";
        node = nearestOfKind(unit.x, unit.z, kind) || nearestOfKind(base.x, base.z, kind);
    }
    if (!node) return false;
    if (unit.carry > 0.2 && unit.state !== "return") bankCarry(unit);
    sendToNode(unit, node);
    return true;
}

function nightTime() {
    const hour = Math.floor(dayMin / 60) % 24;
    return hour >= 21 || hour < 5;
}

function formatClock() {
    const total = ((dayMin % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    const h24 = Math.floor(total / 60);
    const minute = Math.floor(total % 60);
    let h = h24 % 12;
    if (h === 0) h = 12;
    return h + ":" + String(minute).padStart(2, "0") + (h24 < 12 ? " am" : " pm");
}

function paintClock() {
    const el = document.getElementById("clock");
    if (el) el.textContent = formatClock();
}

function houseMates(house) {
    let n = 0;
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (unit.shelter === house && (unit.state === "inside" || unit.state === "home")) n++;
    }
    return n;
}

function indoorPoint(house, index) {
    const cols = 5;
    const rows = 4;
    const col = index % cols;
    const row = Math.floor(index / cols) % rows;
    return {
        x: house.x + ((col + 0.5) / cols - 0.5) * house.hx * 1.4,
        z: house.z + ((row + 0.5) / rows - 0.5) * house.hz * 1.4
    };
}

function bedIndex(house, unit) {
    let n = 0;
    for (let i = 0; i < units.length; i++) {
        const other = units[i];
        if (other.shelter === house && (other.state === "inside" || other.state === "home") && other.id < unit.id) n++;
    }
    return n;
}

function nearestBed(unit) {
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < built.length; i++) {
        const house = built[i];
        if (house.kind !== "house" || (house.side || "you") !== unit.side) continue;
        if (houseMates(house) >= HOUSE_BEDS) continue;
        const d = Math.hypot(house.x - unit.x, house.z - unit.z);
        if (d < bestD) {
            bestD = d;
            best = house;
        }
    }
    return best;
}

function tuckIn(unit) {
    const house = unit.shelter;
    if (!house) return;
    const spot = unit.goal ? { x: unit.goal.x, z: unit.goal.z } : indoorPoint(house, bedIndex(house, unit));
    unit.x = spot.x;
    unit.z = spot.z;
    unit.goal = null;
    unit.job = null;
    unit.jobNode = null;
    unit.targetId = null;
    unit.orders = false;
    unit.state = "inside";
    unit.group.position.x = spot.x;
    unit.group.position.z = spot.z;
    unit.group.visible = !!pilot;
    const at = selected.indexOf(unit);
    if (at >= 0) {
        selected.splice(at, 1);
        unit.ring.visible = false;
    }
    if (selectedHouse === house) refreshHud();
}

function wake(unit) {
    const house = unit.shelter;
    unit.shelter = null;
    unit.state = "idle";
    unit.job = null;
    unit.jobNode = null;
    unit.goal = null;
    unit.orders = false;
    unit.group.visible = true;
    if (!house) return;
    const ang = (unit.id % HOUSE_BEDS) / HOUSE_BEDS * Math.PI * 2;
    const reach = Math.max(house.hx, house.hz) + 1.8;
    unit.x = house.x + Math.cos(ang) * reach;
    unit.z = house.z + Math.sin(ang) * reach;
    unit.group.position.x = unit.x;
    unit.group.position.z = unit.z;
}

function sendSleepers(side) {
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (unit.side !== side || !workerKind(unit.kind) || unit.hp <= 0 || unit.dying > 0) continue;
        if (unit.state === "inside" || unit.state === "home") continue;
        const house = nearestBed(unit);
        if (!house) continue;
        if (unit.carry > 0.2) bankCarry(unit);
        const index = houseMates(house);
        unit.job = null;
        unit.jobNode = null;
        unit.targetId = null;
        unit.orders = false;
        unit.shelter = house;
        unit.state = "home";
        unit.goal = indoorPoint(house, index);
    }
}

function wakeAll() {
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (unit.state === "inside" || unit.state === "home") wake(unit);
    }
    if (selectedHouse) refreshHud();
}

function settleBeds() {
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        const saved = unit.bedSave;
        if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.z)) continue;
        unit.bedSave = null;
        let house = null;
        let bestD = 6;
        for (let j = 0; j < built.length; j++) {
            const place = built[j];
            if (place.kind !== "house") continue;
            const d = Math.hypot(place.x - saved.x, place.z - saved.z);
            if (d < bestD) {
                bestD = d;
                house = place;
            }
        }
        if (!house) continue;
        unit.shelter = house;
        if (saved.inside) tuckIn(unit);
        else {
            unit.state = "home";
            unit.goal = indoorPoint(house, bedIndex(house, unit));
        }
    }
}

function stepClock(dt) {
    const asleep = nightTime();
    dayMin = (dayMin + dt) % DAY_MINUTES;
    if (dayMin < 0) dayMin += DAY_MINUTES;
    paintClock();
    if (nightTime()) {
        sendSleepers("you");
        sendSleepers("cpu");
    } else if (asleep) wakeAll();
}

function insideText(house) {
    let n = 0;
    for (let i = 0; i < units.length; i++) {
        if (units[i].state === "inside" && units[i].shelter === house) n++;
    }
    if (n === 1) return "1 worker inside";
    return n + " workers inside";
}

function stepSide(side) {
    const base = sideBase(side);
    if (!base) return;
    if (nightTime()) return;
    let yard = null;
    for (let i = 0; i < built.length; i++) {
        if (built[i].kind === "farm" && (built[i].side || "you") === side) yard = built[i];
    }
    const open = [];
    const held = [];
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (unit.side !== side || !workerKind(unit.kind) || unit === pilot || unit.orders) continue;
        if (unit.state === "inside" || unit.state === "home") continue;
        if (unit.state === "move" || unit.state === "return" || unit.state === "goto" || unit.state === "gather") held.push(unit);
        else open.push(unit);
    }
    const workers = open.length + held.length;
    const jobs = [];
    let foodShare = 0.35;
    let woodShare = 0.4;
    if (side === "cpu") {
        const bag = stockBag(side);
        if ((bag.wood || 0) < 120) woodShare = 0.55;
        if ((bag.food || 0) < 80) foodShare = 0.4;
    }
    const foodNeed = Math.max(2, Math.round(workers * foodShare));
    const woodNeed = Math.max(2, Math.round(workers * woodShare));
    for (let i = 0; i < foodNeed; i++) jobs.push("food");
    for (let i = 0; i < woodNeed; i++) jobs.push("wood");
    const hasStone = nodes.some((node) => node.kind === "stone" && gatherNode(node));
    let spareJob = 0;
    while (jobs.length < workers) {
        jobs.push(hasStone && spareJob % 2 === 1 ? "stone" : "gold");
        spareJob++;
    }
    for (let i = 0; i < held.length; i++) {
        const at = jobs.indexOf(held[i].job);
        if (at >= 0) jobs.splice(at, 1);
    }
    const spare = [];
    for (let i = 0; i < open.length; i++) {
        const at = jobs.indexOf(open[i].job);
        if (at >= 0) jobs.splice(at, 1);
        else spare.push(open[i]);
    }
    for (let i = 0; i < jobs.length && i < spare.length; i++) sendSideWork(spare[i], jobs[i], yard, base);
    if (side === "cpu") {
        cpuBuild(base);
        return;
    }
    let placed = false;
    if (!sideBusy(side)) {
        if (canPay(side, buildingBill("house"))) placed = sidePlace(side, "house");
        if (!placed && ownedCount(built, "farm", side) + ownedCount(sites, "farm", side) < 1 && canPay(side, buildingBill("farm")) && workers >= 4) placed = sidePlace(side, "farm");
        if (!placed && ownedCount(built, "salt", side) + ownedCount(sites, "salt", side) < 1 && canPay(side, buildingBill("salt")) && workers >= 4) placed = sidePlace(side, "salt");
    }
    if (!placed && canPay(side, unitBill("worker")) && housed(side, "worker")) trainFor(side, "worker", true);
}

function cpuBuild(base) {
    const people = roleCount("cpu", false) + roleQueued("cpu", false);
    const houses = ownedCount(built, "house", "cpu") + ownedCount(sites, "house", "cpu");
    let wantHouses = Math.max(1, Math.ceil((people + 4) / HOUSE_BEDS));
    if (people >= roomFor("cpu", "worker") - 1) wantHouses = Math.max(wantHouses, houses + 1);
    wantHouses = Math.min(6, wantHouses);
    let placed = false;
    if (!sideBusy("cpu")) {
        if (houses < wantHouses && canPay("cpu", buildingBill("house"))) {
            const works = cpuWorks();
            const camp = works && Math.hypot(works.x - base.x, works.z - base.z) > 36 ? works : null;
            placed = sidePlace("cpu", "house", houses >= 1 && camp ? camp : null);
        }
        const far = farGather(base);
        const salts = ownedCount(built, "salt", "cpu") + ownedCount(sites, "salt", "cpu");
        if (!placed && far && salts < 1 && people >= 4 && canPay("cpu", buildingBill("salt"))) {
            const spec = tuned("salt");
            placed = sidePlace("cpu", "salt", spec ? besideNode(base, far, spec) : null);
        }
        const farms = ownedCount(built, "farm", "cpu") + ownedCount(sites, "farm", "cpu");
        if (!placed && farms < 1 && people >= 4 && canPay("cpu", buildingBill("farm"))) placed = sidePlace("cpu", "farm");
        const barracks = ownedCount(built, "barracks", "cpu") + ownedCount(sites, "barracks", "cpu");
        if (!placed && barracks < 1 && people >= 8 && houses >= 1 && canPay("cpu", buildingBill("barracks"))) placed = sidePlace("cpu", "barracks");
    }
    const soldiers = roleCount("cpu", true) + roleQueued("cpu", true);
    const barracksUp = ownedCount(built, "barracks", "cpu") > 0;
    if (barracksUp && people >= 8 && soldiers < 8 && soldiers < Math.floor(people / 2) && housed("cpu", "soldier")) trainFor("cpu", "soldier", true);
    else if (housed("cpu", "worker")) trainFor("cpu", "worker", true);
    if (soldiers >= 6) cpuWar = true;
}

function stepCpu(dt) {
    if (!actors) return;
    cpuThink += dt;
    if (cpuThink < 1.5) return;
    cpuThink = 0;
    stepSide("you");
    stepSide("cpu");
    if (cpuWar) marchCpu();
    retrainHorses("cpu");
}

function farmAt(x, z) {
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < built.length; i++) {
        const farm = built[i];
        if (farm.kind !== "farm") continue;
        if (Math.abs(x - farm.x) > farm.hx + 1.2 || Math.abs(z - farm.z) > farm.hz + 1.2) continue;
        const d = Math.hypot(x - farm.x, z - farm.z);
        if (d < bestD) {
            bestD = d;
            best = farm;
        }
    }
    return best;
}

function farmStand(farm, unit) {
    const mates = [];
    for (let i = 0; i < units.length; i++) {
        if (units[i].jobNode && units[i].jobNode.farm === farm) mates.push(units[i]);
    }
    mates.sort((a, b) => a.id - b.id);
    let index = mates.indexOf(unit);
    if (index < 0) index = mates.length;
    const slot = FARM_SLOTS[Math.min(index, FARM_SLOTS.length - 1)];
    return { x: farm.x + slot.x, z: farm.z + slot.z };
}

function linkFarms() {
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (!unit.jobNode || unit.jobNode.kind !== "farm" || unit.jobNode.farm) continue;
        let farm = null;
        let bestD = 2;
        for (let j = 0; j < built.length; j++) {
            const yard = built[j];
            if (yard.kind !== "farm") continue;
            const d = Math.hypot(yard.x - unit.jobNode.x, yard.z - unit.jobNode.z);
            if (d < bestD) {
                bestD = d;
                farm = yard;
            }
        }
        if (farm) unit.jobNode = farm.node;
        else {
            unit.jobNode = null;
            unit.job = null;
            if (unit.state === "goto" || unit.state === "gather" || unit.state === "return") unit.state = "idle";
        }
    }
}

function sendToFarm(workers, farm) {
    let n = 0;
    const already = [];
    for (let i = 0; i < units.length; i++) {
        if (units[i].jobNode && units[i].jobNode.farm === farm) {
            n++;
            already.push(units[i]);
        }
    }
    let turnedAway = false;
    for (let i = 0; i < workers.length; i++) {
        const unit = workers[i];
        if (already.indexOf(unit) >= 0) continue;
        if (n >= FARM_SLOTS.length) {
            turnedAway = true;
            continue;
        }
        n++;
        unit.job = "food";
        unit.jobNode = farm.node;
        if (unit.carry >= CARRY_MAX) {
            unit.goal = dropAt(unit);
            unit.state = "return";
        } else {
            unit.goal = farmStand(farm, unit);
            unit.state = "goto";
        }
    }
    return turnedAway;
}

function nearestNode(x, z) {
    let best = null;
    let bestD = 3.5;
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!gatherNode(node)) continue;
        const d = Math.hypot(node.x - x, node.z - z) - node.r;
        if (d < bestD) {
            bestD = d;
            best = node;
        }
    }
    return best;
}

function addWoodSpot(x, z, scale) {
    nodes.push({
        kind: "wood",
        x: x,
        z: z,
        r: 8,
        stand: 1.5 * (scale || 1),
        tree: true
    });
}

function hitsTree(x, z, hx, hz) {
    for (let i = 0; i < treeSpots.length; i++) {
        const tree = treeSpots[i];
        if (!tree.wood) continue;
        const reach = 2.2 * (tree.scale || 1);
        const cx = Math.max(x - hx, Math.min(tree.x, x + hx));
        const cz = Math.max(z - hz, Math.min(tree.z, z + hz));
        if (Math.hypot(tree.x - cx, tree.z - cz) <= reach + 0.3) return true;
    }
    return false;
}

function addShoreFood() {
    if (!board) return;
    const n = board.n;
    const step = 8;
    const made = [];
    for (let j = step; j < n - step; j += step) {
        for (let i = step; i < n - step; i += step) {
            if (board.heights[j * n + i] >= BOARD_SEA) continue;
            let landI = -1;
            let landJ = -1;
            const near = [[step, 0], [-step, 0], [0, step], [0, -step]];
            for (let k = 0; k < near.length; k++) {
                const ii = i + near[k][0];
                const jj = j + near[k][1];
                if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
                if (board.heights[jj * n + ii] >= BOARD_SEA + 0.4) {
                    landI = ii;
                    landJ = jj;
                    break;
                }
            }
            if (landI < 0) continue;
            const x = board.minX + (landI / (n - 1)) * board.span;
            const z = board.minZ + (landJ / (n - 1)) * board.span;
            let close = false;
            for (let m = 0; m < made.length; m++) {
                if (Math.hypot(made[m].x - x, made[m].z - z) < 22) {
                    close = true;
                    break;
                }
            }
            if (close) continue;
            const node = { kind: "food", x: x, z: z, r: 8, stand: 1.4, shore: true };
            made.push(node);
            nodes.push(node);
        }
    }
}

function shoreBeside(x, z) {
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!node.shore) continue;
        const d = Math.hypot(node.x - x, node.z - z);
        if (d < bestD) {
            bestD = d;
            best = node;
        }
    }
    if (best && bestD < 80) return best;
    let cx = x;
    let cz = z;
    for (let n = 0; n < 24; n++) {
        let high = boardHeight(cx, cz);
        let nx = cx;
        let nz = cz;
        let moved = false;
        for (let a = 0; a < 8; a++) {
            const ang = a * Math.PI / 4;
            const tx = cx + Math.cos(ang) * 6;
            const tz = cz + Math.sin(ang) * 6;
            const h = boardHeight(tx, tz);
            if (h > high) {
                high = h;
                nx = tx;
                nz = tz;
                moved = true;
            }
        }
        cx = nx;
        cz = nz;
        if (!inWater(cx, cz)) {
            const node = { kind: "food", x: cx, z: cz, r: 6, stand: 1.2, shore: true };
            nodes.push(node);
            return node;
        }
        if (!moved) break;
    }
    return best;
}

function footRadius(thing) {
    if (thing && Number.isFinite(thing.foot) && thing.foot > 0) return thing.foot;
    return 0.4;
}

function peopleBlock(unit, x, z) {
    const need = footRadius(unit);
    for (let i = 0; i < units.length; i++) {
        const other = units[i];
        if (other === unit || other.hp <= 0 || other.state === "inside") continue;
        if (Math.hypot(other.x - x, other.z - z) < need + footRadius(other)) return true;
    }
    for (let i = 0; i < haulers.length; i++) {
        const other = haulers[i];
        if (other === unit || !other.alive) continue;
        if (Math.hypot(other.x - x, other.z - z) < need + footRadius(other)) return true;
    }
    return false;
}

function stepOk(unit, nx, nz) {
    if (!canStep(unit.x, unit.z, nx, nz)) return false;
    if (peopleBlock(unit, nx, nz)) return false;
    const world = window.World;
    if (world && world.bridgeDeck && world.bridgeDeck(unit.x, unit.z) != null && world.bridgeDeck(nx, nz) == null && inWater(nx, nz)) return false;
    return true;
}

function slideFree(unit, goal, step) {
    const world = window.World;
    const onDeck = world && world.bridgeDeck && world.bridgeDeck(unit.x, unit.z) != null;
    const wet = inWater(unit.x, unit.z);
    let best = null;
    let bestScore = Infinity;
    for (let i = 0; i < 8; i++) {
        const ang = i * Math.PI / 4;
        const nx = unit.x + Math.sin(ang) * step;
        const nz = unit.z + Math.cos(ang) * step;
        if (!canStep(unit.x, unit.z, nx, nz)) continue;
        if (peopleBlock(unit, nx, nz)) continue;
        const deck = world && world.bridgeDeck && world.bridgeDeck(nx, nz) != null;
        if (onDeck && !deck && inWater(nx, nz)) continue;
        const d = Math.hypot(goal.x - nx, goal.z - nz);
        const score = d + (wet && inWater(nx, nz) && !deck ? 40 : 0) + (onDeck && deck ? 0 : 2);
        if (score < bestScore) {
            bestScore = score;
            best = { x: nx, z: nz };
        }
    }
    return best;
}

function arrive(unit, goal, stop, dt) {
    const dx = goal.x - unit.x;
    const dz = goal.z - unit.z;
    const distLeft = Math.hypot(dx, dz);
    if (distLeft <= stop) {
        unit.stuck = 0;
        return true;
    }
    const step = Math.min(distLeft, (unit.speed || SPEED) * dt);
    const angles = [0, 0.6, -0.6, 1.15, -1.15, 1.8, -1.8];
    let nx = unit.x;
    let nz = unit.z;
    let moved = false;
    for (let i = 0; i < angles.length; i++) {
        const ang = angles[i];
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        const tx = dx * c - dz * s;
        const tz = dx * s + dz * c;
        const len = Math.hypot(tx, tz) || 1;
        const tryX = unit.x + (tx / len) * step;
        const tryZ = unit.z + (tz / len) * step;
        if (!stepOk(unit, tryX, tryZ)) continue;
        nx = tryX;
        nz = tryZ;
        moved = true;
        break;
    }
    if (!moved) {
        unit.stuck = (unit.stuck || 0) + 1;
        if (unit.stuck > 8) {
            const slip = slideFree(unit, goal, step);
            if (slip) {
                nx = slip.x;
                nz = slip.z;
                moved = true;
                unit.stuck = 0;
            }
        }
        if (!moved) return false;
    } else unit.stuck = 0;
    unit.yaw = Math.atan2(nx - unit.x, nz - unit.z);
    unit.x = nx;
    unit.z = nz;
    unit.group.position.x = unit.x;
    unit.group.position.z = unit.z;
    unit.group.rotation.y = unit.yaw;
    return false;
}

function stepUnits(dt) {
    if (!home) return;
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (unit.dying > 0) {
            unit.dying -= dt;
            const t = 1 - Math.max(0, unit.dying) / 0.9;
            unit.group.rotation.x = -1.35 * t;
            unit.group.position.y = feetAt(unit.x, unit.z) + 0.2 * (1 - t);
            if (unit.dying <= 0) bury(unit);
            continue;
        }
        if (unit.state === "inside") {
            unit.group.visible = !!pilot;
            unit.group.position.y = feetAt(unit.x, unit.z);
            unit.anim += dt;
            if (unit.mixer) holdArcher(unit, dt);
            else if (unit.body.geometry && unit.actor) {
                const idle = unit.actor.frames.idle;
                const frame = idle[Math.floor(unit.anim) % idle.length];
                if (unit.body.geometry !== frame) unit.body.geometry = frame;
            }
            continue;
        }
        if (unit === pilot) {
            unit.yaw = unit.bodyYaw == null ? lookYaw : unit.bodyYaw;
            unit.group.rotation.y = unit.yaw;
            const moving = !!(keys.w || keys.a || keys.s || keys.d || keys.arrowup || keys.arrowdown || keys.arrowleft || keys.arrowright);
            unit.group.position.y = feetAt(unit.x, unit.z) + (unit.hop || 0);
            unit.anim += dt;
            if (unit.mixer) stepArcher(unit, dt, moving);
            else if (unit.body.geometry && unit.actor) {
                const frames = moving ? unit.actor.frames.walk : unit.actor.frames.idle;
                const frame = frames[Math.floor(unit.anim * (moving ? 12 : 1)) % frames.length];
                if (unit.body.geometry !== frame) unit.body.geometry = frame;
            }
            continue;
        }
        if (unit.side === "self") unit.state = "idle";
        if (unit.state === "home" && !unit.goal) {
            tuckIn(unit);
            continue;
        }
        let moving = false;
        if (unit.state === "goto" || unit.state === "move" || unit.state === "return" || unit.state === "chase" || unit.state === "back" || unit.state === "home") {
            moving = true;
            const stop = unit.state === "return" ? 0.8 : 0.45;
            if (arrive(unit, unit.goal, stop, dt)) {
                moving = false;
                if (unit.state === "home") {
                    tuckIn(unit);
                    continue;
                }
                if (unit.state === "return") {
                    depositCarry(unit);
                    if (unit.jobNode) {
                        unit.goal = standAt(unit.jobNode, unit);
                        unit.state = "goto";
                    } else unit.state = "idle";
                    refreshHud();
                } else if (unit.state === "goto") {
                    unit.state = "gather";
                } else if (unit.state === "back") {
                    unit.state = "idle";
                } else if (unit.state === "chase") {
                    unit.state = "chase";
                } else {
                    unit.state = "idle";
                    if (militaryKind(unit.kind) && unit.stance === "guard" && unit.goal) {
                        unit.post = { x: unit.goal.x, z: unit.goal.z };
                    }
                }
            }
        } else if (unit.state === "gather") {
            unit.carry = Math.min(CARRY_MAX, unit.carry + dt * (CARRY_MAX / CARRY_TIME));
            if (unit.carry >= CARRY_MAX - 0.001) {
                unit.carry = CARRY_MAX;
                unit.goal = dropAt(unit);
                unit.state = "return";
            }
        }
        unit.group.position.y = feetAt(unit.x, unit.z);
        unit.anim += dt;
        if (unit.mixer) {
            if (unit.idleClip || unit.walkClip) {
                const name = moving && unit.walkClip ? unit.walkClip : (unit.idleClip || unit.walkClip);
                if (name && unit.pose !== name) playArcher(unit, name, false);
                unit.mixer.update(dt);
            } else holdArcher(unit, dt);
            continue;
        }
        if (!unit.actor || !unit.actor.frames || !unit.body) continue;
        const punch = unit.state === "strike" && unit.actor.frames.punch && unit.actor.frames.punch.length;
        const frames = punch ? unit.actor.frames.punch : moving ? unit.actor.frames.walk : unit.actor.frames.idle;
        const frame = punch
            ? frames[Math.min(frames.length - 1, Math.floor(Math.min(0.999, (unit.swing || 0) / SWING) * frames.length))]
            : frames[Math.floor(unit.anim * (moving ? 12 : 1)) % frames.length];
        if (unit.body.geometry !== frame) unit.body.geometry = frame;
    }
    if (selected.some((unit) => unit.state === "gather" || unit.state === "return" || unit.state === "goto" || unit.state === "chase" || unit.state === "strike" || unit.state === "back")) refreshHud();
}

function ndc(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
}

function groundAt(event) {
    raycaster.setFromCamera(ndc(event), camera);
    const hit = raycaster.intersectObject(terrain, true)[0];
    return hit ? hit.point : null;
}

function pickUnit(event) {
    raycaster.setFromCamera(ndc(event), camera);
    const bodies = [];
    for (let i = 0; i < units.length; i++) {
        if (units[i].state === "inside" && !pilot) continue;
        bodies.push(units[i].body);
    }
    const hit = raycaster.intersectObjects(bodies, true)[0];
    let picked = hit ? hit.object : null;
    while (picked && !picked.userData.unit) picked = picked.parent;
    if (picked && picked.userData.unit && picked.userData.unit.state !== "inside") {
        const side = picked.userData.unit.side;
        if (side === "you" || side === "cpu" || side === "self") return picked.userData.unit;
    }
    let best = null;
    let bestD = 28;
    const rect = renderer.domElement.getBoundingClientRect();
    for (let i = 0; i < units.length; i++) {
        if (units[i].state === "inside") continue;
        const spot = new THREE.Vector3(units[i].x, units[i].group.position.y + 0.7, units[i].z).project(camera);
        if (units[i].side !== "you" && units[i].side !== "cpu" && units[i].side !== "self") continue;
        if (spot.z > 1) continue;
        const sx = (spot.x * 0.5 + 0.5) * rect.width + rect.left;
        const sy = (-spot.y * 0.5 + 0.5) * rect.height + rect.top;
        const d = Math.hypot(event.clientX - sx, event.clientY - sy);
        if (d < bestD) {
            bestD = d;
            best = units[i];
        }
    }
    return best;
}

function pickHouse(event) {
    raycaster.setFromCamera(ndc(event), camera);
    const groups = [];
    for (let i = 0; i < built.length; i++) {
        if (built[i].group) groups.push(built[i].group);
    }
    const hit = groups.length ? raycaster.intersectObjects(groups, true)[0] : null;
    if (hit) {
        let obj = hit.object;
        while (obj && !obj.userData.building) obj = obj.parent;
        if (obj && obj.userData.building) return obj.userData.building;
    }
    const point = groundAt(event);
    if (!point) return null;
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < built.length; i++) {
        const house = built[i];
        if (Math.abs(point.x - house.x) > house.hx + 1.2 || Math.abs(point.z - house.z) > house.hz + 1.2) continue;
        const d = Math.hypot(point.x - house.x, point.z - house.z);
        if (d < bestD) {
            bestD = d;
            best = house;
        }
    }
    return best;
}

function chooseClick(event) {
    const unit = pickUnit(event);
    if (unit) {
        setSelected([unit]);
        return;
    }
    const house = pickHouse(event);
    if (house) {
        setSelected([]);
        selectedHouse = house;
        refreshHud();
        return;
    }
    if (pickManor(event)) {
        setSelected([]);
        manorSelected = true;
        refreshHud();
        return;
    }
    setSelected([]);
}

function pickManor(event) {
    const base = sideBase(led);
    if (!base || !base.group) return false;
    raycaster.setFromCamera(ndc(event), camera);
    if (raycaster.intersectObject(base.group, true).length > 0) return true;
    const point = groundAt(event);
    return !!point && Math.hypot(point.x - base.x, point.z - base.z) < 12;
}

function formationGoals(movers, point) {
    let sx = 0;
    let sz = 0;
    for (let i = 0; i < movers.length; i++) {
        sx += movers[i].x;
        sz += movers[i].z;
    }
    sx /= movers.length;
    sz /= movers.length;
    let fx = point.x - sx;
    let fz = point.z - sz;
    const fl = Math.hypot(fx, fz);
    if (fl < 0.75) {
        fx = 0;
        fz = 1;
    } else {
        fx /= fl;
        fz /= fl;
    }
    const rx = fz;
    const rz = -fx;
    const cols = movers.length <= 4 ? movers.length : Math.ceil(Math.sqrt(movers.length * 1.6));
    const gap = 1.6;
    const ranked = movers.slice().sort((a, b) => {
        const af = (a.x - sx) * fx + (a.z - sz) * fz;
        const bf = (b.x - sx) * fx + (b.z - sz) * fz;
        if (Math.abs(af - bf) > 1.2) return bf - af;
        const ar = (a.x - sx) * rx + (a.z - sz) * rz;
        const br = (b.x - sx) * rx + (b.z - sz) * rz;
        return ar - br;
    });
    const goals = new Map();
    for (let i = 0; i < ranked.length; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const rowCols = Math.min(cols, ranked.length - row * cols);
        const across = (col - (rowCols - 1) / 2) * gap;
        const back = row * gap;
        goals.set(ranked[i], {
            x: point.x + rx * across - fx * back,
            z: point.z + rz * across - fz * back
        });
    }
    return goals;
}

function placeSelf(unit, point) {
    unit.x = point.x;
    unit.z = point.z;
    unit.goal = null;
    unit.job = null;
    unit.jobNode = null;
    unit.targetId = null;
    unit.orders = false;
    unit.shelter = null;
    unit.state = "idle";
    unit.group.visible = true;
    unit.group.position.set(point.x, feetAt(point.x, point.z), point.z);
}

function commandAt(point) {
    if (!selected.length) return;
    let yours = false;
    selected.forEach((unit) => {
        if (unit.side === "self") {
            placeSelf(unit, point);
            return;
        }
        if ((unit.side !== "you" && unit.side !== "cpu") || unit.state === "inside" || unit.state === "home") return;
        unit.orders = true;
        yours = true;
    });
    if (!yours) {
        refreshHud();
        writeSave();
        return;
    }
    const farm = farmAt(point.x, point.z);
    let node = farm ? null : nearestNode(point.x, point.z);
    if (!node && inWater(point.x, point.z)) node = shoreBeside(point.x, point.z);
    const soldiers = [];
    const farmHands = [];
    selected.forEach((unit) => {
        if ((unit.side !== "you" && unit.side !== "cpu") || unit.state === "inside" || unit.state === "home") return;
        if (farm && workerKind(unit.kind)) {
            farmHands.push(unit);
        } else if (node && workerKind(unit.kind)) {
            unit.job = node.kind;
            unit.jobNode = node;
            if (unit.carry >= CARRY_MAX) {
                unit.goal = dropAt(unit);
                unit.state = "return";
            } else {
                unit.goal = standAt(node, unit);
                unit.state = "goto";
            }
        } else if (militaryKind(unit.kind)) {
            soldiers.push(unit);
        } else {
            unit.job = null;
            unit.jobNode = null;
            unit.goal = { x: point.x, z: point.z };
            unit.state = "move";
        }
    });
    const slots = soldiers.length > 1 ? formationGoals(soldiers, point) : null;
    for (let i = 0; i < soldiers.length; i++) {
        const unit = soldiers[i];
        unit.job = null;
        unit.jobNode = null;
        unit.targetId = null;
        unit.goal = slots ? slots.get(unit) : { x: point.x, z: point.z };
        unit.state = "move";
    }
    const turnedAway = farmHands.length ? sendToFarm(farmHands, farm) : false;
    refreshHud();
    if (turnedAway) selEl.textContent = "This farm already has 5 people.";
}

let boxDrag = false;
let boxMoved = false;
let mapDrag = false;
let mapMoved = false;
let downX = 0;
let downY = 0;
let lookTouch = null;
let panX = 0;
let panY = 0;
renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());
renderer.domElement.addEventListener("pointerdown", (event) => {
    if (pilot) {
        if (event.pointerType === "touch" || document.body.classList.contains("handheld")) {
            if (event.button !== 0 || event.target !== renderer.domElement) return;
            lookTouch = { id: event.pointerId, x: event.clientX, y: event.clientY };
            return;
        }
        if (document.pointerLockElement !== renderer.domElement) {
            renderer.domElement.requestPointerLock();
            return;
        }
        if (event.button === 2) {
            activateDoor();
            return;
        }
        if (event.button !== 0 || pilot.hp <= 0) return;
        if (ARMS[arm] && ARMS[arm].attack !== "slash") playerShot();
        else playerSwing("thrust");
        return;
    }
    downX = event.clientX;
    downY = event.clientY;
    panX = event.clientX;
    panY = event.clientY;
    boxMoved = false;
    mapMoved = false;
        if (event.button === 0) {
        if (placing || placingUnit) return;
        const finger = event.pointerType === "touch" && document.body.classList.contains("handheld");
        if (finger && !document.body.classList.contains("selecting")) mapDrag = true;
        else boxDrag = true;
    }
    if (event.button === 2 && !placing && !placingUnit) mapDrag = true;
});
window.addEventListener("pointerup", (event) => {
    if (lookTouch && event.pointerId === lookTouch.id) lookTouch = null;
    if (pilot) return;
    if ((placing || placingUnit) && event.button === 2) {
        cancelPlace();
        return;
    }
    if (placing && event.button === 0) {
        const point = groundAt(event);
        if (point) tryPlace(point.x, point.z);
        return;
    }
    if (placingUnit && event.button === 0) {
        const point = groundAt(event);
        if (point) putDownUnit(point.x, point.z);
        return;
    }
    if (event.button === 2) {
        const dragged = mapDrag && mapMoved;
        mapDrag = false;
        mapMoved = false;
        renderer.domElement.style.cursor = "";
        if (dragged) return;
        const point = groundAt(event);
        if (!point) return;
        if (manorSelected && !selected.length) {
            setRally(point.x, point.z);
            return;
        }
        commandAt(point);
    }
    if (event.button === 0 && mapDrag) {
        const dragged = mapMoved;
        mapDrag = false;
        mapMoved = false;
        renderer.domElement.style.cursor = "";
        if (dragged) return;
        chooseClick(event);
        return;
    }
    if (boxDrag && event.button === 0) {
        if (boxMoved) {
            const x0 = Math.min(downX, event.clientX);
            const x1 = Math.max(downX, event.clientX);
            const y0 = Math.min(downY, event.clientY);
            const y1 = Math.max(downY, event.clientY);
            const hits = [];
            for (let i = 0; i < units.length; i++) {
                const spot = new THREE.Vector3(units[i].x, units[i].group.position.y + 1, units[i].z).project(camera);
                const rect = renderer.domElement.getBoundingClientRect();
                const sx = (spot.x * 0.5 + 0.5) * rect.width + rect.left;
                const sy = (-spot.y * 0.5 + 0.5) * rect.height + rect.top;
                if ((units[i].side === "you" || units[i].side === "cpu") && units[i].state !== "inside" && sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) hits.push(units[i]);
            }
            let yours = 0;
            let theirs = 0;
            for (let i = 0; i < hits.length; i++) {
                if (hits[i].side === "cpu") theirs += 1;
                else yours += 1;
            }
            const keep = theirs > yours ? "cpu" : "you";
            setSelected(yours && theirs ? hits.filter((unit) => unit.side === keep) : hits);
            } else {
                const unit = pickUnit(event);
                if (unit) setSelected([unit]);
                else chooseClick(event);
            }
        boxDrag = false;
        boxEl.hidden = true;
    }
});
window.addEventListener("pointermove", (event) => {
    if (lookTouch && event.pointerId === lookTouch.id) {
        const dx = event.clientX - lookTouch.x;
        const dy = event.clientY - lookTouch.y;
        lookTouch.x = event.clientX;
        lookTouch.y = event.clientY;
        lookYaw -= dx * 0.005;
        lookPitch = Math.max(-1.15, Math.min(1.15, lookPitch - dy * 0.005));
        if (event.cancelable) event.preventDefault();
        return;
    }
    if (pilot) return;
    moveGhost(event);
    if (mapDrag) {
        const dx = event.movementX || (event.clientX - panX);
        const dy = event.movementY || (event.clientY - panY);
        panX = event.clientX;
        panY = event.clientY;
        if (Math.hypot(event.clientX - downX, event.clientY - downY) > 4) {
            mapMoved = true;
            renderer.domElement.style.cursor = "grabbing";
            panBy(dx, dy, mapScale());
            if (event.cancelable) event.preventDefault();
        }
    }
    if (boxDrag && Math.hypot(event.clientX - downX, event.clientY - downY) > 6) {
        boxMoved = true;
        const x = Math.min(downX, event.clientX);
        const y = Math.min(downY, event.clientY);
        boxEl.hidden = false;
        boxEl.style.left = x + "px";
        boxEl.style.top = y + "px";
        boxEl.style.width = Math.abs(event.clientX - downX) + "px";
        boxEl.style.height = Math.abs(event.clientY - downY) + "px";
    }
});
renderer.domElement.addEventListener("wheel", (event) => {
    if (pilot) return;
    dist = Math.max(16, Math.min(viewFar, dist + event.deltaY * 0.08));
    event.preventDefault();
}, { passive: false });

const keys = {};
const foes = new Set();
const swings = {
    thrust: { reach: 2.7, radius: 0.42, side: 0 },
    chop: { reach: 2.05, radius: 0.72, side: 0 },
    "slash-left": { reach: 2.25, radius: 0.9, side: -0.55 },
    "slash-right": { reach: 2.25, radius: 0.9, side: 0.55 }
};
let arm = "sword";
let packWeapons = ARM_ORDER.slice();
let nextSwing = 0;
let strikeTimer = 0;

function showStrike(text) {
    const strike = document.getElementById("strike");
    strike.textContent = text;
    clearTimeout(strikeTimer);
    strikeTimer = setTimeout(() => { strike.textContent = ""; }, 700);
}

function paintSelf() {
    const bar = document.getElementById("self-health");
    const fill = document.getElementById("self-health-fill");
    bar.hidden = !pilot;
    if (pilot) fill.style.width = Math.max(0, pilot.hp / playerRow().hp * 100) + "%";
    const held = ARMS[arm] || ARMS.sword;
    document.getElementById("pack-hands").textContent = held.name;
    document.body.classList.toggle("armed-bow", !!pilot && held.attack !== "slash");
    document.body.classList.toggle("armed-sword", !!pilot && held.attack === "slash");
    const playBtn = document.getElementById("play-self");
    if (playBtn) playBtn.textContent = pilot ? "Campaign" : "Become player";
    const swingBtn = document.getElementById("swing");
    if (swingBtn) swingBtn.textContent = held.attack === "slash" ? "Swing" : "Shoot";
    const list = document.getElementById("pack-list");
    list.textContent = "";
    packWeapons.forEach((id) => {
        const spec = ARMS[id];
        if (!spec) return;
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = id === arm ? spec.name + " (held)" : spec.name;
        button.addEventListener("click", () => equip(id));
        list.appendChild(button);
    });
}

function equip(id) {
    if (!ARMS[id] || id === arm) return;
    arm = id;
    const mine = pilot || units.find((unit) => unit.side === "self");
    if (mine) showArm(mine);
    paintSelf();
    showStrike(ARMS[id].name);
}

function togglePack() {
    const panel = document.getElementById("pack-panel");
    panel.hidden = !panel.hidden;
    if (!panel.hidden && document.pointerLockElement) document.exitPointerLock();
    paintSelf();
}
function leadTeam(side) {
    if (pilot) leaveBody();
    led = side === "cpu" ? "cpu" : "you";
    const base = sideBase(led);
    setSelected([]);
    manorSelected = true;
    if (base) {
        look.set(base.x + 2, heightAt(base.x, base.z), base.z + 14);
        dist = 110;
    }
    refreshHud();
}

function toggleNotes() {
    const bar = document.getElementById("bar");
    bar.hidden = !bar.hidden;
}

document.getElementById("menu-btn").addEventListener("click", () => {
    const list = document.getElementById("menu-list");
    list.hidden = !list.hidden;
});
document.getElementById("menu-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-menu]");
    document.getElementById("menu-list").hidden = true;
    if (!button) return;
    const pick = button.dataset.menu;
    if (pick === "notes") toggleNotes();
    else if (pick === "pack") togglePack();
    else if (pick === "walk") {
        if (pilot) leaveBody();
        else {
            const mine = units.find((unit) => unit.side === "self");
            if (mine) enterBody(mine);
        }
    } else if (pick === "you" || pick === "cpu") leadTeam(pick);
});
document.getElementById("pack-close").addEventListener("click", () => {
    document.getElementById("pack-panel").hidden = true;
});
document.getElementById("pack-campaign").addEventListener("click", () => {
    document.getElementById("pack-panel").hidden = true;
    if (pilot) leaveBody();
});

const handheldQuery = window.matchMedia("(max-width: 900px)");
const viewMeta = document.querySelector('meta[name="viewport"]');
function phoneScreen() {
    return Math.min(window.screen.width, window.screen.height) <= 900;
}
function desktopLayout() {
    return localStorage.getItem("aoe-layout") === "desktop";
}
function applyHandheld() {
    const phone = phoneScreen();
    const desktop = phone && desktopLayout();
    if (viewMeta) viewMeta.setAttribute("content", desktop ? "width=1200" : "width=device-width, initial-scale=1");
    document.body.classList.toggle("handheld", phone && !desktop);
    document.body.classList.toggle("force-desktop", desktop);
    const layoutBtn = document.getElementById("layout-mode");
    if (layoutBtn) {
        layoutBtn.hidden = !phone;
        layoutBtn.textContent = desktop ? "Phone" : "Desktop";
    }
}
applyHandheld();
if (handheldQuery.addEventListener) handheldQuery.addEventListener("change", () => applyHandheld());
document.getElementById("layout-mode").addEventListener("click", () => {
    localStorage.setItem("aoe-layout", desktopLayout() ? "phone" : "desktop");
    applyHandheld();
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
});

function holdKey(button, key) {
    const press = (event) => {
        event.preventDefault();
        event.stopPropagation();
        keys[key] = true;
        if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
    };
    const release = () => { keys[key] = false; };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
}
document.querySelectorAll("#move-pad button").forEach((button) => holdKey(button, button.dataset.move));
document.getElementById("swing").addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (ARMS[arm] && ARMS[arm].attack !== "slash") playerShot();
    else playerSwing("thrust");
});
document.getElementById("play-self").addEventListener("click", () => {
    if (pilot) leaveBody();
    else {
        const mine = units.find((unit) => unit.side === "self");
        if (mine) enterBody(mine);
    }
});
document.getElementById("select-mode").addEventListener("click", () => {
    document.body.classList.toggle("selecting");
});
document.getElementById("zoom-in").addEventListener("click", () => { dist = Math.max(16, dist - 18); });
document.getElementById("zoom-out").addEventListener("click", () => { dist = Math.min(viewFar, dist + 18); });

function downSelf() {
    foes.clear();
    if (!pilot) return;
    pilot.hp = playerRow().hp;
    showStrike("You are slain. They leave you be.");
    leaveBody();
}

function guardOf(target) {
    if (!target) return 0;
    let value = 0;
    if (target.side === "self") value = playerRow().defence;
    else if (target.haul) {
        const horse = horseRow();
        value = horse ? horse.defence : 0;
    } else if (target.kind) value = unitRow(target.kind).defence;
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function soaked(target, amount) {
    return Math.max(0, (Number(amount) || 0) - guardOf(target));
}

function strikeUnit(unit, amount, label) {
    if (!unit || unit.side === "self" || unit.hp <= 0) return;
    unit.hp -= soaked(unit, amount);
    if (unit.side === "you" || unit.side === "cpu") foes.add(unit.side);
    showStrike(label);
    paintSelf();
    if (unit.hp <= 0) {
        if (unit.haul) loseHorse(unit);
        else fell(unit);
    }
}

function reachHit(profile) {
    const cp = Math.cos(lookPitch);
    const fx = Math.sin(lookYaw) * cp;
    const fy = Math.sin(lookPitch);
    const fz = Math.cos(lookYaw) * cp;
    const rx = Math.cos(lookYaw);
    const rz = -Math.sin(lookYaw);
    const ox = pilot.x + rx * profile.side;
    const oy = pilot.group.position.y + eye;
    const oz = pilot.z + rz * profile.side;
    let best = null;
    let bestT = profile.reach;
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (unit.side === "self" || unit.hp <= 0 || unit.state === "inside") continue;
        const chest = unit.group.position.y + 1.1;
        const dx = unit.x - ox;
        const dy = chest - oy;
        const dz = unit.z - oz;
        const t = dx * fx + dy * fy + dz * fz;
        if (t < 0.4 || t > profile.reach) continue;
        const wide = Math.hypot(dx - fx * t, dz - fz * t);
        if (wide < profile.radius && Math.abs(dy - fy * t) < 1.4 && t < bestT) {
            best = unit;
            bestT = t;
        }
    }
    for (let i = 0; i < haulers.length; i++) {
        const horse = haulers[i];
        if (!horse.alive || horse.hp <= 0) continue;
        const chest = horse.group.position.y + 1.2;
        const dx = horse.x - ox;
        const dy = chest - oy;
        const dz = horse.z - oz;
        const t = dx * fx + dy * fy + dz * fz;
        if (t < 0.4 || t > profile.reach) continue;
        const wide = Math.hypot(dx - fx * t, dz - fz * t);
        if (wide < 1.6 && Math.abs(dy - fy * t) < 1.5 && t < bestT) {
            best = horse;
            bestT = t;
        }
    }
    return best;
}

function playerSwing(kind) {
    if (!pilot || pilot.hp <= 0 || !ARMS[arm] || ARMS[arm].attack !== "slash") return;
    const now = performance.now();
    if (now < nextSwing) return;
    const profile = swings[kind];
    if (!profile) return;
    nextSwing = now + 700;
    if (pilot.clips && pilot.clips.Right_Hand_Sword_Slash) playArcher(pilot, "Right_Hand_Sword_Slash", true);
    const names = { thrust: "Thrust", chop: "Chop", "slash-left": "Slash", "slash-right": "Slash" };
    const view = document.getElementById("weapon");
    view.classList.remove("swing-thrust");
    void view.offsetWidth;
    view.classList.add("swing-thrust");
    strikeUnit(reachHit(profile), playerRow().attack, names[kind]);
}

const shotArrows = [];
const arrowMat = new THREE.MeshBasicMaterial({ color: 0xd7c4a0 });
const arrowGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.55, 4);
arrowGeom.rotateX(Math.PI / 2);
const arrowHead = new THREE.ConeGeometry(0.03, 0.12, 4);
arrowHead.rotateX(-Math.PI / 2);
arrowHead.translate(0, 0, -0.32);

function arrowMesh() {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(arrowGeom, arrowMat));
    group.add(new THREE.Mesh(arrowHead, arrowMat));
    return group;
}

function looseArrow() {
    const cp = Math.cos(lookPitch);
    const fx = Math.sin(lookYaw) * cp;
    const fy = Math.sin(lookPitch);
    const fz = Math.cos(lookYaw) * cp;
    const speed = 36;
    const mesh = arrowMesh();
    let x = pilot.x + fx * 0.7;
    let y = pilot.group.position.y + eye - 0.05;
    let z = pilot.z + fz * 0.7;
    if (pilot.bowHand) {
        const hand = pilot.bowHand.getWorldPosition(new THREE.Vector3());
        x = hand.x + fx * 0.45;
        y = hand.y;
        z = hand.z + fz * 0.45;
    }
    mesh.position.set(x, y + fy * 0.2, z);
    scene.add(mesh);
    shotArrows.push({
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z,
        vx: fx * speed,
        vy: fy * speed,
        vz: fz * speed,
        age: 0,
        mesh: mesh
    });
}

function stepArrows(dt) {
    for (let i = shotArrows.length - 1; i >= 0; i--) {
        const arrow = shotArrows[i];
        const x0 = arrow.x;
        const y0 = arrow.y;
        const z0 = arrow.z;
        arrow.x += arrow.vx * dt;
        arrow.y += arrow.vy * dt;
        arrow.z += arrow.vz * dt;
        arrow.age += dt;
        arrow.mesh.position.set(arrow.x, arrow.y, arrow.z);
        arrow.mesh.lookAt(arrow.x + arrow.vx, arrow.y + arrow.vy, arrow.z + arrow.vz);
        let hit = null;
        const sx = arrow.x - x0;
        const sy = arrow.y - y0;
        const sz = arrow.z - z0;
        const len2 = sx * sx + sy * sy + sz * sz || 1;
        for (let u = 0; u < units.length; u++) {
            const unit = units[u];
            if (unit.side === "self" || unit.hp <= 0 || unit.dying || unit.state === "inside") continue;
            const chest = unit.group.position.y + 1.1;
            let t = ((unit.x - x0) * sx + (chest - y0) * sy + (unit.z - z0) * sz) / len2;
            t = Math.max(0, Math.min(1, t));
            const px = x0 + sx * t;
            const py = y0 + sy * t;
            const pz = z0 + sz * t;
            if (Math.hypot(unit.x - px, chest - py, unit.z - pz) < 0.55) {
                hit = unit;
                break;
            }
        }
        if (!hit) {
            for (let u = 0; u < haulers.length; u++) {
                const horse = haulers[u];
                if (!horse.alive || horse.hp <= 0) continue;
                const chest = horse.group.position.y + 1.2;
                let t = ((horse.x - x0) * sx + (chest - y0) * sy + (horse.z - z0) * sz) / len2;
                t = Math.max(0, Math.min(1, t));
                const px = x0 + sx * t;
                const py = y0 + sy * t;
                const pz = z0 + sz * t;
                if (Math.hypot(horse.x - px, chest - py, horse.z - pz) < 1.2) {
                    hit = horse;
                    break;
                }
            }
        }
        const ground = feetAt(arrow.x, arrow.z);
        if (!hit && arrow.age < 0.9 && arrow.y > ground + 0.15) continue;
        if (hit) strikeUnit(hit, playerRow().shot, "Shot");
        scene.remove(arrow.mesh);
        shotArrows.splice(i, 1);
    }
}

function playerShot() {
    const spec = ARMS[arm];
    if (!pilot || pilot.hp <= 0 || !spec || (spec.attack !== "arrow" && spec.attack !== "crossbow")) return;
    const now = performance.now();
    if (now < nextSwing) return;
    nextSwing = now + (spec.attack === "crossbow" ? 1600 : 1000);
    const name = spec.attack === "crossbow" ? "Draw_and_Shoot_from_Back" : "Archery_Shot_1";
    if (pilot.clips && pilot.clips[name]) {
        const action = playArcher(pilot, name, true);
        if (spec.attack === "crossbow") {
            action.time = 3.2;
            pilot.releaseAt = 4.5;
        } else {
            action.time = 0.12;
            pilot.releaseAt = 0.68;
        }
        pilot.released = false;
        return;
    }
    looseArrow();
}

const CREATURE_SHOW = [
    ["Bear", "../models/creatures/_glb/bear-idle.glb"],
    ["Wolf", "../models/creatures/_glb/wolf-idle.glb"],
    ["Warg", "../models/creatures/_glb/warg-idle.glb"],
    ["Fox", "../models/fox full.glb"],
    ["Deer", "../models/creatures/_glb/deer-idle.glb"],
    ["Rat", "../models/creatures/_glb/rat-idle.glb"],
    ["Snake", "../models/snake.glb"],
    ["Eagle", "../models/egle.glb"],
    ["Spider", "../models/creatures/_glb/spider-idle.glb"],
    ["Wasp", "../models/creatures/_glb/wasp-idle.glb"],
    ["Centipede", "../models/creatures/_glb/centipede-idle.glb"],
    ["Ooze", "../models/creatures/_glb/ooze-idle.glb"],
    ["Rhino", "../models/creatures/_glb/rhino-idle.glb"],
    ["Mammoth", "../models/creatures/_glb/mammoth-idle.glb"],
    ["Cow", "../models/cow/cow.glb"],
    ["Dragon", "../models/dragon/dragon.glb"],
    ["Horse", "../models/horse/horse.glb"]
];
let showRoot = null;
const showMixers = [];
const showLoads = {};

function loadShowcase(url) {
    if (!showLoads[url]) {
        showLoads[url] = new Promise((resolve) => {
            new GLTFLoader().load(encodeURI(url), (gltf) => resolve(gltf), undefined, () => resolve(null));
        });
    }
    return showLoads[url];
}

function showLabel(name) {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(20, 16, 12, 0.78)";
    ctx.fillRect(0, 10, 320, 44);
    ctx.fillStyle = "#f4ead8";
    ctx.font = "22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(name || "").slice(0, 24), 160, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sprite.scale.set(2.4, 0.48, 1);
    sprite.position.y = 2.2;
    return sprite;
}

function modelBounds(model) {
    const box = new THREE.Box3();
    model.updateMatrixWorld(true);
    model.traverse((mesh) => {
        if (!mesh.isMesh || !mesh.geometry) return;
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        box.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
    });
    return box;
}

function standShowcase(gltf, name) {
    const cap = name === "Horse" ? 3.6 : 2.2;
    const model = cloneSkinned(gltf.scene);
    model.traverse((mesh) => {
        if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.frustumCulled = false;
        }
    });
    const size = modelBounds(model).getSize(new THREE.Vector3());
    const max = Math.max(size.x, size.y, size.z);
    if (max > cap) model.scale.multiplyScalar(cap / max);
    const fitted = modelBounds(model);
    if (Number.isFinite(fitted.min.y)) model.position.y -= fitted.min.y;
    const shown = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    const shownMax = Math.max(shown.x, shown.y, shown.z);
    if (shownMax > cap + 0.05 && shownMax < 1000) {
        model.scale.multiplyScalar(cap / shownMax);
        model.position.y = 0;
        const again = modelBounds(model);
        if (Number.isFinite(again.min.y)) model.position.y -= again.min.y;
    }
    const clips = gltf.animations || [];
    let clip = null;
    for (let i = 0; i < clips.length; i++) {
        if (/idle/i.test(clips[i].name)) {
            clip = clips[i];
            break;
        }
    }
    const mixer = clip ? new THREE.AnimationMixer(model) : null;
    if (mixer) {
        mixer.clipAction(clip).play();
        showMixers.push(mixer);
    }
    return model;
}

function placeShowLine(items, aside, jobs) {
    const fx = Math.sin(lookYaw);
    const fz = Math.cos(lookYaw);
    const rightX = -Math.cos(lookYaw);
    const rightZ = Math.sin(lookYaw);
    for (let i = 0; i < items.length; i++) {
        const along = 5 + i * 3.6 + (items[i].name === "Horse" ? 1.4 : 0);
        const x = pilot.x + fx * along + rightX * aside;
        const z = pilot.z + fz * along + rightZ * aside;
        const holder = new THREE.Group();
        holder.position.set(x, feetAt(x, z), z);
        holder.rotation.y = lookYaw + Math.PI * 0.5;
        holder.add(showLabel(items[i].name));
        showRoot.add(holder);
        const file = items[i].file;
        jobs.push(() => loadShowcase(file).then((gltf) => {
            if (!gltf || !holder.parent) return;
            const model = standShowcase(gltf, items[i].name);
            holder.add(model);
            const top = modelBounds(model).max.y - holder.position.y;
            holder.children[0].position.y = Math.max(1.5, top + 0.35);
        }));
    }
}

function openShowcase() {
    if (!pilot) return;
    const creatures = CREATURE_SHOW.map((pair) => ({ name: pair[0], file: pair[1] }));
    if (!showRoot) {
        showRoot = new THREE.Group();
        scene.add(showRoot);
    }
    while (showRoot.children.length) showRoot.remove(showRoot.children[0]);
    showMixers.length = 0;
    showRoot.visible = true;
    const jobs = [];
    placeShowLine(creatures, 3.2, jobs);
    let cursor = 0;
    function nextJob() {
        if (cursor >= jobs.length || !pilot) return;
        const job = jobs[cursor++];
        job().then(() => setTimeout(nextJob, 400), () => setTimeout(nextJob, 400));
    }
    nextJob();
}

function closeShowcase() {
    if (showRoot) showRoot.visible = false;
    showMixers.length = 0;
}

function stepShowcase(dt) {
    if (!showRoot || !showRoot.visible) return;
    for (let i = 0; i < showMixers.length; i++) showMixers[i].update(dt);
}

function enterBody(unit) {
    if (placing) cancelPlace();
    pilot = unit;
    lookYaw = home ? Math.atan2(home.x - unit.x, home.z - unit.z) : unit.yaw;
    lookPitch = 0;
    unit.body.visible = true;
    unit.group.rotation.y = lookYaw;
    unit.ring.visible = false;
    unit.state = "idle";
    unit.job = null;
    unit.jobNode = null;
    unit.goal = null;
    showArm(unit);
    if (unit.eyeHeight) eye = unit.eyeHeight;
    else if (unit.body.geometry) {
        unit.body.geometry.computeBoundingBox();
        eye = Math.max(0.9, unit.body.geometry.boundingBox.max.y * 0.9 * (unit.body.scale.y || 1));
    }
    document.body.classList.add("walking");
    applyAllLooks();
    if (mapTrees) mapTrees.visible = false;
    if (mapCards) mapCards.visible = false;
    refreshWalkTrees();
    paintSelf();
    camera.fov = 72;
    camera.near = 0.06;
    camera.updateProjectionMatrix();
    if (!document.body.classList.contains("handheld")) renderer.domElement.requestPointerLock();
    refreshHud();
    openShowcase();
    ensureWalker().then(() => {
        if (pilot === unit && unit.eyeHeight) eye = unit.eyeHeight;
    });
}

function leaveBody() {
    if (!pilot) return;
    closeShowcase();
    const unit = pilot;
    pilot = null;
    applyAllLooks();
    clearWalkTrees();
    if (mapTrees) mapTrees.visible = true;
    if (mapCards) mapCards.visible = true;
    unit.body.visible = true;
    unit.state = "idle";
    look.set(unit.x, 2, unit.z);
    dist = 42;
    camera.fov = 42;
    camera.near = 0.3;
    camera.updateProjectionMatrix();
    wantJump = false;
    unit.hop = 0;
    unit.vy = 0;
    document.body.classList.remove("walking");
    paintSelf();
    if (document.pointerLockElement) document.exitPointerLock();
    refreshHud();
}

function canPass(nx, nz) {
    const world = window.World;
    if (!canStep(pilot.x, pilot.z, nx, nz)) return false;
    const rise = feetAt(nx, nz) - feetAt(pilot.x, pilot.z);
    const step = Math.hypot(nx - pilot.x, nz - pilot.z) || 0.001;
    if (rise > 0.45 && rise / step > 0.65) return false;
    if (world && world.bridgeWall && world.bridgeWall(nx, nz) != null) return false;
    const y = pilot.group.position.y + 0.85;
    const dir = new THREE.Vector3(nx - pilot.x, 0, nz - pilot.z);
    const span = dir.length();
    if (span < 0.0001) return true;
    const walls = [];
    if (!(home && home.rooms) && home && home.group) walls.push(home.group);
    if (!(cpuHome && cpuHome.rooms) && cpuHome && cpuHome.group) walls.push(cpuHome.group);
    if (blockedByBuilding(nx, nz)) return false;
    if (peopleBlock(pilot, nx, nz)) return false;
    if (!walls.length) return true;
    dir.multiplyScalar(1 / span);
    wallRay.set(new THREE.Vector3(pilot.x, y, pilot.z), dir);
    wallRay.far = span + 0.28;
    return wallRay.intersectObjects(walls, true).length === 0;
}

let wantJump = false;

function walkBody(dt) {
    if (!pilot) return;
    let forward = 0;
    let strafe = 0;
    if (keys.w || keys.arrowup) forward += 1;
    if (keys.s || keys.arrowdown) forward -= 1;
    if (keys.a || keys.arrowleft) strafe += 1;
    if (keys.d || keys.arrowright) strafe -= 1;
    const len = Math.hypot(forward, strafe);
    if (len) {
        const step = playerRow().move * dt / len;
        const fx = Math.sin(lookYaw);
        const fz = Math.cos(lookYaw);
        const rx = Math.cos(lookYaw);
        const rz = -Math.sin(lookYaw);
        const nx = Math.max(mapBox.min.x, Math.min(mapBox.max.x, pilot.x + (fx * forward + rx * strafe) * step));
        const nz = Math.max(mapBox.min.z, Math.min(mapBox.max.z, pilot.z + (fz * forward + rz * strafe) * step));
        if (canPass(nx, nz)) {
            pilot.x = nx;
            pilot.z = nz;
        } else if (canPass(nx, pilot.z)) {
            pilot.x = nx;
        } else if (canPass(pilot.x, nz)) {
            pilot.z = nz;
        }
        pilot.group.position.x = pilot.x;
        pilot.group.position.z = pilot.z;
    }
    let hop = pilot.hop || 0;
    let vy = pilot.vy || 0;
    const grounded = hop <= 0.02 && vy <= 0;
    if (grounded && wantJump) {
        vy = jumpPower();
        wantJump = false;
    }
    if (hop > 0 || vy > 0) {
        vy -= 22 * dt;
        hop = Math.max(0, hop + vy * dt);
        if (hop === 0) vy = 0;
    } else vy = 0;
    pilot.hop = hop;
    pilot.vy = vy;
    const visual = pilot.group.position.y;
    const porch = feetAt(pilot.x, pilot.z);
    let ground = porch;
    if (hop > 0.02) {
        const stand = visual - hop;
        const step = stairAt(pilot.x, pilot.z, stand + 0.05);
        if (step != null && step >= stand - 0.2) ground = Math.max(porch, step);
        else ground = Math.max(porch, stand);
    } else {
        const step = stairAt(pilot.x, pilot.z, visual);
        if (step != null) ground = Math.max(porch, step);
        if (visual - ground > 0.55 && visual - porch > 0.4) {
            hop = visual - ground;
            vy = 0;
            pilot.hop = hop;
            pilot.vy = vy;
        }
    }
    const movingBody = !!(keys.w || keys.a || keys.s || keys.d || keys.arrowup || keys.arrowdown || keys.arrowleft || keys.arrowright);
    let gap = lookYaw - (pilot.bodyYaw == null ? lookYaw : pilot.bodyYaw);
    while (gap > Math.PI) gap -= Math.PI * 2;
    while (gap < -Math.PI) gap += Math.PI * 2;
    if (movingBody || Math.abs(gap) < 0.08) pilot.bodyYaw = lookYaw;
    else pilot.bodyYaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, gap));
    pilot.yaw = pilot.bodyYaw;
    pilot.group.position.y = ground + hop;
    pilot.group.rotation.y = pilot.bodyYaw;
}

window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    keys[key] = true;
    if (pilot && event.code === "Space") event.preventDefault();
    if (event.repeat) return;
    if (pilot && event.code === "Space") wantJump = true;
    if (key === "escape" && !event.repeat) {
        const packPanel = document.getElementById("pack-panel");
        if (packPanel && !packPanel.hidden) {
            packPanel.hidden = true;
            return;
        }
        if (placing) {
            cancelPlace();
            return;
        }
        if (pilot) leaveBody();
        return;
    }
        if (key === "f") {
            if (pilot) leaveBody();
            else {
                const mine = units.find((unit) => unit.side === "self");
                if (mine) enterBody(mine);
            }
        }
    if (pilot) {
        if (key === "t") {
            inHead = !inHead;
            camera.near = inHead ? 0.1 : 0.06;
            camera.updateProjectionMatrix();
            refreshHud();
            return;
        }
        if (key === "p" || key === "c") togglePack();
        return;
    }
    if (key === "q") yaw += 0.15;
    if (key === "e") yaw -= 0.15;
});
window.addEventListener("keyup", (event) => { keys[event.key.toLowerCase()] = false; });
document.addEventListener("mousemove", (event) => {
    if (!pilot || document.pointerLockElement !== renderer.domElement) return;
    lookYaw -= event.movementX * 0.0022;
    lookPitch = Math.max(-1.15, Math.min(1.15, lookPitch - event.movementY * 0.0022));
});

function dist2(ax, az, bx, bz) {
    const dx = ax - bx;
    const dz = az - bz;
    return dx * dx + dz * dz;
}

function living(id) {
    if (!id) return null;
    for (let i = 0; i < units.length; i++) {
        if (units[i].id === id && units[i].hp > 0) return units[i];
    }
    for (let i = 0; i < haulers.length; i++) {
        if (haulers[i].id === id && haulers[i].alive && haulers[i].hp > 0) return haulers[i];
    }
    return null;
}

function tooFar(unit, enemy) {
    if (unit.stance !== "guard" || !unit.post) return false;
    if (dist2(unit.x, unit.z, unit.post.x, unit.post.z) > LEASH * LEASH) return true;
    if (dist2(enemy.x, enemy.z, unit.post.x, unit.post.z) > LEASH * LEASH) return true;
    return false;
}

function hostile(unit, other) {
    if (!other || other.hp <= 0 || other.side === unit.side) return false;
    if (other.haul) return unit.side === "self" && foes.has(other.side);
    if (other.side === "self") return foes.has(unit.side);
    if (unit.side === "self") return foes.has(other.side);
    return false;
}

function nearestFoe(unit) {
    let best = null;
    let bestD = SIGHT * SIGHT;
    for (let i = 0; i < units.length; i++) {
        const other = units[i];
        if (!hostile(unit, other)) continue;
        const d = dist2(unit.x, unit.z, other.x, other.z);
        if (d < bestD && !tooFar(unit, other)) {
            bestD = d;
            best = other;
        }
    }
    for (let i = 0; i < haulers.length; i++) {
        const other = haulers[i];
        if (!hostile(unit, other)) continue;
        const d = dist2(unit.x, unit.z, other.x, other.z);
        if (d < bestD && !tooFar(unit, other)) {
            bestD = d;
            best = other;
        }
    }
    return best;
}

function fell(unit) {
    if (!unit || unit.dying || unit.side === "self") return;
    unit.hp = 0;
    unit.state = "dead";
    unit.dying = 0.9;
    unit.targetId = null;
    const picked = selected.indexOf(unit);
    if (picked >= 0) selected.splice(picked, 1);
}

function bury(unit) {
    if (pilot === unit) leaveBody();
    scene.remove(unit.group);
    const index = units.indexOf(unit);
    if (index >= 0) units.splice(index, 1);
    const picked = selected.indexOf(unit);
    if (picked >= 0) selected.splice(picked, 1);
    for (let i = 0; i < units.length; i++) {
        if (units[i].targetId === unit.id) units[i].targetId = null;
    }
}

function crowded(unit, x, z) {
    const need = BODY * 2;
    for (let i = 0; i < units.length; i++) {
        const other = units[i];
        if (other === unit || !militaryKind(other.kind) || other.side !== unit.side || other.hp <= 0) continue;
        if (Math.hypot(other.x - x, other.z - z) < need) return true;
    }
    return false;
}

function shareRing(foe) {
    const mates = [];
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (!militaryKind(unit.kind) || unit.hp <= 0 || unit.targetId !== foe.id) continue;
        if (unit.state === "move" || unit === pilot) continue;
        mates.push(unit);
    }
    mates.sort((a, b) => dist2(a.x, a.z, foe.x, foe.z) - dist2(b.x, b.z, foe.x, foe.z));
    const used = [];
    for (let i = 0; i < mates.length; i++) {
        const unit = mates[i];
        unit.canHit = false;
        if (i >= SLOTS) {
            const away = Math.atan2(unit.x - foe.x, unit.z - foe.z);
            unit.goal = { x: foe.x + Math.sin(away) * (STAND + 1.5), z: foe.z + Math.cos(away) * (STAND + 1.5) };
            continue;
        }
        const from = Math.atan2(unit.x - foe.x, unit.z - foe.z);
        let best = 0;
        let bestD = Infinity;
        for (let s = 0; s < SLOTS; s++) {
            if (used[s]) continue;
            const ang = s * Math.PI / 2;
            let d = Math.abs(ang - from);
            if (d > Math.PI) d = Math.PI * 2 - d;
            if (d < bestD) {
                bestD = d;
                best = s;
            }
        }
        used[best] = true;
        const ang = best * Math.PI / 2;
        unit.goal = { x: foe.x + Math.sin(ang) * STAND, z: foe.z + Math.cos(ang) * STAND };
        unit.canHit = true;
    }
}

function landSwing(unit, foe) {
    if (foe.hp <= 0) return;
    const blow = soaked(foe, unit.attack != null ? unit.attack : HIT);
    if (foe.haul) {
        foe.hp -= blow;
        if (foe.hp <= 0) loseHorse(foe);
        return;
    }
    foe.hp -= blow;
    if (foe.side === "self") paintSelf();
    if (foe.hp <= 0) {
        if (foe.side === "self") downSelf();
        else fell(foe);
    }
}

function stepFight(dt) {
    const rings = [];
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (unit.side === "self" || !militaryKind(unit.kind) || unit === pilot || unit.state === "move" || unit.hp <= 0) continue;
        let foe = living(unit.targetId);
        if (foe && !hostile(unit, foe)) foe = null;
        if (foe && unit.stance === "guard" && tooFar(unit, foe)) foe = null;
        if (!foe) foe = nearestFoe(unit);
        if (!foe) {
            unit.targetId = null;
            unit.canHit = false;
            unit.swing = 0;
            unit.landed = false;
            if (!unit.orders && unit.stance === "guard" && unit.post && dist2(unit.x, unit.z, unit.post.x, unit.post.z) > 1.44) {
                if (unit.state !== "back") {
                    unit.goal = { x: unit.post.x, z: unit.post.z };
                    unit.state = "back";
                }
            } else if (unit.state === "chase" || unit.state === "strike" || unit.state === "back") unit.state = "idle";
            continue;
        }
        unit.targetId = foe.id;
        if (rings.indexOf(foe.id) < 0) rings.push(foe.id);
    }
    for (let i = 0; i < rings.length; i++) {
        const foe = living(rings[i]);
        if (foe) shareRing(foe);
    }
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (!unit.targetId || !militaryKind(unit.kind) || unit.hp <= 0 || unit.state === "move" || unit === pilot) continue;
        const foe = living(unit.targetId);
        if (!foe) continue;
        unit.yaw = Math.atan2(foe.x - unit.x, foe.z - unit.z);
        unit.group.rotation.y = unit.yaw;
        const dist = Math.hypot(foe.x - unit.x, foe.z - unit.z);
        if (unit.canHit && dist <= REACH) {
            unit.state = "strike";
            unit.swing = (unit.swing || 0) + dt;
            if (!unit.landed && unit.swing >= SWING * 0.45) {
                unit.landed = true;
                landSwing(unit, foe);
            }
            if (unit.swing >= SWING) {
                unit.swing = 0;
                unit.landed = false;
            }
        } else if (unit.state !== "back") {
            unit.state = "chase";
            unit.swing = 0;
            unit.landed = false;
        }
    }
}

function slide(dt) {
    if (pilot) return;
    let x = 0;
    let y = 0;
    if (keys.w || keys.arrowup) y += 1;
    if (keys.s || keys.arrowdown) y -= 1;
    if (keys.a || keys.arrowleft) x += 1;
    if (keys.d || keys.arrowright) x -= 1;
    if (!x && !y) return;
    panBy(x, y, dist * 0.85 * dt);
}

const miniMap = document.getElementById("minimap");
let miniX0 = -3800;
let miniX1 = 3700;
let miniZ0 = -3400;
let miniZ1 = 3600;
let miniBake = null;

function miniColor(h, wet) {
    if (wet || h < 0.12) return h < -2.2 ? [20, 78, 122] : [58, 140, 186];
    if (h < 1.2) return [214, 196, 138];
    if (h > 40) return [186, 182, 174];
    if (h > 22) return [132, 126, 116];
    if (h > 10) return [118, 138, 86];
    if (h > 5) return [86, 138, 68];
    return [70, 124, 58];
}

function bakeBoardMini() {
    const n = board.n;
    const cols = 256;
    const rows = 256;
    miniX0 = board.minX;
    miniX1 = board.minX + board.span;
    miniZ0 = board.minZ;
    miniZ1 = board.minZ + board.span;
    const scratch = document.createElement("canvas");
    scratch.width = cols;
    scratch.height = rows;
    const image = scratch.getContext("2d").createImageData(cols, rows);
    const data = image.data;
    const sea = board.sea;
    for (let row = 0; row < rows; row++) {
        const gz = Math.min(n - 1, Math.round(row / (rows - 1) * (n - 1)));
        for (let col = 0; col < cols; col++) {
            const gx = Math.min(n - 1, Math.round(col / (cols - 1) * (n - 1)));
            const src = gz * n + gx;
            const h = board.heights[src];
            const i = (row * cols + col) * 4;
            if (h < sea) {
                data[i] = 42;
                data[i + 1] = 109;
                data[i + 2] = 134;
            } else if (board.colors) {
                data[i] = Math.round(board.colors[src * 3] * 255);
                data[i + 1] = Math.round(board.colors[src * 3 + 1] * 255);
                data[i + 2] = Math.round(board.colors[src * 3 + 2] * 255);
            } else {
                const lift = Math.max(0, Math.min(1, (h - sea) / 180));
                data[i] = Math.round(86 + lift * 90);
                data[i + 1] = Math.round(122 - lift * 20);
                data[i + 2] = Math.round(64 - lift * 20);
            }
            data[i + 3] = 255;
        }
    }
    scratch.getContext("2d").putImageData(image, 0, 0);
    miniBake = scratch;
}

function bakeMini() {
    if (!miniMap || miniBake) return;
    if (BOARD_URL) {
        if (board) bakeBoardMini();
        return;
    }
    const world = window.World;
    if (!world) return;
    const cols = 300;
    const rows = 280;
    const scratch = document.createElement("canvas");
    scratch.width = cols;
    scratch.height = rows;
    const image = scratch.getContext("2d").createImageData(cols, rows);
    const data = image.data;
    for (let row = 0; row < rows; row++) {
        const z = miniZ0 + (row + 0.5) / rows * (miniZ1 - miniZ0);
        for (let col = 0; col < cols; col++) {
            const x = miniX0 + (col + 0.5) / cols * (miniX1 - miniX0);
            const rgb = miniColor(world.heightAt(x, z), world.wet(x, z));
            const i = (row * cols + col) * 4;
            data[i] = rgb[0];
            data[i + 1] = rgb[1];
            data[i + 2] = rgb[2];
            data[i + 3] = 255;
        }
    }
    scratch.getContext("2d").putImageData(image, 0, 0);
    miniBake = document.createElement("canvas");
    miniBake.width = cols;
    miniBake.height = rows;
    const ctx = miniBake.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(scratch, 0, 0);
    const point = (x, z) => ({
        x: (x - miniX0) / (miniX1 - miniX0) * cols,
        y: (z - miniZ0) / (miniZ1 - miniZ0) * rows
    });
    ctx.strokeStyle = "#3a8ec0";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const chain of world.waterways || []) {
        ctx.beginPath();
        chain.forEach((spot, index) => {
            const p = point(spot[0], spot[1]);
            if (index === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
    }
    if (world.places && world.trackOf) {
        ctx.strokeStyle = "rgba(150, 108, 62, 0.95)";
        ctx.lineWidth = 1.6;
        for (const link of [[0, 1], [0, 2], [2, 3], [1, 3]]) {
            const spots = [world.places[link[0]]]
                .concat(world.trackOf(link[0], link[1]).map((spot) => ({ x: spot[0], z: spot[1] })))
                .concat([world.places[link[1]]]);
            ctx.beginPath();
            spots.forEach((spot, index) => {
                const p = point(spot.x, spot.z);
                if (index === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
        }
    }
    ctx.fillStyle = "rgba(38, 92, 34, 0.42)";
    ctx.strokeStyle = "rgba(28, 68, 26, 0.65)";
    ctx.lineWidth = 1;
    const patches = world.editForests || [];
    for (let i = 0; i < patches.length; i++) {
        const fx = patches[i][0];
        const fz = patches[i][1];
        const fr = patches[i][2];
        const p = point(fx, fz);
        const rx = (fr / (miniX1 - miniX0)) * cols;
        const ry = (fr / (miniZ1 - miniZ0)) * rows;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, Math.max(1.5, rx), Math.max(1.5, ry), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
    for (let i = 0; i < natureData.length; i++) {
        const item = natureData[i];
        if (item.type !== "forest") continue;
        const p = point(item.px, item.pz);
        const rx = ((item.s || 12) / (miniX1 - miniX0)) * cols;
        const ry = ((item.s || 12) / (miniZ1 - miniZ0)) * rows;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, Math.max(1.2, rx), Math.max(1.2, ry), 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

function paintMini() {
    if (!miniBake) bakeMini();
    if (!miniMap || !miniBake) return;
    const ctx = miniMap.getContext("2d");
    const w = miniMap.width;
    const h = miniMap.height;
    const bodyX = pilot ? pilot.x : look.x;
    const bodyZ = pilot ? pilot.z : look.z;
    const face = pilot ? lookYaw + Math.PI : yaw;
    const span = board ? (pilot ? board.span * 0.42 : board.span * 1.08) : 5000;
    const scale = w / span;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-face);
    const destW = (miniX1 - miniX0) * scale;
    const destH = (miniZ1 - miniZ0) * scale;
    ctx.drawImage(miniBake, (miniX0 - bodyX) * scale, (miniZ0 - bodyZ) * scale, destW, destH);
    ctx.lineWidth = 2;
    const marks = [];
    if (home) marks.push({ x: home.x, z: home.z, yours: true });
    if (cpuHome) marks.push({ x: cpuHome.x, z: cpuHome.z, yours: false });
    for (let i = 0; i < marks.length; i++) {
        const sx = (marks[i].x - bodyX) * scale;
        const sy = (marks[i].z - bodyZ) * scale;
        ctx.fillStyle = "#f4efe4";
        ctx.strokeStyle = marks[i].yours ? "#2f6b2a" : "#8a6840";
        ctx.strokeRect(sx - 4, sy - 4, 8, 8);
        ctx.fillRect(sx - 4, sy - 4, 8, 8);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2 - 11);
    ctx.lineTo(w / 2 + 7, h / 2 + 9);
    ctx.lineTo(w / 2 - 7, h / 2 + 9);
    ctx.closePath();
    ctx.fillStyle = "#f2d15a";
    ctx.strokeStyle = "#1c1408";
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    const nx = w / 2 - Math.sin(face) * (w / 2 - 16);
    const ny = h / 2 - Math.cos(face) * (h / 2 - 16);
    ctx.font = "700 13px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(12, 16, 20, 0.85)";
    ctx.fillStyle = "#f7f4ea";
    ctx.strokeText("N", nx, ny);
    ctx.fillText("N", nx, ny);
}

let then = performance.now();
let saveAcc = 0;
let simBacklog = 0;

function stepMatch(dt) {
    walkBody(dt);
    slide(dt);
    refreshLand(false);
    stepCpu(dt);
    stepClock(dt);
    stepHaulers(dt);
    stepFight(dt);
    stepUnits(dt);
    stepSites(dt);
    stepTrains(dt);
    stepArrows(dt);
    stepShowcase(dt);
    saveAcc += dt;
    if (saveAcc > 2) {
        saveAcc = 0;
        writeSave();
    }
}

function pumpSim() {
    const slice = Math.min(simBacklog, 0.4);
    let left = slice;
    while (left > 0.0001) {
        const dt = Math.min(0.05, left);
        stepMatch(dt);
        left -= dt;
    }
    simBacklog = Math.max(0, simBacklog - slice);
    if (simBacklog > 0.05) setTimeout(pumpSim, 0);
}

function noteSimTime(now) {
    const gap = Math.max(0, (now - then) / 1000);
    then = now;
    simBacklog = Math.min(0.5, simBacklog + Math.min(gap, 0.25));
}

function frame(now) {
    requestAnimationFrame(frame);
    try {
        noteSimTime(now);
        if (!document.hidden) pumpSim();
        stepBoardView();
        refreshWalkTrees();
        placeCamera();
        placeBackdrop();
        stepRooms();
        refreshWoods();
        paintMini();
        renderer.render(scene, camera);
    } catch (err) {
        if (!frame.noted) {
            frame.noted = true;
            console.error(err);
        }
    }
}
requestAnimationFrame(frame);
setInterval(() => {
    try { localStorage.setItem("aoe-live", String(Date.now())); } catch (err) { /* the campaign page uses this to avoid a second match */ }
    if (!document.hidden) return;
    noteSimTime(performance.now());
    pumpSim();
}, 1000);

window.addEventListener("pointercancel", (event) => {
    if (lookTouch && event.pointerId === lookTouch.id) lookTouch = null;
    mapDrag = false;
    boxDrag = false;
    boxEl.hidden = true;
});

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
