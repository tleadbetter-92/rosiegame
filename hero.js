(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.Hero = api;
})(typeof self !== "undefined" ? self : this, function () {
    const ATTRIBUTES = [
        { id: "strength", name: "Strength" },
        { id: "agility", name: "Agility" },
        { id: "endurance", name: "Endurance" },
        { id: "intelligence", name: "Intelligence" },
        { id: "willpower", name: "Willpower" },
        { id: "personality", name: "Personality" },
        { id: "speed", name: "Speed" },
        { id: "luck", name: "Luck" }
    ];

    const SKILLS = [
        { id: "swords", name: "Swords", attr: "strength", use: "sword" },
        { id: "axes", name: "Axes", attr: "strength" },
        { id: "blunt", name: "Blunt Weapons", attr: "strength" },
        { id: "archery", name: "Archery", attr: "agility", use: "bow" },
        { id: "blocking", name: "Blocking", attr: "agility" },
        { id: "destruction", name: "Destruction", attr: "intelligence" },
        { id: "restoration", name: "Restoration", attr: "willpower" },
        { id: "stealth", name: "Stealth", attr: "agility" },
        { id: "lockpicking", name: "Lockpicking", attr: "agility" },
        { id: "speech", name: "Speech", attr: "personality" },
        { id: "mercantile", name: "Mercantile", attr: "personality" },
        { id: "smithing", name: "Smithing", attr: "endurance" },
        { id: "alchemy", name: "Alchemy", attr: "intelligence" },
        { id: "herbalism", name: "Herbalism", attr: "intelligence" }
    ];

    const START_ATTR = 40;
    const START_SKILL = 5;
    const RANKS_PER_LEVEL = 8;

    function clamp(value, lo, hi) {
        const n = Number(value);
        if (!Number.isFinite(n)) return lo;
        return Math.max(lo, Math.min(hi, n));
    }

    function defaultPack() {
        return { gold: 25, items: [], weapons: ["bow"] };
    }

    function normalizePack(raw, equipped) {
        const base = defaultPack();
        const src = raw && typeof raw === "object" ? raw : {};
        const items = Array.isArray(src.items) ? src.items.map((item) => ({
            id: String(item.id || ""),
            name: String(item.name || item.id || "Item"),
            count: Math.max(1, Math.round(Number(item.count) || 1))
        })).filter((item) => item.id) : [];
        const gold = Math.max(0, Math.round(Number(src.gold) || base.gold));
        let weapons = Array.isArray(src.weapons)
            ? src.weapons.filter((w) => w === "sword" || w === "bow")
            : base.weapons.slice();
        const eq = equipped === "sword" || equipped === "bow" ? equipped : null;
        weapons = weapons.filter((w, index, list) => w !== eq && list.indexOf(w) === index);
        return { gold, items, weapons };
    }

    function normalizeEquipped(raw) {
        if (raw === "sword" || raw === "bow" || raw === null) return raw;
        return "sword";
    }

    function create() {
        const attributes = {};
        ATTRIBUTES.forEach((attr) => { attributes[attr.id] = START_ATTR; });
        const skills = {};
        const practice = {};
        SKILLS.forEach((skill) => {
            skills[skill.id] = START_SKILL;
            practice[skill.id] = 0;
        });
        const equipped = "sword";
        const pack = normalizePack(defaultPack(), equipped);
        return {
            level: 1,
            raised: 0,
            attributes,
            skills,
            practice,
            hp: 40,
            stamina: 60,
            magicka: 40,
            equipped,
            pack
        };
    }

    function normalize(raw) {
        const base = create();
        const src = raw && typeof raw === "object" ? raw : {};
        const attributes = {};
        ATTRIBUTES.forEach((attr) => {
            const bag = src.attributes || {};
            const value = bag[attr.id] == null ? START_ATTR : bag[attr.id];
            attributes[attr.id] = Math.round(clamp(value, 1, 100));
        });
        const skills = {};
        const practice = {};
        SKILLS.forEach((skill) => {
            const known = src.skills || {};
            const prog = src.practice || {};
            skills[skill.id] = Math.round(clamp(known[skill.id] == null ? START_SKILL : known[skill.id], 1, 100));
            practice[skill.id] = skills[skill.id] >= 100 ? 0 : clamp(prog[skill.id], 0, 100);
        });
        let raised = 0;
        SKILLS.forEach((skill) => { raised += Math.max(0, skills[skill.id] - START_SKILL); });
        if (Number.isFinite(Number(src.raised))) raised = Math.max(raised, Math.round(Number(src.raised)));
        const level = 1 + Math.floor(raised / RANKS_PER_LEVEL);
        const hero = { level, raised, attributes, skills, practice, hp: 40, stamina: 60, magicka: 40 };
        const hpMax = maxHealth(hero);
        const stMax = maxStamina(hero);
        const mgMax = maxMagicka(hero);
        hero.hp = clamp(src.hp == null ? hpMax : src.hp, 0, hpMax);
        hero.stamina = clamp(src.stamina == null ? stMax : src.stamina, 0, stMax);
        hero.magicka = clamp(src.magicka == null ? mgMax : src.magicka, 0, mgMax);
        const equipped = normalizeEquipped(src.equipped);
        hero.equipped = equipped;
        hero.pack = normalizePack(src.pack, equipped);
        return hero;
    }

    function attr(hero, id) {
        const bag = hero && hero.attributes;
        const n = bag ? Number(bag[id]) : START_ATTR;
        return Number.isFinite(n) ? n : START_ATTR;
    }

    function maxHealth(hero) {
        return Math.round(10 + attr(hero, "endurance") * 0.75);
    }

    function maxStamina(hero) {
        return Math.round(attr(hero, "endurance") + attr(hero, "strength") * 0.5);
    }

    function maxMagicka(hero) {
        return Math.round(attr(hero, "intelligence"));
    }

    function walkSpeed(hero) {
        const scale = 0.7 + attr(hero, "speed") / 40 * 0.3;
        return 4.6 * Math.max(0.7, Math.min(1.45, scale));
    }

    function staminaRegen(hero) {
        return 4 + attr(hero, "endurance") / 20;
    }

    function magickaRegen(hero) {
        return 2 + attr(hero, "willpower") / 20;
    }

    function needed(skillValue) {
        return 1 + Math.max(0, skillValue - START_SKILL) * 0.22;
    }

    function practice(raw, id) {
        const spec = SKILLS.find((skill) => skill.id === id);
        if (!spec) return null;
        const hero = normalize(raw);
        if (hero.skills[id] >= 100) {
            return { hero, gained: false, leveled: false, name: spec.name, value: 100, attribute: null };
        }
        hero.practice[id] += 0.28 + attr(hero, "luck") * 0.0015;
        let gained = false;
        let leveled = false;
        let attribute = null;
        while (hero.skills[id] < 100 && hero.practice[id] >= needed(hero.skills[id])) {
            hero.practice[id] -= needed(hero.skills[id]);
            hero.skills[id] += 1;
            hero.raised += 1;
            gained = true;
            const nextLevel = 1 + Math.floor(hero.raised / RANKS_PER_LEVEL);
            if (nextLevel > hero.level) {
                hero.level = nextLevel;
                leveled = true;
                attribute = spec.attr;
                hero.attributes[attribute] = Math.min(100, hero.attributes[attribute] + 1);
            }
        }
        if (hero.skills[id] >= 100) hero.practice[id] = 0;
        hero.hp = Math.min(hero.hp, maxHealth(hero));
        hero.stamina = Math.min(maxStamina(hero), hero.stamina);
        hero.magicka = Math.min(maxMagicka(hero), hero.magicka);
        return { hero, gained, leveled, name: spec.name, value: hero.skills[id], attribute };
    }

    function practiceUse(hero, use) {
        const spec = SKILLS.find((skill) => skill.use === use);
        if (!spec) return null;
        return practice(hero, spec.id);
    }

    function prefer(current, incoming) {
        const kept = normalize(current);
        const next = normalize(incoming);
        return next.raised >= kept.raised ? next : kept;
    }

    function signature(raw) {
        const hero = normalize(raw);
        const attrs = ATTRIBUTES.map((item) => hero.attributes[item.id]).join(",");
        const skills = SKILLS.map((item) => hero.skills[item.id]).join(",");
        const practiceRow = SKILLS.map((item) => Math.round(hero.practice[item.id] * 1000)).join(",");
        const pack = hero.pack || defaultPack();
        const items = (pack.items || []).map((item) => item.id + "x" + item.count).join(";");
        const weapons = (pack.weapons || []).join(",");
        return [
            hero.level,
            hero.raised,
            attrs,
            skills,
            practiceRow,
            Math.round(hero.hp),
            Math.round(hero.stamina),
            Math.round(hero.magicka),
            hero.equipped == null ? "-" : hero.equipped,
            Math.round(pack.gold || 0),
            weapons,
            items
        ].join("|");
    }

    return {
        ATTRIBUTES,
        SKILLS,
        create,
        normalize,
        defaultPack,
        normalizePack,
        practice,
        practiceUse,
        prefer,
        signature,
        needed,
        maxHealth,
        maxStamina,
        maxMagicka,
        walkSpeed,
        staminaRegen,
        magickaRegen
    };
});
