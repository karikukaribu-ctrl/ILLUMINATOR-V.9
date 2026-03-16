const App = {
  currentView: Config.app.defaultView,
  selectedDate: todayISO(),
  focusProjectId: null,
  googleReady: false,
  mapDrag: null,
  stickyDrag: null
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function fromISO(iso) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function toISO(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function addDays(iso, n) {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

function startOfWeekISO(iso) {
  const d = fromISO(iso)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toISO(d)
}

function qs(sel) { return document.querySelector(sel) }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)) }

function el(tag, cls = "", html = "") {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (html) node.innerHTML = html
  return node
}

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

document.addEventListener("DOMContentLoaded", initApp)

function initApp() {
  Engine.load()
  Scheduler.requestRender = renderCurrentView

  bootstrapDemo()
  bindPanels()
  bindViews()
  bindActions()
  bindPrefs()
  bindGoogleButtons()
  bindGlobalNotes()
  syncPrefsUI()
  renderAll()
}

function bootstrapDemo() {
  if (Engine.state.projects.length) return

  const projects = [
    Engine.createProject({
      name: "Article addiction écrans",
      deadline: addDays(App.selectedDate, 24),
      fragments: 8,
      fragmentDuration: 30,
      priority: 4,
      weeklyTarget: 3,
      energyRequired: 2,
      color: "#7c4a2d"
    }),
    Engine.createProject({
      name: "Carnet de stage",
      deadline: addDays(App.selectedDate, 18),
      fragments: 10,
      fragmentDuration: 25,
      priority: 5,
      weeklyTarget: 4,
      energyRequired: 2,
      color: "#9a6343"
    }),
    Engine.createProject({
      name: "Batterie",
      deadline: addDays(App.selectedDate, 60),
      fragments: 12,
      fragmentDuration: 20,
      priority: 2,
      weeklyTarget: 3,
      energyRequired: 1,
      color: "#a67c2d"
    }),
    Engine.createProject({
      name: "Application",
      deadline: addDays(App.selectedDate, 40),
      fragments: 10,
      fragmentDuration: 35,
      priority: 4,
      weeklyTarget: 4,
      energyRequired: 3,
      color: "#5a6e8a"
    })
  ]

  const map = [
    { x: 470, y: 170 },
    { x: 760, y: 150 },
    { x: 720, y: 310 },
    { x: 280, y: 300 }
  ]

  projects.forEach((p, i) => {
    p.x = map[i]?.x || 100 + i * 120
    p.y = map[i]?.y || 100 + i * 80
  })

  Engine.createStickyNote("Déposer ici les pensées parasites")
  Scheduler.generateWeekPlan(new Date())
  Engine.save()
}

function bindPanels() {
  qs("#leftPanelToggle").addEventListener("click", () => openPanel("left"))
  qs("#rightPanelToggle").addEventListener("click", () => openPanel("right"))
  qs("#leftPanelClose").addEventListener("click", closePanels)
  qs("#rightPanelClose").addEventListener("click", closePanels)
  qs("#panelBackdrop").addEventListener("click", closePanels)

  qsa("[data-lefttab]").forEach(btn => {
    btn.addEventListener("click", () => switchSideTab("left", btn.dataset.lefttab))
  })

  qsa("[data-righttab]").forEach(btn => {
    btn.addEventListener("click", () => switchSideTab("right", btn.dataset.righttab))
  })
}

function bindViews() {
  qsa(".mode-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      App.currentView = btn.dataset.view
      qsa(".mode-pill").forEach(b => b.classList.remove("is-active"))
      btn.classList.add("is-active")
      renderCurrentView()
    })
  })
}

function bindActions() {
  qs("#newProjectBtn").addEventListener("click", openProjectCreateModal)
  qs("#expandAllBtn").addEventListener("click", () => {
    Engine.state.projects.forEach(p => p.expanded = true)
    Engine.save()
    renderAll()
  })
  qs("#collapseAllBtn").addEventListener("click", () => {
    Engine.state.projects.forEach(p => p.expanded = false)
    Engine.save()
    renderAll()
  })

  qs("#importInboxBtn").addEventListener("click", importInbox)
  qs("#clearInboxBtn").addEventListener("click", () => { qs("#inboxText").value = "" })

  qs("#autoSuggestBtn").addEventListener("click", openSuggestionModal)
  qs("#randomSuggestBtn").addEventListener("click", () => {
    const frag = Engine.randomFragment()
    if (frag) openFragmentQuickModal(frag.projectId, frag.id, true, true)
  })

  qs("#openNotesBtn").addEventListener("click", openNotesModal)
  qs("#openKiffanceBtn").addEventListener("click", openKiffanceModal)
  qs("#openStatsBtn").addEventListener("click", openStatsModal)
  qs("#openDetailsBtn").addEventListener("click", openProjectChooserModal)
  qs("#openListBtn").addEventListener("click", () => openPanel("left"))
  qs("#openSchedulerBtn").addEventListener("click", openSchedulerModal)

  qs("#generateWeekPlanBtn").addEventListener("click", () => {
    Scheduler.generateWeekPlan(new Date(fromISO(App.selectedDate)))
    renderAll()
  })

  qs("#newManualBlockBtn").addEventListener("click", openManualBlockModal)
  qs("#newStickyBtn").addEventListener("click", () => {
    Engine.createStickyNote()
    renderMapView()
  })
}

