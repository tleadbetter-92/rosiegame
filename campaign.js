const holds = [...document.querySelectorAll(".hold")];
const mapBox = document.querySelector(".map");
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
let shownVillages = null;
let shownMinors = [];
const minorSpots = window.World ? World.hamlets : [];

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
    if (villages) shownVillages = villages;
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
    shownMinors.forEach((minor, index) => {
        const spot = minorSpots[index];
        if (!spot) return;
        const p = mapPoint(spot.x, spot.z);
        ctx.beginPath();
        ctx.fillStyle = "#f4efe4";
        ctx.strokeStyle = minor.ownerColor || minor.color;
        ctx.lineWidth = 3;
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.font = "700 12px Segoe UI, system-ui, sans-serif";
        ctx.strokeStyle = "rgba(20, 24, 18, 0.75)";
        ctx.fillStyle = "#f7f4ea";
        ctx.strokeText(minor.name, p.x, p.y + 20);
        ctx.fillText(minor.name, p.x, p.y + 20);
    });
    let spot = null;
    try { spot = JSON.parse(localStorage.getItem("village-spot") || "null"); } catch (err) { spot = null; }
    if (!spot || !Number.isFinite(spot.x) || !Number.isFinite(spot.z)) {
        const home = World.places[2];
        spot = { x: home.x, z: home.z + 20 };
    }
    const you = mapPoint(spot.x, spot.z);
    ctx.beginPath();
    ctx.fillStyle = "#f2d15a";
    ctx.strokeStyle = "#1c1408";
    ctx.lineWidth = 2;
    ctx.arc(you.x, you.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    let labelX = you.x;
    let labelY = you.y - 12;
    ctx.textAlign = "center";
    for (const place of World.places) {
        const town = mapPoint(place.x, place.z);
        if (Math.hypot(town.x - you.x, town.y - you.y) < 40) {
            labelX = you.x + 12;
            labelY = you.y + 4;
            ctx.textAlign = "left";
        }
    }
    ctx.font = "700 13px Segoe UI, system-ui, sans-serif";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(20, 24, 18, 0.8)";
    ctx.fillStyle = "#f2d15a";
    ctx.strokeText("You", labelX, labelY);
    ctx.fillText("You", labelX, labelY);
}

function rememberSpot(x, z) {
    let px = x;
    let pz = z;
    if (window.World && (World.wet(x, z) || World.heightAt(x, z) < -0.2)) {
        let found = false;
        for (let ring = 16; ring <= 96 && !found; ring += 16) {
            for (let step = 0; step < 8; step++) {
                const tx = x + Math.cos(step * Math.PI / 4) * ring;
                const tz = z + Math.sin(step * Math.PI / 4) * ring;
                if (!World.wet(tx, tz) && World.heightAt(tx, tz) > -0.2) {
                    px = tx;
                    pz = tz;
                    found = true;
                    break;
                }
            }
        }
    }
    try {
        localStorage.setItem("village-spot", JSON.stringify({ x: px, z: pz }));
    } catch (err) { /* the village still opens at the last place that was saved */ }
    showVillages(shownVillages);
}

bakeIsland();
showVillages(homeColors.map((color) => ({ color })));

