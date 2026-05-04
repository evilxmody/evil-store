(() => {
  function qs(id) {
    return document.getElementById(id);
  }

  function uniq(arr) {
    return [...new Set(arr)];
  }

  function normalizeText(s) {
    return String(s || "")
      .trim()
      .toLowerCase();
  }

  function buildCategoryOptions(selectEl, products) {
    if (!selectEl) return;
    const categories = uniq(products.map((p) => p.category).filter(Boolean)).sort((a, b) => a.localeCompare(b, "ar"));
    selectEl.innerHTML = "";
    const all = document.createElement("option");
    all.value = "";
    all.textContent = "الكل";
    selectEl.appendChild(all);
    categories.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      selectEl.appendChild(opt);
    });
  }

  function renderProducts(gridEl, products, formatter, onAddToCart) {
    if (!gridEl) return;
    gridEl.innerHTML = "";

    products.forEach((p) => {
      const productUrl = "product.html?id=" + encodeURIComponent(p.id);
      function openProduct() {
        window.location.assign(productUrl);
      }

      const card = document.createElement("article");
      card.className = "card";
      card.tabIndex = 0;
      card.setAttribute("role", "link");
      card.setAttribute("aria-label", "فتح " + p.name);

      const media = document.createElement("a");
      media.className = "card-media";
      media.href = productUrl;
      media.setAttribute("aria-label", "فتح المنتج");
      media.addEventListener("click", (e) => {
        e.preventDefault();
        openProduct();
      });

      const img = document.createElement("img");
      img.loading = "lazy";
      img.alt = p.name;
      Storefront.setImage(img, p.images?.[0]);
      media.appendChild(img);

      if (p.badge) {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = p.badge;
        media.appendChild(tag);
      }

      const body = document.createElement("div");
      body.className = "card-body";

      const title = document.createElement("h3");
      title.className = "card-title";
      const titleLink = document.createElement("a");
      titleLink.href = productUrl;
      titleLink.textContent = p.name;
      titleLink.addEventListener("click", (e) => {
        e.preventDefault();
        openProduct();
      });
      title.appendChild(titleLink);

      const priceRow = document.createElement("div");
      priceRow.className = "price-row";

      const priceWrap = document.createElement("div");
      priceWrap.className = "price";

      const price = document.createElement("span");
      price.textContent = formatter.format(p.price || 0);
      priceWrap.appendChild(price);

      if (p.compareAt != null && Number.isFinite(p.compareAt) && p.compareAt > p.price) {
        const compare = document.createElement("span");
        compare.className = "compare";
        compare.textContent = formatter.format(p.compareAt);
        priceWrap.appendChild(compare);
      }

      const cat = document.createElement("span");
      cat.className = "muted tiny";
      cat.textContent = p.category || "";

      priceRow.appendChild(priceWrap);
      priceRow.appendChild(cat);

      const actions = document.createElement("div");
      actions.className = "card-actions";

      const add = document.createElement("button");
      add.className = "btn btn-primary btn-wide";
      add.type = "button";
      add.textContent = "إضافة للسلة";
      add.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onAddToCart(p.id);
      });

      actions.appendChild(add);

      body.appendChild(title);
      body.appendChild(priceRow);
      body.appendChild(actions);

      card.appendChild(media);
      card.appendChild(body);

      card.addEventListener("click", (e) => {
        if (e.target.closest("button, input, select, textarea, a")) return;
        openProduct();
      });

      card.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (e.target.closest("button, input, select, textarea, a")) return;
        e.preventDefault();
        openProduct();
      });

      gridEl.appendChild(card);
    });
  }

  function applyFilters(products, query, category, sortKey) {
    const q = normalizeText(query);
    let list = products.slice();

    if (category) list = list.filter((p) => p.category === category);
    if (q) {
      list = list.filter((p) => {
        const hay = normalizeText(p.name + " " + (p.description || "") + " " + (p.category || ""));
        return hay.includes(q);
      });
    }

    switch (sortKey) {
      case "priceAsc":
        list.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case "priceDesc":
        list.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case "nameAsc":
        list.sort((a, b) => a.name.localeCompare(b.name, "ar"));
        break;
      case "newest":
        list.reverse();
        break;
      default:
        break;
    }

    return list;
  }

  function wireCartDrawer(products, config, formatter) {
    const overlay = qs("drawerOverlay");
    const drawer = qs("cartDrawer");
    const openBtn = qs("cartOpen");
    const closeBtn = qs("cartClose");
    const clearBtn = qs("cartClear");
    const itemsHost = qs("cartItems");
    const cartTotalEl = qs("cartTotal");
    const countEl = qs("cartCount");

    function setOpen(isOpen) {
      if (!overlay || !drawer) return;
      overlay.hidden = !isOpen;
      drawer.classList.toggle("open", isOpen);
      drawer.setAttribute("aria-hidden", isOpen ? "false" : "true");
      document.body.style.overflow = isOpen ? "hidden" : "";
      if (isOpen) renderCart();
    }

    function renderCart() {
      const cart = Storefront.cartLoad();
      const count = Storefront.cartCount(cart);
      if (countEl) countEl.textContent = String(count);

      const subtotal = Storefront.cartSubtotal(products, cart);
      if (cartTotalEl) cartTotalEl.textContent = formatter.format(subtotal);

      if (!itemsHost) return;
      itemsHost.innerHTML = "";

      if (!cart.items.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        const p1 = document.createElement("p");
        p1.className = "empty-title";
        p1.textContent = "السلة فاضية.";
        const p2 = document.createElement("p");
        p2.className = "empty-subtitle";
        p2.textContent = "اختار منتج واضفه للسلة.";
        empty.appendChild(p1);
        empty.appendChild(p2);
        itemsHost.appendChild(empty);
        Storefront.hydrateIcons();
        return;
      }

      cart.items.forEach((it) => {
        const product = Storefront.getProductById(products, it.id);
        if (!product) return;

        const row = document.createElement("div");
        row.className = "cart-item";

        const thumb = document.createElement("a");
        thumb.className = "thumb";
        thumb.href = "product.html?id=" + encodeURIComponent(product.id);
        const img = document.createElement("img");
        img.alt = product.name;
        img.loading = "lazy";
        Storefront.setImage(img, product.images?.[0]);
        thumb.appendChild(img);

        const meta = document.createElement("div");
        meta.className = "cart-meta";

        const titleRow = document.createElement("div");
        titleRow.className = "cart-title";
        const link = document.createElement("a");
        link.href = "product.html?id=" + encodeURIComponent(product.id);
        link.textContent = product.name;

        const price = document.createElement("span");
        price.className = "muted tiny";
        price.textContent = formatter.format(product.price || 0);

        titleRow.appendChild(link);
        titleRow.appendChild(price);

        const qtyRow = document.createElement("div");
        qtyRow.className = "qty-row";

        const stepper = document.createElement("div");
        stepper.className = "stepper";

        const minus = document.createElement("button");
        minus.type = "button";
        minus.setAttribute("aria-label", "تقليل");
        minus.innerHTML = '<span class="icon" data-icon="minus"></span>';

        const input = document.createElement("input");
        input.type = "number";
        input.min = "1";
        input.max = "99";
        input.value = String(it.qty);
        input.inputMode = "numeric";

        const plus = document.createElement("button");
        plus.type = "button";
        plus.setAttribute("aria-label", "زيادة");
        plus.innerHTML = '<span class="icon" data-icon="plus"></span>';

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "btn btn-ghost";
        remove.title = "حذف";
        remove.setAttribute("aria-label", "حذف");
        remove.innerHTML = '<span class="icon" data-icon="trash"></span>';

        function setQty(nextQty) {
          Storefront.cartSetQty(product.id, nextQty);
          renderCart();
          Storefront.hydrateIcons();
        }

        minus.addEventListener("click", () => setQty(Number(input.value) - 1));
        plus.addEventListener("click", () => setQty(Number(input.value) + 1));
        input.addEventListener("change", () => setQty(Number(input.value)));
        remove.addEventListener("click", () => setQty(0));

        stepper.appendChild(minus);
        stepper.appendChild(input);
        stepper.appendChild(plus);

        const lineTotal = document.createElement("strong");
        lineTotal.textContent = formatter.format((product.price || 0) * it.qty);

        qtyRow.appendChild(stepper);
        qtyRow.appendChild(lineTotal);

        meta.appendChild(titleRow);
        meta.appendChild(qtyRow);
        meta.appendChild(remove);

        row.appendChild(thumb);
        row.appendChild(meta);
        itemsHost.appendChild(row);
      });

      Storefront.hydrateIcons();
    }

    if (openBtn) openBtn.addEventListener("click", () => setOpen(true));
    if (closeBtn) closeBtn.addEventListener("click", () => setOpen(false));
    if (overlay) overlay.addEventListener("click", () => setOpen(false));
    if (clearBtn)
      clearBtn.addEventListener("click", () => {
        Storefront.cartClear();
        renderCart();
        Storefront.toast(config.name || "تم", "اتمسحت السلة");
      });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });

    renderCart();
    return { renderCart, setOpen };
  }

  document.addEventListener("DOMContentLoaded", () => {
    const config = Storefront.getConfig();
    const products = Storefront.loadProducts();
    const formatter = Storefront.moneyFormatter(config);

    const grid = qs("productsGrid");
    const emptyState = qs("emptyState");
    const searchInput = qs("searchInput");
    const categorySelect = qs("categorySelect");
    const sortSelect = qs("sortSelect");
    const themeToggle = qs("themeToggle");

    buildCategoryOptions(categorySelect, products);

    const cartUI = wireCartDrawer(products, config, formatter);
    window.addEventListener("storefront:accountchange", () => cartUI?.renderCart?.());

    function onAddToCart(productId) {
      const p = Storefront.getProductById(products, productId);
      if (!p) return;
      Storefront.cartAdd(productId, 1);
      cartUI?.renderCart?.();
      Storefront.toast("تمت الإضافة", p.name);
    }

    function rerender() {
      const list = applyFilters(products, searchInput?.value, categorySelect?.value, sortSelect?.value);
      renderProducts(grid, list, formatter, onAddToCart);
      Storefront.hydrateIcons();
      if (emptyState) emptyState.hidden = list.length !== 0;
    }

    let t = null;
    function scheduleRender() {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(rerender, 80);
    }

    if (searchInput) searchInput.addEventListener("input", scheduleRender);
    if (categorySelect) categorySelect.addEventListener("change", rerender);
    if (sortSelect) sortSelect.addEventListener("change", rerender);

    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme") || "light";
        Storefront.setTheme(current === "dark" ? "light" : "dark");
      });
    }

    rerender();
  });
})();
