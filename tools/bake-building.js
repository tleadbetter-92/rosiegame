const fs = require("fs");
const path = require("path");

const srcVillage = path.join(__dirname, "..", "models", "village-megakit", "glTF");
const srcFantasy = path.join(__dirname, "..", "models", "fantasy-props", "glTF");
const srcRetro = path.join(__dirname, "..", "models", "retro-medieval", "glb");
const srcVillageBuilder = path.join(__dirname, "building-editor", "Village_Builder", "glTF");
const srcInteriors = path.join(__dirname, "building-editor", "Interiors_Furniture", "glTF");
const srcFood = path.join(__dirname, "building-editor", "Food_Market", "glTF");
const srcTavern = path.join(__dirname, "building-editor", "Tavern", "glTF");
const tavernTex = JSON.parse(fs.readFileSync(path.join(__dirname, "building-editor", "tavern-textures.json"), "utf8"));
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
    "T_Trim_Props_BaseColor.png": "proppack",
    "cobblestone.png": "retroCobble",
    "cobblestoneAlternative.png": "retroCobbleAlt",
    "cobblestonePainted.png": "retroCobblePaint",
    "planks.png": "retroPlanks",
    "roof.png": "retroRoof",
    "barrel.png": "retroBarrel",
    "details.png": "retroDetails",
    "fence.png": "retroFence",
    "tree.png": "retroTree",
    "water.png": "retroWater"
};

function parseGlb(buf) {
    const jsonLen = buf.readUInt32LE(12);
    const gltf = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
    const binStart = 20 + jsonLen;
    const binLen = buf.readUInt32LE(binStart);
    return { gltf, bin: buf.slice(binStart + 8, binStart + 8 + binLen) };
}

function gltfSrcDir(name) {
    const v = path.join(srcVillage, name + ".gltf");
    if (fs.existsSync(v)) return srcVillage;
    const f = path.join(srcFantasy, name + ".gltf");
    if (fs.existsSync(f)) return srcFantasy;
    const r = path.join(srcRetro, name + ".glb");
    if (fs.existsSync(r)) return srcRetro;
    const b = path.join(srcVillageBuilder, name + ".glb");
    if (fs.existsSync(b)) return srcVillageBuilder;
    const interior = path.join(srcInteriors, name + ".glb");
    if (fs.existsSync(interior)) return srcInteriors;
    const food = path.join(srcFood, name + ".glb");
    if (fs.existsSync(food)) return srcFood;
    const tavern = path.join(srcTavern, name + ".glb");
    if (fs.existsSync(tavern)) return srcTavern;
    return null;
}

function loadGltf(name) {
    const dir = gltfSrcDir(name);
    if (!dir) throw new Error("Missing glTF: " + name);
    if (dir === srcRetro || dir === srcVillageBuilder || dir === srcInteriors || dir === srcFood || dir === srcTavern) return parseGlb(fs.readFileSync(path.join(dir, name + ".glb")));
    const gltfPath = path.join(dir, name + ".gltf");
    const gltf = JSON.parse(fs.readFileSync(gltfPath, "utf8"));
    const bin = fs.readFileSync(path.join(dir, gltf.buffers[0].uri));
    return { gltf, bin, dir };
}

function readVertexColors(gltf, bin, prim) {
    if (prim.attributes.COLOR_0 == null) return null;
    const acc = gltf.accessors[prim.attributes.COLOR_0];
    if (!acc) return null;
    const view = gltf.bufferViews[acc.bufferView];
    const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
    const comps = acc.type === "VEC4" ? 4 : acc.type === "VEC3" ? 3 : 0;
    if (!comps) return null;
    const bytes = acc.componentType === 5126 ? 4 : acc.componentType === 5121 ? 1 : 2;
    const stride = view.byteStride || comps * bytes;
    const scale = acc.normalized ? (acc.componentType === 5123 ? 65535 : acc.componentType === 5121 ? 255 : 1) : 1;
    const out = [];
    for (let i = 0; i < acc.count; i++) {
        const offset = start + i * stride;
        let r = 1;
        let g = 1;
        let b = 1;
        if (acc.componentType === 5126) {
            r = bin.readFloatLE(offset);
            g = bin.readFloatLE(offset + 4);
            b = bin.readFloatLE(offset + 8);
        } else if (acc.componentType === 5123) {
            r = bin.readUInt16LE(offset) / scale;
            g = bin.readUInt16LE(offset + 2) / scale;
            b = bin.readUInt16LE(offset + 4) / scale;
        } else if (acc.componentType === 5121) {
            r = bin.readUInt8(offset) / scale;
            g = bin.readUInt8(offset + 1) / scale;
            b = bin.readUInt8(offset + 2) / scale;
        } else {
            return null;
        }
        out.push([r, g, b]);
    }
    return out;
}

