import { FakeTimeProvider } from "../../../services/timeProvider/fakeTimeProvider";
import { FakeHTTPClient } from "../../stubs/fakeHTTPClient";
import { DataContainer } from "../../../store/dataContainer"
import moment from 'moment';
import { jest } from '@jest/globals'
import { Twitch } from '../../../services/twitch.js'

const stubLogger = {
    info: jest.fn()
};

describe("dataContainer", () => {
    describe("emit", () => {
        it("never informs when initially updating", async () => {
            const times = [
                "2022-01-09T16:20:00Z", // 10 minutes before the pre-show,
                "2022-01-09T16:40:00Z", // 10 minutes into the pre-show
                "2022-01-16T07:21:23Z", // 10 minutes after the finale of AGDQ2022
            ]
            
            for await(const time of times) {
                const timeProvider = new FakeTimeProvider(new Date(time));
                const emissionMethod = jest.fn();
                const httpClient = new FakeHTTPClient("during-pumpkin_jack")
                const dataContainer = new DataContainer(stubLogger, httpClient, timeProvider, new Twitch(httpClient, timeProvider), emissionMethod, () => {});
    
                await dataContainer.checkFor10MinuteWarning();
                expect(emissionMethod.mock.calls.length).toBe(0);
            };
        })

        const triggerInformationEvent = {
            "if a run start is less than 10 minutes away": async (dataContainer, timeProvider, fakeHTTPClient, emissionMethod, skipValidation = false) => {
                const previousCallCount = emissionMethod.mock.calls.length;
                const pumpkinJackStart = moment("2022-01-11T04:28:00Z");

                timeProvider.setTime(new Date(pumpkinJackStart.clone().subtract(20, 'minutes').toISOString()).getTime());
                await dataContainer.checkFor10MinuteWarning();
                timeProvider.setTime(new Date(pumpkinJackStart.clone().subtract(11, 'minutes').toISOString()));
                await dataContainer.checkFor10MinuteWarning();
                timeProvider.setTime(new Date(pumpkinJackStart.clone().subtract(9, 'minutes').subtract(59, 'seconds').toISOString()));
                await dataContainer.checkFor10MinuteWarning();
                if (!skipValidation)
                {
                    expect(emissionMethod.mock.calls.length).toBe(previousCallCount+1);
                    expect(emissionMethod.mock.calls[previousCallCount][0].id).toBe(5083);
                    expect(emissionMethod.mock.calls[previousCallCount][1]).toBe(DataContainer.EmitReasons.StartInLessThanTenMinutes);
                }
            },
            "if the game on twitch matches the name of the next run": async (dataContainer, timeProvider, fakeHTTPClient, emissionMethod, skipValidation = false) => {
                const previousCallCount = emissionMethod.mock.calls.length;

                const pumpkinJackStart = moment("2022-01-11T04:28:00Z");
                const finaleStart = moment("2022-01-16T06:51:23Z");

                timeProvider.setTime(new Date(pumpkinJackStart.clone().subtract(11, 'minutes').toISOString()).getTime());
                await dataContainer.checkTwitch();
                if (!skipValidation)
                {
                    expect(emissionMethod.mock.calls.length).toBe(previousCallCount+1);
                    expect(emissionMethod.mock.calls[previousCallCount][0].id).toBe(5083);
                    expect(emissionMethod.mock.calls[previousCallCount][1]).toBe(DataContainer.EmitReasons.TwitchDataMatch);
                }
                timeProvider.setTime(new Date(finaleStart.clone().subtract(11, 'minutes').toISOString()).getTime());
                await dataContainer.checkTwitch();
                if (!skipValidation)
                {
                    expect(emissionMethod.mock.calls.length).toBe(previousCallCount+1);
                    expect(emissionMethod.mock.calls[previousCallCount][0].id).toBe(5083);
                    expect(emissionMethod.mock.calls[previousCallCount][1]).toBe(DataContainer.EmitReasons.TwitchDataMatch);
                }
                timeProvider.setTime(new Date(pumpkinJackStart.clone().subtract(11, 'minutes').toISOString()).getTime());
                await dataContainer.checkTwitch();
                if (!skipValidation)
                {
                    expect(emissionMethod.mock.calls.length).toBe(previousCallCount+1);
                    expect(emissionMethod.mock.calls[previousCallCount][0].id).toBe(5083);
                    expect(emissionMethod.mock.calls[previousCallCount][1]).toBe(DataContainer.EmitReasons.TwitchDataMatch);
                }
            },
            "if the previous run has a changed end time": async (dataContainer, timeProvider, fakeHTTPClient, emissionMethod, skipValidation = false) => {
                const previousCallCount = emissionMethod.mock.calls.length;
                const pumpkinJackStart = moment("2022-01-11T04:28:00Z");

                timeProvider.setTime(new Date(pumpkinJackStart.clone().subtract(15, "minutes").toISOString()).getTime());
                await dataContainer.checkFor10MinuteWarning();
                
                fakeHTTPClient.setPrefix("run-before-pumpkin_jack-ended-20-minutes-earlier");

                timeProvider.setTime(new Date(pumpkinJackStart.clone().subtract(15, "minutes").add(10, "seconds").toISOString()).getTime());
                await dataContainer.checkFor10MinuteWarning();
                if (!skipValidation)
                {
                    expect(emissionMethod.mock.calls.length).toBe(previousCallCount+1);
                    expect(emissionMethod.mock.calls[previousCallCount][0].id).toBe(5083);
                    expect(emissionMethod.mock.calls[previousCallCount][1]).toBe(DataContainer.EmitReasons.StartInLessThanTenMinutes);
                }
            }
        };

        describe("will emit", () => {
            Object.entries(triggerInformationEvent).forEach(([description, logic]) => {
                it(`emits ${description}`, async () => {
                    const timeProvider = new FakeTimeProvider(new Date());
                    const emissionMethod = jest.fn();
                    const fakeHTTPClient = new FakeHTTPClient("during-pumpkin_jack");
                    const dataContainer = new DataContainer(stubLogger, fakeHTTPClient, timeProvider, new Twitch(fakeHTTPClient, timeProvider), emissionMethod, () => {});
                    await dataContainer.getRunToMonitor();

                    await logic(dataContainer, timeProvider, fakeHTTPClient, emissionMethod);
                });
            });
        })

        describe("only emits once per run", () => {
            Object.entries(triggerInformationEvent).forEach(([description1, logic1]) => {
                Object.entries(triggerInformationEvent).forEach(([description2, logic2]) => {
                    it(`emits '${description1}', ignores '${description2}' after`, async () => {
                        const timeProvider = new FakeTimeProvider(new Date());
                        const emissionMethod = jest.fn();
                        const fakeHTTPClient = new FakeHTTPClient("during-pumpkin_jack");
                        const dataContainer = new DataContainer(stubLogger, fakeHTTPClient, timeProvider, new Twitch(fakeHTTPClient, timeProvider), emissionMethod, () => {});
                        await dataContainer.getRunToMonitor();
    
                        await logic1(dataContainer, timeProvider, fakeHTTPClient, emissionMethod);
                        const callCount = emissionMethod.mock.calls.length;
                        await logic2(dataContainer, timeProvider, fakeHTTPClient, emissionMethod, true);
                        expect(emissionMethod.mock.calls.length).toBe(callCount);
                    });
                });
            });
        })

        it("never emits based on twitch title for first run", async () => {
            let events = [
                {
                    timeA: "2022-01-09T14:30:00Z",
                    httpA: "skips-twitch-for-first-run/0-agdq2022-before-preshow",
                    timeB: "2022-01-09T16:45:00Z",
                    httpB: "skips-twitch-for-first-run/1-agdq2022-twitch-game-is-nioh2",
                    timeC: "2022-01-09T16:50:00Z",
                },
                {
                    timeA: "2022-06-26T15:00:00Z",
                    httpA: "skips-twitch-for-first-run/2-sgdq2022-without-preshow",
                    timeB: "2022-06-26T17:15:00Z",
                    httpB: "skips-twitch-for-first-run/3-sgdq2022-twitch-game-is-sonic-generations",
                    timeC: "2022-06-26T17:20:00Z",
                },
            ];
            for (const index in events)
            {
                const {timeA, httpA, timeB, httpB, timeC} = events[index];
                const twentyMinutesBeforeAGDQ = new FakeTimeProvider(new Date(timeA));
                const emissionMethod = jest.fn();
                const fakeHTTPClient = new FakeHTTPClient(httpA);
                const dataContainer = new DataContainer(stubLogger, fakeHTTPClient, twentyMinutesBeforeAGDQ, new Twitch(fakeHTTPClient, twentyMinutesBeforeAGDQ), emissionMethod, () => {});
                await dataContainer.checkFor10MinuteWarning();
                await dataContainer.checkTwitch();
    
                expect(emissionMethod.mock.calls.length).toBe(0);
                twentyMinutesBeforeAGDQ.setTime(new Date(timeB))
                await dataContainer.checkFor10MinuteWarning();
                await dataContainer.checkTwitch();
    
                expect(emissionMethod.mock.calls.length).toBe(1);
                expect(emissionMethod.mock.calls[0][1]).toBe(DataContainer.EmitReasons.StartInLessThanTenMinutes);
    
                fakeHTTPClient.setPrefix(httpB);
                twentyMinutesBeforeAGDQ.setTime(new Date(timeC))
                await dataContainer.checkFor10MinuteWarning();
                await dataContainer.checkTwitch();
    
                expect(emissionMethod.mock.calls.length).toBe(2);
                expect(emissionMethod.mock.calls[1][1]).toBe(DataContainer.EmitReasons.TwitchDataMatch);
            }
        });
    });
});