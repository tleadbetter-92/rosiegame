const { currentUser } = require("../lib/auth");

module.exports = async function handler(req, res) {
    if (req.method !== "GET") {
        res.status(405).json({ error: "Use GET" });
        return;
    }
    try {
        const user = await currentUser(req, res);
        if (!user) {
            res.status(401).json({ user: null });
            return;
        }
        res.status(200).json({ user: { username: user.username } });
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ error: "Could not check the login." });
    }
};
