import * as THREE from "three";

export const MAP_TOKEN = "newmap";

const TREE_FILES = [
    "bamboo01.png", "bamboo02.png", "bamboo03.png", "bamboo04.png", "bamboo05.png", "bamboo06.png",
    "bigtree01.png", "bigtree02.png", "bigtree03.png",
    "bush01.png", "bush02.png", "bush03.png", "bush04.png", "bush05.png",
    "cactus01.png", "cactus02.png", "cactus03.png", "cactus04.png",
    "grasses01.png", "grasses02.png", "grasses03.png", "grasses04.png", "grasses05.png",
    "hemp01.png", "hemp02.png", "hemp03.png",
    "palm01.png", "palm02.png", "palm03.png", "palm04.png", "palm05.png", "palm06.png",
    "pine-full01.png", "pine-full02.png", "pine-full03.png", "pine-full04.png", "pine-full05.png", "pine-full06.png", "pine-full07.png", "pine-full08.png",
    "pine-half01.png", "pine-half02.png", "pine-half03.png", "pine-half04.png", "pine-half05.png", "pine-half06.png", "pine-half07.png", "pine-half08.png",
    "pine-none01.png", "pine-none02.png", "pine-none03.png", "pine-none04.png", "pine-none05.png", "pine-none06.png", "pine-none07.png", "pine-none08.png",
    "shrub1-01.png", "shrub1-02.png", "shrub1-03.png", "shrub1-04.png", "shrub1-05.png",
    "shrub2-01.png", "shrub2-02.png", "shrub2-03.png", "shrub2-04.png", "shrub2-05.png",
    "swirl01.png", "swirl02.png",
    "tropical01.png", "tropical02.png", "tropical03.png", "tropical04.png", "tropical05.png",
    "weed01.png", "weed02.png", "weed03.png", "weed04.png", "weed05.png", "weed06.png"
];

export const TREE_CARDS = TREE_FILES.map((file, index) => ({
    id: "card-" + file.replace(/\.png$/, ""),
    name: String(index + 1),
    file: "2d TREES/isometric tiles/" + file,
    card: true
}));

export const MAP_BUILDINGS = [
    { id: "kit-barracks", name: "Barracks", kit: "barracks" },
    { id: "kit-blacksmith", name: "Blacksmith", kit: "blacksmith" },
    { id: "kit-farm", name: "Farm", kit: "farm" },
    { id: "kit-farm-starter", name: "Farm starter", kit: "farm-starter" },
    { id: "kit-farmhouse", name: "Farmhouse", kit: "farmhouse" },
    { id: "kit-flat-roof-fenced-house", name: "Flat roof fenced house", kit: "flat-roof-fenced-house" },
    { id: "kit-flat-roof-house-with-fence", name: "Flat roof house with fence", kit: "flat-roof-house-with-fence" },
    { id: "kit-gaurdtower", name: "Guard tower", kit: "gaurdtower" },
    { id: "kit-house-1", name: "House 1", kit: "house-1" },
    { id: "kit-house-type-3", name: "House type 3", kit: "house-type-3" },
    { id: "kit-house-type-5", name: "House type 5", kit: "house-type-5" },
    { id: "kit-inn", name: "Inn", kit: "inn" },
    { id: "kit-large-fenced-shop", name: "Large fenced shop", kit: "large-fenced-shop" },
    { id: "kit-lorsmanor-courtyard", name: "Manor", kit: "lorsmanor-courtyard" },
    { id: "kit-lumber-works", name: "Lumber works", kit: "lumber-works" },
    { id: "kit-mine-works", name: "Mine works", kit: "mine-works" },
    { id: "kit-newbuildhouse", name: "New build house", kit: "newbuildhouse" },
    { id: "kit-salt-works", name: "Salt works", kit: "salt-works" },
    { id: "kit-salt-works-ex", name: "Salt works ex", kit: "salt-works-ex" },
    { id: "kit-simple-house", name: "Simple house", kit: "simple-house" },
    { id: "kit-small-house1", name: "Small house", kit: "small-house1" },
    { id: "kit-storehouse", name: "Storehouse", kit: "storehouse" },
    { id: "kit-tall-tower", name: "Tall tower", kit: "tall-tower" }
];

