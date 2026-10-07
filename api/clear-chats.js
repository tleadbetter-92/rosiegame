const { getDb } = require("../lib/db");
const { currentUser } = require("../lib/auth");

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Use POST" });
        return;
    }
    try {
        const user = await currentUser(req, res);
        if (!user) {
            res.status(401).json({ ok: false });
            return;
        }
        const db = await getDb();
        const conversations = await db.collection("conversations")
            .find({ participants: user._id })
            .toArray();
        const ids = conversations.map((conversation) => conversation._id);
        if (ids.length) {
            await db.collection("messages").deleteMany({ conversationId: { $in: ids } });
            await db.collection("conversations").deleteMany({ _id: { $in: ids } });
        }
        res.status(200).json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ ok: false });
    }
};
