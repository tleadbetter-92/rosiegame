(function (global) {
    function BattleView(canvas) {
        const scroller = canvas.closest(".map-scroll");
        const world = canvas.parentElement;
        const TILE = global.BattleMap.TILE;
        const mapW = global.BattleMap.COLS * TILE;
        const mapH = global.BattleMap.ROWS * TILE;
        let zoom = 1;
        let stickToFit = true;

        function viewSize() {
            return {
                w: Math.max(1, scroller.clientWidth),
                h: Math.max(1, scroller.clientHeight)
            };
        }

        function fitZoom() {
            const v = viewSize();
            return Math.min(1, (v.w - 4) / mapW, (v.h - 4) / mapH);
        }

        function layout() {
            const v = viewSize();
            world.style.width = Math.max(v.w, Math.round(mapW * zoom)) + "px";
            world.style.height = Math.max(v.h, Math.round(mapH * zoom)) + "px";
            canvas.style.width = v.w + "px";
            canvas.style.height = v.h + "px";
            canvas.width = v.w;
            canvas.height = v.h;
        }

        function origin() {
            const v = viewSize();
            return {
                v: v,
                padX: Math.max(0, (v.w - mapW * zoom) / 2),
                padY: Math.max(0, (v.h - mapH * zoom) / 2)
            };
        }

        function applyZoom(next, clientX, clientY) {
            const minZoom = fitZoom();
            const before = origin();
            const rect = scroller.getBoundingClientRect();
            const viewX = clientX == null ? before.v.w / 2 : clientX - rect.left;
            const viewY = clientY == null ? before.v.h / 2 : clientY - rect.top;
            const worldX = (scroller.scrollLeft + viewX - before.padX) / zoom;
            const worldY = (scroller.scrollTop + viewY - before.padY) / zoom;
            zoom = Math.max(minZoom, Math.min(1, next));
            stickToFit = zoom <= minZoom + 0.001;
            layout();
            const after = origin();
            if (stickToFit) {
                scroller.scrollLeft = 0;
                scroller.scrollTop = 0;
                return;
            }
            scroller.scrollLeft = worldX * zoom - viewX + after.padX;
            scroller.scrollTop = worldY * zoom - viewY + after.padY;
        }

        function zoomAbout(nextZoom, worldX, worldY, clientX, clientY) {
            const minZoom = fitZoom();
            zoom = Math.max(minZoom, Math.min(1, nextZoom));
            stickToFit = zoom <= minZoom + 0.001;
            layout();
            const after = origin();
            const rect = scroller.getBoundingClientRect();
            if (stickToFit) {
                scroller.scrollLeft = 0;
                scroller.scrollTop = 0;
                return;
            }
            scroller.scrollLeft = worldX * zoom - (clientX - rect.left) + after.padX;
            scroller.scrollTop = worldY * zoom - (clientY - rect.top) + after.padY;
        }

        function worldAt(clientX, clientY) {
            const rect = scroller.getBoundingClientRect();
            const o = origin();
            return {
                x: (scroller.scrollLeft + (clientX - rect.left) - o.padX) / zoom,
                y: (scroller.scrollTop + (clientY - rect.top) - o.padY) / zoom
            };
        }

        function zoomBy(factor) {
            const rect = scroller.getBoundingClientRect();
            const clientX = rect.left + rect.width / 2;
            const clientY = rect.top + rect.height / 2;
            const world = worldAt(clientX, clientY);
            zoomAbout(zoom * factor, world.x, world.y, clientX, clientY);
        }

        function pan(dx, dy) {
            if (stickToFit) return;
            const v = viewSize();
            const maxX = Math.max(0, Math.round(mapW * zoom) - v.w);
            const maxY = Math.max(0, Math.round(mapH * zoom) - v.h);
            const stepX = Math.max(28, Math.round(v.w * 0.14));
            const stepY = Math.max(28, Math.round(v.h * 0.14));
            scroller.scrollLeft = Math.max(0, Math.min(maxX, scroller.scrollLeft + dx * stepX));
            scroller.scrollTop = Math.max(0, Math.min(maxY, scroller.scrollTop + dy * stepY));
        }

        let keysClaimed = false;
        const dragPans = !!(canvas.dataset && canvas.dataset.dragPan === "yes");
        const pointers = {};
        let drag = null;
        let pinch = null;
        let suppressClick = false;

        function pointerList() {
            return Object.keys(pointers).map(function (id) { return pointers[id]; });
        }

        function pinchSpan() {
            const pts = pointerList();
            if (pts.length < 2) return null;
            return {
                dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
                x: (pts[0].x + pts[1].x) / 2,
                y: (pts[0].y + pts[1].y) / 2
            };
        }

        scroller.addEventListener("pointerdown", function (event) {
            if (event.pointerType === "mouse" && event.button !== 0) return;
            pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
            suppressClick = false;
            if (pointerList().length >= 2) {
                drag = null;
                pinch = pinchSpan();
                return;
            }
            if (!dragPans) return;
            drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
        });

        scroller.addEventListener("pointermove", function (event) {
            if (!pointers[event.pointerId]) return;
            pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
            if (pointerList().length >= 2 && pinch) {
                const next = pinchSpan();
                if (!next) return;
                const world = worldAt(pinch.x, pinch.y);
                const factor = next.dist / pinch.dist;
                zoomAbout(zoom * factor, world.x, world.y, next.x, next.y);
                pinch = next;
                event.preventDefault();
                return;
            }
            if (!drag || event.pointerId !== drag.id) return;
            const dx = event.clientX - drag.x;
            const dy = event.clientY - drag.y;
            if (!drag.moved && Math.hypot(dx, dy) < 10) return;
            drag.moved = true;
            drag.x = event.clientX;
            drag.y = event.clientY;
            if (stickToFit) return;
            scroller.scrollLeft -= dx;
            scroller.scrollTop -= dy;
            event.preventDefault();
        });

        function endPointer(event) {
            delete pointers[event.pointerId];
            if (pointerList().length < 2) pinch = null;
            if (!drag || event.pointerId !== drag.id) return;
            if (drag.moved) suppressClick = true;
            drag = null;
        }

        scroller.addEventListener("pointerup", endPointer);
        scroller.addEventListener("pointercancel", endPointer);

        const zoomBar = document.createElement("div");
        zoomBar.className = "zoom-bar";
        zoomBar.innerHTML = '<button type="button" data-zoom="in" aria-label="Zoom in">+</button><button type="button" data-zoom="out" aria-label="Zoom out">−</button>';
        scroller.parentElement.appendChild(zoomBar);
        zoomBar.addEventListener("click", function (event) {
            const button = event.target.closest("button");
            if (!button) return;
            zoomBy(button.dataset.zoom === "in" ? 1.4 : 1 / 1.4);
        });

        function tileFromEvent(event) {
            const rect = scroller.getBoundingClientRect();
            const o = origin();
            const worldX = (scroller.scrollLeft + (event.clientX - rect.left) - o.padX) / zoom;
            const worldY = (scroller.scrollTop + (event.clientY - rect.top) - o.padY) / zoom;
            return {
                c: Math.floor(worldX / TILE),
                r: Math.floor(worldY / TILE)
            };
        }

        function beginFrame(ctx) {
            const v = viewSize();
            if (canvas.width !== v.w || canvas.height !== v.h) layout();
            const o = origin();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.imageSmoothingEnabled = false;
            ctx.setTransform(zoom, 0, 0, zoom, o.padX - scroller.scrollLeft, o.padY - scroller.scrollTop);
            const x0 = (scroller.scrollLeft - o.padX) / zoom;
            const y0 = (scroller.scrollTop - o.padY) / zoom;
            const x1 = x0 + v.w / zoom;
            const y1 = y0 + v.h / zoom;
            return {
                c0: Math.max(0, Math.floor(x0 / TILE) - 1),
                r0: Math.max(0, Math.floor(y0 / TILE) - 1),
                c1: Math.min(global.BattleMap.COLS - 1, Math.ceil(x1 / TILE) + 1),
                r1: Math.min(global.BattleMap.ROWS - 1, Math.ceil(y1 / TILE) + 1)
            };
        }

        function ensure() {
            if (stickToFit) applyZoom(fitZoom());
        }

        scroller.addEventListener("wheel", function (event) {
            event.preventDefault();
            const factor = Math.exp(-event.deltaY * 0.0015);
            stickToFit = false;
            applyZoom(zoom * factor, event.clientX, event.clientY);
        }, { passive: false });

        window.addEventListener("resize", function () {
            applyZoom(stickToFit ? fitZoom() : zoom);
        });

        window.addEventListener("keydown", function (event) {
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            const tag = event.target && event.target.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
            const key = event.key.toLowerCase();
            let dx = 0;
            let dy = 0;
            if (key === "arrowleft") dx = -1;
            else if (key === "arrowright") dx = 1;
            else if (key === "arrowup") dy = -1;
            else if (key === "arrowdown") dy = 1;
            else if (!keysClaimed && key === "a") dx = -1;
            else if (!keysClaimed && key === "d") dx = 1;
            else if (!keysClaimed && key === "w") dy = -1;
            else if (!keysClaimed && key === "s") dy = 1;
            else return;
            if (stickToFit) return;
            event.preventDefault();
            pan(dx, dy);
        });

        applyZoom(fitZoom());

        return {
            applyZoom: applyZoom,
            ensure: ensure,
            tileFromEvent: tileFromEvent,
            beginFrame: beginFrame,
            claimKeys: function (claimed) { keysClaimed = !!claimed; },
            fingers: function () { return pointerList().length; },
            swallowClick: function () {
                if (!suppressClick) return false;
                suppressClick = false;
                return true;
            }
        };
    }

    global.BattleView = BattleView;
})(window);
