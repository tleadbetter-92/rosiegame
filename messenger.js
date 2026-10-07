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
const notesBtn = document.getElementById("notesBtn");
const notesPop = document.getElementById("notesPop");
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
let pendingSubscription = null;
let pushStarting = null;
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
        const error = new Error(data.error || "Something went wrong.");
        error.status = response.status;
        throw error;
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
    notesBtn.hidden = false;
    notifyBtn.hidden = false;
    authError.textContent = "";
    leaveContactBox();
    setTimeout(leaveContactBox, 0);
    setTimeout(leaveContactBox, 250);
    prepareNotifications();
    loadNotes().catch(() => {});
    loadConversations().then(() => openChatFromId(openedChat)).catch(() => {});
    if (!timer) timer = setInterval(refresh, 3000);
}

function showAuth() {
    auth.hidden = false;
    chat.hidden = true;
    me = "";
    logoutBtn.hidden = true;
    notesBtn.hidden = true;
    notifyBtn.hidden = true;
    selectedId = "";
    selectedName = "";
    lastKey = null;
    contactKey = null;
    messagesEl.replaceChildren();
    contactsEl.replaceChildren();
    sendForm.hidden = true;
    if (chatPop.open) chatPop.close();
    if (notesPop.open) notesPop.close();
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
            const readLabel = { unread: "Unread", read: "Read", notread: "Not read" }[conversation.readState];
            if (readLabel) {
                const state = document.createElement("span");
                state.className = "read-state " + conversation.readState;
                state.setAttribute("aria-label", readLabel);
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
    armNotifications();
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
    armNotifications();
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

function armNotifications() {
    if (!pushReady || !("Notification" in window) || Notification.permission !== "granted") return;
    pendingSubscription = pushReady.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: pushReady.key
    });
}

function startPush() {
    if (pushStarting) return pushStarting;
    pushStarting = (async () => {
        if (!("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) return null;
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const keyData = await api("/api/push-key");
        const key = notificationKey(keyData.publicKey);
        if (!key) return null;
        pushReady = { registration, key };
        return pushReady;
    })().catch(() => null);
    return pushStarting;
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
        const ready = await startPush();
        if (!ready) {
            notifyBtn.textContent = "Notifications are not ready";
            return;
        }
        if (Notification.permission === "granted") {
            let subscription = await ready.registration.pushManager.getSubscription();
            if (!subscription && pendingSubscription) subscription = await pendingSubscription.catch(() => null);
            if (!subscription) {
                subscription = await ready.registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: ready.key
                });
            }
            await saveSubscription(subscription);
            markNotificationsOn();
            return;
        }
        notifyBtn.disabled = false;
    } catch {
        notifyBtn.disabled = false;
        notifyBtn.textContent = Notification.permission === "granted" ? "Finish notifications" : "Notify me";
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

let noteRows = [];
let noteTimer = null;

function noteTotal() {
    const total = noteRows.reduce((sum, row) => {
        const value = Number(String(row.amount).replace(/,/g, ""));
        return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    const rounded = Math.round(total * 100) / 100;
    document.getElementById("noteTotal").textContent = String(rounded);
}

function showNoteTable(show) {
    document.getElementById("noteTable").hidden = !show;
    document.getElementById("toggleTable").textContent = show ? "Remove table" : "Add a table";
}

function renderNoteRows() {
    const box = document.getElementById("noteRows");
    box.replaceChildren();
    noteRows.forEach((row, index) => {
        const line = document.createElement("div");
        line.className = "note-row";
        const text = document.createElement("input");
        text.type = "text";
        text.maxLength = 200;
        text.placeholder = "Text";
        text.value = row.text;
        text.addEventListener("input", () => {
            noteRows[index].text = text.value;
            saveNotes();
        });
        const amount = document.createElement("input");
        amount.type = "text";
        amount.inputMode = "decimal";
        amount.maxLength = 20;
        amount.placeholder = "0";
        amount.setAttribute("aria-label", "Number");
        amount.value = row.amount;
        amount.addEventListener("input", () => {
            noteRows[index].amount = amount.value;
            noteTotal();
            saveNotes();
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "×";
        remove.setAttribute("aria-label", "Remove row");
        remove.addEventListener("click", () => {
            noteRows.splice(index, 1);
            if (!noteRows.length) showNoteTable(false);
            else renderNoteRows();
            noteTotal();
            saveNotes();
        });
        line.append(text, amount, remove);
        box.append(line);
    });
}

function saveNotes() {
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
        const tableHidden = document.getElementById("noteTable").hidden;
        api("/api/notes", {
            method: "PUT",
            body: JSON.stringify({
                text: document.getElementById("noteText").value,
                rows: tableHidden ? [] : noteRows
            })
        }).catch(() => {});
    }, 400);
}

async function loadNotes() {
    const data = await api("/api/notes");
    document.getElementById("noteText").value = data.text || "";
    noteRows = (data.rows || []).map((row) => ({
        text: row.text || "",
        amount: row.amount || ""
    }));
    if (noteRows.length) {
        showNoteTable(true);
        renderNoteRows();
    } else {
        showNoteTable(false);
    }
    noteTotal();
}

notesBtn.addEventListener("click", () => {
    if (!notesPop.open) notesPop.showModal();
});

document.getElementById("closeNotes").addEventListener("click", () => {
    notesPop.close();
});

notesPop.addEventListener("click", (event) => {
    if (event.target === notesPop) notesPop.close();
});

document.getElementById("noteText").addEventListener("input", saveNotes);

document.getElementById("toggleTable").addEventListener("click", () => {
    const hidden = document.getElementById("noteTable").hidden;
    if (hidden) {
        if (!noteRows.length) noteRows.push({ text: "", amount: "" });
        showNoteTable(true);
        renderNoteRows();
    } else {
        noteRows = [];
        showNoteTable(false);
    }
    noteTotal();
    saveNotes();
});

document.getElementById("addNoteRow").addEventListener("click", () => {
    noteRows.push({ text: "", amount: "" });
    renderNoteRows();
    saveNotes();
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
    else showAuth();
}).catch((error) => {
    if (!error.status || error.status === 401) showAuth();
});

startPush();
