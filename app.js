const canvas = document.getElementById("canvas");
const libraryEl = document.getElementById("library");

const wInput = document.getElementById("wInput");
const hInput = document.getElementById("hInput");
const rInput = document.getElementById("rInput");
const cInput = document.getElementById("cInput");

const dimLabel = document.getElementById("dimLabel");
const gridLabel = document.getElementById("gridLabel");

const fileInput = document.getElementById("fileInput");
const urlInput = document.getElementById("urlInput");
const addUrlBtn = document.getElementById("addUrlBtn");

const applyBtn = document.getElementById("applyBtn");
const saveBtn = document.getElementById("saveBtn");
const loadBtn = document.getElementById("loadBtn");
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");

const exportDialog = document.getElementById("exportDialog");
const exportText = document.getElementById("exportText");
const copyBtn = document.getElementById("copyBtn");

const STORAGE_KEY = "planogram_builder_v1";

let state = {
  canvas: { width: 1240, height: 2438, rows: 6, cols: 3 },
  library: [], // {id, src, name}
  items: []    // {id, src, x, y, w, h, section: {r,c}}
};

const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);

// ---------- Canvas + sections ----------
function applyCanvasSettings() {
  const width = clampInt(wInput.value, 200, 20000);
  const height = clampInt(hInput.value, 200, 20000);
  const rows = clampInt(rInput.value, 1, 200);
  const cols = clampInt(cInput.value, 1, 200);

  state.canvas = { width, height, rows, cols };

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  dimLabel.textContent = `${width} × ${height}`;
  gridLabel.textContent = `${rows} × ${cols}`;

  renderSections();
  // keep items inside after resize
  state.items.forEach(it => {
    it.x = clamp(it.x, 0, width - it.w);
    it.y = clamp(it.y, 0, height - it.h);
  });
  renderItems();
}

function renderSections() {
  // remove old sections (not items)
  [...canvas.querySelectorAll(".section")].forEach(el => el.remove());

  const { width, height, rows, cols } = state.canvas;
  const cellW = width / cols;
  const cellH = height / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sec = document.createElement("div");
      sec.className = "section";
      sec.style.left = `${c * cellW}px`;
      sec.style.top = `${r * cellH}px`;
      sec.style.width = `${cellW}px`;
      sec.style.height = `${cellH}px`;

      const label = document.createElement("div");
      label.className = "sectionLabel";
      label.textContent = `R${r + 1} C${c + 1}`;
      sec.appendChild(label);

      canvas.appendChild(sec);
    }
  }
}

function getSectionForPoint(x, y) {
  const { width, height, rows, cols } = state.canvas;
  const cx = clamp(x, 0, width - 1);
  const cy = clamp(y, 0, height - 1);
  const c = Math.floor((cx / width) * cols);
  const r = Math.floor((cy / height) * rows);
  return { r, c };
}

// ---------- Library ----------
function addLibraryItem(src, name = "Item") {
  const item = { id: uid(), src, name };
  state.library.unshift(item);
  renderLibrary();
}

function renderLibrary() {
  libraryEl.innerHTML = "";
  for (const li of state.library) {
    const card = document.createElement("div");
    card.className = "libItem";
    card.draggable = true;
    card.dataset.id = li.id;

    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", JSON.stringify({ type: "library", id: li.id }));
    });

    const thumb = document.createElement("div");
    thumb.className = "libThumb";
    const img = document.createElement("img");
    img.src = li.src;
    img.alt = li.name;
    thumb.appendChild(img);

    const meta = document.createElement("div");
    meta.className = "libMeta";
    meta.innerHTML = `<span title="${escapeHtml(li.name)}">${truncate(li.name, 18)}</span><span class="badge">drag</span>`;

    card.appendChild(thumb);
    card.appendChild(meta);

    libraryEl.appendChild(card);
  }
}

// File upload
fileInput.addEventListener("change", async () => {
  const files = [...fileInput.files || []];
  for (const f of files) {
    const src = await fileToDataUrl(f);
    addLibraryItem(src, f.name);
  }
  fileInput.value = "";
});

// URL add
addUrlBtn.addEventListener("click", () => {
  const url = (urlInput.value || "").trim();
  if (!url) return;
  addLibraryItem(url, url);
  urlInput.value = "";
});

// ---------- Drag drop into canvas ----------
canvas.addEventListener("dragover", (e) => e.preventDefault());