export const MAP_KINDS = [
    { id: "tree", name: "Tree", file: "../models/nature-megakit/glTF/CommonTree_1.gltf" },
    { id: "tree-2", name: "Tree 2", file: "../models/nature-megakit/glTF/CommonTree_2.gltf" },
    { id: "tree-3", name: "Tree 3", file: "../models/nature-megakit/glTF/CommonTree_3.gltf" },
    { id: "rock", name: "Rock", file: "../models/nature-megakit/glTF/Rock_Medium_1.gltf" },
    { id: "rock-2", name: "Rock 2", file: "../models/nature-megakit/glTF/Rock_Medium_2.gltf" },
    { id: "rock-boulder", name: "Boulder", shape: true },
    { id: "rock-wide", name: "Wide rock", shape: true },
    { id: "rock-tall", name: "Tall rock", shape: true },
    { id: "rock-pile", name: "Rock pile", shape: true },
    { id: "rock-scree", name: "Scree", shape: true },
    { id: "mine-stone", name: "Stone mine", shape: true },
    { id: "mine-gold", name: "Gold mine", shape: true },
    { id: "ore-gold", name: "Gold ore", shape: true },
    { id: "ruin", name: "Ruin" },
    { id: "bridge", name: "Bridge" },
    { id: "building", name: "Building" }
];

export function kindById(id) {
    for (let i = 0; i < MAP_KINDS.length; i++) {
        if (MAP_KINDS[i].id === id) return MAP_KINDS[i];
    }
    for (let i = 0; i < TREE_CARDS.length; i++) {
        if (TREE_CARDS[i].id === id) return TREE_CARDS[i];
    }
    for (let i = 0; i < MAP_BUILDINGS.length; i++) {
        if (MAP_BUILDINGS[i].id === id) return MAP_BUILDINGS[i];
    }
    return null;
}

const KIT_SHELL = [
    ["wood", "../models/wood.png"],
    ["plaster", "../models/plaster.png"],
    ["brick", "../models/brick.png"],
    ["rock", "../models/rock.png"],
    ["tiles", "../models/tiles.png"]
];
const kitTextures = {};

function kitTexture(url) {
    if (!kitTextures[url]) {
        kitTextures[url] = new Promise((resolve, reject) => {
            new THREE.TextureLoader().load(url, (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
                resolve(tex);
            }, undefined, reject);
        });
    }
    return kitTextures[url];
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

export function loadKitShell(kitId) {
    return fetch("../models/kitbuild/" + kitId + ".meta.json").then((res) => {
        if (!res.ok) throw new Error(kitId + " description missing");
        return res.json();
    }).then(async (meta) => {
        const group = new THREE.Group();
        const have = meta.materials || [];
        for (let i = 0; i < KIT_SHELL.length; i++) {
            const matName = KIT_SHELL[i][0];
            if (!have.some((item) => item.mat === matName)) continue;
            const [buf, tex] = await Promise.all([
                fetch("../models/kitbuild/" + kitId + "-" + matName + ".bin").then((res) => {
                    if (!res.ok) throw new Error("missing " + matName);
                    return res.arrayBuffer();
                }),
                kitTexture(KIT_SHELL[i][1])
            ]);
            const mat = new THREE.MeshStandardMaterial({
                map: tex,
                vertexColors: true,
                roughness: 0.86,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(kitGeometry(new Float32Array(buf), meta.cx, meta.cz), mat);
            mesh.castShadow = false;
            group.add(mesh);
        }
        if (!group.children.length) throw new Error(kitId + " has no outdoor shell");
        return plantModel(group);
    });
}

const stone = new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 1 });
const wood = new THREE.MeshStandardMaterial({ color: 0x7a5a32, roughness: 1 });
const plaster = new THREE.MeshStandardMaterial({ color: 0xd2c0a2, roughness: 1 });

function box(w, h, d, material, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    return mesh;
}

export function makeStandIn(kind) {
    const group = new THREE.Group();
    if (kind.id === "bridge") {
        group.add(box(2.6, 0.28, 10, wood, 0, 0.7, 0));
        group.add(box(0.18, 0.55, 10, wood, -1.15, 1.05, 0));
        group.add(box(0.18, 0.55, 10, wood, 1.15, 1.05, 0));
    } else if (kind.id === "building") {
        group.add(box(6, 3.4, 4.6, plaster, 0, 1.7, 0));
        const roof = new THREE.Mesh(new THREE.ConeGeometry(4.3, 2, 4), wood);
        roof.position.y = 4.4;
        roof.rotation.y = Math.PI / 4;
        group.add(roof);
    } else {
        group.add(box(4.2, 2.1, 0.45, stone, 0, 1.05, -1.1));
        group.add(box(0.45, 1.5, 2.2, stone, 1.7, 0.75, 0.2));
        group.add(box(1.4, 0.35, 1.1, stone, -0.4, 0.18, 0.8));
    }
    group.traverse((child) => {
        if (child.isMesh) child.castShadow = false;
    });
    return group;
}

const lumpGeom = new THREE.DodecahedronGeometry(1, 0);
const shapeTextures = {};
const shapeMaterials = {};
const mouthMat = new THREE.MeshStandardMaterial({ color: 0x14110e, roughness: 1 });

function shapeMaterial(file, tint) {
    const key = file + ":" + (tint == null ? "" : tint.toString(16));
    if (!shapeMaterials[key]) {
        if (!shapeTextures[file]) {
            const tex = new THREE.TextureLoader().load(file);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(1.4, 1.4);
            shapeTextures[file] = tex;
        }
        shapeMaterials[key] = new THREE.MeshStandardMaterial({
            map: shapeTextures[file],
            color: tint == null ? 0xffffff : tint,
            roughness: 1,
            metalness: 0
        });
    }
    return shapeMaterials[key];
}

function lump(mat, sx, sy, sz, x, y, z, yaw) {
    const mesh = new THREE.Mesh(lumpGeom, mat);
    mesh.scale.set(sx, sy, sz);
    mesh.position.set(x, y, z);
    mesh.rotation.set(0.25, yaw || 0, 0.2);
    return mesh;
}

function mineMound(rock, gold) {
    const group = new THREE.Group();
    group.add(lump(rock, 3.4, 2.3, 2.6, 0, 1.7, -0.6, 0.3));
    group.add(lump(rock, 2.3, 1.7, 2, 2.1, 1.2, 0.2, 1));
    group.add(lump(rock, 2, 1.5, 1.8, -2, 1.1, 0.3, 0.7));
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.35, 1.4), mouthMat);
    mouth.position.set(0.1, 0.75, 1.55);
    group.add(mouth);
    if (gold) {
        group.add(lump(gold, 0.7, 0.5, 0.6, 0.9, 0.4, 1.7, 0.4));
        group.add(lump(gold, 0.5, 0.4, 0.45, -0.5, 0.3, 1.9, 1.2));
    }
    return group;
}

