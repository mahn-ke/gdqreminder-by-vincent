import { FakeTimeProvider } from "../../../services/timeProvider/fakeTimeProvider";
import { FakeHTTPClient } from "../../stubs/fakeHTTPClient";
import { DataContainer } from "../../../store/dataContainer"
import { jest } from '@jest/globals'
import { Twitch } from '../../../services/twitch.js'

const stubLogger = {
    info: jest.fn()
};

describe("dataContainer", () => {
    describe("runadded", () => {
        it("emits only when new run is added to current event, while at least one run was previously present", async () => {
            const timeA = "2022-01-09T16:55:00Z";
            const timeB = "2022-01-09T17:00:00Z";
            const timeC = "2022-01-09T17:05:00Z";

            const fakeTimeProvider = new FakeTimeProvider(new Date(timeA));
            const emissionMethod = jest.fn();
            const fakeHTTPClient = new FakeHTTPClient("during-preshow");
            const dataContainer = new DataContainer(
                stubLogger,
                fakeHTTPClient,
                fakeTimeProvider,
                new Twitch(fakeHTTPClient, fakeTimeProvider),
                () => { },
                {},
                emissionMethod
            );

            await dataContainer.checkFor10MinuteWarning();
            await dataContainer.checkTwitch();
            expect(emissionMethod.mock.calls.length).toBe(0);

            fakeTimeProvider.setTime(new Date(timeB));
            fakeHTTPClient.setPrefix("after-preshow-new-run-added");
            await dataContainer.checkFor10MinuteWarning();
            await dataContainer.checkTwitch();
            expect(emissionMethod.mock.calls.length).toBe(1);
            expect(emissionMethod.mock.calls[0][0].display_name).toBe("New Run");
            expect(emissionMethod.mock.calls[0][0].name).toBe("New Run");
            expect(emissionMethod.mock.calls[0][0].startTime).toStrictEqual(new Date("2022-01-09T17:53:00Z"));
            expect(emissionMethod.mock.calls[0][0].endTime).toStrictEqual(new Date("2022-01-09T18:53:00Z"));

            fakeTimeProvider.setTime(new Date(timeC));
            await dataContainer.checkFor10MinuteWarning();
            await dataContainer.checkTwitch();
            expect(emissionMethod.mock.calls.length).toBe(1);
        });
    });
});