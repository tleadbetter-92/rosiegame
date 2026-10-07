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

const stroke = document.getElementById("secretStroke");
let startX = 0;
let startY = 0;
let active = false;

stroke.addEventListener("pointerdown", (event) => {
    active = true;
    startX = event.clientX;
    startY = event.clientY;
    try {
        stroke.setPointerCapture(event.pointerId);
    } catch {
        // A finger stroke still works if capture is unavailable.
    }
});

stroke.addEventListener("pointermove", (event) => {
    if (!active) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    stroke.classList.toggle("armed", Math.abs(dx) > 40 && Math.abs(dy) < 60);
});

stroke.addEventListener("pointerup", (event) => {
    if (!active) return;
    active = false;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    stroke.classList.remove("armed");
    if (Math.abs(dx) > 80 && Math.abs(dy) < 70) {
        window.location.href = "messenger.html";
    }
});

stroke.addEventListener("pointercancel", () => {
    active = false;
    stroke.classList.remove("armed");
});
