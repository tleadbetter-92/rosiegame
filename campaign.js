const holds = [...document.querySelectorAll(".hold")];
const log = document.getElementById("log");
const clock = document.getElementById("clock");

let nextTurnAt = 0;
let paused = false;
let seenTurn = null;
let playing = false;

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function men(count, color) {
    const shown = Math.min(count, 16);
    return Array.from({ length: shown }, () => '<i style="background:' + color + '"></i>').join("");
}

function paint(data, acting) {
    data.factions.forEach((faction, index) => {
        const hold = holds[index];
        const standing = faction.alive == null ? faction.soldiers : faction.alive;
        hold.classList.toggle("acting", acting === index);
        hold.style.borderTop = "6px solid " + faction.color;
        hold.querySelector("[data-count]").textContent = String(standing);
        hold.querySelector("[data-men]").innerHTML = men(standing, faction.color);
    });
    if (acting === undefined) {
        if (!data.turn) {
            log.innerHTML = "<li>No turn has finished yet.</li>";
        } else {
            log.innerHTML = data.factions.map((faction) => (
                "<li>" + faction.name + " recruits one soldier.</li>"
            )).join("");
        }
    }
}

function paintClock() {
    if (paused) {
        clock.textContent = "Paused";
        return;
    }
    const left = Math.max(0, nextTurnAt - Date.now());
    const total = Math.ceil(left / 1000);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    clock.textContent = "Next turn in " + minutes + ":" + String(seconds).padStart(2, "0");
}

async function playTurn(data) {
    playing = true;
    const shown = data.factions.map((faction) => {
        const standing = faction.alive == null ? faction.soldiers : faction.alive;
        return { ...faction, alive: Math.max(0, standing - 1) };
    });
    log.innerHTML = "";
    for (let index = 0; index < shown.length; index++) {
        shown[index].alive += 1;
        paint({ factions: shown, turn: data.turn }, index);
        const item = document.createElement("li");
        item.textContent = shown[index].name + " recruits one soldier.";
        log.appendChild(item);
        await wait(800);
    }
    playing = false;
    paint(data);
}

async function refresh() {
    const data = await (await fetch("/api/campaign")).json();
    paused = Boolean(data.paused);
    nextTurnAt = data.nextTurnAt || 0;
    paintClock();
    if (playing) return;
    if (seenTurn === null || data.turn !== seenTurn + 1) {
        seenTurn = data.turn;
        paint(data);
        return;
    }
    seenTurn = data.turn;
    await playTurn(data);
}

refresh().catch(() => {
    clock.textContent = "The campaign is not reachable.";
});
setInterval(() => {
    paintClock();
    refresh().catch(() => {});
}, 1000);
