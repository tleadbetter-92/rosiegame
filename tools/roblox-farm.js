// Turns art/roblox/farm.rbxm into models/roblox/farm.json for the farms factions build.
// Output is in metres, centred on the farm, ground at y 0, with the farmhouse toward +x.
const fs = require("fs");
const path = require("path");
const { readRbxm, partsIn, boundsOf, packModel } = require("./rbxm.js");

const SCALE = 0.25;
const src = path.join(__dirname, "..", "art", "roblox", "farm.rbxm");
const out = path.join(__dirname, "..", "models", "roblox", "farm.json");

const { instances } = readRbxm(src);
const root = instances.find((inst) => inst.className === "Model" && !instances.some((other) => other.id === inst.parent));

const groups = root.children.map((group) => ({ name: group.props.Name, parts: partsIn(group) })).filter((g) => g.parts.length);
for (const g of groups) g.bounds = boundsOf(g.parts);
const house = groups.reduce((best, g) => (g.parts.length > best.parts.length ? g : best));
const flat = (g) => g.bounds[1][1] - g.bounds[1][0] <= 2.5;
const fields = groups.filter((g) => g !== house && flat(g) && (g.bounds[0][1] - g.bounds[0][0]) * (g.bounds[2][1] - g.bounds[2][0]) > 1500);
const solids = groups.filter((g) => !flat(g));

const packed = packModel(groups.flatMap((g) => g.parts), SCALE);
const model = {
    scale: SCALE,
    w: packed.w,
    d: packed.d,
    palette: packed.palette,
    parts: packed.parts,
    house: packed.rect(house.bounds),
    fields: fields.map((g) => packed.rect(g.bounds)),
    solids: solids.map((g) => packed.rect(g.bounds))
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(model));
console.log("wrote", out, model.parts.length, "parts", model.palette.length, "colours", model.w + " x " + model.d + " m", "fields", model.fields.length, "solids", model.solids.length);
