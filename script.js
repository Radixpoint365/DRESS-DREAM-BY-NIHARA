
/* =====================================================
   DRESS DREAMS BY NIHARA
   SUPABASE STOREFRONT + SEPARATE PRODUCT PAGE
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
    }).format(Number(n) || 0);

const grid = document.getElementById('productGrid');
const productDetailsPage = document.getElementById('productDetailsPage');

let products = [];
let categories = [];
let selected = {};

let cart = readStorage(KEY_CART);
let wishlist = readStorage(KEY_WISH);

let db = null;

/* =====================================================
   STORAGE
   ===================================================== */

function readStorage(key, fallback = []) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        return Array.isArray(value) ? value : fallback;
    } catch (error) {
        console.warn('Storage reading error:', key, error);
        return fallback;
    }
}

/* =====================================================
   GENERAL HELPERS
   ===================================================== */

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

    if (!t) {
        console.log(message);
        return;
    }

    t.textContent = message;
    t.classList.add('show');

    setTimeout(() => t.classList.remove('show'), 2200);
}

function totalStock(product) {
    return (product.variants || []).reduce(
        (total, variant) => total + Number(variant.stock || 0),
        0
    );
}

function availableSizes(product, colour) {
    return SIZE_LIST.filter(size =>
        product.variants.some(v =>
            v.colour === colour &&
            v.size === size &&
            Number(v.stock) > 0
        )
    );
}

function getProductImage(product) {
    return product.image || 'assets/placeholder.png';
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
        categories.map(category =>
            `<option value="${esc(category.name)}">${esc(category.name)}</option>`
        ).join('');

    if ([...filter.options].some(option => option.value === current)) {
        filter.value = current;
    }
}

/* =====================================================
   HOMEPAGE PRODUCT CATALOGUE
   ===================================================== */

