const { useState, useEffect, useRef, useCallback, useLayoutEffect } = React;
const DEFAULT_CATEGORIES = ["Ideas", "Lists", "Tasks", "Work"];
const storageAdapter = {
  async get(key) {
    try {
      const v = localStorage.getItem("notesapp_" + key);
      return v === null ? null : { key, value: v };
    } catch (e) {
      return null;
    }
  },
  async set(key, value) {
    try {
      localStorage.setItem("notesapp_" + key, value);
      return { key, value };
    } catch (e) {
      return null;
    }
  }
};
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function newBlock(type = "text", text = "") {
  return { id: uid(), type, text };
}
function newNote() {
  return { id: uid(), title: "", tags: [], archived: false, private: false, pinned: false, blocks: [], updatedAt: Date.now() };
}
function normalizeNote(n) {
  const { category, ...rest } = n;
  return { ...rest, tags: n.tags || (category ? [category] : []) };
}
function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
}
function sanitizeHtml(html) {
  if (!html) return "";
  const ALLOWED = /* @__PURE__ */ new Set(["b", "strong", "i", "em", "br", "span"]);
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  (function walk(node) {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === 1) {
        if (!ALLOWED.has(child.tagName.toLowerCase())) {
          node.replaceChild(document.createTextNode(child.textContent || ""), child);
        } else {
          Array.from(child.attributes).forEach((a) => child.removeAttribute(a.name));
          walk(child);
        }
      }
    });
  })(tmp);
  return tmp.innerHTML;
}
function isNoteEmpty(n) {
  if (n.title && n.title.trim()) return false;
  return !n.blocks.some((b) => b.text && stripHtml(b.text).trim());
}
function noteSnippet(n) {
  const parts = n.blocks.filter((b) => !b.done && b.text && stripHtml(b.text).trim()).map((b) => (b.type === "check" ? "\u25CB " : "") + stripHtml(b.text).trim());
  return parts.join("  \xB7  ") || "Empty note";
}
function noteActiveCount(n) {
  return n.blocks.filter((b) => b.type === "check" && !b.done && b.text && stripHtml(b.text).trim()).length;
}
function noteSummary(n) {
  const active = n.blocks.filter((b) => b.type === "check" && !b.done && stripHtml(b.text).trim());
  const done = n.blocks.filter((b) => b.type === "check" && b.done && stripHtml(b.text).trim());
  const texts = n.blocks.filter((b) => b.type === "text" && stripHtml(b.text).trim());
  const total = active.length + done.length;
  if (total > 0 && texts.length === 0) {
    return done.length === 0 ? `${active.length} task${active.length !== 1 ? "s" : ""}` : `${done.length} of ${total} done`;
  }
  if (texts.length > 0) {
    const first = stripHtml(texts[0].text).trim();
    const preview = first.length > 80 ? first.slice(0, 80) + "\u2026" : first;
    return total > 0 ? `${preview} \xB7 ${active.length} task${active.length !== 1 ? "s" : ""}` : preview;
  }
  return "Empty note";
}
function noteMatchesSearch(n, q) {
  if (!q.trim()) return true;
  const hay = (n.title + " " + n.tags.join(" ") + " " + n.blocks.map((b) => stripHtml(b.text)).join(" ")).toLowerCase();
  const words = q.toLowerCase().trim().split(/\s+/);
  return words.every((w) => hay.includes(w));
}
function highlightMatches(text, q) {
  const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return text;
  const pattern = new RegExp("(" + words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "ig");
  const parts = text.split(pattern);
  return parts.map(
    (part, i) => words.includes(part.toLowerCase()) ? /* @__PURE__ */ React.createElement("mark", { className: "search-highlight", key: i }, part) : part
  );
}
function onKeyActivate(fn) {
  return (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      fn(e);
    }
  };
}
const Icon = {
  grid: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8" }, /* @__PURE__ */ React.createElement("rect", { x: "3", y: "3", width: "8", height: "8", rx: "1.5" }), /* @__PURE__ */ React.createElement("rect", { x: "13", y: "3", width: "8", height: "8", rx: "1.5" }), /* @__PURE__ */ React.createElement("rect", { x: "3", y: "13", width: "8", height: "8", rx: "1.5" }), /* @__PURE__ */ React.createElement("rect", { x: "13", y: "13", width: "8", height: "8", rx: "1.5" })),
  plus: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), /* @__PURE__ */ React.createElement("line", { x1: "5", y1: "12", x2: "19", y2: "12" })),
  list: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8" }, /* @__PURE__ */ React.createElement("line", { x1: "8", y1: "6", x2: "21", y2: "6" }), /* @__PURE__ */ React.createElement("line", { x1: "8", y1: "12", x2: "21", y2: "12" }), /* @__PURE__ */ React.createElement("line", { x1: "8", y1: "18", x2: "21", y2: "18" }), /* @__PURE__ */ React.createElement("circle", { cx: "4", cy: "6", r: "1.3", fill: "currentColor", stroke: "none" }), /* @__PURE__ */ React.createElement("circle", { cx: "4", cy: "12", r: "1.3", fill: "currentColor", stroke: "none" }), /* @__PURE__ */ React.createElement("circle", { cx: "4", cy: "18", r: "1.3", fill: "currentColor", stroke: "none" })),
  back: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ React.createElement("line", { x1: "19", y1: "12", x2: "5", y2: "12" }), /* @__PURE__ */ React.createElement("polyline", { points: "12 19 5 12 12 5" })),
  check: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "3" }, /* @__PURE__ */ React.createElement("polyline", { points: "20 6 9 17 4 12" })),
  trash: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8" }, /* @__PURE__ */ React.createElement("polyline", { points: "3 6 5 6 21 6" }), /* @__PURE__ */ React.createElement("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })),
  archive: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8" }, /* @__PURE__ */ React.createElement("rect", { x: "3", y: "4", width: "18", height: "4", rx: "1" }), /* @__PURE__ */ React.createElement("path", { d: "M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" }), /* @__PURE__ */ React.createElement("line", { x1: "10", y1: "12", x2: "14", y2: "12" })),
  restore: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8" }, /* @__PURE__ */ React.createElement("path", { d: "M3 12a9 9 0 1 0 3-6.7" }), /* @__PURE__ */ React.createElement("polyline", { points: "3 4 3 9 8 9" })),
  search: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8" }, /* @__PURE__ */ React.createElement("circle", { cx: "11", cy: "11", r: "7" }), /* @__PURE__ */ React.createElement("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })),
  mic: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8" }, /* @__PURE__ */ React.createElement("rect", { x: "9", y: "2", width: "6", height: "12", rx: "3" }), /* @__PURE__ */ React.createElement("path", { d: "M5 10v1a7 7 0 0 0 14 0v-1" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "18", x2: "12", y2: "22" }), /* @__PURE__ */ React.createElement("line", { x1: "8", y1: "22", x2: "16", y2: "22" })),
  send: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ React.createElement("line", { x1: "5", y1: "12", x2: "19", y2: "12" }), /* @__PURE__ */ React.createElement("polyline", { points: "13 6 19 12 13 18" })),
  pin: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8" }, /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "17", x2: "12", y2: "22" }), /* @__PURE__ */ React.createElement("path", { d: "M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" })),
  key: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8" }, /* @__PURE__ */ React.createElement("circle", { cx: "8", cy: "15", r: "5" }), /* @__PURE__ */ React.createElement("line", { x1: "13", y1: "10", x2: "22", y2: "10" }), /* @__PURE__ */ React.createElement("line", { x1: "19", y1: "10", x2: "19", y2: "13" })),
  refresh: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8" }, /* @__PURE__ */ React.createElement("polyline", { points: "23 4 23 10 17 10" }), /* @__PURE__ */ React.createElement("path", { d: "M20.49 15a9 9 0 1 1-2.12-9.36L23 10" })),
  eye: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8" }, /* @__PURE__ */ React.createElement("path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }), /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "3" })),
  eyeOff: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8" }, /* @__PURE__ */ React.createElement("path", { d: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" }), /* @__PURE__ */ React.createElement("line", { x1: "1", y1: "1", x2: "23", y2: "23" })),
  edit: /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8" }, /* @__PURE__ */ React.createElement("path", { d: "M12 20h9" }), /* @__PURE__ */ React.createElement("path", { d: "M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" }))
};
function App() {
  const [tab, setTab] = useState("dashboard");
  const [notes, setNotes] = useState(null);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [editingId, setEditingId] = useState(null);
  const [storageOk, setStorageOk] = useState(true);
  useEffect(() => {
    (async () => {
      let loadedNotes = [];
      try {
        const r = await storageAdapter.get("notes_v2");
        loadedNotes = (r ? JSON.parse(r.value) : []).map(normalizeNote);
      } catch (e) {
      }
      try {
        const c = await storageAdapter.get("categories_v1");
        setCategories(c ? JSON.parse(c.value) : DEFAULT_CATEGORIES);
      } catch (e) {
        setCategories(DEFAULT_CATEGORIES);
      }
      const n = newNote();
      const next = [n, ...loadedNotes];
      setNotes(next);
      setEditingId(n.id);
      try {
        await storageAdapter.set("notes_v2", JSON.stringify(next));
      } catch (e) {
      }
    })();
  }, []);
  const persist = useCallback(async (next) => {
    setNotes(next);
    try {
      const r = await storageAdapter.set("notes_v2", JSON.stringify(next));
      if (!r) setStorageOk(false);
    } catch (e) {
      setStorageOk(false);
    }
  }, []);
  const persistCategories = useCallback(async (next) => {
    setCategories(next);
    try {
      await storageAdapter.set("categories_v1", JSON.stringify(next));
    } catch (e) {
    }
  }, []);
  if (notes === null) {
    return /* @__PURE__ */ React.createElement("div", { style: { padding: "40px", color: "var(--muted)" } }, "loading", /* @__PURE__ */ React.createElement("span", { className: "cursor-blink" }));
  }
  function openNewNote() {
    const current = editingId ? notes.find((n2) => n2.id === editingId) : null;
    if (current && isNoteEmpty(current)) return;
    const n = newNote();
    persist([n, ...notes]);
    setEditingId(n.id);
  }
  function openNote(id) {
    setEditingId(id);
  }
  function closeEditor() {
    const current = notes.find((n) => n.id === editingId);
    if (current && isNoteEmpty(current)) {
      persist(notes.filter((n) => n.id !== editingId));
    }
    setEditingId(null);
  }
  function updateNote(id, patch) {
    persist(notes.map((n) => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n));
  }
  function deleteNote(id) {
    persist(notes.filter((n) => n.id !== id));
    setEditingId(null);
  }
  function deleteMany(ids) {
    persist(notes.filter((n) => !ids.has(n.id)));
  }
  function pinNote(id) {
    persist(notes.map((n) => n.id === id ? { ...n, pinned: !n.pinned } : n));
  }
  function addCategory(name) {
    const clean = name.trim();
    if (!clean || categories.includes(clean)) return clean;
    persistCategories([...categories, clean]);
    return clean;
  }
  function renameCategory(oldName, newName) {
    const clean = newName.trim();
    if (!clean || clean === oldName) return "noop";
    if (categories.includes(clean)) return "duplicate";
    persistCategories(categories.map((c) => c === oldName ? clean : c));
    persist(notes.map((n) => n.tags.includes(oldName) ? { ...n, tags: n.tags.map((t) => t === oldName ? clean : t) } : n));
    return "ok";
  }
  function deleteCategory(name) {
    persistCategories(categories.filter((c) => c !== name));
    persist(notes.map((n) => n.tags.includes(name) ? { ...n, tags: n.tags.filter((t) => t !== name) } : n));
  }
  const editingNote = editingId ? notes.find((n) => n.id === editingId) : null;
  function navigate(newTab) {
    closeEditor();
    setTab(newTab);
  }
  function saveAndViewNotes() {
    closeEditor();
    setTab("notes");
  }
  return /* @__PURE__ */ React.createElement("div", { className: "shell" }, /* @__PURE__ */ React.createElement("main", { className: "screen" }, editingNote ? /* @__PURE__ */ React.createElement(
    Editor,
    {
      key: editingNote.id,
      note: editingNote,
      categories,
      onChange: (patch) => updateNote(editingNote.id, patch),
      onAddCategory: addCategory,
      onRenameCategory: renameCategory,
      onDeleteCategory: deleteCategory,
      onBack: closeEditor,
      onSave: saveAndViewNotes
    }
  ) : tab === "dashboard" ? /* @__PURE__ */ React.createElement(
    Dashboard,
    {
      notes,
      categories,
      storageOk,
      onOpenNote: openNote
    }
  ) : /* @__PURE__ */ React.createElement(NotesList, { notes, categories, onOpenNote: openNote, onDeleteMany: deleteMany, onPinNote: pinNote })), /* @__PURE__ */ React.createElement("nav", { className: "bottom-nav", "aria-label": "Primary" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "nav-item" + (!editingNote && tab === "dashboard" ? " active" : ""),
      onClick: () => navigate("dashboard"),
      "aria-current": !editingNote && tab === "dashboard" ? "page" : void 0
    },
    Icon.grid,
    /* @__PURE__ */ React.createElement("span", { className: "nav-label" }, "dashboard")
  ), /* @__PURE__ */ React.createElement("div", { className: "nav-item", onClick: openNewNote }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "nav-create-btn", "aria-label": "New note" }, Icon.plus)), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "nav-item" + (!editingNote && tab === "notes" ? " active" : ""),
      onClick: () => navigate("notes"),
      "aria-current": !editingNote && tab === "notes" ? "page" : void 0
    },
    Icon.list,
    /* @__PURE__ */ React.createElement("span", { className: "nav-label" }, "notes")
  )));
}
function Dashboard({ notes, categories, storageOk, onOpenNote }) {
  const [activeFilter, setActiveFilter] = useState(null);
  const realNotes = notes.filter((n) => !n.archived && !isNoteEmpty(n));
  const catCounts = categories.map((cat) => ({ cat, count: realNotes.filter((n) => n.tags.includes(cat)).length })).filter((b) => b.count > 0);
  const filteredNotes = activeFilter ? realNotes.filter((n) => n.tags.includes(activeFilter)) : realNotes;
  function buildSummary() {
    if (realNotes.length === 0) return "No notes yet \u2014 tap + to start one.";
    const visible = realNotes.filter((n) => !n.private);
    if (visible.length === 0) return "All notes are set to private.";
    const sorted = [...visible].sort((a, b) => b.updatedAt - a.updatedAt);
    function openItems(n) {
      return n.blocks.filter((b) => b.type === "check" && !b.done && stripHtml(b.text).trim()).map((b) => stripHtml(b.text).trim());
    }
    function hasChecklist(n) {
      return n.blocks.some((b) => b.type === "check" && stripHtml(b.text).trim());
    }
    function textLines(n) {
      return n.blocks.filter((b) => b.type === "text" && !b.done && stripHtml(b.text).trim()).map((b) => stripHtml(b.text).trim());
    }
    function noteRef(n) {
      const t = n.title?.trim();
      if (t) return `"${t}"`;
      const lines = textLines(n);
      if (lines[0]) {
        const words = lines[0].split(/\s+/).slice(0, 5).join(" ");
        return `"${words}${lines[0].split(/\s+/).length > 5 ? "\u2026" : ""}"`;
      }
      return "an untitled note";
    }
    function catOf(n) {
      return n.tags[0]?.trim() || "";
    }
    function sharedTag(a, b) {
      return a.tags.find((t) => b.tags.includes(t)) || "";
    }
    function related(a, b) {
      if (sharedTag(a, b)) return true;
      const aw = (a.title || "").toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const bw = (b.title || "").toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      return aw.some((w) => bw.includes(w));
    }
    const assigned = /* @__PURE__ */ new Set();
    const clusters = [];
    sorted.forEach((n) => {
      if (assigned.has(n.id)) return;
      const cluster = [n];
      assigned.add(n.id);
      sorted.forEach((m) => {
        if (!assigned.has(m.id) && related(n, m)) {
          cluster.push(m);
          assigned.add(m.id);
        }
      });
      clusters.push(cluster);
    });
    const allOpen = sorted.flatMap(openItems);
    const anyChecklist = sorted.some(hasChecklist);
    const sentences = [];
    if (sorted.length === 1) {
      const n = sorted[0];
      const open = openItems(n);
      const cat = catOf(n);
      const lines = textLines(n);
      let s = `You have one note \u2014 ${noteRef(n)}${cat ? `, filed under ${cat}` : ""}.`;
      if (open.length > 0) {
        s += ` You left off with some ideas still in motion \u2014 "${open[0]}" might be worth picking back up.`;
      } else if (lines.length > 0) {
        s += ` It looks like you've been using it to collect your thoughts.`;
      } else if (hasChecklist(n)) {
        s += ` The items you were tracking look like they've been taken care of.`;
      }
      return s;
    }
    if (sorted.length === 2) {
      const [a, b] = sorted;
      const aOpen = openItems(a);
      const bOpen = openItems(b);
      const sharedCat = sharedTag(a, b);
      if (related(a, b)) {
        sentences.push(
          `Your two notes feel like they're covering different angles of the same area of thinking \u2014 ${noteRef(a)} and ${noteRef(b)}${sharedCat ? `, both under ${sharedCat}` : ""}.`
        );
      } else {
        sentences.push(
          `You have two separate threads going \u2014 ${noteRef(a)}${catOf(a) ? ` (${catOf(a)})` : ""} and ${noteRef(b)}${catOf(b) ? ` (${catOf(b)})` : ""}.`
        );
      }
      if (aOpen.length > 0 && bOpen.length > 0) {
        sentences.push(`Both have some open thinking in them \u2014 "${aOpen[0]}" is one idea you left off on.`);
      } else if (aOpen.length > 0) {
        sentences.push(`${noteRef(a)} still has some ideas in motion \u2014 "${aOpen[0]}" is one worth revisiting.`);
      } else if (bOpen.length > 0) {
        sentences.push(`${noteRef(b)} has some open thinking in it \u2014 "${bOpen[0]}" is still unresolved.`);
      } else if (anyChecklist) {
        sentences.push(`The items you've been tracking look like they're in a good place.`);
      }
      return sentences.join(" ");
    }
    const primary = clusters[0];
    const pCat = catOf(primary[0]);
    if (primary.length >= 2) {
      const refs = primary.slice(0, 2).map(noteRef).join(" and ");
      const pOpen = primary.flatMap(openItems);
      sentences.push(
        `Your recent attention has been centered on ${refs}${pCat ? ` \u2014 both part of your ${pCat.toLowerCase()} work` : ", which feel like two sides of the same area of focus"}.`
      );
      if (pOpen.length > 0) {
        sentences.push(`There are still some open ideas running through them \u2014 "${pOpen[0]}" is one thing you left in motion.`);
      }
    } else {
      const n = primary[0];
      const open = openItems(n);
      const lines = textLines(n);
      sentences.push(
        `Your most recent focus has been on ${noteRef(n)}${pCat ? ` \u2014 ${pCat.toLowerCase()} work` : ""}.`
      );
      if (open.length > 0) {
        sentences.push(`You left some ideas open there \u2014 "${open[0]}" looks like something you were actively working through.`);
      } else if (lines.length > 0 && !hasChecklist(n)) {
        sentences.push(`It reads more like a thinking space \u2014 collected notes rather than a checklist.`);
      }
    }
    clusters.slice(1).forEach((cluster) => {
      const cCat = catOf(cluster[0]);
      const cOpen = cluster.flatMap(openItems);
      if (cluster.length === 1) {
        const n = cluster[0];
        const open = openItems(n);
        const lines = textLines(n);
        sentences.push(
          `${noteRef(n)} is a separate thread${cCat ? ` in your ${cCat.toLowerCase()} space` : ""}` + (open.length > 0 ? ` \u2014 still some open thinking there, like "${open[0]}"` : hasChecklist(n) ? ", and it looks mostly settled" : lines.length > 0 ? " \u2014 more of a space for collected thoughts" : "") + "."
        );
      } else {
        const refs = cluster.slice(0, 2).map(noteRef).join(" and ");
        sentences.push(
          `${refs} form a separate thread${cCat ? ` around ${cCat.toLowerCase()}` : ""}` + (cOpen.length > 0 ? `, with some open ideas still in play` : "") + "."
        );
      }
    });
    const mentioned = sentences.join(" ");
    if (allOpen.length === 0 && anyChecklist) {
      sentences.push(`Everything looks settled \u2014 nothing seems urgently unresolved right now.`);
    } else {
      const unmentioned = allOpen.find((item) => !mentioned.includes(item));
      if (unmentioned) {
        sentences.push(`One other idea that might be worth coming back to: "${unmentioned}".`);
      }
    }
    return sentences.join(" ");
  }
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("header", { className: "topbar" }, /* @__PURE__ */ React.createElement("div", { className: "brand" }, /* @__PURE__ */ React.createElement("span", { className: "dot" }), "notes")), !storageOk && /* @__PURE__ */ React.createElement("div", { className: "empty-msg", style: { color: "var(--danger)" } }, "storage error \u2014 changes may not save"), /* @__PURE__ */ React.createElement("div", { className: "summary-section" }, /* @__PURE__ */ React.createElement("div", { className: "summary-section-header" }, /* @__PURE__ */ React.createElement("span", { className: "summary-section-label" }, "Snapshot")), /* @__PURE__ */ React.createElement("div", { className: "summary-text" + (realNotes.length === 0 ? " placeholder" : "") }, buildSummary())), catCounts.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "cat-filter-grid" }, catCounts.map((b) => /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      key: b.cat,
      className: "cat-filter-chip" + (activeFilter === b.cat ? " active" : ""),
      style: catCounts.length === 1 ? { gridColumn: "1 / -1" } : {},
      onClick: () => setActiveFilter(activeFilter === b.cat ? null : b.cat),
      "aria-pressed": activeFilter === b.cat
    },
    /* @__PURE__ */ React.createElement("div", { className: "num" }, b.count),
    /* @__PURE__ */ React.createElement("div", { className: "label" }, b.cat)
  ))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "panel-title", style: { marginBottom: 10 } }, /* @__PURE__ */ React.createElement("h2", null, activeFilter || "recent"), activeFilter && /* @__PURE__ */ React.createElement("button", { className: "icon-btn-plain", onClick: () => setActiveFilter(null), title: "clear filter", "aria-label": "Clear filter" }, "\u2715")), filteredNotes.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "empty-msg" }, activeFilter ? `No notes tagged "${activeFilter}".` : "No notes yet \u2014 tap + to start one."), [...filteredNotes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5).map((n) => /* @__PURE__ */ React.createElement("button", { type: "button", className: "note-card", key: n.id, onClick: () => onOpenNote(n.id), style: { marginBottom: 8 } }, /* @__PURE__ */ React.createElement("div", { className: "note-card-body" }, n.private ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "title" }, n.title || "Private note"), /* @__PURE__ */ React.createElement("div", { className: "private-snippet" }, Icon.eyeOff, /* @__PURE__ */ React.createElement("span", null, "private"))) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "title" }, n.title || "Untitled"), /* @__PURE__ */ React.createElement("div", { className: "snippet" }, noteSummary(n)), /* @__PURE__ */ React.createElement("div", { className: "meta-row" }, /* @__PURE__ */ React.createElement("span", { className: "meta" }, n.tags.map((t) => /* @__PURE__ */ React.createElement("span", { className: "cat-tag", key: t }, t))), noteActiveCount(n) > 0 && /* @__PURE__ */ React.createElement("span", { className: "badge" }, noteActiveCount(n), " active"))))))));
}
function SwipeableCard({ onSwipeDelete, onSwipePin, pinned, disabled, children }) {
  const [offsetX, setOffsetX] = useState(0);
  const [snap, setSnap] = useState(false);
  const [open, setOpen] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(true);
  const REVEAL = 112;
  const startX = useRef(0);
  const startY = useRef(0);
  const active = useRef(false);
  const horiz = useRef(false);
  const cardRef = useRef(null);
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    function onMove(e) {
      if (!active.current || disabled) return;
      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;
      if (!horiz.current) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        if (Math.abs(dx) >= Math.abs(dy)) {
          horiz.current = true;
        } else {
          active.current = false;
          return;
        }
      }
      e.preventDefault();
      let x = Math.min(0, dx);
      if (x < -REVEAL - 20) x = -REVEAL - 20 + (x + REVEAL + 20) * 0.1;
      setSnap(false);
      setOffsetX(x);
    }
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => el.removeEventListener("touchmove", onMove);
  }, [disabled]);
  function onStart(e) {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    active.current = true;
    horiz.current = false;
    setSnap(false);
  }
  function onEnd() {
    if (!active.current) return;
    active.current = false;
    setSnap(true);
    if (offsetX < -(REVEAL / 2)) {
      setOffsetX(-REVEAL);
      setOpen(true);
    } else {
      close();
    }
  }
  function close() {
    setSnap(true);
    setOffsetX(0);
    setOpen(false);
  }
  function handleDelete() {
    setActionsVisible(false);
    setSnap(true);
    setOffsetX(-500);
    setTimeout(() => {
      onSwipeDelete();
      setOffsetX(0);
      setSnap(false);
      setOpen(false);
      setActionsVisible(true);
    }, 220);
  }
  function handlePin() {
    onSwipePin();
    close();
  }
  const swiped = offsetX < -8;
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      ref: cardRef,
      style: { position: "relative", marginBottom: 10 },
      onTouchStart: onStart,
      onTouchEnd: onEnd,
      onTouchCancel: () => {
        active.current = false;
        close();
      }
    },
    actionsVisible && /* @__PURE__ */ React.createElement(
      "div",
      {
        style: { position: "absolute", right: 0, top: 0, bottom: 0, width: REVEAL, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 },
        onTouchStart: (e) => e.stopPropagation(),
        onTouchEnd: (e) => e.stopPropagation()
      },
      /* @__PURE__ */ React.createElement("button", { className: "swipe-action-btn swipe-delete", onClick: handleDelete, "aria-label": "Delete note" }, Icon.trash),
      /* @__PURE__ */ React.createElement("button", { className: "swipe-action-btn swipe-pin", onClick: handlePin, "aria-label": pinned ? "Unpin note" : "Pin note" }, Icon.pin)
    ),
    /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "swipe-inner" + (swiped ? " swiped" : ""),
        style: { transform: `translateX(${offsetX}px)`, transition: snap ? "transform .22s ease" : "none", willChange: "transform" },
        onClick: open ? close : void 0
      },
      children
    )
  );
}
function NotesList({ notes, categories, onOpenNote, onDeleteMany, onPinNote }) {
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selected, setSelected] = useState(/* @__PURE__ */ new Set());
  const [pendingDelete, setPendingDelete] = useState(/* @__PURE__ */ new Set());
  const [deleteToast, setDeleteToast] = useState(null);
  const deleteTimer = useRef(null);
  const allReal = notes.filter((n) => !n.archived && !isNoteEmpty(n) && !pendingDelete.has(n.id));
  const usedCats = categories.filter((cat) => allReal.some((n) => n.tags.includes(cat)));
  const realNotes = allReal.filter((n) => (!activeFilter || n.tags.includes(activeFilter)) && noteMatchesSearch(n, q)).sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updatedAt - a.updatedAt;
  });
  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function exitEdit() {
    setIsEditing(false);
    setSelected(/* @__PURE__ */ new Set());
  }
  function handleSwipeDelete(id) {
    clearTimeout(deleteTimer.current);
    if (pendingDelete.size > 0) onDeleteMany(pendingDelete);
    const ids = /* @__PURE__ */ new Set([id]);
    setPendingDelete(ids);
    setDeleteToast(1);
    deleteTimer.current = setTimeout(() => {
      onDeleteMany(ids);
      setPendingDelete(/* @__PURE__ */ new Set());
      setDeleteToast(null);
    }, 3e3);
  }
  function handleDelete() {
    const ids = new Set(selected);
    const count = ids.size;
    setPendingDelete(ids);
    setDeleteToast(count);
    exitEdit();
    clearTimeout(deleteTimer.current);
    deleteTimer.current = setTimeout(() => {
      onDeleteMany(ids);
      setPendingDelete(/* @__PURE__ */ new Set());
      setDeleteToast(null);
    }, 3e3);
  }
  function handleUndo() {
    clearTimeout(deleteTimer.current);
    setPendingDelete(/* @__PURE__ */ new Set());
    setDeleteToast(null);
  }
  function handleCardTap(id) {
    if (isEditing) {
      toggleSelect(id);
    } else {
      onOpenNote(id);
    }
  }
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("header", { className: "topbar" }, /* @__PURE__ */ React.createElement("div", { className: "brand" }, /* @__PURE__ */ React.createElement("span", { className: "dot" }), "notes"), /* @__PURE__ */ React.createElement("div", { className: "topbar-actions" }, isEditing ? /* @__PURE__ */ React.createElement(React.Fragment, null, selected.size > 0 && /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "icon-btn-plain",
      style: { color: "var(--danger)" },
      onClick: handleDelete,
      title: "delete selected",
      "aria-label": "Delete selected notes"
    },
    Icon.trash
  ), /* @__PURE__ */ React.createElement("button", { className: "icon-btn-plain", onClick: exitEdit }, "done")) : /* @__PURE__ */ React.createElement("button", { className: "icon-btn-plain", onClick: () => setIsEditing(true) }, "edit"))), !isEditing && /* @__PURE__ */ React.createElement("div", { className: "search-box" }, Icon.search, /* @__PURE__ */ React.createElement("input", { type: "text", placeholder: "Search notes...", value: q, onChange: (e) => setQ(e.target.value), autoFocus: true })), !isEditing && usedCats.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "filter-chips" }, usedCats.map((cat) => /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      key: cat,
      className: "filter-chip" + (activeFilter === cat ? " active" : ""),
      onClick: () => setActiveFilter(activeFilter === cat ? null : cat),
      "aria-pressed": activeFilter === cat
    },
    cat
  ))), isEditing && selected.size > 0 && /* @__PURE__ */ React.createElement("div", { className: "bulk-bar" }, selected.size, " selected"), realNotes.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "empty-msg" }, q || activeFilter ? "No matches." : "No notes yet."), realNotes.map((n) => /* @__PURE__ */ React.createElement(
    SwipeableCard,
    {
      key: n.id,
      disabled: isEditing,
      pinned: n.pinned,
      onSwipeDelete: () => handleSwipeDelete(n.id),
      onSwipePin: () => onPinNote(n.id)
    },
    /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "note-card" + (isEditing && selected.has(n.id) ? " selected" : ""),
        style: { marginBottom: 0 },
        onClick: () => handleCardTap(n.id),
        role: isEditing ? "checkbox" : "button",
        "aria-checked": isEditing ? selected.has(n.id) : void 0,
        tabIndex: 0,
        onKeyDown: onKeyActivate(() => handleCardTap(n.id))
      },
      isEditing && /* @__PURE__ */ React.createElement("div", { className: "select-circle" + (selected.has(n.id) ? " checked" : ""), "aria-hidden": "true" }),
      /* @__PURE__ */ React.createElement("div", { className: "note-card-body" }, /* @__PURE__ */ React.createElement("div", { className: "title" }, n.title ? q.trim() ? highlightMatches(n.title, q) : n.title : "Untitled"), /* @__PURE__ */ React.createElement("div", { className: "snippet" }, q.trim() ? highlightMatches(noteSnippet(n), q) : noteSnippet(n)), /* @__PURE__ */ React.createElement("div", { className: "meta-row" }, /* @__PURE__ */ React.createElement("span", { className: "meta" }, n.tags.map((t) => /* @__PURE__ */ React.createElement("span", { className: "cat-tag", key: t }, t))), noteActiveCount(n) > 0 && /* @__PURE__ */ React.createElement("span", { className: "badge" }, noteActiveCount(n), " active"))),
      !isEditing && /* @__PURE__ */ React.createElement(
        "button",
        {
          className: "card-pin-btn" + (n.pinned ? " pinned" : ""),
          onClick: (e) => {
            e.stopPropagation();
            onPinNote(n.id);
          },
          "aria-label": n.pinned ? "Unpin note" : "Pin note",
          "aria-pressed": n.pinned
        },
        Icon.pin
      )
    )
  )), deleteToast !== null && /* @__PURE__ */ React.createElement("div", { className: "toast toast-undo", role: "status", "aria-live": "polite" }, /* @__PURE__ */ React.createElement("span", null, deleteToast === 1 ? "1 note deleted" : `${deleteToast} notes deleted`), /* @__PURE__ */ React.createElement("button", { onClick: handleUndo }, "Undo")));
}
function CategoryPicker({ categories, selected, onSelectedChange, onAddCategory, onRenameCategory, onDeleteCategory }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingCat, setEditingCat] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [renameError, setRenameError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const inputRef = useRef(null);
  const rowRef = useRef(null);
  const pressTimer = useRef(null);
  const renameErrorTimer = useRef(null);
  const didLongPress = useRef(false);
  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);
  useLayoutEffect(() => {
    const el = rowRef.current;
    if (!el || expanded) return;
    setOverflows(el.scrollHeight > el.clientHeight + 4);
  }, [categories, expanded]);
  function submit() {
    const name = onAddCategory(draft);
    if (name && !selected.includes(name)) onSelectedChange([...selected, name]);
    setDraft("");
    setAdding(false);
  }
  function startPress(cat) {
    didLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setEditingCat(cat);
      setEditDraft(cat);
      setRenameError(null);
    }, 500);
  }
  function cancelPress() {
    clearTimeout(pressTimer.current);
  }
  function handleChipClick(cat) {
    if (didLongPress.current) {
      didLongPress.current = false;
      return;
    }
    onSelectedChange(selected.includes(cat) ? selected.filter((c) => c !== cat) : [...selected, cat]);
  }
  function confirmRename() {
    const clean = editDraft.trim();
    const result = onRenameCategory(editingCat, clean);
    if (result === "duplicate") {
      clearTimeout(renameErrorTimer.current);
      setRenameError(`A tag named "${clean}" already exists`);
      renameErrorTimer.current = setTimeout(() => setRenameError(null), 2500);
      return;
    }
    if (result === "ok" && selected.includes(editingCat)) {
      onSelectedChange(selected.map((c) => c === editingCat ? clean : c));
    }
    setEditingCat(null);
    setRenameError(null);
  }
  function cancelRename() {
    clearTimeout(renameErrorTimer.current);
    setRenameError(null);
    setEditingCat(null);
  }
  function handleDeleteCat(cat) {
    if (selected.includes(cat)) onSelectedChange(selected.filter((c) => c !== cat));
    onDeleteCategory(cat);
    setEditingCat(null);
  }
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { ref: rowRef, className: "cat-row" + (!expanded ? " collapsed" : "") }, categories.map((c) => editingCat === c ? /* @__PURE__ */ React.createElement(
    "div",
    {
      key: c,
      style: { display: "flex", gap: 4, alignItems: "center" },
      onBlur: (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) confirmRename();
      }
    },
    /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "cat-new-input",
        autoFocus: true,
        value: editDraft,
        "aria-label": "Rename category",
        onChange: (e) => {
          setEditDraft(e.target.value);
          if (renameError) setRenameError(null);
        },
        onKeyDown: (e) => {
          if (e.key === "Enter") confirmRename();
          if (e.key === "Escape") cancelRename();
        }
      }
    ),
    /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "icon-btn-plain",
        style: { color: "var(--danger)", padding: "2px" },
        onMouseDown: (e) => e.preventDefault(),
        onClick: () => handleDeleteCat(c),
        "aria-label": `Delete category "${c}"`
      },
      Icon.trash
    )
  ) : /* @__PURE__ */ React.createElement("div", { key: c, className: "cat-pick-wrap" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "cat-pick" + (selected.includes(c) ? " selected" : ""),
      onClick: () => handleChipClick(c),
      onMouseDown: () => startPress(c),
      onMouseUp: cancelPress,
      onMouseLeave: cancelPress,
      onTouchStart: () => startPress(c),
      onTouchEnd: cancelPress,
      onContextMenu: (e) => e.preventDefault(),
      "aria-pressed": selected.includes(c)
    },
    c
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "cat-edit-btn",
      onClick: () => {
        setEditingCat(c);
        setEditDraft(c);
        setRenameError(null);
      },
      "aria-label": `Edit category "${c}"`
    },
    Icon.edit
  ))), adding ? /* @__PURE__ */ React.createElement(
    "input",
    {
      ref: inputRef,
      className: "cat-new-input",
      placeholder: "Category name",
      "aria-label": "New category name",
      value: draft,
      onChange: (e) => setDraft(e.target.value),
      onKeyDown: (e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") {
          setAdding(false);
          setDraft("");
        }
      },
      onBlur: submit
    }
  ) : /* @__PURE__ */ React.createElement("button", { type: "button", className: "cat-pick add", onClick: () => setAdding(true) }, "+ new")), (overflows || expanded) && /* @__PURE__ */ React.createElement("button", { className: "cat-show-more", onClick: () => setExpanded((v) => !v) }, expanded ? "show less \u25B4" : "show more \u25BE"), renameError && /* @__PURE__ */ React.createElement("div", { className: "toast", role: "status", "aria-live": "polite" }, renameError));
}
function caretAtFirstLine(el) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return true;
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(true);
  const rect = range.getClientRects()[0];
  if (!rect) return true;
  const elRect = el.getBoundingClientRect();
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
  return rect.top - elRect.top < lineHeight / 2;
}
function caretAtLastLine(el) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return true;
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(true);
  const rects = range.getClientRects();
  const rect = rects[rects.length - 1];
  if (!rect) return true;
  const elRect = el.getBoundingClientRect();
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
  return elRect.bottom - rect.bottom < lineHeight / 2;
}
function isCaretAtStart(el) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  const range = sel.getRangeAt(0);
  if (!range.collapsed || range.startOffset !== 0) return false;
  let node = range.startContainer;
  while (node !== el) {
    if (node.previousSibling) return false;
    node = node.parentNode;
    if (!node) return false;
  }
  return true;
}
function isCaretAtEnd(el) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return false;
  let node = range.startContainer;
  const len = node.nodeType === 3 ? node.textContent.length : node.childNodes.length;
  if (range.startOffset !== len) return false;
  while (node !== el) {
    if (node.nextSibling) return false;
    node = node.parentNode;
    if (!node) return false;
  }
  return true;
}
function Editor({ note, categories, onChange, onAddCategory, onRenameCategory, onDeleteCategory, onBack, onSave }) {
  const [blocks, setBlocks] = useState(note.blocks);
  const [title, setTitle] = useState(note.title);
  const [tags, setTags] = useState(note.tags || []);
  const [isPrivate, setIsPrivate] = useState(note.private || false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [leaving, setLeaving] = useState({});
  const [focusTarget, setFocusTarget] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const refs = useRef({});
  const composerRef = useRef(null);
  useEffect(() => {
    onChange({ title, blocks, tags, private: isPrivate });
  }, [title, blocks, tags, isPrivate]);
  useEffect(() => {
    if (focusTarget && refs.current[focusTarget.id]) {
      const el = refs.current[focusTarget.id];
      el.focus();
      try {
        const range = document.createRange();
        const sel = window.getSelection();
        if (focusTarget.pos === 0) {
          range.setStart(el, 0);
          range.collapse(true);
        } else {
          range.selectNodeContents(el);
          range.collapse(false);
        }
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (e) {
      }
      setFocusTarget(null);
    }
  }, [focusTarget, blocks]);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function updatePos() {
      if (!composerRef.current) return;
      const keyboardH = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      composerRef.current.style.bottom = (keyboardH > 10 ? keyboardH + 16 : 130) + "px";
    }
    vv.addEventListener("resize", updatePos);
    vv.addEventListener("scroll", updatePos);
    updatePos();
    return () => {
      vv.removeEventListener("resize", updatePos);
      vv.removeEventListener("scroll", updatePos);
    };
  }, []);
  function addBlock() {
    const b = newBlock("text", "");
    setBlocks((prev) => [...prev, b]);
    setFocusTarget({ id: b.id, pos: 0 });
  }
  function setBlockHtml(id, html, el) {
    const plain = el ? el.innerText || "" : stripHtml(html);
    if (el && plain.startsWith("- ")) {
      el.innerHTML = "";
      setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, type: "check", text: "" } : b));
      return;
    }
    const normalized = html === "<br>" ? "" : sanitizeHtml(html);
    setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, text: normalized } : b));
  }
  function completeBlock(id) {
    setLeaving((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, done: true } : b));
      setLeaving((prev) => {
        const p = { ...prev };
        delete p[id];
        return p;
      });
    }, 220);
  }
  function uncompleteBlock(id) {
    setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, done: false } : b));
  }
  function handleBlockPointerUp() {
    const sel = window.getSelection();
    const text = sel ? sel.toString() : "";
    if (!text.trim()) return;
    navigator.clipboard.writeText(text).then(() => {
      clearTimeout(toastTimer.current);
      setToast("Copied");
      toastTimer.current = setTimeout(() => setToast(null), 1500);
    }).catch(() => {
      try {
        document.execCommand("copy");
      } catch (e) {
      }
    });
  }
  function handleBlockKeyDown(e, block, index) {
    if ((e.metaKey || e.ctrlKey) && e.key === "b") {
      e.preventDefault();
      document.execCommand("bold");
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "i") {
      e.preventDefault();
      document.execCommand("italic");
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "a") {
      e.preventDefault();
      const orderedEls = blocks.filter((b) => !b.done).map((b) => refs.current[b.id]).filter(Boolean);
      if (!orderedEls.length) return;
      try {
        const range = document.createRange();
        const sel = window.getSelection();
        range.setStart(orderedEls[0], 0);
        const last = orderedEls[orderedEls.length - 1];
        range.setEnd(last, last.childNodes.length);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (err) {
      }
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const el = e.currentTarget;
      const goingUp = e.key === "ArrowUp";
      if (goingUp ? caretAtFirstLine(el) : caretAtLastLine(el)) {
        const activeIds = blocks.filter((b) => !b.done).map((b) => b.id);
        const pos = activeIds.indexOf(block.id);
        const targetId = activeIds[goingUp ? pos - 1 : pos + 1];
        if (targetId) {
          e.preventDefault();
          setFocusTarget({ id: targetId, pos: goingUp ? "end" : 0 });
        }
      }
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const el = e.currentTarget;
      const goingLeft = e.key === "ArrowLeft";
      if (goingLeft ? isCaretAtStart(el) : isCaretAtEnd(el)) {
        const activeIds = blocks.filter((b) => !b.done).map((b) => b.id);
        const pos = activeIds.indexOf(block.id);
        const targetId = activeIds[goingLeft ? pos - 1 : pos + 1];
        if (targetId) {
          e.preventDefault();
          setFocusTarget({ id: targetId, pos: goingLeft ? "end" : 0 });
        }
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const el = e.currentTarget;
      const isEmpty = el.innerHTML === "" || el.innerHTML === "<br>" || el.innerText.trim() === "";
      const innerText = el.innerText || "";
      const isBullet = innerText.startsWith("\u2022 ") || innerText.trim() === "\u2022";
      if (isBullet) {
        if (innerText.trim() === "\u2022" || innerText === "\u2022 ") {
          const b = newBlock("text", "");
          setBlocks((prev) => {
            const next = [...prev];
            next.splice(index, 1, b);
            return next;
          });
          setFocusTarget({ id: b.id, pos: 0 });
        } else {
          const b = newBlock("text", "\u2022 ");
          setBlocks((prev) => {
            const next = [...prev];
            next.splice(index + 1, 0, b);
            return next;
          });
          setFocusTarget({ id: b.id, pos: "end" });
        }
        return;
      }
      if (block.type === "check" && isEmpty) {
        const b = newBlock("text", "");
        setBlocks((prev) => {
          const next = [...prev];
          next.splice(index, 1, b);
          return next;
        });
        setFocusTarget({ id: b.id, pos: 0 });
      } else {
        const b = newBlock(block.type, "");
        setBlocks((prev) => {
          const next = [...prev];
          next.splice(index + 1, 0, b);
          return next;
        });
        setFocusTarget({ id: b.id, pos: 0 });
      }
    }
    if (e.key === "Backspace") {
      const el = e.currentTarget;
      const isEmpty = el.innerHTML === "" || el.innerHTML === "<br>" || el.innerText.trim() === "";
      if (isEmpty && index > 0) {
        e.preventDefault();
        setBlocks((prev) => {
          const prevBlock = prev[index - 1];
          const next = [...prev];
          next.splice(index, 1);
          setFocusTarget({ id: prevBlock.id, pos: "end" });
          return next;
        });
      }
    }
  }
  const activeBlocks = blocks.filter((b) => !b.done);
  const completedBlocks = blocks.filter((b) => b.done);
  return /* @__PURE__ */ React.createElement("div", { className: "editor-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "editor-header" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "privacy-btn" + (isPrivate ? " active" : ""),
      "aria-label": isPrivate ? "Hidden from summary. Tap to make visible." : "Visible in summary. Tap to hide.",
      "aria-pressed": isPrivate,
      onClick: () => {
        const next = !isPrivate;
        setIsPrivate(next);
        clearTimeout(toastTimer.current);
        setToast(next ? "Hidden from summary" : "Visible in summary");
        toastTimer.current = setTimeout(() => setToast(null), 2e3);
      }
    },
    isPrivate ? Icon.eyeOff : Icon.eye
  )), toast && /* @__PURE__ */ React.createElement("div", { className: "toast", role: "status", "aria-live": "polite" }, toast), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "text",
      className: "editor-title",
      placeholder: "Title",
      "aria-label": "Note title",
      value: title,
      onChange: (e) => setTitle(e.target.value)
    }
  ), /* @__PURE__ */ React.createElement(
    CategoryPicker,
    {
      categories,
      selected: tags,
      onSelectedChange: setTags,
      onAddCategory,
      onRenameCategory,
      onDeleteCategory
    }
  ), /* @__PURE__ */ React.createElement("div", { className: "editor-body", onClick: (e) => {
    if (e.target === e.currentTarget) addBlock();
  } }, activeBlocks.length === 0 && completedBlocks.length === 0 && /* @__PURE__ */ React.createElement("button", { type: "button", className: "empty-msg", style: { cursor: "text" }, onClick: addBlock }, "Tap to start writing..."), activeBlocks.map((block) => {
    const i = blocks.findIndex((b) => b.id === block.id);
    const isBullet = stripHtml(block.text || "").startsWith("\u2022");
    const textId = "block-text-" + block.id;
    return /* @__PURE__ */ React.createElement("div", { className: "block-row" + (leaving[block.id] ? " leaving" : ""), key: block.id }, block.type === "check" && /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "block-check" + (leaving[block.id] ? " checked" : ""),
        onClick: () => completeBlock(block.id),
        role: "checkbox",
        "aria-checked": "false",
        "aria-labelledby": textId,
        tabIndex: 0,
        onKeyDown: onKeyActivate(() => completeBlock(block.id))
      },
      Icon.check
    ), /* @__PURE__ */ React.createElement(
      "div",
      {
        id: textId,
        ref: (el) => {
          if (el) {
            refs.current[block.id] = el;
            const cur = el.innerHTML === "<br>" ? "" : el.innerHTML;
            if (cur !== (block.text || "")) el.innerHTML = block.text || "";
          } else {
            delete refs.current[block.id];
          }
        },
        className: "block-text" + (isBullet ? " block-bullet" : ""),
        contentEditable: "true",
        suppressContentEditableWarning: true,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": block.type === "check" ? "Checklist item" : "Note text",
        onInput: (e) => setBlockHtml(block.id, e.currentTarget.innerHTML, e.currentTarget),
        onKeyDown: (e) => handleBlockKeyDown(e, block, i),
        onPointerUp: handleBlockPointerUp
      }
    ));
  }), completedBlocks.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "completed-section" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "completed-header", onClick: () => setShowCompleted((v) => !v), "aria-expanded": showCompleted }, showCompleted ? "\u25BE" : "\u25B8", " Completed (", completedBlocks.length, ")"), showCompleted && completedBlocks.map((block) => {
    const doneTextId = "block-text-done-" + block.id;
    return /* @__PURE__ */ React.createElement("div", { className: "block-row", key: block.id }, /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "block-check checked",
        onClick: () => uncompleteBlock(block.id),
        role: "checkbox",
        "aria-checked": "true",
        "aria-labelledby": doneTextId,
        tabIndex: 0,
        onKeyDown: onKeyActivate(() => uncompleteBlock(block.id))
      },
      Icon.check
    ), /* @__PURE__ */ React.createElement("div", { id: doneTextId, className: "block-text block-text-done", dangerouslySetInnerHTML: { __html: sanitizeHtml(block.text || "") } }));
  }))), /* @__PURE__ */ React.createElement("div", { className: "compose-bar", ref: composerRef }, /* @__PURE__ */ React.createElement("button", { className: "send-btn", onClick: onSave, title: "save & view notes", "aria-label": "Save and view notes" }, Icon.send)));
}
ReactDOM.createRoot(document.getElementById("app-root")).render(/* @__PURE__ */ React.createElement(App, null));
