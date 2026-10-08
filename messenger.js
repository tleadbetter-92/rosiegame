const openedChat = new URLSearchParams(location.search).get("chat") || "";
history.replaceState(null, "", "messenger.html");

let leftPage = false;
let stayForNotifications = false;
let watchHome = false;
document.addEventListener("visibilitychange", () => {
    if (stayForNotifications || !watchHome) return;
    if (document.visibilityState === "hidden") leftPage = true;
    if (document.visibilityState === "visible" && leftPage) location.replace("index.html");
});
window.addEventListener("pageshow", (event) => {
    if (event.persisted && watchHome) location.replace("index.html");
});
setTimeout(() => {
    watchHome = true;
    leftPage = false;
}, 1500);

const auth = document.getElementById("auth");
const chat = document.getElementById("chat");
const logoutBtn = document.getElementById("logoutBtn");
const notesBtn = document.getElementById("notesBtn");
const notesAsk = document.getElementById("notesAsk");
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
let typingPoll = null;
let typingActive = false;
let typingSentAt = 0;
let typingQueue = Promise.resolve();

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
    if (notesAsk.open) notesAsk.close();
    if (notesPop.open) notesPop.close();
    if (document.getElementById("groupPop").open) document.getElementById("groupPop").close();
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

let conversationList = [];

function showGroup(conversation) {
    const members = document.getElementById("threadMembers");
    const tools = document.getElementById("groupTools");
    const leave = document.getElementById("leaveGroup");
    const isGroup = Boolean(conversation && conversation.group);
    tools.hidden = !conversation;
    leave.hidden = !isGroup;
    members.hidden = !isGroup;
    members.textContent = isGroup ? (conversation.members || []).join(", ") : "";
}

function typingLabel(names) {
    if (!names.length) return "";
    if (names.length === 1) return names[0] + " is typing…";
    if (names.length === 2) return names[0] + " and " + names[1] + " are typing…";
    return names[0] + " and " + (names.length - 1) + " others are typing…";
}

function showTyping(names) {
    const line = document.getElementById("typingLine");
    const text = typingLabel(names || []);
    line.hidden = !text;
    line.textContent = text;
}

function postTyping(id, active) {
    if (!id) return;
    typingQueue = typingQueue.then(() => api("/api/typing", {
        method: "POST",
        body: JSON.stringify({ conversationId: id, typing: active })
    })).catch(() => {});
}

function pulseTyping() {
    if (!selectedId) return;
    const active = messageInput.value.trim().length > 0;
    if (!active) {
        if (typingActive) {
            typingActive = false;
            typingSentAt = 0;
            postTyping(selectedId, false);
        }
        return;
    }
    const now = Date.now();
    if (typingActive && now - typingSentAt < 2000) return;
    typingActive = true;
    typingSentAt = now;
    postTyping(selectedId, true);
}

async function loadTyping() {
    const id = selectedId;
    if (!id) return;
    try {
        const data = await api("/api/typing?conversationId=" + encodeURIComponent(id));
        if (selectedId !== id) return;
        showTyping(data.typing || []);
    } catch {
        // Typing is a hint. A missed check should not show an error.
    }
}

function startTypingWatch() {
    if (typingPoll) return;
    typingPoll = setInterval(loadTyping, 1500);
    loadTyping();
}

function stopTypingWatch() {
    if (typingPoll) {
        clearInterval(typingPoll);
        typingPoll = null;
    }
    const id = selectedId;
    const wasTyping = typingActive;
    typingActive = false;
    typingSentAt = 0;
    showTyping([]);
    if (wasTyping && id) postTyping(id, false);
}

