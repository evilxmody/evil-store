(() => {
  const STORAGE = {
    theme: "storefront_theme_v1",
    cart: "storefront_cart_v1",
    products: "storefront_products_v1",
    config: "storefront_config_v1",
    lastOrder: "storefront_last_order_v1",
    orders: "storefront_orders_v1",
    account: "storefront_account_v1",
    customers: "storefront_customers_v1"
  };
  const FALLBACK_IMAGE = "assets/store/product-01.svg";

  function safeJsonParse(text, fallback) {
    try {
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }

  function loadFromStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function saveToStorage(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function clampInt(value, min, max) {
    const n = Number.parseInt(String(value), 10);
    if (Number.isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function finiteNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeImagePath(src) {
    const s = String(src || "")
      .trim()
      .replace(/\\/g, "/");
    if (!s) return "";
    if (/^(https?:|file:|data:|blob:|\/|\.\/|\.\.\/|assets\/)/i.test(s)) return s;
    return "assets/store/" + s.replace(/^\/+/, "");
  }

  function normalizeImages(images) {
    const raw = Array.isArray(images)
      ? images
      : String(images || "")
          .split(/[\n,]+/)
          .map((s) => s.trim());
    const list = [...new Set(raw.map(normalizeImagePath).filter(Boolean))];
    return list.length ? list : [FALLBACK_IMAGE];
  }

  function setImage(img, src, fallback) {
    if (!img) return;
    const safeFallback = normalizeImagePath(fallback || FALLBACK_IMAGE) || FALLBACK_IMAGE;
    const next = normalizeImagePath(src) || safeFallback;
    img.dataset.fallbackApplied = "false";
    img.onerror = () => {
      if (img.dataset.fallbackApplied === "true") return;
      img.dataset.fallbackApplied = "true";
      img.src = safeFallback;
    };
    img.src = next;
  }

  function normalizePhone(phone) {
    return String(phone || "")
      .trim()
      .replace(/[^\d+]/g, "")
      .replace(/^00/, "+");
  }

  function phoneDigits(phone) {
    return normalizePhone(phone).replace(/\D/g, "");
  }

  function isPhone(phone) {
    const digits = phoneDigits(phone);
    return digits.length >= 8 && digits.length <= 15;
  }

  function cleanName(name) {
    return String(name || "").trim().replace(/\s+/g, " ");
  }

  function getAccount() {
    const stored = loadFromStorage(STORAGE.account);
    const parsed = stored ? safeJsonParse(stored, null) : null;
    const name = cleanName(parsed?.name);
    const phone = normalizePhone(parsed?.phone);
    return name && isPhone(phone) ? { name, phone, phoneKey: phoneDigits(phone) } : null;
  }

  function cartKeyForPhone(phone) {
    const clean = phoneDigits(phone);
    return clean ? STORAGE.cart + ":phone:" + encodeURIComponent(clean) : STORAGE.cart;
  }

  function currentCartKey() {
    const account = getAccount();
    return account?.phoneKey ? cartKeyForPhone(account.phoneKey) : STORAGE.cart;
  }

  function readCartFromKey(key) {
    const stored = loadFromStorage(key);
    const parsed = stored ? safeJsonParse(stored, null) : null;
    if (!parsed || !Array.isArray(parsed.items)) return { items: [] };
    return {
      items: parsed.items
        .map((it) => ({
          id: String(it?.id || ""),
          qty: clampInt(it?.qty ?? 1, 1, 99)
        }))
        .filter((it) => it.id)
    };
  }

  function writeCartToKey(key, cart) {
    return saveToStorage(key, JSON.stringify(cart || { items: [] }));
  }

  function mergeCarts(baseCart, extraCart) {
    const map = new Map();
    [baseCart, extraCart].forEach((cart) => {
      (cart?.items || []).forEach((it) => {
        const id = String(it?.id || "");
        if (!id) return;
        const current = map.get(id) || 0;
        map.set(id, clampInt(current + Number(it.qty || 1), 1, 99));
      });
    });
    return { items: [...map.entries()].map(([id, qty]) => ({ id, qty })) };
  }

  function rememberCustomer(customer) {
    const name = cleanName(customer?.name);
    const phone = normalizePhone(customer?.phone);
    if (!name || !isPhone(phone)) return [];
    const stored = loadFromStorage(STORAGE.customers);
    const parsed = stored ? safeJsonParse(stored, []) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    const withoutCurrent = list.filter((it) => phoneDigits(it?.phone) !== phoneDigits(phone));
    const next = [{ name, phone, savedAt: new Date().toISOString() }, ...withoutCurrent].slice(0, 500);
    saveToStorage(STORAGE.customers, JSON.stringify(next));
    return next;
  }

  function setAccount(name, phone) {
    const clean = cleanName(name);
    const normalizedPhone = normalizePhone(phone);
    if (!clean || !isPhone(normalizedPhone)) return null;
    const current = getAccount();
    const shouldMergeGuest = current?.phoneKey !== phoneDigits(normalizedPhone);
    const guestCart = shouldMergeGuest ? readCartFromKey(STORAGE.cart) : { items: [] };
    const userKey = cartKeyForPhone(normalizedPhone);
    const userCart = readCartFromKey(userKey);
    writeCartToKey(userKey, shouldMergeGuest ? mergeCarts(userCart, guestCart) : userCart);
    try {
      localStorage.removeItem(STORAGE.cart);
    } catch {
      // ignore
    }
    const account = { name: clean, phone: normalizedPhone };
    saveToStorage(STORAGE.account, JSON.stringify(account));
    rememberCustomer(account);
    return { ...account, phoneKey: phoneDigits(normalizedPhone) };
  }

  function clearAccount() {
    try {
      localStorage.removeItem(STORAGE.account);
    } catch {
      // ignore
    }
  }

  function moneyFormatter(config) {
    const locale = config?.locale || "ar-EG";
    const currency = config?.currency || "EGP";
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency });
    } catch {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
    }
  }

  function setText(sel, text) {
    const el = typeof sel === "string" ? document.querySelector(sel) : sel;
    if (!el) return;
    el.textContent = text;
  }

  function getConfig() {
    const stored = loadFromStorage(STORAGE.config);
    const override = stored ? safeJsonParse(stored, null) : null;
    const base = window.STORE_CONFIG || {};
    return {
      name: typeof override?.name === "string" ? override.name : (base.name || "متجر"),
      tagline: typeof override?.tagline === "string" ? override.tagline : (base.tagline || ""),
      title: typeof override?.title === "string" ? override.title : (base.title || ""),
      locale: typeof override?.locale === "string" ? override.locale : (base.locale || "ar-EG"),
      currency: typeof override?.currency === "string" ? override.currency : (base.currency || "EGP"),
      whatsappPhone:
        typeof override?.whatsappPhone === "string" && override.whatsappPhone.trim()
          ? override.whatsappPhone
          : (base.whatsappPhone || ""),
      whatsappLink:
        typeof override?.whatsappLink === "string" && override.whatsappLink.trim()
          ? override.whatsappLink
          : (base.whatsappLink || ""),
      adminPassword:
        typeof override?.adminPassword === "string" ? override.adminPassword : (base.adminPassword || "admin123"),
      shipping: {
        flatFee: Number.isFinite(Number(override?.shipping?.flatFee))
          ? Number(override.shipping.flatFee)
          : Number(base?.shipping?.flatFee || 0),
        freeOver: Number.isFinite(Number(override?.shipping?.freeOver))
          ? Number(override.shipping.freeOver)
          : Number(base?.shipping?.freeOver || 0)
      }
    };
  }

  function loadProducts() {
    const stored = loadFromStorage(STORAGE.products);
    const parsed = stored ? safeJsonParse(stored, null) : null;
    const base = Array.isArray(window.STORE_PRODUCTS) ? window.STORE_PRODUCTS : [];
    const list = Array.isArray(parsed) ? parsed : base;
    return list
      .map((p) => ({
        id: String(p?.id || "").trim(),
        name: String(p?.name || "").trim(),
        sku: p?.sku ? String(p.sku).trim() : "",
        stock: p?.stock == null ? null : finiteNumber(p.stock, null),
        price: finiteNumber(p?.price, 0),
        compareAt: p?.compareAt == null ? null : finiteNumber(p.compareAt, null),
        category: String(p?.category || "أخرى").trim(),
        badge: p?.badge ? String(p.badge) : "",
        images: normalizeImages(p?.images),
        description: String(p?.description || "").trim(),
        highlights: Array.isArray(p?.highlights) ? p.highlights.map((s) => String(s).trim()).filter(Boolean) : [],
        specs: Array.isArray(p?.specs)
          ? p.specs
              .map((it) => ({
                label: String(it?.label || "").trim(),
                value: String(it?.value || "").trim()
              }))
              .filter((it) => it.label && it.value)
          : []
      }))
      .filter((p) => p.id && p.name);
  }

  function getProductById(products, id) {
    return products.find((p) => p.id === id) || null;
  }

  function cartLoad() {
    return readCartFromKey(currentCartKey());
  }

  function cartSave(cart) {
    return writeCartToKey(currentCartKey(), cart);
  }

  function cartSetQty(productId, qty) {
    const cart = cartLoad();
    const nextQty = clampInt(qty, 0, 99);
    const idx = cart.items.findIndex((it) => it.id === productId);
    if (nextQty <= 0) {
      if (idx >= 0) cart.items.splice(idx, 1);
    } else if (idx >= 0) {
      cart.items[idx].qty = nextQty;
    } else {
      cart.items.push({ id: productId, qty: nextQty });
    }
    cartSave(cart);
    return cart;
  }

  function cartAdd(productId, qty) {
    const cart = cartLoad();
    const addQty = clampInt(qty ?? 1, 1, 99);
    const idx = cart.items.findIndex((it) => it.id === productId);
    if (idx >= 0) cart.items[idx].qty = clampInt(cart.items[idx].qty + addQty, 1, 99);
    else cart.items.push({ id: productId, qty: addQty });
    cartSave(cart);
    return cart;
  }

  function cartClear() {
    const cart = { items: [] };
    cartSave(cart);
    return cart;
  }

  function cartCount(cart) {
    return cart.items.reduce((sum, it) => sum + (it.qty || 0), 0);
  }

  function cartSubtotal(products, cart) {
    return (cart?.items || []).reduce((sum, it) => {
      const p = getProductById(products, it.id);
      if (!p) return sum;
      const price = Math.max(0, Number(p.price || 0));
      const qty = clampInt(it.qty ?? 1, 1, 99);
      return sum + price * qty;
    }, 0);
  }

  function shippingFee(config, subtotal) {
    if (Number(subtotal || 0) <= 0) return 0;
    const flat = Number(config?.shipping?.flatFee || 0);
    const freeOver = Number(config?.shipping?.freeOver || 0);
    if (freeOver > 0 && subtotal >= freeOver) return 0;
    return Math.max(0, flat);
  }

  const ORDER_STATUSES = {
    pending: "قيد المراجعة",
    approved: "تم قبول الطلب",
    rejected: "مرفوض",
    shipped: "تم الشحن",
    delivered: "تم التسليم",
    cancelled: "ملغي"
  };

  function normalizeOrder(order) {
    if (!order || typeof order !== "object") return null;
    const id = String(order.id || "").trim();
    if (!id) return null;
    const customer = order.customer || {};
    const status = ORDER_STATUSES[order.status] ? order.status : "pending";
    return {
      ...order,
      id,
      status,
      archived: Boolean(order.archived),
      createdAt: order.createdAt || new Date().toISOString(),
      updatedAt: order.updatedAt || order.createdAt || new Date().toISOString(),
      customer: {
        ...customer,
        name: cleanName(customer.name),
        phone: normalizePhone(customer.phone),
        phoneKey: phoneDigits(customer.phone)
      },
      items: Array.isArray(order.items) ? order.items : [],
      history: Array.isArray(order.history) ? order.history : []
    };
  }

  function ordersLoad() {
    const stored = loadFromStorage(STORAGE.orders);
    const parsed = stored ? safeJsonParse(stored, []) : [];
    return (Array.isArray(parsed) ? parsed : []).map(normalizeOrder).filter(Boolean);
  }

  function ordersSave(orders) {
    const list = (Array.isArray(orders) ? orders : []).map(normalizeOrder).filter(Boolean);
    return saveToStorage(STORAGE.orders, JSON.stringify(list));
  }

  function orderGet(id) {
    const clean = String(id || "").trim();
    return ordersLoad().find((order) => order.id === clean) || null;
  }

  function orderUpsert(order) {
    const next = normalizeOrder(order);
    if (!next) return null;
    const list = ordersLoad();
    const idx = list.findIndex((it) => it.id === next.id);
    if (idx >= 0) list[idx] = next;
    else list.unshift(next);
    ordersSave(list);
    saveToStorage(STORAGE.lastOrder, JSON.stringify(next));
    return next;
  }

  function orderSetStatus(id, status, note) {
    if (!ORDER_STATUSES[status]) return null;
    const order = orderGet(id);
    if (!order) return null;
    const now = new Date().toISOString();
    const history = Array.isArray(order.history) ? order.history.slice() : [];
    history.push({ status, note: String(note || "").trim(), at: now });
    return orderUpsert({ ...order, status, updatedAt: now, history });
  }

  function orderArchive(id) {
    const order = orderGet(id);
    if (!order) return null;
    return orderUpsert({ ...order, archived: true, updatedAt: new Date().toISOString() });
  }

  function orderRestore(id) {
    const order = orderGet(id);
    if (!order) return null;
    return orderUpsert({ ...order, archived: false, updatedAt: new Date().toISOString() });
  }

  function ordersForAccount(account) {
    const acc = account || getAccount();
    if (!acc?.phoneKey) return [];
    return ordersLoad().filter((order) => phoneDigits(order.customer?.phone) === acc.phoneKey);
  }

  function orderStatusLabel(status) {
    return ORDER_STATUSES[status] || ORDER_STATUSES.pending;
  }

  function setTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    saveToStorage(STORAGE.theme, next);
    return next;
  }

  function initTheme() {
    const stored = loadFromStorage(STORAGE.theme);
    if (stored === "dark" || stored === "light") return setTheme(stored);
    const prefersDark =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return setTheme(prefersDark ? "dark" : "light");
  }

  function toast(title, subtitle) {
    const host = document.getElementById("toastHost");
    if (!host) return;
    const wrap = document.createElement("div");
    wrap.className = "toast";
    const strong = document.createElement("strong");
    strong.textContent = title;
    const span = document.createElement("span");
    span.textContent = subtitle || "";
    wrap.appendChild(strong);
    wrap.appendChild(span);
    host.appendChild(wrap);
    window.setTimeout(() => wrap.remove(), 2200);
  }

  function iconSvg(name) {
    const stroke = "currentColor";
    const common =
      'fill="none" stroke="' +
      stroke +
      '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    switch (name) {
      case "search":
        return '<svg viewBox="0 0 24 24" ' + common + '><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.2-3.2"/></svg>';
      case "cart":
        return '<svg viewBox="0 0 24 24" ' + common + '><path d="M6 7h15l-1.5 8H8L6 4H3"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>';
      case "orders":
        return '<svg viewBox="0 0 24 24" ' + common + '><path d="M4 7l8-4 8 4-8 4-8-4z"/><path d="M4 7v10l8 4 8-4V7"/><path d="M12 11v10"/></svg>';
      case "close":
        return '<svg viewBox="0 0 24 24" ' + common + '><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>';
      case "theme":
        return '<svg viewBox="0 0 24 24" ' + common + '><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
      case "user":
        return '<svg viewBox="0 0 24 24" ' + common + '><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>';
      case "minus":
        return '<svg viewBox="0 0 24 24" ' + common + '><path d="M5 12h14"/></svg>';
      case "plus":
        return '<svg viewBox="0 0 24 24" ' + common + '><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
      case "trash":
        return '<svg viewBox="0 0 24 24" ' + common + '><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 16H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
      case "back":
        return '<svg viewBox="0 0 24 24" ' + common + '><path d="M15 18l-6-6 6-6"/></svg>';
      case "reset":
        return '<svg viewBox="0 0 24 24" ' + common + '><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/></svg>';
      default:
        return "";
    }
  }

  function hydrateIcons() {
    document.querySelectorAll("[data-icon]").forEach((el) => {
      const name = el.getAttribute("data-icon");
      const svg = iconSvg(name);
      if (!svg) return;
      el.innerHTML = svg;
    });
  }

  function hydrateBrand() {
    const config = getConfig();
    setText("[data-store-name]", config.name);
    setText("[data-store-tagline]", config.tagline);
    setText("[data-store-title]", config.title || "المنتجات");
    document.title = config.name || document.title;
    return config;
  }

  function wireAccount() {
    const openBtn = document.getElementById("accountOpen");
    if (!openBtn || document.body.dataset.accountWired === "true") return;
    document.body.dataset.accountWired = "true";

    const overlay = document.createElement("div");
    overlay.className = "account-overlay";
    overlay.hidden = true;
    overlay.innerHTML =
      '<form class="account-box" id="accountForm" novalidate>' +
      '<div class="drawer-head">' +
      '<h2 class="drawer-title">الحساب</h2>' +
      '<button class="icon-btn" type="button" id="accountClose" aria-label="إغلاق" title="إغلاق"><span class="icon" data-icon="close"></span></button>' +
      "</div>" +
      '<div class="account-body">' +
      '<label class="field"><span class="field-label">اسم العميل</span><input id="accountName" type="text" autocomplete="name" placeholder="اسمك" required /></label>' +
      '<label class="field"><span class="field-label">رقم الموبايل</span><input id="accountPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+2010..." required /></label>' +
      '<div class="drawer-actions account-actions"><button class="btn btn-primary" type="submit">حفظ</button><button class="btn btn-ghost" type="button" id="accountLogout">خروج</button></div>' +
      '<p class="muted tiny" id="accountStatus"></p>' +
      "</div>" +
      "</form>";
    document.body.appendChild(overlay);

    const form = document.getElementById("accountForm");
    const closeBtn = document.getElementById("accountClose");
    const logoutBtn = document.getElementById("accountLogout");
    const nameInput = document.getElementById("accountName");
    const phoneInput = document.getElementById("accountPhone");
    const status = document.getElementById("accountStatus");

    function refresh() {
      const account = getAccount();
      openBtn.classList.toggle("is-active", Boolean(account));
      openBtn.title = account ? account.name + " - " + account.phone : "الحساب";
      if (nameInput) nameInput.value = account?.name || "";
      if (phoneInput) phoneInput.value = account?.phone || "";
      if (status) status.textContent = account ? "السلة محفوظة على: " + account.name : "السلة الحالية محفوظة كزائر.";
      if (logoutBtn) logoutBtn.hidden = !account;
    }

    function setOpen(isOpen) {
      overlay.hidden = !isOpen;
      overlay.setAttribute("aria-hidden", isOpen ? "false" : "true");
      if (isOpen) {
        refresh();
        nameInput?.focus();
        hydrateIcons();
      }
    }

    openBtn.addEventListener("click", () => setOpen(true));
    closeBtn?.addEventListener("click", () => setOpen(false));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) setOpen(false);
    });

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const account = setAccount(nameInput?.value, phoneInput?.value);
      if (!account) {
        toast("بيانات ناقصة", "اكتب الاسم ورقم الموبايل");
        return;
      }
      refresh();
      setOpen(false);
      toast("تم حفظ الحساب", account.name);
      window.dispatchEvent(new CustomEvent("storefront:accountchange", { detail: account }));
    });

    logoutBtn?.addEventListener("click", () => {
      clearAccount();
      refresh();
      setOpen(false);
      toast("تم الخروج", "السلة الحالية رجعت كزائر");
      window.dispatchEvent(new CustomEvent("storefront:accountchange"));
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });

    refresh();
    hydrateIcons();
  }

  function wireCursor() {
    if (document.body.dataset.cursorWired === "true") return;
    if (typeof window.matchMedia !== "function") return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    document.body.dataset.cursorWired = "true";

    const dot = document.createElement("span");
    const ring = document.createElement("span");
    dot.className = "custom-cursor-dot";
    ring.className = "custom-cursor-ring";
    dot.setAttribute("aria-hidden", "true");
    ring.setAttribute("aria-hidden", "true");
    document.body.appendChild(dot);
    document.body.appendChild(ring);
    document.body.classList.add("has-custom-cursor");

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let raf = 0;

    function render() {
      raf = 0;
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      ring.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }

    function schedule(e) {
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = window.requestAnimationFrame(render);
    }

    document.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      schedule(e);
      dot.classList.add("is-visible");
      ring.classList.add("is-visible");
      const interactive = e.target?.closest?.("a, button, input, textarea, select, summary, .card, .product-slider");
      ring.classList.toggle("is-interactive", Boolean(interactive));
    });
    document.addEventListener("pointerdown", () => ring.classList.add("is-down"));
    document.addEventListener("pointerup", () => ring.classList.remove("is-down"));
    document.addEventListener("pointerleave", () => {
      dot.classList.remove("is-visible");
      ring.classList.remove("is-visible");
    });
  }

  window.Storefront = {
    STORAGE,
    FALLBACK_IMAGE,
    safeJsonParse,
    loadFromStorage,
    saveToStorage,
    clampInt,
    finiteNumber,
    normalizeImagePath,
    normalizeImages,
    setImage,
    normalizePhone,
    phoneDigits,
    isPhone,
    cleanName,
    getAccount,
    setAccount,
    clearAccount,
    rememberCustomer,
    moneyFormatter,
    getConfig,
    loadProducts,
    getProductById,
    cartLoad,
    cartSave,
    cartAdd,
    cartSetQty,
    cartClear,
    cartCount,
    cartSubtotal,
    shippingFee,
    ORDER_STATUSES,
    ordersLoad,
    ordersSave,
    orderGet,
    orderUpsert,
    orderSetStatus,
    orderArchive,
    orderRestore,
    ordersForAccount,
    orderStatusLabel,
    initTheme,
    setTheme,
    toast,
    hydrateIcons,
    hydrateBrand,
    wireAccount,
    wireCursor
  };

  document.addEventListener("DOMContentLoaded", () => {
    hydrateIcons();
    hydrateBrand();
    initTheme();
    wireAccount();
    wireCursor();
  });
})();
