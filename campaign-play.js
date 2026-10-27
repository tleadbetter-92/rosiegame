const land = document.getElementById("land");
const log = document.getElementById("log");
const endButton = document.getElementById("end-turn");
const view = { x0: -3720, x1: -1400, z0: -680, z1: 1060 };

let base = null;
let campaign = null;
let picked = null;

function mapPoint(x, z) {
    return {
        x: (x - view.x0) / (view.x1 - view.x0) * land.width,
        y: (z - view.z0) / (view.z1 - view.z0) * land.height
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

function bakeLand() {
    if (!land || !window.World || base) return;
    const cols = 240;
    const rows = 180;
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
            const rgb = terrainColor(h, World.wet(x, z));
            const i = (row * cols + col) * 4;
            data[i] = rgb[0];
            data[i + 1] = rgb[1];
            data[i + 2] = rgb[2];
            data[i + 3] = 255;
        }
    }
    scratch.getContext("2d").putImageData(image, 0, 0);
    base = document.createElement("canvas");
    base.width = land.width;
    base.height = land.height;
    const ctx = base.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(scratch, 0, 0, land.width, land.height);
}

function spotsOf(region) {
    const towns = region.towns || [];
    const capital = region.capital || null;
    return { capital, towns };
}

function campaignDistricts(region) {
    if (window.CampaignDistricts) return CampaignDistricts.polysFor(region.faction);
    const west = view.x0;
    const east = view.x1;
    const north = view.z0;
    const south = view.z1;
    const split = 200;
    if (region.faction === 0) {
        return [
            [[west, north], [-3000, north], [-2630, -240], [-2660, -51], [-3200, split], [west, split]],
            [[-3000, north], [-2200, north], [-2420, -348], [-2445, -160], [-2100, split], [-3200, split], [-2660, -51], [-2630, -240]],
            [[-2200, north], [east, north], [east, split], [-2100, split], [-2445, -160], [-2420, -348]]
        ];
    }
    return [
        [[west, split], [-2680, split], [-2680, south], [west, south]],
        [[-2680, split], [-2300, split], [-2180, 500], [east, 640], [east, south], [-2680, south]],
        [[-2300, split], [east, split], [east, 640], [-2180, 500]]
    ];
}

