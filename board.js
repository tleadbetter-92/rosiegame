(function () {
const placeLand = document.getElementById("place-land");
const facts = document.getElementById("facts");
const title = document.getElementById("title");
const hint = document.getElementById("hint");
const coords = document.getElementById("coords");
const kindsBox = document.getElementById("kinds");
const removeButton = document.getElementById("remove");
const placeNames = ["Northwest", "Northeast", "Southwest", "Southeast"];
const hamletNames = ["Ashby", "Fernlow", "Brackwick", "Stoneacre", "Hollins", "Redmere", "Westerby"];
const homeColors = ["#c45c3a", "#3d6b8a", "#6a7a3a", "#8a5a7a"];
const kinds = [
    { id: "house", name: "House" },
    { id: "farm", name: "Farm" },
    { id: "yard", name: "Lumberyard" },
    { id: "mine", name: "Mine" }
];
const BUILD_HOURS = 1;
const ORDER_KEY = "sw-build-orders";
const home = World.places[2];
const you = { x: -2376.6, z: 539.2 };

function crewCap(kind) {
    if (kind === "farm") return 4;
    if (kind === "yard" || kind === "mine") return 100;
    return 0;
}

let chosenKind = "house";
let orders = [];
let selected = -1;
let phase = "you";
let acting = -1;
let turnLog = [];
let endButton = null;
let view = { x0: home.x - 280, x1: home.x + 280, z0: home.z - 250, z1: home.z + 250 };
let islandBase = null;
let bakePending = 0;

const settlements = World.places.map((place, index) => ({
    kind: "town",
    index,
    name: placeNames[index],
    color: homeColors[index],
    x: place.x,
    z: place.z
})).concat(World.hamlets.map((hamlet, index) => ({
    kind: "hamlet",
    index,
    name: hamletNames[index] || hamlet.id,
    color: "#b0883a",
    x: hamlet.x,
    z: hamlet.z
})));

const southwest = settlements[2];

function woodStand(place, slot) {
    const n = slot % 8;
    const ang = n * (Math.PI / 4) + 0.35;
    const r = place.kind === "hamlet" ? 34 + (n % 3) * 4 : 48 + (n % 3) * 5;
    return { kind: "wood", name: "wood", x: place.x + Math.cos(ang) * r, z: place.z + Math.sin(ang) * r, place: place.name };
}

const stands = [];
settlements.forEach((place) => {
    for (let slot = 0; slot < 8; slot++) stands.push(woodStand(place, slot));
});

const ores = (World.ores || []).map((pair, index) => ({
    kind: "ore",
    name: "ore",
    x: pair[0],
    z: pair[1],
    place: "ore " + (index + 1)
}));

function drySlots(place) {
    const rings = [45, 75, 110, 150, 195];
    const spots = [];
    for (let r = 0; r < rings.length; r++) {
        const dist = rings[r];
        for (let i = 0; i < 12; i++) {
            const ang = (i / 12) * Math.PI * 2 + dist * 0.01;
            const x = place.x + Math.cos(ang) * dist;
            const z = place.z + Math.sin(ang) * dist;
            const h = World.heightAt(x, z);
            if (World.wet(x, z) || h < 0.4) continue;
            spots.push({ x, z });
        }
    }
    return spots;
}

settlements.forEach((place) => {
    if (place.kind === "town") place.slots = drySlots(place);
});

function readOrder(order) {
    if (!order || !kinds.some((kind) => kind.id === order.kind) || !Number.isFinite(order.x) || !Number.isFinite(order.z)) return null;
    const owner = order.owner == null ? 2 : order.owner;
    const cap = crewCap(order.kind);
    const crew = cap ? Math.max(0, Math.min(cap, Math.floor(Number(order.crew) || 0))) : 0;
    return { kind: order.kind, x: Math.round(order.x), z: Math.round(order.z), hours: BUILD_HOURS, owner, crew };
}

function loadOrders() {
    try {
        const raw = JSON.parse(localStorage.getItem(ORDER_KEY) || "[]");
        const list = Array.isArray(raw) ? raw : (raw && raw.orders) || [];
        orders = list.map(readOrder).filter(Boolean);
        phase = raw && raw.phase === "wait" ? "wait" : "you";
        turnLog = raw && Array.isArray(raw.log) ? raw.log.slice(-24) : [];
    } catch (err) {
        orders = [];
    }
}

function saveOrders() {
    try {
        localStorage.setItem(ORDER_KEY, JSON.stringify({ phase, log: turnLog, orders }));
    } catch (err) { /* the list on the page is still the order */ }
}

function kindName(id) {
    const kind = kinds.find((item) => item.id === id);
    return kind ? kind.name : id;
}

function mapPoint(x, z) {
    return {
        x: (x - view.x0) / (view.x1 - view.x0) * placeLand.width,
        y: (z - view.z0) / (view.z1 - view.z0) * placeLand.height
    };
}

function worldPoint(px, py) {
    return {
        x: view.x0 + px / placeLand.width * (view.x1 - view.x0),
        z: view.z0 + py / placeLand.height * (view.z1 - view.z0)
    };
}

function inView(x, z, pad) {
    return x >= view.x0 - pad && x <= view.x1 + pad && z >= view.z0 - pad && z <= view.z1 + pad;
}

function metresPerPixel() {
    return (view.x1 - view.x0) / placeLand.width;
}

function taken(spot) {
    return orders.some((order) => Math.hypot(order.x - spot.x, order.z - spot.z) < 8);
}

function resourceKind(id) {
    return id === "yard" || id === "mine";
}

function villageMetres(x, z) {
    return Math.hypot(x - home.x, z - home.z);
}

function dayTake(count, metres) {
    const base = count * 12;
    const lost = Math.ceil(base * metres / 10000);
    return Math.max(0, base - lost);
}

function closestResource(place, kindId) {
    const list = kindId === "mine" ? ores : stands.filter((stand) => stand.place === place.name);
    let best = null;
    let bestD = Infinity;
    list.forEach((item) => {
        if (taken(item)) return;
        const d = Math.hypot(item.x - place.x, item.z - place.z);
        if (d < bestD) {
            best = item;
            bestD = d;
        }
    });
    return best;
}

function bakeIsland() {
    const cols = 220;
    const rows = 200;
    const scratch = document.createElement("canvas");
    scratch.width = cols;
    scratch.height = rows;
    const image = scratch.getContext("2d").createImageData(cols, rows);
    const data = image.data;
    for (let row = 0; row < rows; row++) {
        const z = view.z0 + (row + 0.5) / rows * (view.z1 - view.z0);
        for (let col = 0; col < cols; col++) {
            const x = view.x0 + (col + 0.5) / cols * (view.x1 - view.x0);
            const h = World.heightAt(x, z);
            const wet = World.wet(x, z) || h < -0.05;
            let rgb = [70, 124, 58];
            if (wet) rgb = h < -2.2 ? [20, 78, 122] : [58, 140, 186];
            else if (h < 1.2) rgb = [214, 196, 138];
            else if (h > 22) rgb = [132, 126, 116];
            else if (h > 8) rgb = [96, 132, 72];
            const i = (row * cols + col) * 4;
            data[i] = rgb[0];
            data[i + 1] = rgb[1];
            data[i + 2] = rgb[2];
            data[i + 3] = 255;
        }
    }
    scratch.getContext("2d").putImageData(image, 0, 0);
    islandBase = document.createElement("canvas");
    islandBase.width = placeLand.width;
    islandBase.height = placeLand.height;
    islandBase.getContext("2d").drawImage(scratch, 0, 0, placeLand.width, placeLand.height);
}

function draw() {
    const ctx = placeLand.getContext("2d");
    if (islandBase) ctx.drawImage(islandBase, 0, 0);
    const wall = mapPoint(home.x - 17.5, home.z - 21);
    const wall2 = mapPoint(home.x + 16.5, home.z + 13);
    ctx.strokeStyle = "rgba(244, 239, 228, 0.7)";
    ctx.strokeRect(wall.x, wall.y, wall2.x - wall.x, wall2.y - wall.y);
    if (chosenKind === "house" || chosenKind === "farm") {
        southwest.slots.forEach((spot) => {
            if (!inView(spot.x, spot.z, 0) || taken(spot)) return;
            const p = mapPoint(spot.x, spot.z);
            ctx.beginPath();
            ctx.fillStyle = "#f2d15a";
            ctx.strokeStyle = "#241c14";
            ctx.lineWidth = 1;
            ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });
    }
    stands.forEach((stand) => {
        if (!inView(stand.x, stand.z, 0)) return;
        const p = mapPoint(stand.x, stand.z);
        const site = chosenKind === "yard" && !taken(stand);
        ctx.strokeStyle = site ? "#f2d15a" : "#173812";
        ctx.lineWidth = site ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 6);
        ctx.lineTo(p.x, p.y + 4);
        ctx.moveTo(p.x - 4, p.y - 1);
        ctx.lineTo(p.x + 4, p.y - 1);
        ctx.stroke();
    });
    ores.forEach((ore) => {
        if (!inView(ore.x, ore.z, 0)) return;
        const p = mapPoint(ore.x, ore.z);
        const site = chosenKind === "mine" && !taken(ore);
        ctx.fillStyle = site ? "#f2d15a" : "#6a4a28";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 6);
        ctx.lineTo(p.x + 5, p.y);
        ctx.lineTo(p.x, p.y + 6);
        ctx.lineTo(p.x - 5, p.y);
        ctx.fill();
    });
    settlements.forEach((place) => {
        if (!inView(place.x, place.z, 40)) return;
        const p = mapPoint(place.x, place.z);
        ctx.beginPath();
        ctx.fillStyle = "#f4efe4";
        ctx.strokeStyle = place.color;
        ctx.lineWidth = 2;
        if (place.kind === "town") ctx.rect(p.x - 7, p.y - 7, 14, 14);
        else ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.font = "12px Segoe UI, system-ui, sans-serif";
        ctx.fillStyle = "#241c14";
        ctx.fillText(place.name, p.x + 10, p.y - 8);
    });
    orders.forEach((order, index) => {
        if (!inView(order.x, order.z, 0)) return;
        const p = mapPoint(order.x, order.z);
        const on = index === selected;
        ctx.fillStyle = on ? "#f2d15a" : "#f4efe4";
        ctx.strokeStyle = homeColors[order.owner == null ? 2 : order.owner] || "#241c14";
        ctx.lineWidth = on ? 3 : 2;
        ctx.fillRect(p.x - 8, p.y - 8, 16, 16);
        ctx.strokeRect(p.x - 8, p.y - 8, 16, 16);
        ctx.font = "12px Segoe UI, system-ui, sans-serif";
        ctx.fillStyle = "#241c14";
        const cap = crewCap(order.kind);
        const label = cap ? kindName(order.kind) + "  " + (order.crew || 0) : kindName(order.kind);
        ctx.fillText(label, p.x + 12, p.y - 2);
        ctx.fillText(order.x + ", " + order.z, p.x + 12, p.y + 12);
    });
    const p = mapPoint(you.x, you.z);
    ctx.fillStyle = "#f7f4ea";
    ctx.strokeStyle = "#241c14";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = "700 13px Segoe UI, system-ui, sans-serif";
    ctx.fillStyle = "#241c14";
    ctx.fillText("You", p.x + 10, p.y + 4);
}

