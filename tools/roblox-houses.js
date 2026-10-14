// Turns art/roblox/houses.rbxm (the five-house template) into models/roblox/houses.json for the houses factions build.
// Output is in metres, centred on the template, ground at y 0; houses lists each house's footprint.
const fs = require("fs");
const path = require("path");
const { readRbxm, partsIn, boundsOf, packModel } = require("./rbxm.js");

const SCALE = 0.25;
const src = path.join(__dirname, "..", "art", "roblox", "houses.rbxm");
const out = path.join(__dirname, "..", "models", "roblox", "houses.json");

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
    houses: groups.map((g) => Object.assign({ name: g.name }, packed.rect(g.bounds)))
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(model));
console.log("wrote", out, model.parts.length, "parts", model.palette.length, "colours", model.w + " x " + model.d + " m");
for (const h of model.houses) console.log(" ", h.name, h.x, h.z, h.w + " x " + h.d);
