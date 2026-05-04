(() => {
  function qs(id) {
    return document.getElementById(id);
  }

  function safeNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function uid() {
    return "p-" + Math.random().toString(16).slice(2, 10) + "-" + Date.now().toString(16);
  }

  function imageListText(images) {
    return Storefront.normalizeImages(images).join("\n");
  }

  function firstImage(value) {
    return Storefront.normalizeImages(value)[0] || Storefront.FALLBACK_IMAGE;
  }

  function appendImagePath(textarea, path) {
    if (!textarea) return;
    const next = Storefront.normalizeImagePath(path);
    if (!next) return;
    const current = String(textarea.value || "").trim();
    textarea.value = current ? current + "\n" + next : next;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function wireAdminGate(config) {
    const expectedPasswords = new Set(
      [window.STORE_CONFIG?.adminPassword, config?.adminPassword, "312007"]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    );
    const key = "storefront_admin_unlocked_v1";

    function unlock() {
      document.body.classList.remove("admin-locked");
      try {
        sessionStorage.setItem(key, "true");
      } catch {
        // ignore
      }
    }

    try {
      if (sessionStorage.getItem(key) === "true") {
        unlock();
        return true;
      }
    } catch {
      // ignore
    }

    const gate = document.createElement("div");
    gate.className = "admin-gate";
    gate.innerHTML =
      '<form class="account-box admin-gate-box" id="adminGateForm" novalidate>' +
      '<div class="drawer-head"><h1 class="drawer-title">دخول لوحة التحكم</h1></div>' +
      '<div class="account-body">' +
      '<label class="field"><span class="field-label">الباسورد</span><input id="adminGatePassword" type="password" autocomplete="current-password" required /></label>' +
      '<button class="btn btn-primary btn-wide" type="submit">دخول</button>' +
      '<p class="muted tiny">قفل مناسب لموقع ثابت على GitHub Pages. الأمان الكامل يحتاج سيرفر وتسجيل دخول حقيقي.</p>' +
      "</div>" +
      "</form>";
    document.body.appendChild(gate);

    const form = document.getElementById("adminGateForm");
    const passInput = document.getElementById("adminGatePassword");
    passInput?.focus();

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!expectedPasswords.has(String(passInput?.value || "").trim())) {
        Storefront.toast("باسورد غلط", "راجع الباسورد وحاول تاني");
        passInput?.select();
        return;
      }
      gate.remove();
      unlock();
      Storefront.toast("تم الدخول", "لوحة التحكم جاهزة");
    });

    return false;
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function renderProductRow(product) {
    const row = document.createElement("div");
    row.className = "product-row";
    row.dataset.id = product.id;

    const thumb = document.createElement("div");
    thumb.className = "thumb";
    const img = document.createElement("img");
    img.alt = product.name || "";
    img.loading = "lazy";
    Storefront.setImage(img, product.images?.[0]);
    thumb.appendChild(img);

    const content = document.createElement("div");

    const fields = document.createElement("div");
    fields.className = "row-fields";

    function mkField(label, inputEl) {
      const wrap = document.createElement("label");
      wrap.className = "field tiny";
      const t = document.createElement("span");
      t.className = "field-label";
      t.textContent = label;
      wrap.appendChild(t);
      wrap.appendChild(inputEl);
      return wrap;
    }

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = product.name || "";
    nameInput.dataset.field = "name";

    const priceInput = document.createElement("input");
    priceInput.type = "number";
    priceInput.inputMode = "numeric";
    priceInput.value = String(product.price ?? 0);
    priceInput.dataset.field = "price";

    const catInput = document.createElement("input");
    catInput.type = "text";
    catInput.value = product.category || "";
    catInput.dataset.field = "category";

    fields.appendChild(mkField("الاسم", nameInput));
    fields.appendChild(mkField("السعر", priceInput));
    fields.appendChild(mkField("التصنيف", catInput));

    const details = document.createElement("details");
    details.style.marginTop = "10px";
    const summary = document.createElement("summary");
    summary.className = "subtle-link";
    summary.textContent = "تفاصيل";
    details.appendChild(summary);

    const adv = document.createElement("div");
    adv.className = "form-grid";
    adv.style.marginTop = "10px";

    const skuInput = document.createElement("input");
    skuInput.type = "text";
    skuInput.value = product.sku || "";
    skuInput.dataset.field = "sku";

    const stockInput = document.createElement("input");
    stockInput.type = "number";
    stockInput.inputMode = "numeric";
    stockInput.value = product.stock == null ? "" : String(product.stock);
    stockInput.dataset.field = "stock";

    const compareAtInput = document.createElement("input");
    compareAtInput.type = "number";
    compareAtInput.inputMode = "numeric";
    compareAtInput.value = product.compareAt == null ? "" : String(product.compareAt);
    compareAtInput.dataset.field = "compareAt";

    const badgeInput = document.createElement("input");
    badgeInput.type = "text";
    badgeInput.value = product.badge || "";
    badgeInput.dataset.field = "badge";

    const imagesInput = document.createElement("textarea");
    imagesInput.rows = 3;
    imagesInput.placeholder = "assets/store/product.jpg";
    imagesInput.value = imageListText(product.images);
    imagesInput.dataset.field = "images";
    imagesInput.addEventListener("input", () => {
      Storefront.setImage(img, firstImage(imagesInput.value));
    });

    const imageTools = document.createElement("div");
    imageTools.className = "image-tools";
    const addImagePathBtn = document.createElement("button");
    addImagePathBtn.type = "button";
    addImagePathBtn.className = "btn btn-ghost";
    addImagePathBtn.textContent = "أضف صورة";
    addImagePathBtn.addEventListener("click", () => {
      const path = window.prompt("اسم الصورة أو المسار", "product-new.jpg");
      appendImagePath(imagesInput, path);
    });
    imageTools.appendChild(addImagePathBtn);

    const descInput = document.createElement("textarea");
    descInput.rows = 3;
    descInput.value = product.description || "";
    descInput.dataset.field = "description";

    const highlightsInput = document.createElement("textarea");
    highlightsInput.rows = 3;
    highlightsInput.value = Array.isArray(product.highlights) ? product.highlights.join("\n") : "";
    highlightsInput.dataset.field = "highlights";

    const specsInput = document.createElement("textarea");
    specsInput.rows = 4;
    specsInput.value = Array.isArray(product.specs)
      ? product.specs
          .map((it) => String(it?.label || "").trim() + ": " + String(it?.value || "").trim())
          .filter((s) => s.trim() !== ":")
          .join("\n")
      : "";
    specsInput.dataset.field = "specs";

    const idInput = document.createElement("input");
    idInput.type = "text";
    idInput.value = product.id || "";
    idInput.readOnly = true;
    idInput.dataset.field = "id";

    const split0 = document.createElement("div");
    split0.className = "split";
    split0.appendChild(mkField("SKU", skuInput));
    split0.appendChild(mkField("المخزون", stockInput));

    const split1 = document.createElement("div");
    split1.className = "split";
    split1.appendChild(mkField("قبل الخصم", compareAtInput));
    split1.appendChild(mkField("شارة", badgeInput));

    adv.appendChild(split0);
    adv.appendChild(split1);
    const imagesField = mkField("الصور", imagesInput);
    imagesField.appendChild(imageTools);
    adv.appendChild(imagesField);
    adv.appendChild(mkField("الوصف", descInput));
    adv.appendChild(mkField("نقاط سريعة (سطر لكل نقطة)", highlightsInput));
    adv.appendChild(mkField("مواصفات (label: value في كل سطر)", specsInput));
    adv.appendChild(mkField("ID", idInput));

    details.appendChild(adv);

    content.appendChild(fields);
    content.appendChild(details);

    const del = document.createElement("button");
    del.className = "icon-btn";
    del.type = "button";
    del.title = "حذف";
    del.setAttribute("aria-label", "حذف");
    del.innerHTML = '<span class="icon" data-icon="trash"></span>';
    del.addEventListener("click", () => {
      row.remove();
      Storefront.toast("تم الحذف", "ما تنساش تحفظ المنتجات");
    });

    row.appendChild(thumb);
    row.appendChild(content);
    row.appendChild(del);
    return row;
  }

  function collectProductsFromDom(host) {
    const rows = Array.from(host.querySelectorAll(".product-row"));
    return rows
      .map((row) => {
        const get = (field) => row.querySelector('[data-field="' + field + '"]');
        const id = String(get("id")?.value || row.dataset.id || "").trim();
        const name = String(get("name")?.value || "").trim();
        const sku = String(get("sku")?.value || "").trim();
        const category = String(get("category")?.value || "أخرى").trim();
        const price = safeNumber(get("price")?.value, 0);
        const stockRaw = String(get("stock")?.value || "").trim();
        const stock = stockRaw ? safeNumber(stockRaw, null) : null;

        const compareRaw = String(get("compareAt")?.value || "").trim();
        const compareAt = compareRaw ? safeNumber(compareRaw, null) : null;

        const badge = String(get("badge")?.value || "").trim();
        const images = Storefront.normalizeImages(get("images")?.value || "");
        const description = String(get("description")?.value || "").trim();

        const highlights = String(get("highlights")?.value || "")
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);

        const specs = String(get("specs")?.value || "")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const idx = line.indexOf(":");
            if (idx <= 0) return null;
            const label = line.slice(0, idx).trim();
            const value = line.slice(idx + 1).trim();
            if (!label || !value) return null;
            return { label, value };
          })
          .filter(Boolean);

        return {
          id,
          name,
          sku,
          stock,
          price,
          compareAt,
          category,
          badge,
          images,
          description,
          highlights,
          specs
        };
      })
      .filter((p) => p.id && p.name);
  }

  function validateUniqueIds(products) {
    const seen = new Set();
    for (const p of products) {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
    }
    return true;
  }

  function fillSettings(config) {
    const name = qs("storeName");
    const tagline = qs("storeTagline");
    const title = qs("storeTitle");
    const currency = qs("storeCurrency");
    const locale = qs("storeLocale");
    const wa = qs("storeWhatsApp");
    const waLink = qs("storeWhatsAppLink");
    const adminPassword = qs("adminPassword");
    const flat = qs("shipFlat");
    const freeOver = qs("shipFreeOver");

    if (name) name.value = config.name || "";
    if (tagline) tagline.value = config.tagline || "";
    if (title) title.value = config.title || "";
    if (currency) currency.value = config.currency || "";
    if (locale) locale.value = config.locale || "";
    if (wa) wa.value = config.whatsappPhone || "";
    if (waLink) waLink.value = config.whatsappLink || "";
    if (adminPassword) adminPassword.value = config.adminPassword || "";
    if (flat) flat.value = String(Number(config?.shipping?.flatFee || 0));
    if (freeOver) freeOver.value = String(Number(config?.shipping?.freeOver || 0));
  }

  function readSettings() {
    const name = String(qs("storeName")?.value || "").trim();
    const tagline = String(qs("storeTagline")?.value || "").trim();
    const title = String(qs("storeTitle")?.value || "").trim();
    const currency = String(qs("storeCurrency")?.value || "").trim() || "EGP";
    const locale = String(qs("storeLocale")?.value || "").trim() || "ar-EG";
    const whatsappPhone = String(qs("storeWhatsApp")?.value || "").trim();
    const whatsappLink = String(qs("storeWhatsAppLink")?.value || "").trim();
    const adminPassword = String(qs("adminPassword")?.value || "").trim() || "admin123";
    const flatFee = safeNumber(qs("shipFlat")?.value, 0);
    const freeOver = safeNumber(qs("shipFreeOver")?.value, 0);
    return {
      name,
      tagline,
      title,
      currency,
      locale,
      whatsappPhone,
      whatsappLink,
      adminPassword,
      shipping: { flatFee, freeOver }
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    const themeToggle = qs("themeToggle");
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme") || "light";
        Storefront.setTheme(current === "dark" ? "light" : "dark");
      });
    }

    let config = Storefront.getConfig();
    wireAdminGate(config);
    fillSettings(config);

    const settingsForm = qs("settingsForm");
    const resetSettings = qs("resetSettings");

    if (settingsForm) {
      settingsForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const next = readSettings();
        if (!next.name) {
          Storefront.toast("اسم المتجر مطلوب", "اكتب اسم بسيط");
          return;
        }
        Storefront.saveToStorage(Storefront.STORAGE.config, JSON.stringify(next));
        config = Storefront.getConfig();
        Storefront.hydrateBrand();
        Storefront.toast("تم الحفظ", "إعدادات المتجر");
      });
    }

    if (resetSettings) {
      resetSettings.addEventListener("click", () => {
        try {
          localStorage.removeItem(Storefront.STORAGE.config);
        } catch {
          // ignore
        }
        config = Storefront.getConfig();
        fillSettings(config);
        Storefront.hydrateBrand();
        Storefront.toast("تم الإرجاع", "رجعنا للإعدادات الافتراضية");
      });
    }

    const host = qs("productsHost");
    const addBtn = qs("addProduct");
    const saveProducts = qs("saveProducts");
    const resetProducts = qs("resetProducts");
    const exportJson = qs("exportJson");
    const exportJs = qs("exportJs");
    const importBtn = qs("importJson");
    const importPanel = qs("importPanel");
    const closeImport = qs("closeImport");
    const importText = qs("importText");
    const applyImport = qs("applyImport");
    const productSearch = qs("productSearch");

    function renderProducts(products) {
      if (!host) return;
      host.innerHTML = "";
      products.forEach((p) => host.appendChild(renderProductRow(p)));
      Storefront.hydrateIcons();
    }

    function loadCurrentProducts() {
      return Storefront.loadProducts();
    }

    renderProducts(loadCurrentProducts());

    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const p = {
          id: uid(),
          name: "منتج جديد",
          sku: "",
          stock: null,
          price: 0,
          compareAt: null,
          category: "أخرى",
          badge: "",
          images: [Storefront.FALLBACK_IMAGE],
          description: "",
          highlights: [],
          specs: []
        };
        if (!host) return;
        host.prepend(renderProductRow(p));
        Storefront.hydrateIcons();
        Storefront.toast("تمت الإضافة", "عدّل البيانات ثم احفظ المنتجات");
      });
    }

    function filterRows() {
      if (!host) return;
      const q = String(productSearch?.value || "")
        .trim()
        .toLowerCase();
      const rows = Array.from(host.querySelectorAll(".product-row"));
      rows.forEach((row) => {
        const name = String(row.querySelector('[data-field="name"]')?.value || "").toLowerCase();
        const cat = String(row.querySelector('[data-field="category"]')?.value || "").toLowerCase();
        row.style.display = !q || name.includes(q) || cat.includes(q) ? "" : "none";
      });
    }

    if (productSearch) productSearch.addEventListener("input", filterRows);

    if (saveProducts) {
      saveProducts.addEventListener("click", () => {
        if (!host) return;
        const products = collectProductsFromDom(host);
        if (!products.length) {
          Storefront.toast("مفيش منتجات", "اضف منتج واحد على الأقل");
          return;
        }
        if (!validateUniqueIds(products)) {
          Storefront.toast("IDs متكررة", "لازم كل منتج يكون له ID مختلف");
          return;
        }
        Storefront.saveToStorage(Storefront.STORAGE.products, JSON.stringify(products));
        Storefront.toast("تم الحفظ", "المنتجات");
      });
    }

    if (resetProducts) {
      resetProducts.addEventListener("click", () => {
        try {
          localStorage.removeItem(Storefront.STORAGE.products);
        } catch {
          // ignore
        }
        renderProducts(loadCurrentProducts());
        Storefront.toast("تم المسح", "تم الرجوع لمنتجات الملف");
      });
    }

    if (exportJson) {
      exportJson.addEventListener("click", () => {
        if (!host) return;
        const products = collectProductsFromDom(host);
        downloadText("products.json", JSON.stringify(products, null, 2), "application/json;charset=utf-8");
        Storefront.toast("تم التصدير", "products.json");
      });
    }

    if (exportJs) {
      exportJs.addEventListener("click", () => {
        if (!host) return;
        const products = collectProductsFromDom(host);
        const settings = readSettings();
        const js =
          "window.STORE_CONFIG = " +
          JSON.stringify(settings, null, 2) +
          ";\n\n" +
          "window.STORE_PRODUCTS = " +
          JSON.stringify(products, null, 2) +
          ";\n";
        downloadText("store-data.export.js", js, "text/javascript;charset=utf-8");
        Storefront.toast("تم التصدير", "store-data.export.js");
      });
    }

    function openImport(show) {
      if (!importPanel) return;
      importPanel.hidden = !show;
      if (show) {
        importText?.focus();
        Storefront.hydrateIcons();
      }
    }

    if (importBtn) {
      importBtn.addEventListener("click", () => {
        if (importText && host) {
          const products = collectProductsFromDom(host);
          importText.value = JSON.stringify(products, null, 2);
        }
        openImport(true);
      });
    }

    if (closeImport) closeImport.addEventListener("click", () => openImport(false));

    if (applyImport) {
      applyImport.addEventListener("click", () => {
        const text = String(importText?.value || "").trim();
        const parsed = text ? Storefront.safeJsonParse(text, null) : null;
        if (!Array.isArray(parsed)) {
          Storefront.toast("JSON غير صحيح", "لازم يكون مصفوفة منتجات");
          return;
        }
        renderProducts(
          parsed.map((p) => ({
            id: String(p?.id || "").trim() || uid(),
            name: String(p?.name || "").trim() || "منتج",
            sku: String(p?.sku || "").trim(),
            stock: p?.stock == null ? null : safeNumber(p.stock, null),
            price: safeNumber(p?.price, 0),
            compareAt: p?.compareAt == null ? null : safeNumber(p.compareAt, null),
            category: String(p?.category || "أخرى").trim(),
            badge: String(p?.badge || "").trim(),
            images: Storefront.normalizeImages(p?.images),
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
        );
        openImport(false);
        Storefront.toast("تم الاستيراد", "راجع ثم احفظ المنتجات");
      });
    }
  });
})();
