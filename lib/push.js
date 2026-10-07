const webpush = require("web-push");
const { getDb } = require("./db");

function ready() {
    return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function setup() {
    if (!ready()) return false;
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || "mailto:rosie@localhost",
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