function tracePoly(ctx, poly) {
    ctx.beginPath();
    poly.forEach((spot, index) => {
        const p = mapPoint(spot[0], spot[1]);
        if (index === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
}

function drawMap() {
    if (!land || !base) return;
    const ctx = land.getContext("2d");
    ctx.drawImage(base, 0, 0);
    const regions = (campaign && campaign.regions) || (window.World && World.regions) || [];
    const villages = (campaign && campaign.villages) || [];
    const shades = [0.2, 0.32, 0.24];
    regions.forEach((region) => {
        const village = villages.find((item) => item.index === region.faction);
        const color = (village && village.color) || (region.faction === 0 ? "#c45c3a" : "#6a7a3a");
        const districts = campaignDistricts(region);
        districts.forEach((poly, index) => {
            tracePoly(ctx, poly);
            ctx.globalAlpha = shades[index];
            ctx.fillStyle = color;
            ctx.fill();
        });
        ctx.globalAlpha = 1;
        districts.forEach((poly) => {
            tracePoly(ctx, poly);
            ctx.lineWidth = 2;
            ctx.strokeStyle = "rgba(42, 24, 18, 0.9)";
            ctx.stroke();
        });
        const title = region.factionName || (village && village.name) || "Region";
        const label = region.faction === 0 ? mapPoint(-1900, -180) : mapPoint(-2500, 520);
        ctx.font = "700 22px Segoe UI, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(20, 24, 18, 0.85)";
        ctx.strokeText(title, label.x, label.y);
        ctx.fillStyle = "#f7f4ea";
        ctx.fillText(title, label.x, label.y);
    });
    const edgeA = mapPoint(view.x0, 200);
    const edgeB = mapPoint(view.x1, 200);
    ctx.beginPath();
    ctx.moveTo(edgeA.x, edgeA.y);
    ctx.lineTo(edgeB.x, edgeB.y);
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#16130f";
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(150, 108, 62, 0.9)";
    ctx.lineCap = "round";
    if (window.World && World.trackOf) {
        const road = [{ x: World.places[0].x, z: World.places[0].z }]
            .concat(World.trackOf(0, 2).map((spot) => ({ x: spot[0], z: spot[1] })))
            .concat([{ x: World.places[2].x, z: World.places[2].z }]);
        ctx.beginPath();
        road.forEach((spot, index) => {
            const p = mapPoint(spot.x, spot.z);
            if (index === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
    }
    regions.forEach((region) => {
        const village = villages.find((item) => item.index === region.faction);
        const color = (village && village.color) || "#f4efe4";
        const pack = spotsOf(region);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.18;
        [pack.capital].concat(pack.towns).forEach((spot) => {
            if (!spot) return;
            const p = mapPoint(spot.x, spot.z);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 54, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
        pack.towns.forEach((town) => {
            const owned = !Number.isInteger(town.holder) || town.holder === region.faction;
            const townColor = owned ? color : holderColor(town.holder, color);
            mark(ctx, town.x, town.z, town.name + (owned ? "" : " · occupied"), townColor, false, town.id === picked);
        });
        if (pack.capital) {
            const owned = !Number.isInteger(region.holder) || region.holder === region.faction;
            const capitalColor = owned ? color : holderColor(region.holder, color);
            mark(ctx, pack.capital.x, pack.capital.z, region.name + (owned ? "" : " · occupied"), capitalColor, true, region.id === picked);
            const army = armyPlace(region, regions);
            const count = region.army && Number.isFinite(region.army.soldiers) ? region.army.soldiers : 0;
            const home = region.army && region.army.garrison;
            const marching = region.army && (region.army.attack || region.army.verdict || region.army.relief);
            if (marching && home && Number.isFinite(home.x)) {
                const from = mapPoint(home.x, home.z);
                const to = mapPoint(army.x, army.z);
                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, to.y);
                ctx.lineWidth = 3;
                ctx.strokeStyle = color;
                ctx.setLineDash([6, 6]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            markArmy(ctx, army.x, army.z, count, color, picked === "army:" + region.id);
        }
    });
}

function armySpot(capital) {
    return { x: capital.x + 90, z: capital.z + 80 };
}

function holderColor(faction, fallback) {
    const villages = (campaign && campaign.villages) || [];
    const village = villages.find((item) => item.index === faction);
    return (village && village.color) || fallback;
}

function armyPlace(region, regions) {
    const army = region.army;
    if (!army || !Number.isFinite(army.x)) return armySpot(region.capital);
    const crowded = (regions || []).some((other) => {
        if (!other || other.id === region.id || !other.army || !Number.isFinite(other.army.x)) return false;
        return Math.hypot(other.army.x - army.x, other.army.z - army.z) < 30;
    });
    if (crowded && army.attack) return { x: army.x + 42, z: army.z + 34 };
    if (crowded) return { x: army.x - 42, z: army.z - 34 };
    return { x: army.x + 36, z: army.z + 28 };
}

function markArmy(ctx, x, z, soldiers, color, on) {
    const p = mapPoint(x, z);
    ctx.beginPath();
    ctx.fillStyle = on ? "#f2d15a" : color;
    ctx.strokeStyle = "#f7f4ea";
    ctx.lineWidth = on ? 4 : 2;
    ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = "700 12px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#1c1914";
    ctx.fillText(String(soldiers), p.x, p.y + 4);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(20, 24, 18, 0.8)";
    ctx.strokeText("Army", p.x, p.y - 18);
    ctx.fillStyle = "#f7f4ea";
    ctx.fillText("Army", p.x, p.y - 18);
}

function mark(ctx, x, z, name, color, capital, on) {
    const p = mapPoint(x, z);
    ctx.beginPath();
    ctx.fillStyle = on ? "#f2d15a" : "#f4efe4";
    ctx.strokeStyle = color;
    ctx.lineWidth = on ? 4 : 3;
    if (capital) ctx.rect(p.x - 9, p.y - 9, 18, 18);
    else ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = "700 15px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(20, 24, 18, 0.8)";
    ctx.strokeText(name, p.x, p.y - 16);
    ctx.fillStyle = "#f7f4ea";
    ctx.fillText(name, p.x, p.y - 16);
}

function paintHand(hand) {
    const day = document.getElementById("when-day");
    const turn = document.getElementById("when-turn");
    const who = document.getElementById("when-who");
    if (!hand) return;
    day.textContent = "Day " + hand.day + " · " + hand.hour;
    if (hand.waiting) {
        turn.textContent = "Twelve hours are passing";
        who.textContent = "Waiting";
        endButton.disabled = true;
        endButton.style.background = "#8a7a62";
    } else if (hand.reply) {
        turn.textContent = "Answer the attack";
        who.textContent = hand.name + " can answer";
        endButton.disabled = false;
        endButton.style.background = hand.color || "#6a7a3a";
        endButton.textContent = "Let it stand";
    } else {
        turn.textContent = "Choices, then twelve hours";
        who.textContent = hand.name + "'s choice";
        endButton.disabled = false;
        endButton.style.background = hand.color || "#6a7a3a";
        endButton.textContent = hand.name + " is done";
    }
    paintWait(hand);
}

let waitTimer = 0;
function paintWait(hand) {
    clearInterval(waitTimer);
    if (!hand || !hand.waiting || !hand.readyAt) return;
    function tick() {
        const left = hand.readyAt - Date.now();
        if (left <= 0) {
            endButton.textContent = "The next turn is opening";
            clearInterval(waitTimer);
            refresh();
            return;
        }
        const minutes = Math.floor(left / 60000);
        const seconds = Math.floor((left % 60000) / 1000);
        endButton.textContent = "Next turn in " + minutes + "m " + seconds + "s";
    }
    tick();
    waitTimer = setInterval(tick, 1000);
}

const STORE_ROWS = [["gold", "Gold"], ["stone", "Stone"], ["food", "Food"], ["salt", "Salt"], ["iron", "Iron"], ["wood", "Wood"], ["copper", "Copper"], ["tin", "Tin"], ["other", "Other"]];
const YIELD_GOOD = {
    Farms: "food",
    "Salt farm": "salt",
    Lumbermill: "wood",
    "Stone mine": "stone",
    "Gold mine": "gold",
    "Iron mine": "iron"
};
const TOWN_WORKS = {
    westfield: [["Salt farm", 1]],
    southfield: [["Lumbermill", 1]],
    eastwatch: [["Stone mine", 1]],
    westwatch: [["Gold mine", 1], ["Iron mine", 1]]
};

function buildingsFor(place) {
    const rows = place.major
        ? [["Houses", 20], ["Farms", 6], ["Storehouse", 1], ["Blacksmith", 1], ["Barracks", 1], ["Inn", 1], ["Lord's house", 1]]
        : [["Houses", 5], ["Farms", 2], ["Storehouse", 1]].concat(TOWN_WORKS[place.id] || []);
    return rows;
}

function popEach(name) {
    if (name === "Farms") return 5;
    if (name === "Storehouse") return 2;
    if (name === "Barracks") return 5;
    if (name === "Inn") return 2;
    if (name === "Salt farm" || name === "Lumbermill" || name === "Stone mine" || name === "Gold mine" || name === "Iron mine") return 10;
    return 0;
}

function buildingSheet(place) {
    const rows = buildingsFor(place).map((row) => {
        const each = popEach(row[0]);
        const people = each * row[1];
        const good = YIELD_GOOD[row[0]];
        const yieldTurn = good ? people * 50 : 0;
        return { name: row[0], count: row[1], each: each, people: people, good: good, yieldTurn: yieldTurn };
    });
    const housed = rows.reduce((sum, row) => sum + row.people, 0);
    return { rows: rows, population: housed * 3 };
}

function handFaction() {
    return campaign && campaign.hand && Number.isInteger(campaign.hand.faction) ? campaign.hand.faction : -1;
}

function regionOfArmyPick(id) {
    if (!id || String(id).indexOf("army:") !== 0) return null;
    const regions = (campaign && campaign.regions) || [];
    return regions.find((item) => item.id === id.slice(5)) || null;
}

function ownArmySelected() {
    const region = regionOfArmyPick(picked);
    if (!region || region.faction !== handFaction()) return null;
    return region;
}

function placeHolder(id) {
    if (!id || String(id).indexOf("army:") === 0) return -1;
    const regions = (campaign && campaign.regions) || [];
    for (let i = 0; i < regions.length; i++) {
        const region = regions[i];
        if (region.id === id) return Number.isInteger(region.holder) ? region.holder : region.faction;
        const towns = region.towns || [];
        for (let t = 0; t < towns.length; t++) {
            if (towns[t].id === id) return Number.isInteger(towns[t].holder) ? towns[t].holder : region.faction;
        }
    }
    return -1;
}

function armyOf(id) {
    const region = regionOfArmyPick(id);
    if (!region || !region.capital) return null;
    const attack = region.army && region.army.attack && region.army.attack.name ? region.army.attack : null;
    const verdict = region.army && region.army.verdict && region.army.verdict.placeName ? region.army.verdict : null;
    return {
        faction: region.factionName || "",
        where: (region.army && region.army.garrison && region.army.garrison.name) || region.name,
        soldiers: region.army && Number.isFinite(region.army.soldiers) ? region.army.soldiers : 0,
        attack: attack,
        relief: region.army && region.army.relief && region.army.relief.name ? region.army.relief : null,
        verdict: verdict,
        defend: region.army && region.army.defend && region.army.defend.name ? region.army.defend : null,
        yours: region.faction === handFaction()
    };
}

function settlementOf(id) {
    const regions = (campaign && campaign.regions) || [];
    for (let i = 0; i < regions.length; i++) {
        const region = regions[i];
        if (region.id === id) {
            const occupied = Number.isInteger(region.holder) && region.holder !== region.faction;
            return { id: region.id, name: region.name, faction: region.factionName || "", holderName: region.holderName || "", occupied: occupied, major: true };
        }
        const towns = region.towns || [];
        for (let t = 0; t < towns.length; t++) {
            if (towns[t].id === id) {
                const occupied = Number.isInteger(towns[t].holder) && towns[t].holder !== region.faction;
                return { id: towns[t].id, name: towns[t].name, faction: region.factionName || "", holderName: towns[t].holderName || "", occupied: occupied, major: false };
            }
        }
    }
    return null;
}

function storeLines(stores) {
    return STORE_ROWS.map((row) => {
        const amount = stores && Number.isFinite(Number(stores[row[0]])) ? Number(stores[row[0]]) : 1000;
        return "<li><span>" + row[1] + "</span><b>" + amount + "</b></li>";
    }).join("");
}

function paintRegions() {
    const box = document.getElementById("regions");
    const regions = (campaign && campaign.regions) || [];
    const villages = (campaign && campaign.villages) || [];
    const hand = campaign && campaign.hand;
    box.innerHTML = regions.map((region) => {
        const village = villages.find((item) => item.index === region.faction) || {};
        const aiming = ownArmySelected();
        const towns = (region.towns || []).map((town) => {
            const held = Number.isInteger(town.holder) && town.holder !== region.faction;
            const enemy = !!(aiming && placeHolder(town.id) !== aiming.faction);
            const label = town.name + (held ? " · occupied" : "");
            return "<li><button type=\"button\" class=\"place" + (town.id === picked ? " picked" : "") + (enemy ? " aim" : "") + "\" data-place=\"" + town.id + "\">" + label + "</button></li>";
        }).join("");
        const acting = hand && hand.faction === region.faction ? " acting" : "";
        const faction = region.factionName || village.name || region.name;
        const capitalHeld = Number.isInteger(region.holder) && region.holder !== region.faction;
        const capitalEnemy = !!(aiming && placeHolder(region.id) !== aiming.faction);
        return "<article class=\"region-card" + acting + "\" style=\"border-top-color:" + (village.color || "#6a7a3a") + "\">" +
            "<h3>" + faction + "</h3>" +
            "<p class=\"quiet\">Three districts</p>" +
            "<ul>" +
            "<li><button type=\"button\" class=\"place" + (region.id === picked ? " picked" : "") + (capitalEnemy ? " aim" : "") + "\" data-place=\"" + region.id + "\">" + region.name + (capitalHeld ? " · occupied" : "") + "</button></li>" +
            towns +
            "</ul>" +
            "<p><button type=\"button\" class=\"place" + (picked === "army:" + region.id ? " picked" : "") + "\" data-place=\"army:" + region.id + "\">Army · " + ((region.army && region.army.soldiers) || 0) + "</button></p>" +
            "<ul class=\"stores\">" + storeLines(region.stores) + "</ul></article>";
    }).join("");
}

function paintSettlement() {
    const box = document.getElementById("settlement");
    if (!box) return;
    const army = armyOf(picked);
    if (army) {
        let order = "Garrisoned in " + army.where + ". The capital trains 10 soldiers a turn.";
        let buttons = "";
        if (army.verdict) {
            const pct = Math.round((army.verdict.chance || 0) * 100);
            order = army.verdict.fought
                ? "Won at " + army.verdict.placeName + " (" + pct + "%). Occupy keeps the army there, and that town's goods come to you until it is retaken. Loot and leave takes 100 of every resource, loses " + army.verdict.losses + " soldiers, and returns to garrison."
                : army.verdict.placeName + " was undefended. Occupy keeps the army there, and that town's goods come to you until it is retaken. Loot and leave takes 100 of every resource and returns to garrison.";
            buttons = "<button type=\"button\" class=\"choice\" data-order=\"occupy\">Occupy " + army.verdict.placeName + "</button>" +
                "<button type=\"button\" class=\"choice\" data-order=\"loot\">Loot and leave</button>";
        } else if (army.yours && army.relief) {
            order = "Marching to defend " + army.relief.name + ". The battle is decided after 12 hours, when the next turn begins.";
        } else if (army.yours && army.defend) {
            order = army.defend.name + " is under attack. Send the army now. The battle is decided after 12 hours, when the next turn begins.";
            buttons = "<button type=\"button\" class=\"choice\" data-order=\"defend\">Defend " + army.defend.name + "</button>";
        } else if (army.yours && army.attack) {
            order = "Besieging " + army.attack.name + ". Their army can answer now. The battle is decided after 12 hours, when the next turn begins.";
        } else if (army.yours) {
            order = army.soldiers
                ? "Garrisoned in " + army.where + ". Click an enemy town or capital to attack it. The capital trains 10 soldiers a turn."
                : "Garrisoned in " + army.where + ". No soldiers yet. The capital trains 10 a turn.";
        } else if (army.attack) {
            order = "Besieging " + army.attack.name + ".";
        }
        box.innerHTML = "<p class=\"place-kind\">" + army.faction + " · Army</p>" +
            "<h3>" + army.where + "</h3>" +
            "<ul class=\"buildings\"><li><span>Soldiers</span><b>" + army.soldiers + "</b></li></ul>" +
            buttons +
            "<p class=\"quiet\">" + order + "</p>";
        return;
    }
    const place = settlementOf(picked);
    if (!place) {
        box.innerHTML = "<p class=\"quiet\">Click a town or a capital.</p>";
        return;
    }
    const sheet = buildingSheet(place);
    const rows = sheet.rows.map((row) => {
        const label = row.name + (row.each && row.count > 1 ? " · " + row.each + " each" : "");
        const made = row.yieldTurn ? "<em class=\"yield\">" + row.yieldTurn + " " + row.good + "</em>" : "<em class=\"yield\"></em>";
        return "<li><span>" + label + "</span><b>" + row.count + "</b>" + (row.people ? "<em>" + row.people + "</em>" : "<em></em>") + made + "</li>";
    }).join("");
    box.innerHTML = "<p class=\"place-kind\">" + place.faction + " · " + (place.major ? "Major settlement" : "Town") + (place.occupied ? " · occupied by " + place.holderName : "") + "</p>" +
        "<h3>" + place.name + "</h3>" +
        "<ul class=\"buildings\">" + rows + "</ul>" +
        "<h3 class=\"stats-label\">Stats</h3>" +
        "<p class=\"population\">Population " + sheet.population + "</p>" +
        (place.occupied ? "<p class=\"quiet\">Its goods go to " + place.holderName + " until it is retaken.</p>" : "");
}

function paintLog() {
    const lines = (campaign && campaign.log) || [];
    log.innerHTML = lines.length
        ? lines.slice().reverse().map((line) => "<li>" + line + "</li>").join("")
        : "<li>No turns yet.</li>";
}

function show(data) {
    campaign = data;
    paintHand(data.hand);
    paintRegions();
    paintSettlement();
    paintLog();
    drawMap();
}

async function refresh() {
    const res = await fetch("/api/campaign?brief=1", { cache: "no-store" });
    if (!res.ok) throw new Error("unreachable");
    show(await res.json());
}

land.addEventListener("click", (event) => {
    const rect = land.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width * land.width;
    const py = (event.clientY - rect.top) / rect.height * land.height;
    const x = view.x0 + px / land.width * (view.x1 - view.x0);
    const z = view.z0 + py / land.height * (view.z1 - view.z0);
    let best = null;
    let bestD = 80;
    const regions = (campaign && campaign.regions) || [];
    regions.forEach((region) => {
        const pack = spotsOf(region);
        if (pack.capital) {
            const army = armyPlace(region, regions);
            const ad = Math.hypot(army.x - x, army.z - z);
            if (ad < bestD) { bestD = ad; best = "army:" + region.id; }
            const d = Math.hypot(pack.capital.x - x, pack.capital.z - z);
            if (d < bestD) { bestD = d; best = region.id; }
        }
        (pack.towns || []).forEach((town) => {
            const d = Math.hypot(town.x - x, town.z - z);
            if (d < bestD) { bestD = d; best = town.id; }
        });
    });
    choosePlace(best);
});

async function postOrder(body, keep) {
    const res = await fetch("/api/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        let message = "The army stays.";
        try {
            const err = await res.json();
            if (err.error) message = err.error;
        } catch (err) { /* keep the plain message */ }
        paintSettlement();
        const quiet = document.querySelector("#settlement .quiet");
        if (quiet) quiet.textContent = message;
        return;
    }
    picked = keep;
    show(await res.json());
}

async function sendAttack(targetId) {
    await postOrder({ attack: targetId }, picked);
}

function choosePlace(next) {
    const region = ownArmySelected();
    const holder = placeHolder(next);
    if (region && region.army && region.army.verdict) {
        picked = next && String(next).indexOf("army:") === 0 ? next : picked;
        paintRegions();
        paintSettlement();
        drawMap();
        const quiet = document.querySelector("#settlement .quiet");
        if (quiet && holder >= 0) quiet.textContent = "Choose whether to occupy or loot.";
        return;
    }
    if (region && holder >= 0 && holder !== region.faction) {
        sendAttack(next);
        return;
    }
    picked = next;
    paintRegions();
    paintSettlement();
    drawMap();
}

document.getElementById("regions").addEventListener("click", (event) => {
    const button = event.target.closest("[data-place]");
    if (!button) return;
    choosePlace(button.getAttribute("data-place"));
});

document.getElementById("settlement").addEventListener("click", (event) => {
    const button = event.target.closest("[data-order]");
    if (!button) return;
    const order = button.getAttribute("data-order");
    if (order === "defend") postOrder({ defend: true }, picked);
    if (order === "occupy" || order === "loot") postOrder({ resolve: order }, picked);
});

endButton.addEventListener("click", async () => {
    endButton.disabled = true;
    try {
        const res = await fetch("/api/campaign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ endTurn: true })
        });
        if (res.ok) show(await res.json());
    } finally {
        endButton.disabled = false;
    }
});

(function bindGfxToggle() {
    const button = document.getElementById("gfx-toggle");
    if (!button || typeof GfxSettings === "undefined") return;
    function paint() {
        const mode = GfxSettings.load();
        button.textContent = GfxSettings.label(mode);
        button.setAttribute("aria-pressed", mode === "medium" ? "true" : "false");
    }
    paint();
    button.addEventListener("click", () => {
        GfxSettings.toggle();
        paint();
    });
})();

bakeLand();
drawMap();
refresh().catch(() => {
    document.getElementById("when-who").textContent = "The campaign could not be loaded.";
});
