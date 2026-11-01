
/* =====================================================
   DRESS DREAMS BY NIHARA
   SUPABASE STOREFRONT + PRODUCT DETAILS POPUP
   ===================================================== */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SIZE_LIST = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const KEY_CART = 'dd-cart-v3';
const KEY_WISH = 'dd-wishlist-v1';

const money = n =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(n);

const grid = document.getElementById('productGrid');

let products = [];
let categories = [];
let selected = {};

let cart = JSON.parse(localStorage.getItem(KEY_CART) || '[]');
let wishlist = JSON.parse(localStorage.getItem(KEY_WISH) || '[]');

function esc(s = '') {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

function toast(message) {
    const t = document.getElementById('toast');
    if (!t) return;

    t.textContent = message;
    t.classList.add('show');

    setTimeout(() => t.classList.remove('show'), 2200);
}

function totalStock(p) {
    return p.variants.reduce(
        (n, v) => n + Number(v.stock || 0),
        0
    );
}

/* =====================================================
   CATEGORY FILTERS
   ===================================================== */

function renderCategories() {
    const filter = document.getElementById('categoryFilter');

    if (!filter) return;

    const current = filter.value;

    filter.innerHTML =
        '<option value="All">All pieces</option>' +
        categories.map(c =>
            `<option value="${esc(c.name)}">${esc(c.name)}</option>`
        ).join('');

    if ([...filter.options].some(o => o.value === current)) {
        filter.value = current;
    }
}

/* =====================================================
   PRODUCT CATALOGUE
   ===================================================== */

function renderProducts() {
    if (!grid) return;

    const term = (
        document.getElementById('productSearch')?.value || ''
    ).trim().toLowerCase();

    const category =
        document.getElementById('categoryFilter')?.value || 'All';

    const list = products.filter(p =>
        (category === 'All' || p.category === category) &&
        (
            p.name.toLowerCase().includes(term) ||
            p.category.toLowerCase().includes(term)
        )
    );

    grid.innerHTML = list.length
        ? list.map(p => {

            const variants = p.variants || [];

            const colour =
                selected[p.id]?.colour ||
                variants.find(v => v.stock > 0)?.colour ||
                variants[0]?.colour ||
                '';

            const sizes = SIZE_LIST.filter(s =>
                variants.some(v =>
                    v.colour === colour &&
                    v.size === s &&
                    v.stock > 0
                )
            );

            const size = sizes.includes(selected[p.id]?.size)
                ? selected[p.id].size
                : sizes[0] || '';

            const colours = [
                ...new Set(variants.map(v => v.colour))
            ];

            return `
                <article class="product-card"
                    data-product-card="${esc(p.id)}">

                    <div class="product-image">

                        <img
                            src="${esc(p.image)}"
                            alt="${esc(p.name)}"
                            loading="lazy"
                        >

                        <span class="product-tag">
                            DRESS DREAMS
                        </span>

                        <button
                            class="wish-button"
                            data-wish="${esc(p.id)}"
                            aria-label="Wishlist"
                            type="button">
                            ${wishlist.includes(p.id) ? '♥' : '♡'}
                        </button>

                    </div>

                    <div class="product-info">

                        <h3>${esc(p.name)}</h3>

                        <div class="product-meta">
                            <span>${esc(p.category)}</span>
                            <strong>${money(p.price)}</strong>
                        </div>

                        <div class="variant-label">
                            COLOUR: <b>${esc(colour || 'Unavailable')}</b>
                        </div>

                        <div class="product-color-row">

                            ${colours.map(c => `
                                <button
                                    type="button"
                                    class="color-chip ${c === colour ? 'selected' : ''}"
                                    data-color="${encodeURIComponent(c)}"
                                    data-product="${esc(p.id)}">
                                    ${esc(c)}
                                </button>
                            `).join('')}

                        </div>

                        <div class="variant-label">
                            SELECT SIZE
                        </div>

                        <div class="product-size-row">

                            ${SIZE_LIST.map(s => {

                                const available = variants.some(v =>
                                    v.colour === colour &&
                                    v.size === s &&
                                    v.stock > 0
                                );

                                return `
                                    <button
                                        type="button"
                                        class="size-chip ${size === s ? 'selected' : ''}"
                                        data-size="${s}"
                                        data-product="${esc(p.id)}"
                                        ${!available ? 'disabled' : ''}>
                                        ${s}
                                    </button>
                                `;

                            }).join('')}

                        </div>

                        <div class="stock-note">
                            ${totalStock(p) > 0
                                ? `${totalStock(p)} pieces available across colours`
                                : 'Currently sold out'}
                        </div>

                        <button
                            type="button"
                            class="add-button"
                            data-add="${esc(p.id)}"
                            ${!size ? 'disabled' : ''}>
                            ADD TO BAG +
                        </button>

                    </div>
                </article>
            `;

        }).join('')

        : '<p>No pieces found. Please check back soon.</p>';
}

/* =====================================================
   SUPABASE CONNECTION AND PRODUCT LOADING
   ===================================================== */

if (
    !window.DD_SUPABASE_URL ||
    !window.DD_SUPABASE_ANON_KEY ||
    window.DD_SUPABASE_ANON_KEY.includes('PASTE_')
) {
    if (grid) {
        grid.innerHTML =
            '<p>Store catalogue is being connected. Please check back soon.</p>';
    }

} else {

    const db = createClient(
        window.DD_SUPABASE_URL,
        window.DD_SUPABASE_ANON_KEY
    );

    try {

        const [cr, pr] = await Promise.all([

            db.from('categories')
                .select('id,name')
                .eq('is_active', true)
                .order('name'),

            db.from('products')
                .select(`
                    id,
                    name,
                    description,
                    price,
                    images,
                    category_id,
                    categories(name),
                    product_variants(colour,size,stock)
                `)
                .eq('is_active', true)
                .order('created_at', { ascending: false })

        ]);

        if (cr.error) throw cr.error;
        if (pr.error) throw pr.error;

        categories = cr.data || [];

        products = (pr.data || []).map(p => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            category: p.categories?.name || '',
            price: Number(p.price),
            image: p.images?.[0] || '',

            variants: (p.product_variants || []).map(v => ({
                colour: v.colour,
                size: v.size,
                stock: Number(v.stock || 0)
            }))
        }));

        renderCategories();
        renderProducts();

    } catch (error) {

        if (grid) {
            grid.innerHTML =
                '<p>We could not load the collection right now. Please refresh in a moment.</p>';
        }

        console.error('Supabase catalogue error:', error);
    }
}

