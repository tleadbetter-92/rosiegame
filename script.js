const court = document.getElementById("court");
const ball = document.getElementById("ball");
let x = 0;
let y = 0;
let vx = 0;
let vy = 0;
let started = false;

function placeCenter() {
    const size = ball.offsetWidth;
    x = (court.clientWidth - size) / 2;
    y = (court.clientHeight - size) / 2;
    ball.style.transform = "translate(" + x + "px, " + y + "px)";
}

function tick() {
    const size = ball.offsetWidth;
    const maxX = court.clientWidth - size;
    const maxY = court.clientHeight - size;
    x += vx;
    y += vy;
    if (x <= 0) {
        x = 0;
        vx = Math.abs(vx);
    } else if (x >= maxX) {
        x = maxX;
        vx = -Math.abs(vx);
    }
    if (y <= 0) {
        y = 0;
        vy = Math.abs(vy);
    } else if (y >= maxY) {
        y = maxY;
        vy = -Math.abs(vy);
    }
    ball.style.transform = "translate(" + x + "px, " + y + "px)";
    requestAnimationFrame(tick);
}

ball.addEventListener("click", () => {
    if (started) return;
    fetch("/api/clear-chats", { method: "POST", credentials: "same-origin" }).catch(() => {});
    started = true;
    court.classList.add("live");
    vx = 4.4;
    vy = 3.2;
    requestAnimationFrame(tick);
});

window.addEventListener("resize", () => {
    const size = ball.offsetWidth;
    const maxX = Math.max(0, court.clientWidth - size);
    const maxY = Math.max(0, court.clientHeight - size);
    if (!started) {
        placeCenter();
        return;
    }
    x = Math.min(Math.max(0, x), maxX);
    y = Math.min(Math.max(0, y), maxY);
});

placeCenter();

document.getElementById("stopBtn").addEventListener("click", () => {
    fetch("/api/clear-chats", { method: "POST", credentials: "same-origin" }).catch(() => {});
});

const sequences = [
    ["castle", "river", "bubble"],
    ["moon", "castle", "castle", "moon"]
];
let progress = sequences.map(() => 0);
let sequenceTimer = null;

function resetSequence() {
    progress = sequences.map(() => 0);
    clearTimeout(sequenceTimer);
    sequenceTimer = null;
}

function armSequence() {
    clearTimeout(sequenceTimer);
    sequenceTimer = setTimeout(resetSequence, 4000);
}

document.querySelectorAll(".tile").forEach((tile) => {
    tile.addEventListener("click", () => {
        const code = tile.dataset.code || "";
        let opened = false;
        progress = progress.map((step, index) => {
            const sequence = sequences[index];
            const next = code === sequence[step] ? step + 1 : (code === sequence[0] ? 1 : 0);
            if (next === sequence.length) opened = true;
            return next === sequence.length ? 0 : next;
        });
        if (opened) {
            window.location.href = "messenger.html?enter=1";
            return;
        }
        if (progress.some((step) => step > 0)) armSequence();
        else resetSequence();
    });
});

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
}
