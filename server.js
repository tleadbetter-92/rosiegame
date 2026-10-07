const http = require("http");
const fs = require("fs");
const path = require("path");

function loadEnv() {
    const file = path.join(__dirname, ".env");
    if (!fs.existsSync(file)) return;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
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

loadEnv();

const routes = {
    "/api/signup": require("./api/signup"),
    "/api/login": require("./api/login"),
    "/api/logout": require("./api/logout"),
    "/api/me": require("./api/me"),
    "/api/messages": require("./api/messages"),
    "/api/conversations": require("./api/conversations"),
    "/api/clear-chats": require("./api/clear-chats"),
    "/api/push-key": require("./api/push-key"),
    "/api/push-subscribe": require("./api/push-subscribe"),
    "/api/notes": require("./api/notes")
};

const root = __dirname;
const port = Number(process.env.PORT) || 5173;

const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".json": "application/json; charset=utf-8"
};

function send(res, status, body, type) {
    res.writeHead(status, { "Content-Type": type || "text/plain; charset=utf-8" });
    res.end(body);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on("data", (chunk) => {
            size += chunk.length;
            if (size > 1_000_000) {
                reject(new Error("Body too large"));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", () => {
            if (!chunks.length) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
            } catch {
                resolve({});
            }
        });
        req.on("error", reject);
    });
}

function callHandler(handler, req, res, body) {
    req.body = body;
    let statusCode = 200;
    const headers = {};
    const wrapped = {
        status(code) {
            statusCode = code;
            return this;
        },
        setHeader(name, value) {
            headers[name] = value;
            return this;
        },
        json(obj) {
            headers["Content-Type"] = "application/json; charset=utf-8";
            res.writeHead(statusCode, headers);
            res.end(JSON.stringify(obj));
        }
    };
    Promise.resolve(handler(req, wrapped)).catch((error) => {
        console.error(error);
        if (!res.headersSent) {
            send(res, 500, JSON.stringify({ error: "Something went wrong." }), "application/json; charset=utf-8");
        }
    });
}

const server = http.createServer((req, res) => {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
        send(res, 400, "Bad request");
        return;
    }

    if (routes[pathname]) {
        readBody(req).then((body) => callHandler(routes[pathname], req, res, body)).catch(() => {
            send(res, 400, JSON.stringify({ error: "Bad request" }), "application/json; charset=utf-8");
        });
        return;
    }

    if (pathname.endsWith("/")) pathname += "index.html";
    if (pathname.startsWith("/.env") || pathname.startsWith("/.git") || pathname.startsWith("/node_modules")) {
        send(res, 404, "Not found");
        return;
    }

    const file = path.normalize(path.join(root, pathname));
    const relative = path.relative(root, file);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        send(res, 403, "Forbidden");
        return;
    }

    fs.readFile(file, (err, data) => {
        if (err) {
            send(res, 404, "Not found");
            return;
        }
        const type = types[path.extname(file).toLowerCase()] || "application/octet-stream";
        send(res, 200, data, type);
    });
});

server.listen(port, () => {
    console.log(`Chat running at http://localhost:${port}/`);
});