export function makeMapShape(kind) {
    const group = new THREE.Group();
    const rockA = shapeMaterial("rock-a.jpg");
    const rockB = shapeMaterial("rock-b.jpg");
    const rockWide = shapeMaterial("rock-wide.jpg");
    const rockBroad = shapeMaterial("rock-broad.jpg");
    const rockDetail = shapeMaterial("rock-detail.jpg");
    const gold = shapeMaterial("rock-b.jpg", 0xd7a441);
    if (kind.id === "rock-wide") {
        group.add(lump(rockWide, 2.6, 0.7, 1.8, 0, 0.5, 0, 0.4));
    } else if (kind.id === "rock-tall") {
        group.add(lump(rockBroad, 1.1, 2.4, 1, 0, 2.1, 0, 0.8));
    } else if (kind.id === "rock-pile") {
        group.add(lump(rockB, 1.3, 1, 1.2, 0, 0.8, 0, 0.2));
        group.add(lump(rockB, 0.9, 0.7, 0.85, 1.1, 0.5, 0.4, 1.1));
        group.add(lump(rockA, 0.75, 0.6, 0.7, -0.9, 0.45, 0.3, 0.5));
    } else if (kind.id === "rock-scree") {
        group.add(lump(rockDetail, 0.55, 0.35, 0.5, 0, 0.25, 0, 0.3));
        group.add(lump(rockDetail, 0.4, 0.28, 0.38, 0.7, 0.2, 0.25, 0.9));
        group.add(lump(rockDetail, 0.35, 0.24, 0.32, -0.55, 0.18, 0.2, 1.4));
        group.add(lump(rockA, 0.3, 0.2, 0.28, 0.15, 0.16, 0.55, 0.6));
    } else if (kind.id === "mine-stone") {
        group.add(mineMound(rockA, null));
    } else if (kind.id === "mine-gold") {
        group.add(mineMound(rockWide, gold));
    } else if (kind.id === "ore-gold") {
        group.add(lump(gold, 0.85, 0.6, 0.75, 0, 0.45, 0, 0.4));
        group.add(lump(gold, 0.55, 0.4, 0.5, 0.7, 0.3, 0.25, 1));
        group.add(lump(rockB, 0.4, 0.3, 0.38, -0.55, 0.22, 0.2, 0.2));
    } else {
        group.add(lump(rockA, 1.7, 1.35, 1.55, 0, 1.15, 0, 0.5));
    }
    return plantModel(group);
}

export function plantModel(root) {
    root.updateMatrixWorld(true);
    let minY = Infinity;
    const point = new THREE.Vector3();
    root.traverse((child) => {
        if (!child.isMesh || !child.geometry || !child.geometry.attributes.position) return;
        const pos = child.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            point.fromBufferAttribute(pos, i);
            child.localToWorld(point);
            if (point.y < minY) minY = point.y;
        }
    });
    const holder = new THREE.Group();
    if (minY < Infinity) root.position.y -= minY;
    root.traverse((child) => {
        if (child.isMesh) child.castShadow = false;
    });
    holder.add(root);
    return holder;
}