function openConversation(id, username, extra) {
    if (selectedId !== id) {
        stopTypingWatch();
        selectedId = id;
        selectedName = username;
        lastKey = null;
        messagesEl.replaceChildren();
    }
    threadTitle.textContent = username;
    showGroup(extra || conversationList.find((conversation) => conversation.id === id));
    sendForm.hidden = false;
    if (!chatPop.open) chatPop.showModal();
    startTypingWatch();
    for (const button of contactsEl.querySelectorAll("button")) {
        button.classList.toggle("active", button.dataset.id === selectedId);
    }
    loadMessages().then(() => {
        contactKey = "";
        return loadConversations();
    }).catch(() => {});
}

function renderContacts(conversations) {
    const key = conversations.map((conversation) => conversation.id + ":" + conversation.lastScore + ":" + conversation.lastTime + ":" + conversation.lastReply + ":" + conversation.lastUsername + ":" + conversation.readState + ":" + (conversation.group ? "1" : "0") + ":" + (conversation.members || []).join(",")).join("|");
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
            if (conversation.group) {
                const sub = document.createElement("span");
                sub.className = "sub";
                sub.textContent = (conversation.members || []).filter((name) => name !== me).join(", ");
                button.append(sub);
            }
            if (conversation.readState === "unread") button.classList.add("has-unread");
            button.addEventListener("click", () => openConversation(conversation.id, conversation.username, conversation));
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
    const key = messages.map((message) => message.id + ":" + message.reply + ":" + (message.imageId || "") + ":" + (message.seen ? "1" : "0")).join(",");
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
        if (message.imageId) {
            const photo = document.createElement("img");
            photo.className = "chat-photo";
            photo.alt = "Photo";
            photo.src = "/api/image?id=" + encodeURIComponent(message.imageId);
            bubble.append(photo);
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
        if (mine) {
            const mark = document.createElement("p");
            mark.className = "receipt";
            mark.textContent = message.seen ? "Seen" : "Unread";
            item.append(mark);
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
    conversationList = conversations;
    renderContacts(conversations);
    const selected = conversations.find((conversation) => conversation.id === selectedId);
    if (selected) showGroup(selected);
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
        openConversation(data.conversation.id, data.conversation.username, data.conversation);
    } catch (error) {
        contactError.textContent = error.message;
    }
});

let groupPeople = [];

function renderGroupPeople() {
    const box = document.getElementById("groupMembers");
    box.replaceChildren();
    groupPeople.forEach((name, index) => {
        const chip = document.createElement("span");
        chip.className = "member-chip";
        chip.append(document.createTextNode(name));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "×";
        remove.setAttribute("aria-label", "Remove " + name);
        remove.addEventListener("click", () => {
            groupPeople.splice(index, 1);
            renderGroupPeople();
        });
        chip.append(remove);
        box.append(chip);
    });
}

document.getElementById("newGroup").addEventListener("click", () => {
    groupPeople = [];
    renderGroupPeople();
    document.getElementById("groupName").value = "";
    document.getElementById("groupUser").value = "";
    document.getElementById("groupError").textContent = "";
    document.getElementById("groupPop").showModal();
});

document.getElementById("closeGroup").addEventListener("click", () => {
    document.getElementById("groupPop").close();
});

document.getElementById("groupPop").addEventListener("click", (event) => {
    if (event.target.id === "groupPop") document.getElementById("groupPop").close();
});

document.getElementById("groupUser").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    document.getElementById("groupAdd").click();
});

document.getElementById("groupAdd").addEventListener("click", () => {
    const input = document.getElementById("groupUser");
    const name = input.value.trim();
    document.getElementById("groupError").textContent = "";
    if (!name) return;
    if (groupPeople.some((item) => item.toLowerCase() === name.toLowerCase())) {
        input.value = "";
        return;
    }
    groupPeople.push(name);
    input.value = "";
    renderGroupPeople();
});

document.getElementById("groupForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = document.getElementById("groupError");
    error.textContent = "";
    try {
        const data = await api("/api/conversations", {
            method: "POST",
            body: JSON.stringify({
                name: document.getElementById("groupName").value,
                members: groupPeople
            })
        });
        document.getElementById("groupPop").close();
        contactKey = "";
        await loadConversations();
        openConversation(data.conversation.id, data.conversation.username, data.conversation);
    } catch (err) {
        error.textContent = err.message;
    }
});