function line(text) {
    const item = document.createElement("li");
    item.textContent = text;
    facts.appendChild(item);
}

function yours(order) {
    return !order || order.owner == null || order.owner === 2;
}

function paint() {
    if (title) title.textContent = phase === "wait" ? "Waiting" : "Your turn";
    facts.innerHTML = "";
    const open = phase === "you";
    kinds.forEach((kind) => {
        const button = kindsBox.querySelector('[data-kind="' + kind.id + '"]');
        if (!button) return;
        button.disabled = !open;
        button.classList.toggle("on", open && kind.id === chosenKind);
    });
    if (endButton) endButton.disabled = !open;
    const growButton = document.getElementById("grow");
    const growInput = document.getElementById("grow-count");
    const workplace = selectedWorkplace();
    if (growButton) growButton.disabled = !open || !workplace;
    if (growInput) {
        growInput.disabled = !open || !workplace;
        growInput.max = workplace ? String(crewCap(workplace.kind)) : "100";
    }
    if (!open) {
        hint.textContent = phase === "wait"
            ? "Waiting. The next round starts when 12 hours have passed on your clock."
            : acting >= 0 ? placeNames[acting] + " is taking a turn." : "You ended your turn.";
        placeLand.style.cursor = "grab";
    } else if (chosenKind === "yard") {
        hint.textContent = "Lumberyard is selected. Click a wood stand. It can sit outside the village. Each 100 m from Southwest takes 1% off 120 a day, and that loss is rounded up.";
        placeLand.style.cursor = "crosshair";
    } else if (chosenKind === "mine") {
        hint.textContent = "Mine is selected. Click an ore. It can sit outside the village. Each 100 m from Southwest takes 1% off 120 a day, and that loss is rounded up.";
        placeLand.style.cursor = "crosshair";
    } else if (chosenKind) {
        hint.textContent = kindName(chosenKind) + " is selected. Click a yellow spot. Each one takes " + BUILD_HOURS + " hour, and they are all built together when the 12 hours have passed. End your turn when you are finished.";
        placeLand.style.cursor = "crosshair";
    } else {
        hint.textContent = "House and Farm go on a yellow spot. Lumberyard goes on a wood stand. Mine goes on an ore. Select one of those workplaces and grow its workers. They stay there. A farm holds 4. A mine or lumberyard holds 100.";
        placeLand.style.cursor = "grab";
    }
    const order = orders[selected];
    if (order) {
        coords.textContent = order.x + "\n" + order.z;
        removeButton.hidden = !open || !yours(order);
    } else {
        coords.textContent = "";
        removeButton.hidden = true;
    }
    turnLog.forEach(line);
    if (!orders.length) line("No building ordered.");
    orders.forEach((item, index) => {
        const mark = index === selected ? "selected  " : "";
        const who = item.owner == null || item.owner === 2 ? "" : placeNames[item.owner] + "  ";
        let extra = "";
        const cap = crewCap(item.kind);
        if (cap) {
            const owner = item.owner == null ? 2 : item.owner;
            const place = settlements[owner] || settlements[2];
            const metres = Math.hypot(item.x - place.x, item.z - place.z);
            extra = "   " + (item.crew || 0) + "/" + cap + " workers";
            if (resourceKind(item.kind)) extra += ", " + Math.round(metres) + " m from " + place.name + ", " + dayTake(item.crew || 0, metres) + " a day";
        }
        line(mark + who + kindName(item.kind) + "   " + item.x + "   " + item.z + extra);
    });
    line("The two numbers are x and z in the 3D world.");
    line("Every town's workers belong to the workplace. They are not moved. A farm holds 4. A mine or lumberyard holds 100.");
    line("Wheel zooms. Drag moves the map.");
}

