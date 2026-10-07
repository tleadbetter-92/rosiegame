const KEY = "the-print-shop-bag";

const COLOURS = [
    { id: "clay", name: "Clay", hex: "#c4512c" },
    { id: "ink", name: "Ink", hex: "#241f1b" },
    { id: "bone", name: "Bone", hex: "#c8b48a" },
    { id: "sage", name: "Sage", hex: "#3d6b56" },
    { id: "sea", name: "Sea", hex: "#2c5d73" },
    { id: "butter", name: "Butter", hex: "#d4a017" }
];

const MATERIALS = ["PLA matte", "PLA silk", "PETG"];

const PRODUCTS = [
    {
        id: "orbit-planter",
        name: "Orbit planter",
        price: 18,
        category: "Home",
        kind: "planter",
        featured: true,
        sizes: ["Small", "Medium", "Large"],
        blurb: "A low planter with soft rings. For a succulent, or a handful of pens."
    },
    {
        id: "ridge-vase",
        name: "Ridge vase",
        price: 24,
        category: "Home",
        kind: "vase",
        featured: true,
        sizes: ["Small", "Medium"],
        blurb: "Tall and narrow, with a vertical rib. One stem, or a few dried ones."
    },
    {
        id: "angle-stand",
        name: "Angle stand",
        price: 16,
        category: "Desk",
        kind: "stand",
        featured: false,
        sizes: ["Phone", "Tablet"],
        blurb: "A fixed lean for a phone or a small tablet."
    },
    {
        id: "door-hook",
        name: "Door hook",
        price: 12,
        category: "Hooks",
        kind: "hook",
        featured: false,
        sizes: ["Single", "Double"],
        blurb: "Sits over the top of a door. Headphones, a tote, a towel."
    },
    {
        id: "desk-plate",
        name: "Desk plate",
        price: 20,
        category: "Desk",
        kind: "plate",
        featured: true,
        sizes: ["Short", "Long"],
        blurb: "A plate for a desk. Type the name and we set it in the print.",
        extra: { id: "plateName", label: "Name on the plate", placeholder: "Your name", max: 16 }
    },
    {
        id: "cable-clips",
        name: "Cable clips",
        price: 9,
        category: "Desk",
        kind: "clips",
        featured: false,
        sizes: ["Pack of 4"],
        blurb: "Four clips that hold a cable along a desk edge."
    },
    {
        id: "facet-shade",
        name: "Facet shade",
        price: 36,
        category: "Home",
        kind: "shade",
        featured: true,
        sizes: ["Small", "Wide"],
        blurb: "A small shade for a low lamp. We check the fitting in the print file before making it."
    },
    {
        id: "lip-coasters",
        name: "Lip coasters",
        price: 14,
        category: "Home",
        kind: "coasters",
        featured: false,
        sizes: ["Set of 4"],
        blurb: "Four round coasters with a shallow lip, so a glass sits still."
    }
];

function money(amount) {
    return "£" + amount;
}

function esc(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function getBag() {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
        return Array.isArray(raw) ? raw : [];
    } catch {
        return [];
    }
}

function setBag(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    updateCounts();
}

function updateCounts() {
    const count = getBag().reduce((sum, item) => sum + item.qty, 0);
    document.querySelectorAll("[data-bag-count]").forEach((el) => {
        el.textContent = String(count);
    });
}

