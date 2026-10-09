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
        imageId: doc.imageId ? String(doc.imageId) : "",
        audioId: doc.audioId ? String(doc.audioId) : "",
        videoId: doc.videoId ? String(doc.videoId) : "",
        quote: doc.quote && doc.quote.text ? doc.quote : null,
        createdAt: doc.createdAt
    };
}

async function unreadChallenges(db, userId) {
    if (!userId) return 0;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const conversations = await db.collection("conversations")
        .find({ participants: userId })
        .project({ _id: 1 })
        .toArray();
    if (!conversations.length) return 0;
    return db.collection("messages").countDocuments({
        conversationId: { $in: conversations.map((item) => item._id) },
        userId: { $ne: userId },
        createdAt: { $gte: since },
        seenBy: { $ne: userId }
    });
}

function readPhoto(value) {
    if (!value) return null;
    const raw = String(value).replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
    const data = Buffer.from(raw, "base64");
    if (!data.length || data.length > 800000) {
        const error = new Error("That photo is too large.");
        error.status = 400;
        throw error;
    }
    let type = "";
    if (data[0] === 0xff && data[1] === 0xd8) type = "image/jpeg";
    else if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) type = "image/png";
    else if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) type = "image/gif";
    else if (data.slice(0, 4).toString("ascii") === "RIFF" && data.slice(8, 12).toString("ascii") === "WEBP") type = "image/webp";
    if (!type) {
        const error = new Error("Use a photo.");
        error.status = 400;
        throw error;
    }
    return { data, type };
}

function readVoice(value) {
    if (!value) return null;
    const raw = String(value).replace(/^data:audio\/[a-zA-Z0-9.+-]+;base64,/, "");
    const data = Buffer.from(raw, "base64");
    if (!data.length || data.length > 500000) {
        const error = new Error("That voice note is too long.");
        error.status = 400;
        throw error;
    }
    let type = "";
    if (data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3) type = "audio/webm";
    else if (data.slice(0, 4).toString("ascii") === "OggS") type = "audio/ogg";
    else if (data.length > 8 && data.slice(4, 8).toString("ascii") === "ftyp") type = "audio/mp4";
    else if (data.slice(0, 4).toString("ascii") === "RIFF" && data.slice(8, 12).toString("ascii") === "WAVE") type = "audio/wav";
    if (!type) {
        const error = new Error("That voice note could not be sent.");
        error.status = 400;
        throw error;
    }
    return { data, type };
}

function readVideo(value) {
    if (!value) return null;
    const raw = String(value).replace(/^data:video\/[a-zA-Z0-9.+-]+;base64,/, "");
    const data = Buffer.from(raw, "base64");
    if (!data.length || data.length > 2_200_000) {
        const error = new Error("That video is too long. Use a shorter clip.");
        error.status = 400;
        throw error;
    }
    let type = "";
    if (data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3) type = "video/webm";
    else if (data.length > 8 && data.slice(4, 8).toString("ascii") === "ftyp") type = "video/mp4";
    if (!type) {
        const error = new Error("Use a video.");
        error.status = 400;
        throw error;
    }
    return { data, type };
}

function cleanQuote(value) {
    if (!value || typeof value !== "object") return null;
    const id = String(value.id || "");
    const text = String(value.text || "").trim().slice(0, 140);
    if (!text) return null;
    return {
        id: id.slice(0, 40),
        username: String(value.username || "Chat").trim().slice(0, 20) || "Chat",
        text
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
        const user = await currentUser(req, res);
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
            await db.collection("messages").updateMany(
                {
                    conversationId: conversation._id,
                    userId: { $ne: user._id },
                    seenBy: { $ne: user._id }
                },
                { $addToSet: { seenBy: user._id } }
            );
            const docs = await db.collection("messages")
                .find({
                    conversationId: conversation._id,
                    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                })
                .sort({ createdAt: -1 })
                .limit(100)
                .toArray();
            docs.reverse();
            res.status(200).json({
                messages: docs.map((doc) => {
                    const message = toMessage(doc);
                    const mine = String(doc.userId) === String(user._id);
                    message.seen = mine && (doc.seenBy || []).some((id) => String(id) !== String(doc.userId));
                    return message;
                })
            });
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
            if (score.length > 20) {
                res.status(400).json({ error: "Score must be 20 characters or less." });
                return;
            }
            let time = "";
            if (amount) {
                if (!/^\d{1,3}$/.test(amount) || !unit) {
                    res.status(400).json({ error: "Time needs a number of mins or hours." });
                    return;
                }
                time = amount + " " + unit;
            }
            if (!text && !score && !time && !body.image && !body.voice && !body.video) {
                res.status(400).json({ error: "Write a message, a score, a time, add a photo, a voice note, or a video." });
                return;
            }
            const photo = readPhoto(body.image);
            const voice = readVoice(body.voice);
            const video = readVideo(body.video);
            const createdAt = new Date();
            const created = await db.collection("messages").insertOne({
                conversationId: conversation._id,
                userId: user._id,
                username: user.username,
                text,
                score,
                time,
                quote: cleanQuote(body.quote),
                createdAt
            });
            let imageId = "";
            let audioId = "";
            let videoId = "";
            const extras = {};
            if (photo) {
                const saved = await db.collection("images").insertOne({
                    conversationId: conversation._id,
                    messageId: created.insertedId,
                    type: photo.type,
                    data: photo.data,
                    createdAt
                });
                imageId = String(saved.insertedId);
                extras.imageId = saved.insertedId;
            }
            if (voice) {
                const saved = await db.collection("images").insertOne({
                    conversationId: conversation._id,
                    messageId: created.insertedId,
                    type: voice.type,
                    data: voice.data,
                    createdAt
                });
                audioId = String(saved.insertedId);
                extras.audioId = saved.insertedId;
            }
            if (video) {
                const saved = await db.collection("images").insertOne({
                    conversationId: conversation._id,
                    messageId: created.insertedId,
                    type: video.type,
                    data: video.data,
                    createdAt
                });
                videoId = String(saved.insertedId);
                extras.videoId = saved.insertedId;
            }
            if (imageId || audioId || videoId) {
                await db.collection("messages").updateOne(
                    { _id: created.insertedId },
                    { $set: extras }
                );
            }
            await db.collection("conversations").updateOne(
                { _id: conversation._id },
                { $set: { updatedAt: createdAt } }
            );
            const chatId = String(conversation._id);
            const others = (conversation.participants || []).filter((id) => String(id) !== String(user._id));
            for (const otherId of others) {
                const unread = await unreadChallenges(db, otherId);
                if (unread > 7) continue;
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
            }
            res.status(201).json({
                message: toMessage({
                    _id: created.insertedId,
                    username: user.username,
                    text,
                    score,
                    time,
                    imageId,
                    audioId,
                    videoId,
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
        res.status(error.status || 500).json({
            error: error.status === 400 ? error.message : "Could not use messages."
        });
    }
};
