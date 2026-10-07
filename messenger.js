const openedChat = new URLSearchParams(location.search).get("chat") || "";
history.replaceState(null, "", "messenger.html");

let leftPage = false;
let stayForNotifications = false;
document.addEventListener("visibilitychange", () => {
    if (stayForNotifications) return;
    if (document.visibilityState === "hidden") leftPage = true;
    if (document.visibilityState === "visible" && leftPage) location.replace("index.html");
});
window.addEventListener("pageshow", (event) => {
    if (event.persisted) location.replace("index.html");
});

const auth = document.getElementById("auth");
const chat = document.getElementById("chat");
const logoutBtn = document.getElementById("logoutBtn");
const seeAllBtn = document.getElementById("seeAllBtn");
const notifyBtn = document.getElementById("notifyBtn");
const authError = document.getElementById("authError");
const chatError = document.getElementById("chatError");
const contactError = document.getElementById("contactError");
const contactsEl = document.getElementById("contacts");
const threadTitle = document.getElementById("threadTitle");
const messagesEl = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendForm = document.getElementById("sendForm");
const chatPop = document.getElementById("chatPop");

let pushReady = null;
let timer = null;
let lastKey = null;
let contactKey = null;
let selectedId = "";
let selectedName = "";
let me = "";

async function api(path, options) {
    const response = await fetch(path, {
        credentials: "same-origin",
        headers: options && options.body ? { "Content-Type": "application/json" } : undefined,
        ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }
    return data;
}

function leaveContactBox() {
    const contactInput = document.getElementById("contactInput");
    if (document.activeElement === contactInput) contactInput.blur();
}

function showChat(username) {
    auth.hidden = true;
    chat.hidden = false;
    me = username;
    logoutBtn.hidden = false;
    notifyBtn.hidden = false;
    authError.textContent = "";
    leaveContactBox();
    setTimeout(leaveContactBox, 0);
    setTimeout(leaveContactBox, 250);
    prepareNotifications();
    loadConversations().then(() => openChatFromId(openedChat)).catch(() => {});
    if (!timer) timer = setInterval(refresh, 3000);
}

function showAuth() {
    auth.hidden = false;
    chat.hidden = true;
    me = "";
    logoutBtn.hidden = true;
    notifyBtn.hidden = true;
    selectedId = "";
    selectedName = "";
    lastKey = null;
    contactKey = null;
    messagesEl.replaceChildren();
    contactsEl.replaceChildren();
    sendForm.hidden = true;
    if (chatPop.open) chatPop.close();
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

function openConversation(id, username) {
    if (selectedId !== id) {
        selectedId = id;
        selectedName = username;
        lastKey = null;
        messagesEl.replaceChildren();
    }
    threadTitle.textContent = username;
    sendForm.hidden = false;
    if (!chatPop.open) chatPop.showModal();
    for (const button of contactsEl.querySelectorAll("button")) {
        button.classList.toggle("active", button.dataset.id === selectedId);
    }
    loadMessages().then(() => {
        contactKey = "";
        return loadConversations();
    }).catch(() => {});
}

function renderContacts(conversations) {
    const key = conversations.map((conversation) => conversation.id + ":" + conversation.lastScore + ":" + conversation.lastTime + ":" + conversation.lastReply + ":" + conversation.lastUsername + ":" + conversation.readState).join("|");
    if (key !== contactKey) {
        contactKey = key;
        contactsEl.replaceChildren();
        if (!conversations.length) {
            const empty = document.createElement("li");
            empty.className = "empty";
            empty.textContent = "No challenges yet.";
            contactsEl.appendChild(empty);
            return;
        }
        for (const conversation of conversations) {
            const item = document.createElement("li");
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.id = conversation.id;
            const top = document.createElement("span");
            top.className = "row-top";
            const name = document.createElement("strong");
            name.textContent = conversation.username;
            top.append(name);
            if (conversation.lastUsername === me && conversation.lastScore && conversation.lastTime) {
                const preview = document.createElement("span");
                preview.className = "preview";
                preview.textContent = conversation.lastReply || ".......";
                top.append(preview);
            } else if (conversation.lastScore || conversation.lastTime) {
                const metrics = document.createElement("span");
                metrics.className = "metrics";
                if (conversation.lastScore) metrics.append(metric("Score", conversation.lastScore));
                if (conversation.lastTime) metrics.append(metric("Time", conversation.lastTime));
                top.append(metrics);
            }
            if (conversation.readState === "unread") {
                const state = document.createElement("span");
                state.className = "read-state unread";
                state.setAttribute("aria-label", "Unread");
                top.append(state);
            } else if (conversation.readState) {
                const state = document.createElement("span");
                state.className = "read-state " + conversation.readState;
                state.textContent = conversation.readState === "read" ? "Read" : "Not read";
                top.append(state);
            }
            button.append(top);
            if (conversation.readState === "unread") button.classList.add("has-unread");
            button.addEventListener("click", () => openConversation(conversation.id, conversation.username));
            item.appendChild(button);
            contactsEl.appendChild(item);
        }
    }
    for (const button of contactsEl.querySelectorAll("button")) {
        button.classList.toggle("active", button.dataset.id === selectedId);
    }
}

async function answerMessage(messageId, reply) {
    chatError.textContent = "";
    try {
        await api("/api/messages", {
            method: "PATCH",
            body: JSON.stringify({ conversationId: selectedId, messageId, reply })
        });
        lastKey = "";
        contactKey = "";
        await loadMessages();
        await loadConversations();
    } catch (error) {
        chatError.textContent = error.message;
    }
}

function sentWhen(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "–";
    return date.toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function metric(label, value) {
    const item = document.createElement("span");
    item.className = "metric";
    const name = document.createElement("span");
    name.className = "label";
    name.textContent = label;
    const number = document.createElement("strong");
    number.textContent = value || "–";
    item.append(name, number);
    return item;
}

function renderMessages(messages) {
    const key = messages.map((message) => message.id + ":" + message.reply).join(",");
    if (key === lastKey) return;
    const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 40;
    lastKey = key;
    messagesEl.replaceChildren();
    if (!messages.length) {
        const empty = document.createElement("li");
        empty.className = "empty";
        empty.textContent = "No challenges yet.";
        messagesEl.appendChild(empty);
        return;
    }
    for (const message of messages) {
        const mine = message.username === me;
        const item = document.createElement("li");
        item.className = mine ? "mine" : "theirs";
        const bubble = document.createElement("div");
        bubble.className = "bubble";
        const head = document.createElement("div");
        head.className = "bubble-top";
        if (!mine) {
            const name = document.createElement("span");
            name.className = "name";
            name.textContent = message.username;
            head.append(name);
        }
        head.append(metric("Sent", sentWhen(message.createdAt)));
        bubble.append(head);
        if (message.text) {
            const text = document.createElement("p");
            text.textContent = message.text;
            bubble.append(text);
        }
        if (message.score || message.time) {
            const stats = document.createElement("div");
            stats.className = "stats";
            if (message.score) stats.append(metric("Score", message.score));
            if (message.time) stats.append(metric("Time", message.time));
            bubble.append(stats);
        }
        const challenge = Boolean(message.score && message.time);
        if (challenge && mine) {
            const answer = document.createElement("p");
            answer.className = "answer " + (message.reply || "waiting");
            answer.textContent = message.reply || ".......";
            bubble.append(answer);
        } else if (challenge && (message.reply === "accepted" || message.reply === "rejected")) {
            const answer = document.createElement("p");
            answer.className = "answer " + message.reply;
            answer.textContent = message.reply;
            bubble.append(answer);
        } else if (challenge) {
            const choices = document.createElement("div");
            choices.className = "choices";
            const accept = document.createElement("button");
            accept.type = "button";
            accept.textContent = "Accept";
            accept.addEventListener("click", () => answerMessage(message.id, "accepted"));
            const reject = document.createElement("button");
            reject.type = "button";
            reject.className = "reject";
            reject.textContent = "Reject";
            reject.addEventListener("click", () => answerMessage(message.id, "rejected"));
            choices.append(accept, reject);
            bubble.append(choices);
        }
        item.append(bubble);
        messagesEl.appendChild(item);
    }
    if (nearBottom || messagesEl.scrollTop === 0) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }
}

async function loadConversations() {
    const data = await api("/api/conversations");
    const conversations = data.conversations || [];
    renderContacts(conversations);
    const selected = conversations.find((conversation) => conversation.id === selectedId);
    if (selected) selectedName = selected.username;
    return conversations;
}

async function loadMessages() {
    if (!selectedId) return;
    try {
        const data = await api("/api/messages?conversationId=" + encodeURIComponent(selectedId));
        chatError.textContent = "";
        renderMessages(data.messages || []);
    } catch (error) {
        chatError.textContent = error.message;
    }
}

async function refresh() {
    try {
        await loadMessages();
        await loadConversations();
    } catch (error) {
        contactError.textContent = error.message;
    }
}

document.getElementById("signupForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    authError.textContent = "";
    const form = new FormData(event.target);
    try {
        const data = await api("/api/signup", {
            method: "POST",
            body: JSON.stringify({
                username: form.get("username"),
                password: form.get("password")
            })
        });
        event.target.reset();
        showChat(data.user.username);
    } catch (error) {
        authError.textContent = error.message;
    }
});

document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    authError.textContent = "";
    const form = new FormData(event.target);
    try {
        const data = await api("/api/login", {
            method: "POST",
            body: JSON.stringify({
                username: form.get("username"),
                password: form.get("password")
            })
        });
        event.target.reset();
        showChat(data.user.username);
    } catch (error) {
        authError.textContent = error.message;
    }
});