function factionOrder(index) {
    const place = settlements[index];
    const kind = kinds[index % kinds.length];
    const spot = resourceKind(kind.id) ? closestResource(place, kind.id) : (place.slots || []).find((item) => !taken(item));
    if (!spot) turnLog.push(place.name + " passes.");
    else {
        const cap = crewCap(kind.id);
        const order = { kind: kind.id, x: Math.round(spot.x), z: Math.round(spot.z), hours: BUILD_HOURS, owner: index, crew: cap ? Math.min(cap, 4) : 0 };
        orders.push(order);
        turnLog.push(place.name + " ordered a " + kind.name + " at " + order.x + ", " + order.z + ".");
    }
}

function endTurn() {
    if (phase !== "you") return;
    phase = "theirs";
    chosenKind = null;
    turnLog.push("You ended your turn.");
    const queue = [0, 1, 3];
    let step = 0;
    function next() {
        if (step >= queue.length) {
            phase = "wait";
            acting = -1;
            turnLog.push("Waiting. The next round starts when 12 hours have passed on your clock.");
            saveOrders();
            draw();
            paint();
            return;
        }
        acting = queue[step];
        step += 1;
        factionOrder(acting);
        draw();
        paint();
        setTimeout(next, 900);
    }
    draw();
    paint();
    setTimeout(next, 900);
}

