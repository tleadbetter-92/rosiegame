const { getDb } = require("../lib/db");
const { bcrypt, readJson, createSession } = require("../lib/auth");

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Use POST" });
        return;
    }
    try {
        const body = readJson(req);
        const username = String(body.username || "").trim().toLowerCase();
        const password = String(body.password || "");
        const db = await getDb();
        const user = await db.collection("users").findOne({ usernameLower: username });
        const matches = user ? await bcrypt.compare(password, user.passwordHash) : false;
        if (!user || !matches) {
            res.status(401).json({ error: "Wrong username or password." });
            return;
        }
        await createSession(res, user._id);
        res.status(200).json({ user: { username: user.username } });
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ error: "Could not log in." });
    }
};
