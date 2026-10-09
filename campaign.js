const holds = [...document.querySelectorAll(".hold")];
const log = document.getElementById("log");
const clock = document.getElementById("clock");

let nextTurnAt = 0;
let paused = false;

function men(count, color) {
    const shown = Math.min(count, 16);
    return Array.from({ length: shown }, () => '<i style="background:' + color + '"></i>').join("");
}

function paint(data) {
    const villages = data.villages || [];
    villages.forEach((village, index) => {
        const hold = holds[index];
        hold.style.borderTop = "6px solid " + village.color;
        hold.classList.toggle("defending", Boolean(village.attacked));
        hold.classList.toggle("marching", Boolean(village.marching));
        hold.querySelector("[data-owner]").textContent = "Held by " + village.ownerName;
        hold.querySelector("[data-count]").textContent = String(village.alive);
        const fishers = village.fishers || 0;
        hold.querySelector("[data-fish]").textContent = fishers + (fishers === 1 ? " fisherman" : " fishermen");
        hold.querySelector("[data-food]").textContent = String(village.food || 0);
        const status = hold.querySelector("[data-status]");
        const jobs = village.training || [];
        const training = jobs.map((kind) => kind === "fisher" ? "Training a fisherman" : "Training a soldier").join(" · ");
        if (village.attacked) status.textContent = "Under attack";
        else if (village.marching) status.textContent = "Men marching out";
        else if (training) status.textContent = training;
        else if (village.fishing) status.textContent = "Fisherman working";
        else status.textContent = "";
        hold.querySelector("[data-men]").innerHTML = men(village.alive, village.color);
    });
    const lines = data.log || [];
    if (!lines.length) {
        log.innerHTML = "<li>The houses are choosing who to recruit.</li>";
    } else {
        log.innerHTML = lines.map((line) => "<li>" + line + "</li>").join("");
    }
}

function paintClock() {
    clock.textContent = paused ? "Paused" : "Recruiting takes two minutes";
}

async function refresh() {
    const data = await (await fetch("/api/campaign")).json();
    paused = Boolean(data.paused);
    nextTurnAt = data.nextTurnAt || 0;
    paintClock();
    paint(data);
}

document.getElementById("restart").addEventListener("click", async () => {
    if (!window.confirm("Start again? Every house goes back to no food and one fisherman.")) return;
    const data = await (await fetch("/api/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restart: true })
    })).json();
    paused = Boolean(data.paused);
    paintClock();
    paint(data);
});

refresh().catch(() => {
    clock.textContent = "The campaign is not reachable.";
});
setInterval(() => {
    paintClock();
    refresh().catch(() => {});
}, 1000);
