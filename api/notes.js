const { getDb } = require("../lib/db");
const { currentUser, readJson } = require("../lib/auth");

function cleanRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.slice(0, 100).map((row) => ({
        text: String(row && row.text || "").trim().slice(0, 200),
        amount: String(row && row.amount || "").trim().slice(0, 20)
    }));
}

module.exports = async function handler(req, res) {
    try {
        const user = await currentUser(req, res);
        if (!user) {
            res.status(401).json({ error: "Log in first." });
            return;
        }
        const db = await getDb();
        const notes = db.collection("notes");
        if (req.method === "GET") {
            const doc = await notes.findOne({ userId: user._id });
            res.status(200).json({
                text: doc && doc.text ? doc.text : "",
                rows: doc && Array.isArray(doc.rows) ? doc.rows : []
            });
            return;
        }
        if (req.method === "PUT") {
            const body = readJson(req);
            const text = String(body.text || "").slice(0, 5000);
            const rows = cleanRows(body.rows);
            await notes.updateOne(
                { userId: user._id },
                { $set: { userId: user._id, text, rows, updatedAt: new Date() } },
                { upsert: true }
            );
            res.status(200).json({ ok: true });
            return;
        }
        res.status(405).json({ error: "Use GET or PUT" });
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ error: "Could not use notes." });
    }
};
