import { jest } from '@jest/globals'
import { FakeTimeProvider } from '../../../services/timeProvider/fakeTimeProvider.js';
import { EventTracker } from '../../../store/eventTracker.js';
import { FakeHTTPClient } from '../../stubs/fakeHTTPClient.js';

const tenMinutesBeforeAGDQ2025 = "2022-01-09T16:00:00Z";

describe("eventTracker", () => {
    ["broken-event-api", "empty-event-api"].forEach(apiType => {
        it(`never emits while GDQ API is '${apiType}'`, async () => {
            const stubLogger = {
                info: jest.fn(),
                error: jest.fn()
            };

            const emissionMethod = jest.fn();
            const timeProvider = new FakeTimeProvider(new Date(tenMinutesBeforeAGDQ2025).getTime());
            const fakeHTTPClient = new FakeHTTPClient(apiType);
            let checkCount = 0;

            const systemUnderTest = new EventTracker(stubLogger, fakeHTTPClient, timeProvider, emissionMethod);
            await systemUnderTest.startLoop({
                afterEachCheck: () => {
                    checkCount++;
                    if (checkCount !== 3) {
                        return;
                    }
                    systemUnderTest.stopLoop();
                }
            });
            expect(emissionMethod.mock.calls.length).toBe(0);
            expect(stubLogger.error.mock.calls.length).toBe(3);
        });
    });
});
