const { ObjectId } = require("mongodb");
const { getDb } = require("../lib/db");
const { currentUser, readJson } = require("../lib/auth");

const USERNAME = /^[a-zA-Z0-9_]{3,20}$/;

function otherId(conversation, userId) {
    return conversation.participants.find((id) => String(id) !== String(userId));
}

function wasSeen(seenBy, userId) {
    return (seenBy || []).some((id) => String(id) === String(userId));
}

function readState(latest, unreadCount, userId, otherUserId) {
    if (unreadCount > 0) return "unread";
    if (!latest.userId) return "";
    if (String(latest.userId) === String(userId)) {
        return wasSeen(latest.seenBy, otherUserId) ? "read" : "notread";
    }
    return "read";
}

async function listConversations(db, user) {
    const conversations = await db.collection("conversations")
        .find({ participants: user._id })
        .sort({ updatedAt: -1 })
        .toArray();
    const ids = conversations.map((conversation) => otherId(conversation, user._id)).filter(Boolean);
    const people = await db.collection("users")
        .find({ _id: { $in: ids } }, { projection: { username: 1 } })
        .toArray();
    const names = new Map(people.map((person) => [String(person._id), person.username]));
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const conversationIds = conversations.map((conversation) => conversation._id);
    const latest = conversationIds.length
        ? await db.collection("messages").aggregate([
            { $match: { conversationId: { $in: conversationIds }, createdAt: { $gte: since } } },
            { $sort: { createdAt: -1 } },
            { $group: {
                _id: "$conversationId",
                score: { $first: "$score" },
                time: { $first: "$time" },
                reply: { $first: "$reply" },
                username: { $first: "$username" },
                userId: { $first: "$userId" },
                seenBy: { $first: "$seenBy" }
            } }
        ]).toArray()
        : [];
    const unread = conversationIds.length
        ? await db.collection("messages").aggregate([
            { $match: {
                conversationId: { $in: conversationIds },
                createdAt: { $gte: since },
                userId: { $ne: user._id },
                seenBy: { $ne: user._id }
            } },
            { $group: { _id: "$conversationId", count: { $sum: 1 } } }
        ]).toArray()
        : [];
    const previews = new Map(latest.map((item) => [String(item._id), item]));
    const unreadCounts = new Map(unread.map((item) => [String(item._id), item.count]));
    return conversations.map((conversation) => {
        const latestItem = previews.get(String(conversation._id)) || {};
        const other = otherId(conversation, user._id);
        return {
            id: String(conversation._id),
            username: names.get(String(other)) || "Unknown",
            lastScore: latestItem.score || "",
            lastTime: latestItem.time || "",
            lastReply: latestItem.reply || "",
            lastUsername: latestItem.username || "",
            readState: readState(latestItem, unreadCounts.get(String(conversation._id)) || 0, user._id, other)
        };
    });
}

module.exports = async function handler(req, res) {
    try {
        const user = await currentUser(req, res);
        if (!user) {
            res.status(401).json({ error: "Log in first." });
            return;
        }
        const db = await getDb();
        if (req.method === "GET") {
            res.status(200).json({ conversations: await listConversations(db, user) });
            return;
        }
        if (req.method === "POST") {
            const username = String(readJson(req).username || "").trim();
            if (!USERNAME.test(username)) {
                res.status(400).json({ error: "Enter a username of 3 to 20 letters, numbers, or underscores." });
                return;
            }
            if (username.toLowerCase() === user.username.toLowerCase()) {
                res.status(400).json({ error: "You cannot add yourself." });
                return;
            }
            const other = await db.collection("users").findOne({ usernameLower: username.toLowerCase() });
            if (!other) {
                res.status(404).json({ error: "No account with that username." });
                return;
            }
            const ids = [user._id, other._id].map((id) => String(id)).sort();
            const participantKey = ids.join(":");
            const participants = ids.map((id) => new ObjectId(id));
            const now = new Date();
            let conversation = await db.collection("conversations").findOne({ participantKey });
            if (!conversation) {
                try {
                    const created = await db.collection("conversations").insertOne({
                        participants,
                        participantKey,
                        createdAt: now,
                        updatedAt: now
                    });
                    conversation = { _id: created.insertedId };
                } catch (error) {
                    if (!error || error.code !== 11000) throw error;
                    conversation = await db.collection("conversations").findOne({ participantKey });
                }
            }
            res.status(201).json({
                conversation: { id: String(conversation._id), username: other.username }
            });
            return;
        }
        res.status(405).json({ error: "Use GET or POST" });
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ error: "Could not use contacts." });
    }
};