document.getElementById("groupInvite").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.getElementById("inviteUser");
    chatError.textContent = "";
    try {
        const data = await api("/api/conversations", {
            method: "POST",
            body: JSON.stringify({ conversationId: selectedId, username: input.value })
        });
        input.value = "";
        contactKey = "";
        showGroup(data.conversation);
        threadTitle.textContent = data.conversation.username;
        await loadConversations();
    } catch (err) {
        chatError.textContent = err.message;
    }
});

document.getElementById("leaveGroup").addEventListener("click", async () => {
    if (!selectedId) return;
    chatError.textContent = "";
    try {
        await api("/api/conversations", {
            method: "DELETE",
            body: JSON.stringify({ conversationId: selectedId })
        });
        contactKey = "";
        chatPop.close();
        await loadConversations();
    } catch (err) {
        chatError.textContent = err.message;
    }
});

let pendingPhoto = "";

function clearPhoto() {
    pendingPhoto = "";
    const input = document.getElementById("photoInput");
    const preview = document.getElementById("photoPreview");
    input.value = "";
    preview.removeAttribute("src");
    preview.hidden = true;
    document.getElementById("photoClear").hidden = true;
}

function fitPhoto(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const max = 1200;
            const scale = Math.min(1, max / Math.max(img.width, img.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            canvas.toBlob((blob) => {
                if (!blob) reject(new Error("That photo could not be added."));
                else resolve(blob);
            }, "image/jpeg", 0.72);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("That photo could not be added."));
        };
        img.src = url;
    });
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("That photo could not be added."));
        reader.readAsDataURL(blob);
    });
}

document.getElementById("photoBtn").addEventListener("click", () => {
    document.getElementById("photoInput").click();
});

document.getElementById("photoClear").addEventListener("click", clearPhoto);

document.getElementById("photoInput").addEventListener("change", async () => {
    const file = document.getElementById("photoInput").files[0];
    if (!file) return;
    chatError.textContent = "";
    try {
        const blob = await fitPhoto(file);
        pendingPhoto = await blobToBase64(blob);
        const preview = document.getElementById("photoPreview");
        preview.src = "data:image/jpeg;base64," + pendingPhoto;
        preview.hidden = false;
        document.getElementById("photoClear").hidden = false;
    } catch (error) {
        clearPhoto();
        chatError.textContent = error.message;
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
            body: JSON.stringify({
                conversationId: selectedId,
                text,
                score,
                time,
                unit,
                image: pendingPhoto
            })
        });
        messageInput.value = "";
        pulseTyping();
        document.getElementById("scoreInput").value = "";
        document.getElementById("timeInput").value = "";
        clearPhoto();
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
    if (found) openConversation(found.id, found.username, found);
}

document.getElementById("closePop").addEventListener("click", () => {
    chatPop.close();
});

let noteRows = [];
let noteStart = "";
let noteTaken = [];
let noteTimer = null;
let noteSaveId = 0;
let noteWrite = Promise.resolve();

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

function amountValue(value) {
    const number = Number(String(value).replace(/,/g, ""));
    return Number.isFinite(number) ? number : 0;
}

function noteLeft() {
    const left = noteTaken.reduce((sum, amount) => sum - amountValue(amount), amountValue(noteStart));
    document.getElementById("noteLeft").textContent = String(Math.round(left * 100) / 100);
}

function showTakeTable(show) {
    document.getElementById("takeTable").hidden = !show;
    document.getElementById("toggleTake").textContent = show ? "Remove take away" : "Take away from a number";
}

