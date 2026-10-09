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
        const food = hold.querySelector("[data-food]");
        if (document.activeElement !== food) food.value = String(village.food || 0);
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

let seenRestart = 0;

function take(data) {
    const stamp = Number(data && data.restartedAt) || 0;
    if (stamp < seenRestart) return;
    seenRestart = Math.max(seenRestart, stamp);
    paused = Boolean(data.paused);
    nextTurnAt = data.nextTurnAt || 0;
    paintClock();
    paint(data);
}

async function refresh() {
    const res = await fetch("/api/campaign", { cache: "no-store" });
    if (!res.ok) throw new Error("unreachable");
    take(await res.json());
}

holds.forEach((hold) => {
    const input = hold.querySelector("[data-food]");
    input.addEventListener("change", async () => {
        const amount = Math.max(0, Math.min(99999, Math.floor(Number(input.value) || 0)));
        input.value = String(amount);
        const res = await fetch("/api/campaign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ setFood: Number(hold.dataset.i), amount })
        });
        if (!res.ok) return;
        take(await res.json());
    });
});

document.getElementById("restart").addEventListener("click", async () => {
    if (!window.confirm("Start again? Every house goes back to one fisherman and 100 food.")) return;
    const data = await (await fetch("/api/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ restart: true })
    })).json();
    take(data);
});

refresh().catch(() => {
    clock.textContent = "The campaign is not reachable.";
});
setInterval(() => {
    refresh().then(() => paintClock()).catch(() => {
        clock.textContent = "The campaign is not reachable.";
    });
}, 1000);
