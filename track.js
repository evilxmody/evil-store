(() => {
  function qs(id) {
    return document.getElementById(id);
  }

  function getParam(name) {
    return new URL(window.location.href).searchParams.get(name);
  }

  function fmtDate(value) {
    if (!value) return "";
    try {
      return new Intl.DateTimeFormat("ar-EG", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(value));
    } catch {
      return String(value);
    }
  }

  function statusClass(status) {
    return "status-" + String(status || "pending");
  }

  function canCancel(order) {
    return order && !["shipped", "delivered", "rejected", "cancelled"].includes(order.status);
  }

  function renderOrder(order, host) {
    if (!host) return;
    host.innerHTML = "";

    if (!order) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML =
        '<p class="empty-title">الطلب مش موجود.</p><p class="empty-subtitle">اكتب رقم الأوردر ورقم الموبايل صح.</p>';
      host.appendChild(empty);
      return;
    }

    const card = document.createElement("article");
    card.className = "order-card";

    const head = document.createElement("div");
    head.className = "order-head";
    const title = document.createElement("div");
    title.innerHTML =
      '<span class="muted tiny">رقم الأوردر</span><strong class="order-id">' +
      order.id +
      "</strong>";
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
      "</strong></div>" +
      '<div><span class="muted tiny">الموبايل</span><strong>' +
      (order.customer?.phone || "-") +
      "</strong></div>" +
      '<div><span class="muted tiny">وقت الطلب</span><strong>' +
      fmtDate(order.createdAt) +
      "</strong></div>";

    const items = document.createElement("div");
    items.className = "summary order-items";
    (order.items || []).forEach((it) => {
      const row = document.createElement("div");
      row.className = "summary-item";
      row.innerHTML = "<span>" + it.name + " × " + it.qty + "</span><strong>" + it.lineTotal + "</strong>";
      items.appendChild(row);
    });

    const totals = document.createElement("div");
    totals.className = "summary order-totals";
    totals.innerHTML =
      '<div class="summary-item"><span class="muted">إجمالي المنتجات</span><strong>' +
      (order.totals?.subtotal || "0") +
      '</strong></div><div class="summary-item"><span class="muted">الشحن</span><strong>' +
      (order.totals?.shipping || "0") +
      '</strong></div><div class="summary-item"><span class="muted">الإجمالي النهائي</span><strong>' +
      (order.totals?.total || "0") +
      "</strong></div>";

    const timeline = document.createElement("ol");
    timeline.className = "timeline";
    const history = order.history?.length
      ? order.history
      : [{ status: order.status || "pending", note: "", at: order.updatedAt || order.createdAt }];
    history.forEach((step) => {
      const li = document.createElement("li");
      li.className = statusClass(step.status);
      li.innerHTML =
        '<strong>' +
        Storefront.orderStatusLabel(step.status) +
        '</strong><span class="muted tiny">' +
        fmtDate(step.at) +
        (step.note ? " - " + step.note : "") +
        "</span>";
      timeline.appendChild(li);
    });

    const actions = document.createElement("div");
    actions.className = "drawer-actions order-actions";
    if (canCancel(order)) {
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "btn btn-danger";
      cancel.textContent = "إلغاء الطلب";
      cancel.addEventListener("click", () => {
        const updated = Storefront.orderSetStatus(order.id, "cancelled", "إلغاء من العميل");
        Storefront.toast("تم إلغاء الطلب", order.id);
        renderOrder(updated, host);
        renderSavedOrders();
      });
      actions.appendChild(cancel);
    }

    card.appendChild(head);
    card.appendChild(meta);
    card.appendChild(items);
    card.appendChild(totals);
    card.appendChild(timeline);
    card.appendChild(actions);
    host.appendChild(card);
  }

  function renderSavedOrders() {
    const host = qs("savedOrders");
    if (!host) return;
    host.innerHTML = "";

    const orders = Storefront.ordersForAccount();
    if (!orders.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = '<p class="empty-title">مفيش طلبات محفوظة.</p><p class="empty-subtitle">سجل باسمك ورقمك عشان الطلبات تظهر هنا.</p>';
      host.appendChild(empty);
      return;
    }

    orders.forEach((order) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "order-mini";
      btn.innerHTML =
        '<strong>' +
        order.id +
        '</strong><span class="status-pill ' +
        statusClass(order.status) +
        '">' +
        Storefront.orderStatusLabel(order.status) +
        '</span><span class="muted tiny">' +
        fmtDate(order.createdAt) +
        "</span>";
      btn.addEventListener("click", () => {
        qs("trackOrderInput").value = order.id;
        renderOrder(order, qs("trackResult"));
        history.replaceState(null, "", "track.html?id=" + encodeURIComponent(order.id));
      });
      host.appendChild(btn);
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

    const form = qs("trackForm");
    const orderInput = qs("trackOrderInput");
    const phoneInput = qs("trackPhoneInput");
    const result = qs("trackResult");
    const account = Storefront.getAccount();
    if (account && phoneInput) phoneInput.value = account.phone;

    const id = getParam("id") || Storefront.safeJsonParse(Storefront.loadFromStorage(Storefront.STORAGE.lastOrder) || "null", null)?.id;
    if (id && orderInput) {
      orderInput.value = id;
      renderOrder(Storefront.orderGet(id), result);
    }
    renderSavedOrders();

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const order = Storefront.orderGet(orderInput?.value);
      const phone = Storefront.normalizePhone(phoneInput?.value || "");
      if (order && phone && Storefront.phoneDigits(order.customer?.phone) !== Storefront.phoneDigits(phone)) {
        renderOrder(null, result);
        return;
      }
      renderOrder(order, result);
      if (order) history.replaceState(null, "", "track.html?id=" + encodeURIComponent(order.id));
    });

    window.addEventListener("storefront:accountchange", () => {
      const next = Storefront.getAccount();
      if (next && phoneInput) phoneInput.value = next.phone;
      renderSavedOrders();
    });
  });
})();
