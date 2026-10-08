const { ObjectId } = require("mongodb");
const { getDb } = require("../lib/db");
const { currentUser } = require("../lib/auth");

function photoBytes(value) {
    if (!value) return Buffer.alloc(0);
    if (Buffer.isBuffer(value)) return value;
    if (value.buffer) return Buffer.from(value.buffer);
    return Buffer.from(value);
}

module.exports = async function handler(req, res) {
    if (req.method !== "GET") {
        res.status(405).json({ error: "Use GET" });
        return;
    }
    try {
        const user = await currentUser(req, res);
        if (!user) {
            res.status(401).json({ error: "Log in first." });
            return;
        }
        const id = new URL(req.url, "http://localhost").searchParams.get("id") || "";
        if (!ObjectId.isValid(id)) {
            res.status(404).json({ error: "Photo not found." });
            return;
        }
        const db = await getDb();
        const image = await db.collection("images").findOne({ _id: new ObjectId(id) });
        if (!image) {
            res.status(404).json({ error: "Photo not found." });
            return;
        }
        const conversation = await db.collection("conversations").findOne({
            _id: image.conversationId,
            participants: user._id
        });
        if (!conversation) {
            res.status(404).json({ error: "Photo not found." });
            return;
        }
        res.status(200);
        res.setHeader("Content-Type", image.type || "image/jpeg");
        res.setHeader("Cache-Control", "private, max-age=86400");
        res.send(photoBytes(image.data));
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ error: "Could not load the photo." });
    }
};
