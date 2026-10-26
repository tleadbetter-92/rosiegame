const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const editorPath = path.join(root, "editor-blocks.js");
const catalogPath = path.join(root, "tools", "town-editor", "towns.json");
const reserved = new Set(["hamletTown", "hamletTownBig", "hamlet", "farm", "islandBasicTown"]);
const layers = ["plow", "gravel", "grass", "dirt", "cobble", "stone", "sand", "brick"];

function slug(name) {
    return String(name || "")
        .trim()
        .replace(/[^\w\-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
}

function readCatalog() {
    try {
        const parsed = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
        if (parsed && Array.isArray(parsed.towns)) return parsed.towns;
    } catch (err) { /* first save creates the list */ }
    return [];
}

function writeCatalog(towns) {
    fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
    fs.writeFileSync(catalogPath, JSON.stringify({ towns }, null, 2));
}

function readEditor() {
    const raw = fs.readFileSync(editorPath, "utf8");
    const match = raw.match(/^var EditorBlocks\s*=\s*(\{[\s\S]*\});?\s*$/);
    if (!match) throw new Error("Could not parse editor-blocks.js");
    return JSON.parse(match[1]);
}

function writeEditor(editor) {
    fs.writeFileSync(editorPath, "var EditorBlocks=" + JSON.stringify(editor) + ";\n");
}

function compactTown(data) {
    const groundLayers = {};
    for (const cell of data.ground || []) {
        const kind = cell.t || "grass";
        if (!layers.includes(kind)) continue;
        if (!groundLayers[kind]) groundLayers[kind] = [];
        groundLayers[kind].push([cell.x, cell.z]);
    }
    for (const key of Object.keys(groundLayers)) {
        groundLayers[key].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    }
    const fences = (data.fences || []).map((piece) => {
        if (Array.isArray(piece)) return [piece[0], piece[1], piece[2] || 0];
        return [piece.x, piece.z, piece.yaw || 0];
    });
    const buildings = (data.buildings || []).filter((building) => building && building.t !== "farm-stamp");
    const compact = Object.assign({ size: data.size || 192, buildings }, groundLayers);
    if (fences.length) compact.fences = fences;
    return compact;
}

function townSave(req, res) {
    if (req.method === "GET") {
        res.json({ towns: readCatalog() });
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    const data = req.body || {};
    const name = String(data.name || "").trim();
    const id = slug(name);
    if (!name || !id) {
        res.status(400).json({ error: "Type a town name." });
        return;
    }
    if (data.kind && data.kind !== "town-block") {
        res.status(400).json({ error: "Need a town block." });
        return;
    }
    let editor;
    try {
        editor = readEditor();
    } catch (err) {
        res.status(500).json({ error: err.message });
        return;
    }
    const towns = readCatalog();
    const builtins = [
        { id: "hamletTown", name: "Ashby hamlet (Southwest)" },
        { id: "hamletTownBig", name: "Large hamlet" },
        { id: "hamlet", name: "Small hamlet" },
        { id: "farm", name: "Farm" },
        { id: "islandBasicTown", name: "Island town" }
    ];
    const wanted = name.toLowerCase();
    const named = builtins.find((town) => town.name.toLowerCase() === wanted)
        || towns.find((town) => town.name.toLowerCase() === wanted);
    const key = named ? named.id : id;
    if (!named && reserved.has(key)) {
        res.status(400).json({ error: "Type the town's full name to replace it, like Small hamlet or Large hamlet." });
        return;
    }
    const replaced = !!(named || towns.some((town) => town.id === key) || editor[key]);
    const layout = compactTown(data);
    editor[key] = layout;
    try {
        writeEditor(editor);
    } catch (err) {
        res.status(500).json({ error: "Could not write the town into the game file." });
        return;
    }
    const next = towns.filter((town) => town.id !== key);
    if (!reserved.has(key)) next.push({ id: key, name });
    next.sort((a, b) => a.name.localeCompare(b.name));
    writeCatalog(next);
    res.json({ ok: true, id: key, name: named && reserved.has(key) ? named.name : name, replaced, layout });
}

module.exports = townSave;