land.addEventListener("click", (event) => {
    const rect = land.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width * land.width;
    const py = (event.clientY - rect.top) / rect.height * land.height;
    const x = mapX0 + px / land.width * (mapX1 - mapX0);
    const z = mapZ0 + py / land.height * (mapZ1 - mapZ0);
    rememberSpot(x, z);
});

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
        const popLabel = hold.querySelector("[data-pop]");
        if (popLabel) popLabel.textContent = (village.pop || 0) + "/" + (village.limit || 20);
        const farmers = village.farmers || 0;
        const farmLabel = hold.querySelector("[data-farm]");
        if (farmLabel) farmLabel.textContent = farmers + (farmers === 1 ? " farmer" : " farmers");
        const fishers = village.fishers || 0;
        hold.querySelector("[data-fish]").textContent = fishers + (fishers === 1 ? " fisherman" : " fishermen");
        const cutters = village.woodcutters || 0;
        hold.querySelector("[data-woodcut]").textContent = cutters + (cutters === 1 ? " woodcutter" : " woodcutters");
        const jack = hold.querySelector("[data-jack]");
        if (jack) {
            const n = village.lumberjacks || 0;
            if (village.hasYard || n) {
                jack.textContent = " · " + n + (n === 1 ? " lumberjack" : " lumberjacks") + " · yard " + (village.yardWood || 0);
            } else jack.textContent = "";
        }
        const food = hold.querySelector("[data-food]");
        if (document.activeElement !== food) food.value = String(village.food || 0);
        hold.querySelector("[data-wood]").textContent = String(village.wood || 0);
        const status = hold.querySelector("[data-status]");
        const jobs = village.training || [];
        const training = jobs.map((kind) => {
            if (kind === "fisher") return "Training a fisherman";
            if (kind === "wood") return "Training a woodcutter";
            if (kind === "jack") return "Training a lumberjack";
            return "Training a soldier";
        }).concat((village.works || []).map((kind) => {
            if (kind === "house") return "Building a house";
            if (kind === "yard") return "Building a lumberyard";
            return "Building a farm";
        })).join(" · ");
        if (village.attacked) status.textContent = village.repairing ? "Under attack · Repairing a gate" : "Under attack";
        else if (village.marching) status.textContent = "Men marching out";
        else if (training) status.textContent = training;
        else if (village.repairing) status.textContent = "Repairing a gate";
        else if (village.fishing && village.chopping) status.textContent = "Fishing and cutting wood";
        else if (village.chopping) status.textContent = "Cutting wood";
        else if (village.fishing) status.textContent = "Fisherman working";
        else status.textContent = "";
        hold.querySelector("[data-men]").innerHTML = men(village.alive, village.color);
        const select = hold.querySelector("[data-stance]");
        if (select) {
            select.dataset.stance = String(village.owner);
            select.setAttribute("aria-label", "Southwest and " + village.ownerName);
            select.closest(".stance").hidden = village.owner === 2;
            hold.querySelector("[data-stance-name]").textContent = "Southwest and " + village.ownerName + ":";
        }
    });
    (data.minors || []).forEach((minor) => {
        const hold = holds[minor.index] || minorCard(minor);
        hold.style.borderTop = "6px solid " + minor.ownerColor;
        let owner = "Rural community";
        if (minor.owner !== minor.index) owner = "Held by " + minor.ownerName;
        else if (minor.protectorName) owner = "Rural community · protected by " + minor.protectorName;
        hold.querySelector("[data-owner]").textContent = owner;
        hold.querySelector("[data-pop]").textContent = String(minor.pop || 0);
        hold.querySelector("[data-houses]").textContent = minor.houses + (minor.houses === 1 ? " house" : " houses");
        hold.querySelector("[data-farm]").textContent = minor.farmers + (minor.farmers === 1 ? " farmer" : " farmers");
        const food = hold.querySelector("[data-food]");
        food.disabled = minor.owner !== minor.index;
        if (document.activeElement !== food) food.value = String(minor.food || 0);
    });
    for (const select of document.querySelectorAll("[data-stance]")) {
        const kind = (data.stance || [])[Number(select.dataset.stance)];
        if (kind && document.activeElement !== select) select.value = kind;
    }
    shownMinors = data.minors || shownMinors;
    showVillages(villages);
    paintFactions(data.factions || []);
    paintGuide(data.rules);
    const lines = data.log || [];
    if (!lines.length) {
        log.innerHTML = "<li>The houses are choosing who to recruit.</li>";
    } else {
        log.innerHTML = lines.map((line) => "<li>" + line + "</li>").join("");
    }
}

const unitNames = { soldier: "soldier", fisher: "fisherman", wood: "woodcutter", jack: "lumberjack" };
const buildNames = { house: "house", yard: "lumberyard", farm: "farm" };

