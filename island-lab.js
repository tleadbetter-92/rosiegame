// Two-faction island lab — enable with ?islandLab=1 on village.html (and ISLAND_LAB=1 for campaign server).
(function (global) {
    const params = new URLSearchParams(global.location ? global.location.search : "");
    if (params.get("islandLab") === "1") {
        try {
            global.localStorage.setItem("islandLab", "1");
        } catch (err) { /* private mode */ }
    }
    if (params.get("islandLab") === "0") {
        try {
            global.localStorage.removeItem("islandLab");
        } catch (err) { /* private mode */ }
    }
    const fileOn = typeof IslandLabPlacements !== "undefined"
        && IslandLabPlacements.ready
        && IslandLabPlacements.settlements
        && IslandLabPlacements.settlements.length >= 2;
    const campaignPage = global.CAMPAIGN_ISLAND === true;
    const enabled = params.get("islandLab") === "1" || (campaignPage && fileOn);

    const lab = {
        enabled,
        layoutKey: (typeof IslandLabPlacements !== "undefined" && IslandLabPlacements.layout) || "islandBasicTown",
        playerVillage: 0,
        settlements: enabled && fileOn ? IslandLabPlacements.settlements.slice(0, 2) : []
    };

    if (enabled && global.World && lab.settlements.length >= 2) {
        const next = lab.settlements.map((s) => ({
            x: s.worldX,
            z: s.worldZ,
            ox: s.ox,
            oz: s.oz
        }));
        global.World.places.length = 0;
        next.forEach((p) => global.World.places.push(p));
        if (global.World.hamlets) global.World.hamlets.length = 0;
    }

    global.IslandLab = lab;
})(typeof window !== "undefined" ? window : globalThis);
