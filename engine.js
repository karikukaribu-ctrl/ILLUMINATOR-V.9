const Engine = {}

Engine.state = {
  projects: [],
  history: [],
  energyProfile: {},
  preferences: {
    season: Config.defaults.season,
    mode: Config.defaults.mode,
    focus: Config.defaults.focus,
    energyPeak: Config.defaults.energyPeak,
    focusDuration: Config.defaults.focusDuration,
    weekType: Config.defaults.weekType
  },
  scheduledBlocks: [],
  stickyNotes: [],
  globalNotes: ""
}

Engine.makeId = function() {
  return crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

Engine.createProject = function({
  name,
  deadline,
  fragments = Config.projectDefaults.fragments,
  fragmentDuration = Config.projectDefaults.fragmentDuration,
  priority = Config.projectDefaults.priority,
  weeklyTarget = Config.projectDefaults.weeklyTarget,
  energyRequired = Config.projectDefaults.energyRequired,
  color = Config.projectDefaults.color
}) {
  const project = {
    id: Engine.makeId(),
    name,
    deadline,
    priority,
    weeklyTarget,
    energyRequired,
    color,
    progress: 0,
    expanded: false,
    x: 0,
    y: 0,
    fragments: []
  }

  for (let i = 0; i < fragments; i++) {
    project.fragments.push({
      id: Engine.makeId(),
      title: `${name} — fragment ${i + 1}`,
      duration: fragmentDuration,
      energy: energyRequired,
      done: false,
      notes: "",
      scheduled: null,
      realDuration: null
    })
  }

  Engine.state.projects.push(project)
  Engine.updateProjectProgress(project.id)
  Engine.save()
  return project
}

Engine.getProject = function(projectId) {
  return Engine.state.projects.find(p => p.id === projectId) || null
}

Engine.getFragment = function(projectId, fragmentId) {
  const project = Engine.getProject(projectId)
  if (!project) return null
  return project.fragments.find(f => f.id === fragmentId) || null
}

Engine.getAllFragments = function() {
  return Engine.state.projects.flatMap(project =>
    project.fragments.map(fragment => ({
      ...fragment,
      projectId: project.id,
      projectName: project.name,
      projectColor: project.color,
      priority: project.priority,
      deadline: project.deadline,
      weeklyTarget: project.weeklyTarget
    }))
  )
}

Engine.toggleFragmentDone = function(projectId, fragmentId) {
  const fragment = Engine.getFragment(projectId, fragmentId)
  if (!fragment) return
  fragment.done = !fragment.done
  if (fragment.done) {
    Engine.state.history.push({
      id: Engine.makeId(),
      date: new Date().toISOString(),
      projectId,
      fragmentId,
      duration: fragment.realDuration || fragment.duration
    })
  }
  Engine.updateProjectProgress(projectId)
  Engine.learnEnergyPatterns()
  Engine.save()
}

Engine.updateProjectProgress = function(projectId) {
  const project = Engine.getProject(projectId)
  if (!project) return
  const total = project.fragments.length
  const done = project.fragments.filter(f => f.done).length
  project.progress = total ? Math.round((done / total) * 100) : 0
}

Engine.updateFragment = function(projectId, fragmentId, patch) {
  const fragment = Engine.getFragment(projectId, fragmentId)
  if (!fragment) return null
  Object.assign(fragment, patch)
  Engine.updateProjectProgress(projectId)
  Engine.save()
  return fragment
}

Engine.recordEnergy = function(hour, value) {
  Engine.state.energyProfile[hour] = value
  Engine.save()
}

Engine.estimateEnergy = function(hour) {
  if (Engine.state.energyProfile[hour] !== undefined) {
    return Engine.state.energyProfile[hour]
  }
  const peak = Number(Engine.state.preferences.energyPeak || 21)
  const distance = Math.abs(hour - peak)
  return Math.max(1, 10 - distance)
}

Engine.scoreFragment = function(fragment, currentHour) {
  let urgency = 1

  if (fragment.deadline) {
    const daysLeft = (new Date(fragment.deadline) - new Date()) / (1000 * 60 * 60 * 24)
    urgency = Math.max(1, 10 - daysLeft)
  }

  const energyMatch = Engine.estimateEnergy(currentHour) / Math.max(fragment.energy, 1)
  const durationFit = fragment.duration <= Number(Engine.state.preferences.focusDuration || 40) ? 1.2 : 1
  const scheduleBonus = fragment.scheduled ? 1.15 : 1
  const priorityBonus = 1 + ((fragment.priority || 1) * 0.08)

  return urgency * energyMatch * durationFit * scheduleBonus * priorityBonus
}

Engine.suggestFragment = function() {
  const hour = new Date().getHours()
  const fragments = Engine.getAllFragments().filter(f => !f.done)
  if (!fragments.length) return null

  let best = null
  let bestScore = -Infinity

  fragments.forEach(fragment => {
    const score = Engine.scoreFragment(fragment, hour)
    if (score > bestScore) {
      best = fragment
      bestScore = score
    }
  })

  return best
}

Engine.randomFragment = function() {
  const fragments = Engine.getAllFragments().filter(f => !f.done)
  if (!fragments.length) return null
  return fragments[Math.floor(Math.random() * fragments.length)]
}

Engine.learnEnergyPatterns = function() {
  const hourly = {}

  Engine.state.history.forEach(entry => {
    const hour = new Date(entry.date).getHours()
    if (!hourly[hour]) hourly[hour] = 0
    hourly[hour] += entry.duration
  })

  Object.keys(hourly).forEach(hour => {
    Engine.state.energyProfile[hour] = Math.min(10, Math.max(1, Math.round(hourly[hour] / 20)))
  })
}

Engine.getStats = function() {
  let estimated = 0
  let real = 0
  let doneFragments = 0
  let totalFragments = 0

  Engine.state.projects.forEach(project => {
    project.fragments.forEach(fragment => {
      estimated += fragment.duration
      totalFragments += 1
      if (fragment.done) {
        doneFragments += 1
        real += fragment.realDuration || fragment.duration
      }
    })
  })

  return {
    estimated,
    real,
    delta: real - estimated,
    projects: Engine.state.projects.length,
    fragments: totalFragments,
    doneFragments
  }
}

Engine.createStickyNote = function(text = Config.stickyDefaults.text) {
  const note = {
    id: Engine.makeId(),
    text,
    x: Config.stickyDefaults.x,
    y: Config.stickyDefaults.y
  }
  Engine.state.stickyNotes.push(note)
  Engine.save()
  return note
}

Engine.updateStickyNote = function(noteId, patch) {
  const note = Engine.state.stickyNotes.find(n => n.id === noteId)
  if (!note) return null
  Object.assign(note, patch)
  Engine.save()
  return note
}

Engine.deleteStickyNote = function(noteId) {
  Engine.state.stickyNotes = Engine.state.stickyNotes.filter(n => n.id !== noteId)
  Engine.save()
}

Engine.save = function() {
  localStorage.setItem(Config.app.storageKey, JSON.stringify(Engine.state))
}

Engine.load = function() {
  const raw = localStorage.getItem(Config.app.storageKey)
  if (!raw) return
  try {
    Engine.state = JSON.parse(raw)
  } catch (e) {
    console.warn("Impossible de charger l'état local :", e)
  }
}
