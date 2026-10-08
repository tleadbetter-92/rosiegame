const { ObjectId } = require("mongodb");
const { getDb } = require("../lib/db");
const { currentUser, readJson } = require("../lib/auth");

const FRESH_MS = 5000;

function requestedId(req) {
    if (req.query && req.query.conversationId) return String(req.query.conversationId);
    const bodyId = readJson(req).conversationId;
    if (bodyId) return String(bodyId);
    try {
        return new URL(req.url, "http://localhost").searchParams.get("conversationId") || "";
    } catch {
        return "";
    }
}

function freshTypers(conversation, userId) {
    const typing = conversation.typing || {};
    const now = Date.now();
    return Object.keys(typing)
        .filter((id) => id !== String(userId))
        .map((id) => ({ id, at: new Date(typing[id]).getTime() }))
        .filter((item) => item.at && now - item.at < FRESH_MS)
        .sort((a, b) => b.at - a.at);
}

module.exports = async function handler(req, res) {
    try {
        const user = await currentUser(req, res);
        if (!user) {
            res.status(401).json({ error: "Log in first." });
            return;
        }
        const db = await getDb();
        const conversationId = requestedId(req);
        if (!ObjectId.isValid(conversationId)) {
            res.status(404).json({ error: "That chat was not found." });
            return;
        }
        const conversation = await db.collection("conversations").findOne({
            _id: new ObjectId(conversationId),
            participants: user._id
        });
        if (!conversation) {
            res.status(404).json({ error: "That chat was not found." });
            return;
        }
        if (req.method === "GET") {
            const typers = freshTypers(conversation, user._id);
            const ids = typers.map((item) => item.id).filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
            let names = [];
            if (ids.length) {
                const people = await db.collection("users")
                    .find({ _id: { $in: ids } }, { projection: { username: 1 } })
                    .toArray();
                const byId = new Map(people.map((person) => [String(person._id), person.username]));
                names = typers.map((item) => byId.get(item.id)).filter(Boolean);
            }
            res.status(200).json({ typing: names });
            return;
        }
        if (req.method === "POST") {
            const key = "typing." + String(user._id);
            if (readJson(req).typing === true) {
                await db.collection("conversations").updateOne(
                    { _id: conversation._id },
                    { $set: { [key]: new Date() } }
                );
            } else {
                await db.collection("conversations").updateOne(
                    { _id: conversation._id },
                    { $unset: { [key]: "" } }
                );
            }
            res.status(200).json({ ok: true });
            return;
        }
        res.status(405).json({ error: "Use GET or POST" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Could not update typing." });
    }
};
