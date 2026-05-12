(() => {
  function qs(id) {
    return document.getElementById(id);
  }

  function getParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  }

  function clamp(n, min, max) {
    const x = Number(n);
    if (!Number.isFinite(x)) return min;
    return Math.max(min, Math.min(max, x));
  }

  function createThumbs(thumbsEl, images, onPick) {
    if (!thumbsEl) return { setActive: () => {} };
    const maxThumbs = 10;
    const list = images.slice(0, maxThumbs);

    thumbsEl.innerHTML = "";
    const btns = list.map((src, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", "صورة " + String(idx + 1));
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      Storefront.setImage(img, src);
      btn.appendChild(img);
      btn.addEventListener("click", () => onPick(idx));
      thumbsEl.appendChild(btn);
      return btn;
    });

    function setActive(activeIdx) {
      btns.forEach((b, i) => {
        if (i === activeIdx) b.setAttribute("aria-current", "true");
        else b.removeAttribute("aria-current");
      });
    }

    return { setActive };
  }

  function createSlider(opts) {
    const sliderEl = opts.sliderEl;
    const trackEl = opts.trackEl;
    const dotsEl = opts.dotsEl;
    const prevBtn = opts.prevBtn;
    const nextBtn = opts.nextBtn;
    const images = Array.isArray(opts.images) ? opts.images : [];
    const alt = opts.alt || "";
    const onOpen = typeof opts.onOpen === "function" ? opts.onOpen : () => {};
    const onChange = typeof opts.onChange === "function" ? opts.onChange : () => {};

    if (!sliderEl || !trackEl) return { setIndex: () => {}, getIndex: () => 0 };

    let index = 0;
    let isDragging = false;
    let startX = 0;
    let baseX = 0;
    let lastDx = 0;
    let suppressClick = false;

    function width() {
      const rect = sliderEl.getBoundingClientRect();
      return rect.width || 1;
    }

    function apply(nextIndex, animate = true) {
      const max = Math.max(0, images.length - 1);
      index = clamp(nextIndex, 0, max);
      trackEl.classList.toggle("dragging", !animate);
      trackEl.style.transform = `translate3d(${-index * width()}px, 0, 0)`;

      if (prevBtn) prevBtn.disabled = index <= 0;
      if (nextBtn) nextBtn.disabled = index >= max;

      if (dotsEl) {
        const dots = Array.from(dotsEl.querySelectorAll("button.dot"));
        dots.forEach((d, i) => {
          d.classList.toggle("active", i === index);
          if (i === index) d.setAttribute("aria-current", "true");
          else d.removeAttribute("aria-current");
        });
      }

      onChange(index);
    }

    function buildSlides() {
      trackEl.innerHTML = "";
      images.forEach((src, i) => {
        const slide = document.createElement("div");
        slide.className = "slide";
        const img = document.createElement("img");
        img.alt = alt;
        img.draggable = false;
        img.loading = i === 0 ? "eager" : "lazy";
        img.decoding = "async";
        if (i === 0) img.fetchPriority = "high";
        Storefront.setImage(img, src);
        slide.appendChild(img);
        trackEl.appendChild(slide);
      });
    }

    function buildDots() {
      if (!dotsEl) return;
      dotsEl.innerHTML = "";
      const show = images.length > 1 && images.length <= 10;
      dotsEl.hidden = !show;
      if (!show) return;
      images.forEach((_, i) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "dot";
        dot.setAttribute("aria-label", "صورة " + String(i + 1));
        dot.addEventListener("click", () => apply(i, true));
        dotsEl.appendChild(dot);
      });
    }

    buildSlides();
    buildDots();

    sliderEl.classList.toggle("is-single", images.length <= 1);

    if (prevBtn) prevBtn.addEventListener("click", () => apply(index - 1, true));
    if (nextBtn) nextBtn.addEventListener("click", () => apply(index + 1, true));

    sliderEl.addEventListener("keydown", (e) => {
      if (images.length <= 1) return;
      if (e.key === "ArrowLeft") apply(index - 1, true);
      if (e.key === "ArrowRight") apply(index + 1, true);
    });

    sliderEl.addEventListener("pointerdown", (e) => {
      if (images.length <= 1) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target && e.target.closest("button")) return;

      sliderEl.setPointerCapture(e.pointerId);
      isDragging = true;
      startX = e.clientX;
      baseX = -index * width();
      lastDx = 0;
      trackEl.classList.add("dragging");
      trackEl.style.transform = `translate3d(${baseX}px, 0, 0)`;
    });

    sliderEl.addEventListener("pointermove", (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      lastDx = dx;
      trackEl.style.transform = `translate3d(${baseX + dx}px, 0, 0)`;
    });

    function endDrag() {
      if (!isDragging) return;
      isDragging = false;
      trackEl.classList.remove("dragging");

      const w = width();
      const threshold = Math.max(40, w * 0.18);
      const moved = Math.abs(lastDx) > 6;
      if (moved) {
        suppressClick = true;
        window.setTimeout(() => {
          suppressClick = false;
        }, 0);
      }

      if (Math.abs(lastDx) > threshold) {
        if (lastDx < 0) apply(index + 1, true);
        else apply(index - 1, true);
      } else {
        apply(index, true);
      }
    }

    sliderEl.addEventListener("pointerup", endDrag);
    sliderEl.addEventListener("pointercancel", endDrag);

    sliderEl.addEventListener("click", (e) => {
      if (suppressClick) return;
      const img = e.target && e.target.closest(".slide img");
      if (!img) return;
      onOpen(String(img.getAttribute("src") || images[index] || ""), alt);
    });

    window.addEventListener("resize", () => apply(index, false));

    apply(0, false);
    return { setIndex: (i) => apply(i, true), getIndex: () => index };
  }

  function createPreviewZoom(opts) {
    const sliderEl = opts.sliderEl;
    const previewEl = opts.previewEl;
    if (!sliderEl || !previewEl) return { hide: () => {} };

    const lensEl = document.createElement("span");
    lensEl.className = "zoom-lens";
    lensEl.setAttribute("aria-hidden", "true");
    sliderEl.appendChild(lensEl);

    let activeImg = null;
    let raf = 0;
    let lastPoint = null;

    function canPreview() {
      return (
        window.innerWidth > 860 &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(hover: hover) and (pointer: fine)").matches
      );
    }

    function cssUrl(src) {
      return 'url("' + String(src || "").replace(/["\\]/g, "\\$&") + '")';
    }

    function imageFitBox(img, frameRect) {
      const naturalW = img.naturalWidth || frameRect.width || 1;
      const naturalH = img.naturalHeight || frameRect.height || 1;
      const frameRatio = frameRect.width / Math.max(1, frameRect.height);
      const imageRatio = naturalW / Math.max(1, naturalH);
      let width = frameRect.width;
      let height = frameRect.height;
      let left = 0;
      let top = 0;

      if (imageRatio > frameRatio) {
        height = width / imageRatio;
        top = (frameRect.height - height) / 2;
      } else {
        width = height * imageRatio;
        left = (frameRect.width - width) / 2;
      }

      return { left, top, width, height, naturalW, naturalH };
    }

    function placePreview() {
      const rect = sliderEl.getBoundingClientRect();
      const gap = 14;
      const width = Math.min(430, Math.max(300, window.innerWidth * 0.38));
      const height = Math.min(window.innerHeight - 28, Math.max(320, width * 1.18));
      let left = rect.left - gap - width;
      if (left < 12) left = rect.right + gap;
      if (left + width > window.innerWidth - 12) left = Math.max(12, window.innerWidth - width - 12);
      const maxTop = Math.max(12, window.innerHeight - height - 12);
      const top = clamp(rect.top, 12, maxTop);

      previewEl.style.width = width + "px";
      previewEl.style.height = height + "px";
      previewEl.style.left = left + "px";
      previewEl.style.top = top + "px";
    }

    function show(img) {
      if (!img || !canPreview()) return;
      activeImg = img;
      previewEl.style.backgroundImage = cssUrl(img.currentSrc || img.getAttribute("src") || img.src);
      previewEl.classList.add("is-open");
      previewEl.setAttribute("aria-hidden", "false");
      sliderEl.classList.add("zoom-active");
    }

    function hide() {
      activeImg = null;
      lastPoint = null;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      previewEl.classList.remove("is-open");
      previewEl.setAttribute("aria-hidden", "true");
      sliderEl.classList.remove("zoom-active");
    }

    function update(clientX, clientY) {
      if (!activeImg || !canPreview()) {
        hide();
        return;
      }

      const rect = sliderEl.getBoundingClientRect();
      const fit = imageFitBox(activeImg, rect);
      const x = clamp(clientX - rect.left - fit.left, 0, fit.width);
      const y = clamp(clientY - rect.top - fit.top, 0, fit.height);
      const lensSize = Math.min(132, Math.max(92, Math.min(rect.width, rect.height) * 0.24));
      const lensX = clamp(clientX - rect.left - lensSize / 2, 0, rect.width - lensSize);
      const lensY = clamp(clientY - rect.top - lensSize / 2, 0, rect.height - lensSize);

      lensEl.style.width = lensSize + "px";
      lensEl.style.height = lensSize + "px";
      lensEl.style.transform = `translate3d(${lensX}px, ${lensY}px, 0)`;

      placePreview();
      const previewRect = previewEl.getBoundingClientRect();
      const naturalLimit = Math.max(2.35, Math.min(4.5, fit.naturalW / fit.width, fit.naturalH / fit.height));
      const coverFactor = Math.max(previewRect.width / fit.width, previewRect.height / fit.height) * 1.35;
      const zoomFactor = clamp(Math.max(2.35, coverFactor), 2.2, naturalLimit);
      const bgW = fit.width * zoomFactor;
      const bgH = fit.height * zoomFactor;
      const bgX = previewRect.width / 2 - x * zoomFactor;
      const bgY = previewRect.height / 2 - y * zoomFactor;

      previewEl.style.backgroundSize = bgW + "px " + bgH + "px";
      previewEl.style.backgroundPosition = bgX + "px " + bgY + "px";
    }

    function schedule(e) {
      const img = e.target && e.target.closest(".slide img");
      if (!img) {
        hide();
        return;
      }
      if (img !== activeImg) show(img);
      lastPoint = { x: e.clientX, y: e.clientY };
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        if (!lastPoint) return;
        update(lastPoint.x, lastPoint.y);
      });
    }

    sliderEl.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      schedule(e);
    });
    sliderEl.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      schedule(e);
    });
    sliderEl.addEventListener("pointerleave", hide);
    sliderEl.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") hide();
    });
    window.addEventListener("scroll", hide, { passive: true });
    window.addEventListener("resize", hide);

    return { hide };
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

  function createZoomOverlay(overlayEl, imgEl) {
    let isOpen = false;
    let scale = 1;
    let tx = 0;
    let ty = 0;
    let drag = null;
    let didDrag = false;
    let suppressClick = false;
    let applyFrame = 0;

    const pointers = new Map();
    let pinch = null;

    function apply() {
      if (!imgEl) return;
      if (applyFrame) return;
      applyFrame = window.requestAnimationFrame(() => {
        applyFrame = 0;
        imgEl.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
      });
    }

    function reset(nextScale = 1) {
      scale = nextScale;
      tx = 0;
      ty = 0;
      apply();
    }

    function open(src, alt) {
      if (!overlayEl || !imgEl) return;
      imgEl.decoding = "async";
      Storefront.setImage(imgEl, src);
      imgEl.alt = alt || "";
      overlayEl.hidden = false;
      overlayEl.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      pointers.clear();
      pinch = null;
      drag = null;
      didDrag = false;
      suppressClick = false;
      isOpen = true;
      reset(window.innerWidth > 860 ? 1.65 : 1.25);
    }

    function close() {
      if (!overlayEl) return;
      overlayEl.hidden = true;
      overlayEl.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      pointers.clear();
      pinch = null;
      drag = null;
      didDrag = false;
      suppressClick = false;
      isOpen = false;
      if (applyFrame) window.cancelAnimationFrame(applyFrame);
      applyFrame = 0;
      reset();
    }

    function zoomTo(nextScale, clientX, clientY) {
      if (!overlayEl) return;
      const rect = overlayEl.getBoundingClientRect();
      const u = clientX - rect.left - rect.width / 2;
      const v = clientY - rect.top - rect.height / 2;
      const old = scale;
      const next = clamp(nextScale, 1, 6);
      if (next === old) return;
      const ratio = next / old;
      tx = ratio * tx + (1 - ratio) * u;
      ty = ratio * ty + (1 - ratio) * v;
      scale = next;
      apply();
    }

    function dist(a, b) {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return Math.hypot(dx, dy);
    }

    function center(a, b) {
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    if (overlayEl) {
      overlayEl.addEventListener("click", () => {
        if (!isOpen) return;
        if (suppressClick) return;
        close();
      });

      overlayEl.addEventListener(
        "wheel",
        (e) => {
          if (!isOpen) return;
          e.preventDefault();
          const factor = Math.exp(-e.deltaY * 0.0016);
          zoomTo(scale * factor, e.clientX, e.clientY);
        },
        { passive: false }
      );

      overlayEl.addEventListener("pointerdown", (e) => {
        if (!isOpen) return;
        overlayEl.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        didDrag = false;

        if (pointers.size === 1) {
          drag = { x: e.clientX, y: e.clientY, tx, ty };
          pinch = null;
        } else if (pointers.size === 2) {
          const pts = [...pointers.values()];
          pinch = { lastDist: dist(pts[0], pts[1]), lastCenter: center(pts[0], pts[1]) };
          drag = null;
        }
      });

      overlayEl.addEventListener("pointermove", (e) => {
        if (!isOpen) return;
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointers.size === 1 && drag) {
          const dx = e.clientX - drag.x;
          const dy = e.clientY - drag.y;
          if (Math.abs(dx) + Math.abs(dy) > 6) didDrag = true;
          if (scale <= 1.01) return;
          tx = drag.tx + dx;
          ty = drag.ty + dy;
          apply();
          return;
        }

        if (pointers.size === 2) {
          const pts = [...pointers.values()];
          const d = dist(pts[0], pts[1]);
          const c = center(pts[0], pts[1]);
          if (!pinch) {
            pinch = { lastDist: d, lastCenter: c };
            return;
          }

          const dxC = c.x - pinch.lastCenter.x;
          const dyC = c.y - pinch.lastCenter.y;
          if (Math.abs(dxC) + Math.abs(dyC) > 4) didDrag = true;

          if (scale > 1.01) {
            tx += dxC;
            ty += dyC;
          }

          const factor = d / pinch.lastDist;
          if (Number.isFinite(factor) && Math.abs(factor - 1) > 0.001) zoomTo(scale * factor, c.x, c.y);
          else apply();

          pinch.lastDist = d;
          pinch.lastCenter = c;
        }
      });

      function endPointer(e) {
        if (!isOpen) return;
        pointers.delete(e.pointerId);
        if (pointers.size === 1) {
          const remaining = [...pointers.values()][0];
          drag = { x: remaining.x, y: remaining.y, tx, ty };
          pinch = null;
        } else {
          drag = null;
          pinch = pointers.size === 2 ? pinch : null;
        }

        if (didDrag) {
          suppressClick = true;
          window.setTimeout(() => {
            suppressClick = false;
          }, 0);
        }
        didDrag = false;
      }

      overlayEl.addEventListener("pointerup", endPointer);
      overlayEl.addEventListener("pointercancel", endPointer);
    }

    document.addEventListener("keydown", (e) => {
      if (!isOpen) return;
      if (e.key === "Escape") close();
    });

    return { open, close };
  }

  function renderProductData(product) {
    const titleEl = qs("productTitle");
    const priceEl = qs("productPrice");
    const compareEl = qs("productCompare");
    const descEl = qs("productDesc");
    const catEl = qs("productCategory");
    const skuEl = qs("productSku");
    const stockEl = qs("productStock");
    const highlightsEl = qs("productHighlights");
    const specsEl = qs("productSpecs");

    if (!product) return;

    if (titleEl) titleEl.textContent = product.name;
    if (catEl) catEl.textContent = product.category || "";
    if (descEl) descEl.textContent = product.description || "";

    if (skuEl) skuEl.textContent = product.sku || product.id;

    if (stockEl) {
      stockEl.classList.remove("stock-in", "stock-out", "stock-unknown");
      if (product.stock == null) {
        stockEl.textContent = "متاح";
        stockEl.classList.add("stock-unknown");
      } else if (product.stock > 0) {
        stockEl.textContent = "متاح (" + String(product.stock) + ")";
        stockEl.classList.add("stock-in");
      } else {
        stockEl.textContent = "غير متاح";
        stockEl.classList.add("stock-out");
      }
    }

    if (highlightsEl) {
      const list = Array.isArray(product.highlights) ? product.highlights : [];
      highlightsEl.hidden = list.length === 0;
      highlightsEl.innerHTML = "";
      list.forEach((h) => {
        const li = document.createElement("li");
        li.textContent = String(h);
        highlightsEl.appendChild(li);
      });
    }

    if (specsEl) {
      const list = Array.isArray(product.specs) ? product.specs : [];
      specsEl.hidden = list.length === 0;
      specsEl.innerHTML = "";
      list.forEach((it) => {
        const row = document.createElement("div");
        row.className = "spec-row";
        const label = document.createElement("span");
        label.textContent = String(it?.label || "");
        const value = document.createElement("strong");
        value.textContent = String(it?.value || "");
        row.appendChild(label);
        row.appendChild(value);
        specsEl.appendChild(row);
      });
    }

    if (compareEl) compareEl.hidden = true;
    if (priceEl) priceEl.textContent = "";
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

    const zoom = createZoomOverlay(qs("zoomOverlay"), qs("zoomImage"));

    const id = getParam("id");
    const product = id ? Storefront.getProductById(products, id) : null;

    const priceEl = qs("productPrice");
    const compareEl = qs("productCompare");

    const qtyInput = qs("qtyInput");
    const addBtn = qs("addToCartBtn");

    const sliderEl = qs("productSlider");
    const trackEl = qs("sliderTrack");
    const dotsEl = qs("sliderDots");
    const prevBtn = qs("slidePrev");
    const nextBtn = qs("slideNext");
    const thumbsEl = qs("thumbs");
    const zoomPreviewEl = qs("zoomPreview");

    const cartUI = wireCartDrawer(products, config, formatter);
    window.addEventListener("storefront:accountchange", () => cartUI?.renderCart?.());

    if (!product) {
      const titleEl = qs("productTitle");
      const descEl = qs("productDesc");
      if (titleEl) titleEl.textContent = "المنتج غير موجود";
      if (descEl) descEl.textContent = "تأكد من الرابط أو ارجع للمتجر.";
      if (priceEl) priceEl.textContent = "";
      if (compareEl) compareEl.hidden = true;
      cartUI?.renderCart?.();
      Storefront.hydrateIcons();
      return;
    }

    document.title = product.name + " | " + (config.name || "متجر");

    const images = Array.isArray(product.images) && product.images.length ? product.images : ["assets/store/product-01.svg"];

    const thumbs = createThumbs(thumbsEl, images, (idx) => slider.setIndex(idx));
    const previewZoom = createPreviewZoom({ sliderEl, previewEl: zoomPreviewEl });
    const slider = createSlider({
      sliderEl,
      trackEl,
      dotsEl,
      prevBtn,
      nextBtn,
      images,
      alt: product.name,
      onOpen: (src, altText) => {
        previewZoom.hide();
        zoom.open(src, altText);
      },
      onChange: (i) => thumbs.setActive(i)
    });
    thumbs.setActive(slider.getIndex());

    renderProductData(product);

    if (priceEl) priceEl.textContent = formatter.format(product.price || 0);
    if (
      compareEl &&
      product.compareAt != null &&
      Number.isFinite(product.compareAt) &&
      product.compareAt > product.price
    ) {
      compareEl.hidden = false;
      compareEl.textContent = formatter.format(product.compareAt);
    } else if (compareEl) {
      compareEl.hidden = true;
    }

    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const qty = Storefront.clampInt(qtyInput?.value ?? 1, 1, 99);
        Storefront.cartAdd(product.id, qty);
        cartUI?.renderCart?.();
        Storefront.toast("تمت الإضافة", product.name);
      });
    }

    cartUI?.renderCart?.();
    Storefront.hydrateIcons();
  });
})();