function bindPrefs() {
  qs("#savePrefsBtn").addEventListener("click", () => {
    Engine.state.preferences.season = qs("#seasonSelect").value
    Engine.state.preferences.mode = qs("#themeModeSelect").value
    Engine.state.preferences.focus = qs("#focusModeSelect").value === "on"
    Engine.state.preferences.weekType = qs("#weekTypeSelect").value
    Engine.state.preferences.energyPeak = Number(qs("#energyPeakInput").value)
    Engine.state.preferences.focusDuration = Number(qs("#focusDurationInput").value)

    if (!Engine.state.preferences.focus) {
      App.focusProjectId = null
    } else if (!App.focusProjectId && Engine.state.projects[0]) {
      App.focusProjectId = Engine.state.projects[0].id
    }

    applyPrefsToBody()
    Engine.save()
    renderAll()
  })
}

function bindGoogleButtons() {
  qs("#connectGoogleBtn").addEventListener("click", async () => {
    const ok = await GoogleCalendarBridge.init()
    App.googleReady = ok
    qs("#googleStatus").textContent = ok ? "Google Calendar prêt." : "Configuration Google incomplète."
  })

  qs("#importGoogleWeekBtn").addEventListener("click", async () => {
    if (!App.googleReady) {
      qs("#googleStatus").textContent = "Connecte d'abord Google Calendar."
      return
    }

    const start = startOfWeekISO(App.selectedDate)
    const end = addDays(start, 7)
    const events = await GoogleCalendarBridge.listWeekEvents(start, end)

    if (!events.length) {
      qs("#googleStatus").textContent = "Aucun événement importé."
      return
    }

    events.forEach(event => {
      if (!event.start || !event.end || !String(event.start).includes("T")) return
      const startDate = new Date(event.start)
      const endDate = new Date(event.end)
      const duration = Math.max(15, Math.round((endDate - startDate) / (1000 * 60)))

      Scheduler.createManualBlock({
        date: toISO(startDate),
        startHour: startDate.getHours(),
        startMinute: startDate.getMinutes(),
        duration,
        title: `[Agenda] ${event.title}`
      })
    })

    qs("#googleStatus").textContent = `${events.length} événement(s) importé(s).`
    renderAll()
  })
}

function bindGlobalNotes() {
  qs("#globalNotesArea").addEventListener("input", e => {
    Engine.state.globalNotes = e.target.value
    Engine.save()
  })

  qs("#saveGlobalNotesBtn").addEventListener("click", () => {
    Engine.save()
  })
}

function openPanel(side) {
  qs("#panelBackdrop").classList.remove("hidden")
  if (side === "left") qs("#leftPanel").classList.remove("hidden")
  if (side === "right") qs("#rightPanel").classList.remove("hidden")
}

function closePanels() {
  qs("#panelBackdrop").classList.add("hidden")
  qs("#leftPanel").classList.add("hidden")
  qs("#rightPanel").classList.add("hidden")
}

function switchSideTab(side, tab) {
  qsa(`[data-${side}tab]`).forEach(btn => {
    btn.classList.toggle("is-active", btn.dataset[`${side}tab`] === tab)
  })

  qsa(side === "left" ? "#leftPanel .side-page" : "#rightPanel .side-page").forEach(page => {
    page.classList.remove("is-show")
  })

  qs(`#${side}-${tab}`).classList.add("is-show")
}

function syncPrefsUI() {
  qs("#seasonSelect").value = Engine.state.preferences.season
  qs("#themeModeSelect").value = Engine.state.preferences.mode
  qs("#focusModeSelect").value = Engine.state.preferences.focus ? "on" : "off"
  qs("#weekTypeSelect").value = Engine.state.preferences.weekType
  qs("#energyPeakInput").value = Engine.state.preferences.energyPeak
  qs("#focusDurationInput").value = Engine.state.preferences.focusDuration
  qs("#globalNotesArea").value = Engine.state.globalNotes || ""
  applyPrefsToBody()
}

function applyPrefsToBody() {
  document.body.classList.remove("theme-printemps", "theme-ete", "theme-automne", "theme-hiver")
  document.body.classList.add(`theme-${Engine.state.preferences.season}`)
  document.body.classList.toggle("mode-dark", Engine.state.preferences.mode === "dark")
}

function visibleProjects() {
  if (!App.focusProjectId) return Engine.state.projects
  return Engine.state.projects.filter(p => p.id === App.focusProjectId)
}