/* =====================================================
   SHOPPING CART
   ===================================================== */

function saveCart() {
    localStorage.setItem(KEY_CART, JSON.stringify(cart));
    renderCart();
}

function renderCart() {

    const count = document.getElementById('cartCount');
    const subtotal = document.getElementById('cartSubtotal');
    const items = document.getElementById('cartItems');

    if (!count || !subtotal || !items) return;

    count.textContent = cart.reduce(
        (a, x) => a + x.qty,
        0
    );

    subtotal.textContent = money(
        cart.reduce((a, x) => a + x.price * x.qty, 0)
    );

    items.innerHTML = cart.length

        ? cart.map(i => `

            <div class="cart-row">

                <img src="${esc(i.image)}" alt="">

                <div>

                    <h4>${esc(i.name)}</h4>

                    <p>
                        ${esc(i.color)} · Size ${esc(i.size)}
                        · ${money(i.price)}
                    </p>

                    <div class="qty-controls">

                        <button
                            data-qty="${esc(i.id)}"
                            data-color="${encodeURIComponent(i.color)}"
                            data-size="${esc(i.size)}"
                            data-change="-1">−</button>

                        <span>${i.qty}</span>

                        <button
                            data-qty="${esc(i.id)}"
                            data-color="${encodeURIComponent(i.color)}"
                            data-size="${esc(i.size)}"
                            data-change="1">+</button>

                    </div>

                </div>

                <button
                    class="remove-item"
                    data-remove="${esc(i.id)}"
                    data-color="${encodeURIComponent(i.color)}"
                    data-size="${esc(i.size)}">
                    ×
                </button>

            </div>

        `).join('')

        : '<p class="empty-cart">Your bag is waiting for something beautiful.</p>';
}

function openCart(open) {

    document.getElementById('cartDrawer')
        ?.classList.toggle('open', open);

    document.getElementById('drawerBackdrop')
        ?.classList.toggle('open', open);

    document.getElementById('cartDrawer')
        ?.setAttribute('aria-hidden', String(!open));
}

renderCart();

/* =====================================================
   PRODUCT CARD INTERACTIONS
   ===================================================== */

