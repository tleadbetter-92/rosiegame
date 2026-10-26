const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "data", "survey-rise.json");

function readSaved() {
    try {
        const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
        return Array.isArray(data.cells) ? data.cells : [];
    } catch (err) {
        return [];
    }
}

module.exports = async function handler(req, res) {
    if (req.method === "GET") {
        res.status(200).json({ cells: readSaved() });
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    const incoming = req.body && req.body.cells;
    if (!Array.isArray(incoming) || incoming.length > 400000 || incoming.length % 2 !== 0) {
        res.status(400).json({ error: "Bad sculpt" });
        return;
    }
    const merged = new Map();
    const previous = readSaved();
    for (let i = 0; i + 1 < previous.length; i += 2) merged.set(previous[i], previous[i + 1]);
    for (let i = 0; i + 1 < incoming.length; i += 2) {
        const index = incoming[i];
        const value = incoming[i + 1];
        if (!Number.isInteger(index) || index < 0 || !Number.isFinite(value)) continue;
        merged.set(index, Math.max(-800, Math.min(800, value)));
    }
    const cells = [];
    merged.forEach((value, index) => {
        cells.push(index, value);
    });
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ cells: cells }));
    res.status(200).json({ ok: true, count: cells.length / 2 });
};
