const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "models", "village-megakit", "glTF");
const outDir = path.join(__dirname, "..", "models", "kitbuild");
const buildingPath = process.argv[2] || path.join(__dirname, "testbuild.json");
const outName = process.argv[3] || "testbuild";

const names = {
    "T_Plaster_BaseColor.png": "plaster",
    "T_WoodTrim_BaseColor.png": "wood",
    "T_RoundTiles_BaseColor.png": "tiles",
    "T_Brick_BaseColor.png": "brick",
    "T_MetalOrnaments_BaseColor.png": "metal",
    "T_RockTrim_BaseColor.png": "rock",
    "T_RedBrick_BaseColor.png": "brick",
    "T_UnevenBrick_BaseColor.png": "brick"
};

function loadGltf(name) {
    const gltfPath = path.join(src, name + ".gltf");
    if (!fs.existsSync(gltfPath)) throw new Error("Missing glTF: " + name);
    const gltf = JSON.parse(fs.readFileSync(gltfPath, "utf8"));
    const bin = fs.readFileSync(path.join(src, gltf.buffers[0].uri));
    return { gltf, bin };
}

function readAccessor(gltf, bin, index) {
    const acc = gltf.accessors[index];
    const view = gltf.bufferViews[acc.bufferView];
    const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
    const stride = view.byteStride || 0;
    const width = acc.type === "VEC3" ? 3 : acc.type === "VEC2" ? 2 : 1;
    const out = [];
    for (let i = 0; i < acc.count; i++) {
        const offset = start + (stride ? i * stride : i * width * (acc.componentType === 5126 ? 4 : 2));
        if (acc.componentType === 5126) {
            const value = [];
            for (let k = 0; k < width; k++) value.push(bin.readFloatLE(offset + k * 4));
            out.push(value);
        } else if (acc.componentType === 5123) {
            out.push(bin.readUInt16LE(offset));
        } else if (acc.componentType === 5125) {
            out.push(bin.readUInt32LE(offset));
        } else {
            throw new Error("Unsupported component " + acc.componentType);
        }
    }
    return out;
}

function baseColor(gltf, materialIndex) {
    const material = gltf.materials[materialIndex];
    const texture = material.pbrMetallicRoughness && material.pbrMetallicRoughness.baseColorTexture;
    if (!texture) return "wood";
    const uri = gltf.images[gltf.textures[texture.index].source].uri;
    return names[uri] || "wood";
}

function turn(x, y, z, yaw) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return [x * c + z * s, y, -x * s + z * c];
}

function shade(n) {
    const dot = Math.abs(n[1]) * 0.35 + Math.abs(n[0]) * 0.15 + Math.abs(n[2]) * 0.25;
    return Math.min(1, Math.max(0.45, 0.55 + dot));
}

const cache = {};
function piece(name) {
    if (cache[name]) return cache[name];
    const { gltf, bin } = loadGltf(name);
    const groups = {};
    for (const mesh of gltf.meshes) {
        for (const prim of mesh.primitives) {
            const key = baseColor(gltf, prim.material);
            const pos = readAccessor(gltf, bin, prim.attributes.POSITION);
            const nrm = readAccessor(gltf, bin, prim.attributes.NORMAL);
            const uv = readAccessor(gltf, bin, prim.attributes.TEXCOORD_0);
            const idx = readAccessor(gltf, bin, prim.indices);
            if (!groups[key]) groups[key] = [];
            const list = groups[key];
            for (let i = 0; i < idx.length; i++) {
                const v = idx[i];
                list.push([pos[v], nrm[v], uv[v]]);
            }
        }
    }
    cache[name] = groups;
    return groups;
}

function addPiece(groups, name, x, y, z, yaw) {
    const parts = piece(name);
    for (const key of Object.keys(parts)) {
        if (!groups[key]) groups[key] = [];
        const list = groups[key];
        const src = parts[key];
        for (let i = 0; i < src.length; i++) {
            const p = turn(src[i][0][0], src[i][0][1], src[i][0][2], yaw);
            const n = turn(src[i][1][0], src[i][1][1], src[i][1][2], yaw);
            const u = src[i][2][0];
            const v = 1 - src[i][2][1];
            const s = shade(n);
            list.push(
                +(p[0] + x).toFixed(4),
                +(p[1] + y).toFixed(4),
                +(p[2] + z).toFixed(4),
                +u.toFixed(4),
                +v.toFixed(4),
                +s.toFixed(4)
            );
        }
    }
}

const building = JSON.parse(fs.readFileSync(buildingPath, "utf8"));
const groups = {};
let minX = Infinity;
let maxX = -Infinity;
let minZ = Infinity;
let maxZ = -Infinity;
for (const p of building.pieces) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
    if (p.id.startsWith("Door_")) continue;
    addPiece(groups, p.id, p.x, p.y || 0, p.z, p.yaw || 0);
}

