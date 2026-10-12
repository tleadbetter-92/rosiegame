// Compares an exported editor map with the island it started from and reports what changed.
const fs = require("fs");
const path = require("path");

const ACROSS = 16;
const UP = 4;

function read(file) {
    const code = fs.readFileSync(file, "utf8");
    const tiles = JSON.parse(code.match(/const terrainData = (\[[\s\S]*?\]);/)[1]);
    const things = JSON.parse(code.match(/export const natureData = (\[[\s\S]*?\]);/)[1]);
    return { tiles, things };
}

const dir = path.join(__dirname, "terrain-editor");
const before = read(path.join(dir, "our-island.js"));
const after = read(path.join(dir, process.argv[2] || "my-island.js"));

const old = new Map(before.tiles.map((t) => [t.gx + "," + t.gz, t.heights]));
let changed = 0;
let box = null;
let most = 0;
for (const t of after.tiles) {
    const was = old.get(t.gx + "," + t.gz);
    for (let i = 0; i < t.heights.length; i++) {
        const d = t.heights[i] - (was ? was[i] : 0);
        if (Math.abs(d) < 0.05) continue;
        changed++;
        most = Math.max(most, Math.abs(d));
        const ix = i % 101;
        const iy = Math.floor(i / 101);
        const x = (t.gx * 100 - 50 + ix) * ACROSS;
        const z = (t.gz * 100 - 50 + iy) * ACROSS;
        if (!box) box = { x0: x, x1: x, z0: z, z1: z };
        box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x);
        box.z0 = Math.min(box.z0, z); box.z1 = Math.max(box.z1, z);
    }
}
console.log("tiles", before.tiles.length, "->", after.tiles.length);
console.log("ground points changed", changed, "largest change m", (most * UP).toFixed(1), "area", JSON.stringify(box));

const key = (o) => o.type + ":" + o.px + ":" + o.pz;
const had = new Set(before.things.map(key));
const now = new Set(after.things.map(key));
const added = after.things.filter((o) => !had.has(key(o)));
const gone = before.things.filter((o) => !now.has(key(o)));
const count = (list) => list.reduce((m, o) => (m[o.type] = (m[o.type] || 0) + 1, m), {});
console.log("added", JSON.stringify(count(added)), "removed", JSON.stringify(count(gone)));
for (const o of added) {
    console.log(" +", o.type, "at", Math.round(o.px * ACROSS), Math.round(o.pz * ACROSS), "y", (o.py * UP).toFixed(1), "s", o.s);
}
