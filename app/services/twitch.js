const CACHE_TTL_MS = 5000; // 5 seconds
export class Twitch {
    #httpClient = null;
    #timeProvider = null;
    #clientID = "";
    #logger = null;
    #reportCacheHit = null;
    constructor(httpClient, timeProvider, clientID, logger, metricsProvider) {
        this.#httpClient = httpClient;
        this.#timeProvider = timeProvider;
        this.#clientID = clientID;
        this.#logger = logger;
        this.#reportCacheHit = metricsProvider?.addCacheHit?.bind(metricsProvider);
    }
    // get current title or game name via gql api with got and TWITCH_CLIENT_ID env
    #cache = {
        data: null,
        timestamp: 0
    };

    async fetchTitle() {
        const now = this.#timeProvider.getCurrent().getTime();
        if (this.#cache.data && (now - this.#cache.timestamp) < CACHE_TTL_MS) {
            this.#reportCacheHit?.("https://gql.twitch.tv/gql");
            return this.#cache.data;
        }
        const response = await this.#httpClient.post("https://gql.twitch.tv/gql", {
            headers: {
                "Client-ID": this.#clientID,
            },
            json: [{
                "operationName": "ComscoreStreamingQuery",
                "variables": {
                    "channel": "gamesdonequick",
                    "clipSlug": "",
                    "isClip": false,
                    "isLive": true,
                    "isVodOrCollection": false,
                    "vodID": ""
                },
                "extensions": {
                    "persistedQuery": {
                        "version": 1,
                        "sha256Hash": "e1edae8122517d013405f237ffcc124515dc6ded82480a88daef69c83b53ac01"
                    }
                }
            }],
            timeout: {
                request: 2000
            },
            retry: { 
                limit: 10, 
                methods: ["POST"]
            }
        }).json();
        this.#cache = {
            data: response,
            timestamp: now
        };
        return this.#cache.data;
    }

    async isSubstringOfGameNameOrStreamTitle(substring) {
        const response = await this.fetchTitle();
        const streamName = response[0].data.user.broadcastSettings.title.toLowerCase();
        if (streamName.includes(substring.toLowerCase())) {
            return true;
        }
        if (response[0].data.user.stream?.game?.name) {
            const gameName = response[0].data.user.stream.game.name.toLowerCase();
            if (gameName.includes(substring.toLowerCase())) {
                return true;
            }
        }
        return false;
    }
}