function readAccessor(gltf, bin, index) {
    const acc = gltf.accessors[index];
    const view = gltf.bufferViews[acc.bufferView];
    const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
    const stride = view.byteStride || 0;
    const width = acc.type === "VEC3" ? 3 : acc.type === "VEC2" ? 2 : 1;
    const out = [];
    for (let i = 0; i < acc.count; i++) {
        const bytes = acc.componentType === 5126 ? 4 : acc.componentType === 5121 ? 1 : 2;
        const offset = start + (stride ? i * stride : i * width * bytes);
        if (acc.componentType === 5126) {
            const value = [];
            for (let k = 0; k < width; k++) value.push(bin.readFloatLE(offset + k * 4));
            out.push(value);
        } else if (acc.componentType === 5121) {
            out.push(bin.readUInt8(offset));
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

function tavernKey(label) {
    const stem = String(label || "").split("/").pop().replace(/\.(jpg|jpeg|png)$/i, "");
    if (!tavernTex[stem]) return null;
    return "tv" + stem.replace(/[^A-Za-z0-9]/g, "");
}

function baseColor(gltf, materialIndex, forceKey) {
    if (forceKey) return forceKey;
    const material = gltf.materials[materialIndex];
    const texture = material && material.pbrMetallicRoughness && material.pbrMetallicRoughness.baseColorTexture;
    if (!texture) return "wood";
    const image = gltf.images[gltf.textures[texture.index].source];
    const packed = tavernKey(image && (image.name || image.uri));
    if (packed) return packed;
    const uri = image && image.uri;
    if (!uri) return "wood";
    const base = uri.split("/").pop();
    return names[base] || names[uri] || "wood";
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
    const srcDir = gltfSrcDir(srcName);
    const palette = srcDir === srcVillageBuilder || srcDir === srcInteriors || srcDir === srcFood ? "villagePalette" : null;
    const groups = {};
    for (const mesh of gltf.meshes) {
        for (const prim of mesh.primitives) {
            const key = baseColor(gltf, prim.material, palette);
            const pos = readAccessor(gltf, bin, prim.attributes.POSITION);
            const nrm = readAccessor(gltf, bin, prim.attributes.NORMAL);
            const uv = readAccessor(gltf, bin, prim.attributes.TEXCOORD_0);
            const idx = readAccessor(gltf, bin, prim.indices);
            const colors = readVertexColors(gltf, bin, prim);
            if (!groups[key]) groups[key] = [];
            const list = groups[key];
            for (let i = 0; i < idx.length; i += 3) {
                const tri = mirror ? [idx[i], idx[i + 2], idx[i + 1]] : [idx[i], idx[i + 1], idx[i + 2]];
                for (let t = 0; t < 3; t++) {
                    const v = tri[t];
                    const p = mirror ? mirrorXZ(pos[v]) : pos[v];
                    const n = mirror ? mirrorXZ(nrm[v]) : nrm[v];
                    let uu = uv[v][0];
                    let vv = uv[v][1];
                    // The sack picture sits just under the pale cloth this bag was pointed at.
                    if (srcName === "Bag" && key === "propcloth") vv -= 0.25;
                    const color = colors ? colors[v] : [1, 1, 1];
                    list.push([p, n, [uu, vv], color]);
                }
            }
        }
    }
    cache[name] = groups;
    return groups;
}

function addPiece(groups, tints, name, x, y, z, yaw) {
    const parts = piece(name);
    for (const key of Object.keys(parts)) {
        if (!groups[key]) groups[key] = [];
        if (!tints[key]) tints[key] = [];
        const list = groups[key];
        const rgb = tints[key];
        const src = parts[key];
        for (let i = 0; i < src.length; i++) {
            const p = turn(src[i][0][0], src[i][0][1], src[i][0][2], yaw);
            const n = turn(src[i][1][0], src[i][1][1], src[i][1][2], yaw);
            const u = src[i][2][0];
            // The wagon's broad boards sit on the pale stone band of the trim sheet. Shift them onto the brown planks.
            let v = 1 - src[i][2][1];
            if (name === "Prop_Wagon") v = Math.max(0.02, Math.min(0.62, v - 0.4));
            const s = shade(n);
            const color = src[i][3] || [1, 1, 1];
            list.push(
                +(p[0] + x).toFixed(4),
                +(p[1] + y).toFixed(4),
                +(p[2] + z).toFixed(4),
                +u.toFixed(4),
                +v.toFixed(4),
                +s.toFixed(4)
            );
            rgb.push(+color[0].toFixed(4), +color[1].toFixed(4), +color[2].toFixed(4));
        }
    }
}

const building = JSON.parse(fs.readFileSync(buildingPath, "utf8"));
const groups = {};
const tints = {};
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
    addPiece(groups, tints, p.id, p.x, p.y || 0, p.z, p.yaw || 0);
}

const cx = (minX + maxX) / 2;
const cz = (minZ + maxZ) / 2;

fs.mkdirSync(outDir, { recursive: true });
const meta = { kind: "kitbuild", name: building.name || outName, cx, cz, materials: [] };
for (const [mat, list] of Object.entries(groups)) {
    if (!list.length) continue;
    const buf = Buffer.from(new Float32Array(list).buffer);
    fs.writeFileSync(path.join(outDir, outName + "-" + mat + ".bin"), buf);
    const rgb = tints[mat] || [];
    let tinted = false;
    for (let i = 0; i < rgb.length; i += 3) {
        if (rgb[i] < 0.97 || rgb[i + 1] < 0.97 || rgb[i + 2] < 0.97) {
            tinted = true;
            break;
        }
    }
    const entry = { mat, verts: list.length / 6 };
    if (tinted) {
        const bytes = Buffer.alloc((rgb.length / 3) * 4);
        for (let i = 0, v = 0; i < rgb.length; i += 3, v += 4) {
            bytes[v] = Math.max(0, Math.min(255, Math.round(rgb[i] * 255)));
            bytes[v + 1] = Math.max(0, Math.min(255, Math.round(rgb[i + 1] * 255)));
            bytes[v + 2] = Math.max(0, Math.min(255, Math.round(rgb[i + 2] * 255)));
            bytes[v + 3] = 255;
        }
        fs.writeFileSync(path.join(outDir, outName + "-" + mat + ".rgb.bin"), bytes);
        entry.tint = true;
        console.log(outName + "-" + mat + ".rgb.bin", rgb.length / 3, "colours");
    }
    meta.materials.push(entry);
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

function retroSolid(id) {
    return /^(wall|battlement|column|tower|structure|fence)(-|$)/.test(id) && !/door|gate/.test(id);
}

function villageSolid(id) {
    return (id.startsWith("mdvl_village_wall_") || id.startsWith("mdvl_village_inwall_")) && id.indexOf("door") === -1;
}

function retroFloor(id) {
    return /^(floor|wood-floor)(-|$)/.test(id);
}

function tavernBlock(id) {
    return /^wall01/.test(id) || /^column0/.test(id) || /^crate/.test(id) || /^keg/.test(id);
}

function meshBounds(name) {
    const { gltf } = loadGltf(name);
    let best = null;
    let bestSpan = -1;
    for (const acc of gltf.accessors || []) {
        if (!acc || acc.type !== "VEC3" || !acc.min || !acc.max) continue;
        const span = (acc.max[0] - acc.min[0]) + (acc.max[1] - acc.min[1]) + (acc.max[2] - acc.min[2]);
        if (span > bestSpan) {
            bestSpan = span;
            best = acc;
        }
    }
    if (!best) return null;
    return {
        minX: best.min[0],
        maxX: best.max[0],
        minY: best.min[1],
        maxY: best.max[1],
        minZ: best.min[2],
        maxZ: best.max[2]
    };
}

function retroBounds(name) {
    const { gltf } = loadGltf(name);
    const acc = (gltf.accessors || []).find((item) =>
        item && item.type === "VEC3" && item.min && item.max && item.min[1] >= -0.02 && item.max[1] < 3 && item.max[1] > item.min[1]
    );
    if (!acc) return null;
    return {
        minX: acc.min[0],
        maxX: acc.max[0],
        minY: acc.min[1],
        maxY: acc.max[1],
        minZ: acc.min[2],
        maxZ: acc.max[2]
    };
}

function writeDoorLeaf(id, file) {
    const parts = piece(id);
    const src = parts.wood || [];
    if (!src.length) return;
    let minX = Infinity;
    let maxX = -Infinity;
    let maxY = 0;
    for (let i = 0; i < src.length; i++) {
        minX = Math.min(minX, src[i][0][0]);
        maxX = Math.max(maxX, src[i][0][0]);
        maxY = Math.max(maxY, src[i][0][1]);
    }
    const spanX = Math.max(0.2, maxX - minX);
    const floats = [];
    for (let i = 0; i < src.length; i++) {
        const p = src[i][0];
        const n = src[i][1];
        const u = (p[0] - minX) / spanX;
        const v = maxY > 0.2 ? p[1] / maxY : 0;
        floats.push(+(p[0] - minX).toFixed(4), +p[1].toFixed(4), +p[2].toFixed(4), +u.toFixed(4), +v.toFixed(4), +shade(n).toFixed(4));
    }
    fs.writeFileSync(path.join(outDir, file), Buffer.from(new Float32Array(floats).buffer));
    console.log(file, floats.length / 6, "verts");
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
        if (retroSolid(id) || villageSolid(id)) {
            const box = retroBounds(id);
            if (box) {
                const rect = turnedRect(p.x, p.z, p.yaw || 0, box.minX, box.minZ, box.maxX - box.minX, box.maxZ - box.minZ);
                solids.push({
                    x: rect.x,
                    z: rect.z,
                    w: rect.w,
                    d: rect.d,
                    y0: (p.y || 0) + box.minY,
                    y1: (p.y || 0) + box.maxY,
                    stair: false
                });
            }
        } else if (retroFloor(id)) {
            const box = retroBounds(id);
            if (box) {
                const rect = turnedRect(p.x, p.z, p.yaw || 0, box.minX, box.minZ, box.maxX - box.minX, box.maxZ - box.minZ);
                floors.push({
                    x: rect.x,
                    z: rect.z,
                    w: rect.w,
                    d: rect.d,
                    y: (p.y || 0) + box.maxY,
                    stair: false
                });
            }
        } else if (id.startsWith("Wall_")) {
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
        } else if (tavernBlock(id)) {
            const box = meshBounds(id);
            if (box) {
                const rect = turnedRect(p.x, p.z, p.yaw || 0, box.minX, box.minZ, box.maxX - box.minX, box.maxZ - box.minZ);
                solids.push({
                    x: rect.x,
                    z: rect.z,
                    w: rect.w,
                    d: rect.d,
                    y0: (p.y || 0) + box.minY,
                    y1: (p.y || 0) + box.maxY,
                    stair: false
                });
            }
        } else if (id === "tavern-floor") {
            const box = meshBounds(id);
            if (box) {
                const rect = turnedRect(p.x, p.z, p.yaw || 0, box.minX, box.minZ, box.maxX - box.minX, box.maxZ - box.minZ);
                floors.push({
                    x: rect.x,
                    z: rect.z,
                    w: rect.w,
                    d: rect.d,
                    y: (p.y || 0) + box.maxY,
                    stair: false
                });
            }
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
    for (let i = 0; i < doorAnchors.length; i++) {
        const doorAnchor = doorAnchors[i];
        const y = doorAnchor.y || 0;
        let twin = false;
        for (let k = 0; k < doors.length; k++) {
            if (Math.abs((doors[k].y || 0) - y) > 0.5) continue;
            if (Math.hypot(doors[k].x - doorAnchor.x, doors[k].z - doorAnchor.z) < 1.15) {
                twin = true;
                break;
            }
        }
        if (twin) continue;
        const yaw = doorAnchor.yaw || 0;
        const s = Math.sin(yaw);
        const c = Math.cos(yaw);
        let shape = "flat";
        let best = 1.4;
        for (let p = 0; p < pieces.length; p++) {
            const piece = pieces[p];
            if (!piece.id || piece.id.indexOf("Door_1_") !== 0) continue;
            if (Math.abs((piece.y || 0) - y) > 0.5) continue;
            const dist = Math.hypot(piece.x - doorAnchor.x, piece.z - doorAnchor.z);
            if (dist < best) {
                best = dist;
                shape = piece.id.indexOf("Round") >= 0 ? "round" : "flat";
            }
        }
        doors.push({
            x: doorAnchor.x,
            z: doorAnchor.z,
            y,
            fx: -s,
            fz: -c,
            yaw,
            wide: 0.56,
            shape
        });
    }
    if (!String(outName).startsWith("tavern-")) {
        floors.push({
            x: shell.minX + 0.45,
            z: shell.minZ + 0.45,
            w: Math.max(1.2, shell.w - 0.9),
            d: Math.max(1.2, shell.d - 0.9),
            y: 0.06,
            stair: false
        });
    }
    return { cx, cz, shell, solids, floors, doors };
}

writeDoorLeaf("Door_1_Round", "leaf-round.bin");
writeDoorLeaf("Door_1_Flat", "leaf-flat.bin");

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