function renderAll() {
  renderStatus()
  renderProjectList()
  renderTaskList()
  renderHeatmap()
  renderStats()
  renderCurrentView()
}

function renderStatus() {
  qs("#selectedDateLabel").textContent = fromISO(App.selectedDate).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  })

  const start = startOfWeekISO(App.selectedDate)
  const end = addDays(start, 6)
  qs("#weekLabel").textContent = `${fromISO(start).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} → ${fromISO(end).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}`
  qs("#focusLabel").textContent = `Focus : ${Engine.state.preferences.focus ? "on" : "off"}`
}

function renderProjectList() {
  const root = qs("#leftProjectList")
  root.innerHTML = ""

  visibleProjects().forEach(project => {
    const node = el("div", "project-list-item")
    node.innerHTML = `
      <strong>${escapeHTML(project.name)}</strong>
      <div class="small-muted">${project.progress}% · ${project.fragments.filter(f => f.done).length}/${project.fragments.length}</div>
    `
    node.addEventListener("click", () => openProjectDetailModal(project.id))
    root.appendChild(node)
  })
}

function renderTaskList() {
  const root = qs("#leftTaskList")
  root.innerHTML = ""

  const fragments = Engine.getAllFragments().filter(f => {
    if (f.done) return false
    if (!App.focusProjectId) return true
    return f.projectId === App.focusProjectId
  }).slice(0, 14)

  fragments.forEach(fragment => {
    const item = el("div", "active-task-item")
    item.innerHTML = `
      <div><strong>${escapeHTML(fragment.title)}</strong></div>
      <div class="small-muted">${escapeHTML(fragment.projectName)} · ${fragment.duration} min</div>
    `
    item.addEventListener("click", () => openFragmentQuickModal(fragment.projectId, fragment.id, true))
    root.appendChild(item)
  })
}

function renderCurrentView() {
  qsa(".view").forEach(v => v.classList.remove("is-show"))
  qs(`#view-${App.currentView}`).classList.add("is-show")

  if (App.currentView === "map") renderMapView()
  if (App.currentView === "day") renderDayView()
  if (App.currentView === "week") renderWeekView()
  if (App.currentView === "month") renderMonthView()
  if (App.currentView === "timeline") renderTimelineView()
  if (App.currentView === "projects") renderProjectsView()
}

function renderMapView() {
  const root = qs("#mapBoard")
  root.innerHTML = `<div id="realmMap" class="realm-map"></div>`
  const map = qs("#realmMap")
  const projects = visibleProjects()

  // liens
  projects.forEach((project, index) => {
    const next = projects[index + 1]
    if (!next) return

    const dx = (next.x || 0) - (project.x || 0)
    const dy = (next.y || 0) - (project.y || 0)
    const len = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx) * 180 / Math.PI

    const link = el("div", "realm-link")
    link.style.left = `${project.x}px`
    link.style.top = `${project.y}px`
    link.style.width = `${len}px`
    link.style.transform = `rotate(${angle}deg)`
    map.appendChild(link)
  })

  projects.forEach(project => {
    const node = el("div", "realm-node")
    node.style.left = `${project.x - 64}px`
    node.style.top = `${project.y - 22}px`
    node.style.background = project.color
    node.innerHTML = `${escapeHTML(project.name)}<br>${project.progress}%`
    node.addEventListener("click", () => {
      project.expanded = !project.expanded
      Engine.save()
      renderMapView()
    })
    node.addEventListener("dblclick", () => openProjectDetailModal(project.id))
    attachProjectNodeDrag(node, project)
    map.appendChild(node)

    if (project.expanded) {
      const doneCount = project.fragments.filter(f => f.done).length
      project.fragments.forEach((fragment, idx) => {
        const angle = (Math.PI * 2 / Math.max(project.fragments.length, 1)) * idx
        const fx = project.x + Math.cos(angle) * Config.ui.map.fragmentRadius
        const fy = project.y + Math.sin(angle) * Config.ui.map.fragmentRadius

        const fragNode = el("div", `fragment-node ${fragment.done ? "is-done" : "is-pending"}`)
        fragNode.style.left = `${fx - 50}px`
        fragNode.style.top = `${fy - 16}px`
        fragNode.style.background = project.color
        fragNode.innerHTML = escapeHTML(fragment.title.length > 18 ? fragment.title.slice(0, 18) + "…" : fragment.title)
        fragNode.addEventListener("click", () => {
          Engine.toggleFragmentDone(project.id, fragment.id)
          renderAll()
        })
        fragNode.addEventListener("dblclick", () => openFragmentDetailModal(project.id, fragment.id))
        map.appendChild(fragNode)
      })
    }
  })

  Engine.state.stickyNotes.forEach(note => {
    const sticky = el("div", "sticky-note", escapeHTML(note.text))
    sticky.style.left = `${note.x}px`
    sticky.style.top = `${note.y}px`
    sticky.addEventListener("dblclick", () => openStickyEditModal(note.id))
    attachStickyDrag(sticky, note)
    map.appendChild(sticky)
  })
}

