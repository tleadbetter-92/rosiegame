/**
 * Kaykit OverhangCorner2 is not a true opposite of OverhangCorner — rebuild 2 by mirroring 1 in X+Z.
 * Usage: node tools/mirror-overhang-corner2.js
 */
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "models", "village-megakit", "glTF");
const pairs = [
    "Floor_WoodLight_OverhangCorner",
    "Floor_WoodDark_OverhangCorner"
];

function readAccessor(gltf, bin, index) {
    const acc = gltf.accessors[index];
    const view = gltf.bufferViews[acc.bufferView];
    const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
    const size = acc.componentType === 5126 ? 4 : 2;
    const stride = view.byteStride || comps * size;
    const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
    const out = new Float32Array(acc.count * comps);
    for (let i = 0; i < acc.count; i++) {
        const at = start + i * stride;
        for (let c = 0; c < comps; c++) {
            out[i * comps + c] = bin.readFloatLE(at + c * size);
        }
    }
    return { acc, view, comps, out };
}

function writeAccessor(gltf, bin, index, floats) {
    const { acc, view, comps } = readAccessor(gltf, bin, index);
    const size = 4;
    const stride = view.byteStride || comps * size;
    const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
    for (let i = 0; i < acc.count; i++) {
        const at = start + i * stride;
        for (let c = 0; c < comps; c++) {
            bin.writeFloatLE(floats[i * comps + c], at + c * size);
        }
    }
}

function mirrorPiece(baseName) {
    const gltfPath = path.join(dir, baseName + ".gltf");
    const gltf = JSON.parse(fs.readFileSync(gltfPath, "utf8"));
    const binPath = path.join(dir, gltf.buffers[0].uri);
    const bin = Buffer.from(fs.readFileSync(binPath));

    for (const mesh of gltf.meshes) {
        for (const prim of mesh.primitives) {
            const pos = readAccessor(gltf, bin, prim.attributes.POSITION);
            for (let i = 0; i < pos.acc.count; i++) {
                pos.out[i * 3] = -pos.out[i * 3];
                pos.out[i * 3 + 2] = -pos.out[i * 3 + 2];
            }
            writeAccessor(gltf, bin, prim.attributes.POSITION, pos.out);

            if (prim.attributes.NORMAL != null) {
                const nrm = readAccessor(gltf, bin, prim.attributes.NORMAL);
                for (let i = 0; i < nrm.acc.count; i++) {
                    nrm.out[i * 3] = -nrm.out[i * 3];
                    nrm.out[i * 3 + 2] = -nrm.out[i * 3 + 2];
                }
                writeAccessor(gltf, bin, prim.attributes.NORMAL, nrm.out);
            }

            const idxAcc = gltf.accessors[prim.indices];
            const idxView = gltf.bufferViews[idxAcc.bufferView];
            const idxStart = (idxView.byteOffset || 0) + (idxAcc.byteOffset || 0);
            const idxStride = idxView.byteStride || (idxAcc.componentType === 5123 ? 2 : 4);
            for (let t = 0; t < idxAcc.count; t += 3) {
                const at = idxStart + t * idxStride;
                if (idxAcc.componentType === 5123) {
                    const a = bin.readUInt16LE(at);
                    const b = bin.readUInt16LE(at + 2);
                    const c = bin.readUInt16LE(at + 4);
                    bin.writeUInt16LE(a, at);
                    bin.writeUInt16LE(c, at + 2);
                    bin.writeUInt16LE(b, at + 4);
                } else {
                    const a = bin.readUInt32LE(at);
                    const b = bin.readUInt32LE(at + 4);
                    const c = bin.readUInt32LE(at + 8);
                    bin.writeUInt32LE(a, at);
                    bin.writeUInt32LE(c, at + 4);
                    bin.writeUInt32LE(b, at + 8);
                }
            }
        }
    }

    const outBase = baseName + "2";
    gltf.nodes[0].name = outBase;
    gltf.meshes[0].name = outBase;
    const outGltf = path.join(dir, outBase + ".gltf");
    const outBin = path.join(dir, outBase + ".bin");
    gltf.buffers[0].uri = outBase + ".bin";
    fs.writeFileSync(outBin, bin);
    fs.writeFileSync(outGltf, JSON.stringify(gltf, null, "\t"));
    console.log("Wrote", outBase, "from mirrored", baseName);
}

for (const base of pairs) mirrorPiece(base);
