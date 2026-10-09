(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.Clock = api;
})(typeof self !== "undefined" ? self : this, function () {
    const DAY_MS = 40 * 60 * 1000;

    function hours(now) {
        const t = ((now % DAY_MS) + DAY_MS) % DAY_MS;
        return t / DAY_MS * 24;
    }

    function day(now) {
        return Math.floor(now / DAY_MS);
    }

    function darkness(now) {
        const h = hours(now);
        if (h >= 23 || h < 5) return 1;
        if (h < 6.5) return 1 - (h - 5) / 1.5;
        if (h >= 21.5) return (h - 21.5) / 1.5;
        return 0;
    }

    function label(now) {
        const h = hours(now);
        const hh = Math.floor(h);
        const mm = Math.floor((h - hh) * 60);
        return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
    }

    function asleepHours(h) {
        return h >= 1 && h < 5;
    }

    function workerAsleep(index, count, now) {
        const h = hours(now);
        return h < 4;
    }

    function soldierAsleep(index, count, now) {
        if (index < 0 || count <= 0) return false;
        const quota = asleepHours(hours(now)) ? Math.floor(count * 0.8) : Math.floor(count * 0.2);
        return index < quota;
    }

    function shopOpen(now) {
        const h = hours(now);
        return h >= 6 && h < 23;
    }

    return { DAY_MS, hours, day, darkness, label, asleepHours, workerAsleep, soldierAsleep, shopOpen };
});
