/**
 * Compact town-block.json → EditorBlocks slice (plow/gravel/grass/… + fences + buildings).
 * Usage: node tools/town-block-to-editor.js [town-block.json] [outKey]
 * Updates editor-blocks.js in repo root (adds or replaces outKey, keeps farm + hamlet).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcPath = path.join(root, process.argv[2] || "town-block.json");
const outKey = process.argv[3] || "hamletTown";

const block = JSON.parse(fs.readFileSync(srcPath, "utf8"));
if (block.kind !== "town-block") throw new Error("Expected kind town-block");

const layers = {};
for (const cell of block.ground || []) {
    const t = cell.t || "grass";
    if (!layers[t]) layers[t] = [];
    layers[t].push([cell.x, cell.z]);
}
for (const k of Object.keys(layers)) {
    layers[k].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

const fences = (block.fences || []).map((f) => [f.x, f.z, f.yaw || 0]);
const buildings = (block.buildings || []).filter((b) => b.t !== "farm-stamp");

const compact = Object.assign({ size: block.size || 192, buildings }, layers);
if (fences.length) compact.fences = fences;

const editorPath = path.join(root, "editor-blocks.js");
const raw = fs.readFileSync(editorPath, "utf8");
const m = raw.match(/^var EditorBlocks\s*=\s*(\{[\s\S]*\});?\s*$/);
if (!m) throw new Error("Could not parse editor-blocks.js");
const editor = JSON.parse(m[1]);
editor[outKey] = compact;

const out = "var EditorBlocks=" + JSON.stringify(editor) + ";\n";
fs.writeFileSync(editorPath, out);
console.log("Wrote editor-blocks.js", outKey, "ground cells", (block.ground || []).length, "buildings", buildings.length);
