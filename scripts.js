const THEMATIC_TAGS = ["RPiS", "IO", "PiPO", "ASK", "SO", "SK", "BD"];
const TAGS_PRESET = [...THEMATIC_TAGS];
const RULES = { minI: 54, minIInz: 12, minKInz: 10, needP: 1, minOIKP: 170, thematicMin: 28, thematicEachAtLeastOne: true, needPS: 1, minPraktyki: 4, minHS: 5, minOWI: 1, minE: 2, needAngielski: 1 };

document.addEventListener("DOMContentLoaded", () => {

  const STORAGE_KEY = "uwr-plan-autosave";

  const semestersEl = document.getElementById("semesters");
  const tplSem = document.getElementById("tpl-semester");
  const tplCourse = document.getElementById("tpl-course");
  const btnSave = document.getElementById("btn-save");
  const fileInput = document.getElementById("file-input");
  const qs = (s, r = document) => r.querySelector(s);

  // Przedmioty ogólnouczelniane/wymagane (niewidoczne bezpośrednio w JSONie zapisów z pełnymi danymi)
  let dynamicCourses = [
    { nameLower: "praktyka zawodowa", originalName: "Praktyka zawodowa", ects: 4, types: ["PRAKTYKI"], tags: [] },
    { nameLower: "wychowanie fizyczne", originalName: "Wychowanie fizyczne", ects: 0, types: ["O"], tags: [] },
    { nameLower: "lektorat języka angielskiego", originalName: "Lektorat języka angielskiego", ects: 0, types: ["ANGIELSKI"], tags: [] }
  ];

  // Mapowanie ID z filters-data na tagi tematyczne używane w planie
  const effectToTagMap = {
    "2": "PiPO", "3": "ASK", "5": "SO", "6": "SK", "7": "BD", 
    "8": "IO", "9": "IO", "4": "RPiS", "10": "RPiS"
  };

  // 1. Zmiana: Dynamiczne pobieranie listy przedmiotów z głównej strony
  async function fetchCoursesData() {
    try {
      // Pobranie HTML strony /courses/
      const response = await fetch('https://zapisy.ii.uni.wroc.pl/courses/');
      if (!response.ok) return;
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const coursesDataStr = doc.getElementById('courses-data')?.textContent;
      const filtersDataStr = doc.getElementById('filters-data')?.textContent;

      if (coursesDataStr && filtersDataStr) {
        const coursesList = JSON.parse(coursesDataStr);
        const filters = JSON.parse(filtersDataStr);

        const scraped = coursesList.map(c => {
          const typeName = filters.allTypes[c.courseType] || "";
          
          // Mapowanie wewnętrznych typów na typy z planera
          let mappedTypes = [];
          if (typeName.includes("Obowiązkowy")) mappedTypes.push("O");
          if (typeName.includes("Informatyczny 1")) mappedTypes.push("I");
          if (typeName.includes("Informatyczny inż")) mappedTypes.push("I", "IInż");
          if (typeName.includes("K1") || typeName.includes("K2") || typeName.includes("Kurs inżynierski")) mappedTypes.push("Kinż");
          if (typeName.includes("Projekt")) mappedTypes.push("P");
          if (typeName.includes("Seminarium")) mappedTypes.push("PS");
          if (typeName.includes("Humanistyczno")) mappedTypes.push("HS");
          if (c.name.toLowerCase().includes("ochrona własności")) mappedTypes.push("OWI");

          // Wyłuskanie tagów tematycznych na podstawie efektów
          const mappedTags = (c.effects || []).map(e => effectToTagMap[e]).filter(Boolean);

          return {
            nameLower: c.name.toLowerCase(),
            originalName: c.name,
            url: c.url.startsWith('http') ? c.url : `https://zapisy.ii.uni.wroc.pl${c.url}`,
            types: mappedTypes,
            tags: [...new Set(mappedTags)],
            ects: null // Null oznacza, że dociągniemy ECTS na żądanie
          };
        });
        dynamicCourses = [...dynamicCourses, ...scraped];
      }
    } catch (e) {
      console.warn("Błąd dynamicznego pobierania przedmiotów (sprawdź CORS jeśli uruchamiasz spoza domeny):", e);
    }
  }

  // 2. Zmiana: Leniwe pobieranie wartości ECTS z podstrony danego przedmiotu
  async function fetchLazyECTS(courseObj) {
    if (courseObj.ects !== null) return courseObj.ects;
    if (!courseObj.url) return 0;
    try {
      const res = await fetch(courseObj.url);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      
      const thElements = Array.from(doc.querySelectorAll('th'));
      const ectsNode = thElements.find(th => th.textContent.includes('ECTS'));
      
      if (ectsNode && ectsNode.nextElementSibling) {
        courseObj.ects = parseInt(ectsNode.nextElementSibling.textContent.trim(), 10);
        return courseObj.ects;
      }
    } catch (e) {
      console.warn("Nie udało się pobrać ECTS dla przedmiotu:", courseObj.originalName);
    }
    return 0;
  }

  fetchCoursesData(); // Uruchomienie scrapingu w tle przy ładowaniu dokumentu

  function initChoices(el, opts) { return new Choices(el, Object.assign({ removeItemButton: true, placeholder: true, searchPlaceholderValue: "Szukaj", noResultsText: "Brak wyników", shouldSort: false }, opts || {})) }

  function ensureOptions(selectEl, values) {
    (values || []).forEach(v => {
      if (![...selectEl.options].some(o => o.value === v)) {
        const o = document.createElement("option"); o.value = v; o.textContent = v; selectEl.appendChild(o);
      }
    });
  }

  function preselectValues(selectEl, values) {
    const set = new Set(values || []);
    [...selectEl.options].forEach(o => o.selected = set.has(o.value));
  }

  function createCourseRow(init) {
    const node = tplCourse.content.firstElementChild.cloneNode(true);
    const typeSel = qs(".type-select", node);
    const tagsSel = qs(".tags-select", node);

    tagsSel.innerHTML = "";
    TAGS_PRESET.forEach(tag => { const o = document.createElement("option"); o.value = tag; o.textContent = tag; tagsSel.appendChild(o) });

    if (init) {
      ensureOptions(tagsSel, init.tags);
      preselectValues(tagsSel, init.tags);
      preselectValues(typeSel, init.types);
    }

    const chType = initChoices(typeSel, { placeholderValue: "Typ" });
    const chTags = initChoices(tagsSel, { placeholderValue: "Tagi", duplicateItemsAllowed: false, addItems: true });

    const inputSubject = qs(".subject", node);
    const inputEcts = qs(".ects", node);

    if (init) {
      if (init.types && init.types.length) chType.setChoiceByValue(init.types);
      if (init.tags && init.tags.length) chTags.setChoiceByValue(init.tags);
      inputSubject.value = init.subject || "";
      inputEcts.value = init.ects || 0;
    }

    qs(".remove-course", node).addEventListener("click", () => {
      chType.destroy();
      chTags.destroy();
      const sem = node.closest(".semester");
      node.remove();
      if (qs(".courses", sem).children.length === 0) { sem.remove(); renumberSemesters() }
      onDataChanged();
    });

    inputEcts.addEventListener("input", onDataChanged);
    inputSubject.addEventListener("change", onDataChanged);
    typeSel.addEventListener("change", onDataChanged);
    tagsSel.addEventListener("change", onDataChanged);

    let debounceTimer;
    inputSubject.addEventListener("input", e => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const queryRaw = e.target.value.trim();
        if (queryRaw.length < 3) return;

        const normalize = str => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const queryNorm = normalize(queryRaw);

        const matches = dynamicCourses.filter(c => normalize(c.nameLower).includes(queryNorm));
        const exactMatch = matches.find(c => normalize(c.nameLower) === queryNorm);
        const match = exactMatch || (matches.length === 1 ? matches[0] : null);
        
        if (match) {
          // Dynamiczne wstrzyknięcie wartości początkowej, dopóki nie pobierzemy ECTS
          if (!inputEcts.value || inputEcts.value === "0") {
            if (match.ects !== null) {
              inputEcts.value = match.ects;
            } else if (match.url) {
              inputEcts.value = "..."; // Wskaźnik ładowania
              const fetchedEcts = await fetchLazyECTS(match);
              // Weryfikacja, czy po zapytaniu sieciowym pole nadal ma wartość "...", by nie nadpisać danych z palca
              if (inputEcts.value === "...") {
                inputEcts.value = fetchedEcts;
                onDataChanged();
              }
            }
          }

          if (chType.getValue(true).length === 0 && match.types.length) {
            chType.setChoiceByValue(match.types);
          }

          if (chTags.getValue(true).length === 0 && match.tags && match.tags.length) {
            match.tags.forEach(t => {
              if (![...tagsSel.options].some(o => o.value === t)) {
                chTags.setChoices([{ value: t, label: t }], "value", "label", false);
              }
            });
            chTags.setChoiceByValue(match.tags);
          }
          
          inputSubject.value = match.originalName;
          onDataChanged();
        }
      }, 400);
    });

    return node;
  }

  function createSemester(empty = false) {
    const node = tplSem.content.firstElementChild.cloneNode(true);
    if (!empty) {
      qs(".courses", node).appendChild(createCourseRow());
    }

    let btnAddToSem = qs(".btn-add-to-sem", node);
    if (!btnAddToSem) {
      btnAddToSem = document.createElement("button");
      btnAddToSem.textContent = "+ Dodaj przedmiot (do tego semestru)";
      btnAddToSem.className = "btn-add-to-sem secondary";
      btnAddToSem.type = "button";
      btnAddToSem.style.marginTop = "10px";
      node.appendChild(btnAddToSem);
    }

    btnAddToSem.addEventListener("click", () => {
      qs(".courses", node).appendChild(createCourseRow());
      onDataChanged();
    });

    return node;
  }

  function addSemester() {
    const sem = createSemester();
    semestersEl.appendChild(sem);
    renumberSemesters(); onDataChanged();
  }

  function addCourseToCurrent() {
    let last = semestersEl.lastElementChild;
    if (!last) {
      addSemester();
      return;
    }
    qs(".courses", last).appendChild(createCourseRow());
    onDataChanged();
  }

  function renumberSemesters() { Array.from(semestersEl.children).forEach((sem, i) => { qs(".semester-title", sem).textContent = `Semestr ${i + 1}` }) }

  function getAllCourses() {
    const out = [];
    Array.from(semestersEl.children).forEach((sem, sidx) => {
      Array.from(qs(".courses", sem).children).forEach(row => {
        const subject = (qs(".subject", row).value || "").trim();
        const ects = Number(qs(".ects", row).value) || 0;
        const types = Array.from(qs(".type-select", row).selectedOptions).map(o => o.value);
        const tags = Array.from(qs(".tags-select", row).selectedOptions).map(o => o.value);
        out.push({ subject, ects, types, tags, semester: sidx + 1 });
      });
    });
    return out;
  }

  function recalcECTS() {
    let total = 0;
    Array.from(semestersEl.children).forEach(sem => {
      const sum = Array.from(qs(".courses", sem).children).reduce((a, row) => a + (Number(qs(".ects", row).value) || 0), 0);
      if (qs(".ects-sem", sem)) qs(".ects-sem", sem).textContent = sum;
      total += sum;
    });
    const ectsTotalEl = document.getElementById("ects-total");
    if (ectsTotalEl) ectsTotalEl.textContent = total;
  }

  function computeStatus() {
    const courses = getAllCourses();
    const sumWhere = p => courses.reduce((a, c) => a + (p(c) ? c.ects : 0), 0);
    const countWhere = p => courses.reduce((a, c) => a + (p(c) ? 1 : 0), 0);
    const hasType = (c, t) => c.types.includes(t);
    const hasAnyType = (c, arr) => arr.some(t => hasType(c, t));
    const hasAnyTag = (c, arr) => arr.some(t => c.tags.includes(t));

    const sumI = sumWhere(c => hasAnyType(c, ["I", "IInż"]));
    const sumIInz = sumWhere(c => hasType(c, "IInż"));
    const sumKInz = sumWhere(c => hasType(c, "Kinż"));
    const sumOIKP = sumWhere(c => hasAnyType(c, ["O", "I", "IInż", "K", "Kinż", "P"]));

    const sumHS = sumWhere(c => hasType(c, "HS"));
    const sumOWI = sumWhere(c => hasType(c, "OWI"));
    const sumE = sumWhere(c => hasType(c, "E"));
    const sumPr = sumWhere(c => hasType(c, "PRAKTYKI"));
    const sumThematic = sumWhere(c => hasAnyTag(c, THEMATIC_TAGS));

    const cntP = countWhere(c => hasType(c, "P"));
    const cntPS = countWhere(c => hasType(c, "PS"));
    const cntAng = countWhere(c => hasType(c, "ANGIELSKI"));

    const thematicCovered = Object.fromEntries(THEMATIC_TAGS.map(t => [t, countWhere(c => c.tags.includes(t)) > 0]));

    return {
      details: { sumI, sumIInz, sumKInz, sumOIKP, sumHS, sumOWI, sumE, sumPr, sumThematic, cntP, cntPS, cntAng, thematicCovered },
      checks: {
        I: sumI >= RULES.minI,
        IInz: sumIInz >= RULES.minIInz,
        KInz: sumKInz >= RULES.minKInz,
        P: cntP >= RULES.needP,
        OIKP: sumOIKP >= RULES.minOIKP,
        THEMIN: sumThematic >= RULES.thematicMin,
        THEEACH: RULES.thematicEachAtLeastOne ? THEMATIC_TAGS.every(t => thematicCovered[t]) : true,
        PS: cntPS >= RULES.needPS,
        PRAKTYKI: sumPr >= RULES.minPraktyki,
        HS: sumHS >= RULES.minHS,
        OWI: sumOWI >= RULES.minOWI,
        E: sumE >= RULES.minE,
        ANG: cntAng >= RULES.needAngielski
      }
    };
  }

  function renderChecklist() {
    const SEGMENTS = 7;
    const cl = document.getElementById("checklist");
    if (!cl) return;
    cl.innerHTML = "";

    const { details, checks } = computeStatus();
    const courses = getAllCourses();

    const maxSemRaw = courses.reduce((m, c) => Math.max(m, c.semester || 0), 0);
    const maxSem = Math.max(0, Math.min(SEGMENTS, maxSemRaw));
    const frac = maxSem ? (maxSem / SEGMENTS) * 100 : 0;

    const coveredCount = Object.values(details.thematicCovered).filter(Boolean).length;

    const rows = [
      { ok: checks.I, text: `I ≥ ${RULES.minI} ECTS (masz ${details.sumI})`, ratio: details.sumI / RULES.minI },
      { ok: checks.IInz, text: `IInż ≥ ${RULES.minIInz} ECTS (masz ${details.sumIInz})`, ratio: details.sumIInz / RULES.minIInz },
      { ok: checks.KInz, text: `Kinż ≥ ${RULES.minKInz} ECTS (masz ${details.sumKInz})`, ratio: details.sumKInz / RULES.minKInz },
      { ok: checks.P, text: `Projekt P: ≥ ${RULES.needP} (masz ${details.cntP})`, ratio: details.cntP / RULES.needP },
      { ok: checks.OIKP, text: `O+I+K+P ≥ ${RULES.minOIKP} ECTS (masz ${details.sumOIKP})`, ratio: details.sumOIKP / RULES.minOIKP },
      { ok: checks.THEMIN, text: `Tematyczne ≥ ${RULES.thematicMin} ECTS (masz ${details.sumThematic})`, ratio: details.sumThematic / RULES.thematicMin },
      { ok: checks.THEEACH, text: `Znaczniki: ${THEMATIC_TAGS.map(t => `${t}:${details.thematicCovered[t] ? "✓" : "–"}`).join(" ")}`, ratio: coveredCount / SEGMENTS },
      { ok: checks.PS, text: `Proseminarium (PS): ≥ ${RULES.needPS}`, ratio: details.cntPS / RULES.needPS },
      { ok: checks.PRAKTYKI, text: `Praktyki ≥ ${RULES.minPraktyki} ECTS (masz ${details.sumPr})`, ratio: details.sumPr / RULES.minPraktyki },
      { ok: checks.HS, text: `HS ≥ ${RULES.minHS} ECTS (masz ${details.sumHS})`, ratio: details.sumHS / RULES.minHS },
      { ok: checks.OWI, text: `OWI ≥ ${RULES.minOWI} ECTS (masz ${details.sumOWI})`, ratio: details.sumOWI / RULES.minOWI },
      { ok: checks.E, text: `E ≥ ${RULES.minE} ECTS (masz ${details.sumE})`, ratio: details.sumE / RULES.minE },
      { ok: checks.ANG, text: `ANGIELSKI: zdany`, ratio: details.cntAng / RULES.needAngielski }
    ];

    rows.forEach(r => {
      const d = document.createElement("div");
      d.className = `check ${r.ok ? "ok" : "bad"}`;
      const fill = Math.max(0, Math.min(1, r.ratio || 0)) * 100;
      d.style.setProperty("--fill", `${fill}%`);
      d.style.setProperty("--semFrac", `${frac}%`);
      d.innerHTML = `<span class="dot"></span><span class="text">${r.text}</span>`;
      cl.appendChild(d);
    });
  }

  function serialize() {
    const semesters = [];
    Array.from(semestersEl.children).forEach(sem => {
      const courses = Array.from(qs(".courses", sem).children).map(row => {
        const subject = qs(".subject", row).value || "";
        const ects = Number(qs(".ects", row).value) || 0;
        const types = Array.from(qs(".type-select", row).selectedOptions).map(o => o.value);
        const tags = Array.from(qs(".tags-select", row).selectedOptions).map(o => o.value);
        return { subject, ects, types, tags };
      });
      if (courses.length) semesters.push({ courses });
    });
    const status = computeStatus();
    return { semesters, status };
  }

  function deserialize(obj) {
    semestersEl.innerHTML = "";
    if (!obj || !obj.semesters || !obj.semesters.length) { addSemester(); return }

    obj.semesters.forEach(semData => {
      const sem = createSemester(true);
      const box = qs(".courses", sem);

      (semData.courses || []).forEach(c => {
        const safeTypes = Array.isArray(c.types) ? c.types : [];
        const safeTags = Array.isArray(c.tags) ? c.tags : [];
        const row = createCourseRow({ subject: c.subject || "", ects: c.ects || 0, types: safeTypes, tags: safeTags });
        box.appendChild(row);
      });
      semestersEl.appendChild(sem);
    });
    renumberSemesters(); onDataChanged(false); // wywoływane by zaktualizować interfejs
  }

  function autosave() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize())); } 
    catch (e) { console.warn("Autosave failed", e); }
  }

  function loadAutosave() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) { deserialize(JSON.parse(data)); return true; }
    } catch (e) { console.warn("Load autosave failed", e); }
    return false;
  }

  function downloadJSON(name, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function isAllInputsEmpty() {
    const courses = getAllCourses();
    if (courses.length === 0) return true;
    return courses.every(c => !c.subject && (!c.ects || c.ects === 0) && c.types.length === 0 && c.tags.length === 0);
  }

  function updateSaveMode() {
    if (isAllInputsEmpty()) {
      btnSave.textContent = "Importuj";
      btnSave.classList.add("secondary");
      btnSave.classList.remove("primary");
    } else {
      btnSave.textContent = "Eksportuj";
      btnSave.classList.add("primary");
      btnSave.classList.remove("secondary");
    }
  }

  function onDataChanged(save = true) {
    recalcECTS();
    renderChecklist();
    updateSaveMode();
    if(save) autosave();
  }

  if (!loadAutosave()) {
    addSemester();
    onDataChanged();
  }

  document.getElementById("btn-add-course").addEventListener("click", addCourseToCurrent);
  document.getElementById("btn-add-semester").addEventListener("click", addSemester);

  btnSave.addEventListener("click", () => {
    if (isAllInputsEmpty()) { fileInput.click() } else { downloadJSON("uwr-plan.json", serialize()) }
  });

  fileInput.addEventListener("change", e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { deserialize(JSON.parse(r.result)); autosave(); } 
      catch { alert("Nieprawidłowy plik JSON"); } 
      finally { fileInput.value = ""; }
    };
    r.readAsText(f);
  });
});
