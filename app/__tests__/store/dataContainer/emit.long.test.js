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
        describe("long", () => {
            test("[LONG] full event cycle", async () => {
                const timeProvider = new FakeTimeProvider(new Date("2022-01-01T00:00:00Z"));
                const emissionMethod = jest.fn();
                const fakeHTTPClient = new FakeHTTPClient("during-pumpkin_jack");
                const dataContainer = new DataContainer(stubLogger, fakeHTTPClient, timeProvider, new Twitch(fakeHTTPClient, timeProvider), emissionMethod, () => {});
                await dataContainer.getRunToMonitor();

                const bufferInMinutes = 30;
                const eventShorts = [37, 39];
                for (let j = 0; j < eventShorts.length; ++j)
                {
                    const eventShort = eventShorts[j];
                    const event = await dataContainer.getEvent(eventShort);
                    const eventStartTime = moment(event.startTime).subtract(bufferInMinutes, "minutes");
                    const eventEndTime = moment(event.endTime).add(bufferInMinutes, "minutes");

                    const duration = moment.duration(eventEndTime.diff(eventStartTime));
                    const minutesInAGDQ = Math.ceil(duration.asMinutes());

                    timeProvider.setTime(eventStartTime.valueOf());
                    for (let i = 0; i < minutesInAGDQ; ++i)
                    {
                        timeProvider.passTime(60 * 1000);
                        await dataContainer.checkFor10MinuteWarning();
                        await dataContainer.checkTwitch();
                    }
                    expect(emissionMethod.mock.calls.length).toBe(event.runsInOrder.length);
                    const pumpkinJackRunIndex = emissionMethod.mock.calls.findIndex(call => call[0].display_name.includes("Pumpkin Jack"));
                    if (pumpkinJackRunIndex != -1)
                    {
                        expect(emissionMethod.mock.calls[pumpkinJackRunIndex][1]).toBe(DataContainer.EmitReasons.TwitchDataMatch);
                        emissionMethod.mock.calls.splice(pumpkinJackRunIndex, 1);
                    }
                    emissionMethod.mock.calls.forEach(call => {
                        expect(call[1]).toBe(DataContainer.EmitReasons.StartInLessThanTenMinutes);
                    });
                    emissionMethod.mock.calls = [];
                }

            });
        })
    });
});