function escapeHtml(text) {
    return String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function rows(table, list) {
    table.querySelector("tbody").innerHTML = list.map((cells) => "<tr>" + cells.map((cell) => "<td>" + cell + "</td>").join("") + "</tr>").join("");
}

function duration(ms, dayMs) {
    if (dayMs && ms >= dayMs) {
        const days = Math.round(ms / dayMs * 10) / 10;
        return days + (days === 1 ? " day" : " days") + " (" + Math.round(ms / 60000) + " min)";
    }
    if (ms >= 60000) return Math.round(ms / 60000) + " min";
    return Math.round(ms / 1000) + " s";
}

function paintFactions(list) {
    rows(document.getElementById("factions"), list.map((f) => {
        const work = f.building.map((kind) => "building a " + (buildNames[kind] || kind))
            .concat(f.training.map((kind) => "training a " + (unitNames[kind] || kind)));
        return [
            '<span class="swatch" style="background:' + f.color + '"></span>' + escapeHtml(f.name),
            f.holds.length ? escapeHtml(f.holds.join(", ")) : "nothing",
            f.pop + "/" + f.limit,
            f.alive,
            f.houses,
            f.farms,
            f.yards,
            f.food,
            f.upkeep,
            f.wood,
            work.length ? work.join(", ") : "—"
        ];
    }));
}

let guideShown = "";

function paintGuide(rules) {
    if (!rules) return;
    const key = JSON.stringify(rules);
    if (key === guideShown) return;
    guideShown = key;
    const dayMin = Math.round(rules.dayMs / 60000);
    const raid = rules.goblins;
    document.getElementById("guide-basics").textContent =
        "A game day lasts " + dayMin + " minutes. A faction holds " + rules.popBase + " people, plus " + rules.housePop +
        " for every house it builds. Soldiers and workers each take 1 place and eat " + rules.upkeep +
        " food a day. Gate repairs cost " + rules.repair.wood + " wood a time (gates have " + rules.repair.gateHp +
        " hit points). Goblins raid " + raid.target + " about every " + duration(raid.every, rules.dayMs) +
        ", " + raid.min + " to " + raid.max + " at a time.";
    rows(document.getElementById("guide-buildings"), rules.buildings.map((b) =>
        [b.name, b.wood + " wood", duration(b.ms, rules.dayMs), escapeHtml(b.gives), escapeHtml(b.when)]));
    rows(document.getElementById("guide-fixed"), rules.fixed.map((b) => [b.name, escapeHtml(b.gives)]));
    rows(document.getElementById("guide-units"), rules.units.map((u) =>
        [u.name, u.food + " food", duration(u.ms, rules.dayMs), escapeHtml(u.does)]));
}

function minorCard(minor) {
    const hold = document.createElement("article");
    hold.className = "hold minor";
    hold.dataset.i = String(minor.index);
    const name = escapeHtml(minor.name);
    hold.innerHTML =
        "<h2>" + name + "</h2>" +
        '<p class="owner" data-owner>Rural community</p>' +
        '<p class="count">pop <span data-pop>0</span> · <span data-houses>0 houses</span> · <span data-farm>0 farmers</span> · ' +
        '<label class="food">food <input data-food type="number" min="0" max="99999" step="1" value="0" aria-label="' + name + ' food"></label></p>' +
        '<label class="stance"><span data-stance-name>Southwest and ' + name + ':</span> <select data-stance="' + minor.index + '" aria-label="Southwest and ' + name + '">' +
        '<option value="war">War</option><option value="peace">Peace</option><option value="ally">Allied</option></select></label>' +
        '<p class="status" data-status></p>';
    mapBox.appendChild(hold);
    holds[minor.index] = hold;
    bindFood(hold);
    bindStance(hold.querySelector("[data-stance]"));
    return hold;
}

function paintClock() {
    clock.textContent = paused ? "Paused" : "Recruiting takes five minutes";
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

function bindFood(hold) {
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
}

function bindStance(select) {
    select.addEventListener("change", async () => {
        const res = await fetch("/api/campaign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ stance: Number(select.dataset.stance), kind: select.value })
        });
        if (!res.ok) return;
        take(await res.json());
    });
}

holds.forEach(bindFood);
document.querySelectorAll("[data-stance]").forEach(bindStance);

document.getElementById("restart").addEventListener("click", async () => {
    if (!window.confirm("Start again? Every village goes back to ten soldiers, two farmers, and 100 food.")) return;
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
