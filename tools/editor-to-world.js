// Turns an exported editor map into world-edit.js: the ground raised or lowered, new water and new rocks.
// Changes are measured against our-island.js, the island as it was handed to the editor.
const fs = require("fs");
const path = require("path");

const ACROSS = 16;
const UP = 4;
const SEG = 100;

function read(file) {
    const code = fs.readFileSync(file, "utf8");
    const tiles = JSON.parse(code.match(/const terrainData = (\[[\s\S]*?\]);/)[1]);
    const things = JSON.parse(code.match(/export const natureData = (\[[\s\S]*?\]);/)[1]);
    return { tiles, things };
}

function grid(tiles) {
    const map = new Map();
    for (const t of tiles) {
        for (let i = 0; i < t.heights.length; i++) {
            const ix = i % (SEG + 1);
            const iy = Math.floor(i / (SEG + 1));
            const x = (t.gx * SEG - SEG / 2 + ix) * ACROSS;
            const z = (t.gz * SEG - SEG / 2 + iy) * ACROSS;
            map.set(x + "," + z, t.heights[i] * UP);
        }
    }
    return map;
}

const dir = path.join(__dirname, "terrain-editor");
const before = read(path.join(dir, "our-island.js"));
const after = read(path.join(dir, process.argv[2] || "my-island.js"));
const was = grid(before.tiles);
const now = grid(after.tiles);

let box = null;
for (const [k, h] of now) {
    const d = h - (was.get(k) ?? h);
    if (Math.abs(d) < 0.05) continue;
    const [x, z] = k.split(",").map(Number);
    if (!box) box = { x0: x, x1: x, z0: z, z1: z };
    box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x);
    box.z0 = Math.min(box.z0, z); box.z1 = Math.max(box.z1, z);
}
let rise = null;
if (box) {
    const nx = (box.x1 - box.x0) / ACROSS + 1;
    const nz = (box.z1 - box.z0) / ACROSS + 1;
    const dm = [];
    for (let iz = 0; iz < nz; iz++) {
        for (let ix = 0; ix < nx; ix++) {
            const k = (box.x0 + ix * ACROSS) + "," + (box.z0 + iz * ACROSS);
            const d = (now.get(k) ?? 0) - (was.get(k) ?? 0);
            dm.push(Math.abs(d) < 0.05 ? 0 : Math.round(d * 10));
        }
    }
    rise = { x0: box.x0, z0: box.z0, step: ACROSS, nx, nz, dm };
}

const key = (o) => o.type + ":" + o.px + ":" + o.pz;
const had = new Set(before.things.map(key));
const added = after.things.filter((o) => !had.has(key(o)));
const baseAt = (x, z) => was.get(Math.round(x / ACROSS) * ACROSS + "," + Math.round(z / ACROSS) * ACROSS) ?? -8;

const spot = (o) => [Math.round(o.px * ACROSS), Math.round(o.pz * ACROSS)];

function strokesOf(type, gap) {
    const strokes = [];
    let stroke = [];
    for (const o of added) {
        if (o.type !== type) continue;
        const p = spot(o);
        const last = stroke[stroke.length - 1];
        if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) > gap) {
            strokes.push(stroke);
            stroke = [];
        }
        stroke.push(p);
    }
    if (stroke.length) strokes.push(stroke);
    return strokes;
}

const water = strokesOf("water", 120).filter((s) => s.some((p) => baseAt(p[0], p[1]) > 0.15));
for (let i = 0; i < water.length; i++) {
    const head = water[i][0];
    let best = null;
    let bestD = 140;
    for (let j = 0; j < water.length; j++) {
        if (j === i) continue;
        for (const p of water[j]) {
            const d = Math.hypot(p[0] - head[0], p[1] - head[1]);
            if (d < bestD) { bestD = d; best = p; }
        }
    }
    if (best && baseAt(head[0], head[1]) > 0.15) water[i].unshift(best.slice());
}

const rocks = added
    .filter((o) => o.type === "rock")
    .map((o) => [Math.round(o.px * ACROSS), Math.round(o.pz * ACROSS), Number(o.ry.toFixed(2)), Number(o.s.toFixed(2))]);
const paths = strokesOf("path", 100).filter((s) => s.length > 1);
const roads = strokesOf("road", 100).filter((s) => s.length > 1);
const cliffs = strokesOf("cliff", 100).filter((s) => s.length > 1);
const rivers = strokesOf("river", 100).filter((s) => s.length > 1);
// Painted ground in the order it was laid, so later paint covers earlier paint: [x, z, radius, kind].
const ground = added
    .filter((o) => o.type.startsWith("ground-"))
    .map((o) => spot(o).concat(Math.round(ACROSS * o.s), o.type.slice(7)));
const forests = added.filter((o) => o.type === "forest").map((o) => spot(o).concat(Math.round(48 * o.s)));
const bridges = added.filter((o) => o.type === "bridge").map(spot);
// Trees copied out of the game are tiny (s 0.03); trees placed by hand in the editor are full size.
const trees = after.things.filter((o) => o.type === "tree" && o.s > 0.1).map(spot);

const code = `// Made by tools/editor-to-world.js from the terrain editor map. Do not edit by hand.
(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.WorldEdit = api;
})(typeof self !== "undefined" ? self : this, function () {
    return {
        rise: ${JSON.stringify(rise)},
        water: ${JSON.stringify(water)},
        rocks: ${JSON.stringify(rocks)},
        paths: ${JSON.stringify(paths)},
        roads: ${JSON.stringify(roads)},
        cliffs: ${JSON.stringify(cliffs)},
        rivers: ${JSON.stringify(rivers)},
        ground: ${JSON.stringify(ground)},
        forests: ${JSON.stringify(forests)},
        trees: ${JSON.stringify(trees)},
        bridges: ${JSON.stringify(bridges)}
    };
});
`;
const out = path.join(__dirname, "..", "world-edit.js");
fs.writeFileSync(out, code);
console.log("wrote", out, "ground", rise ? rise.nx + "x" + rise.nz : "none", "water strokes", water.map((s) => s.length).join(","), "rocks", rocks.length, "paths", paths.length, "stone roads", roads.length, "cliffs", cliffs.length, "rivers", rivers.length, "ground paint", ground.length, "forest pieces", forests.length, "trees", trees.length, "bridges", bridges.length);