function attachProjectNodeDrag(node, project) {
  node.addEventListener("pointerdown", e => {
    App.mapDrag = {
      type: "project",
      id: project.id,
      dx: e.clientX - project.x,
      dy: e.clientY - project.y
    }
    node.setPointerCapture(e.pointerId)
  })

  node.addEventListener("pointermove", e => {
    if (!App.mapDrag || App.mapDrag.type !== "project" || App.mapDrag.id !== project.id) return
    project.x = e.clientX - App.mapDrag.dx
    project.y = e.clientY - App.mapDrag.dy
    Engine.save()
    renderMapView()
  })

  node.addEventListener("pointerup", () => {
    App.mapDrag = null
  })
}

function attachStickyDrag(node, note) {
  node.addEventListener("pointerdown", e => {
    App.stickyDrag = {
      id: note.id,
      dx: e.clientX - note.x,
      dy: e.clientY - note.y
    }
    node.setPointerCapture(e.pointerId)
  })

  node.addEventListener("pointermove", e => {
    if (!App.stickyDrag || App.stickyDrag.id !== note.id) return
    note.x = e.clientX - App.stickyDrag.dx
    note.y = e.clientY - App.stickyDrag.dy
    Engine.save()
    renderMapView()
  })

  node.addEventListener("pointerup", () => {
    App.stickyDrag = null
  })
}

function renderDayView() {
  const root = qs("#dayBoard")
  root.innerHTML = ""

  const buckets = [
    { label: "08h — 09h", from: 8 * 60, to: 9 * 60 },
    { label: "Travail journée", from: 9 * 60, to: 18 * 60 },
    { label: "20h — 21h30", from: 20 * 60, to: 21 * 60 + 30 },
    { label: "21h30 — 23h", from: 21 * 60 + 30, to: 23 * 60 }
  ]

  const blocks = Scheduler.getBlocksForDate(App.selectedDate)

  buckets.forEach(bucket => {
    const cell = el("div", "day-cell")
    const stack = el("div", "day-cell__stack")
    const relevant = blocks.filter(block => {
      const start = Scheduler.toMinutes(block.startHour, block.startMinute)
      return start >= bucket.from && start < bucket.to
    })

    relevant.forEach(block => {
      const frag = resolveBlockVisual(block)
      const tag = el("div", "day-fragment", `${frag.time} · ${escapeHTML(frag.title)}`)
      tag.style.background = frag.color
      tag.addEventListener("click", () => openBlockEditModal(block.id))
      stack.appendChild(tag)
    })

    if (!relevant.length) stack.innerHTML = `<div class="small-muted">Libre</div>`

    cell.innerHTML = `
      <div class="day-cell__head">
        <span>${bucket.label}</span>
        <span>${relevant.length}</span>
      </div>
    `
    cell.appendChild(stack)
    root.appendChild(cell)
  })

  qs("#daySummaryCompact").textContent = `${blocks.length} bloc(s) aujourd’hui`
}

function renderWeekView() {
  const root = qs("#weekBoard")
  root.innerHTML = ""

  const start = startOfWeekISO(App.selectedDate)

  for (let i = 0; i < 7; i++) {
    const iso = addDays(start, i)
    const blocks = Scheduler.getBlocksForDate(iso)
    const day = el("div", "week-day-card")
    const stack = el("div", "week-day-card__stack")

    day.innerHTML = `<strong>${fromISO(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit" })}</strong>`

    if (!blocks.length) {
      stack.innerHTML = `<div class="small-muted">Libre</div>`
    } else {
      blocks.forEach(block => {
        const frag = resolveBlockVisual(block)
        const chip = el("div", "week-chip", `${frag.time} · ${escapeHTML(frag.title)}`)
        chip.style.background = frag.color
        chip.addEventListener("click", () => openBlockEditModal(block.id))
        stack.appendChild(chip)
      })
    }

    day.appendChild(stack)
    root.appendChild(day)
  }
}

function renderMonthView() {
  const root = qs("#monthBoard")
  root.innerHTML = ""

  const date = fromISO(App.selectedDate)
  const year = date.getFullYear()
  const month = date.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()

  for (let d = 1; d <= lastDay; d++) {
    const iso = toISO(new Date(year, month, d))
    const blocks = Scheduler.getBlocksForDate(iso)

    const cell = el("div", "month-cell")
    cell.innerHTML = `
      <div><strong>${d}</strong></div>
      <div class="month-cell__meta">${blocks.length} bloc(s)</div>
    `
    cell.addEventListener("click", () => {
      App.selectedDate = iso
      switchView("day")
    })
    root.appendChild(cell)
  }
}

