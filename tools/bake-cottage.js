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
    return names[uri] || uri.replace(".png", "");
}

function turn(x, y, z, yaw) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return [x * c + z * s, y, -x * s + z * c];
}

function addPiece(groups, used, name, x, y, z, yaw) {
    const { gltf, bin } = loadGltf(name);
    for (const mesh of gltf.meshes) {
        for (const prim of mesh.primitives) {
            const key = baseColor(gltf, prim.material);
            const uri = Object.keys(names).find((file) => names[file] === key);
            if (uri) used.add(uri);
            const pos = readAccessor(gltf, bin, prim.attributes.POSITION);
            const nrm = readAccessor(gltf, bin, prim.attributes.NORMAL);
            const uv = readAccessor(gltf, bin, prim.attributes.TEXCOORD_0);
            const idx = readAccessor(gltf, bin, prim.indices);
            if (!groups[key]) groups[key] = [];
            const list = groups[key];
            for (let i = 0; i < idx.length; i++) {
                const v = idx[i];
                const p = turn(pos[v][0], pos[v][1], pos[v][2], yaw);
                const n = turn(nrm[v][0], nrm[v][1], nrm[v][2], yaw);
                list.push(
                    +(p[0] + x).toFixed(4),
                    +(p[1] + y).toFixed(4),
                    +(p[2] + z).toFixed(4),
                    +uv[v][0].toFixed(4),
                    +(1 - uv[v][1]).toFixed(4),
                    +n[0].toFixed(4),
                    +n[1].toFixed(4),
                    +n[2].toFixed(4)
                );
            }
        }
    }
}

const groups = {};
const used = new Set();
addPiece(groups, used, "Wall_Plaster_Window_Wide_Flat", -1, 0, -2, 0);
addPiece(groups, used, "Wall_Plaster_Window_Thin_Round", 1, 0, -2, 0);
addPiece(groups, used, "Wall_Plaster_WoodGrid", -1, -0.65, 2, Math.PI);
addPiece(groups, used, "Wall_Plaster_WoodGrid", 1, -0.65, 2, Math.PI);
addPiece(groups, used, "Wall_Plaster_WoodGrid", -2, -0.65, -1, Math.PI / 2);
addPiece(groups, used, "Wall_Plaster_Window_Wide_Flat", -2, 0, 1, Math.PI / 2);
addPiece(groups, used, "Wall_Plaster_Window_Thin_Round", 2, 0, -1, -Math.PI / 2);
addPiece(groups, used, "Wall_Plaster_WoodGrid", 2, -0.65, 1, -Math.PI / 2);
for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
    addPiece(groups, used, "Corner_ExteriorWide_Wood", x, 0, z, 0);
}
addPiece(groups, used, "Roof_RoundTiles_4x4", 0, 3, 0, 0);
addPiece(groups, used, "Roof_Front_Brick4", 0, 3, -2.55, 0);
addPiece(groups, used, "Roof_Front_Brick4", 0, 3, 2.55, Math.PI);

fs.mkdirSync(outDir, { recursive: true });
for (const uri of used) fs.copyFileSync(path.join(src, uri), path.join(outDir, names[uri] + ".png"));
fs.writeFileSync(path.join(outDir, "cottage.json"), JSON.stringify({ groups }));
for (const [key, list] of Object.entries(groups)) console.log(key, list.length / 8, "verts");
