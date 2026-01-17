const TESTER_URL = "https://landekkk.github.io/tester-dymkow-pwa/";

const listEl = document.getElementById("list");
const qEl = document.getElementById("q");
const metaEl = document.getElementById("meta");
const statusEl = document.getElementById("status");
const reloadBtn = document.getElementById("reload");

const viewList = document.getElementById("view-list");
const viewPdf = document.getElementById("view-pdf");
const viewTester = document.getElementById("view-tester");

const pdfFrame = document.getElementById("pdfFrame");
const testerFrame = document.getElementById("testerFrame");

const backBtn = document.getElementById("backBtn");
const backTesterBtn = document.getElementById("backTesterBtn");

/* ===== TILE FACTORY ===== */
function tile({ title, sub, icon, href, onClick }) {
  const el = href ? document.createElement("a") : document.createElement("button");
  el.className = "tile";

  if (href) {
    el.href = href;
    el.target = "_blank";
  } else {
    el.onclick = onClick;
  }

  el.innerHTML = `
    <span>${icon}</span>
    <span>
      <div class="tileTitle">${title}</div>
      ${sub ? `<div class="tileSub">${sub}</div>` : ""}
    </span>
  `;

  return el;
}

/* ===== TOOLS ===== */
const toolsGrid = document.getElementById("toolsGrid");

toolsGrid.appendChild(
  tile({
    title: "Tester dymków",
    sub: "Narzędzie",
    icon: "🧪",
    onClick: () => {
      viewList.classList.add("hidden");
      viewTester.classList.remove("hidden");
      testerFrame.src = TESTER_URL;
    }
  })
);

/* ===== PDFS ===== */
let pdfs = [];

function renderList(filter="") {
  listEl.innerHTML = "";
  const f = filter.toLowerCase();

  pdfs
    .filter(p => p.title.toLowerCase().includes(f))
    .forEach(p => {
      listEl.appendChild(
        tile({
          title: p.title,
          sub: p.category,
          icon: "📄",
          href: p.url
        })
      );
    });
}

fetch("./pdfs.json")
  .then(r => r.json())
  .then(data => {
    pdfs = data;
    renderList();
  });

qEl.oninput = () => renderList(qEl.value);
reloadBtn.onclick = () => location.reload();

/* ===== NAV ===== */
backBtn.onclick = () => {
  viewPdf.classList.add("hidden");
  viewList.classList.remove("hidden");
};

backTesterBtn.onclick = () => {
  viewTester.classList.add("hidden");
  viewList.classList.remove("hidden");
};
