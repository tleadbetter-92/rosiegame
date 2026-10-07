const http = require("http");
const fs = require("fs");
const path = require("path");

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

const server = http.createServer((req, res) => {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
        send(res, 400, "Bad request");
        return;
    }

    if (pathname.endsWith("/")) pathname += "index.html";

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
    console.log(`Site running at http://localhost:${port}/`);
    console.log(`The Print Shop: http://localhost:${port}/print-shop/`);
});
