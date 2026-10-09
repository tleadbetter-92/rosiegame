const fs = require("fs");
const path = require("path");
const { parseBinary } = require("fbx-parser");

const srcDir = path.join("art", "people", "fbx", "unral_better_export");
const picks = {
    soldier0: "rich_citizens_1.fbx",
    soldier1: "peasant_5.fbx",
    soldier2: "king.fbx",
    soldier3: "city_dwellers_1.fbx",
    fisher0: "peasant_1.fbx",
    fisher1: "peasant_6.fbx",
    fisher2: "peasant_3.fbx",
    fisher3: "peasant_4.fbx"
};
const armDrop = 82 * Math.PI / 180;

function arrayOf(node, name) {
    const child = node && node.nodes.find((item) => item.name === name);
    const value = child && child.props && child.props[0];
    return Array.isArray(value) ? value : null;
}

function cluster(objects, bone) {
    return objects.nodes.find((node) => node.name === "Deformer" && String(node.props[1]).endsWith(bone));
}

function meshOf(file) {
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
    const pivotOf = (bone) => {
        const node = cluster(objects, bone);
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
        return n ? [sum[0] / n, sum[1] / n] : [0, 140];
    };
    const pivotL = pivotOf("Clavicle_L");
    const pivotR = pivotOf("Clavicle_R");
    const spin = (x, y, px, py, angle) => {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const dx = x - px;
        const dy = y - py;
        return [px + dx * c - dy * s, py + dx * s + dy * c];
    };
    const posed = new Float64Array(count * 3);
    for (let v = 0; v < count; v++) {
        let x = vertices[v * 3];
        let y = vertices[v * 3 + 1];
        const z = vertices[v * 3 + 2];
        const blend = (weight) => {
            const t = Math.min(1, Math.max(0, (weight - 0.2) / 0.55));
            return t * t * (3 - 2 * t);
        };
        const turnL = -armDrop * blend(left[v]);
        const turnR = armDrop * blend(right[v]);
        if (turnL) [x, y] = spin(x, y, pivotL[0], pivotL[1], turnL);
        if (turnR) [x, y] = spin(x, y, pivotR[0], pivotR[1], turnR);
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
    const out = [];
    let poly = [];
    let corner = 0;
    const emit = (p) => {
        const v = p.idx;
        const px = (posed[v * 3] - midX) * scale;
        const py = (posed[v * 3 + 1] - min[1]) * scale;
        const pz = (posed[v * 3 + 2] - midZ) * scale;
        const ni = normalIndex[p.corner] * 3;
        let nx = normals[ni];
        let ny = normals[ni + 1];
        const nz = normals[ni + 2];
        const blend = (weight) => {
            const t = Math.min(1, Math.max(0, (weight - 0.2) / 0.55));
            return t * t * (3 - 2 * t);
        };
        const turnL = -armDrop * blend(left[v]);
        const turnR = armDrop * blend(right[v]);
        if (turnL) [nx, ny] = spin(nx, ny, 0, 0, turnL);
        if (turnR) [nx, ny] = spin(nx, ny, 0, 0, turnR);
        const len = Math.hypot(nx, ny, nz) || 1;
        const lit = Math.max(0, (nx * light[0] + ny * light[1] + nz * light[2]) / (lightLen * len));
        const ui = uvIndex[p.corner] * 2;
        out.push(px, py, pz, uvs[ui], 1 - uvs[ui + 1], 0.5 + 0.5 * lit);
    };
    for (const raw of polygons) {
        const end = raw < 0;
        poly.push({ idx: end ? -raw - 1 : raw, corner });
        corner += 1;
        if (!end) continue;
        for (let i = 1; i < poly.length - 1; i++) {
            emit(poly[0]);
            emit(poly[i]);
            emit(poly[i + 1]);
        }
        poly = [];
    }
    const handW = new Float64Array(count);
    for (const part of ["Hand", "Thumb_01", "Index_01", "Ring_01"]) addWeight(part + "_R", handW);
    let hx = 0;
    let hy = 0;
    let hz = 0;
    let hn = 0;
    for (let v = 0; v < count; v++) {
        if (handW[v] < 0.45) continue;
        hx += posed[v * 3];
        hy += posed[v * 3 + 1];
        hz += posed[v * 3 + 2];
        hn += 1;
    }
    const hand = hn ? [
        ((hx / hn) - midX) * scale,
        ((hy / hn) - min[1]) * scale,
        ((hz / hn) - midZ) * scale
    ] : [0.22, 0.75, 0.08];
    console.log(
        file,
        "tris", Math.round(out.length / 18),
        "span", [max[0] - min[0], max[1] - min[1], max[2] - min[2]].map((n) => n.toFixed(1)).join("x"),
        "hand", hand.map((n) => n.toFixed(2)).join(" ")
    );
    return { floats: out, hand };
}

const models = {};
const hands = {};
for (const [name, file] of Object.entries(picks)) {
    const baked = meshOf(file);
    models[name] = baked.floats;
    hands[name] = baked.hand;
}
function bakeSword() {
    const file = path.join("art", "weapons", "sword_one_handed", "sword.fbx");
    const fbx = parseBinary(fs.readFileSync(file));
    const geo = fbx.find((node) => node.name === "Objects").nodes.find((node) => node.name === "Geometry");
    const vertices = arrayOf(geo, "Vertices");
    const polygons = arrayOf(geo, "PolygonVertexIndex");
    const normalsNode = geo.nodes.find((node) => node.name === "LayerElementNormal");
    const uvNode = geo.nodes.find((node) => node.name === "LayerElementUV");
    const normals = arrayOf(normalsNode, "Normals");
    const normalIndex = arrayOf(normalsNode, "NormalsIndex");
    const uvs = arrayOf(uvNode, "UV");
    const uvIndex = arrayOf(uvNode, "UVIndex");
    const scale = 0.72 / 1.12;
    const grip = 0.05;
    const light = [0.25, 0.86, 0.28];
    const lightLen = Math.hypot(light[0], light[1], light[2]);
    const out = [];
    let poly = [];
    let corner = 0;
    const emit = (p) => {
        const x = vertices[p.idx * 3];
        const y = vertices[p.idx * 3 + 1];
        const z = vertices[p.idx * 3 + 2];
        const px = x * scale;
        const py = -(z - grip) * scale;
        const pz = y * scale;
        const ni = (normalIndex ? normalIndex[p.corner] : p.corner) * 3;
        const nx = normals[ni];
        const ny = -normals[ni + 2];
        const nz = normals[ni + 1];
        const len = Math.hypot(nx, ny, nz) || 1;
        const lit = Math.max(0, (nx * light[0] + ny * light[1] + nz * light[2]) / (lightLen * len));
        const ui = uvIndex[p.corner] * 2;
        out.push(px, py, pz, uvs[ui], 1 - uvs[ui + 1], 0.55 + 0.45 * lit);
    };
    for (const raw of polygons) {
        const end = raw < 0;
        poly.push({ idx: end ? -raw - 1 : raw, corner });
        corner += 1;
        if (!end) continue;
        for (let i = 1; i < poly.length - 1; i++) {
            emit(poly[0]);
            emit(poly[i]);
            emit(poly[i + 1]);
        }
        poly = [];
    }
    console.log("sword tris", Math.round(out.length / 18));
    return out;
}

fs.mkdirSync("models", { recursive: true });
fs.writeFileSync(path.join("models", "people.json"), JSON.stringify({ models, hands }));
fs.writeFileSync(path.join("models", "sword.json"), JSON.stringify(bakeSword()));
fs.copyFileSync(
    path.join("art", "weapons", "sword_one_handed", "sword_sword_BaseColor.png"),
    path.join("models", "sword.png")
);
fs.copyFileSync(path.join("art", "people", "texture", "people_texture_map.png"), path.join("models", "people.png"));
const scratch = path.join("tools", "people_texture_map.png");
if (fs.existsSync(scratch)) fs.unlinkSync(scratch);
console.log("wrote models/people.json", fs.statSync("models/people.json").size);