function renderProjectsView() {
  const root = qs("#projectsBoard")
  root.innerHTML = ""

  visibleProjects().forEach(project => {
    const card = el("div", "project-card")
    card.innerHTML = `
      <div class="project-card__head">
        <strong>${escapeHTML(project.name)}</strong>
        <span>${project.progress}%</span>
      </div>
      <div class="progress-vertical">
        <div class="progress-fill" style="height:${project.progress}%"></div>
      </div>
      <div class="small-muted">Fragments : ${project.fragments.length}</div>
      <div class="small-muted">Terminés : ${project.fragments.filter(f => f.done).length}</div>
    `
    card.addEventListener("click", () => openProjectDetailModal(project.id))
    root.appendChild(card)
  })
}

function renderTimelineView() {
  const root = qs("#timelineContainer")
  root.innerHTML = `<div id="timelineGrid" class="timeline-grid"></div>`
  const grid = qs("#timelineGrid")
  const { rows, blocks } = Scheduler.getTimelineRows(App.selectedDate)

  rows.forEach(row => {
    const line = el("div", "timeline-row")
    line.innerHTML = `<div class="timeline-row__label">${row.label}</div>`
    grid.appendChild(line)
  })

  grid.style.minHeight = `${rows.length * Config.ui.timeline.pxPer15Min + 24}px`

  blocks.forEach(block => {
    const frag = resolveBlockVisual(block)
    const startMin = Scheduler.toMinutes(block.startHour, block.startMinute)
    const offset = startMin - Scheduler.toMinutes(Config.ui.timeline.startHour, 0)

    const blockEl = el("div", "timeline-block")
    blockEl.style.top = `${(offset / 15) * Config.ui.timeline.pxPer15Min}px`
    blockEl.style.height = `${(block.duration / 15) * Config.ui.timeline.pxPer15Min - 4}px`
    blockEl.style.background = frag.color
    blockEl.innerHTML = `
      <div class="timeline-block__body">
        <strong>${escapeHTML(frag.title)}</strong><br>
        <small>${escapeHTML(frag.projectName)}</small>
      </div>
      <div class="timeline-block__resize">⋮</div>
    `
    Scheduler.attachBlockInteractions(blockEl, block)
    blockEl.addEventListener("dblclick", () => openBlockEditModal(block.id))
    grid.appendChild(blockEl)
  })
}

function resolveBlockVisual(block) {
  if (!block.projectId || !block.fragmentId) {
    return {
      title: block.titleOverride || "Bloc libre",
      projectName: "Libre",
      color: block.colorOverride || "#6a6a6a",
      time: `${String(block.startHour).padStart(2, "0")}:${String(block.startMinute).padStart(2, "0")}`
    }
  }

  const project = Engine.getProject(block.projectId)
  const fragment = Engine.getFragment(block.projectId, block.fragmentId)

  return {
    title: fragment?.title || "Fragment",
    projectName: project?.name || "Projet",
    color: project?.color || Config.projectDefaults.color,
    time: `${String(block.startHour).padStart(2, "0")}:${String(block.startMinute).padStart(2, "0")}`
  }
}

function renderHeatmap() {
  const root = qs("#energyHeatmap")
  root.innerHTML = ""

  for (let hour = 6; hour <= 23; hour++) {
    const energy = Engine.estimateEnergy(hour)
    const cell = el("div", "heat-cell")
    cell.style.background = `rgba(124,74,45,${Math.max(0.12, energy / 10)})`
    cell.title = `${hour}h · énergie ${energy}`
    root.appendChild(cell)
  }
}

function renderStats() {
  const stats = Engine.getStats()
  const root = qs("#statsPanel")
  root.innerHTML = `
    <div class="stat-card">Estimé : ${stats.estimated} min</div>
    <div class="stat-card">Réel : ${stats.real} min</div>
    <div class="stat-card">Écart : ${stats.delta} min</div>
    <div class="stat-card">Projets : ${stats.projects}</div>
    <div class="stat-card">Fragments : ${stats.fragments}</div>
    <div class="stat-card">Terminés : ${stats.doneFragments}</div>
  `
}

function switchView(view) {
  App.currentView = view
  qsa(".mode-pill").forEach(b => b.classList.toggle("is-active", b.dataset.view === view))
  renderCurrentView()
}

function openModal(html, bindFn) {
  const layer = qs("#modalLayer")
  layer.innerHTML = `
    <div class="modal-overlay" id="modalOverlay"></div>
    <div class="modal">
      <button class="modal-close" id="modalClose">×</button>
      ${html}
    </div>
  `
  qs("#modalOverlay").addEventListener("click", closeModal)
  qs("#modalClose").addEventListener("click", closeModal)
  if (bindFn) bindFn()
}

function closeModal() {
  qs("#modalLayer").innerHTML = ""
}

