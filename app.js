(function () {
  var TESTER_URL = "https://landekkk.github.io/tester-dymkow-pwa/";

  // PDF.js lazy (bez workera – stabilniej na iOS/PWA)
  var PDFJS_LIB_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.js";

  function $(id) { return document.getElementById(id); }
  function setText(el, txt) { if (el) el.textContent = txt || ""; }

  var statusEl = $("status");
  function setStatus(msg) { setText(statusEl, msg); }

  // ===== Elements =====
  var listEl = $("list");
  var qEl = $("q");
  var metaEl = $("meta");
  var reloadBtn = $("reload");

  var viewList = $("view-list");
  var viewPdf = $("view-pdf");
  var viewTester = $("view-tester");

  var backPdfBtn = $("backPdf");
  var backTesterBtn = $("backTester");

  var pdfTitleEl = $("pdfTitle");
  var pdfCanvas = $("pdfCanvas");
  var thumbStrip = $("thumbStrip");

  var prevPageBtn = $("prevPage");
  var nextPageBtn = $("nextPage");
  var zoomInBtn = $("zoomIn");
  var zoomOutBtn = $("zoomOut");
  var pageNowEl = $("pageNow");
  var pageTotalEl = $("pageTotal");

  var openTesterCard = $("openTester");
  var testerFrame = $("testerFrame");

  // Jeśli czegoś brakuje, pokaż to od razu
  if (!listEl || !qEl || !metaEl || !reloadBtn || !viewList) {
    setStatus("Brakuje elementów w index.html (list/q/meta/reload/view-list).");
    return;
  }

  // ===== Error display =====
  window.addEventListener("error", function (e) {
    setStatus("Błąd aplikacji: " + (e && e.message ? e.message : "unknown"));
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason ? e.reason : "unknown";
    setStatus("Błąd aplikacji: " + (r && r.message ? r.message : String(r)));
  });

  // ===== Views (fade/slide) =====
  var activeView = viewList;

  function setAriaHidden(el, hidden) {
    if (el) el.setAttribute("aria-hidden", hidden ? "true" : "false");
  }

  function switchView(next) {
    if (!next || next === activeView) return;

    var prev = activeView;

    next.classList.add("is-active");
    setAriaHidden(next, false);

    requestAnimationFrame(function () {
      next.classList.add("is-visible");
      if (prev) prev.classList.remove("is-visible");
    });

    function onDone() {
      if (prev) {
        prev.classList.remove("is-active");
        setAriaHidden(prev, true);
        prev.removeEventListener("transitionend", onDone);
      }
    }

    if (prev) prev.addEventListener("transitionend", onDone);
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

  // ===== PDF.js lazy load =====
  var pdfjsLib = null;
  var pdfjsLoading = false;

  function loadScript(url, cbOk, cbErr) {
    var s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = cbOk;
    s.onerror = cbErr;
    document.head.appendChild(s);
  }

  function getPdfjsGlobal() {
    return window.pdfjsLib || null;
  }

  function ensurePdfJs(cbOk, cbErr) {
    if (pdfjsLib) return cbOk(pdfjsLib);

    if (pdfjsLoading) {
      // poczekaj chwilę i spróbuj ponownie
      return setTimeout(function () { ensurePdfJs(cbOk, cbErr); }, 80);
    }

    var already = getPdfjsGlobal();
    if (already) {
      pdfjsLib = already;
      return cbOk(pdfjsLib);
    }

    pdfjsLoading = true;
    loadScript(
      PDFJS_LIB_URL,
      function () {
        pdfjsLoading = false;
        pdfjsLib = getPdfjsGlobal();
        if (!pdfjsLib) return cbErr(new Error("PDF.js nie załadował się (brak window.pdfjsLib)."));
        cbOk(pdfjsLib);
      },
      function () {
        pdfjsLoading = false;
        cbErr(new Error("Nie udało się pobrać pdf.min.js (CDN)."));
      }
    );
  }

  // ===== PDF state =====
  var pdfDoc = null;
  var pageNum = 1;
  var zoom = 1;
  var baseScale = 1;
  var rendering = false;
  var pendingPage = null;

  function updateControls() {
    if (pageNowEl) pageNowEl.textContent = String(pageNum);
    if (pageTotalEl) pageTotalEl.textContent = String(pdfDoc ? pdfDoc.numPages : 1);
    if (prevPageBtn) prevPageBtn.disabled = pageNum <= 1;
    if (nextPageBtn) nextPageBtn.disabled = pageNum >= (pdfDoc ? pdfDoc.numPages : 1);
  }

  function getFitScale(wrapWidth, pageW) {
    var usable = Math.max(320, wrapWidth);
    return usable / pageW;
  }

  function queueRenderPage(num) {
    if (rendering) pendingPage = num;
    else renderPage(num);
  }

  function renderPage(num) {
    if (!pdfDoc || !pdfCanvas) return;

    rendering = true;
    pageNum = num;
    updateControls();

    pdfDoc.getPage(num).then(function (page) {
      var unscaled = page.getViewport({ scale: 1 });

      var wrap = pdfCanvas.parentElement;
      var wrapWidth = wrap && wrap.clientWidth ? wrap.clientWidth : 360;

      baseScale = getFitScale(wrapWidth, unscaled.width);
      var scale = baseScale * zoom;

      var viewport = page.getViewport({ scale: scale });
      var ctx = pdfCanvas.getContext("2d", { alpha: false });

      pdfCanvas.width = Math.floor(viewport.width);
      pdfCanvas.height = Math.floor(viewport.height);

      return page.render({ canvasContext: ctx, viewport: viewport }).promise;
    }).then(function () {
      if (thumbStrip) {
        var thumbs = thumbStrip.querySelectorAll(".thumb");
        for (var i = 0; i < thumbs.length; i++) {
          var el = thumbs[i];
          el.classList.toggle("is-active", Number(el.dataset.page) === pageNum);
        }
      }

      rendering = false;

      if (pendingPage !== null) {
        var p = pendingPage;
        pendingPage = null;
        renderPage(p);
      }
    }).catch(function (e) {
      rendering = false;
      setStatus("PDF viewer error: " + (e && e.message ? e.message : String(e)));
      // pewny fallback – ta sama karta
      location.href = currentPdfFile || "#";
    });
  }

  function buildThumbnails() {
    if (!thumbStrip || !pdfDoc) return Promise.resolve();
    thumbStrip.innerHTML = "";

    var chain = Promise.resolve();

    for (var i = 1; i <= pdfDoc.numPages; i++) {
      (function (pageIndex) {
        chain = chain.then(function () {
          var thumb = document.createElement("div");
          thumb.className = "thumb";
          thumb.dataset.page = String(pageIndex);

          var c = document.createElement("canvas");
          thumb.appendChild(c);
          thumbStrip.appendChild(thumb);

          thumb.addEventListener("click", function () {
            queueRenderPage(pageIndex);
          });

          return pdfDoc.getPage(pageIndex).then(function (page) {
            var vp1 = page.getViewport({ scale: 1 });
            var targetW = 96;
            var sc = targetW / vp1.width;
            var vp = page.getViewport({ scale: sc });

            c.width = Math.floor(vp.width);
            c.height = Math.floor(vp.height);

            var tctx = c.getContext("2d", { alpha: false });
            return page.render({ canvasContext: tctx, viewport: vp }).promise;
          });
        });
      })(i);
    }

    return chain;
  }

  var currentPdfFile = null;

  function openPdfInApp(file, title) {
    currentPdfFile = file;

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

    ensurePdfJs(
      function (lib) {
        try {
          // Bez workera (stabilniej na iOS/PWA)
          var task = lib.getDocument({ url: file, disableWorker: true });

          task.promise.then(function (doc) {
            pdfDoc = doc;
            setStatus("");
            updateControls();
            return buildThumbnails();
          }).then(function () {
            renderPage(1);
            history.pushState({ page: "pdf", file: file }, "", "#pdf=" + encodeURIComponent(file));
          }).catch(function (e) {
            setStatus("PDF viewer error: " + (e && e.message ? e.message : String(e)));
            location.href = file;
          });
        } catch (e) {
          setStatus("PDF viewer error: " + (e && e.message ? e.message : String(e)));
          location.href = file;
        }
      },
      function (err) {
        setStatus("Nie udało się uruchomić PDF w aplikacji: " + (err && err.message ? err.message : String(err)));
        location.href = file;
      }
    );
  }

  // ===== List =====
  var all = [];

  function normalize(s) { return (s || "").toLowerCase().trim(); }

  function renderList() {
    var q = normalize(qEl.value);
    var filtered = [];

    for (var i = 0; i < all.length; i++) {
      if (normalize(all[i].title).indexOf(q) !== -1) filtered.push(all[i]);
    }

    listEl.innerHTML = "";
    setText(metaEl, "Pozycji: " + filtered.length + (q ? " (filtr: „" + qEl.value + "”)" : ""));

    if (filtered.length === 0) {
      var li0 = document.createElement("li");
      li0.className = "muted";
      li0.textContent = "Brak wyników.";
      listEl.appendChild(li0);
      return;
    }

    for (var k = 0; k < filtered.length; k++) {
      (function (item) {
        var li = document.createElement("li");
        li.className = "item pressable";

        var a = document.createElement("a");
        a.href = "#";
        a.textContent = item.title;

        a.addEventListener("click", function (ev) {
          ev.preventDefault();
          openPdfInApp(item.file, item.title);
        });

        var badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = "PDF";

        li.appendChild(a);
        li.appendChild(badge);
        listEl.appendChild(li);
      })(filtered[k]);
    }
  }

  function loadList(opts) {
    opts = opts || {};
    var bypassCache = !!opts.bypassCache;

    setStatus("Ładowanie listy…");

    var url = "./pdfs.json" + (bypassCache ? ("?t=" + Date.now()) : "");

    fetch(url, { cache: bypassCache ? "no-store" : "default" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (data) {
      all = [];

      if (Array.isArray(data)) {
        for (var i = 0; i < data.length; i++) {
          var x = data[i];
          if (x && typeof x.title === "string" && typeof x.file === "string") all.push(x);
        }
      }

      renderList();
      setStatus("");
      restoreFromHash();
    }).catch(function (e) {
      console.error(e);
      setStatus("Nie udało się wczytać pdfs.json (błąd w JSON lub cache).");
    });
  }

  function restoreFromHash() {
    if (location.hash === "#tester") {
      showTesterPanel();
      return;
    }

    var m = location.hash.match(/^#pdf=(.+)$/);
    if (!m) return;

    var file = decodeURIComponent(m[1]);
    for (var i = 0; i < all.length; i++) {
      if (all[i].file === file) {
        openPdfInApp(all[i].file, all[i].title);
        return;
      }
    }
  }

  // ===== Events =====
  qEl.addEventListener("input", renderList);
  reloadBtn.addEventListener("click", function () { loadList({ bypassCache: true }); });

  if (backPdfBtn) backPdfBtn.addEventListener("click", function () { history.back(); });
  if (backTesterBtn) backTesterBtn.addEventListener("click", function () { history.back(); });

  if (openTesterCard) {
    openTesterCard.addEventListener("click", showTesterPanel);
    openTesterCard.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") showTesterPanel();
    });
  }

  if (prevPageBtn) prevPageBtn.addEventListener("click", function () { queueRenderPage(Math.max(1, pageNum - 1)); });
  if (nextPageBtn) nextPageBtn.addEventListener("click", function () {
    var max = pdfDoc ? pdfDoc.numPages : 1;
    queueRenderPage(Math.min(max, pageNum + 1));
  });

  if (zoomInBtn) zoomInBtn.addEventListener("click", function () {
    zoom = Math.min(3, Math.round((zoom + 0.15) * 100) / 100);
    if (pdfDoc) queueRenderPage(pageNum);
  });

  if (zoomOutBtn) zoomOutBtn.addEventListener("click", function () {
    zoom = Math.max(0.6, Math.round((zoom - 0.15) * 100) / 100);
    if (pdfDoc) queueRenderPage(pageNum);
  });

  window.addEventListener("resize", function () {
    if (activeView === viewPdf && pdfDoc) queueRenderPage(pageNum);
  });

  window.addEventListener("popstate", function (ev) {
    var st = ev.state;
    if (!st || st.page === "list") showList();
    else if (st.page === "tester") showTesterPanel();
    else if (st.page === "pdf") {
      var file = st.file;
      for (var i = 0; i < all.length; i++) {
        if (all[i].file === file) {
          openPdfInApp(all[i].file, all[i].title);
          return;
        }
      }
      showList();
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  }

  // Start
  history.replaceState({ page: "list" }, "", location.pathname + location.search);
  loadList({ bypassCache: true });
})();
