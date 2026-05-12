(() => {
  function qs(id) {
    return document.getElementById(id);
  }

  function orderId() {
    return "ORD-" + Date.now().toString(36).toUpperCase();
  }

  function buildWhatsAppText(config, order) {
    const lines = [];
    lines.push("طلب جديد: " + order.id);
    lines.push("الاسم: " + (order.customer.name || ""));
    lines.push("الموبايل: " + (order.customer.phone || ""));
    if (order.customer.city) lines.push("المدينة: " + order.customer.city);
    if (order.customer.address) lines.push("العنوان: " + order.customer.address);
    if (order.customer.payment) lines.push("الدفع: " + order.customer.payment);
    lines.push("");
    lines.push("المنتجات:");
    order.items.forEach((it) => {
      lines.push("- " + it.name + " × " + it.qty + " = " + it.lineTotal);
    });
    lines.push("");
    lines.push("الإجمالي: " + order.totals.subtotal);
    lines.push("الشحن: " + order.totals.shipping);
    lines.push("الإجمالي النهائي: " + order.totals.total);
    if (order.customer.notes) {
      lines.push("");
      lines.push("ملاحظات: " + order.customer.notes);
    }
    if (config?.name) {
      lines.push("");
      lines.push("من متجر: " + config.name);
    }
    return lines.join("\n");
  }

  function buildWhatsAppHref(config, text) {
    const digits = String(config?.whatsappPhone || "").replace(/\D/g, "");
    const phone = digits.startsWith("01") ? "2" + digits : digits.replace(/^00/, "");
    if (phone) return "https://wa.me/" + encodeURIComponent(phone) + "?text=" + encodeURIComponent(text);

    const raw = String(config?.whatsappLink || "").trim();
    if (!raw) return "";
    try {
      if (!/^https?:\/\//i.test(raw)) return "";
      const url = new URL(raw, window.location.href);
      if (url.protocol !== "https:" && url.protocol !== "http:") return "";
      url.searchParams.set("text", text);
      return url.toString();
    } catch {
      return "";
    }
  }

  function renderSummary(products, cart, formatter, config) {
    const orderItems = qs("orderItems");
    const subtotalEl = qs("subtotalEl");
    const shippingEl = qs("shippingEl");
    const totalEl = qs("totalEl");
    const emptyPanel = qs("emptyCartPanel");

    const lines = (cart?.items || [])
      .map((it) => {
        const product = Storefront.getProductById(products, it.id);
        if (!product) return null;
        const qty = Storefront.clampInt(it.qty ?? 1, 1, 99);
        const price = Math.max(0, Number(product.price || 0));
        return { product, qty, lineTotal: price * qty };
      })
      .filter(Boolean);

    const subtotal = lines.reduce((sum, it) => sum + it.lineTotal, 0);
    const isEmpty = lines.length === 0;
    const shipping = isEmpty ? 0 : Storefront.shippingFee(config, subtotal);
    const total = subtotal + shipping;

    if (subtotalEl) subtotalEl.textContent = formatter.format(subtotal);
    if (shippingEl) shippingEl.textContent = formatter.format(shipping);
    if (totalEl) totalEl.textContent = formatter.format(total);

    if (orderItems) {
      orderItems.innerHTML = "";
      lines.forEach((it) => {
        const row = document.createElement("div");
        row.className = "summary-item";

        const left = document.createElement("span");
        left.textContent = it.product.name + " × " + String(it.qty);

        const right = document.createElement("strong");
        right.textContent = formatter.format(it.lineTotal);

        row.appendChild(left);
        row.appendChild(right);
        orderItems.appendChild(row);
      });
    }

    if (emptyPanel) emptyPanel.hidden = !isEmpty;

    return { subtotal, shipping, total, isEmpty };
  }

  document.addEventListener("DOMContentLoaded", () => {
    const config = Storefront.getConfig();
    const products = Storefront.loadProducts();
    const formatter = Storefront.moneyFormatter(config);

    const themeToggle = qs("themeToggle");
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme") || "light";
        Storefront.setTheme(current === "dark" ? "light" : "dark");
      });
    }

    const form = qs("checkoutForm");
    const placeBtn = qs("placeOrderBtn");
    const afterOrder = qs("afterOrder");

    const nameInput = qs("nameInput");
    const phoneInput = qs("phoneInput");
    const cityInput = qs("cityInput");
    const addressInput = qs("addressInput");
    const notesInput = qs("notesInput");
    const paymentSelect = qs("paymentSelect");

    let cart = Storefront.cartLoad();
    let totals = renderSummary(products, cart, formatter, config);

    const account = Storefront.getAccount();
    if (account) {
      if (nameInput) nameInput.value = account.name;
      if (phoneInput) phoneInput.value = account.phone;
    }

    function disableForm(disabled) {
      if (!form) return;
      form.querySelectorAll("input, textarea, select, button").forEach((el) => {
        el.disabled = disabled;
      });
    }

    if (totals.isEmpty) disableForm(true);

    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const name = String(nameInput?.value || "").trim();
      const phone = Storefront.normalizePhone(phoneInput?.value || "");
      const city = String(cityInput?.value || "").trim();
      const address = String(addressInput?.value || "").trim();
      const notes = String(notesInput?.value || "").trim();
      const payment = String(paymentSelect?.selectedOptions?.[0]?.textContent || "").trim();

      if (!name || !phone || !address) {
        Storefront.toast("بيانات ناقصة", "الاسم + الموبايل + العنوان مطلوبين");
        return;
      }
      if (!Storefront.isPhone(phone)) {
        Storefront.toast("رقم الموبايل غير صحيح", "اكتب رقم كامل");
        return;
      }

      Storefront.setAccount(name, phone);

      cart = Storefront.cartLoad();
      totals = renderSummary(products, cart, formatter, config);
      if (totals.isEmpty) {
        Storefront.toast("السلة فاضية", "ارجع للمتجر واضف منتجات");
        disableForm(true);
        return;
      }

      const id = orderId();
      const items = cart.items
        .map((it) => {
          const p = Storefront.getProductById(products, it.id);
          if (!p) return null;
          const qty = Storefront.clampInt(it.qty ?? 1, 1, 99);
          const price = Math.max(0, Number(p.price || 0));
          return {
            id: p.id,
            name: p.name,
            qty,
            unitPrice: formatter.format(price),
            lineTotal: formatter.format(price * qty)
          };
        })
        .filter(Boolean);

      const order = {
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "pending",
        customer: { name, phone, city, address, notes, payment },
        items,
        totals: {
          subtotal: formatter.format(totals.subtotal),
          shipping: formatter.format(totals.shipping),
          total: formatter.format(totals.total),
          currency: config.currency || "EGP"
        },
        history: [{ status: "pending", note: "تم استلام الطلب", at: new Date().toISOString() }]
      };

      Storefront.orderUpsert(order);
      Storefront.cartClear();
      Storefront.toast("تم تأكيد الطلب", order.id);

      if (placeBtn) {
        placeBtn.textContent = "تم";
        placeBtn.disabled = true;
      }

      if (afterOrder) {
        afterOrder.hidden = false;
        afterOrder.innerHTML = "";

        const box = document.createElement("div");
        box.className = "empty-state";

        const t = document.createElement("p");
        t.className = "empty-title";
        t.textContent = "تم استلام طلبك.";

        const s = document.createElement("p");
        s.className = "empty-subtitle";
        s.textContent = "رقم الطلب: " + order.id;

        const actions = document.createElement("div");
        actions.className = "drawer-actions";
        actions.style.marginTop = "12px";
        actions.style.gridTemplateColumns = "1fr";

        const track = document.createElement("a");
        track.className = "btn btn-primary btn-wide";
        track.href = "track.html?id=" + encodeURIComponent(order.id);
        track.textContent = "متابعة الطلب";

        const back = document.createElement("a");
        back.className = "btn btn-ghost btn-wide";
        back.href = "index.html";
        back.textContent = "الرجوع للمتجر";
        actions.appendChild(track);
        actions.appendChild(back);

        const msg = buildWhatsAppText(config, order);
        const waHref = buildWhatsAppHref(config, msg);
        if (waHref) {
          const link = document.createElement("a");
          link.className = "btn btn-primary btn-wide";
          link.href = waHref;
          link.target = "_blank";
          link.rel = "noopener";
          link.textContent = "إرسال الطلب على واتساب";
          actions.prepend(link);
          const opened = window.open(waHref, "_blank", "noopener");
          if (!opened) Storefront.toast("افتح واتساب", "اضغط زر إرسال الطلب");
        }

        box.appendChild(t);
        box.appendChild(s);
        box.appendChild(actions);
        afterOrder.appendChild(box);
      }

      cart = Storefront.cartLoad();
      renderSummary(products, cart, formatter, config);
      disableForm(true);
      window.setTimeout(() => {
        window.location.href = "track.html?id=" + encodeURIComponent(order.id);
      }, 900);
    });

    window.addEventListener("storefront:accountchange", () => {
      const nextAccount = Storefront.getAccount();
      if (nextAccount) {
        if (nameInput) nameInput.value = nextAccount.name;
        if (phoneInput) phoneInput.value = nextAccount.phone;
      }
      cart = Storefront.cartLoad();
      totals = renderSummary(products, cart, formatter, config);
      disableForm(totals.isEmpty);
    });
  });
})();
