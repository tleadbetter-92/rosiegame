const webpush = require("web-push");
const { getDb } = require("./db");

function ready() {
    return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
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
        process.env.VAPID_PUBLIC_KEY,
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

module.exports = { ready, notifyUser };
