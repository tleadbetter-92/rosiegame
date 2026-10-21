const fs = require("fs");
const path = require("path");

const savesDir = path.join(__dirname, "saves");
const out = path.join(savesDir, "index.json");

if (!fs.existsSync(savesDir)) fs.mkdirSync(savesDir, { recursive: true });

const entries = [];
for (const file of fs.readdirSync(savesDir)) {
    if (!file.endsWith(".json") || file === "index.json") continue;
    const full = path.join(savesDir, file);
    let data;
    try {
        data = JSON.parse(fs.readFileSync(full, "utf8"));
    } catch (err) {
        console.warn("Skip", file, err.message);
        continue;
    }
    if (!data.pieces || !Array.isArray(data.pieces)) continue;
    const id = file.replace(/\.json$/i, "");
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let maxY = 0;
    for (const p of data.pieces) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z);
        maxZ = Math.max(maxZ, p.z);
        maxY = Math.max(maxY, p.y || 0);
    }
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    entries.push({
        id,
        name: data.name || id,
        file,
        cx,
        cz,
        minX,
        maxX,
        minZ,
        maxZ,
        maxY,
        spanX: maxX - minX + 2,
        spanZ: maxZ - minZ + 2,
        pieces: data.pieces.length
    });
}

entries.sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(out, JSON.stringify({ buildings: entries }, null, 2));
console.log("Wrote", out, "—", entries.length, "building(s)");
