/** Player-wide render quality (village view). Stored in localStorage. */
(function (root) {
    const KEY = "village-gfx";

    function coarsePhone() {
        return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    }

    function load() {
        try {
            const saved = localStorage.getItem(KEY);
            if (saved === "low" || saved === "medium") return saved;
        } catch (err) { /* private mode */ }
        return "low";
    }

    function save(mode) {
        try {
            localStorage.setItem(KEY, mode === "low" ? "low" : "medium");
        } catch (err) { /* ignore */ }
    }

    function toggle() {
        const next = load() === "medium" ? "low" : "medium";
        save(next);
        return next;
    }

    function label(mode) {
        return mode === "medium" ? "Graphics: Medium" : "Graphics: Low";
    }

    root.GfxSettings = { KEY, load, save, toggle, label, defaultMode: load };
})(typeof window !== "undefined" ? window : globalThis);
