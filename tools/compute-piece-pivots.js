/**
 * Megakit glTF roots are authored for 2 m tile-centre anchors.
 * Run from repo root: node tools/compute-piece-pivots.js
 * Reports pieces whose bbox centre is far from origin (may need manual review).
 */
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "models", "village-megakit", "glTF");
const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, "building-editor", "manifest.json"), "utf8")
);
const names = Object.values(manifest.categories).flat();

function bbox(name) {
    const gltfPath = path.join(src, name + ".gltf");
    if (!fs.existsSync(gltfPath)) return null;
    const gltf = JSON.parse(fs.readFileSync(gltfPath, "utf8"));
    const bin = fs.readFileSync(path.join(src, gltf.buffers[0].uri));
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const mesh of gltf.meshes) {
        for (const prim of mesh.primitives) {
            const acc = gltf.accessors[prim.attributes.POSITION];
            const view = gltf.bufferViews[acc.bufferView];
            const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
            for (let i = 0; i < acc.count; i++) {
                const o = start + i * 12;
                for (let a = 0; a < 3; a++) {
                    const v = bin.readFloatLE(o + a * 4);
                    min[a] = Math.min(min[a], v);
                    max[a] = Math.max(max[a], v);
                }
            }
        }
    }
    return {
        cx: (min[0] + max[0]) / 2,
        cz: (min[2] + max[2]) / 2,
        sx: max[0] - min[0],
        sz: max[2] - min[2]
    };
}

let warn = 0;
for (const name of names.sort()) {
    const b = bbox(name);
    if (!b) continue;
    const off = Math.hypot(b.cx, b.cz);
    if (off > 0.25) {
        console.log("offset centre", name, "cx", b.cx.toFixed(2), "cz", b.cz.toFixed(2), "size", b.sx.toFixed(1), b.sz.toFixed(1));
        warn += 1;
    }
}
console.log(warn ? warn + " pieces with large centre offset (still use tile-centre snap)" : "All pieces near origin — tile-centre snap OK");