function openProjectCreateModal() {
  openModal(`
    <h2>Nouveau projet</h2>
    <label>Nom<br><input id="projName"></label><br><br>
    <label>Deadline<br><input id="projDeadline" type="date" value="${addDays(App.selectedDate, 30)}"></label><br><br>
    <label>Fragments<br><input id="projFragments" type="number" value="8"></label><br><br>
    <label>Durée fragment<br><input id="projDuration" type="number" value="30"></label><br><br>
    <label>Priorité<br><input id="projPriority" type="number" value="3" min="1" max="5"></label><br><br>
    <label>Fréquence / semaine<br><input id="projWeekly" type="number" value="3" min="1" max="7"></label><br><br>
    <label>Énergie requise<br><input id="projEnergy" type="number" value="2" min="1" max="5"></label><br><br>
    <label>Couleur<br><input id="projColor" type="color" value="${Config.projectDefaults.color}"></label><br><br>
    <button id="saveProjBtn" class="action-btn action-btn--accent">Créer</button>
  `, () => {
    qs("#saveProjBtn").addEventListener("click", () => {
      const project = Engine.createProject({
        name: qs("#projName").value.trim() || "Projet",
        deadline: qs("#projDeadline").value,
        fragments: Number(qs("#projFragments").value || 8),
        fragmentDuration: Number(qs("#projDuration").value || 30),
        priority: Number(qs("#projPriority").value || 3),
        weeklyTarget: Number(qs("#projWeekly").value || 3),
        energyRequired: Number(qs("#projEnergy").value || 2),
        color: qs("#projColor").value || Config.projectDefaults.color
      })

      project.x = 500
      project.y = 180
      Engine.save()
      closeModal()
      renderAll()
    })
  })
}

function openProjectDetailModal(projectId) {
  const project = Engine.getProject(projectId)
  if (!project) return

  openModal(`
    <h2>${escapeHTML(project.name)}</h2>
    <p>Progression : ${project.progress}%</p>
    <p>Deadline : ${project.deadline}</p>
    <p>Fragments : ${project.fragments.length}</p>
    <p>Fréquence : ${project.weeklyTarget} / semaine</p>
    <hr>
    <div id="projectTasksModal">
      ${project.fragments.map(f => `
        <div class="project-task-row" data-fragment-id="${f.id}">
          ${escapeHTML(f.title)} · ${f.duration} min · ${f.done ? "fait" : "à faire"}
        </div>
      `).join("")}
    </div>
    <hr>
    <button id="toggleExpandProjectBtn" class="action-btn">Déplier / replier</button>
    <button id="focusProjectBtn" class="action-btn">Focus</button>
    <button id="planProjectWeekBtn" class="action-btn action-btn--accent">Planifier</button>
  `, () => {
    qsa("#projectTasksModal .project-task-row").forEach(row => {
      row.addEventListener("click", () => openFragmentDetailModal(project.id, row.dataset.fragmentId))
    })

    qs("#toggleExpandProjectBtn").addEventListener("click", () => {
      project.expanded = !project.expanded
      Engine.save()
      closeModal()
      renderMapView()
    })

    qs("#focusProjectBtn").addEventListener("click", () => {
      App.focusProjectId = project.id
      Engine.state.preferences.focus = true
      qs("#focusModeSelect").value = "on"
      closeModal()
      renderAll()
    })

    qs("#planProjectWeekBtn").addEventListener("click", () => {
      project.fragments.filter(f => !f.done && !f.scheduled).forEach(fragment => {
        const monday = startOfWeekISO(App.selectedDate)
        for (let i = 0; i < 7; i++) {
          const day = addDays(monday, i)
          const block = Scheduler.scheduleFragment(project.id, fragment.id, fromISO(day))
          if (block) break
        }
      })
      closeModal()
      renderAll()
    })
  })
}

function openFragmentDetailModal(projectId, fragmentId) {
  const project = Engine.getProject(projectId)
  const fragment = Engine.getFragment(projectId, fragmentId)
  if (!fragment) return

  openModal(`
    <h2>${escapeHTML(fragment.title)}</h2>
    <p>${escapeHTML(project?.name || "Projet")}</p>
    <label>Durée<br><input id="fragDurationInput" type="number" value="${fragment.duration}"></label><br><br>
    <label>Notes<br><textarea id="fragNotesInput" rows="8">${escapeHTML(fragment.notes || "")}</textarea></label><br><br>
    <button id="toggleDoneFragBtn" class="action-btn action-btn--accent">${fragment.done ? "Annuler validation" : "Valider avancement"}</button>
    <button id="saveFragBtn" class="action-btn">Sauver</button>
    <button id="scheduleFragBtn" class="action-btn">Planifier</button>
  `, () => {
    qs("#toggleDoneFragBtn").addEventListener("click", () => {
      Engine.toggleFragmentDone(projectId, fragmentId)
      closeModal()
      renderAll()
    })

    qs("#saveFragBtn").addEventListener("click", () => {
      Engine.updateFragment(projectId, fragmentId, {
        duration: Number(qs("#fragDurationInput").value || fragment.duration),
        notes: qs("#fragNotesInput").value
      })
      closeModal()
      renderAll()
    })

    qs("#scheduleFragBtn").addEventListener("click", () => {
      closeModal()
      openFragmentQuickModal(projectId, fragmentId, true)
    })
  })
}

