/**
 * CraftPix Medieval People → models/kaykit/<stem>-0.bin (+ png)
 * Idle + 8 procedural walk frames (FBX has no walk clips).
 *
 *   node tools/bake-craftpix-folk.js
 *   node tools/bake-craftpix-folk.js folk-peasant-f
 */
const fs = require("fs");
const path = require("path");
const { parseBinary } = require("fbx-parser");

const srcDir = path.join("models", "medieval-people", "fbx", "unral_better_export");
const texSrc = path.join("models", "medieval-people", "texture", "people_texture_map.png");
const outDir = path.join("models", "kaykit");

const RECIPES = [
    { stem: "folk-peasant-f", file: "peasant_4.fbx" },
    { stem: "folk-soldier", file: "rich_citizens_2.fbx" },
    { stem: "folk-king", file: "king.fbx" }
];

const armDrop = 62 * Math.PI / 180;
const armForward = 18 * Math.PI / 180;
const legSwingMax = 0.38;

function arrayOf(node, name) {
    const child = node && node.nodes.find((item) => item.name === name);
    const value = child && child.props && child.props[0];
    return Array.isArray(value) ? value : null;
}

function cluster(objects, bone) {
    return objects.nodes.find((node) => node.name === "Deformer" && String(node.props[1]).endsWith(bone));
}

function blendWeight(weight) {
    const t = Math.min(1, Math.max(0, (weight - 0.2) / 0.55));
    return t * t * (3 - 2 * t);
}

function spin(x, y, px, py, angle) {
    if (!angle) return [x, y];
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const dx = x - px;
    const dy = y - py;
    return [px + dx * c - dy * s, py + dx * s + dy * c];
}

function spinForward(x, z, px, pz, angle) {
    if (!angle) return [x, z];
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const dx = x - px;
    const dz = z - pz;
    return [px + dx * c - dz * s, pz + dx * s + dz * c];
}

