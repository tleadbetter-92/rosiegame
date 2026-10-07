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

const sequence = ["castle", "river", "bubble"];
let step = 0;
let sequenceTimer = null;

function resetSequence() {
    step = 0;
    clearTimeout(sequenceTimer);
    sequenceTimer = null;
}

document.querySelectorAll(".tile").forEach((tile) => {
    tile.addEventListener("click", () => {
        const code = tile.dataset.code || "";
        if (code !== sequence[step]) {
            resetSequence();
            if (code === sequence[0]) {
                step = 1;
                sequenceTimer = setTimeout(resetSequence, 4000);
            }
            return;
        }
        step += 1;
        if (step === 1) sequenceTimer = setTimeout(resetSequence, 4000);
        if (step === sequence.length) window.location.href = "messenger.html";
    });
});
