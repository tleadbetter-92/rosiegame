const { getDb } = require("../lib/db");
const { currentUser, readJson } = require("../lib/auth");

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
        const body = readJson(req);
        const endpoint = body && body.endpoint;
        const keys = body && body.keys;
        if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
            res.status(400).json({ error: "Missing notification subscription." });
            return;
        }
        const db = await getDb();
        await db.collection("pushSubscriptions").updateOne(
            { endpoint },
            {
                $set: {
                    endpoint,
                    keys,
                    userId: user._id,
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );
        res.status(200).json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ error: "Could not save notifications." });
    }
};
