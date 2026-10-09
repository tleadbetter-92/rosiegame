const { ObjectId } = require("mongodb");
const { getDb } = require("../lib/db");
const { currentUser, readJson } = require("../lib/auth");
const { decryptText } = require("../lib/secret");

const USERNAME = /^[a-zA-Z0-9_]{3,20}$/;

function otherId(conversation, userId) {
    return conversation.participants.find((id) => String(id) !== String(userId));
}

function wasSeen(seenBy, userId) {
    return (seenBy || []).some((id) => String(id) === String(userId));
}

function readState(latest, unreadCount, userId, participants) {
    if (unreadCount > 0) return "unread";
    if (!latest.userId) return "";
    if (String(latest.userId) === String(userId)) {
        const others = (participants || []).filter((id) => String(id) !== String(userId));
        const seen = others.every((id) => wasSeen(latest.seenBy, id));
        return seen ? "read" : "notread";
    }
    return "read";
}

async function listConversations(db, user) {
    const conversations = await db.collection("conversations")
        .find({ participants: user._id })
        .sort({ updatedAt: -1 })
        .toArray();
    const ids = conversations.flatMap((conversation) => conversation.participants || []);
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
        const members = (conversation.participants || [])
            .map((id) => names.get(String(id)))
            .filter(Boolean);
        const other = otherId(conversation, user._id);
        return {
            id: String(conversation._id),
            username: conversation.group ? (conversation.name || "Group") : (names.get(String(other)) || "Unknown"),
            group: Boolean(conversation.group),
            members,
            lastScore: decryptText(latestItem.score || ""),
            lastTime: decryptText(latestItem.time || ""),
            lastReply: latestItem.reply || "",
            lastUsername: latestItem.username || "",
            readState: readState(latestItem, unreadCounts.get(String(conversation._id)) || 0, user._id, conversation.participants)
        };
    });
}

async function peopleByName(db, usernames, user) {
    const wanted = [];
    const seen = new Set();
    for (const value of usernames) {
        const username = String(value || "").trim();
        const key = username.toLowerCase();
        if (!key || key === user.username.toLowerCase() || seen.has(key)) continue;
        seen.add(key);
        if (!USERNAME.test(username)) {
            const error = new Error("Usernames are 3 to 20 letters, numbers, or underscores.");
            error.status = 400;
            throw error;
        }
        wanted.push(username);
    }
    const found = await db.collection("users")
        .find({ usernameLower: { $in: wanted.map((name) => name.toLowerCase()) } })
        .toArray();
    const byLower = new Map(found.map((person) => [person.usernameLower, person]));
    const missing = wanted.find((name) => !byLower.has(name.toLowerCase()));
    if (missing) {
        const error = new Error("No account called " + missing + ".");
        error.status = 404;
        throw error;
    }
    return wanted.map((name) => byLower.get(name.toLowerCase()));
}

function groupView(conversation, people, user) {
    const names = new Map(people.map((person) => [String(person._id), person.username]));
    names.set(String(user._id), user.username);
    return {
        id: String(conversation._id),
        username: conversation.name || "Group",
        group: true,
        members: (conversation.participants || []).map((id) => names.get(String(id))).filter(Boolean)
    };
}

async function createGroup(db, user, body, res) {
    const name = String(body.name || "").trim().slice(0, 40);
    if (!name) {
        res.status(400).json({ error: "Give the group a name." });
        return;
    }
    const people = await peopleByName(db, body.members, user);
    if (people.length < 2) {
        res.status(400).json({ error: "Add at least two people." });
        return;
    }
    if (people.length > 19) {
        res.status(400).json({ error: "A group can have up to 20 people." });
        return;
    }
    const now = new Date();
    const participants = [user._id, ...people.map((person) => person._id)];
    const created = await db.collection("conversations").insertOne({
        participants,
        participantKey: "group:" + String(new ObjectId()),
        name,
        group: true,
        createdAt: now,
        updatedAt: now
    });
    res.status(201).json({
        conversation: groupView({ _id: created.insertedId, name, participants }, people, user)
    });
}