canvas.addEventListener("drop", (e) => {
  e.preventDefault();
  const data = safeParseJSON(e.dataTransfer.getData("text/plain"));
  if (!data) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (data.type === "library") {
    const lib = state.library.find(l => l.id === data.id);
    if (!lib) return;

    const section = getSectionForPoint(x, y);
    const newItem = {
      id: uid(),
      src: lib.src,
      x: clamp(x - 55, 0, state.canvas.width - 110),
      y: clamp(y - 55, 0, state.canvas.height - 110),
      w: 110,
      h: 110,
      section
    };
    state.items.push(newItem);
    renderItems();
  }
});

// ---------- Items on canvas ----------
function renderItems() {
  // remove existing item elements
  [...canvas.querySelectorAll(".item")].forEach(el => el.remove());

  for (const it of state.items) {
    const el = document.createElement("div");
    el.className = "item";
    el.style.left = `${it.x}px`;
    el.style.top = `${it.y}px`;
    el.style.width = `${it.w}px`;
    el.style.height = `${it.h}px`;
    el.dataset.id = it.id;
    el.title = `R${it.section.r + 1} C${it.section.c + 1}`;

    const img = document.createElement("img");
    img.src = it.src;
    img.draggable = false;
    el.appendChild(img);

    // Double click remove
    el.addEventListener("dblclick", () => {
      state.items = state.items.filter(x => x.id !== it.id);
      renderItems();
    });

    // Pointer drag
    enablePointerDrag(el);

    canvas.appendChild(el);
  }
}

function enablePointerDrag(el) {
  let startX = 0, startY = 0;
  let baseX = 0, baseY = 0;
  let draggingId = el.dataset.id;

  el.addEventListener("pointerdown", (e) => {
    el.setPointerCapture(e.pointerId);
    const it = state.items.find(x => x.id === draggingId);
    if (!it) return;

    startX = e.clientX;
    startY = e.clientY;
    baseX = it.x;
    baseY = it.y;
  });

  el.addEventListener("pointermove", (e) => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    const it = state.items.find(x => x.id === draggingId);
    if (!it) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    it.x = clamp(baseX + dx, 0, state.canvas.width - it.w);
    it.y = clamp(baseY + dy, 0, state.canvas.height - it.h);

    // update section based on item center
    const centerX = it.x + it.w / 2;
    const centerY = it.y + it.h / 2;
    it.section = getSectionForPoint(centerX, centerY);

    el.style.left = `${it.x}px`;
    el.style.top = `${it.y}px`;
    el.title = `R${it.section.r + 1} C${it.section.c + 1}`;
  });

  el.addEventListener("pointerup", (e) => {
    if (el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
  });
}

// ---------- Save/Load/Export ----------
function saveToLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadFromLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  const parsed = safeParseJSON(raw);
  if (!parsed) return false;
  state = parsed;

  wInput.value = state.canvas.width;
  hInput.value = state.canvas.height;
  rInput.value = state.canvas.rows;
  cInput.value = state.canvas.cols;

  applyCanvasSettings();
  renderLibrary();
  renderItems();
  return true;
}

function exportJSON() {
  const payload = {
    canvas: state.canvas,
    items: state.items.map(i => ({
      id: i.id,
      src: i.src,
      x: Math.round(i.x),
      y: Math.round(i.y),
      w: Math.round(i.w),
      h: Math.round(i.h),
      section: i.section
    }))
  };
  exportText.value = JSON.stringify(payload, null, 2);
  exportDialog.showModal();
}

applyBtn.addEventListener("click", () => applyCanvasSettings());
saveBtn.addEventListener("click", () => saveToLocal());
loadBtn.addEventListener("click", () => {
  const ok = loadFromLocal();
  if (!ok) alert("No saved layout found yet.");
});
exportBtn.addEventListener("click", () => exportJSON());
clearBtn.addEventListener("click", () => {
  if (!confirm("Clear canvas items?")) return;
  state.items = [];
  renderItems();
});

copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(exportText.value);
  copyBtn.textContent = "Copied!";
  setTimeout(() => (copyBtn.textContent = "Copy"), 900);
});

// ---------- Helpers ----------
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function clampInt(v, min, max) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return min;
  return clamp(n, min, max);
}
function truncate(s, n){ return s.length > n ? s.slice(0, n-1) + "…" : s; }
function escapeHtml(s){
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function safeParseJSON(s){
  try { return JSON.parse(s); } catch { return null; }
}
function fileToDataUrl(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ---------- Init ----------
(function init(){
  // seed a couple demo items (optional)
  if (state.library.length === 0) {
    addLibraryItem("https://via.placeholder.com/400x400.png?text=Item+A", "Item A");
    addLibraryItem("https://via.placeholder.com/400x400.png?text=Item+B", "Item B");
  }

  applyCanvasSettings();
  renderLibrary();
  renderItems();
})();