function openFragmentQuickModal(projectId, fragmentId, withSchedule = false, fromSuggestion = false) {
  const project = Engine.getProject(projectId)
  const fragment = Engine.getFragment(projectId, fragmentId)
  if (!fragment) return

  openModal(`
    <h2>${escapeHTML(fragment.title)}</h2>
    <p>${escapeHTML(project?.name || "Projet")}</p>
    <p>Durée : ${fragment.duration} min</p>
    <p>Énergie : ${fragment.energy}</p>
    ${fromSuggestion ? `<p class="small-muted">Proposé selon énergie / durée / échéance.</p>` : ""}
    ${withSchedule ? `
      <hr>
      <label>Date<br><input id="fragDateInput" type="date" value="${App.selectedDate}"></label><br><br>
      <label>Heure<br><input id="fragTimeInput" type="time" value="20:00"></label><br><br>
      <button id="scheduleFragBtn" class="action-btn action-btn--accent">Planifier</button>
      <button id="completeFragBtn" class="action-btn">Valider</button>
    ` : `
      <button id="completeFragBtn" class="action-btn action-btn--accent">Valider</button>
    `}
  `, () => {
    qs("#completeFragBtn")?.addEventListener("click", () => {
      Engine.toggleFragmentDone(projectId, fragmentId)
      closeModal()
      renderAll()
    })

    qs("#scheduleFragBtn")?.addEventListener("click", () => {
      const [h, m] = qs("#fragTimeInput").value.split(":").map(Number)
      Scheduler.createBlock({
        projectId,
        fragmentId,
        date: qs("#fragDateInput").value,
        startHour: h,
        startMinute: m,
        duration: fragment.duration
      })
      closeModal()
      renderAll()
    })
  })
}

function openBlockEditModal(blockId) {
  const block = Scheduler.getBlockById(blockId)
  if (!block) return

  openModal(`
    <h2>Bloc</h2>
    <label>Date<br><input id="blockDateInput" type="date" value="${block.date}"></label><br><br>
    <label>Heure<br><input id="blockTimeInput" type="time" value="${String(block.startHour).padStart(2, "0")}:${String(block.startMinute).padStart(2, "0")}"></label><br><br>
    <label>Durée<br><input id="blockDurationInput" type="number" value="${block.duration}"></label><br><br>
    <button id="saveBlockBtn" class="action-btn action-btn--accent">Sauver</button>
    <button id="deleteBlockBtn" class="action-btn action-btn--danger">Supprimer</button>
  `, () => {
    qs("#saveBlockBtn").addEventListener("click", () => {
      const [h, m] = qs("#blockTimeInput").value.split(":").map(Number)
      Scheduler.updateBlock(block.id, {
        date: qs("#blockDateInput").value,
        startHour: h,
        startMinute: m,
        duration: Number(qs("#blockDurationInput").value || block.duration)
      })
      closeModal()
      renderAll()
    })

    qs("#deleteBlockBtn").addEventListener("click", () => {
      Scheduler.deleteBlock(block.id)
      closeModal()
      renderAll()
    })
  })
}

function openSchedulerModal() {
  openModal(`
    <h2>Planification automatique</h2>
    <p>Générer le planning hebdomadaire à partir des fragments non placés.</p>
    <button id="runWeekSchedulerBtn" class="action-btn action-btn--accent">Générer</button>
  `, () => {
    qs("#runWeekSchedulerBtn").addEventListener("click", () => {
      Scheduler.generateWeekPlan(new Date(fromISO(App.selectedDate)))
      closeModal()
      renderAll()
    })
  })
}

function openStatsModal() {
  const stats = Engine.getStats()
  openModal(`
    <h2>Statistiques</h2>
    <p>Temps estimé : ${stats.estimated} min</p>
    <p>Temps réel : ${stats.real} min</p>
    <p>Écart : ${stats.delta} min</p>
    <p>Projets : ${stats.projects}</p>
    <p>Fragments : ${stats.fragments}</p>
    <p>Terminés : ${stats.doneFragments}</p>
  `)
}

function openNotesModal() {
  openModal(`
    <h2>Notes globales</h2>
    <textarea id="notesTextArea" rows="12" class="field textarea">${escapeHTML(Engine.state.globalNotes || "")}</textarea>
    <br><br>
    <button id="saveNotesBtn" class="action-btn action-btn--accent">Sauver</button>
  `, () => {
    qs("#saveNotesBtn").addEventListener("click", () => {
      Engine.state.globalNotes = qs("#notesTextArea").value
      qs("#globalNotesArea").value = Engine.state.globalNotes
      Engine.save()
      closeModal()
    })
  })
}

