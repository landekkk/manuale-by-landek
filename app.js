(() => {
  const TESTER_URL = "https://landekkk.github.io/tester-dymkow-pwa/";

  // PDF.js (lazy)
  const PDFJS_LIB_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.js";

  const $ = (id) => document.getElementById(id);
  function setText(el, txt) { if (el) el.textContent = txt ?? ""; }

  const statusEl = $("status");
  function setStatus(msg) { setText(statusEl, msg || ""); }

  window.addEventListener("error", (e) => {
    setStatus("Błąd aplikacji: " + (e?.message || "unknown"));
  });
  window.addEventListener("unhandledrejection", (e) => {
    setStatus("Błąd aplikacji: " + (e?.reason?.message || String(e?.reason || "unknown")));
  });

  // ===== Elements =====
  const listEl = $("list");
  const qEl = $("q");
  const metaEl = $("meta");
  const reloadBtn = $("reload");

  const viewList = $("view-list");
  const viewPdf = $("view-pdf");
  const viewTester = $("view-tester");

  const backPdfBtn = $("backPdf");
  const backTesterBtn = $("backTester");

  const pdfTitleEl = $("pdfTitle");
  const pdfCanvas = $("pdfCanvas");
  const thumbStrip = $("thumbStrip");

  const prevPageBtn = $("prevPage");
  const nextPageBtn = $("nextPage");
  const zoomInBtn = $("zoomIn");
  const zoomOutBtn = $("zoomOut");
  const pageNowEl = $("pageNow");
  const pageTotalEl = $("pageTotal");

  const openTesterCard = $("openTester");
  const testerFrame = $("testerFrame");

  if (!listEl || !qEl || !metaEl || !reloadBtn || !viewList) {
    setStatus("Brakuje elementów w index.html (list/q/meta/reload/view-list).");
    return;
  }

  // ===== Views =====
  let activeView = viewList;

  function setAriaHidden(el, hidden) {
    if (el) el.setAttribute("aria-hidden", hidden ? "true" : "false");
  }

  function switchView(next) {
    if (!next || next === activeView) return;
    const prev = activeView;

    next.classList.add("is-active");
    setAriaHidden(next, false);

    requestAnimationFrame(() => {
      next.classList.add("is-visible");
      prev?.classList.remove("is-visible");
    });

    const onDone = () => {
      prev?.classList.remove("is-active");
      setAriaHidden(prev, true);
      prev?.removeEventListener("transitionend", onDone);
    };

    prev?.addEventListener("transitionend", onDone);
    setTimeout(onDone, 260);

    activeView = next;
  }

  function showList() {
    switchView(viewList);
    history.replaceState({ page: "list" }, "", location.pathname + location.search);
  }

  function showTesterPanel() {
    if (!viewTester || !testerFrame) {
      // pewny fallback
      location.href = TESTER_URL;
      return;
    }
    if (!testerFrame.src) testerFrame.src = TESTER_URL;
    switchView(viewTester);
    history.pushState({ page: "tester" }, "", "#tester");
  }

  // ===== PDF.js lazy loader =====
  let pdfjsLib = null;
  let pdfjsLoading = null;

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function getPdfjsGlobal() {
    // CDN build najczęściej daje window.pdfjsLib
    return window.pdfjsLib || window["pdfjsLib"] || null;
  }

  async function ensurePdfJs() {
    if (pdfjsLib) return pdfjsLib;
    if (pdfjsLoading) return pdfjsLoading;

    pdfjsLoading = (async () => {
      const already = getPdfjsGlobal();
      if (already) {
        pdfjsLib = already;
      } else {
        await loadScript(PDFJS_LIB_URL);
        pdfjsLib = getPdfjsGlobal();
      }

      if (!pdfjsLib) throw new Error("PDF.js nie załadował się (brak window.pdfjsLib).");
      return pdfjsLib;
    })();

    return pdfjsLoading;
  }

  // ===== PDF state =====
  let pdfDoc = null;
  let pageNum = 1;
  let zoom = 1;
  let baseScale = 1;
  let rendering = false;
  let pendingPage = null;

  function updateControls() {
    if (pageNowEl) pageNowEl.textContent = String(pageNum);
    if (pageTotalEl) pageTotalEl.textContent = String(pdfDoc?.numPages || 1);
    if (prevPageBtn) prevPageBtn.disabled = pageNum <= 1;
    if (nextPageBtn) nextPageBtn.disabled = pageNum >= (pdfDoc?.numPages || 1);
  }

  function getFitScale(wrapWidth, pageW) {
    const usable = Math.max(320, wrapWidth);
    return usable / pageW;
  }

  async function renderPage(num) {
    if (!pdfDoc || !pdfCanvas) return;

    rendering = true;
    pageNum = num;
    updateControls();

    const page = await pdfDoc.getPage(num);
    const unscaled = page.getViewport({ scale: 1 });

    const wrap = pdfCanvas.parentElement;
    const wrapWidth = wrap?.clientWidth || 360;

    baseScale = getFitScale(wrapWidth, unscaled.width);
    const scale = baseScale * zoom;

    const viewport = page.getViewport({ scale });
    const ctx = pdfCanvas.getContext("2d", { alpha: false });

    pdfCanvas.width = Math.floor(viewport.width);
    pdfCanvas.height = Math.floor(viewport.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    if (thumbStrip) {
      [...thumbStrip.querySelectorAll(".thumb")].forEach(el => {
        el.classList.toggle("is-active", Number(el.dataset.page) === pageNum);
      });
    }

    rendering = false;

    if (pendingPage !== null) {
      const p = pendingPage;
      pendingPage = null;
      renderPage(p);
    }
  }

  function queueRenderPage(num) {
    if (rendering) pendingPage = num;
    else renderPage(num);
  }

  async function buildThumbnails() {
    if (!thumbStrip || !pdfDoc) return;
    thumbStrip.innerHTML = "";

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const thumb = document.createElement("div");
      thumb.className = "thumb";
      thumb.dataset.page = String(i);

      const c = document.createElement("canvas");
      thumb.appendChild(c);
      thumbStrip.appendChild(thumb);

      thumb.addEventListener("click", () => queueRenderPage(i));

      const page = await pdfDoc.getPage(i);
      const vp1 = page.getViewport({ scale: 1 });

      const targetW = 96;
      const scale = targetW / vp1.width;
      const vp = page.getViewport({ scale });

      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);

      const tctx = c.getContext("2d", { alpha: false });
      await page.render({ canvasContext: tctx, viewport: vp }).promise;
    }
  }

  async function openPdfInApp(file, title) {
    // jeśli nie ma viewer-a, pewny fallback
    if (!viewPdf || !pdfCanvas || !pdfTitleEl) {
      location.href = file;
      return;
    }

    setStatus("Ładuję PDF…");
    pdfTitleEl.textContent = title || "PDF";

    pdfDoc = null;
    pageNum = 1;
    zoom = 1;
    pendingPage = null;
    if (thumbStrip) thumbStrip.innerHTML = "";

    switchView(viewPdf);

    try {
      const lib = await ensurePdfJs();

      // 🔥 KLUCZ: iOS/PWA często ma problem z workerem → wyłączamy
      const loadingTask = lib.getDocument({
        url: file,
        disableWorker: true
      });

      pdfDoc = await loadingTask.promise;

      setStatus("");
      updateControls();
      await buildThumbnails();
      await renderPage(1);

      history.pushState({ page: "pdf", file }, "", `#pdf=${encodeURIComponent(file)}`);
    } catch (e) {
      console.error(e);

      // pokaż krótki powód
      const msg = (e && e.message) ? e.message : String(e);
      setStatus("PDF viewer error: " + msg);

      // ✅ PEWNY fallback na iOS: przejście w tej samej karcie
      location.href = file;
    }
  }

  // ===== List =====
  let all = [];
  function normalize(s) { return (s || "").toLowerCase().trim(); }

  function renderList() {
    const q = normalize(qEl.value);
    const filtered = all.filter(x => normalize(x.title).includes(q));

    listEl.innerHTML = "";
    setText(metaEl, `Pozycji: ${filtered.length}${q ? ` (filtr: „${qEl.value}”)` : ""}`);

    if (filtered.length === 0) {
      const li = document.createElement("li");
      li.className = "muted";
      li.textContent = "Brak wyników.";
      listEl.appendChild(li);
      return;
    }

    for (const item of filtered) {
      const li = document.createElement("li");
      li.className = "item pressable";

      const a = document.createElement("a");
      a.href = "#";
      a.textContent = item.title;

      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        openPdfInApp(item.file, item.title);
      });

      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "PDF";

      li.appendChild(a);
      li.appendChild(badge);
      listEl.appendChild(li);
    }
  }

  async function loadList({ bypassCache = false } = {}) {
    setStatus("Ładowanie listy…");
    try {
      const url = "./pdfs.json" + (bypassCache ? `?t=${Date.now()}` : "");
      const res = await fetch(url, { cache: bypassCache ? "no-store" : "default" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      all = Array.isArray(data)
        ? data.filter(x => x && typeof x.title === "string" && typeof x.file === "string")
        : [];

      renderList();
      setStatus("");
      restoreFromHash();
    } catch (e) {
      console.error(e);
      setStatus("Nie udało się wczytać pdfs.json (błąd w JSON lub cache).");
    }
  }

  function restoreFromHash() {
    if (location.hash === "#tester") {
      showTesterPanel();
      return;
    }
    const m = location.hash.match(/^#pdf=(.+)$/);
    if (!m) return;

    const file = decodeURIComponent(m[1]);
    const found = all.find(x => x.file === file);
    if (found) openPdfInApp(found.file, found.title);
  }

  // ===== Events =====
  qEl.addEventListener("input", renderList);
  reloadBtn.addEventListener("click", () => loadList({ bypassCache: true }));

  if (backPdfBtn) backPdfBtn.addEventListener("click", () => history.back());
  if (backTesterBtn) backTesterBtn.addEventListener("click", () => history.back());

  if (openTesterCard) {
    openTesterCard.addEventListener("click", showTesterPanel);
    openTesterCard.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") showTesterPanel();
    });
  }

  if (prevPageBtn) prevPageBtn.addEventListener("click", () => queueRenderPage(Math.max(1, pageNum - 1)));
  if (nextPageBtn) nextPageBtn.addEventListener("click", () => queueRenderPage(Math.min(pdfDoc?.numPages || 1, pageNum + 1)));

  if (zoomInBtn) zoomInBtn.addEventListener("click", () => {
    zoom = Math.min(3, Number((zoom + 0.15).toFixed(2)));
    if (pdfDoc) queueRenderPage(pageNum);
  });
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => {
    zoom = Math.max(0.6, Number((zoom - 0.15).toFixed(2)));
    if (pdfDoc) queueRenderPage(pageNum);
  });

  window.addEventListener("resize", () => {
    if (activeView === viewPdf && pdfDoc) queueRenderPage(pageNum);
  });

  window.addEventListener("popstate", (ev) => {
    const st = ev.state;
    if (!st || st.page === "list") showList();
    else if (st.page === "tester") showTesterPanel();
    else if (st.page === "pdf") {
      const found = all.find(x => x.file === st.file);
      if (found) openPdfInApp(found.file, found.title);
      else showList();
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  }

  // Start
  history.replaceState({ page: "list" }, "", location.pathname + location.search);
  loadList({ bypassCache: true });
})();
