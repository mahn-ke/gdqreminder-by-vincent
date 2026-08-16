import moment from "moment";

export class EventTracker {
    #logger = null;
    #lastEventID = null;
    #httpClient = null;
    #timeProvider = null;
    #onNextEventScheduleAvailable = null;
    #initialLoop = true;

    constructor(logger, httpClient, timeProvider, onNextEventScheduleAvailable) {
        if (logger)
        {
            this.#logger = logger;
        }
        this.#httpClient = httpClient;
        this.#timeProvider = timeProvider;
        this.#onNextEventScheduleAvailable = onNextEventScheduleAvailable;
        this.#initialLoop = true;
    }

    async #checkForNewEvents() {
        const initialLoop = this.#initialLoop;
        this.#initialLoop = false;

        this.#logger.info("[EVENT-LOOP] Fetching events");
        const eventRequest = await this.#httpClient.get("https://tracker.gamesdonequick.com/tracker/api/v2/events", {throwHttpErrors: false});
        if (eventRequest.statusCode !== 200) {
            this.#logger.error("[EVENT-LOOP] Failed to fetch events: " + eventRequest.statusCode + "\n" + eventRequest.body);
            return;
        }

        const events = JSON.parse(eventRequest.body);

        const event = events.results.sort((a, b) => new Date(b.datetime) - new Date(a.datetime))[0];
        if (!event) {
            this.#logger.error("[EVENT-LOOP] No events found");
            return;
        }
        this.#logger.info("[EVENT-LOOP] Latest event: {short} ({id}) starting at {datetime}", event);
        if (this.#lastEventID === event.id) {
            this.#logger.info("[EVENT-LOOP] Event ID has not changed, skipping");
            return;
        }

        // fetch https://tracker.gamesdonequick.com/tracker/api/v2/events/{id}/runs; if 200, get .results.length, call onNextEventScheduleAvailable with .short
        const eventRunsRequest = await this.#httpClient.get(`https://tracker.gamesdonequick.com/tracker/api/v2/events/${event.id}/runs`, {throwHttpErrors: false});
        if (eventRunsRequest.statusCode !== 200) {
            this.#logger.info("[EVENT-LOOP] No event runs available yet: " + eventRunsRequest.statusCode + "\n" + eventRunsRequest.body);
            return;
        }
        const eventRuns = JSON.parse(eventRunsRequest.body);
        if (eventRuns.results.length === 0) {
            this.#logger.error("[EVENT-LOOP] No runs found for event: " + event.short);
            return;
        }
        this.#logger.info("[EVENT-LOOP] Event {short} has {length} runs", {short: event.short, length: eventRuns.results.length});
        this.#lastEventID = event.id;
        if (initialLoop) {
            this.#logger.info("[EVENT-LOOP] Initial check, skipping");
            return;
        }
        if (!event.short.toLowerCase().includes("gdq")) {
            this.#logger.info("[EVENT-LOOP] Event {short} is not a GDQ event, skipping", {short: event.short});
            return;
        }
        this.#logger.info("[EVENT-LOOP] Event {short} is a GDQ event, calling onNextEventScheduleAvailable", {short: event.short});
        this.#onNextEventScheduleAvailable(event);
    }

    #continueLoop = false;
    async startLoop(config) {
        if (this.#continueLoop) {
            throw new Error("Loop is already running");
        }
        this.#continueLoop = true;
        const {beforeNextCheck, afterEachCheck, refreshIntervalInMS} = config;
        while (this.#continueLoop) {
            const startAt = moment(this.#timeProvider.getCurrent());
            try {
                beforeNextCheck?.(startAt);

                await this.#checkForNewEvents();
                this.#logger.info("[EVENT-LOOP] duration: " + moment.utc(moment(this.#timeProvider.getCurrent()).diff(startAt)).format("HH:mm:ss.SSS"));
            } catch (error) {
                this.#logger.error("[EVENT-LOOP] Error during loop: ", error);
            } finally {
                await new Promise((resolve) => {
                    setTimeout(resolve, refreshIntervalInMS)
                    afterEachCheck?.(startAt);
                });
            }
        }
        if (this.#continueLoop) {
            this.#logger.error("[EVENT-LOOP] Exited loop without calling stopLoop");
            process.exit(2); // force restart
        }
    }

    stopLoop() {
        this.#continueLoop = false;
    }
};