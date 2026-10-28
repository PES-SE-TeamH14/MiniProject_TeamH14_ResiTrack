const mockSchedule = jest.fn(() => ({ stop: jest.fn() }));
const mockValidate = jest.fn(() => true);
jest.mock('node-cron', () => ({ schedule: mockSchedule, validate: mockValidate }), { virtual: true });

const { startReminderScheduler } = require('../src/services/reminderScheduler');

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  mockSchedule.mockClear();
  mockValidate.mockClear().mockReturnValue(true);
  process.env = { ...ORIGINAL_ENV, NODE_ENV: 'development' };
  delete process.env.REMINDER_CRON;
  delete process.env.REMINDER_TIMEZONE;
  delete process.env.REMINDERS_ENABLED;
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  jest.restoreAllMocks();
});

describe('startReminderScheduler (FR-07)', () => {
  it('schedules the job every day at 09:00 India time by default', () => {
    expect(startReminderScheduler()).not.toBeNull();
    expect(mockSchedule).toHaveBeenCalledWith('0 9 * * *', expect.any(Function), { timezone: 'Asia/Kolkata' });
  });

  it('uses the schedule and time zone from the environment', () => {
    process.env.REMINDER_CRON = '*/5 * * * *';
    process.env.REMINDER_TIMEZONE = 'UTC';
    startReminderScheduler();
    expect(mockSchedule).toHaveBeenCalledWith('*/5 * * * *', expect.any(Function), { timezone: 'UTC' });
  });

  it('does not start under test or when switched off', () => {
    process.env.NODE_ENV = 'test';
    expect(startReminderScheduler()).toBeNull();

    process.env.NODE_ENV = 'development';
    process.env.REMINDERS_ENABLED = 'false';
    expect(startReminderScheduler()).toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('does not start with an invalid cron expression', () => {
    mockValidate.mockReturnValue(false);
    process.env.REMINDER_CRON = 'not a cron';
    expect(startReminderScheduler()).toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});
