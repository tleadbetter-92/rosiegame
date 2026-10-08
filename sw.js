self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
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
    let data = { title: "Roulette", body: "You have a new message", url: "/messenger.html" };
    try {
        if (event.data) data = { ...data, ...event.data.json() };
    } catch {
        data.body = event.data ? event.data.text() : data.body;
    }
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        const openHere = windows.filter(siteIsOpen);
        if (openHere.length) {
            await Promise.all(openHere.map((client) => client.postMessage({ cash: true })));
        }
        await self.registration.showNotification("new challenge for you to beat", {
            body: "new challenge for you to beat",
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            tag: "rosie-challenge-" + Date.now(),
            silent: openHere.length > 0,
            data: {
                url: data.url || "/messenger.html",
                chat: data.chat || ""
            }
        });
    })());
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const data = event.notification.data || {};
    const url = data.url || "/messenger.html";
    event.waitUntil((async () => {
        const openClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of openClients) {
            if (client.url.includes("messenger.html")) {
                client.postMessage({ chat: data.chat || "" });
                await client.focus();
                return;
            }
        }
        await self.clients.openWindow(url);
    })());
});