const contactInput = document.getElementById("contactInput");
let contactChosen = false;
contactInput.addEventListener("pointerdown", () => {
    contactChosen = true;
    contactInput.tabIndex = 0;
});
contactInput.addEventListener("focus", () => {
    if (contactChosen) return;
    setTimeout(() => {
        if (!contactChosen && document.activeElement === contactInput) contactInput.blur();
    }, 0);
});

document.getElementById("addForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    contactError.textContent = "";
    const username = document.getElementById("contactInput").value;
    try {
        const data = await api("/api/conversations", {
            method: "POST",
            body: JSON.stringify({ username })
        });
        document.getElementById("contactInput").value = "";
        contactKey = "";
        await loadConversations();
        openConversation(data.conversation.id, data.conversation.username);
    } catch (error) {
        contactError.textContent = error.message;
    }
});

sendForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    chatError.textContent = "";
    const text = messageInput.value;
    const score = document.getElementById("scoreInput").value;
    const time = document.getElementById("timeInput").value;
    const unit = document.getElementById("timeUnit").value;
    try {
        await api("/api/messages", {
            method: "POST",
            body: JSON.stringify({ conversationId: selectedId, text, score, time, unit })
        });
        messageInput.value = "";
        document.getElementById("scoreInput").value = "";
        document.getElementById("timeInput").value = "";
        lastKey = "";
        contactKey = "";
        await loadMessages();
        await loadConversations();
    } catch (error) {
        chatError.textContent = error.message;
    }
});

