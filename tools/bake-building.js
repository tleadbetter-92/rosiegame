const fs = require("fs");
const path = require("path");

const srcVillage = path.join(__dirname, "..", "models", "village-megakit", "glTF");
const srcFantasy = path.join(__dirname, "..", "models", "fantasy-props", "glTF");
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
    "T_UnevenBrick_BaseColor.png": "brick",
    "T_Mosaic_Terra_BaseColor.png": "mosaicTerra",
    "T_Mosaic_BlackWhite_BaseColor.png": "mosaicBW",
    "T_Mosaic_Medallion_BaseColor.png": "mosaicMed",
    "T_Mosaic_Meander_BaseColor.png": "mosaicMeander",
    "T_Mosaic_PolyHaven_BaseColor.jpg": "mosaicPH",
    "T_Trim_Furniture_BaseColor.png": "furniture",
    "T_Trim_Metal_BaseColor.png": "propmetal",
    "T_Trim_Cloth_BaseColor.png": "propcloth",
    "T_Trim_Props_BaseColor.png": "proppack"
};

function gltfSrcDir(name) {
    const v = path.join(srcVillage, name + ".gltf");
    if (fs.existsSync(v)) return srcVillage;
    const f = path.join(srcFantasy, name + ".gltf");
    if (fs.existsSync(f)) return srcFantasy;
    return null;
}

function loadGltf(name) {
    const dir = gltfSrcDir(name);
    if (!dir) throw new Error("Missing glTF: " + name);
    const gltfPath = path.join(dir, name + ".gltf");
    const gltf = JSON.parse(fs.readFileSync(gltfPath, "utf8"));
    const bin = fs.readFileSync(path.join(dir, gltf.buffers[0].uri));
    return { gltf, bin, dir };
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
function isOverhangCorner2(name) {
    return /OverhangCorner2$/.test(name);
}
function gltfSourceName(name) {
    return isOverhangCorner2(name) ? name.replace(/2$/, "") : name;
}
function mirrorXZ(v) {
    return [-v[0], v[1], -v[2]];
}

function piece(name) {
    if (cache[name]) return cache[name];
    const srcName = gltfSourceName(name);
    const mirror = isOverhangCorner2(name);
    const { gltf, bin } = loadGltf(srcName);
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
            for (let i = 0; i < idx.length; i += 3) {
                const tri = mirror ? [idx[i], idx[i + 2], idx[i + 1]] : [idx[i], idx[i + 1], idx[i + 2]];
                for (let t = 0; t < 3; t++) {
                    const v = tri[t];
                    const p = mirror ? mirrorXZ(pos[v]) : pos[v];
                    const n = mirror ? mirrorXZ(nrm[v]) : nrm[v];
                    list.push([p, n, uv[v]]);
                }
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

function fenceBox(p) {
    const yaw = p.yaw || 0;
    const alongX = wallAlongX(yaw);
    const len = 1.9;
    const thick = 0.22;
    const w = alongX ? len : thick;
    const d = alongX ? thick : len;
    const tall = String(p.id).includes("Wooden") ? 1.05 : 2.7;
    return {
        x: p.x - w / 2,
        z: p.z - d / 2,
        w,
        d,
        y0: p.y || 0,
        y1: (p.y || 0) + tall,
        stair: false
    };
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

const stairBoundCache = {};
function stairBounds(name) {
    if (stairBoundCache[name]) return stairBoundCache[name];
    const { gltf } = loadGltf(gltfSourceName(name));
    const acc = gltf.accessors.find((item) => item.type === "VEC3" && item.min && item.max);
    const box = {
        minX: acc.min[0],
        maxX: acc.max[0],
        minY: Math.min(0, acc.min[1]),
        maxY: acc.max[1],
        minZ: acc.min[2],
        maxZ: acc.max[2]
    };
    stairBoundCache[name] = box;
    return box;
}

function turnedRect(px, pz, yaw, x, z, w, d) {
    const corners = [[x, z], [x + w, z], [x, z + d], [x + w, z + d]];
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < corners.length; i++) {
        const p = turn(corners[i][0], 0, corners[i][1], yaw);
        const wx = px + p[0];
        const wz = pz + p[2];
        if (wx < minX) minX = wx;
        if (wx > maxX) maxX = wx;
        if (wz < minZ) minZ = wz;
        if (wz > maxZ) maxZ = wz;
    }
    return { x: minX, z: minZ, w: Math.max(0.25, maxX - minX), d: Math.max(0.25, maxZ - minZ) };
}

// The stair mesh starts at the pivot and climbs toward local -Z, for its real length and height.
function stairBoxes(p) {
    const box = stairBounds(p.id);
    const yaw = p.yaw || 0;
    const yBase = p.y || 0;
    const rise = Math.max(0.25, box.maxY - box.minY);
    const length = Math.max(0.45, box.maxZ - box.minZ);
    const steps = Math.max(2, Math.round(rise / 0.32));
    const run = length / steps;
    const floors = [];
    for (let i = 0; i < steps; i++) {
        const zFar = box.maxZ - i * run;
        const zNear = box.maxZ - (i + 1) * run;
        const py = yBase + ((i + 1) / steps) * rise;
        const rect = turnedRect(p.x, p.z, yaw, box.minX, zNear - 0.05, box.maxX - box.minX, zFar - zNear + 0.1);
        floors.push({
            x: rect.x,
            z: rect.z,
            w: rect.w,
            d: rect.d,
            y: +(py - 0.04).toFixed(3),
            stair: true
        });
    }
    return { solids: [], floors };
}

function physicsFromPieces(pieces) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let maxY = 0;
    const solids = [];
    const floors = [];
    const doorAnchors = [];

    for (const p of pieces) {
        const id = p.id;
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z);
        maxZ = Math.max(maxZ, p.z);
        maxY = Math.max(maxY, (p.y || 0) + STOREY);
        if (id.startsWith("Wall_")) {
            if (id.includes("_Door_")) {
                doorAnchors.push(p);
                continue;
            }
            solids.push(wallBox(p));
        } else if (id.startsWith("DoorFrame_")) {
            doorAnchors.push(p);
        } else if (id.includes("Fence")) {
            solids.push(fenceBox(p));
        } else if (id.startsWith("Stair")) {
            const stair = stairBoxes(p);
            floors.push(...stair.floors);
        } else if (id.startsWith("Floor_")) {
            floors.push({
                x: p.x - 1,
                z: p.z - 1,
                w: 2,
                d: 2,
                y: (p.y || 0) + 0.06,
                stair: false
            });
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
    const doors = doorAnchors.map((doorAnchor) => {
        const yaw = doorAnchor.yaw || 0;
        const s = Math.sin(yaw);
        const c = Math.cos(yaw);
        return {
            x: doorAnchor.x,
            z: doorAnchor.z,
            y: doorAnchor.y || 0,
            fx: -s,
            fz: -c,
            yaw,
            wide: 0.56
        };
    });
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
    const fromV = path.join(srcVillage, uri);
    const fromF = path.join(srcFantasy, uri);
    const from = fs.existsSync(fromV) ? fromV : fromF;
    if (fs.existsSync(from)) {
        const ext = path.extname(uri) || ".png";
        fs.copyFileSync(from, path.join(texOut, names[uri] + ext));
    }
}
console.log("Wrote", path.join(outDir, outName + ".meta.json"), "center", cx.toFixed(2), cz.toFixed(2));
