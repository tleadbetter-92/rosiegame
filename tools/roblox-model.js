// Turns art/roblox/<name>.rbxm into models/roblox/<name>.json for buildings factions put up, e.g. "node tools/roblox-model.js houses".
// Output is in metres, centred on the model, ground at y 0; groups lists the footprint of each model inside it.
const fs = require("fs");
const path = require("path");
const { readRbxm, partsIn, boundsOf, packModel } = require("./rbxm.js");

const SCALE = 0.25;
const name = process.argv[2];
if (!name) {
    console.log("usage: node tools/roblox-model.js <name>   (reads art/roblox/<name>.rbxm)");
    process.exit(1);
}
const src = path.join(__dirname, "..", "art", "roblox", name + ".rbxm");
const out = path.join(__dirname, "..", "models", "roblox", name + ".json");

const { instances } = readRbxm(src);
const root = instances.find((inst) => inst.className === "Model" && !instances.some((other) => other.id === inst.parent));

const groups = root.children.map((group) => ({ name: group.props.Name, parts: partsIn(group) })).filter((g) => g.parts.length);
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