function meshFrame(file, walkPhase) {
    const fbx = parseBinary(fs.readFileSync(path.join(srcDir, file)));
    const objects = fbx.find((node) => node.name === "Objects");
    const geo = objects.nodes.find((node) => node.name === "Geometry");
    const vertices = arrayOf(geo, "Vertices");
    const polygons = arrayOf(geo, "PolygonVertexIndex");
    const normalsNode = geo.nodes.find((node) => node.name === "LayerElementNormal");
    const uvNode = geo.nodes.find((node) => node.name === "LayerElementUV");
    const normals = arrayOf(normalsNode, "Normals");
    const normalIndex = arrayOf(normalsNode, "NormalsIndex");
    const uvs = arrayOf(uvNode, "UV");
    const uvIndex = arrayOf(uvNode, "UVIndex");
    const count = vertices.length / 3;
    const left = new Float64Array(count);
    const right = new Float64Array(count);
    const addWeight = (bone, into) => {
        const node = cluster(objects, bone);
        if (!node) return;
        const indexes = arrayOf(node, "Indexes");
        const weights = arrayOf(node, "Weights");
        for (let i = 0; i < indexes.length; i++) into[indexes[i]] += weights[i];
    };
    for (const part of ["Upperarm", "Lowerarm", "Hand", "Thumb_01", "Thumb_02", "Thumb_03", "Index_01", "Index_02", "Index_03", "Ring_01", "Ring_02", "Ring_03"]) {
        addWeight(part + "_L", left);
        addWeight(part + "_R", right);
    }
    const legL = new Float64Array(count);
    const legR = new Float64Array(count);
    for (const part of ["Thigh", "Calf", "Foot", "Ball"]) {
        addWeight(part + "_L", legL);
        addWeight(part + "_R", legR);
    }
    const pivotOf = (bone) => {
        const node = cluster(objects, bone);
        if (!node) return [0, 140, 0];
        const indexes = arrayOf(node, "Indexes");
        const weights = arrayOf(node, "Weights");
        const sum = [0, 0, 0];
        let n = 0;
        for (let i = 0; i < indexes.length; i++) {
            if (weights[i] < 0.4) continue;
            sum[0] += vertices[indexes[i] * 3];
            sum[1] += vertices[indexes[i] * 3 + 1];
            sum[2] += vertices[indexes[i] * 3 + 2];
            n += 1;
        }
        return n ? [sum[0] / n, sum[1] / n, sum[2] / n] : [0, 140, 0];
    };
    const pivotL = pivotOf("Clavicle_L");
    const pivotR = pivotOf("Clavicle_R");
    const pivotLegL = pivotOf("Thigh_L");
    const pivotLegR = pivotOf("Thigh_R");
    const legSwing = Math.sin(walkPhase * Math.PI * 2) * legSwingMax;
    const armExtra = -legSwing * 0.55;

    const posed = new Float64Array(count * 3);
    for (let v = 0; v < count; v++) {
        let x = vertices[v * 3];
        let y = vertices[v * 3 + 1];
        let z = vertices[v * 3 + 2];
        const turnL = -armDrop * blendWeight(left[v]) + armExtra * blendWeight(left[v]);
        const turnR = armDrop * blendWeight(right[v]) - armExtra * blendWeight(right[v]);
        const aheadL = -armForward * blendWeight(left[v]);
        const aheadR = armForward * blendWeight(right[v]);
        if (turnL) [x, y] = spin(x, y, pivotL[0], pivotL[1], turnL);
        if (turnR) [x, y] = spin(x, y, pivotR[0], pivotR[1], turnR);
        if (aheadL) [x, z] = spinForward(x, z, pivotL[0], pivotL[2], aheadL);
        if (aheadR) [x, z] = spinForward(x, z, pivotR[0], pivotR[2], aheadR);
        const lLeg = legSwing * blendWeight(legL[v]);
        const rLeg = -legSwing * blendWeight(legR[v]);
        if (lLeg) [x, z] = spinForward(x, z, pivotLegL[0], pivotLegL[2], lLeg);
        if (rLeg) [x, z] = spinForward(x, z, pivotLegR[0], pivotLegR[2], rLeg);
        posed[v * 3] = x;
        posed[v * 3 + 1] = y;
        posed[v * 3 + 2] = z;
    }

    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];
    for (let v = 0; v < count; v++) {
        for (let a = 0; a < 3; a++) {
            min[a] = Math.min(min[a], posed[v * 3 + a]);
            max[a] = Math.max(max[a], posed[v * 3 + a]);
        }
    }
    const scale = 1.72 / (max[1] - min[1]);
    const midX = (min[0] + max[0]) / 2;
    const midZ = (min[2] + max[2]) / 2;
    const light = [0.25, 0.86, 0.28];
    const lightLen = Math.hypot(light[0], light[1], light[2]);
    const body = [];
    const leftLeg = [];
    const rightLeg = [];

    const emit = (p) => {
        const v = p.idx;
        const px = (posed[v * 3] - midX) * scale;
        const py = (posed[v * 3 + 1] - min[1]) * scale;
        const pz = (posed[v * 3 + 2] - midZ) * scale;
        const ni = normalIndex[p.corner] * 3;
        let nx = normals[ni];
        let ny = normals[ni + 1];
        let nz = normals[ni + 2];
        const turnL = -armDrop * blendWeight(left[v]) + armExtra * blendWeight(left[v]);
        const turnR = armDrop * blendWeight(right[v]) - armExtra * blendWeight(right[v]);
        const aheadL = -armForward * blendWeight(left[v]);
        const aheadR = armForward * blendWeight(right[v]);
        if (turnL) [nx, ny] = spin(nx, ny, 0, 0, turnL);
        if (turnR) [nx, ny] = spin(nx, ny, 0, 0, turnR);
        if (aheadL) [nx, nz] = spinForward(nx, nz, 0, 0, aheadL);
        if (aheadR) [nx, nz] = spinForward(nx, nz, 0, 0, aheadR);
        const lLeg = legSwing * blendWeight(legL[v]);
        const rLeg = -legSwing * blendWeight(legR[v]);
        if (lLeg) [nx, nz] = spinForward(nx, nz, 0, 0, lLeg);
        if (rLeg) [nx, nz] = spinForward(nx, nz, 0, 0, rLeg);
        const len = Math.hypot(nx, ny, nz) || 1;
        const lit = Math.max(0, (nx * light[0] + ny * light[1] + nz * light[2]) / (lightLen * len));
        const ui = uvIndex[p.corner] * 2;
        return [px, py, pz, uvs[ui], 1 - uvs[ui + 1], 0.5 + 0.5 * lit];
    };

    let poly = [];
    let corner = 0;
    for (const raw of polygons) {
        const end = raw < 0;
        poly.push({ idx: end ? -raw - 1 : raw, corner });
        corner += 1;
        if (!end) continue;
        for (let i = 1; i < poly.length - 1; i++) {
            const tri = [poly[0], poly[i], poly[i + 1]];
            let l = 0;
            let r = 0;
            for (const c of tri) {
                l = Math.max(l, legL[c.idx]);
                r = Math.max(r, legR[c.idx]);
            }
            const dest = l >= 0.35 && l >= r ? leftLeg : r >= 0.35 ? rightLeg : body;
            for (const c of tri) dest.push(...emit(c));
        }
        poly = [];
    }
    return body.concat(leftLeg, rightLeg);
}

