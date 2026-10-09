const { getDb } = require("../lib/db");
const { currentUser, readJson, destroySession } = require("../lib/auth");

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Use POST" });
        return;
    }
    try {
        const user = await currentUser(req, res);
        if (!user) {
            res.status(401).json({ error: "Log in first." });
            return;
        }
        const db = await getDb();
        const conversations = await db.collection("conversations")
            .find({ participants: user._id })
            .toArray();
        const ids = conversations.map((conversation) => conversation._id);
        if (ids.length) {
            await db.collection("messages").deleteMany({ conversationId: { $in: ids } });
            await db.collection("images").deleteMany({ conversationId: { $in: ids } });
            await db.collection("conversations").deleteMany({ _id: { $in: ids } });
        }
        await db.collection("notes").deleteMany({ userId: user._id });
        await db.collection("pushSubscriptions").deleteMany({ userId: user._id });
        const account = readJson(req).account === true;
        if (account) {
            await db.collection("sessions").deleteMany({ userId: user._id });
            await db.collection("users").deleteOne({ _id: user._id });
            await destroySession(req, res);
        }
        res.status(200).json({ ok: true, account });
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ error: "Could not clear your data." });
    }
};
