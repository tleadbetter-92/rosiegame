self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
    const path = new URL(event.request.url).pathname;
    if (path !== "/api/messages" && path !== "/api/notes" && path !== "/api/image" && path !== "/api/conversations") return;
    event.respondWith(fetch(event.request, { cache: "no-store" }));
});

function siteIsOpen(client) {
    if (client.visibilityState !== "visible") return false;
    try {
        const path = new URL(client.url).pathname;
        return path === "/" || path === "/index.html" || path === "/messenger.html";
    } catch {
        return false;
    }
}

self.addEventListener("push", (event) => {
    let data = { title: "Roulette", body: "You have a new message", url: "/" };
    try {
        if (event.data) data = { ...data, ...event.data.json() };
    } catch {
        data.body = event.data ? event.data.text() : data.body;
    }
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        const openHere = windows.filter(siteIsOpen);
        const newMessage = Boolean(data.chat);
        if (newMessage && openHere.length) {
            await Promise.all(openHere.map((client) => client.postMessage({ cash: true })));
        }
        await self.registration.showNotification("new challenge for you to beat", {
            body: "new challenge for you to beat",
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            tag: "rosie-challenge-" + Date.now(),
            silent: !newMessage || openHere.length > 0,
            data: {
                url: "/",
                chat: data.chat || ""
            }
        });
    })());
});

function isGame(url) {
    try {
        const path = new URL(url).pathname;
        return path === "/" || path === "/index.html";
    } catch {
        return false;
    }
}

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const home = new URL("/", self.location.origin).href;
    event.waitUntil((async () => {
        const openClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        const ours = openClients.find((client) => {
            try {
                const path = new URL(client.url).pathname;
                return path === "/" || path === "/index.html" || path === "/messenger.html";
            } catch {
                return false;
            }
        });
        if (ours) {
            if (!isGame(ours.url) && "navigate" in ours) await ours.navigate(home);
            await ours.focus();
            return;
        }
        await self.clients.openWindow(home);
    })());
});
