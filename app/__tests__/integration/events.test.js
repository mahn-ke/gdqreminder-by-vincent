import { jest } from '@jest/globals'
import moment from 'moment';
import { FakeTimeProvider } from '../../services/timeProvider/fakeTimeProvider.js';
import { EventTracker } from '../../store/eventTracker.js';
import { FakeHTTPClient } from '../stubs/fakeHTTPClient.js';

jest.useFakeTimers();

const tenMinutesBeforeAGDQ2025 = "2022-01-09T16:00:00Z";
const secondsPassingEachCheck = 30;

const stubLogger = {
    info: jest.fn(),
    error: jest.fn()
};

describe("integration", () => {
    const emissionMethod = jest.fn();
    const timeProvider = new FakeTimeProvider(new Date(tenMinutesBeforeAGDQ2025).getTime());
    const fakeHTTPClient = new FakeHTTPClient("integration/events/0-sgdq2024-is-latest");
    
    const systemUnderTest = new EventTracker(stubLogger, fakeHTTPClient, timeProvider, emissionMethod);

    it("emits for each different occasion", async () => {
        const loopWithEvents = new Promise(async (resolve, reject) => {
            const events = {
                "2022-01-09T16:10:00.000Z": () => {
                    fakeHTTPClient.setPrefix("integration/events/1-agdq2025-is-404");
                },
                "2022-01-09T16:20:00.000Z": () => {
                    fakeHTTPClient.setPrefix("integration/events/2-agdq2025-is-403");
                },
                "2022-01-09T16:30:00.000Z": () => {
                    fakeHTTPClient.setPrefix("integration/events/3-agdq2025-has-zero-runs");
                },
                "2022-01-09T16:40:00.000Z": () => {
                    fakeHTTPClient.setPrefix("integration/events/4-agdq2025-is-latest");
                },
                "2022-01-09T16:50:00.000Z": () => {
                    fakeHTTPClient.setPrefix("integration/events/5-SpeedAtPAXEast25-is-403");
                },
                "2022-01-09T17:00:00.000Z": () => {
                    fakeHTTPClient.setPrefix("integration/events/6-SpeedAtPAXEast25-is-404");
                },
                "2022-01-09T17:10:00.000Z": () => {
                    fakeHTTPClient.setPrefix("integration/events/7-SpeedAtPAXEast25-has-zero-runs");
                },
                "2022-01-09T17:20:00.000Z": () => {
                    fakeHTTPClient.setPrefix("integration/events/8-SpeedAtPAXEast25-is-latest");
                },
                "2022-01-09T17:30:00.000Z": () => {
                    fakeHTTPClient.setPrefix("integration/events/9-sgdq2025-is-403");
                },
                "2022-01-09T17:40:00.000Z": () => {
                    fakeHTTPClient.setPrefix("integration/events/10-sgdq2025-is-404");
                },
                "2022-01-09T17:50:00.000Z": () => {
                    fakeHTTPClient.setPrefix("integration/events/11-sgdq2025-has-zero-runs");
                },
                "2022-01-09T18:00:00.000Z": () => {
                    fakeHTTPClient.setPrefix("integration/events/12-sgdq2025-is-latest");
                },
                "2022-01-09T18:10:00.000Z": () => {
                    systemUnderTest.stopLoop();
                    resolve(); // end test
                }
            };
            const validations = {
                "2022-01-09T16:25:00.000Z": () => {
                    expect(emissionMethod.mock.calls.length).toBe(0);
                },
                "2022-01-09T16:45:00.000Z": () => {
                    expect(emissionMethod.mock.calls.length).toBe(1);
                    expect(emissionMethod.mock.calls[0][0].short.toLowerCase()).toBe("agdq2025");
                },
                "2022-01-09T17:55:00.000Z": () => {
                    expect(emissionMethod.mock.calls.length).toBe(1);
                    expect(emissionMethod.mock.calls[0][0].short.toLowerCase()).toBe("agdq2025");
                },
                "2022-01-09T18:05:00.000Z": () => {
                    expect(emissionMethod.mock.calls.length).toBe(2);
                    expect(emissionMethod.mock.calls[1][0].short.toLowerCase()).toBe("sgdq2025");
                },
            };
            const checkForEvents = (now) => {
                timeProvider.passTime(1000 * secondsPassingEachCheck);
                Object.keys(events).forEach(key => {
                    if (!moment(key).isBefore(now))
                    {
                        return;
                    }
                    events[key]();
                    delete events[key];
                });
            }
            const runValidations = (now) => {
                Object.keys(validations).forEach(key => {
                    if (!moment(key).isBefore(now))
                    {
                        return;
                    }
                    validations[key]();
                    delete validations[key];
                });
                jest.runAllTimers();
            }
            
            try
            {
                const promise = systemUnderTest.startLoop({beforeNextCheck: checkForEvents, afterEachCheck: runValidations});
                expect(systemUnderTest.startLoop({beforeNextCheck: checkForEvents, afterEachCheck: runValidations})).rejects.toThrow();
                await promise;
            }
            catch (e)
            {
                reject(e);
            }
        });
        
        await loopWithEvents;
        expect.hasAssertions();
    }, 5000);
})