function nearest(list, at, limit) {
    let best = null;
    let bestD = limit;
    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (!inView(item.x, item.z, 0)) continue;
        const d = Math.hypot(item.x - at.x, item.z - at.z);
        if (d < bestD) {
            best = item;
            bestD = d;
        }
    }
    return best;
}

function clickAt(px, py) {
    const at = worldPoint(px, py);
    const reach = metresPerPixel() * 16;
    const hit = nearest(orders, at, reach);
    if (phase === "you" && resourceKind(chosenKind)) {
        const list = chosenKind === "mine" ? ores : stands;
        const site = nearest(list.filter((item) => !taken(item)), at, reach);
        if (site) {
            orders.push({ kind: chosenKind, x: Math.round(site.x), z: Math.round(site.z), hours: BUILD_HOURS, owner: 2 });
            selected = orders.length - 1;
            saveOrders();
            draw();
            paint();
            return;
        }
    }
    if (hit) {
        selected = orders.indexOf(hit);
        draw();
        paint();
        return;
    }
    if (phase !== "you" || resourceKind(chosenKind)) return;
    const spot = chosenKind ? nearest(southwest.slots.filter((item) => !taken(item)), at, reach) : null;
    if (spot) {
        orders.push({ kind: chosenKind, x: Math.round(spot.x), z: Math.round(spot.z), hours: BUILD_HOURS, owner: 2 });
        selected = orders.length - 1;
        saveOrders();
        draw();
        paint();
    }
}

