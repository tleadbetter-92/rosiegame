const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "art", "fantasy-props", "Exports", "glTF");
const outDir = path.join(__dirname, "..", "models");
const names = {
    "T_Trim_Furniture_BaseColor.png": "furniture",
    "T_Trim_Metal_BaseColor.png": "propmetal",
    "T_Trim_Cloth_BaseColor.png": "propcloth",
    "T_Trim_Props_BaseColor.png": "proppack"
};
const props = [
    "Bed_Twin1", "Bed_Twin2", "Chair_1", "Stool", "Bench", "Table_Large",
    "Chest_Wood", "Cabinet", "Shelf_Simple", "Shelf_Arch", "Shelf_Small_Bottles", "Bookcase_2",
    "Nightstand_Shelf", "Barrel", "Crate_Wooden", "Cauldron", "Pot_1", "Mug",
    "Bottle_1", "Candle_1", "CandleStick", "Anvil", "Workbench", "Potion_1",
    "Bag", "FarmCrate_Apple", "Book_Stack_1", "WeaponStand", "Shield_Wooden"
];

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
        const comp = acc.componentType === 5123 ? 2 : 4;
        const offset = start + (stride ? i * stride : i * width * comp);
        if (acc.componentType === 5126) {
            const value = [];
            for (let k = 0; k < width; k++) value.push(bin.readFloatLE(offset + k * 4));
            out.push(value);
        } else if (acc.componentType === 5123) out.push(bin.readUInt16LE(offset));
        else if (acc.componentType === 5125) out.push(bin.readUInt32LE(offset));
        else throw new Error("Unsupported component " + acc.componentType);
    }
    return out;
}

function baseColor(gltf, materialIndex) {
    const material = gltf.materials[materialIndex];
    const texture = material.pbrMetallicRoughness && material.pbrMetallicRoughness.baseColorTexture;
    if (!texture) return "furniture";
    const uri = gltf.images[gltf.textures[texture.index].source].uri;
    return names[uri] || "furniture";
}

const packed = {};
const bounds = {};
for (const name of props) {
    const { gltf, bin } = loadGltf(name);
    const groups = {};
    const min = [1e9, 1e9, 1e9];
    const max = [-1e9, -1e9, -1e9];
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
                const p = pos[v];
                const n = nrm[v];
                for (let k = 0; k < 3; k++) {
                    min[k] = Math.min(min[k], p[k]);
                    max[k] = Math.max(max[k], p[k]);
                }
                list.push(
                    +p[0].toFixed(3), +p[1].toFixed(3), +p[2].toFixed(3),
                    +uv[v][0].toFixed(4), +(1 - uv[v][1]).toFixed(4),
                    +n[0].toFixed(3), +n[1].toFixed(3), +n[2].toFixed(3)
                );
            }
        }
    }
    packed[name] = groups;
    bounds[name] = {
        min: min.map((v) => +v.toFixed(3)),
        max: max.map((v) => +v.toFixed(3))
    };
    console.log(name, Object.keys(groups).map((key) => key + ":" + (groups[key].length / 8)).join(" "));
}

for (const file of Object.keys(names)) {
    const from = path.join(src, file);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(outDir, names[file] + ".png"));
}
fs.writeFileSync(path.join(outDir, "props.json"), JSON.stringify({ bounds, props: packed }));
console.log("wrote models/props.json");