grid?.addEventListener('click', e => {

    const colourButton = e.target.closest('[data-color][data-product]');

    if (colourButton) {

        const id = colourButton.dataset.product;

        selected[id] = {
            colour: decodeURIComponent(colourButton.dataset.color),
            size: ''
        };

        renderProducts();
        return;
    }

    const sizeButton = e.target.closest('[data-size][data-product]');

    if (sizeButton) {

        const id = sizeButton.dataset.product;
        const p = products.find(x => x.id === id);

        const colour =
            selected[id]?.colour ||
            p?.variants[0]?.colour;

        selected[id] = {
            colour,
            size: sizeButton.dataset.size
        };

        renderProducts();
        return;
    }

    const addButton = e.target.closest('[data-add]');

    if (addButton) {

        const p = products.find(x => x.id === addButton.dataset.add);

        if (!p) return;

        const choice = selected[p.id] || {};

        const colour =
            choice.colour ||
            p.variants.find(v => v.stock > 0)?.colour;

        const size = choice.size ||
            SIZE_LIST.find(s =>
                p.variants.some(v =>
                    v.colour === colour &&
                    v.size === s &&
                    v.stock > 0
                )
            );

        const variant = p.variants.find(v =>
            v.colour === colour && v.size === size
        );

        if (!variant || variant.stock < 1) {
            toast('Please select an available colour and size.');
            return;
        }

        const item = cart.find(x =>
            x.id === p.id &&
            x.color === colour &&
            x.size === size
        );

        if (item) {

            if (item.qty >= variant.stock) {
                toast('Available stock limit reached.');
                return;
            }

            item.qty++;

        } else {

            cart.push({
                id: p.id,
                name: p.name,
                price: p.price,
                image: p.image,
                color: colour,
                size,
                qty: 1
            });
        }

        saveCart();
        toast(`${p.name} added to your bag.`);
        return;
    }

    const wishButton = e.target.closest('[data-wish]');

    if (wishButton) {

        const id = wishButton.dataset.wish;

        wishlist = wishlist.includes(id)
            ? wishlist.filter(x => x !== id)
            : [...wishlist, id];

        localStorage.setItem(KEY_WISH, JSON.stringify(wishlist));

        renderProducts();
        toast('Wishlist updated.');
        return;
    }

    // Clicking anywhere else on a product opens its details.
    const card = e.target.closest('[data-product-card]');

    if (card) {
        openProductDetails(card.dataset.productCard);
    }

});

/* =====================================================
   CART QUANTITY AND REMOVE BUTTONS
   ===================================================== */

document.getElementById('cartItems')?.addEventListener('click', e => {

    const quantityButton = e.target.closest('[data-qty]');
    const removeButton = e.target.closest('[data-remove]');

    if (quantityButton) {

        const id = quantityButton.dataset.qty;
        const colour = decodeURIComponent(quantityButton.dataset.color);
        const size = quantityButton.dataset.size;

        const item = cart.find(x =>
            x.id === id &&
            x.color === colour &&
            x.size === size
        );

        const p = products.find(x => x.id === id);

        const variant = p?.variants.find(v =>
            v.colour === colour &&
            v.size === size
        );

        if (item) {

            const next = item.qty + Number(quantityButton.dataset.change);

            if (next <= 0) {

                cart = cart.filter(x => x !== item);

            } else if (next > Number(variant?.stock || 0)) {

                toast('Available stock limit reached.');

            } else {

                item.qty = next;
            }

            saveCart();
        }

        return;
    }

    if (removeButton) {

        const id = removeButton.dataset.remove;
        const colour = decodeURIComponent(removeButton.dataset.color);
        const size = removeButton.dataset.size;

        cart = cart.filter(x =>
            !(x.id === id && x.color === colour && x.size === size)
        );

        saveCart();
    }

});

/* =====================================================
   PRODUCT DETAILS POPUP STYLING
   ===================================================== */

const detailStyle = document.createElement('style');

