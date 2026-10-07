const webpush = require("web-push");
const { getDb } = require("./db");

function keyBytes(value) {
    const key = String(value || "").trim();
    if (!key) return null;
    const padded = key.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (key.length % 4)) % 4);
    try {
        return Buffer.from(padded, "base64");
    } catch {
        return null;
    }
}

function usablePublicKey(value) {
    const bytes = keyBytes(value);
    return Boolean(bytes && bytes.length === 65 && bytes[0] === 4);
}

function vapidPublicKey() {
    const raw = process.env.VAPID_PUBLIC_KEY || "";
    if (usablePublicKey(raw)) return raw.trim();
    const repaired = raw.replace(/=/g, "");
    if (usablePublicKey(repaired)) return repaired;
    return "";
}

function ready() {
    return Boolean(vapidPublicKey() && process.env.VAPID_PRIVATE_KEY);
}

function vapidSubject() {
    const subject = process.env.VAPID_SUBJECT || "";
    if (subject.startsWith("https://")) return subject;
    if (subject.startsWith("mailto:") && !subject.includes("localhost")) return subject;
    return "https://rosiegame.vercel.app";
}

function setup() {
    if (!ready()) return false;
    webpush.setVapidDetails(
        vapidSubject(),
        vapidPublicKey(),
        process.env.VAPID_PRIVATE_KEY
    );
    return true;
}

async function notifyUser(userId, payload) {
    if (!setup()) return;
    const db = await getDb();
    const subscriptions = await db.collection("pushSubscriptions").find({ userId }).toArray();
    await Promise.all(subscriptions.map(async (subscription) => {
        try {
            await webpush.sendNotification(
                { endpoint: subscription.endpoint, keys: subscription.keys },
                JSON.stringify(payload)
            );
        } catch (error) {
            if (error.statusCode === 404 || error.statusCode === 410) {
                await db.collection("pushSubscriptions").deleteOne({ _id: subscription._id });
                return;
            }
            console.error(error);
        }
    }));
}

module.exports = { ready, notifyUser, vapidPublicKey };
