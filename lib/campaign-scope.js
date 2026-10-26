const { AsyncLocalStorage } = require("async_hooks");

const scopeStore = new AsyncLocalStorage();

function parseActingFaction(req) {
    if (!req) return null;
    try {
        const u = new URL(req.url || "/", "http://localhost");
        const raw = u.searchParams.get("actingFaction");
        if (raw != null && raw !== "") {
            const n = Number(raw);
            if (n === 0 || n === 1) return n;
        }
    } catch (err) { /* ignore */ }
    if (req.body && req.body.actingFaction != null && req.body.actingFaction !== "") {
        const n = Number(req.body.actingFaction);
        if (n === 0 || n === 1) return n;
    }
    return null;
}

function runIslandScoped(island, req, fn) {
    const store = {
        island: Boolean(island),
        actingFaction: island ? parseActingFaction(req) : null
    };
    return scopeStore.run(store, fn);
}

function isIslandCampaign() {
    const store = scopeStore.getStore();
    return Boolean(store && store.island);
}

function getActingFaction() {
    const store = scopeStore.getStore();
    if (!store || !store.island) return null;
    if (store.actingFaction === 0 || store.actingFaction === 1) return store.actingFaction;
    return null;
}

function detectIslandFromRequest(req) {
    if (process.env.ISLAND_LAB === "1" || process.env.ISLAND_LAB === "true") return true;
    try {
        const u = new URL(req.url || "/", "http://localhost");
        if (u.searchParams.get("islandLab") === "1") return true;
    } catch (err) { /* ignore */ }
    if (req.body && (req.body.islandLab === true || req.body.islandLab === 1 || req.body.islandLab === "1")) {
        return true;
    }
    return false;
}

module.exports = {
    runIslandScoped,
    isIslandCampaign,
    getActingFaction,
    detectIslandFromRequest
};
