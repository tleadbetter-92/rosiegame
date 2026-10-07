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

function showChat(username) {
    auth.hidden = true;
    chat.hidden = false;
    me = username;
    logoutBtn.hidden = false;
    notifyBtn.hidden = false;
    authError.textContent = "";
    prepareNotifications();
    loadConversations().then(() => openChatFromId(new URLSearchParams(location.search).get("chat"))).catch(() => {});
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
    loadMessages();
}

function renderContacts(conversations) {
    const key = conversations.map((conversation) => conversation.id + ":" + conversation.lastScore + ":" + conversation.lastTime + ":" + conversation.lastReply + ":" + conversation.lastUsername).join("|");
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
            const name = document.createElement("strong");
            name.textContent = conversation.username;
            button.appendChild(name);
            if (conversation.lastUsername === me) {
                const preview = document.createElement("span");
                preview.className = "preview";
                preview.textContent = conversation.lastReply || ".......";
                button.appendChild(preview);
            } else if (conversation.lastScore || conversation.lastTime) {
                const metrics = document.createElement("span");
                metrics.className = "metrics";
                metrics.append(metric("Score", conversation.lastScore), metric("Time", conversation.lastTime));
                button.appendChild(metrics);
            }
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
        if (!mine) {
            const name = document.createElement("span");
            name.className = "name";
            name.textContent = message.username;
            bubble.append(name);
        }
        if (message.text) {
            const text = document.createElement("p");
            text.textContent = message.text;
            bubble.append(text);
        }
        const stats = document.createElement("div");
        stats.className = "stats";
        stats.append(metric("Score", message.score), metric("Time", message.time));
        bubble.append(stats);
        item.append(bubble);
        if (mine) {
            const answer = document.createElement("p");
            answer.className = "answer " + (message.reply || "waiting");
            answer.textContent = message.reply || ".......";
            item.append(answer);
        } else if (message.reply === "accepted" || message.reply === "rejected") {
            const answer = document.createElement("p");
            answer.className = "answer " + message.reply;
            answer.textContent = message.reply;
            item.append(answer);
        } else {
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
            item.append(choices);
        }
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
        await loadConversations();
        await loadMessages();
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

async function enableNotifications() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    const registration = await navigator.serviceWorker.register("/sw.js");
    const keyData = await api("/api/push-key");
    if (!keyData.publicKey) return;
    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
    });
    await api("/api/push-subscribe", {
        method: "POST",
        body: JSON.stringify(subscription)
    });
    notifyBtn.textContent = "Notifications on";
    notifyBtn.disabled = true;
}

function prepareNotifications() {
    if (!("Notification" in window)) {
        notifyBtn.hidden = true;
        return;
    }
    if (Notification.permission === "granted") {
        enableNotifications().catch(() => {});
    }
}

notifyBtn.addEventListener("click", () => {
    enableNotifications().catch(() => {});
});

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
    navigator.serviceWorker.addEventListener("message", (event) => {
        const chatId = event.data && event.data.chat;
        if (chatId && me) openChatFromId(chatId).catch(() => {});
    });
}

api("/api/me").then((data) => {
    if (data.user) showChat(data.user.username);
}).catch(() => showAuth());
