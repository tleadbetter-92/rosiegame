const fs = require("fs");
const path = require("path");

const gltfDir = path.join(__dirname, "..", "..", "models", "village-megakit", "glTF");
const out = path.join(__dirname, "manifest.json");

const pieces = fs
    .readdirSync(gltfDir)
    .filter((f) => f.endsWith(".gltf"))
    .map((f) => f.replace(".gltf", ""))
    .sort();

const categories = {};
for (const name of pieces) {
    let cat = name.split("_")[0];
    if (name.startsWith("WindowShutters")) cat = "WindowShutters";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(name);
}

const manifest = {
    kind: "village-megakit",
    grid: 2,
    piecesDir: "/models/village-megakit/glTF/",
    categories
};

fs.writeFileSync(out, JSON.stringify(manifest, null, 2));
console.log("Wrote", out, "—", pieces.length, "pieces,", Object.keys(categories).length, "categories");
