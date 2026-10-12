// Writes the current island as a map the terrain editor can open with "Load Map from File".
// One editor unit is 16 m across and 4 m up, so hills read clearly at that size.
// With no arguments it writes our-island.js, the untouched island every later edit is measured against.
// "node tools/island-to-editor.js current-island.js my-island.js" writes the island as the game has it now
// and carries over the water, rocks and other things placed in my-island.js.
const fs = require("fs");
const path = require("path");
const W = require("../world.js");

const ACROSS = 16;
const UP = 4;
const TILE = 100;
const SEG = 100;
const SEA = -2;
const dir = path.join(__dirname, "terrain-editor");
const outName = process.argv[2] || "our-island.js";
const keepFrom = process.argv[3];

const tiles = [];
for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
        const heights = [];
        for (let iy = 0; iy <= SEG; iy++) {
            for (let ix = 0; ix <= SEG; ix++) {
                const x = (gx * TILE - TILE / 2 + ix) * ACROSS;
                const z = (gz * TILE - TILE / 2 + iy) * ACROSS;
                const h = Math.max(SEA, W.heightAt(x, z) / UP);
                heights.push(Number(h.toFixed(2)));
            }
        }
        tiles.push({ gx, gz, heights });
    }
}

const at = (x, z) => Math.max(SEA, W.heightAt(x, z) / UP);
const things = [];
const towns = [0xc45c3a, 0x3d6b8a, 0x6a7a3a, 0x8a5a7a];
W.places.forEach((place, i) => {
    things.push({
        type: "cube",
        px: Number((place.x / ACROSS).toFixed(2)),
        py: Number((at(place.x, place.z) + 6).toFixed(2)),
        pz: Number((place.z / ACROSS).toFixed(2)),
        ry: 0,
        s: 6,
        color: towns[i]
    });
});

const seen = new Set();
const woods = W.trees.concat(W.groves).filter((t) => t.kind !== "bush" && t.kind !== "rock" && !t.edit);
for (const t of woods) {
    const key = Math.floor(t.x / 64) + "," + Math.floor(t.z / 64);
    if (seen.has(key)) continue;
    seen.add(key);
    things.push({
        type: "tree",
        px: Number((t.x / ACROSS).toFixed(2)),
        py: Number(at(t.x, t.z).toFixed(2)),
        pz: Number((t.z / ACROSS).toFixed(2)),
        ry: 0,
        s: 0.03
    });
}

if (keepFrom) {
    const read = (file) => JSON.parse(fs.readFileSync(path.join(dir, file), "utf8").match(/export const natureData = (\[[\s\S]*?\]);/)[1]);
    const key = (o) => o.type + ":" + o.px + ":" + o.pz;
    const had = new Set(read("our-island.js").map(key));
    const copied = (o) => (o.type === "tree" && o.s <= 0.1) || (o.type === "cube" && o.s === 6);
    for (const o of read(keepFrom)) {
        if (!had.has(key(o)) && !copied(o)) things.push(o);
    }
}

const code = `// Generated Terrain Module
// The island from the game. One unit is ${ACROSS} m across and ${UP} m up. The coloured blocks are the four villages.
import * as THREE from 'three';

export function createGeneratedTerrain() {
    const width = ${TILE};
    const height = ${TILE};
    const segments = ${SEG};
    const terrainData = ${JSON.stringify(tiles)};
    return terrainData;
}

// Nature Placement Data
export const natureData = ${JSON.stringify(things, null, 2)};
`;

const out = path.join(dir, outName);
fs.writeFileSync(out, code);
console.log("wrote", out, tiles.length, "tiles,", things.length, "objects");