function artSvg(kind) {
    const shadow = '<ellipse cx="100" cy="172" rx="46" ry="8" fill="#1a1714" opacity="0.12"/>';
    const pictures = {
        planter: `${shadow}
            <path d="M46 78c8 48 18 70 54 74 36-4 46-26 54-74" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="2.5"/>
            <ellipse cx="100" cy="78" rx="56" ry="16" fill="none" stroke="currentColor" stroke-width="2.5"/>
            <path d="M52 102h96M56 124h88" fill="none" stroke="currentColor" stroke-width="1.6" opacity="0.75"/>`,
        vase: `${shadow}
            <path d="M78 50h44l8 16c12 30 16 68-2 96-18 10-42 10-60 0-18-28-14-66-2-96z" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="2.5"/>
            <path d="M88 74c6 22 6 46 2 74M112 74c-6 22-6 46-2 74" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.7"/>
            <ellipse cx="100" cy="50" rx="22" ry="7" fill="none" stroke="currentColor" stroke-width="2.5"/>`,
        stand: `${shadow}
            <path d="M52 150h108" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            <path d="M64 150 86 86h62" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
            <rect x="108" y="52" width="38" height="66" rx="5" transform="rotate(-18 127 85)" fill="currentColor" fill-opacity="0.2" stroke="currentColor" stroke-width="2.5"/>`,
        hook: `${shadow}
            <path d="M72 40v120" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
            <path d="M72 78h42c20 0 30 16 30 34 0 22-16 32-34 32" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>`,
        plate: `${shadow}
            <rect x="34" y="78" width="132" height="54" rx="6" fill="currentColor" fill-opacity="0.2" stroke="currentColor" stroke-width="2.5"/>
            <text class="plate-label" x="100" y="111" text-anchor="middle" font-size="16" font-family="Georgia, serif" fill="currentColor">Your name</text>`,
        clips: `${shadow}
            <path d="M46 72h26v42c0 16-26 16-26 0z" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="2.5"/>
            <path d="M87 72h26v42c0 16-26 16-26 0z" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="2.5"/>
            <path d="M128 72h26v42c0 16-26 16-26 0z" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="2.5"/>`,
        shade: `${shadow}
            <path d="M72 52h56l26 86H46z" fill="currentColor" fill-opacity="0.2" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
            <path d="M70 86h68M64 110h80" stroke="currentColor" stroke-width="1.5" opacity="0.7"/>
            <circle cx="100" cy="44" r="5" fill="currentColor"/>`,
        coasters: `${shadow}
            <circle cx="78" cy="92" r="28" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-width="2.5"/>
            <circle cx="122" cy="92" r="28" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-width="2.5"/>
            <circle cx="78" cy="128" r="28" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-width="2.5"/>
            <circle cx="122" cy="128" r="28" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-width="2.5"/>`
    };

    return `<svg viewBox="0 0 200 200" aria-hidden="true">${pictures[kind] || pictures.planter}</svg>`;
}

function cardHtml(product) {
    const colour = COLOURS[0];
    return `<article class="card">
        <a href="product.html?id=${product.id}">
            <div class="art" style="color:${colour.hex}">${artSvg(product.kind)}</div>
            <h2>${esc(product.name)}</h2>
            <p class="meta"><span>${esc(product.category)}</span><span>${money(product.price)}</span></p>
        </a>
    </article>`;
}

function renderGrid(root, products) {
    root.innerHTML = products.map(cardHtml).join("");
}

function bindFilters() {
    const grid = document.querySelector("[data-grid]");
    const bar = document.querySelector("[data-filters]");
    if (!grid || !bar) return;

    const paint = (category) => {
        const list = category === "All" ? PRODUCTS : PRODUCTS.filter((item) => item.category === category);
        renderGrid(grid, list);
    };

    bar.addEventListener("click", (event) => {
        const button = event.target.closest("[data-filter]");
        if (!button) return;
        bar.querySelectorAll("[data-filter]").forEach((el) => {
            el.classList.toggle("is-on", el === button);
        });
        paint(button.dataset.filter);
    });

    paint("All");
}

function renderFeatured() {
    const root = document.querySelector("[data-featured]");
    if (!root) return;
    renderGrid(root, PRODUCTS.filter((item) => item.featured));
}