async function addToGroup(db, user, body, res) {
    const conversationId = String(body.conversationId || "");
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
    const people = await peopleByName(db, [body.username], user);
    const person = people[0];
    if (!person) {
        res.status(400).json({ error: "Enter a username." });
        return;
    }
    const already = (conversation.participants || []).some((id) => String(id) === String(person._id));
    if (already) {
        const known = await db.collection("users")
            .find({ _id: { $in: conversation.participants } }, { projection: { username: 1 } })
            .toArray();
        if (conversation.group) {
            res.status(200).json({ conversation: groupView(conversation, known, user) });
            return;
        }
        const other = known.find((member) => String(member._id) !== String(user._id));
        res.status(200).json({
            conversation: {
                id: String(conversation._id),
                username: other ? other.username : "Chat",
                group: false,
                members: known.map((member) => member.username)
            }
        });
        return;
    }
    if ((conversation.participants || []).length >= 20) {
        res.status(400).json({ error: "A group can have up to 20 people." });
        return;
    }
    const knownBefore = await db.collection("users")
        .find({ _id: { $in: conversation.participants } }, { projection: { username: 1 } })
        .toArray();
    const name = conversation.group
        ? (conversation.name || "Group")
        : [...knownBefore.map((member) => member.username), person.username].join(", ").slice(0, 40);
    const changes = {
        updatedAt: new Date(),
        group: true,
        name
    };
    if (!conversation.group) changes.participantKey = "group:" + String(conversation._id);
    await db.collection("conversations").updateOne(
        { _id: conversation._id },
        { $addToSet: { participants: person._id }, $set: changes }
    );
    const updated = await db.collection("conversations").findOne({ _id: conversation._id });
    const known = await db.collection("users")
        .find({ _id: { $in: updated.participants } }, { projection: { username: 1 } })
        .toArray();
    res.status(200).json({ conversation: groupView(updated, known, user) });
}

async function leaveGroup(db, user, req, res) {
    const fromBody = readJson(req).conversationId;
    let conversationId = fromBody ? String(fromBody) : "";
    if (!conversationId) {
        try {
            conversationId = new URL(req.url, "http://localhost").searchParams.get("id") || "";
        } catch {
            conversationId = "";
        }
    }
    if (!ObjectId.isValid(conversationId)) {
        res.status(404).json({ error: "That group was not found." });
        return;
    }
    const conversation = await db.collection("conversations").findOne({
        _id: new ObjectId(conversationId),
        participants: user._id,
        group: true
    });
    if (!conversation) {
        res.status(404).json({ error: "That group was not found." });
        return;
    }
    await db.collection("conversations").updateOne(
        { _id: conversation._id },
        { $pull: { participants: user._id } }
    );
    const updated = await db.collection("conversations").findOne({ _id: conversation._id });
    if (!updated || !(updated.participants || []).length) {
        await db.collection("messages").deleteMany({ conversationId: conversation._id });
        await db.collection("images").deleteMany({ conversationId: conversation._id });
        await db.collection("conversations").deleteOne({ _id: conversation._id });
    }
    res.status(200).json({ ok: true });
}

module.exports = async function handler(req, res) {
    res.setHeader("Cache-Control", "private, no-store");
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
            const body = readJson(req);
            if (Array.isArray(body.members)) {
                await createGroup(db, user, body, res);
                return;
            }
            if (body.conversationId) {
                await addToGroup(db, user, body, res);
                return;
            }
            const username = String(body.username || "").trim();
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
        if (req.method === "DELETE") {
            await leaveGroup(db, user, req, res);
            return;
        }
        res.status(405).json({ error: "Use GET, POST, or DELETE" });
    } catch (error) {
        console.error(error);
        const known = error.status === 400 || error.status === 404;
        res.status(error.status || 500).json({ error: known ? error.message : "Could not use contacts." });
    }
};
