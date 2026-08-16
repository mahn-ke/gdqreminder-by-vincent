import { FakeTimeProvider } from "../../../services/timeProvider/fakeTimeProvider";
import { FakeHTTPClient } from "../../stubs/fakeHTTPClient";
import { DataContainer } from "../../../store/dataContainer"
import { Twitch } from '../../../services/twitch.js'

describe("dataContainer", () => {
    describe("relativeEvents", () => {
        const pointsInTimeAndExpectedResponse = {
            "2010-01-01": { // before CGDQ with no previous event
                "previous": null,
                "current": null,
                "next": "CGDQ"
            },
            "2022-01-01": { // before AGDQ2022 with SGDQ2022 already scheduled afterwards
                "previous": "SGDQ2021",
                "current": null,
                "next": "AGDQ2022"
            },
            "2022-01-11": { // during AGDQ2022 with SGDQ2022 already scheduled afterwards
                "previous": "SGDQ2021",
                "current": "AGDQ2022",
                "next": "SGDQ2022"
            },
            "2022-01-30": { // after  AGDQ2022 with SGDQ2022 already scheduled afterwards
                "previous": "AGDQ2022",
                "current": null,
                "next": "SGDQ2022"
            },
            
            // identical to "2022-01-30" but with a different order of keys
            "2022-01-31": { // after  AGDQ2022 with SGDQ2022 already scheduled afterwards
                "current": null,
                "previous": "AGDQ2022",
                "next": "SGDQ2022"
            },
            // identical to "2022-01-30" but with a different order of keys
            "2022-02-01": { // after  AGDQ2022 with SGDQ2022 already scheduled afterwards
                "next": "SGDQ2022",
                "previous": "AGDQ2022",
                "current": null,
            },

            "2022-06-14": { // before SGDQ2022 with no new event scheduled
                "previous": "AGDQ2022",
                "current": null,
                "next": "SGDQ2022"
            },
            "2022-06-30": { // during SGDQ2022 with no new event scheduled
                "previous": "AGDQ2022",
                "current": "SGDQ2022",
                "next": null
            },
            "2022-08-14": { // after  SGDQ2022 with no new event scheduled
                "previous": "SGDQ2022",
                "current": null,
                "next": null
            } 
        };

        Object.entries(pointsInTimeAndExpectedResponse).forEach(([date, expectedResults]) => {
            describe("at "+date, () => {
                const fakeHTTPClient = new FakeHTTPClient("during-preshow")
                const timeProvider = new FakeTimeProvider(new Date(date));
                const dataContainer = new DataContainer(console, fakeHTTPClient, timeProvider, new Twitch(fakeHTTPClient, timeProvider), () => {}, () => {});

                Object.entries(expectedResults).forEach(([relativeTime, result]) => {
                    // capitalize first letter of relativeTime
                    const relativeTimeCapitalized = relativeTime.charAt(0).toUpperCase() + relativeTime.slice(1);
                    const lowercaseShort = result?.toLowerCase();

                    test(`${relativeTimeCapitalized} event is ${lowercaseShort}`, async () => {
                        if (lowercaseShort == null)
                        {
                            expect(await dataContainer[`get${relativeTimeCapitalized}Event`]()).toBeNull();
                            return;
                        }

                        
                        expect((await dataContainer[`get${relativeTimeCapitalized}Event`]()).short).toBe(lowercaseShort)
                    })
                });
            })
        });
    });

    describe("relevantEvent", () => {
        const timeProvider = new FakeTimeProvider(new Date());
        const fakeHTTPClient = new FakeHTTPClient("during-preshow")
        const dataContainer = new DataContainer(console, fakeHTTPClient, timeProvider, new Twitch(fakeHTTPClient, timeProvider), () => {}, () => {});
        test("relevantEvent returns current event if we are mid event", async () => {
            const duringAGDQ2022 = new Date("2022-01-11T17:07:00Z");
            const duringSGDQ2022 = new Date("2022-06-30T17:07:00Z");

            timeProvider.setTime(duringAGDQ2022);
            expect((await dataContainer.getRelevantEvent()).short).toBe("agdq2022");
            timeProvider.setTime(duringSGDQ2022);
            expect((await dataContainer.getRelevantEvent()).short).toBe("sgdq2022");
        });
        test("relevantEvent returns previous event if no new event is scheduled yet", async () => {
            const afterSGDQ2022 = new Date("2022-08-14T17:07:00Z");

            timeProvider.setTime(afterSGDQ2022);
            expect((await dataContainer.getRelevantEvent()).short).toBe("sgdq2022");
        })
        test("relevantEvent returns next event if time is closer to next event than previous event", async () => {
            const afterAGDQ2022 = new Date("2022-04-06T23:50:41.999");
            const beforeSGDQ2022 = new Date("2022-04-06T23:50:42.000Z");

            timeProvider.setTime(afterAGDQ2022);
            expect((await dataContainer.getRelevantEvent()).short).toBe("agdq2022");
            timeProvider.setTime(beforeSGDQ2022);
            expect((await dataContainer.getRelevantEvent()).short).toBe("sgdq2022");
        })
    })
});