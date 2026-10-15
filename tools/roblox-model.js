// Turns art/roblox/<name>.rbxm into models/roblox/<name>.json for buildings factions put up, e.g. "node tools/roblox-model.js houses".
// Several names are laid side by side into one model named after the first, e.g. "node tools/roblox-model.js mine camp minething".
// --blocks stands Roblox meshes and unions in as boxes, for models made mostly of them.
// Output is in metres, centred on the model, ground at y 0; groups lists the footprint of each model inside it.
const fs = require("fs");
const path = require("path");
const { readRbxm, partsIn, boundsOf, packModel } = require("./rbxm.js");

const SCALE = 0.25;
const GAP = 4;
const blocks = process.argv.includes("--blocks");
const names = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
if (!names.length) {
    console.log("usage: node tools/roblox-model.js [--blocks] <name> [<from> ...]   (reads art/roblox/<from or name>.rbxm)");
    process.exit(1);
}
const out = path.join(__dirname, "..", "models", "roblox", names[0] + ".json");
const sources = names.length > 1 ? names.slice(1) : names;

let groups = [];
let edge = null;
for (const source of sources) {
    const { instances } = readRbxm(path.join(__dirname, "..", "art", "roblox", source + ".rbxm"));
    const root = instances.find((inst) => inst.className === "Model" && !instances.some((other) => other.id === inst.parent));
    const found = root.children.map((group) => ({ name: group.props.Name, parts: partsIn(group, blocks) })).filter((g) => g.parts.length);
    if (!found.length) continue;
    // Each later source is set down beside the last, its ground level with the first.
    const b = boundsOf(found.flatMap((g) => g.parts));
    if (edge) {
        const dx = edge.x - b[0][0] + GAP / SCALE;
        const dy = edge.y - b[1][0];
        const dz = edge.z - (b[2][0] + b[2][1]) / 2;
        for (const g of found) for (const p of g.parts) p.pos = [p.pos[0] + dx, p.pos[1] + dy, p.pos[2] + dz];
        edge.x = b[0][1] + dx;
    } else {
        edge = { x: b[0][1], y: b[1][0], z: (b[2][0] + b[2][1]) / 2 };
    }
    groups = groups.concat(found);
}
for (const g of groups) g.bounds = boundsOf(g.parts);

const packed = packModel(groups.flatMap((g) => g.parts), SCALE);
const model = {
    scale: SCALE,
    w: packed.w,
    d: packed.d,
    palette: packed.palette,
    parts: packed.parts,
    groups: groups.map((g) => Object.assign({ name: g.name }, packed.rect(g.bounds)))
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(model));
console.log("wrote", out, model.parts.length, "parts", model.palette.length, "colours", model.w + " x " + model.d + " m");
for (const g of model.groups) console.log(" ", g.name, g.x, g.z, g.w + " x " + g.d);
