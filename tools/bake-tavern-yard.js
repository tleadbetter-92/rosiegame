const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const glbDir = path.join(__dirname, "building-editor", "Tavern", "glTF");
const yard = [
    ["column01", "Column"],
    ["column02", "Wide column"],
    ["column03", "Split column"],
    ["column04", "Capped column"],
    ["crate01", "Crate"],
    ["crate02", "Vegetable crate"],
    ["keg01", "Keg"],
    ["keg02", "Large keg"],
    ["food-display", "Food stall"],
    ["herb-drying-hanger", "Herb hanger"],
    ["shield", "Shield"],
    ["plaque", "Plaque"],
    ["menu-stand01", "Menu board"],
    ["menu-stand03", "Tall menu board"],
    ["table01", "Square table"],
    ["table02", "Large table"],
    ["table03", "Long table"],
    ["counter_L", "Counter, left"],
    ["counter_M", "Counter"],
    ["counter_R", "Counter, right"],
    ["counter_BL", "Counter corner, left"],
    ["counter_BR", "Counter corner, right"]
];

function spanOf(piece) {
    const buf = fs.readFileSync(path.join(glbDir, piece + ".glb"));
    const jsonLen = buf.readUInt32LE(12);
    const gltf = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
    let best = null;
    let bestSpan = -1;
    for (const acc of gltf.accessors || []) {
        if (!acc || acc.type !== "VEC3" || !acc.min || !acc.max) continue;
        const span = (acc.max[0] - acc.min[0]) + (acc.max[1] - acc.min[1]) + (acc.max[2] - acc.min[2]);
        if (span > bestSpan) {
            bestSpan = span;
            best = acc;
        }
    }
    const spanX = best ? Math.max(0.6, best.max[0] - best.min[0]) : 1;
    const spanZ = best ? Math.max(0.6, best.max[2] - best.min[2]) : 1;
    return {
        spanX: Math.round(spanX * 100) / 100,
        spanZ: Math.round(spanZ * 100) / 100
    };
}

const tmp = path.join(os.tmpdir(), "tavern-yard-piece.json");
const props = [];
for (const pair of yard) {
    const piece = pair[0];
    const name = pair[1];
    const id = "tavern-" + piece;
    fs.writeFileSync(tmp, JSON.stringify({
        name: name,
        pieces: [{ id: piece, x: 0, y: 0, z: 0, yaw: 0 }]
    }));
    execFileSync(process.execPath, [path.join(__dirname, "bake-building.js"), tmp, id], {
        cwd: root,
        stdio: "inherit"
    });
    const span = spanOf(piece);
    props.push({
        id: id,
        name: name,
        pieces: 1,
        spanX: span.spanX,
        spanZ: span.spanZ
    });
}
fs.writeFileSync(
    path.join(__dirname, "town-editor", "tavern-yard.json"),
    JSON.stringify({ props: props }, null, 2)
);
console.log("yard props", props.length);