function openKiffanceModal() {
  const ideas = [
    "5 min de marche lente",
    "1 petit groove batterie",
    "relire 1 paragraphe inspirant",
    "écrire 3 idées sans filtre",
    "respirer 10 cycles",
    "ranger une seule zone"
  ]
  const pick = ideas[Math.floor(Math.random() * ideas.length)]
  openModal(`<h2>Kiffance</h2><div class="suggestion-box">${pick}</div>`)
}

function openProjectChooserModal() {
  openModal(`
    <h2>Territoires</h2>
    <div id="projectChooserList" class="stack">
      ${Engine.state.projects.map(p => `<div class="project-task-row" data-project-id="${p.id}">${escapeHTML(p.name)} · ${p.progress}%</div>`).join("")}
    </div>
  `, () => {
    qsa("#projectChooserList .project-task-row").forEach(row => {
      row.addEventListener("click", () => {
        closeModal()
        openProjectDetailModal(row.dataset.projectId)
      })
    })
  })
}

function openSuggestionModal() {
  const best = Engine.suggestFragment()
  const random = Engine.randomFragment()

  openModal(`
    <h2>Suggestion</h2>
    <div class="suggestion-box">
      <strong>Meilleure action</strong><br>
      ${best ? escapeHTML(best.title) : "Aucune"}<br>
      <small>${best ? best.duration + " min · " + best.projectName : ""}</small>
    </div>
    <br>
    <div class="suggestion-box">
      <strong>Option aléatoire</strong><br>
      ${random ? escapeHTML(random.title) : "Aucune"}<br>
      <small>${random ? random.duration + " min · " + random.projectName : ""}</small>
    </div>
    <br>
    <button id="suggestBestBtn" class="action-btn action-btn--accent">Planifier la meilleure</button>
    <button id="suggestRandomBtn" class="action-btn">Planifier l’aléatoire</button>
  `, () => {
    qs("#suggestBestBtn").addEventListener("click", () => {
      if (!best) return
      closeModal()
      openFragmentQuickModal(best.projectId, best.id, true, true)
    })

    qs("#suggestRandomBtn").addEventListener("click", () => {
      if (!random) return
      closeModal()
      openFragmentQuickModal(random.projectId, random.id, true, true)
    })
  })
}

function openManualBlockModal() {
  openModal(`
    <h2>Bloc libre</h2>
    <label>Nom<br><input id="manualBlockTitle" value="Bloc libre"></label><br><br>
    <label>Date<br><input id="manualBlockDate" type="date" value="${App.selectedDate}"></label><br><br>
    <label>Heure<br><input id="manualBlockTime" type="time" value="20:00"></label><br><br>
    <label>Durée<br><input id="manualBlockDuration" type="number" value="${Config.ui.timeline.defaultBlockDuration}"></label><br><br>
    <button id="saveManualBlockBtn" class="action-btn action-btn--accent">Créer</button>
  `, () => {
    qs("#saveManualBlockBtn").addEventListener("click", () => {
      const [h, m] = qs("#manualBlockTime").value.split(":").map(Number)
      Scheduler.createManualBlock({
        date: qs("#manualBlockDate").value,
        startHour: h,
        startMinute: m,
        duration: Number(qs("#manualBlockDuration").value || Config.ui.timeline.defaultBlockDuration),
        title: qs("#manualBlockTitle").value || "Bloc libre"
      })
      closeModal()
      renderAll()
    })
  })
}

function openStickyEditModal(noteId) {
  const note = Engine.state.stickyNotes.find(n => n.id === noteId)
  if (!note) return

  openModal(`
    <h2>Post-it</h2>
    <textarea id="stickyTextInput" class="field textarea" rows="8">${escapeHTML(note.text)}</textarea>
    <br><br>
    <button id="saveStickyBtn" class="action-btn action-btn--accent">Sauver</button>
    <button id="deleteStickyBtn" class="action-btn action-btn--danger">Supprimer</button>
  `, () => {
    qs("#saveStickyBtn").addEventListener("click", () => {
      Engine.updateStickyNote(noteId, { text: qs("#stickyTextInput").value })
      closeModal()
      renderMapView()
    })

    qs("#deleteStickyBtn").addEventListener("click", () => {
      Engine.deleteStickyNote(noteId)
      closeModal()
      renderMapView()
    })
  })
}

function importInbox() {
  const raw = qs("#inboxText").value.trim()
  if (!raw) return

  const firstProject = Engine.state.projects[0]
  if (!firstProject) return

  raw.split("\n").map(s => s.trim()).filter(Boolean).forEach(line => {
    const match = line.match(/^(.*?)(?:\s*-\s*(\d+))?$/)
    const title = match?.[1]?.trim() || line
    const duration = Number(match?.[2] || 20)

    firstProject.fragments.push({
      id: Engine.makeId(),
      title,
      duration,
      energy: 1,
      done: false,
      notes: "",
      scheduled: null,
      realDuration: null
    })
  })

  Engine.updateProjectProgress(firstProject.id)
  qs("#inboxText").value = ""
  Engine.save()
  renderAll()
}