detailStyle.textContent = `

.dd-product-modal {
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: rgba(0,0,0,.75);
    display: none;
    align-items: center;
    justify-content: center;
    padding: 18px;
    overflow-y: auto;
}

.dd-product-modal.active {
    display: flex;
}

.dd-modal-content {
    background: #fff;
    color: #242424;
    width: 100%;
    max-width: 950px;
    max-height: 92vh;
    overflow-y: auto;
    border-radius: 18px;
    position: relative;
    padding: 25px;
}

.dd-modal-close {
    position: sticky;
    top: 0;
    float: right;
    z-index: 5;
    border: none;
    border-radius: 50%;
    width: 38px;
    height: 38px;
    font-size: 25px;
    cursor: pointer;
    background: #f1eee9;
}

.dd-detail-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 30px;
    clear: both;
}

.dd-detail-image {
    width: 100%;
    height: 480px;
    object-fit: cover;
    border-radius: 12px;
    background: #f7f5f2;
}

.dd-detail-info h2 {
    font-size: 27px;
    margin: 10px 0;
}

.dd-detail-price {
    font-size: 25px;
    font-weight: 700;
    color: #9b7951;
    margin: 12px 0;
}

.dd-detail-description {
    line-height: 1.7;
    color: #666;
    margin: 15px 0;
}

.dd-option-title {
    font-weight: 700;
    margin: 18px 0 9px;
}

.dd-option-row {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
}

.dd-option-row button {
    padding: 10px 15px;
    border: 1px solid #ddd;
    background: white;
    cursor: pointer;
    border-radius: 6px;
}

.dd-option-row button.selected {
    border: 2px solid #ad8759;
    background: #f8f1e8;
    color: #79572e;
    font-weight: 700;
}

.dd-option-row button:disabled {
    opacity: .35;
    cursor: not-allowed;
    text-decoration: line-through;
}

.dd-stock-info {
    margin: 14px 0;
    color: #31845a;
    font-size: 14px;
}

.dd-quantity {
    display: flex;
    align-items: center;
    gap: 15px;
    margin: 15px 0;
}

.dd-quantity button {
    width: 35px;
    height: 35px;
    border: 1px solid #ddd;
    background: white;
    cursor: pointer;
    font-size: 18px;
}

.dd-add-button {
    width: 100%;
    padding: 15px;
    border: none;
    background: linear-gradient(100deg,#171717,#9b7951);
    color: white;
    font-weight: 700;
    letter-spacing: 1px;
    cursor: pointer;
    border-radius: 7px;
    margin-top: 10px;
}

.dd-add-button:disabled {
    opacity: .45;
    cursor: not-allowed;
}

.dd-recommend-title {
    margin: 35px 0 18px;
    font-size: 21px;
}

.dd-recommend-grid {
    display: grid;
    grid-template-columns: repeat(4,minmax(0,1fr));
    gap: 15px;
}

.dd-recommend-card {
    border: 1px solid #eee;
    border-radius: 9px;
    overflow: hidden;
    cursor: pointer;
    background: #fff;
}

.dd-recommend-card img {
    width: 100%;
    height: 155px;
    object-fit: cover;
}

.dd-recommend-card div {
    padding: 9px;
}

.dd-recommend-card h4 {
    font-size: 13px;
    margin: 3px 0 7px;
}

.dd-recommend-card p {
    font-size: 13px;
    font-weight: 700;
    color: #9b7951;
}

@media(max-width:650px) {

    .dd-modal-content {
        padding: 15px;
        max-height: 95vh;
    }

    .dd-detail-layout {
        grid-template-columns: 1fr;
        gap: 15px;
    }

    .dd-detail-image {
        height: 300px;
    }

    .dd-detail-info h2 {
        font-size: 22px;
    }

    .dd-recommend-grid {
        grid-template-columns: repeat(2,minmax(0,1fr));
    }

    .dd-recommend-card img {
        height: 135px;
    }
}

`;

document.head.appendChild(detailStyle);

/* =====================================================
   CREATE PRODUCT DETAILS POPUP
   ===================================================== */

const detailModal = document.createElement('div');

detailModal.className = 'dd-product-modal';
detailModal.id = 'ddProductModal';

detailModal.innerHTML = `
    <div class="dd-modal-content">

        <button
            class="dd-modal-close"
            data-modal-close
            aria-label="Close">
            &times;
        </button>

        <div id="ddModalBody"></div>

    </div>
`;

document.body.appendChild(detailModal);

let modalProductId = null;
let modalColour = '';
let modalSize = '';
let modalQuantity = 1;

/* =====================================================
   AVAILABLE SIZES
   ===================================================== */

function availableSizes(product, colour) {

    return SIZE_LIST.filter(size =>
        product.variants.some(v =>
            v.colour === colour &&
            v.size === size &&
            v.stock > 0
        )
    );
}

/* =====================================================
   OPEN PRODUCT DETAILS
   ===================================================== */

