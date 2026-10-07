self.addEventListener("push", (event) => {
    let data = { title: "Rosie", body: "You have a new message", url: "/messenger.html" };
    try {
        if (event.data) data = { ...data, ...event.data.json() };
    } catch {
        data.body = event.data ? event.data.text() : data.body;
    }
    event.waitUntil(self.registration.showNotification(data.title || "Rosie", {
        body: data.body || "You have a new message",
        data: { url: data.url || "/messenger.html" }
    }));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || "/messenger.html";
    event.waitUntil(self.clients.openWindow(url));
});
