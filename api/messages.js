const { ObjectId } = require("mongodb");
const { getDb } = require("../lib/db");
const { currentUser, readJson } = require("../lib/auth");

function toMessage(doc) {
    return {
        id: String(doc._id),
        username: doc.username,
        text: doc.text,
        createdAt: doc.createdAt
    };
}

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

async function ownedConversation(db, user, conversationId) {
    if (!ObjectId.isValid(conversationId)) return null;
    return db.collection("conversations").findOne({
        _id: new ObjectId(conversationId),
        participants: user._id
    });
}

module.exports = async function handler(req, res) {
    try {
        const user = await currentUser(req);
        if (!user) {
            res.status(401).json({ error: "Log in first." });
            return;
        }
        const db = await getDb();
        const conversation = await ownedConversation(db, user, requestedId(req));
        if (!conversation) {
            res.status(404).json({ error: "Choose one of your private chats." });
            return;
        }
        if (req.method === "GET") {
            const docs = await db.collection("messages")
                .find({ conversationId: conversation._id })
                .sort({ createdAt: -1 })
                .limit(100)
                .toArray();
            docs.reverse();
            res.status(200).json({ messages: docs.map(toMessage) });
            return;
        }
        if (req.method === "POST") {
            const text = String(readJson(req).text || "").trim();
            if (!text || text.length > 500) {
                res.status(400).json({ error: "Message must be 1 to 500 characters." });
                return;
            }
            const createdAt = new Date();
            const created = await db.collection("messages").insertOne({
                conversationId: conversation._id,
                userId: user._id,
                username: user.username,
                text,
                createdAt
            });
            await db.collection("conversations").updateOne(
                { _id: conversation._id },
                { $set: { updatedAt: createdAt } }
            );
            res.status(201).json({
                message: toMessage({
                    _id: created.insertedId,
                    username: user.username,
                    text,
                    createdAt
                })
            });
            return;
        }
        res.status(405).json({ error: "Use GET or POST" });
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ error: "Could not use messages." });
    }
};
