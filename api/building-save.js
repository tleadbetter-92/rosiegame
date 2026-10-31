const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function safeId(raw) {
    const id = String(raw || "").trim().toLowerCase();
    if (!/^[\w\-]+$/.test(id)) return "";
    return id;
}

function kitOwner(file, ids) {
    let stem = file;
    if (stem.endsWith(".rgb.bin")) stem = stem.slice(0, -8);
    else if (stem.endsWith(".bin")) stem = stem.slice(0, -4);
    else if (stem.endsWith(".meta.json")) stem = stem.slice(0, -10);
    else if (stem.endsWith(".physics.json")) stem = stem.slice(0, -13);
    else return "";
    let best = "";
    for (let i = 0; i < ids.length; i++) {
        const candidate = ids[i];
        if (stem === candidate || stem.startsWith(candidate + "-")) {
            if (candidate.length > best.length) best = candidate;
        }
    }
    return best;
}

function deleteBuilding(req, res) {
    const id = safeId(req.body && req.body.id);
    if (!id) {
        res.status(400).json({ error: "Name the building to delete." });
        return;
    }
    const root = path.join(__dirname, "..");
    const savesDir = path.join(root, "tools", "building-editor", "saves");
    const absFile = path.join(savesDir, id + ".json");
    const ids = fs.existsSync(savesDir)
        ? fs.readdirSync(savesDir).filter((file) => file.endsWith(".json") && file !== "index.json").map((file) => file.slice(0, -5))
        : [];
    if (fs.existsSync(absFile)) fs.unlinkSync(absFile);
    const kitDir = path.join(root, "models", "kitbuild");
    if (fs.existsSync(kitDir)) {
        const files = fs.readdirSync(kitDir);
        for (let i = 0; i < files.length; i++) {
            if (kitOwner(files[i], ids) !== id) continue;
            fs.unlinkSync(path.join(kitDir, files[i]));
        }
    }
    try {
        execSync("node tools/building-editor/index-saves.js", { cwd: root, stdio: "pipe" });
    } catch (err) {
        res.status(500).json({ error: "Removed the building, but the list did not refresh." });
        return;
    }
    res.json({ ok: true, id });
}

module.exports = function buildingSave(req, res) {
    if (req.body && req.body.delete) {
        deleteBuilding(req, res);
        return;
    }
    const data = req.body;
    if (!data || !Array.isArray(data.pieces)) {
        res.status(400).json({ error: "Need a building JSON export with a pieces array." });
        return;
    }
    const id =
        (data.name || "building")
            .trim()
            .replace(/[^\w\-]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .toLowerCase() || "building";
    const root = path.join(__dirname, "..");
    const savesDir = path.join(root, "tools", "building-editor", "saves");
    fs.mkdirSync(savesDir, { recursive: true });
    const relFile = path.join("tools", "building-editor", "saves", id + ".json");
    const absFile = path.join(root, relFile);
    const backupDir = path.join(savesDir, ".backup");
    if (fs.existsSync(absFile)) {
        fs.mkdirSync(backupDir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        fs.copyFileSync(absFile, path.join(backupDir, id + "." + stamp + ".json"));
    }
    fs.writeFileSync(absFile, JSON.stringify({ ...data, name: data.name || id }, null, 2));

    let indexed = false;
    let baked = false;
    let bakeError = null;
    try {
        execSync("node tools/building-editor/index-saves.js", { cwd: root, stdio: "pipe" });
        indexed = true;
    } catch (err) {
        res.status(500).json({ error: "Saved file but catalog index failed.", id, file: relFile });
        return;
    }
    try {
        execSync(`node tools/bake-building.js "${relFile}" ${id}`, { cwd: root, stdio: "pipe", timeout: 120000 });
        baked = true;
    } catch (err) {
        bakeError = (err.stderr && err.stderr.toString()) || err.message || "bake failed";
    }

    res.json({
        ok: true,
        id,
        file: relFile.replace(/\\/g, "/"),
        indexed,
        baked,
        bakeError: bakeError || undefined
    });
};
