import { expect, jest } from '@jest/globals';

const sendMock = jest.fn().mockResolvedValue('ok');

jest.unstable_mockModule('firebase-admin/messaging', () => ({
  getMessaging: () => ({ send: sendMock }),
}));

const { default: Firebase } = await import('../../messaging/firebase.js');

describe('Firebase.sendRunAddedNotification', () => {
  beforeEach(() => {
    sendMock.mockClear();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-09T01:31:07.729Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses run.startTime to compute relative hours', async () => {
    const logger = { info: jest.fn(), error: jest.fn() };
    const firebase = new Firebase(logger);

    firebase.sendRunAddedNotification({
      id: 7738,
      display_name: 'EarthBound Beginnings',
      startTime: '2026-07-09T02:07:00.000Z',
    });

    await Promise.resolve();

    expect(sendMock).toHaveBeenCalledTimes(1);

    const sentMessage = sendMock.mock.calls[0][0];
    expect(sentMessage.notification.body).toContain('Starting in 1 hour');
    expect(sentMessage.notification.body).not.toContain('NaN');
  });

  it('uses absolute time and day when start is more than 48 hours away', async () => {
    const logger = { info: jest.fn(), error: jest.fn() };
    const firebase = new Firebase(logger);

    firebase.sendRunAddedNotification({
      id: 7740,
      display_name: 'Super Metroid',
      startTime: '2026-07-12T17:05:00.000Z',
    });

    await Promise.resolve();

    expect(sendMock).toHaveBeenCalledTimes(1);

    const sentMessage = sendMock.mock.calls[0][0];
    expect(sentMessage.notification.body).toMatch(/^Starting at \d{1,2}:\d{2} [AP]M on [A-Za-z]+ - set a reminder now!$/);
    expect(sentMessage.notification.body).not.toContain('Starting in');
  });
});
