import { initializeApp } from 'firebase-admin/app';
import Firebase from './messaging/firebase.js';
import { EventTracker } from './store/eventTracker.js';
import { DataContainer } from './store/dataContainer.js';
import { FakeTimeProvider } from './services/timeProvider/fakeTimeProvider.js';
import { RealTimeProvider } from './services/timeProvider/realTimeProvider.js';
import got from 'got';
import { Twitch } from './services/twitch.js'
import winston from 'winston'
import { SeqTransport } from '@datalust/winston-seq'
import { ApiProxyMetricsServer } from './metrics/apiProxyMetricsServer.js';

initializeApp();

const parsedArgs = Object.fromEntries(process.argv
                     .filter(value=>value.startsWith("--"))
                     .map(value => [value.split("=")[0].slice(2), value.split("=")[1]]));

const setupLogger = (config) =>
{
  const {seqHost, seqAPIKey} = config;
  let transports = [new winston.transports.Console({
    format: winston.format.simple(),
  })];
  
  const logger = winston.createLogger({
    exitOnError: true,
    defaultMeta: { application: 'gdqreminder-by-vincent' },
    transports,
    level: "info",
    format: winston.format.combine(  /* This is required to get errors to log with stack traces. See https://github.com/winstonjs/winston/issues/1498 */
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    handleExceptions: true,
    handleRejections: true,
  });
  logger.info("[LOGGER] Adding console logger");
  
  if (seqHost && seqAPIKey)
  {
    logger.add(new SeqTransport({
      serverUrl: seqHost,
      apiKey: seqAPIKey,
      level: "info",
      handleExceptions: true,
      handleRejections: true,
      onError: (e => { 
        logger.error(e);
      }),
    }));
    logger.info("[LOGGER] Adding seq logger");
  }
  return logger;
};

const startup = async (logger, config) => {
  const {startTime, speedup, refreshIntervalInMS} = config;
  if (!refreshIntervalInMS)
  {
    throw new Error("A refresh interval in ms with --refreshIntervalInMS is required");
  }

  let timeProvider = new RealTimeProvider();
  if (!!startTime ^ !!speedup)
  {
    throw new Error("[TIMEPROVIDER] You must specify both --startTime and --speedup to use a fake time provider");
  }
  if (startTime && speedup)
  {
    logger.warn("[TIMEPROVIDER] Using fake time provider");
    timeProvider = new FakeTimeProvider(new Date(startTime).getTime());
  }

  const firebase = new Firebase(logger);

  const onNextRunStarted = (run, reason) => {
    logger.info("[EMISSION] run start: {id}", run);
    firebase.sendRunStartNotification(run, reason);
  };
  const onNextEventScheduleReleased = (event) => {
    logger.info("[EMISSION] event announced: " + event.id);
    firebase.sendEventAnnouncementNotification(event);
  };
  const onNewRunAdded = (run) => {
    logger.info("[EMISSION] new run added: {display_name} ({id}) from {startTime} to {endTime}", run);
    firebase.sendRunAddedNotification(run);
  };

  const metricsProvider = new ApiProxyMetricsServer(logger, 9000);

  const instance = got.extend({
    hooks: {
      beforeRequest: [
        options => {
          options.context = options.context || {};
          options.context.startTime = timeProvider.getCurrent().getTime();
        }
      ],
      afterResponse: [
        response => {
          const startTime = response.request.options.context?.startTime;
          metricsProvider.addRequestTime(response.url, timeProvider.getCurrent().getTime() - startTime);
          metricsProvider.addCacheMiss(response.url);
          return response;
        }
      ]
    },
  });
  
  const dataContainer = new DataContainer(logger, instance, timeProvider, new Twitch(instance, timeProvider, process.env.TWITCH_CLIENT_ID, logger, metricsProvider), onNextRunStarted, metricsProvider, onNewRunAdded);
  const eventTracker = new EventTracker(logger, instance, timeProvider, onNextEventScheduleReleased);
  
  await Promise.all([
    dataContainer.startLoop({...config,
      beforeNextCheck: (timeProvider instanceof FakeTimeProvider) ? () => {
      timeProvider.passTime(refreshIntervalInMS * speedup);
      logger.info(`[TIME] Passing ${((refreshIntervalInMS * speedup) / 1000)} seconds; now ${timeProvider.getCurrent().toISOString()}`);
    } : undefined}),
    eventTracker.startLoop(config),
  ]);
};

const logger = setupLogger(parsedArgs);
try {
  await startup(logger, parsedArgs);
} catch (e)
{
  logger.error(e);
}