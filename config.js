const Config = {
  app: {
    name: "Illuminator",
    version: "9.0.0",
    storageKey: "illuminator-v9-state",
    defaultView: "map"
  },

  ui: {
    timeline: {
      startHour: 6,
      endHour: 23,
      minutesStep: 15,
      pxPer15Min: 22,
      defaultBlockDuration: 30
    },
    map: {
      width: 1100,
      height: 460,
      projectRadius: 160,
      fragmentRadius: 88
    }
  },

  planning: {
    templates: {
      work: {
        label: "Semaine travail",
        allowedWindows: [
          { start: 8 * 60, end: 8 * 60 + 30, tag: "morning-write" },
          { start: 12 * 60, end: 12 * 60 + 30, tag: "midday-short" },
          { start: 20 * 60, end: 23 * 60, tag: "evening" }
        ]
      },
      holiday: {
        label: "Semaine congé",
        allowedWindows: [
          { start: 8 * 60, end: 23 * 60, tag: "free-day" }
        ]
      },
      weekend: {
        label: "Week-end",
        allowedWindows: [
          { start: 9 * 60, end: 13 * 60, tag: "weekend-focus" },
          { start: 14 * 60, end: 18 * 60, tag: "weekend-flex" }
        ]
      }
    }
  },

  defaults: {
    season: "automne",
    mode: "light",
    focus: false,
    energyPeak: 21,
    focusDuration: 40,
    weekType: "work"
  },

  projectDefaults: {
    priority: 3,
    weeklyTarget: 3,
    energyRequired: 2,
    fragmentDuration: 30,
    fragments: 8,
    color: "#7c4a2d"
  },

  stickyDefaults: {
    x: 40,
    y: 40,
    text: "Note rapide"
  },

  googleCalendar: {
    enabled: false,
    clientId: "YOUR_GOOGLE_CLIENT_ID",
    apiKey: "YOUR_GOOGLE_API_KEY",
    discoveryDocs: [
      "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"
    ],
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    calendarIds: ["primary"]
  }
}

const GoogleCalendarBridge = {
  isReady() {
    return !!(
      Config.googleCalendar.enabled &&
      Config.googleCalendar.clientId !== "YOUR_GOOGLE_CLIENT_ID" &&
      Config.googleCalendar.apiKey !== "YOUR_GOOGLE_API_KEY" &&
      window.gapi
    )
  },

  async init() {
    if (!this.isReady()) return false

    await new Promise((resolve, reject) => {
      window.gapi.load("client:auth2", {
        callback: resolve,
        onerror: reject,
        timeout: 5000,
        ontimeout: reject
      })
    })

    await window.gapi.client.init({
      apiKey: Config.googleCalendar.apiKey,
      clientId: Config.googleCalendar.clientId,
      discoveryDocs: Config.googleCalendar.discoveryDocs,
      scope: Config.googleCalendar.scope
    })

    return true
  },

  async signIn() {
    if (!this.isReady()) return false
    const auth = window.gapi.auth2.getAuthInstance()
    if (!auth.isSignedIn.get()) {
      await auth.signIn()
    }
    return auth.isSignedIn.get()
  },

  async listWeekEvents(startISO, endISO) {
    if (!this.isReady()) return []

    const ok = await this.signIn()
    if (!ok) return []

    const all = []

    for (const calendarId of Config.googleCalendar.calendarIds) {
      const response = await window.gapi.client.calendar.events.list({
        calendarId,
        timeMin: new Date(startISO).toISOString(),
        timeMax: new Date(endISO).toISOString(),
        showDeleted: false,
        singleEvents: true,
        orderBy: "startTime"
      })

      const items = response.result.items || []
      items.forEach(item => {
        all.push({
          id: item.id,
          title: item.summary || "Événement",
          start: item.start?.dateTime || item.start?.date,
          end: item.end?.dateTime || item.end?.date,
          source: "google-calendar"
        })
      })
    }

    return all
  }
}