function renderProduct(root) {
    const id = new URLSearchParams(location.search).get("id");
    const product = PRODUCTS.find((item) => item.id === id);
    if (!product) {
        root.innerHTML = `<div class="page-head"><h1>That piece isn’t in the shop.</h1><p><a href="shop.html">Back to the shop</a></p></div>`;
        return;
    }

    document.title = `${product.name} — The Print Shop`;
    let colour = COLOURS[0];
    let size = product.sizes[0];
    let material = MATERIALS[0];
    let qty = 1;

    const sizePills = product.sizes.length > 1
        ? `<p class="option-label">Size</p>
           <div class="pills" data-sizes>
             ${product.sizes.map((item, index) => `<button type="button" class="pill${index === 0 ? " is-on" : ""}" data-size="${esc(item)}">${esc(item)}</button>`).join("")}
           </div>`
        : "";

    const extraField = product.extra
        ? `<label class="field">
             <span>${esc(product.extra.label)}</span>
             <input name="extra" maxlength="${product.extra.max}" placeholder="${esc(product.extra.placeholder)}" autocomplete="off">
           </label>`
        : "";

    root.innerHTML = `<div class="product-layout">
        <div>
            <div class="art" style="color:${colour.hex}">${artSvg(product.kind)}</div>
        </div>
        <div>
            <p class="eyebrow">${esc(product.category)}</p>
            <h1>${esc(product.name)}</h1>
            <p class="price">${money(product.price)}</p>
            <p class="quiet">Printed after you order.</p>
            <p>${esc(product.blurb)}</p>
            <p class="option-label">Colour <span class="choice-name" data-colour-name>${colour.name}</span></p>
            <div class="swatches">
                ${COLOURS.map((item, index) => `<button type="button" class="swatch${index === 0 ? " is-on" : ""}" data-colour="${item.id}" style="background:${item.hex}" aria-label="${esc(item.name)}" aria-pressed="${index === 0 ? "true" : "false"}"></button>`).join("")}
            </div>
            ${sizePills}
            <p class="option-label">Material <span class="choice-name" data-material-name>${material}</span></p>
            <div class="pills" data-materials>
                ${MATERIALS.map((item, index) => `<button type="button" class="pill${index === 0 ? " is-on" : ""}" data-material="${esc(item)}">${esc(item)}</button>`).join("")}
            </div>
            ${extraField}
            <label class="field">
                <span>Note for the studio</span>
                <textarea name="note" placeholder="A wider base, a shorter hook, no holes…"></textarea>
            </label>
            <div class="line-actions" style="margin-top:16px">
                <div class="qty" aria-label="Quantity">
                    <button type="button" data-qty-dec aria-label="Fewer">−</button>
                    <span data-qty>1</span>
                    <button type="button" data-qty-inc aria-label="More">+</button>
                </div>
                <button type="button" class="btn" data-add>Add to bag</button>
            </div>
            <p class="added-note" data-added hidden>Added to your bag. <a href="bag.html">View bag</a></p>
            <p class="studio-note">Colour, size, and material are chosen here. If you want the shape changed, leave a note. That edit is done in the 3D printing software, then checked with you before anything is printed.</p>
        </div>
    </div>`;

    const art = root.querySelector(".art");
    const colourName = root.querySelector("[data-colour-name]");
    const materialName = root.querySelector("[data-material-name]");
    const qtyLabel = root.querySelector("[data-qty]");
    const added = root.querySelector("[data-added]");
    const extraInput = root.querySelector('input[name="extra"]');
    const noteInput = root.querySelector('textarea[name="note"]');

    root.querySelectorAll("[data-colour]").forEach((button) => {
        button.addEventListener("click", () => {
            colour = COLOURS.find((item) => item.id === button.dataset.colour);
            art.style.color = colour.hex;
            colourName.textContent = colour.name;
            root.querySelectorAll("[data-colour]").forEach((el) => {
                const on = el === button;
                el.classList.toggle("is-on", on);
                el.setAttribute("aria-pressed", on ? "true" : "false");
            });
        });
    });

    root.querySelectorAll("[data-size]").forEach((button) => {
        button.addEventListener("click", () => {
            size = button.dataset.size;
            root.querySelectorAll("[data-size]").forEach((el) => el.classList.toggle("is-on", el === button));
        });
    });

    root.querySelectorAll("[data-material]").forEach((button) => {
        button.addEventListener("click", () => {
            material = button.dataset.material;
            materialName.textContent = material;
            root.querySelectorAll("[data-material]").forEach((el) => el.classList.toggle("is-on", el === button));
        });
    });

    if (extraInput) {
        extraInput.addEventListener("input", () => {
            const label = art.querySelector(".plate-label");
            if (label) label.textContent = extraInput.value.trim() || "Your name";
        });
    }

    root.querySelector("[data-qty-dec]").addEventListener("click", () => {
        qty = Math.max(1, qty - 1);
        qtyLabel.textContent = String(qty);
    });

    root.querySelector("[data-qty-inc]").addEventListener("click", () => {
        qty += 1;
        qtyLabel.textContent = String(qty);
    });

    root.querySelector("[data-add]").addEventListener("click", () => {
        const extra = extraInput ? extraInput.value.trim() : "";
        const note = noteInput.value.trim();
        const key = [product.id, colour.id, size, material, extra, note].join("|");
        const bag = getBag();
        const existing = bag.find((item) => item.key === key);
        if (existing) existing.qty += qty;
        else {
            bag.push({
                key,
                id: product.id,
                name: product.name,
                kind: product.kind,
                price: product.price,
                colour: colour.name,
                colourHex: colour.hex,
                size,
                material,
                extra,
                note,
                qty
            });
        }
        setBag(bag);
        added.hidden = false;
    });
}

