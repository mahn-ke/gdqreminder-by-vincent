import moment from 'moment';

export class DataContainer
{
  static EmitReasons = Object.freeze({
    StartInLessThanTenMinutes: "0",
    TwitchDataMatch: "1"
  });

  #data = {
    "eventOrder": [],
    "events": {},
    "runsWithEventID": {},
    "_runsCache": {}
  };

  #logger = null;
  #httpClient = null;
  #timeProvider = null;
  #onNextRunStarted = null;
  #onNewRunAdded = null;
  #onCacheHit = null;
  #twitch = null;

  constructor(logger, httpClient, timeProvider, twitch, onNextRunStarted, metricsProvider, onNewRunAdded)
  {
    if (logger)
    {
      this.#logger = logger;
    }
    this.#httpClient = httpClient;
    this.#timeProvider = timeProvider;
    this.#onNextRunStarted = onNextRunStarted;
    this.#onCacheHit = metricsProvider?.addCacheHit?.bind(metricsProvider);
    this.#twitch = twitch;
    this.#onNewRunAdded = onNewRunAdded;
  }

  async getAllEvents() 
  {
    let events = (await this.#httpClient.get("https://tracker.gamesdonequick.com/tracker/api/v2/events").json()).results.filter(e=>e.short.toLowerCase().includes("gdq"));
    events = events.map(event => {
      event.short = event.short.toLowerCase();
      event.startTime = new Date(event.datetime);
      delete event.datetime;
      return event;
    })
    const eventsById = Object.fromEntries(events.map(entry => [entry.id, entry]));
    this.#data.events = {...this.#data.events, ...eventsById};
    
    const eventsInOrder = events.sort((a,b)=>new Date(a.startTime) - new Date(b.startTime));
    this.#data.eventOrder = eventsInOrder;
  }

  #cacheTTL = 9 * 1000; // 9 seconds
  async getEvent(eventID)
  {
    const cacheKey = `runs_${eventID}`;
    const now = this.#timeProvider.getCurrent().getTime();
    const cached = this.#data._runsCache[cacheKey];
    let runs = null;
    if (cached && (now - cached.timestamp < this.#cacheTTL)) {
      runs = cached.data;
      this.#onCacheHit?.(`https://tracker.gamesdonequick.com/tracker/api/v2/events/${eventID}/runs/`);
    } else {
      runs = (await this.#httpClient.get(`https://tracker.gamesdonequick.com/tracker/api/v2/events/${eventID}/runs/`).json()).results;
      this.#data._runsCache[cacheKey] = { data: structuredClone(runs), timestamp: now };
    }

    const runsWithEventIDById = Object.fromEntries(runs.map(entry => {
      if (entry.starttime) {
        entry.startTime = new Date(entry.starttime);
        delete entry.starttime;
      }

      if (entry.endtime) {
        entry.endTime = new Date(entry.endtime);
        delete entry.endtime;
      }

      entry.eventID = eventID;

      return [entry.id, entry];
    }));

    const existingRunIDs = new Set(Object.keys(this.#data.runsWithEventID));
    const newRunIDs = Object.keys(runsWithEventIDById).filter(id => !existingRunIDs.has(id));

    if (this.#onNewRunAdded && newRunIDs.length > 0 && this.#data.events[eventID]?.runsInOrder?.length > 0) {
      newRunIDs.forEach(id => {
      if (!this.#data.events[eventID].runsInOrder.some(run => run.id === id)) {
        if (runsWithEventIDById[id].display_name) {
          this.#onNewRunAdded(runsWithEventIDById[id]);
        }
      }
      });
    }

    this.#data.runsWithEventID = { ...this.#data.runsWithEventID, ...runsWithEventIDById };

    const runsInOrder = Object.values(runsWithEventIDById).sort((a,b)=>new Date(a.startTime) - new Date(b.startTime));
    if (this.#data.eventOrder.length <= 0)
    {
      await this.getAllEvents();
    }

    const eventIndex = this.#data.eventOrder.findIndex(event=>event.id == eventID);

    this.#data.events[eventID].runsInOrder = runsInOrder;
    this.#data.eventOrder[eventIndex].runsInOrder = runsInOrder;

    const lastRunOfEvent = runsInOrder?.at(-1);

    if (lastRunOfEvent)
    {
      this.#data.events[eventID].endTime = new Date(this.#data.runsWithEventID[lastRunOfEvent.id].endTime);
      this.#data.eventOrder[eventIndex].endTime = new Date(this.#data.runsWithEventID[lastRunOfEvent.id].endTime);
    }

    return this.#data.events[eventID];
  }

  async getPreviousEvent()
  {
    if (this.#data.eventOrder.length <= 0)
    {
      await this.getAllEvents();
    }

    let eventsStartedBeforeNow = this.#data.eventOrder.filter(event=>new Date(event.startTime) <= this.#timeProvider.getCurrent());
    const currentEvent = await this.getCurrentEvent();
    if (currentEvent?.short)
    {
      eventsStartedBeforeNow = eventsStartedBeforeNow.filter(event=>event.short !== currentEvent.short);
    }
    const lastEvent = eventsStartedBeforeNow.at(-1);
    if (!lastEvent)
    {
      return null;
    }
    return this.getEvent(lastEvent.id);
  }

  async getCurrentEvent()
  {
    if (this.#data.eventOrder.length <= 0)
    {
      await this.getAllEvents();
    }
    const eventsStartedBeforeNow = this.#data.eventOrder.filter(event=>new Date(event.startTime) <= this.#timeProvider.getCurrent());
    if (eventsStartedBeforeNow.length == 0)
    {
      return null;
    }
    const currentEvent = eventsStartedBeforeNow.at(-1);
    const event = await this.getEvent(currentEvent.id);
    if (new Date(event.endTime) > this.#timeProvider.getCurrent())
    {
      return event;
    }

    return null;
  }

  async getRelevantEvent()
  {
    const currentEvent = await this.getCurrentEvent();
    if (currentEvent)
    {
      return currentEvent;
    }

    const previousEvent = await this.getPreviousEvent();
    const nextEvent = await this.getNextEvent();
    if (nextEvent)
    {
      // if time between start time of next event is smaller than time between start time of previous event
      if (Math.abs(new Date(nextEvent.startTime) - this.#timeProvider.getCurrent()) < Math.abs(new Date(previousEvent.endTime) - this.#timeProvider.getCurrent()))
      {
        return nextEvent;
      }
    }

    return previousEvent;
  }

  async getNextEvent()
  {
    if (this.#data.eventOrder.length <= 0)
    {
      await this.getAllEvents();
    }
    const eventsStartingInTheFuture = this.#data.eventOrder.filter(event=>new Date(event.startTime) > this.#timeProvider.getCurrent());
    const firstUpcomingEvent = eventsStartingInTheFuture.at(0);
    if (!firstUpcomingEvent)
    {
      return null;
    }
    return this.getEvent(firstUpcomingEvent.id);
  }

  async getPreviousRun()
  {
    const currentRun = await this.getCurrentRun();
    const currentEvent = await this.getRelevantEvent();

    if (currentRun != null)
    {
      const previousRunIndex = this.#data.events[currentEvent.id].runsInOrder.findIndex(run => run.id == currentRun.id) - 1;
      if (previousRunIndex < 0)
      {
        return null;
      }
      return this.#data.events[currentEvent.id].runsInOrder[previousRunIndex];
    }

    if (currentEvent.endTime <= this.#timeProvider.getCurrent())
    {
      return this.#data.events[currentEvent.id].runsInOrder.at(-1);
    }

    return null;
  }

  async getCurrentRun()
  {
    const currentEvent = await this.getCurrentEvent();
    if (currentEvent == null)
    {
      return null;
    }

    const currentEventID = currentEvent.id;

    const currentRun = this.#data.events[currentEventID].runsInOrder.find(run => run.startTime <= this.#timeProvider.getCurrent() && this.#timeProvider.getCurrent() < run.endTime);
    return currentRun;
  }

  async getNextRun()
  {
    const currentRun = await this.getCurrentRun();
    const currentEvent = await this.getRelevantEvent();

    if (currentRun != null)
    {
      const nextRunIndex = this.#data.events[currentEvent.id].runsInOrder.findIndex(run => run.id == currentRun.id) + 1;
      if (nextRunIndex >= this.#data.events[currentEvent.id].runsInOrder.length)
      {
        return null;
      }
      return this.#data.events[currentEvent.id].runsInOrder[nextRunIndex];
    }

    if (currentEvent.startTime > this.#timeProvider.getCurrent())
    {
      return this.#data.events[currentEvent.id].runsInOrder.at(0);
    }

    return null;
  }

  #dataAtLastCheck = {
    timestamp: -1,
    currentlyTrackedRunID: null,
    notifiedRuns: []
  };

  async getRunToMonitor()
  {
    const lastCalledAt = this.#dataAtLastCheck.timestamp;
    const now = this.#timeProvider.getCurrent();

    this.#dataAtLastCheck.timestamp = now.getTime();

    if (this.#dataAtLastCheck.currentlyTrackedRunID)
    {
      await this.getEvent(this.#data.runsWithEventID[this.#dataAtLastCheck.currentlyTrackedRunID].eventID);
      if (!this.#dataAtLastCheck.notifiedRuns.includes(this.#dataAtLastCheck.currentlyTrackedRunID))
      {
        return this.#data.runsWithEventID[this.#dataAtLastCheck.currentlyTrackedRunID];
      }
    }

    if (lastCalledAt == -1)
    {
      this.#logger.info(`[RUN-LOOP] initial check: ${now.toISOString()}`);
      return;
    }

    let nextRunID = this.#dataAtLastCheck.currentlyTrackedRunID;
    do {
      if (!this.#dataAtLastCheck.currentlyTrackedRunID)
      {
        nextRunID = (await this.getNextRun())?.id;
        if (!nextRunID)
        {
          return null;
        }
        break;
      }
      const relevantEvent = await this.getRelevantEvent();
      let nextRunEventID = this.#data.runsWithEventID[nextRunID].eventID;
      if (relevantEvent.id != nextRunEventID)
      {
        nextRunID = relevantEvent.runsInOrder.at(0).id;
        break;
      }
      const eventIDOfLastTrackedRun = this.#data.events[nextRunEventID];
      const nextRunIndex = eventIDOfLastTrackedRun.runsInOrder.findIndex(run => run.id == nextRunID)+1;
      nextRunID = eventIDOfLastTrackedRun.runsInOrder[nextRunIndex]?.id
      if (!nextRunID)
      {
        return;
      }
  
      if (!this.#dataAtLastCheck.notifiedRuns.includes(nextRunID))
      {
        break;
      }
      this.#logger.warn(`[RUN-LOOP] next run we should be tracking is ${nextRunID}, but already informed about it, moving to the next`)
      continue;
    } while(nextRunID);

    this.#logger.info(`[RUN-LOOP] run id: ${nextRunID} (${this.#data.runsWithEventID[nextRunID].display_name})`);
    this.#dataAtLastCheck.currentlyTrackedRunID = nextRunID;
    return this.#data.runsWithEventID[nextRunID];
  }

  async checkTwitch()
  {
    const monitoredRun = await this.getRunToMonitor();
    if (!monitoredRun)
    {
      return;
    }

    if (monitoredRun.id == this.#data.events[monitoredRun.eventID].runsInOrder[0].id)
    {
      return;
    }
    
    if (monitoredRun.twitch_name)
    {
      if (await this.#twitch.isSubstringOfGameNameOrStreamTitle(monitoredRun.twitch_name))
      {
        this.#dataAtLastCheck.notifiedRuns.push(monitoredRun.id);
        this.#onNextRunStarted(monitoredRun, DataContainer.EmitReasons.TwitchDataMatch);
        return;
      }
    }

    if (monitoredRun.display_name)
    {
      if (await this.#twitch.isSubstringOfGameNameOrStreamTitle(monitoredRun.display_name))
      {
        this.#dataAtLastCheck.notifiedRuns.push(monitoredRun.id);
        this.#onNextRunStarted(monitoredRun, DataContainer.EmitReasons.TwitchDataMatch);
        return;
      }
    }
  }
  
  async checkFor10MinuteWarning()
  {
    const monitoredRun = await this.getRunToMonitor();
    if (!monitoredRun)
    {
      return;
    }
    
    if (!moment(this.#dataAtLastCheck.timestamp).add(10, 'minutes').isAfter(monitoredRun.startTime))
    {
      return;
    }

    this.#dataAtLastCheck.notifiedRuns.push(monitoredRun.id);
    this.#onNextRunStarted(monitoredRun, DataContainer.EmitReasons.StartInLessThanTenMinutes);
  }

  #continueLoop = false;
  async startLoop(config) {
    if (this.#continueLoop) {
      throw new Error("Loop is already running");
    }
    this.#continueLoop = true;
    const {beforeNextCheck, afterEachCheck, refreshIntervalInMS} = config;
    while (this.#continueLoop)
    {
        const startAt = moment(this.#timeProvider.getCurrent());
        try {
          beforeNextCheck?.(startAt);
          await this.checkFor10MinuteWarning();
          await this.checkTwitch();
          await this.getNextEvent(); // checks for runs in next event
          this.#logger.info("[RUN-LOOP] duration: " + moment.utc(moment(this.#timeProvider.getCurrent()).diff(startAt)).format("HH:mm:ss.SSS"));
        } catch (error) {
          this.#logger.error("[RUN-LOOP] Error during loop: ", error);
        } finally {
          await new Promise((resolve) => {
            setTimeout(resolve, refreshIntervalInMS)
            afterEachCheck?.(startAt);
          });
        }
    }
    if (this.#continueLoop) {
      this.#logger.error("[RUN-LOOP] Exited loop without calling stopLoop");
      process.exit(1); // force restart
    }
  }

  async stopLoop() {
    this.#continueLoop = false;
  }
}