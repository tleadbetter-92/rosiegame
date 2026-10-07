const { ObjectId } = require("mongodb");
const { getDb } = require("../lib/db");
const { currentUser, readJson } = require("../lib/auth");
const { notifyUser } = require("../lib/push");

function toMessage(doc) {
    return {
        id: String(doc._id),
        username: doc.username,
        text: doc.text,
        score: doc.score || "",
        time: doc.time || "",
        reply: doc.reply || "",
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
                .find({
                    conversationId: conversation._id,
                    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                })
                .sort({ createdAt: -1 })
                .limit(100)
                .toArray();
            docs.reverse();
            res.status(200).json({ messages: docs.map(toMessage) });
            return;
        }
        if (req.method === "POST") {
            const body = readJson(req);
            const text = String(body.text || "").trim();
            const score = String(body.score || "").trim();
            const amount = String(body.time || "").trim();
            const unit = body.unit === "hours" || body.unit === "mins" ? body.unit : "";
            if (text.length > 500) {
                res.status(400).json({ error: "Message must be 1 to 500 characters." });
                return;
            }
            if (!score || score.length > 20 || !/^\d{1,3}$/.test(amount) || !unit) {
                res.status(400).json({ error: "Add a score and a time." });
                return;
            }
            const time = amount + " " + unit;
            const createdAt = new Date();
            const created = await db.collection("messages").insertOne({
                conversationId: conversation._id,
                userId: user._id,
                username: user.username,
                text,
                score,
                time,
                createdAt
            });
            await db.collection("conversations").updateOne(
                { _id: conversation._id },
                { $set: { updatedAt: createdAt } }
            );
            const otherId = conversation.participants.find((id) => String(id) !== String(user._id));
            const chatId = String(conversation._id);
            try {
                await notifyUser(otherId, {
                    title: "new challenge for you to beat",
                    body: "new challenge for you to beat",
                    url: "/messenger.html?chat=" + encodeURIComponent(chatId),
                    chat: chatId
                });
            } catch (error) {
                console.error(error);
            }
            res.status(201).json({
                message: toMessage({
                    _id: created.insertedId,
                    username: user.username,
                    text,
                    score,
                    time,
                    createdAt
                })
            });
            return;
        }
        if (req.method === "PATCH") {
            const body = readJson(req);
            const reply = body.reply === "accepted" || body.reply === "rejected" ? body.reply : "";
            const messageId = String(body.messageId || "");
            if (!reply || !ObjectId.isValid(messageId)) {
                res.status(400).json({ error: "Choose accept or reject." });
                return;
            }
            const message = await db.collection("messages").findOne({
                _id: new ObjectId(messageId),
                conversationId: conversation._id
            });
            if (!message) {
                res.status(404).json({ error: "That score is gone." });
                return;
            }
            if (String(message.userId) === String(user._id)) {
                res.status(400).json({ error: "You cannot answer your own score." });
                return;
            }
            if (message.reply === "accepted" || message.reply === "rejected") {
                res.status(400).json({ error: "Already answered." });
                return;
            }
            await db.collection("messages").updateOne(
                { _id: message._id },
                { $set: { reply } }
            );
            res.status(200).json({ ok: true, reply });
            return;
        }
        res.status(405).json({ error: "Use GET, POST, or PATCH" });
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ error: "Could not use messages." });
    }
};
