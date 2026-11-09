(function () {
    if (document.getElementById("go-menu")) return;
    const src = document.currentScript && document.currentScript.src;
    const base = src ? src.replace(/[^/]+$/, "") : "";
    const style = document.createElement("style");
    style.textContent = [
        "#go-menu { position: fixed; top: 8px; right: 10px; z-index: 40; font: 13px/1.3 system-ui, sans-serif; }",
        "#go-menu-btn {",
        "  display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 3px;",
        "  width: 28px; height: 28px; padding: 0; margin: 0;",
        "  border: 1px solid #c4a574; border-radius: 6px;",
        "  background: rgba(239, 226, 204, 0.94); color: #1c140c; cursor: pointer;",
        "}",
        "#go-menu-btn span { display: block; width: 12px; height: 2px; background: #1c140c; border-radius: 1px; }",
        "#go-menu-list {",
        "  position: absolute; top: calc(100% + 6px); right: 0; min-width: 132px;",
        "  margin: 0; padding: 4px; border: 1px solid #c4a574; border-radius: 8px;",
        "  background: rgba(28, 20, 12, 0.94);",
        "  display: flex; flex-direction: column; gap: 2px;",
        "}",
        "#go-menu-list[hidden] { display: none; }",
        "#go-menu-list a {",
        "  display: block; padding: 7px 10px; border-radius: 6px;",
        "  color: #f6edd8; text-decoration: none;",
        "}",
        "#go-menu-list a:hover { background: #5c4030; }",
        "body.walking #go-menu { display: none; }"
    ].join("\n");
    document.head.appendChild(style);
    const wrap = document.createElement("div");
    wrap.id = "go-menu";
    wrap.innerHTML = '<button type="button" id="go-menu-btn" aria-label="Pages" aria-expanded="false"><span></span><span></span><span></span></button>'
        + '<div id="go-menu-list" hidden>'
        + '<a href="' + base + 'developer.html">Dev page</a>'
        + '<a href="' + base + 'index.html">Game</a>'
        + '<a href="' + base + 'index.html?playtest=1">Play test</a>'
        + "</div>";
    const mount = function () {
        document.body.appendChild(wrap);
        const btn = document.getElementById("go-menu-btn");
        const list = document.getElementById("go-menu-list");
        btn.addEventListener("click", function (event) {
            event.stopPropagation();
            const open = list.hidden;
            list.hidden = !open;
            btn.setAttribute("aria-expanded", open ? "true" : "false");
        });
        document.addEventListener("click", function (event) {
            if (wrap.contains(event.target)) return;
            list.hidden = true;
            btn.setAttribute("aria-expanded", "false");
        });
    };
    if (document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount);
})();
