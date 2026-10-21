const fs = require("fs");
const path = require("path");

const envFile = path.join(__dirname, "..", ".env");
if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
    }
}

const handler = require("../api/npc-chat");

function call(method, body) {
    return new Promise((resolve) => {
        const req = { method, body: body || {} };
        const res = {
            statusCode: 200,
            setHeader() {},
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(obj) {
                resolve({ status: this.statusCode, body: obj });
            }
        };
        handler(req, res);
    });
}

(async () => {
    const get = await call("GET");
    console.log("GET /api/npc-chat", get.body);
    if (!get.body.configured) {
        console.log("SKIP POST — no OPENAI_API_KEY");
        return;
    }
    const post = await call("POST", {
        npc: "commander",
        message: "Who is in charge here?",
        history: []
    });
    console.log("POST status", post.status);
    if (post.body.reply) console.log("Reply:", post.body.reply);
    else console.log("Error:", post.body);
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
