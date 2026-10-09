const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "art", "medieval-village", "glTF");
const outDir = path.join(__dirname, "..", "models");
const names = {
    "T_Plaster_BaseColor.png": "plaster",
    "T_WoodTrim_BaseColor.png": "wood",
    "T_RoundTiles_BaseColor.png": "tiles",
    "T_Brick_BaseColor.png": "brick",
    "T_MetalOrnaments_BaseColor.png": "metal",
    "T_RockTrim_BaseColor.png": "rock"
};

function loadGltf(name) {
    const gltf = JSON.parse(fs.readFileSync(path.join(src, name + ".gltf"), "utf8"));
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
            list.push(
                +(p[0] + x).toFixed(3),
                +(p[1] + y).toFixed(3),
                +(p[2] + z).toFixed(3),
                +src[i][2][0].toFixed(4),
                +(1 - src[i][2][1]).toFixed(4),
                +n[0].toFixed(3),
                +n[1].toFixed(3),
                +n[2].toFixed(3)
            );
        }
    }
}

function shell(spec) {
    const groups = {};
    const ys = spec.floors === 2 ? [0, 3.05] : [0];
    const sideZ = [];
    for (let z = spec.front + 1; z <= spec.back - 1; z += 2) sideZ.push(z);
    for (const y of ys) {
        addPiece(groups, spec.door, -1, y, spec.front, 0);
        addPiece(groups, spec.win, 1, y, spec.front, 0);
        addPiece(groups, spec.plain, -1, y, spec.back, Math.PI);
        addPiece(groups, spec.plain, 1, y, spec.back, Math.PI);
        for (const z of sideZ) {
            addPiece(groups, spec.plain, -spec.side, y, z, Math.PI / 2);
            addPiece(groups, spec.win, spec.side, y, z, -Math.PI / 2);
        }
        for (const x of [-spec.side, spec.side]) {
            for (const z of [spec.front, spec.back]) addPiece(groups, spec.corner, x, y, z, 0);
        }
    }
    const roofY = spec.floors === 2 ? 6.05 : 3;
    addPiece(groups, spec.roof, 0, roofY, 0, 0);
    addPiece(groups, "Roof_Front_Brick4", 0, roofY, spec.front - 0.55, 0);
    addPiece(groups, "Roof_Front_Brick4", 0, roofY, spec.back + 0.55, Math.PI);
    addPiece(groups, "Prop_Chimney2", 1.15, roofY - 0.2, 0.4, 0);
    return groups;
}

const plaster = {
    door: "Wall_Plaster_Door_Flat",
    win: "Wall_Plaster_Window_Wide_Flat",
    plain: "Wall_Plaster_Straight",
    corner: "Corner_ExteriorWide_Wood"
};
const brick = {
    door: "Wall_UnevenBrick_Door_Flat",
    win: "Wall_UnevenBrick_Window_Wide_Flat",
    plain: "Wall_UnevenBrick_Straight",
    corner: "Corner_ExteriorWide_Brick"
};

const buildings = {
    house: shell(Object.assign({ floors: 1, front: -2, back: 2, side: 2, roof: "Roof_RoundTiles_4x4" }, plaster)),
    tall: shell(Object.assign({ floors: 2, front: -2, back: 2, side: 2, roof: "Roof_RoundTiles_4x4" }, plaster)),
    shop: shell(Object.assign({ floors: 1, front: -2, back: 2, side: 2, roof: "Roof_RoundTiles_4x4", win: "Wall_Plaster_Window_Wide_Round" }, plaster)),
    brick: shell(Object.assign({ floors: 1, front: -2, back: 2, side: 2, roof: "Roof_RoundTiles_4x4" }, brick)),
    long: shell(Object.assign({ floors: 1, front: -3, back: 3, side: 2, roof: "Roof_RoundTiles_4x6" }, plaster)),
    grand: shell(Object.assign({ floors: 2, front: -3, back: 3, side: 2, roof: "Roof_RoundTiles_4x6" }, plaster))
};

fs.mkdirSync(outDir, { recursive: true });
const used = new Set(Object.keys(names));
for (const uri of used) {
    const from = path.join(src, uri);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(outDir, names[uri] + ".png"));
}
fs.writeFileSync(path.join(outDir, "town.json"), JSON.stringify({ buildings }));
for (const [name, groups] of Object.entries(buildings)) {
    let n = 0;
    for (const list of Object.values(groups)) n += list.length / 8;
    console.log(name, n, "verts");
}