function renderProducts() {
    if (!grid) return;

    const term = (
        document.getElementById('productSearch')?.value || ''
    ).trim().toLowerCase();

    const category =
        document.getElementById('categoryFilter')?.value || 'All';

    const list = products.filter(product =>
        (
            category === 'All' ||
            product.category === category
        ) &&
        (
            product.name.toLowerCase().includes(term) ||
            product.category.toLowerCase().includes(term)
        )
    );

    grid.innerHTML = list.length
        ? list.map(product => {
            const variants = product.variants || [];

            const colour =
                selected[product.id]?.colour ||
                variants.find(v => Number(v.stock) > 0)?.colour ||
                variants[0]?.colour ||
                '';

            const sizes = availableSizes(product, colour);

            const size = sizes.includes(selected[product.id]?.size)
                ? selected[product.id].size
                : sizes[0] || '';

            const colours = [
                ...new Set(variants.map(v => v.colour).filter(Boolean))
            ];

            return `
                <article class="product-card"
                    data-product-card="${esc(product.id)}"
                    style="cursor:pointer;">

                    <div class="product-image">
                        <img
                            src="${esc(getProductImage(product))}"
                            alt="${esc(product.name)}"
                            loading="lazy">

                        <span class="product-tag">
                            DRESS DREAMS
                        </span>

                        <button
                            class="wish-button"
                            data-wish="${esc(product.id)}"
                            aria-label="Wishlist"
                            type="button">
                            ${wishlist.includes(String(product.id)) ? '♥' : '♡'}
                        </button>
                    </div>

                    <div class="product-info">
                        <h3>${esc(product.name)}</h3>

                        <div class="product-meta">
                            <span>${esc(product.category)}</span>
                            <strong>${money(product.price)}</strong>
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
                                    data-product="${esc(product.id)}">
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
                                    Number(v.stock) > 0
                                );

                                return `
                                    <button
                                        type="button"
                                        class="size-chip ${size === s ? 'selected' : ''}"
                                        data-size="${s}"
                                        data-product="${esc(product.id)}"
                                        ${!available ? 'disabled' : ''}>
                                        ${s}
                                    </button>
                                `;
                            }).join('')}
                        </div>

                        <div class="stock-note">
                            ${totalStock(product) > 0
                                ? `${totalStock(product)} pieces available across colours`
                                : 'Currently sold out'}
                        </div>

                        <button
                            type="button"
                            class="add-button"
                            data-add="${esc(product.id)}"
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

async function loadCatalogue() {
    if (!grid && !productDetailsPage) {
        console.error('No product display element was found.');
        return;
    }

    if (
        !window.DD_SUPABASE_URL ||
        !window.DD_SUPABASE_ANON_KEY ||
        window.DD_SUPABASE_ANON_KEY.includes('PASTE_')
    ) {
        showCatalogueError('Supabase configuration is missing.');
        return;
    }

    if (grid) {
        grid.innerHTML = '<p>Loading our collection...</p>';
    }

    if (productDetailsPage) {
        productDetailsPage.innerHTML =
            '<p style="text-align:center;padding:60px 15px;">Loading product details...</p>';
    }

    try {
        db = createClient(
            window.DD_SUPABASE_URL,
            window.DD_SUPABASE_ANON_KEY
        );

        const [categoryResult, productResult] = await Promise.all([
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

        if (categoryResult.error) {
            throw new Error(
                'Categories query failed: ' +
                categoryResult.error.message +
                ' | Code: ' +
                (categoryResult.error.code || 'Unknown')
            );
        }

        if (productResult.error) {
            throw new Error(
                'Products query failed: ' +
                productResult.error.message +
                ' | Code: ' +
                (productResult.error.code || 'Unknown')
            );
        }

        categories = categoryResult.data || [];

        products = (productResult.data || []).map(p => {
            const images = Array.isArray(p.images)
                ? p.images.filter(Boolean)
                : [];

            return {
                id: String(p.id),
                name: p.name || '',
                description: p.description || '',
                category: p.categories?.name || '',
                price: Number(p.price || 0),
                images,
                image: images[0] || '',
                variants: (p.product_variants || []).map(v => ({
                    colour: v.colour || '',
                    size: v.size || '',
                    stock: Number(v.stock || 0)
                }))
            };
        });

        renderCategories();

        if (grid) {
            renderProducts();
        }

        if (productDetailsPage) {
            renderSeparateProductPage();
        }

        console.log('Catalogue loaded successfully:', {
            categories: categories.length,
            products: products.length
        });

    } catch (error) {
        console.error('Supabase catalogue error:', error);
        showCatalogueError(error.message || 'Unknown error');
    }
}

function showCatalogueError(message) {
    const target = grid || productDetailsPage;

    if (!target) return;

    target.innerHTML = `
        <div style="
            grid-column:1/-1;
            padding:25px;
            margin:15px 0;
            background:#fff;
            border:1px solid #c9b99e;
            border-radius:12px;
            color:#171311;
            overflow-wrap:anywhere;
            text-align:center;
        ">
            <h3>Unable to load the collection</h3>
            <p>${esc(message)}</p>
            <button type="button"
                onclick="location.reload()"
                style="margin-top:15px;padding:10px 20px;cursor:pointer;">
                Refresh page
            </button>
        </div>
    `;
}

/* =====================================================
   SHOPPING CART
   ===================================================== */

function saveCart() {
    try {
        localStorage.setItem(KEY_CART, JSON.stringify(cart));
    } catch (error) {
        console.error('Could not save cart:', error);
        toast('Unable to save your bag on this device.');
    }

    renderCart();
}

function renderCart() {
    const count = document.getElementById('cartCount');
    const subtotal = document.getElementById('cartSubtotal');
    const items = document.getElementById('cartItems');

    if (count) {
        count.textContent = cart.reduce(
            (total, item) => total + Number(item.qty || 0),
            0
        );
    }

    if (subtotal) {
        subtotal.textContent = money(
            cart.reduce((total, item) =>
                total + Number(item.price || 0) * Number(item.qty || 0),
                0
            )
        );
    }

    if (!items) return;

    items.innerHTML = cart.length
        ? cart.map(item => `
            <div class="cart-row">
                <img src="${esc(item.image)}" alt="">

                <div>
                    <h4>${esc(item.name)}</h4>

                    <p>
                        ${esc(item.color)} · Size ${esc(item.size)}
                        · ${money(item.price)}
                    </p>

                    <div class="qty-controls">
                        <button
                            data-qty="${esc(item.id)}"
                            data-color="${encodeURIComponent(item.color)}"
                            data-size="${esc(item.size)}"
                            data-change="-1">−</button>

                        <span>${item.qty}</span>

                        <button
                            data-qty="${esc(item.id)}"
                            data-color="${encodeURIComponent(item.color)}"
                            data-size="${esc(item.size)}"
                            data-change="1">+</button>
                    </div>
                </div>

                <button
                    class="remove-item"
                    data-remove="${esc(item.id)}"
                    data-color="${encodeURIComponent(item.color)}"
                    data-size="${esc(item.size)}">
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
   ADD PRODUCT TO CART
   ===================================================== */

function addProductToCart(product, colour, size, quantity = 1) {
    const variant = product.variants.find(v =>
        v.colour === colour && v.size === size
    );

    if (!variant || Number(variant.stock) < 1) {
        toast('Please select an available colour and size.');
        return false;
    }

    const item = cart.find(x =>
        x.id === product.id &&
        x.color === colour &&
        x.size === size
    );

    const existingQty = item ? Number(item.qty || 0) : 0;

    if (existingQty + quantity > Number(variant.stock)) {
        toast('Available stock limit reached.');
        return false;
    }

    if (item) {
        item.qty += quantity;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: getProductImage(product),
            color: colour,
            size,
            qty: quantity
        });
    }

    saveCart();
    toast(`${product.name} added to your bag.`);

    return true;
}

/* =====================================================
   HOMEPAGE PRODUCT CARD INTERACTIONS
   ===================================================== */

grid?.addEventListener('click', e => {

    // Wishlist
    const wishButton = e.target.closest('[data-wish]');

    if (wishButton) {
        const id = String(wishButton.dataset.wish);

        wishlist = wishlist.includes(id)
            ? wishlist.filter(x => x !== id)
            : [...wishlist, id];

        try {
            localStorage.setItem(KEY_WISH, JSON.stringify(wishlist));
        } catch (error) {
            console.error('Could not save wishlist:', error);
        }

        renderProducts();
        toast('Wishlist updated.');
        return;
    }

    // Colour selection
    const colourButton = e.target.closest('[data-color][data-product]');

    if (colourButton) {
        const id = String(colourButton.dataset.product);

        selected[id] = {
            colour: decodeURIComponent(colourButton.dataset.color),
            size: ''
        };

        renderProducts();
        return;
    }

    // Size selection
    const sizeButton = e.target.closest('[data-size][data-product]');

    if (sizeButton) {
        const id = String(sizeButton.dataset.product);
        const product = products.find(p => p.id === id);

        const colour =
            selected[id]?.colour ||
            product?.variants.find(v => v.stock > 0)?.colour;

        selected[id] = {
            colour,
            size: sizeButton.dataset.size
        };

        renderProducts();
        return;
    }

    // Add to bag
    const addButton = e.target.closest('[data-add]');

    if (addButton) {
        const product = products.find(
            p => p.id === String(addButton.dataset.add)
        );

        if (!product) return;

        const choice = selected[product.id] || {};

        const colour =
            choice.colour ||
            product.variants.find(v => v.stock > 0)?.colour;

        const size = choice.size ||
            SIZE_LIST.find(s =>
                product.variants.some(v =>
                    v.colour === colour &&
                    v.size === s &&
                    v.stock > 0
                )
            );

        addProductToCart(product, colour, size, 1);
        return;
    }

    // Open separate product page
    const card = e.target.closest('[data-product-card]');

    if (card) {
        window.location.href =
            `product.html?id=${encodeURIComponent(card.dataset.productCard)}`;
    }
});

/* =====================================================
   CART QUANTITY AND REMOVE BUTTONS
   ===================================================== */

document.getElementById('cartItems')?.addEventListener('click', e => {

    const quantityButton = e.target.closest('[data-qty]');
    const removeButton = e.target.closest('[data-remove]');

    if (quantityButton) {
        const id = String(quantityButton.dataset.qty);
        const colour = decodeURIComponent(quantityButton.dataset.color);
        const size = quantityButton.dataset.size;

        const item = cart.find(x =>
            x.id === id &&
            x.color === colour &&
            x.size === size
        );

        const product = products.find(x => x.id === id);

        const variant = product?.variants.find(v =>
            v.colour === colour &&
            v.size === size
        );

        if (item) {
            const next =
                Number(item.qty) + Number(quantityButton.dataset.change);

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
        const id = String(removeButton.dataset.remove);
        const colour = decodeURIComponent(removeButton.dataset.color);
        const size = removeButton.dataset.size;

        cart = cart.filter(x =>
            !(x.id === id && x.color === colour && x.size === size)
        );

        saveCart();
    }
});

/* =====================================================
   SEPARATE PRODUCT DETAILS PAGE
   ===================================================== */

function renderSeparateProductPage() {
    if (!productDetailsPage) return;

    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');

    const product = products.find(
        p => String(p.id) === String(productId)
    );

    if (!product) {
        productDetailsPage.innerHTML = `
            <div class="product-not-found">
                <h2>Product not found</h2>
                <p>This product may be unavailable or removed.</p>
                <a href="index.html#shop">Return to shopping</a>
            </div>
        `;
        return;
    }

    const colours = [
        ...new Set(product.variants.map(v => v.colour).filter(Boolean))
    ];

    let selectedColour = colours.find(c =>
        availableSizes(product, c).length > 0
    ) || colours[0] || '';

    let selectedSize =
        availableSizes(product, selectedColour)[0] || '';

    let quantity = 1;

    const images = product.images.length
        ? product.images
        : [getProductImage(product)];

    let activeImage = images[0];

    /* -----------------------------------------------
       DRAW PRODUCT PAGE
       ----------------------------------------------- */

    function draw() {
        const variant = product.variants.find(v =>
            v.colour === selectedColour &&
            v.size === selectedSize
        );

        const stock = Number(variant?.stock || 0);

        const recommendations = products
            .filter(p => String(p.id) !== String(product.id))
            .sort((a, b) =>
                Number(b.category === product.category) -
                Number(a.category === product.category)
            )
            .slice(0, 4);

        productDetailsPage.innerHTML = `
            <div class="product-page-container">

                <a href="index.html#shop" class="back-to-shop">
                    ← Continue shopping
                </a>

                <div class="product-details-layout">

                    <div class="product-gallery">

                        <div class="main-product-image">
                            <img
                                id="mainProductImage"
                                src="${esc(activeImage)}"
                                alt="${esc(product.name)}">
                        </div>

                        <div class="product-thumbnails">
                            ${images.map((img, index) => `
                                <button
                                    type="button"
                                    class="product-thumbnail ${img === activeImage ? 'active' : ''}"
                                    data-gallery-image="${index}">

                                    <img
                                        src="${esc(img)}"
                                        alt="Product view ${index + 1}">
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <div class="product-page-info">

                        <p class="product-page-category">
                            ${esc(product.category)}
                        </p>

                        <h1>${esc(product.name)}</h1>

                        <p class="product-page-price">
                            ${money(product.price)}
                        </p>

                        <p class="product-page-description">
                            ${esc(product.description ||
                                'Discover this beautiful piece from Dress Dreams by Nihara.')}
                        </p>

                        <div class="product-option-title">
                            COLOUR:
                            <strong>${esc(selectedColour || 'Unavailable')}</strong>
                        </div>

                        <div class="product-page-options">
                            ${colours.map(c => `
                                <button
                                    type="button"
                                    data-page-colour="${encodeURIComponent(c)}"
                                    class="${c === selectedColour ? 'selected' : ''}">

                                    ${esc(c)}
                                </button>
                            `).join('')}
                        </div>

                        <div class="product-option-title">
                            SIZE:
                            <strong>${esc(selectedSize || 'Select a size')}</strong>
                        </div>

                        <div class="product-page-options">
                            ${SIZE_LIST.map(s => `
                                <button
                                    type="button"
                                    data-page-size="${s}"
                                    class="${s === selectedSize ? 'selected' : ''}"
                                    ${!availableSizes(product, selectedColour).includes(s) ? 'disabled' : ''}>

                                    ${s}
                                </button>
                            `).join('')}
                        </div>

                        <p class="product-page-stock">
                            ${stock > 0
                                ? `${stock} pieces available`
                                : 'Currently unavailable'}
                        </p>

                        <div class="product-page-quantity">
                            <strong>Quantity</strong>

                            <button
                                type="button"
                                data-page-qty="-1"
                                ${quantity <= 1 ? 'disabled' : ''}>
                                −
                            </button>

                            <span>${quantity}</span>

                            <button
                                type="button"
                                data-page-qty="1"
                                ${quantity >= stock ? 'disabled' : ''}>
                                +
                            </button>
                        </div>

                        <button
                            type="button"
                            class="product-page-add"
                            data-page-add
                            ${stock < 1 ? 'disabled' : ''}>
                            ADD TO BAG
                        </button>

                        <p class="product-page-note">
                            Elegant styles, thoughtfully selected for you.
                        </p>
                    </div>
                </div>

                <section class="related-products">

                    <h2>You May Also Like</h2>

                    <div class="related-product-grid">
                        ${recommendations.length
                            ? recommendations.map(p => `
                                <a
                                    class="related-product-card"
                                    href="product.html?id=${encodeURIComponent(p.id)}">

                                    <img
                                        src="${esc(getProductImage(p))}"
                                        alt="${esc(p.name)}"
                                        loading="lazy">

                                    <h3>${esc(p.name)}</h3>

                                    <p>${money(p.price)}</p>
                                </a>
                            `).join('')
                            : '<p>More beautiful pieces coming soon.</p>'
                        }
                    </div>
                </section>
            </div>
        `;

        document.title =
            `${product.name} | Dress Dreams by Nihara`;
    }

    draw();

    /* -----------------------------------------------
       PRODUCT PAGE INTERACTIONS
       ----------------------------------------------- */

    productDetailsPage.onclick = e => {

        // Image gallery
        const galleryButton = e.target.closest('[data-gallery-image]');

        if (galleryButton) {
            activeImage =
                images[Number(galleryButton.dataset.galleryImage)];

            draw();
            return;
        }

        // Colour selection
        const colourButton = e.target.closest('[data-page-colour]');

        if (colourButton) {
            selectedColour = decodeURIComponent(
                colourButton.dataset.pageColour
            );

            selectedSize =
                availableSizes(product, selectedColour)[0] || '';

            quantity = 1;

            draw();
            return;
        }

        // Size selection
        const sizeButton = e.target.closest('[data-page-size]');

        if (sizeButton) {
            selectedSize = sizeButton.dataset.pageSize;
            quantity = 1;

            draw();
            return;
        }

        // Quantity selection
        const quantityButton = e.target.closest('[data-page-qty]');

        if (quantityButton) {
            const currentVariant = product.variants.find(v =>
                v.colour === selectedColour &&
                v.size === selectedSize
            );

            const currentStock =
                Number(currentVariant?.stock || 0);

            quantity = Math.max(
                1,
                Math.min(
                    currentStock,
                    quantity + Number(quantityButton.dataset.pageQty)
                )
            );

            draw();
            return;
        }

        // Add to bag
        const addButton = e.target.closest('[data-page-add]');

        if (addButton) {
            const added = addProductToCart(
                product,
                selectedColour,
                selectedSize,
                quantity
            );

            if (added) {
                quantity = 1;
                draw();
            }
        }
    };
}

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

        const message =
            document.getElementById('newsletterMessage');

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
   START CATALOGUE
   ===================================================== */

loadCatalogue();

/* =====================================================
   END OF SCRIPT
   ===================================================== */
