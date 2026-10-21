const Hero = require("../hero");

const MYSTERY_PRICE = 12;

const CATALOG = [
    { id: "ale", name: "Ale", price: 4 },
    { id: "bread", name: "Travel bread", price: 3 },
    { id: "cheese", name: "Hard cheese", price: 5 },
    { id: "rope", name: "Coil of rope", price: 8 },
    { id: "bandage", name: "Linen bandage", price: 6 },
    { id: "torch", name: "Pitch torch", price: 4 },
    { id: "oil", name: "Lamp oil", price: 7 },
    { id: "flint", name: "Flint and steel", price: 9 },
    { id: "herbs", name: "Dried herbs", price: 5 },
    { id: "charm", name: "Luck charm", price: 14 }
];

function findOffer(id) {
    return CATALOG.find((row) => row.id === id) || null;
}

function addPackItem(pack, id, name, count) {
    const items = Array.isArray(pack.items) ? pack.items : [];
    const row = items.find((item) => item.id === id);
    if (row) row.count += count;
    else items.push({ id, name, count });
    pack.items = items;
}

function buyOffer(state, offerId) {
    const offer = findOffer(offerId);
    if (!offer) return { ok: false, error: "That is not on the shelf." };
    state.hero = Hero.normalize(state.hero);
    const gold = state.hero.pack.gold || 0;
    if (gold < offer.price) return { ok: false, error: "Not enough gold." };
    state.hero.pack.gold = gold - offer.price;
    addPackItem(state.hero.pack, offer.id, offer.name, 1);
    return { ok: true, bought: offer, hero: state.hero };
}

function buyMystery(state) {
    state.hero = Hero.normalize(state.hero);
    const gold = state.hero.pack.gold || 0;
    if (gold < MYSTERY_PRICE) return { ok: false, error: "Not enough gold." };
    const offer = CATALOG[Math.floor(Math.random() * CATALOG.length)];
    state.hero.pack.gold = gold - MYSTERY_PRICE;
    addPackItem(state.hero.pack, offer.id, offer.name, 1);
    return { ok: true, bought: offer, mystery: true, paid: MYSTERY_PRICE, hero: state.hero };
}

function present() {
    return {
        mysteryPrice: MYSTERY_PRICE,
        catalog: CATALOG.map((row) => ({ id: row.id, name: row.name, price: row.price }))
    };
}

module.exports = {
    CATALOG,
    MYSTERY_PRICE,
    present,
    buyOffer,
    buyMystery
};
