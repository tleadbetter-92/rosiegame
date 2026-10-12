// Saves the island from world.js into godot/data so the Godot trial shows the same land, water, trees, rocks and towns.
const fs = require("fs");
const path = require("path");
const World = require("../world.js");
const Town = require("../town.js");

const ORIGIN = -3616;
const STEP = 8;
const SIZE = 7232 / STEP + 1;
const KINDS = ["grass", "dirt", "rock", "sand", "cobble", "gravel", "marsh"];

const heights = new Float32Array(SIZE * SIZE);
const ground = new Uint8Array(SIZE * SIZE);
const water = new Float32Array(SIZE * SIZE).fill(NaN);

function kindAt(x, z) {
    const pave = Town.groundAt(x, z);
    if (pave) return pave;
    if (Town.street(x, z)) return "dirt";
    return World.groundKind(x, z);
}

for (let iz = 0; iz < SIZE; iz++) {
    const z = ORIGIN + iz * STEP;
    for (let ix = 0; ix < SIZE; ix++) {
        const x = ORIGIN + ix * STEP;
        const i = iz * SIZE + ix;
        const h = World.heightAt(x, z);
        heights[i] = h;
        if (h > -1) ground[i] = Math.max(0, KINDS.indexOf(kindAt(x, z)));
        if (h > 0.2 && World.nearRiver(x, z)) {
            const level = World.waterLevel(x, z);
            if (level != null && level > 0.4) water[i] = level;
        }
    }
}

const out = path.join(__dirname, "..", "godot", "data");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "height.bin"), Buffer.from(heights.buffer));
fs.writeFileSync(path.join(out, "ground.bin"), Buffer.from(ground.buffer));
fs.writeFileSync(path.join(out, "water.bin"), Buffer.from(water.buffer));

const round = (v) => Math.round(v * 100) / 100;
const home = World.places[2];
const info = {
    origin: ORIGIN,
    step: STEP,
    size: SIZE,
    home: [round(home.x), round(home.z + 20)],
    places: World.places.map((p) => [round(p.x), round(p.z)]),
    trees: World.trees.map((t) => [round(t.x), round(t.z), t.kind === "pine" ? 1 : 0]),
    buildings: Town.buildings.map((b) => [round(b.minX + b.w / 2), round(b.minZ + b.d / 2), round(b.w), round(b.d), b.mesh]),
    rocks: World.editRocks.concat(World.cliffRocks)
};
fs.writeFileSync(path.join(out, "world.json"), JSON.stringify(info));
console.log("wrote", out, SIZE + "x" + SIZE, "trees", info.trees.length, "buildings", info.buildings.length, "rocks", info.rocks.length);
