const { MongoClient } = require("mongodb");

const DB_NAME = "rosie-messenger";
let connecting;

function getDb() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        const error = new Error("MONGODB_URI is not set");
        error.status = 500;
        throw error;
    }
    if (!connecting) {
        const client = new MongoClient(uri);
        connecting = client.connect().then(async (connected) => {
            const db = connected.db(DB_NAME);
            await db.collection("users").createIndex({ usernameLower: 1 }, { unique: true });
            await db.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true });
            await db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
            await db.collection("conversations").createIndex({ participantKey: 1 }, { unique: true });
            await db.collection("conversations").createIndex({ participants: 1, updatedAt: -1 });
            const messages = db.collection("messages");
            await messages.createIndex({ conversationId: 1, createdAt: -1 });
            const messageIndexes = await messages.indexes();
            const createdAtIndex = messageIndexes.find((index) => index.name === "createdAt_1");
            if (createdAtIndex && createdAtIndex.expireAfterSeconds !== 60 * 60 * 24) {
                await messages.dropIndex("createdAt_1");
            }
            await messages.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });
            await db.collection("pushSubscriptions").createIndex({ endpoint: 1 }, { unique: true });
            await db.collection("pushSubscriptions").createIndex({ userId: 1 });
            return db;
        }).catch((error) => {
            connecting = null;
            throw error;
        });
    }
    return connecting;
}

module.exports = { getDb, DB_NAME };
