import { RealTimeProvider } from "../../../services/timeProvider/realTimeProvider";
import { FakeTimeProvider } from "../../../services/timeProvider/fakeTimeProvider";

describe("FakeTimeProvider", () => {
    describe("compared to RealTimeProvider", () => {
        test('can move faster than real time provider', async () => {
            const realTimeProvider = new RealTimeProvider();
            const realTime = realTimeProvider.getCurrent();

            const fakeTimeProvider = new FakeTimeProvider(realTime.getTime());
            await new Promise(resolve => setTimeout(resolve, 1000));

            fakeTimeProvider.passTime(5 * 1000);
            expect(fakeTimeProvider.getCurrent().getTime()).toBeGreaterThan(realTimeProvider.getCurrent().getTime());
        });

        test('can move slower than real time provider', async () => {
            const realTimeProvider = new RealTimeProvider();
            const realTime = realTimeProvider.getCurrent();

            const fakeTimeProvider = new FakeTimeProvider(realTime.getTime());
            await new Promise(resolve => setTimeout(resolve, 1000));

            fakeTimeProvider.passTime(0.5 * 1000);
            expect(fakeTimeProvider.getCurrent().getTime()).toBeLessThan(realTimeProvider.getCurrent().getTime());
        });
    })

    describe("core functionality", () => {
        const firstOfJanuary2000 = new Date(2000, 0, 1);

        test('throws if initialized with a string', async () => {
            expect(() => {
                new FakeTimeProvider(firstOfJanuary2000.toISOString());
            }).toThrow(new Error("Start time should be in ms as number"));
        });

        test('does not progress on its own', async () => {
            const fakeTimeProvider = new FakeTimeProvider(firstOfJanuary2000.getTime());
            
            expect(fakeTimeProvider.getCurrent()).toEqual(firstOfJanuary2000);
            await new Promise(resolve => setTimeout(resolve, 1000));
            expect(fakeTimeProvider.getCurrent()).toEqual(firstOfJanuary2000);
            await new Promise(resolve => setTimeout(resolve, 1000));
            expect(fakeTimeProvider.getCurrent()).toEqual(firstOfJanuary2000);
        });

        test('can move forwards in time by specified amount', async () => {
            const fakeTimeProvider = new FakeTimeProvider(firstOfJanuary2000.getTime());
            
            expect(fakeTimeProvider.getCurrent()).toEqual(firstOfJanuary2000);
            let currentOffset = 0;
            const timeIntervals = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
            timeIntervals.forEach(timeInterval => {
                currentOffset += timeInterval;
                fakeTimeProvider.passTime(timeInterval);
                expect(fakeTimeProvider.getCurrent().getTime()).toEqual(firstOfJanuary2000.getTime() + currentOffset);
            });
        });

        test('can set time directly', async () => {
            const fakeTimeProvider = new FakeTimeProvider(firstOfJanuary2000.getTime());
            
            expect(fakeTimeProvider.getCurrent()).toEqual(firstOfJanuary2000);
            const timeIntervals = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
            timeIntervals.forEach(timeInterval => {
                fakeTimeProvider.setTime(firstOfJanuary2000.getTime() + timeInterval);
                expect(fakeTimeProvider.getCurrent().getTime()).toEqual(firstOfJanuary2000.getTime() + timeInterval);
            });
        });

        test('setting time resets previously passed time', async () => {
            const fakeTimeProvider = new FakeTimeProvider(firstOfJanuary2000.getTime());
            
            expect(fakeTimeProvider.getCurrent()).toEqual(firstOfJanuary2000);
            const timeIntervals = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
            timeIntervals.forEach(timeInterval => {
                fakeTimeProvider.setTime(firstOfJanuary2000.getTime());
                fakeTimeProvider.passTime(timeInterval);
                expect(fakeTimeProvider.getCurrent().getTime()).toEqual(firstOfJanuary2000.getTime() + timeInterval);
            });
        });
    })

})
