module.exports = async function handler(req, res) {
    if (req.method !== "GET") {
        res.status(405).json({ error: "Use GET" });
        return;
    }
    res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
};