function clearVisibleChats() {
    selectedId = "";
    selectedName = "";
    lastKey = null;
    contactKey = null;
    messagesEl.replaceChildren();
    contactsEl.replaceChildren();
    sendForm.hidden = true;
    if (chatPop.open) chatPop.close();
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No challenges yet.";
    contactsEl.appendChild(empty);
}

seeAllBtn.addEventListener("click", async () => {
    try {
        await api("/api/clear-chats", { method: "POST" });
        clearVisibleChats();
    } catch {
        // The screen stays as it is, with no message.
    }
});

logoutBtn.addEventListener("click", async () => {
    try {
        await api("/api/logout", { method: "POST" });
    } catch (error) {
        authError.textContent = error.message;
    }
    showAuth();
});

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
    return output;
}

function notificationKey(value) {
    const raw = String(value || "").trim();
    const choices = [raw, raw.replace(/=/g, "")];
    for (const choice of choices) {
        try {
            const bytes = urlBase64ToUint8Array(choice);
            if (bytes.length === 65 && bytes[0] === 4) return bytes;
        } catch {
            // Try the next spelling of the key.
        }
    }
    return null;
}

function onHomeScreen() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function markNotificationsOn() {
    notifyBtn.textContent = "Notifications on";
    notifyBtn.disabled = true;
}

