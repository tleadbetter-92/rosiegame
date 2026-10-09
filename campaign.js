const holds = [...document.querySelectorAll(".hold")];
const log = document.getElementById("log");
const clock = document.getElementById("clock");
const land = document.getElementById("land");
const homeColors = ["#c45c3a", "#3d6b8a", "#6a7a3a", "#8a5a7a"];
const placeNames = ["Northwest", "Northeast", "Southwest", "Southeast"];
const mapX0 = -3800;
const mapX1 = 3700;
const mapZ0 = -3400;
const mapZ1 = 3600;

function mapPoint(x, z) {
    return {
        x: (x - mapX0) / (mapX1 - mapX0) * land.width,
        y: (z - mapZ0) / (mapZ1 - mapZ0) * land.height
    };
}

function terrainColor(h, wet) {
    if (wet || h < 0.12) return h < -2.2 ? [20, 78, 122] : [58, 140, 186];
    if (h < 1.2) return [214, 196, 138];
    if (h > 40) return [186, 182, 174];
    if (h > 22) return [132, 126, 116];
    if (h > 10) return [118, 138, 86];
    if (h > 5) return [86, 138, 68];
    return [70, 124, 58];
}

let islandBase = null;

function bakeIsland() {
    if (!land || !window.World || islandBase) return;
    const cols = 340;
    const rows = 320;
    const scratch = document.createElement("canvas");
    scratch.width = cols;
    scratch.height = rows;
    const image = scratch.getContext("2d").createImageData(cols, rows);
    const data = image.data;
    for (let row = 0; row < rows; row++) {
        const z = mapZ0 + (row + 0.5) / rows * (mapZ1 - mapZ0);
        for (let col = 0; col < cols; col++) {
            const x = mapX0 + (col + 0.5) / cols * (mapX1 - mapX0);
            const h = World.heightAt(x, z);
            const rgb = terrainColor(h, World.wet(x, z));
            const i = (row * cols + col) * 4;
            data[i] = rgb[0];
            data[i + 1] = rgb[1];
            data[i + 2] = rgb[2];
            data[i + 3] = 255;
        }
    }
    scratch.getContext("2d").putImageData(image, 0, 0);
    islandBase = document.createElement("canvas");
    islandBase.width = land.width;
    islandBase.height = land.height;
    const ctx = islandBase.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(scratch, 0, 0, land.width, land.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#3a8ec0";
    ctx.lineWidth = 3.5;
    for (const chain of World.waterways) {
        ctx.beginPath();
        chain.forEach((spot, index) => {
            const p = mapPoint(spot[0], spot[1]);
            if (index === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
    }
    for (const tree of World.trees) {
        if (tree.kind !== "pine" && tree.kind !== "oak") continue;
        const p = mapPoint(tree.x, tree.z);
        ctx.fillStyle = tree.kind === "pine" ? "rgba(28, 72, 40, 0.85)" : "rgba(36, 92, 38, 0.8)";
        ctx.fillRect(p.x - 1.2, p.y - 1.2, 2.4, 2.4);
    }
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(150, 108, 62, 0.9)";
    for (const link of [[0, 1], [0, 2], [2, 3], [1, 3]]) {
        const spots = [World.places[link[0]]]
            .concat(World.trackOf(link[0], link[1]).map((spot) => ({ x: spot[0], z: spot[1] })))
            .concat([World.places[link[1]]]);
        ctx.beginPath();
        spots.forEach((spot, index) => {
            const p = mapPoint(spot.x, spot.z);
            if (index === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "700 15px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("N", land.width / 2, 22);
}

function showVillages(villages) {
    if (!land || !islandBase) return;
    const ctx = land.getContext("2d");
    ctx.drawImage(islandBase, 0, 0);
    ctx.textAlign = "center";
    (villages || []).forEach((village, index) => {
        const place = World.places[index];
        if (!place) return;
        const p = mapPoint(place.x, place.z);
        ctx.beginPath();
        ctx.fillStyle = "#f4efe4";
        ctx.strokeStyle = village.color || homeColors[index];
        ctx.lineWidth = 3;
        ctx.rect(p.x - 7, p.y - 7, 14, 14);
        ctx.fill();
        ctx.stroke();
        ctx.font = "700 14px Segoe UI, system-ui, sans-serif";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(20, 24, 18, 0.75)";
        ctx.fillStyle = "#f7f4ea";
        const below = index === 1 || index === 3;
        const ly = below ? p.y + 24 : p.y - 14;
        ctx.strokeText(placeNames[index], p.x, ly);
        ctx.fillText(placeNames[index], p.x, ly);
    });
}

bakeIsland();
showVillages(homeColors.map((color) => ({ color })));

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
        const cutters = village.woodcutters || 0;
        hold.querySelector("[data-woodcut]").textContent = cutters + (cutters === 1 ? " woodcutter" : " woodcutters");
        const food = hold.querySelector("[data-food]");
        if (document.activeElement !== food) food.value = String(village.food || 0);
        hold.querySelector("[data-wood]").textContent = String(village.wood || 0);
        const status = hold.querySelector("[data-status]");
        const jobs = village.training || [];
        const training = jobs.map((kind) => {
            if (kind === "fisher") return "Training a fisherman";
            if (kind === "wood") return "Training a woodcutter";
            return "Training a soldier";
        }).join(" · ");
        if (village.attacked) status.textContent = village.repairing ? "Under attack · Repairing a gate" : "Under attack";
        else if (village.marching) status.textContent = "Men marching out";
        else if (training) status.textContent = training;
        else if (village.repairing) status.textContent = "Repairing a gate";
        else if (village.fishing && village.chopping) status.textContent = "Fishing and cutting wood";
        else if (village.chopping) status.textContent = "Cutting wood";
        else if (village.fishing) status.textContent = "Fisherman working";
        else status.textContent = "";
        hold.querySelector("[data-men]").innerHTML = men(village.alive, village.color);
    });
    showVillages(villages);
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
