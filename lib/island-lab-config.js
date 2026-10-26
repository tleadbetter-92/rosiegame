const fs = require("fs");
const path = require("path");

const LAB_FACTIONS = [
    { id: "hold-a", name: "Westhold", color: "#6a7a3a" },
    { id: "hold-b", name: "Easthold", color: "#c45c3a" }
];

function envEnabled() {
    const v = process.env.ISLAND_LAB;
    return v === "1" || v === "true" || v === "yes";
}

function readPlacementsFile() {
    const file = path.join(__dirname, "..", "island-lab-placements.js");
    if (!fs.existsSync(file)) return null;
    const code = fs.readFileSync(file, "utf8");
    const m = code.match(/var IslandLabPlacements = (\{[\s\S]*?\});/);
    if (!m) return null;
    try {
        return JSON.parse(m[1]);
    } catch (err) {
        return null;
    }
}

function placesFromPlacements() {
    const data = readPlacementsFile();
    if (!data || !data.settlements || data.settlements.length < 2) return null;
    return data.settlements.slice(0, 2).map((s) => ({
        x: s.worldX,
        z: s.worldZ,
        ox: s.ox,
        oz: s.oz
    }));
}

function applyWorldPlaces(World) {
    const next = placesFromPlacements();
    if (!next) {
        console.warn("Island lab: need island-lab-placements.js with two settlements (run sync-island-settlement-cubes.js).");
        return false;
    }
    World.places.length = 0;
    next.forEach((p) => World.places.push(p));
    if (World.hamlets) World.hamlets.length = 0;
    return true;
}

module.exports = {
    envEnabled,
    LAB_FACTIONS,
    layoutKey: "islandBasicTown",
    playerVillage: 0,
    playerFaction: 0,
    applyWorldPlaces,
    placesFromPlacements,
    readPlacementsFile
};
