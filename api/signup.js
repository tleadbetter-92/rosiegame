const { getDb } = require("../lib/db");
const { bcrypt, readJson, createSession } = require("../lib/auth");

const USERNAME = /^[a-zA-Z0-9_]{3,20}$/;

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Use POST" });
        return;
    }
    try {
        const body = readJson(req);
        const username = String(body.username || "").trim();
        const password = String(body.password || "");
        if (!USERNAME.test(username)) {
            res.status(400).json({ error: "Username must be 3 to 20 letters, numbers, or underscores." });
            return;
        }
        if (password.length < 8 || password.length > 72) {
            res.status(400).json({ error: "Password must be 8 to 72 characters." });
            return;
        }
        const db = await getDb();
        const passwordHash = await bcrypt.hash(password, 10);
        let created;
        try {
            created = await db.collection("users").insertOne({
                username,
                usernameLower: username.toLowerCase(),
                passwordHash,
                createdAt: new Date()
            });
        } catch (error) {
            if (error && error.code === 11000) {
                res.status(409).json({ error: "That username is taken." });
                return;
            }
            throw error;
        }
        await createSession(res, created.insertedId);
        res.status(201).json({ user: { username } });
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ error: "Could not create the account." });
    }
};
