const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { getDb } = require("./db");

const COOKIE = "rosie_session";
const KEEP_LOGIN = 60 * 60 * 24 * 400;

function secureFlag() {
    return process.env.VERCEL ? "; Secure" : "";
}

function readCookie(req) {
    const header = req.headers.cookie || "";
    for (const part of header.split(";")) {
        const text = part.trim();
        const eq = text.indexOf("=");
        if (eq === -1) continue;
        if (text.slice(0, eq) === COOKIE) {
            return decodeURIComponent(text.slice(eq + 1));
        }
    }
    return "";
}

function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function readJson(req) {
    const body = req.body;
    if (!body) return {};
    if (typeof body === "string") {
        try {
            return JSON.parse(body);
        } catch {
            return {};
        }
    }
    return body;
}

async function createSession(res, userId) {
    const token = crypto.randomBytes(32).toString("hex");
    const db = await getDb();
    await db.collection("sessions").insertOne({
        tokenHash: hashToken(token),
        userId,
        expiresAt: new Date(Date.now() + KEEP_LOGIN * 1000)
    });
    res.setHeader(
        "Set-Cookie",
        `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${KEEP_LOGIN}${secureFlag()}`
    );
}

async function currentUser(req, res) {
    const token = readCookie(req);
    if (!token) return null;
    const db = await getDb();
    const session = await db.collection("sessions").findOne({
        tokenHash: hashToken(token),
        expiresAt: { $gt: new Date() }
    });
    if (!session) return null;
    if (res) {
        const month = 60 * 60 * 24 * 30 * 1000;
        if (session.expiresAt.getTime() - Date.now() < month) {
            const expiresAt = new Date(Date.now() + KEEP_LOGIN * 1000);
            await db.collection("sessions").updateOne({ _id: session._id }, { $set: { expiresAt } });
            res.setHeader(
                "Set-Cookie",
                `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${KEEP_LOGIN}${secureFlag()}`
            );
        }
    }
    return db.collection("users").findOne(
        { _id: session.userId },
        { projection: { passwordHash: 0 } }
    );
}

async function destroySession(req, res) {
    const token = readCookie(req);
    if (token) {
        const db = await getDb();
        await db.collection("sessions").deleteOne({ tokenHash: hashToken(token) });
    }
    res.setHeader(
        "Set-Cookie",
        `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureFlag()}`
    );
}

module.exports = { bcrypt, readJson, createSession, currentUser, destroySession };
