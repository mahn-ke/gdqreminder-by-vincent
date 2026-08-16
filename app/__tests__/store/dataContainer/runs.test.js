import { FakeTimeProvider } from "../../../services/timeProvider/fakeTimeProvider";
import { FakeHTTPClient } from "../../stubs/fakeHTTPClient";
import { DataContainer } from "../../../store/dataContainer"
import { Twitch } from '../../../services/twitch.js'

describe("dataContainer", () => {
    const runIDs = {
        preShow: 5049,      // "2022-01-09T16:30:00Z" - "2022-01-09T17:07:00Z"
        firstRun: 5050,     // "2022-01-09T17:07:00Z" - "2022-01-09T18:53:00Z"
        secondRun: 5051,    // "2022-01-09T18:53:00Z" - "2022-01-09T20:50:00Z"
        thirdToLast: 5267,  // "2022-01-16T04:44:37Z" - "2022-01-16T05:27:03Z"
        secondToLast: 5185, // "2022-01-16T05:27:03Z" - "2022-01-16T06:51:23Z"
        last: 5186,         // "2022-01-16T06:51:23Z" - "2022-01-16T07:11:23Z"
    }
    
    describe("runs", () => {
        const pointsInTimeAndExpectedResponse = {
            // startup
            "2022-01-09T10:00:00Z": { // pre-show starts at 16:30
                "previous": null,
                "current": null,
                "next": ["preShow", runIDs.preShow]
            },
            "2022-01-09T16:30:00Z": { // pre-show starts at 16:30
                "previous": null,
                "current": ["preShow", runIDs.preShow],
                "next": ["firstRun", runIDs.firstRun]
            },
            "2022-01-09T17:06:00Z": { // next run starts at 17:07
                "previous": null,
                "current": ["preShow", runIDs.preShow],
                "next": ["firstRun", runIDs.firstRun]
            },
            "2022-01-09T17:07:00Z": { // next run has started at 17:07
                "previous": ["preShow", runIDs.preShow],
                "current": ["firstRun", runIDs.firstRun],
                "next": ["secondRun", runIDs.secondRun]
            },
            "2022-01-09T17:08:00Z": { // next run has started at 17:07
                "previous": ["preShow", runIDs.preShow],
                "current": ["firstRun", runIDs.firstRun],
                "next": ["secondRun", runIDs.secondRun]
            },

            // wind-down
            "2022-01-16T06:51:22Z": { // finale starts at 06:51:23
                "previous": ["thirdToLast", runIDs.thirdToLast],
                "current": ["secondToLast", runIDs.secondToLast],
                "next": ["last", runIDs.last]
            },
            "2022-01-16T06:51:23Z": { // finale starts at 06:51:23
                "previous": ["secondToLast", runIDs.secondToLast],
                "current": ["last", runIDs.last],
                "next": null
            },
            "2022-01-16T07:11:22Z": { // finale ends at 07:11:23
                "previous": ["secondToLast", runIDs.secondToLast],
                "current": ["last", runIDs.last],
                "next": null
            },
            "2022-01-16T07:11:23Z": { // finale ends at 07:11:23
                "previous": ["last", runIDs.last],
                "current": null,
                "next": null
            }
        };

        Object.entries(pointsInTimeAndExpectedResponse).forEach(([date, expectedResults]) => {
            describe("at "+date, () => {
                const fakeHTTPClient = new FakeHTTPClient("during-preshow");
                const timeProvider = new FakeTimeProvider(new Date(date));
                const dataContainer = new DataContainer(console, fakeHTTPClient, timeProvider, new Twitch(fakeHTTPClient, timeProvider), () => {}, () => {});

                Object.entries(expectedResults).forEach(([relativeTime, dataPair]) => {
                    // capitalize first letter of relativeTime
                    const relativeTimeCapitalized = relativeTime.charAt(0).toUpperCase() + relativeTime.slice(1);
                    const name = dataPair ? dataPair[0] : null;
                    const id = dataPair ? dataPair[1] : null;

                    test(`${relativeTimeCapitalized} run is ${name}`, async () => {
                        const relevantRun = await dataContainer[`get${relativeTimeCapitalized}Run`]();
                        if (id == null)
                        {
                            expect(relevantRun).toBeNull();
                            return;
                        }

                        
                        expect(relevantRun.id).toBe(id)
                    })
                });
            })
        });

        test("getting run to monitor without run coming up", async () => {
            const fakeHTTPClient = new FakeHTTPClient("during-preshow");
            const timeProvider = new FakeTimeProvider(new Date("2030-01-01"));
            const dataContainer = new DataContainer(console, fakeHTTPClient, timeProvider, new Twitch(fakeHTTPClient, timeProvider), () => {}, () => {});
            await dataContainer.getRunToMonitor();
            expect(await dataContainer.getRunToMonitor()).toBeNull();
        })
    });
});