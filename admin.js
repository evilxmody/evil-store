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

  const GITHUB_SETTINGS_KEY = "evil_store_github_sync_v1";

  function inferGithubDefaults() {
    const host = window.location.hostname;
    const firstPathPart = window.location.pathname.split("/").filter(Boolean)[0] || "";
    const pathRepo = firstPathPart && !firstPathPart.includes(".") ? firstPathPart : "evil-store";
    const owner = host.endsWith(".github.io") ? host.replace(".github.io", "") : "";
    return { owner, repo: pathRepo, branch: "main", dataPath: "store-data.js", token: "" };
  }

  function readGithubSettings() {
    const defaults = inferGithubDefaults();
    const stored = Storefront.safeJsonParse(Storefront.loadFromStorage(GITHUB_SETTINGS_KEY) || "null", null);
    return {
      owner: String(stored?.owner || defaults.owner || "").trim(),
      repo: String(stored?.repo || defaults.repo || "").trim(),
      branch: String(stored?.branch || defaults.branch || "main").trim(),
      dataPath: String(stored?.dataPath || defaults.dataPath || "store-data.js").trim(),
      token: String(stored?.token || "").trim()
    };
  }

  function saveGithubSettings(settings) {
    Storefront.saveToStorage(GITHUB_SETTINGS_KEY, JSON.stringify(settings));
  }

  function fillGithubSettings() {
    const settings = readGithubSettings();
    const fields = {
      githubOwner: settings.owner,
      githubRepo: settings.repo,
      githubBranch: settings.branch,
      githubDataPath: settings.dataPath,
      githubToken: settings.token
    };
    Object.entries(fields).forEach(([id, value]) => {
      const el = qs(id);
      if (el) el.value = value;
    });
  }

  function collectGithubSettings() {
    return {
      owner: String(qs("githubOwner")?.value || "").trim(),
      repo: String(qs("githubRepo")?.value || "").trim(),
      branch: String(qs("githubBranch")?.value || "main").trim(),
      dataPath: String(qs("githubDataPath")?.value || "store-data.js").trim(),
      token: String(qs("githubToken")?.value || "").trim()
    };
  }

  function requireGithubSettings() {
    const settings = collectGithubSettings();
    if (!settings.owner || !settings.repo || !settings.branch || !settings.dataPath || !settings.token) {
      Storefront.toast("بيانات GitHub ناقصة", "املأ Owner / Repo / Branch / Token");
      return null;
    }
    saveGithubSettings(settings);
    return settings;
  }

  function githubContentUrl(settings, path) {
    const cleanPath = String(path || settings.dataPath)
      .replace(/^\/+/, "")
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    return "https://api.github.com/repos/" + encodeURIComponent(settings.owner) + "/" + encodeURIComponent(settings.repo) + "/contents/" + cleanPath;
  }

  function githubHeaders(settings) {
    return {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + settings.token,
      "X-GitHub-Api-Version": "2022-11-28"
    };
  }

  function toBase64Utf8(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  function fromBase64Utf8(text) {
    const binary = atob(String(text || "").replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  async function githubGetFile(settings, path) {
    const url = githubContentUrl(settings, path) + "?ref=" + encodeURIComponent(settings.branch);
    const res = await fetch(url, { headers: githubHeaders(settings) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("GitHub GET failed: " + res.status);
    return res.json();
  }

  async function githubPutFile(settings, path, content, message) {
    const current = await githubGetFile(settings, path);
    const body = {
      message,
      content: toBase64Utf8(content),
      branch: settings.branch
    };
    if (current?.sha) body.sha = current.sha;

    const res = await fetch(githubContentUrl(settings, path), {
      method: "PUT",
      headers: { ...githubHeaders(settings), "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error("GitHub PUT failed: " + res.status + " " + text.slice(0, 180));
    }
    return res.json();
  }

  async function githubPutBase64File(settings, path, base64Content, message) {
    const current = await githubGetFile(settings, path);
    const body = {
      message,
      content: String(base64Content || ""),
      branch: settings.branch
    };
    if (current?.sha) body.sha = current.sha;

    const res = await fetch(githubContentUrl(settings, path), {
      method: "PUT",
      headers: { ...githubHeaders(settings), "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error("GitHub image upload failed: " + res.status + " " + text.slice(0, 180));
    }
    return res.json();
  }

  function buildStoreDataJs(config, products) {
    return (
      "window.STORE_CONFIG = " +
      JSON.stringify(config, null, 2) +
      ";\n\n" +
      "window.STORE_PRODUCTS = " +
      JSON.stringify(products, null, 2) +
      ";\n"
    );
  }

  function parseStoreDataJs(code) {
    const scope = {};
    Function("window", String(code || "") + "\nreturn window;")(scope);
    return {
      config: scope.STORE_CONFIG || {},
      products: Array.isArray(scope.STORE_PRODUCTS) ? scope.STORE_PRODUCTS : []
    };
  }

  function safeFilename(name) {
    const ext = String(name || "image.jpg").split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const base = String(name || "product")
      .replace(/\.[^.]+$/, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .slice(0, 44) || "product";
    return Date.now().toString(36) + "-" + Math.random().toString(16).slice(2, 6) + "-" + base + "." + ext;
  }

  async function uploadImagesToGithub(files, textarea) {
    const settings = requireGithubSettings();
    if (!settings) return;
    const list = Array.from(files || []);
    if (!list.length) return;
    Storefront.toast("جاري رفع الصور", String(list.length) + " صورة");

    for (const file of list) {
      const path = "assets/store/" + safeFilename(file.name);
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1] || "";
      await githubPutBase64File(settings, path, base64, "Upload product image " + path);
      appendImagePath(textarea, path);
    }

    Storefront.toast("تم رفع الصور", "اتضافت مسارات الصور للمنتج");
  }

  async function publishDataToGithub(products) {
    const settings = requireGithubSettings();
    if (!settings) return;
    const config = readSettings();
    const js = buildStoreDataJs(config, products);
    await githubPutFile(settings, settings.dataPath, js, "Update store products from admin");
    Storefront.toast("اتنشر على GitHub", settings.dataPath);
  }

  function fmtDate(value) {
    if (!value) return "";
    try {
      return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
    } catch {
      return String(value);
    }
  }

  function statusClass(status) {
    return "status-" + String(status || "pending");
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
    const uploadImagesInput = document.createElement("input");
    uploadImagesInput.type = "file";
    uploadImagesInput.accept = "image/*";
    uploadImagesInput.multiple = true;
    uploadImagesInput.hidden = true;
    const uploadImagesBtn = document.createElement("button");
    uploadImagesBtn.type = "button";
    uploadImagesBtn.className = "btn btn-primary";
    uploadImagesBtn.textContent = "رفع صور";
    uploadImagesBtn.addEventListener("click", () => uploadImagesInput.click());
    uploadImagesInput.addEventListener("change", async () => {
      try {
        await uploadImagesToGithub(uploadImagesInput.files, imagesInput);
      } catch (err) {
        Storefront.toast("فشل رفع الصور", err.message || "راجع بيانات GitHub");
      } finally {
        uploadImagesInput.value = "";
      }
    });
    imageTools.appendChild(addImagePathBtn);
    imageTools.appendChild(uploadImagesBtn);
    imageTools.appendChild(uploadImagesInput);

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

  function renderOrders(host, archived = false) {
    if (!host) return;
    const orders = Storefront.ordersLoad().filter((order) => Boolean(order.archived) === archived);
    host.innerHTML = "";

    if (!orders.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = archived
        ? '<p class="empty-title">الأرشيف فاضي.</p><p class="empty-subtitle">الطلبات المرفوضة أو المؤرشفة هتظهر هنا.</p>'
        : '<p class="empty-title">مفيش طلبات لسه.</p><p class="empty-subtitle">أي طلب جديد هيظهر هنا للموافقة أو الرفض.</p>';
      host.appendChild(empty);
      return;
    }

    orders.forEach((order) => {
      const card = document.createElement("article");
      card.className = "admin-order-card";

      const head = document.createElement("div");
      head.className = "order-head";
      const title = document.createElement("div");
      title.innerHTML =
        '<span class="muted tiny">رقم الأوردر</span><strong class="order-id">' +
        order.id +
        '</strong><span class="muted tiny">' +
        fmtDate(order.createdAt) +
        "</span>";
      const pill = document.createElement("span");
      pill.className = "status-pill " + statusClass(order.status);
      pill.textContent = Storefront.orderStatusLabel(order.status);
      head.appendChild(title);
      head.appendChild(pill);

      const meta = document.createElement("div");
      meta.className = "order-meta";
      meta.innerHTML =
        '<div><span class="muted tiny">العميل</span><strong>' +
        (order.customer?.name || "-") +
        '</strong></div><div><span class="muted tiny">الموبايل</span><strong>' +
        (order.customer?.phone || "-") +
        '</strong></div><div><span class="muted tiny">الإجمالي</span><strong>' +
        (order.totals?.total || "0") +
        "</strong></div>";

      const details = document.createElement("details");
      details.className = "admin-order-details";
      details.open = true;
      const summary = document.createElement("summary");
      summary.className = "subtle-link";
      summary.textContent = "تفاصيل الطلب";
      const detailsGrid = document.createElement("div");
      detailsGrid.className = "order-details-grid";

      function detailField(label, value) {
        const box = document.createElement("div");
        const small = document.createElement("span");
        small.className = "muted tiny";
        small.textContent = label;
        const strong = document.createElement("strong");
        strong.textContent = value || "-";
        box.appendChild(small);
        box.appendChild(strong);
        return box;
      }

      detailsGrid.appendChild(detailField("العنوان", order.customer?.address));
      detailsGrid.appendChild(detailField("المحافظة / المدينة", order.customer?.city));
      detailsGrid.appendChild(detailField("طريقة الدفع", order.customer?.payment));
      detailsGrid.appendChild(detailField("ملاحظات العميل", order.customer?.notes));
      detailsGrid.appendChild(detailField("إجمالي المنتجات", order.totals?.subtotal));
      detailsGrid.appendChild(detailField("الشحن", order.totals?.shipping));
      detailsGrid.appendChild(detailField("آخر تحديث", fmtDate(order.updatedAt)));
      details.appendChild(summary);
      details.appendChild(detailsGrid);

      const items = document.createElement("div");
      items.className = "summary";
      (order.items || []).forEach((it) => {
        const row = document.createElement("div");
        row.className = "summary-item";
        row.innerHTML = "<span>" + it.name + " × " + it.qty + "</span><strong>" + it.lineTotal + "</strong>";
        items.appendChild(row);
      });

      const history = document.createElement("ol");
      history.className = "timeline";
      (order.history || []).forEach((step) => {
        const li = document.createElement("li");
        li.className = statusClass(step.status);
        const strong = document.createElement("strong");
        strong.textContent = Storefront.orderStatusLabel(step.status);
        const span = document.createElement("span");
        span.className = "muted tiny";
        span.textContent = fmtDate(step.at) + (step.note ? " - " + step.note : "");
        li.appendChild(strong);
        li.appendChild(span);
        history.appendChild(li);
      });

      const rejectField = document.createElement("label");
      rejectField.className = "field rejection-field";
      const rejectLabel = document.createElement("span");
      rejectLabel.className = "field-label";
      rejectLabel.textContent = "سبب الرفض";
      const rejectReason = document.createElement("textarea");
      rejectReason.rows = 2;
      rejectReason.placeholder = "مثال: المنتج غير متوفر / بيانات العنوان ناقصة";
      rejectField.appendChild(rejectLabel);
      rejectField.appendChild(rejectReason);

      const actions = document.createElement("div");
      actions.className = "drawer-actions order-actions";
      if (archived) {
        const restore = document.createElement("button");
        restore.type = "button";
        restore.className = "btn btn-primary";
        restore.textContent = "استرجاع من الأرشيف";
        restore.addEventListener("click", () => {
          Storefront.orderRestore(order.id);
          Storefront.toast("تم استرجاع الطلب", order.id);
          renderOrders(host, true);
          renderOrders(qs("ordersHost"), false);
        });
        actions.appendChild(restore);
      } else {
        [
          ["approved", "قبول"],
          ["rejected", "رفض"],
          ["shipped", "تم الشحن"],
          ["delivered", "تم التسليم"]
        ].forEach(([status, label]) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = status === "rejected" ? "btn btn-danger" : "btn btn-primary";
          btn.textContent = label;
          btn.disabled = order.status === status || order.status === "cancelled";
          btn.addEventListener("click", () => {
            const reason = String(rejectReason.value || "").trim();
            if (status === "rejected" && !reason) {
              Storefront.toast("اكتب سبب الرفض", order.id);
              rejectReason.focus();
              return;
            }
            const note = status === "rejected" ? "سبب الرفض: " + reason : label + " من الأدمن";
            Storefront.orderSetStatus(order.id, status, note);
            if (status === "rejected") Storefront.orderArchive(order.id);
            Storefront.toast(status === "rejected" ? "اترفض واتنقل للأرشيف" : "تم تحديث الطلب", order.id);
            renderOrders(host, false);
            renderOrders(qs("ordersArchiveHost"), true);
          });
          actions.appendChild(btn);
        });

        const archive = document.createElement("button");
        archive.type = "button";
        archive.className = "btn btn-ghost";
        archive.textContent = "أرشفة";
        archive.addEventListener("click", () => {
          Storefront.orderArchive(order.id);
          Storefront.toast("اتنقل للأرشيف", order.id);
          renderOrders(host, false);
          renderOrders(qs("ordersArchiveHost"), true);
        });
        actions.appendChild(archive);
      }

      card.appendChild(head);
      card.appendChild(meta);
      card.appendChild(details);
      card.appendChild(items);
      card.appendChild(history);
      if (!archived) card.appendChild(rejectField);
      card.appendChild(actions);
      host.appendChild(card);
    });
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
    const saveGithubSettingsBtn = qs("saveGithubSettings");
    const publishGithubBtn = qs("publishGithub");
    const loadGithubDataBtn = qs("loadGithubData");
    const ordersHost = qs("ordersHost");
    const refreshOrders = qs("refreshOrders");
    const ordersArchiveHost = qs("ordersArchiveHost");
    const refreshArchive = qs("refreshArchive");

    fillGithubSettings();

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
    renderOrders(ordersHost, false);
    renderOrders(ordersArchiveHost, true);
    if (refreshOrders) refreshOrders.addEventListener("click", () => renderOrders(ordersHost, false));
    if (refreshArchive) refreshArchive.addEventListener("click", () => renderOrders(ordersArchiveHost, true));

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

    if (saveGithubSettingsBtn) {
      saveGithubSettingsBtn.addEventListener("click", () => {
        const settings = collectGithubSettings();
        if (!settings.owner || !settings.repo || !settings.branch || !settings.dataPath || !settings.token) {
          Storefront.toast("بيانات ناقصة", "املأ بيانات GitHub كلها");
          return;
        }
        saveGithubSettings(settings);
        Storefront.toast("تم حفظ الربط", settings.owner + "/" + settings.repo);
      });
    }

    if (publishGithubBtn) {
      publishGithubBtn.addEventListener("click", async () => {
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
        try {
          publishGithubBtn.disabled = true;
          publishGithubBtn.textContent = "جاري النشر...";
          Storefront.saveToStorage(Storefront.STORAGE.products, JSON.stringify(products));
          await publishDataToGithub(products);
        } catch (err) {
          Storefront.toast("فشل النشر", err.message || "راجع بيانات GitHub");
        } finally {
          publishGithubBtn.disabled = false;
          publishGithubBtn.textContent = "نشر على GitHub";
        }
      });
    }

    if (loadGithubDataBtn) {
      loadGithubDataBtn.addEventListener("click", async () => {
        const settings = requireGithubSettings();
        if (!settings) return;
        try {
          loadGithubDataBtn.disabled = true;
          loadGithubDataBtn.textContent = "جاري التحميل...";
          const file = await githubGetFile(settings, settings.dataPath);
          if (!file?.content) throw new Error("ملف البيانات مش موجود");
          const parsed = parseStoreDataJs(fromBase64Utf8(file.content));
          Storefront.saveToStorage(Storefront.STORAGE.config, JSON.stringify(parsed.config));
          Storefront.saveToStorage(Storefront.STORAGE.products, JSON.stringify(parsed.products));
          config = Storefront.getConfig();
          fillSettings(config);
          renderProducts(Storefront.loadProducts());
          Storefront.toast("تم التحميل", "آخر نسخة من GitHub");
        } catch (err) {
          Storefront.toast("فشل التحميل", err.message || "راجع بيانات GitHub");
        } finally {
          loadGithubDataBtn.disabled = false;
          loadGithubDataBtn.textContent = "تحميل من GitHub";
        }
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
