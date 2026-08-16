import { FakeHTTPClient, PrefixEmptyError } from '../../stubs/fakeHTTPClient';

describe("FakeHTTPClient", () => {
    test(`[EVENTS] can read files`, async () => {
        const request = new FakeHTTPClient("during-preshow").get("https://tracker.gamesdonequick.com/tracker/api/v2/events");
        const content = await request.json();
        expect(content.count).toBe(36);
    });

    const events = {
        35: 153,
        37: 149,
        39: 136,
    };
    Object.entries(events).forEach(([eventID, runCount]) => {
        test(`[${eventID}] can read files`, async () => {
            const request = new FakeHTTPClient("during-preshow").get("https://tracker.gamesdonequick.com/tracker/api/v2/events/" + eventID + "/runs/");
            const content = await request.json();
            expect(content.count).toBe(runCount);
        });
    });

    test(`can set folder prefix`, async () => {
        const client = new FakeHTTPClient("httpClientTest/1");
        expect(await client.get("https://google.com").json()).toBe(1);
        client.setPrefix("httpClientTest/2");
        expect(await client.get("https://google.com").json()).toBe(2);
    })

    test(`throws if no error prefix is set`, () => {
        expect(() => new FakeHTTPClient("")).toThrow(new PrefixEmptyError());
        expect(() => new FakeHTTPClient("httpClientTest").setPrefix("")).toThrow(new PrefixEmptyError());
    })
    
})