function fieldNumber(id, max) {
    const input = document.getElementById(id);
    const n = Math.floor(Number(input && input.value) || 1);
    return Math.max(1, Math.min(max, n));
}

function selectedWorkplace() {
    const order = orders[selected];
    if (!order || !yours(order) || !crewCap(order.kind)) return null;
    return order;
}

function growWorkers() {
    if (phase !== "you") return;
    const order = selectedWorkplace();
    if (!order) return;
    const cap = crewCap(order.kind);
    const add = fieldNumber("grow-count", cap - (order.crew || 0));
    order.crew = Math.min(cap, (order.crew || 0) + add);
    saveOrders();
    draw();
    paint();
}

function canvasPos(event) {
    const rect = placeLand.getBoundingClientRect();
    return {
        x: (event.clientX - rect.left) / rect.width * placeLand.width,
        y: (event.clientY - rect.top) / rect.height * placeLand.height
    };
}

let drag = null;

function bind() {
    const work = document.createElement("div");
    work.id = "work";
    work.innerHTML = '<label>Grow <input id="grow-count" type="number" min="1" max="100" step="1" value="1"> workers at the selected workplace</label><button id="grow" type="button">Grow</button>';
    kindsBox.parentNode.insertBefore(work, kindsBox);
    document.getElementById("grow").addEventListener("click", growWorkers);
    kinds.forEach((kind) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.kind = kind.id;
        button.textContent = kind.name;
        button.addEventListener("click", () => {
            if (phase !== "you") return;
            chosenKind = kind.id;
            paint();
            draw();
        });
        kindsBox.appendChild(button);
    });
    endButton = document.createElement("button");
    endButton.id = "end-turn";
    endButton.type = "button";
    endButton.textContent = "End turn";
    endButton.addEventListener("click", endTurn);
    removeButton.insertAdjacentElement("afterend", endButton);
    removeButton.addEventListener("click", () => {
        if (phase !== "you" || selected < 0 || !yours(orders[selected])) return;
        orders.splice(selected, 1);
        selected = orders.length ? Math.min(selected, orders.length - 1) : -1;
        saveOrders();
        draw();
        paint();
    });
    placeLand.addEventListener("pointerdown", (event) => {
        placeLand.setPointerCapture(event.pointerId);
        const pos = canvasPos(event);
        drag = { x: event.clientX, y: event.clientY, px: pos.x, py: pos.y, moved: false };
    });
    placeLand.addEventListener("pointermove", (event) => {
        if (!drag) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (dx * dx + dy * dy > 16) drag.moved = true;
        if (!drag.moved) return;
        const spanX = view.x1 - view.x0;
        const spanZ = view.z1 - view.z0;
        const shiftX = -dx / placeLand.clientWidth * spanX;
        const shiftZ = -dy / placeLand.clientHeight * spanZ;
        view = { x0: view.x0 + shiftX, x1: view.x1 + shiftX, z0: view.z0 + shiftZ, z1: view.z1 + shiftZ };
        drag.x = event.clientX;
        drag.y = event.clientY;
        scheduleBake();
    });
    placeLand.addEventListener("pointerup", (event) => {
        if (!drag) return;
        const moved = drag.moved;
        const pos = { x: drag.px, y: drag.py };
        drag = null;
        if (!moved) clickAt(pos.x, pos.y);
    });
    placeLand.addEventListener("wheel", (event) => {
        event.preventDefault();
        const pos = canvasPos(event);
        const at = worldPoint(pos.x, pos.y);
        const scale = event.deltaY > 0 ? 1.15 : 0.87;
        let spanX = (view.x1 - view.x0) * scale;
        let spanZ = (view.z1 - view.z0) * scale;
        spanX = Math.max(280, Math.min(4200, spanX));
        spanZ = spanX * (placeLand.height / placeLand.width);
        const u = (at.x - view.x0) / (view.x1 - view.x0);
        const v = (at.z - view.z0) / (view.z1 - view.z0);
        view = { x0: at.x - u * spanX, x1: at.x + (1 - u) * spanX, z0: at.z - v * spanZ, z1: at.z + (1 - v) * spanZ };
        scheduleBake();
    }, { passive: false });
}

function scheduleBake() {
    if (bakePending) cancelAnimationFrame(bakePending);
    bakePending = requestAnimationFrame(() => {
        bakePending = 0;
        bakeIsland();
        draw();
    });
}

if (placeLand && facts && kindsBox) {
    loadOrders();
    bind();
    bakeIsland();
    draw();
    paint();
} else if (hint) {
    hint.textContent = "The map did not start.";
}
})();