async function saveSubscription(subscription) {
    const body = typeof subscription.toJSON === "function" ? subscription.toJSON() : subscription;
    await api("/api/push-subscribe", {
        method: "POST",
        body: JSON.stringify(body)
    });
}

async function prepareNotifications() {
    if (!("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) {
        notifyBtn.hidden = true;
        return;
    }
    const iphone = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (iphone && !onHomeScreen()) {
        notifyBtn.hidden = false;
        notifyBtn.disabled = true;
        notifyBtn.textContent = "Open the home screen icon";
        return;
    }
    notifyBtn.disabled = true;
    notifyBtn.textContent = "Notify me";
    try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const keyData = await api("/api/push-key");
        const key = notificationKey(keyData.publicKey);
        if (!key) {
            notifyBtn.textContent = "Notifications are not ready";
            return;
        }
        pushReady = { registration, key };
        if (Notification.permission === "granted") {
            const existing = await registration.pushManager.getSubscription();
            if (existing) {
                await saveSubscription(existing);
                markNotificationsOn();
                return;
            }
            notifyBtn.textContent = "Finish notifications";
        }
        notifyBtn.disabled = false;
    } catch {
        notifyBtn.disabled = false;
        notifyBtn.textContent = "Tap again";
    }
}

notifyBtn.addEventListener("click", () => {
    if (!pushReady) {
        prepareNotifications();
        return;
    }
    stayForNotifications = true;
    const granted = Notification.permission === "granted";
    const pending = granted
        ? pushReady.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: pushReady.key
        })
        : Notification.requestPermission();
    finishNotifications(pending, granted).finally(() => {
        stayForNotifications = false;
    });
});

async function finishNotifications(pending, granted) {
    try {
        if (!granted) {
            const permission = await pending;
            notifyBtn.disabled = false;
            notifyBtn.textContent = permission === "granted" ? "Finish notifications" : "Notify me";
            return;
        }
        await saveSubscription(await pending);
        markNotificationsOn();
    } catch (error) {
        notifyBtn.disabled = false;
        notifyBtn.textContent = error && error.name === "NotAllowedError" ? "Open the home screen icon" : "Tap again";
    }
}

async function openChatFromId(chatId) {
    if (!chatId) return;
    const conversations = await loadConversations();
    const found = conversations.find((conversation) => conversation.id === chatId);
    if (found) openConversation(found.id, found.username);
}

document.getElementById("closePop").addEventListener("click", () => {
    chatPop.close();
});

chatPop.addEventListener("click", (event) => {
    if (event.target === chatPop) chatPop.close();
});

chatPop.addEventListener("close", () => {
    selectedId = "";
    selectedName = "";
    lastKey = null;
    sendForm.hidden = true;
    messagesEl.replaceChildren();
    for (const button of contactsEl.querySelectorAll("button")) {
        button.classList.remove("active");
    }
});

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    navigator.serviceWorker.addEventListener("message", (event) => {
        const chatId = event.data && event.data.chat;
        if (chatId && me) openChatFromId(chatId).catch(() => {});
    });
}

api("/api/me").then((data) => {
    if (data.user) showChat(data.user.username);
}).catch(() => showAuth());
