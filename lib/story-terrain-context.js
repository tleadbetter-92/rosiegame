const World = require("../world");
const BrutesFaction = require("../brutes-faction");

function line(label, x, z, extra) {
    const tail = extra ? " — " + extra : "";
    return "- " + label + " (~" + Math.round(x) + ", " + Math.round(z) + ")" + tail;
}

function buildTerrainHintForStories() {
    const lines = [
        "[HIDDEN — geography sketch for story flavour only. NOT a complete map.",
        "You may invent caves, hollows, forgotten paths, and stretches of wood that are NOT listed here.",
        "Real terrain is a soft guide; made-up places become campaign-true once spoken.]\n"
    ];
    const places = World.places || [];
    if (places[2]) {
        lines.push(line("Southwest main town", places[2].x, places[2].z, "inn, barracks, palisade"));
    }
    const hamlets = World.hamlets || [];
    for (let i = 0; i < hamlets.length; i++) {
        const h = hamlets[i];
        lines.push(line("Hamlet " + (h.id || i), h.x, h.z, "small settlement"));
    }
    if (World.bruteLair) {
        const lair = World.bruteLair(BrutesFaction.LAIR_COUNT);
        if (lair.centre) {
            lines.push(line(BrutesFaction.NAME + " lair", lair.centre.x, lair.centre.z, "rough ring ~" + lair.radius + "m"));
        }
    }
    const wild = World.wildSpots(50);
    if (wild.centre) {
        lines.push(line("Goblin woods camp (editor ring)", wild.centre.x, wild.centre.z, "hostile wilds"));
    }
    lines.push("- Between towns: forest, hills, marsh patches, trails — name and place stories wherever feels right.");
    lines.push("- No need to match coordinates in dialogue; the listener hears place-names, not map grid.");
    return lines.join("\n");
}

module.exports = { buildTerrainHintForStories };
