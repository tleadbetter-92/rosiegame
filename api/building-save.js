const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

module.exports = function buildingSave(req, res) {
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
