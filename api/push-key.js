const { vapidPublicKey } = require("../lib/push");

module.exports = async function handler(req, res) {
    if (req.method !== "GET") {
        res.status(405).json({ error: "Use GET" });
        return;
    }
    res.status(200).json({ publicKey: vapidPublicKey() });
};