function fitFrames(frames) {
    let minY = Infinity;
    let maxY = -Infinity;
    const idle = frames[0];
    for (let i = 1; i < idle.length; i += 6) {
        minY = Math.min(minY, idle[i]);
        maxY = Math.max(maxY, idle[i]);
    }
    const scale = 1.78 / (maxY - minY || 1);
    for (const frame of frames) {
        let cx = 0;
        let cz = 0;
        let n = 0;
        for (let i = 0; i < frame.length; i += 6) {
            cx += frame[i];
            cz += frame[i + 2];
            n += 1;
        }
        cx /= n;
        cz /= n;
        for (let i = 0; i < frame.length; i += 6) {
            frame[i] = (frame[i] - cx) * scale;
            frame[i + 1] = (frame[i + 1] - minY) * scale;
            frame[i + 2] = (frame[i + 2] - cz) * scale;
        }
    }
}

function writeBin(stem, file) {
    const frames = [];
    frames.push(meshFrame(file, 0));
    for (let i = 0; i < 8; i++) frames.push(meshFrame(file, (i + 0.5) / 8));
    const count0 = frames[0].length / 6;
    for (let f = 1; f < frames.length; f++) {
        if (frames[f].length / 6 !== count0) {
            throw new Error(stem + " frame " + f + " vert mismatch");
        }
    }
    fitFrames(frames);
    const count = frames[0].length / 6;
    const header = Buffer.alloc(8);
    header.writeUInt32LE(frames.length, 0);
    header.writeUInt32LE(count, 4);
    const body = Buffer.concat(frames.map((frame) => Buffer.from(new Float32Array(frame).buffer)));
    const outBin = path.join(outDir, stem + "-0.bin");
    const outPng = path.join(outDir, stem + "-0.png");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outBin, Buffer.concat([header, body]));
    fs.copyFileSync(texSrc, outPng);
    console.log(stem, file, "verts", count, "frames", frames.length, "→", outBin);
}

const only = process.argv[2];
const list = only ? RECIPES.filter((r) => r.stem === only || r.stem.replace("folk-", "") === only) : RECIPES;
if (!list.length) {
    console.error("Unknown stem:", only, "— try", RECIPES.map((r) => r.stem).join(", "));
    process.exit(1);
}
for (const { stem, file } of list) writeBin(stem, file);
