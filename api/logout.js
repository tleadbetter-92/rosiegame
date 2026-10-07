const { destroySession } = require("../lib/auth");

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Use POST" });
        return;
    }
    try {
        await destroySession(req, res);
        res.status(200).json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ error: "Could not log out." });
    }
};
