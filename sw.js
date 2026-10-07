self.addEventListener("push", (event) => {
    let data = { title: "Rosie", body: "You have a new message", url: "/messenger.html" };
    try {
        if (event.data) data = { ...data, ...event.data.json() };
    } catch {
        data.body = event.data ? event.data.text() : data.body;
    }
    event.waitUntil(self.registration.showNotification("new challenge for you to beat", {
        body: "new challenge for you to beat",
        data: {
            url: data.url || "/messenger.html",
            chat: data.chat || ""
        }
    }));
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