function lineHtml(item) {
    const detail = [item.colour, item.size, item.material].filter(Boolean).join(" · ");
    const extra = item.extra ? `<p class="quiet">Name: ${esc(item.extra)}</p>` : "";
    const note = item.note ? `<p class="quiet">Note: ${esc(item.note)}</p>` : "";
    return `<article class="line" data-key="${esc(item.key)}">
        <div class="art" style="color:${esc(item.colourHex)}">${artSvg(item.kind)}</div>
        <div>
            <h2>${esc(item.name)}</h2>
            <p class="quiet">${esc(detail)}</p>
            ${extra}
            ${note}
            <div class="line-actions">
                <div class="qty">
                    <button type="button" data-dec aria-label="Fewer ${esc(item.name)}">−</button>
                    <span>${item.qty}</span>
                    <button type="button" data-inc aria-label="More ${esc(item.name)}">+</button>
                </div>
                <button type="button" class="text-btn" data-remove>Remove</button>
            </div>
        </div>
        <strong>${money(item.price * item.qty)}</strong>
    </article>`;
}

function paintBag(root) {
    const bag = getBag();
    if (!bag.length) {
        root.innerHTML = `<div class="empty">
            <p class="quiet">Choose a piece and a colour, then add it here.</p>
            <p><a class="btn" href="shop.html">Browse the shop</a></p>
        </div>`;
        return;
    }

    const total = bag.reduce((sum, item) => sum + item.price * item.qty, 0);
    root.innerHTML = `<div class="split">
        <div>${bag.map(lineHtml).join("")}</div>
        <aside class="panel">
            <h2>Summary</h2>
            <p class="summary-row"><span>Pieces</span><span>${bag.reduce((sum, item) => sum + item.qty, 0)}</span></p>
            <p class="summary-row total"><span>Total</span><span>${money(total)}</span></p>
            <p class="quiet">Preview total. Payment is added later.</p>
            <p><a class="btn full" href="checkout.html">Continue to checkout</a></p>
        </aside>
    </div>`;
}

function bindBag(root) {
    root.addEventListener("click", (event) => {
        const row = event.target.closest("[data-key]");
        if (!row) return;
        const bag = getBag();
        const index = bag.findIndex((item) => item.key === row.dataset.key);
        if (index < 0) return;
        if (event.target.closest("[data-inc]")) bag[index].qty += 1;
        else if (event.target.closest("[data-dec]")) {
            bag[index].qty -= 1;
            if (bag[index].qty <= 0) bag.splice(index, 1);
        } else if (event.target.closest("[data-remove]")) bag.splice(index, 1);
        else return;
        setBag(bag);
        paintBag(root);
    });
    paintBag(root);
}

function renderCheckout(root) {
    const paint = () => {
        const bag = getBag();
        const total = bag.reduce((sum, item) => sum + item.price * item.qty, 0);
        const lines = bag.length
            ? bag.map((item) => `<p class="summary-row"><span>${esc(item.name)} × ${item.qty}</span><span>${money(item.price * item.qty)}</span></p>`).join("")
            : `<p class="quiet">Your bag is empty. The form is here so you can see checkout.</p>`;

        root.innerHTML = `<div class="split">
            <form class="panel" data-order-form>
                <h2>Your details</h2>
                <p class="form-error" data-form-error hidden>Add a piece from the shop before this preview order.</p>
                <label class="field"><span>Name</span><input name="name" autocomplete="name" required></label>
                <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
                <label class="field"><span>Address</span><input name="address" autocomplete="street-address" required></label>
                <label class="field"><span>City</span><input name="city" autocomplete="address-level2" required></label>
                <label class="field"><span>Postcode</span><input name="postcode" autocomplete="postal-code" required></label>
                <p><button class="btn" type="submit">Place preview order</button></p>
            </form>
            <aside class="panel">
                <h2>Order</h2>
                ${lines}
                <p class="summary-row total"><span>Total</span><span>${money(total)}</span></p>
                <p class="quiet">Nothing is charged on this preview.</p>
            </aside>
        </div>`;

        root.querySelector("[data-order-form]").addEventListener("submit", (event) => {
            event.preventDefault();
            if (!getBag().length) {
                root.querySelector("[data-form-error]").hidden = false;
                return;
            }
            const name = new FormData(event.target).get("name").toString().trim();
            root.innerHTML = `<div class="confirm panel">
                <p class="eyebrow">Preview complete</p>
                <h2>Thanks${name ? `, ${esc(name)}` : ""}.</h2>
                <p>That’s the checkout, as far as this preview goes. When payment is added, this is where an order would be placed.</p>
                <p><a class="btn" href="shop.html">Back to the shop</a></p>
            </div>`;
        });
    };

    paint();
}

document.addEventListener("DOMContentLoaded", () => {
    updateCounts();
    renderFeatured();
    bindFilters();
    const product = document.querySelector("[data-product]");
    if (product) renderProduct(product);
    const bag = document.querySelector("[data-bag]");
    if (bag) bindBag(bag);
    const checkout = document.querySelector("[data-checkout]");
    if (checkout) renderCheckout(checkout);
});
