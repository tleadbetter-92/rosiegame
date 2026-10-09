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

function freshPeople(conversation, field, userId) {
    const marks = conversation[field] || {};
    const now = Date.now();
    return Object.keys(marks)
        .filter((id) => id !== String(userId))
        .map((id) => ({ id, at: new Date(marks[id]).getTime() }))
        .filter((item) => item.at && now - item.at < FRESH_MS)
        .sort((a, b) => b.at - a.at);
}

async function namesFor(db, people) {
    const ids = people.map((item) => item.id).filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    if (!ids.length) return [];
    const found = await db.collection("users")
        .find({ _id: { $in: ids } }, { projection: { username: 1 } })
        .toArray();
    const byId = new Map(found.map((person) => [String(person._id), person.username]));
    return people.map((item) => byId.get(item.id)).filter(Boolean);
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
            res.status(200).json({
                typing: await namesFor(db, freshPeople(conversation, "typing", user._id)),
                recording: await namesFor(db, freshPeople(conversation, "recording", user._id))
            });
            return;
        }
        if (req.method === "POST") {
            const body = readJson(req);
            const set = {};
            const unset = {};
            const userKey = String(user._id);
            if (body.typing === true) set["typing." + userKey] = new Date();
            else if (body.typing === false) unset["typing." + userKey] = "";
            if (body.recording === true) set["recording." + userKey] = new Date();
            else if (body.recording === false) unset["recording." + userKey] = "";
            const update = {};
            if (Object.keys(set).length) update.$set = set;
            if (Object.keys(unset).length) update.$unset = unset;
            if (Object.keys(update).length) {
                await db.collection("conversations").updateOne({ _id: conversation._id }, update);
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
