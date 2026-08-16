import { RealTimeProvider } from "../../../services/timeProvider/realTimeProvider";

describe("RealTimeProvider", () => {
    test('real time has a drift of less than 1000ms', () => {
        const provider = new RealTimeProvider();
        const startTime = provider.getCurrent();
        const currentTime = new Date().getTime();

        expect(currentTime - startTime).toBeLessThan(1000);
    });
})