const cx = (minX + maxX) / 2;
const cz = (minZ + maxZ) / 2;

fs.mkdirSync(outDir, { recursive: true });
const meta = { kind: "kitbuild", name: building.name || outName, cx, cz, materials: [] };
for (const [mat, list] of Object.entries(groups)) {
    if (!list.length) continue;
    const buf = Buffer.from(new Float32Array(list).buffer);
    fs.writeFileSync(path.join(outDir, outName + "-" + mat + ".bin"), buf);
    meta.materials.push({ mat, verts: list.length / 6 });
    console.log(outName + "-" + mat + ".bin", list.length / 6, "verts");
}
fs.writeFileSync(path.join(outDir, outName + ".meta.json"), JSON.stringify(meta, null, 2));

const STOREY = 3.05;
const WALL_T = 0.36;

function wallAlongX(yaw) {
    return Math.abs(Math.cos(yaw)) >= Math.abs(Math.sin(yaw));
}

function wallBox(p) {
    const yaw = p.yaw || 0;
    const alongX = wallAlongX(yaw);
    const len = 2;
    const w = alongX ? len : WALL_T;
    const d = alongX ? WALL_T : len;
    return {
        x: p.x - w / 2,
        z: p.z - d / 2,
        w,
        d,
        y0: p.y || 0,
        y1: (p.y || 0) + STOREY,
        stair: false
    };
}

function stairBoxes(p) {
    const yaw = p.yaw || 0;
    const alongX = wallAlongX(yaw);
    const len = 1.9;
    const w = alongX ? len : 1.35;
    const d = alongX ? 1.35 : len;
    const x = p.x - w / 2;
    const z = p.z - d / 2;
    const y0 = p.y || 0;
    const solids = [{ x, z, w, d, y0, y1: y0 + STOREY, stair: true }];
    const floors = [];
    const steps = 5;
    for (let i = 0; i < steps; i++) {
        const py = y0 + ((i + 1) / steps) * STOREY;
        const run = d / steps;
        floors.push({
            x,
            z: z + (alongX ? 0 : i * run),
            w: alongX ? w / steps : w,
            d: alongX ? d : run,
            y: py - 0.08,
            stair: true
        });
    }
    floors.push({ x, z, w, d, y: y0 + STOREY, stair: false });
    return { solids, floors };
}

function physicsFromPieces(pieces) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let maxY = 0;
    const solids = [];
    const floors = [];
    let doorAnchor = null;

    for (const p of pieces) {
        const id = p.id;
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z);
        maxZ = Math.max(maxZ, p.z);
        maxY = Math.max(maxY, (p.y || 0) + STOREY);
        if (id.startsWith("Wall_")) {
            if (id.includes("_Door_")) {
                doorAnchor = p;
                continue;
            }
            solids.push(wallBox(p));
        } else if (id.startsWith("DoorFrame_")) {
            if (!doorAnchor) doorAnchor = p;
        } else if (id.startsWith("Stair")) {
            const stair = stairBoxes(p);
            solids.push(...stair.solids);
            floors.push(...stair.floors);
        }
    }

    const shell = {
        minX: minX - 1,
        minZ: minZ - 1,
        w: maxX - minX + 2,
        d: maxZ - minZ + 2,
        y0: 0,
        h: maxY
    };
    const doors = [];
    if (doorAnchor) {
        const yaw = doorAnchor.yaw || 0;
        const s = Math.sin(yaw);
        const c = Math.cos(yaw);
        doors.push({
            x: doorAnchor.x,
            z: doorAnchor.z,
            y: doorAnchor.y || 0,
            fx: -s,
            fz: -c,
            yaw,
            wide: 0.56
        });
    }
    floors.push({
        x: shell.minX + 0.45,
        z: shell.minZ + 0.45,
        w: Math.max(1.2, shell.w - 0.9),
        d: Math.max(1.2, shell.d - 0.9),
        y: 0.06,
        stair: false
    });
    return { cx, cz, shell, solids, floors, doors };
}

const physics = physicsFromPieces(building.pieces);
fs.writeFileSync(path.join(outDir, outName + ".physics.json"), JSON.stringify(physics, null, 2));
console.log(outName + ".physics.json", "solids", physics.solids.length, "doors", physics.doors.length);

const texOut = path.join(__dirname, "..", "models");
for (const uri of Object.keys(names)) {
    const from = path.join(src, uri);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(texOut, names[uri] + ".png"));
}
console.log("Wrote", path.join(outDir, outName + ".meta.json"), "center", cx.toFixed(2), cz.toFixed(2));