function openProductDetails(productId) {

    const product = products.find(p => p.id === productId);

    if (!product) return;

    modalProductId = productId;

    const colours = [
        ...new Set(product.variants.map(v => v.colour))
    ];

    modalColour = colours.find(c =>
        availableSizes(product, c).length > 0
    ) || colours[0] || '';

    modalSize = availableSizes(product, modalColour)[0] || '';

    modalQuantity = 1;

    renderProductDetails();

    detailModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/* =====================================================
   RENDER PRODUCT DETAILS + RECOMMENDATIONS
   ===================================================== */

function renderProductDetails() {

    const product = products.find(p => p.id === modalProductId);

    if (!product) return;

    const colours = [
        ...new Set(product.variants.map(v => v.colour))
    ];

    const sizes = availableSizes(product, modalColour);

    const selectedVariant = product.variants.find(v =>
        v.colour === modalColour &&
        v.size === modalSize
    );

    const stock = Number(selectedVariant?.stock || 0);

    const recommendations = products
        .filter(p => p.id !== product.id)
        .sort((a, b) =>
            Number(b.category === product.category) -
            Number(a.category === product.category)
        )
        .slice(0, 4);

    const body = document.getElementById('ddModalBody');

    body.innerHTML = `

        <div class="dd-detail-layout">

            <div>

                <img
                    class="dd-detail-image"
                    src="${esc(product.image)}"
                    alt="${esc(product.name)}">

            </div>

            <div class="dd-detail-info">

                <p>${esc(product.category)}</p>

                <h2>${esc(product.name)}</h2>

                <div class="dd-detail-price">
                    ${money(product.price)}
                </div>

                <p class="dd-detail-description">
                    ${esc(product.description ||
                        'Discover this beautiful piece from Dress Dreams by Nihara.')}
                </p>

                <div class="dd-option-title">
                    SELECT COLOUR
                </div>

                <div class="dd-option-row">

                    ${colours.map(c => `

                        <button
                            type="button"
                            data-modal-colour="${encodeURIComponent(c)}"
                            class="${c === modalColour ? 'selected' : ''}">

                            ${esc(c)}

                        </button>

                    `).join('')}

                </div>

                <div class="dd-option-title">
                    SELECT SIZE
                </div>

                <div class="dd-option-row">

                    ${SIZE_LIST.map(s => {

                        const available = sizes.includes(s);

                        return `

                            <button
                                type="button"
                                data-modal-size="${s}"
                                class="${s === modalSize ? 'selected' : ''}"
                                ${!available ? 'disabled' : ''}>

                                ${s}

                            </button>

                        `;

                    }).join('')}

                </div>

                <p class="dd-stock-info">

                    ${stock > 0
                        ? `${stock} pieces available`
                        : 'Select an available colour and size'}

                </p>

                <div class="dd-quantity">

                    <strong>Quantity:</strong>

                    <button
                        type="button"
                        data-modal-qty="-1">
                        −
                    </button>

                    <span>${modalQuantity}</span>

                    <button
                        type="button"
                        data-modal-qty="1"
                        ${modalQuantity >= stock ? 'disabled' : ''}>
                        +
                    </button>

                </div>

                <button
                    type="button"
                    class="dd-add-button"
                    data-modal-add
                    ${stock < 1 ? 'disabled' : ''}>

                    ADD TO BAG +

                </button>

            </div>

        </div>

        <h3 class="dd-recommend-title">
            You May Also Like
        </h3>

        <div class="dd-recommend-grid">

            ${recommendations.length

                ? recommendations.map(p => `

                    <article
                        class="dd-recommend-card"
                        data-recommend="${esc(p.id)}">

                        <img
                            src="${esc(p.image)}"
                            alt="${esc(p.name)}"
                            loading="lazy">

                        <div>

                            <h4>${esc(p.name)}</h4>

                            <p>${money(p.price)}</p>

                        </div>

                    </article>

                `).join('')

                : '<p>More beautiful pieces coming soon.</p>'

            }

        </div>

    `;
}

/* =====================================================
   CLOSE PRODUCT POPUP
   ===================================================== */

function closeProductDetails() {

    detailModal.classList.remove('active');

    document.body.style.overflow = '';

    modalProductId = null;
}

/* =====================================================
   PRODUCT POPUP INTERACTIONS
   ===================================================== */

detailModal.addEventListener('click', e => {

    if (
        e.target === detailModal ||
        e.target.closest('[data-modal-close]')
    ) {

        closeProductDetails();
        return;
    }

    // Colour selection
    const colourButton = e.target.closest('[data-modal-colour]');

    if (colourButton) {

        const product = products.find(p => p.id === modalProductId);

        modalColour = decodeURIComponent(
            colourButton.dataset.modalColour
        );

        modalSize = availableSizes(product, modalColour)[0] || '';

        modalQuantity = 1;

        renderProductDetails();
        return;
    }

    // Size selection
    const sizeButton = e.target.closest('[data-modal-size]');

    if (sizeButton) {

        modalSize = sizeButton.dataset.modalSize;

        modalQuantity = 1;

        renderProductDetails();
        return;
    }

    // Quantity selection
    const quantityButton = e.target.closest('[data-modal-qty]');

    if (quantityButton) {

        const product = products.find(p => p.id === modalProductId);

        const variant = product?.variants.find(v =>
            v.colour === modalColour &&
            v.size === modalSize
        );

        const stock = Number(variant?.stock || 0);

        modalQuantity = Math.max(
            1,
            Math.min(
                stock,
                modalQuantity + Number(quantityButton.dataset.modalQty)
            )
        );

        renderProductDetails();
        return;
    }

    // Add to bag from popup
    const addButton = e.target.closest('[data-modal-add]');

    if (addButton) {

        const product = products.find(p => p.id === modalProductId);

        const variant = product?.variants.find(v =>
            v.colour === modalColour &&
            v.size === modalSize
        );

        if (!variant || variant.stock < 1) {

            toast('This size is currently unavailable.');
            return;
        }

        const item = cart.find(x =>
            x.id === product.id &&
            x.color === modalColour &&
            x.size === modalSize
        );

        const currentQty = item?.qty || 0;

        if (currentQty + modalQuantity > Number(variant.stock)) {

            toast('Available stock limit reached.');
            return;
        }

        if (item) {

            item.qty += modalQuantity;

        } else {

            cart.push({

                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image,
                color: modalColour,
                size: modalSize,
                qty: modalQuantity

            });
        }

        saveCart();

        toast(`${product.name} added to your bag.`);

        closeProductDetails();

        openCart(true);

        return;
    }

    // Recommended products
    const recommendation = e.target.closest('[data-recommend]');

    if (recommendation) {

        openProductDetails(recommendation.dataset.recommend);
    }

});

/* =====================================================
   KEYBOARD ESCAPE TO CLOSE POPUP
   ===================================================== */

document.addEventListener('keydown', e => {

    if (
        e.key === 'Escape' &&
        detailModal.classList.contains('active')
    ) {

        closeProductDetails();
    }

});

/* =====================================================
   WEBSITE CONTROLS
   ===================================================== */

// Cart controls
document.getElementById('cartToggle')
    ?.addEventListener('click', () => openCart(true));

document.getElementById('cartClose')
    ?.addEventListener('click', () => openCart(false));

document.getElementById('drawerBackdrop')
    ?.addEventListener('click', () => openCart(false));

// Search
document.getElementById('productSearch')
    ?.addEventListener('input', renderProducts);

// Category filter
document.getElementById('categoryFilter')
    ?.addEventListener('change', renderProducts);

// Collection cards
document.querySelectorAll('.collection-card').forEach(card => {

    card.addEventListener('click', () => {

        const filter = document.getElementById('categoryFilter');

        if (filter) {
            filter.value = card.dataset.category;
        }

        renderProducts();

        document.getElementById('shop')
            ?.scrollIntoView({ behavior: 'smooth' });

    });

});

// Mobile navigation
document.getElementById('menuToggle')
    ?.addEventListener('click', () => {

        document.getElementById('mainNav')
            ?.classList.toggle('open');

    });

document.querySelectorAll('.main-nav a').forEach(link => {

    link.addEventListener('click', () => {

        document.getElementById('mainNav')
            ?.classList.remove('open');

    });

});

// Newsletter
document.getElementById('newsletterForm')
    ?.addEventListener('submit', e => {

        e.preventDefault();

        const message = document.getElementById('newsletterMessage');

        if (message) {
            message.textContent =
                'Thank you! Newsletter signup will be connected in a later step.';
        }

        e.target.reset();

    });

// Checkout placeholder
document.getElementById('checkoutButton')
    ?.addEventListener('click', () => {

        toast('Secure UPI and card checkout is not connected yet.');

    });

// Search icon
document.getElementById('searchToggle')
    ?.addEventListener('click', () => {

        document.getElementById('shop')
            ?.scrollIntoView({ behavior: 'smooth' });

        document.getElementById('productSearch')
            ?.focus();

    });

// Footer year
if (document.getElementById('year')) {

    document.getElementById('year').textContent =
        new Date().getFullYear();

}

/* =====================================================
   END OF SCRIPT
   ===================================================== */
