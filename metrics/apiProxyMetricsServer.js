import express from 'express';
import got from 'got';

export class ApiProxyMetricsServer {
    #server = null;
    #allowedProxyPaths = [
        /^tracker\/api\/v2\/events\/?$/,
        /^tracker\/api\/v2\/events\/\d+\/runs\/?$/,
    ];
    cacheMisses = {};
    cacheHits = {};
    twitchRequestDurationBuckets = {};
    twitchRequestDurationTotal = {};
    constructor(logger, port) {
        this.startTime = Date.now();

        this.app = express();

        this.app.get('/metrics', (req, res) => {
            let response = '';
            for (const [url, buckets] of Object.entries(this.twitchRequestDurationBuckets)) {
                let count = 0;
                const prometheusBuckets = this.#bucketsInMS.map(ms => ({
                    ms,
                    le: ms === Infinity ? "+Inf" : (ms / 1000).toString()
                }));
                for (const bucket of prometheusBuckets) {
                    response += `http_request_duration_seconds_bucket{url="${url}",le="${bucket.le}"} ${buckets[bucket.ms] || 0}\n`;
                    count += buckets[bucket.ms] || 0;
                }
                response += `http_request_duration_seconds_sum{url="${url}"} ${this.twitchRequestDurationTotal[url]/1000 || 0}\n`;
                response += `http_request_duration_seconds_count{url="${url}"} ${count}\n`;
            }
            for (const [url, count] of Object.entries(this.cacheMisses)) {
                response += `cache_misses{url="${url}"} ${count}\n`;
            }
            for (const [url, count] of Object.entries(this.cacheHits)) {
                response += `cache_hits{url="${url}"} ${count}\n`;
            }
            const secondsRunning = Math.floor((Date.now() - this.startTime) / 1000);
            response += `seconds_running ${secondsRunning}\n`;
            res.set('Content-Type', 'text/plain');
            res.send(response);
        });

        this.app.get('/proxy/*path', async (req, res) => {
            const pathParam = this.#normalizeProxyPath(req.params.path);
            if (!this.#isAllowedProxyPath(pathParam)) {
                res.status(403).json({ error: 'Forbidden proxy path' });
                return;
            }

            const queryIndex = req.originalUrl.indexOf('?');
            const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
            const targetUrl = `https://tracker.gamesdonequick.com/${pathParam}${query}`;

            try {
                const response = await got(targetUrl, {
                    method: 'GET',
                    throwHttpErrors: false,
                    responseType: 'buffer',
                    headers: {
                        'user-agent': req.get('user-agent') || 'GDQReminderBackendProxy/1.0',
                    },
                });

                res.status(response.statusCode);
                if (response.headers['content-type']) {
                    res.set('Content-Type', response.headers['content-type']);
                }
                if (response.headers['cache-control']) {
                    res.set('Cache-Control', response.headers['cache-control']);
                }
                res.send(response.body);
            } catch (error) {
                logger?.error('[PROXY] Failed to forward request', { targetUrl, error });
                res.status(502).json({ error: 'Bad gateway' });
            }
        });

        if (port) {
            this.#server = this.app.listen(port, () => {
                logger?.info(`Metrics server running on http://localhost:${port}/metrics`);
            });
        } else {
            logger?.warn("[METRICS] No port specified, metrics server will not start.");
        }
    }

    #bucketsInMS = [100, 200, 300, 400, 500, 800, 1000, 2000, 3000, 4000, 5000, 8000, Infinity];

    #normalizeProxyPath(pathValue) {
        if (Array.isArray(pathValue)) {
            return pathValue.join('/').replace(/^\/+/, '');
        }
        if (typeof pathValue !== 'string') {
            return '';
        }

        return pathValue.replace(/^\/+/, '');
    }

    #isAllowedProxyPath(pathValue) {
        return this.#allowedProxyPaths.some((pattern) => pattern.test(pathValue));
    }

    addRequestTime(url, requestTime) {
        if (!this.twitchRequestDurationBuckets[url]) {
            this.twitchRequestDurationBuckets[url] = {};
            for (const bucket of this.#bucketsInMS) {
                this.twitchRequestDurationBuckets[url][bucket] = 0;
            }
        }

        for (let i = 0; i < this.#bucketsInMS.length; i++)
        {
            if (requestTime <= this.#bucketsInMS[i]) {
                this.twitchRequestDurationBuckets[url][this.#bucketsInMS[i]]++;
                break;
            }
        }
        if (!this.twitchRequestDurationTotal[url]) {
            this.twitchRequestDurationTotal[url] = 0;
        }
        this.twitchRequestDurationTotal[url] += requestTime;
    }
    addCacheMiss(url) {
        if (!this.cacheMisses[url]) {
            this.cacheMisses[url] = 0;
        }
        this.cacheMisses[url]++;
    }
    addCacheHit(url) {
        if (!this.cacheHits[url]) {
            this.cacheHits[url] = 0;
        }
        this.cacheHits[url]++;
    }
}