function renderTakeRows(focusIndex) {
    const box = document.getElementById("takeRows");
    box.replaceChildren();
    noteTaken.forEach((amount, index) => {
        const line = document.createElement("div");
        line.className = "take-row";
        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "decimal";
        input.maxLength = 20;
        input.placeholder = "0";
        input.setAttribute("aria-label", "Amount to take away");
        input.value = amount;
        input.addEventListener("input", () => {
            noteTaken[index] = input.value;
            noteLeft();
            saveNotes();
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "×";
        remove.setAttribute("aria-label", "Remove number");
        remove.addEventListener("click", () => {
            noteTaken.splice(index, 1);
            renderTakeRows();
            noteLeft();
            saveNotes();
        });
        line.append(input, remove);
        box.append(line);
        if (focusIndex === index) input.focus();
    });
}

function clearNoteForm() {
    noteRows = [];
    noteStart = "";
    noteTaken = [];
    document.getElementById("noteText").value = "";
    document.getElementById("noteStart").value = "";
    document.getElementById("noteRows").replaceChildren();
    document.getElementById("takeRows").replaceChildren();
    showNoteTable(false);
    showTakeTable(false);
    noteTotal();
    noteLeft();
}

function saveNotes() {
    clearTimeout(noteTimer);
    const saveId = ++noteSaveId;
    noteTimer = setTimeout(() => {
        if (saveId !== noteSaveId) return;
        const tableHidden = document.getElementById("noteTable").hidden;
        const takeHidden = document.getElementById("takeTable").hidden;
        noteWrite = noteWrite.catch(() => {}).then(() => api("/api/notes", {
            method: "PUT",
            body: JSON.stringify({
                text: document.getElementById("noteText").value,
                rows: tableHidden ? [] : noteRows,
                start: takeHidden ? "" : noteStart,
                taken: takeHidden ? [] : noteTaken
            })
        })).catch(() => {});
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
    noteStart = data.start || "";
    noteTaken = (data.taken || []).map((amount) => amount || "");
    document.getElementById("noteStart").value = noteStart;
    if (noteStart || noteTaken.length) {
        showTakeTable(true);
        renderTakeRows();
    } else {
        showTakeTable(false);
    }
    noteTotal();
    noteLeft();
}

notesBtn.addEventListener("click", () => {
    if (!notesAsk.open) notesAsk.showModal();
});

document.getElementById("seeNotes").addEventListener("click", async () => {
    notesAsk.close();
    noteSaveId += 1;
    clearTimeout(noteTimer);
    try {
        await noteWrite.catch(() => {});
        await api("/api/notes", { method: "DELETE" });
        clearNoteForm();
        if (notesPop.open) notesPop.close();
    } catch (error) {}
});

document.getElementById("cancelNotes").addEventListener("click", () => {
    notesAsk.close();
    if (!notesPop.open) notesPop.showModal();
});

notesAsk.addEventListener("click", (event) => {
    if (event.target === notesAsk) notesAsk.close();
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

document.getElementById("noteStart").addEventListener("input", () => {
    noteStart = document.getElementById("noteStart").value;
    noteLeft();
    saveNotes();
});

document.getElementById("toggleTake").addEventListener("click", () => {
    const hidden = document.getElementById("takeTable").hidden;
    if (hidden) {
        if (!noteTaken.length) noteTaken.push("");
        showTakeTable(true);
        renderTakeRows();
        document.getElementById("noteStart").focus();
    } else {
        noteStart = "";
        noteTaken = [];
        document.getElementById("noteStart").value = "";
        showTakeTable(false);
    }
    noteLeft();
    saveNotes();
});

document.getElementById("addTakeRow").addEventListener("click", () => {
    noteTaken.push("");
    renderTakeRows(noteTaken.length - 1);
    saveNotes();
});

chatPop.addEventListener("click", (event) => {
    if (event.target === chatPop) chatPop.close();
});

messageInput.addEventListener("input", pulseTyping);

chatPop.addEventListener("close", () => {
    stopTypingWatch();
    selectedId = "";
    selectedName = "";
    lastKey = null;
    showGroup(null);
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
