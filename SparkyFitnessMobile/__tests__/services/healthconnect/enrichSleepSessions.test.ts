import { readRecords } from 'react-native-health-connect';
import { enrichSleepSessions } from '../../../src/services/healthconnect';
import { postProcessRaw } from '../../../src/services/healthconnect/provider';
import { createTelemetryRunContext } from '../../../src/services/shared/telemetryBudget';
import { atLocalTime } from '../../helpers/localTime';

jest.mock('../../../src/services/LogService', () => ({
  addLog: jest.fn(),
}));

const mockReadRecords = readRecords as jest.Mock;

type ReadOutcome = { records: unknown[] } | Error;

const setReads = (outcomes: {
  HeartRateVariabilityRmssd?: ReadOutcome;
  RestingHeartRate?: ReadOutcome;
}) => {
  mockReadRecords.mockImplementation(async (recordType: string) => {
    const outcome = outcomes[recordType as keyof typeof outcomes];
    if (outcome instanceof Error) throw outcome;
    return outcome ?? { records: [] };
  });
};

const hrv = (day: string, time: string, value: number) => ({
  time: atLocalTime(day, time),
  heartRateVariabilityMillis: value,
});
const rhr = (day: string, time: string, value: number) => ({
  time: atLocalTime(day, time),
  beatsPerMinute: value,
});

const mainSleep = () => ({
  startTime: atLocalTime('2026-10-14', '23:00'),
  endTime: atLocalTime('2026-10-15', '07:00'),
});
const nap = () => ({
  startTime: atLocalTime('2026-10-15', '13:00'),
  endTime: atLocalTime('2026-10-15', '13:20'),
});

const enrich = (records: unknown[]) =>
  enrichSleepSessions(records, createTelemetryRunContext()) as Promise<
    Record<string, unknown>[]
  >;

describe('enrichSleepSessions', () => {
  beforeEach(() => {
    mockReadRecords.mockReset();
  });

  test('averages only HRV readings inside the session window', async () => {
    setReads({
      HeartRateVariabilityRmssd: {
        records: [
          hrv('2026-10-15', '01:00', 40),
          hrv('2026-10-15', '03:00', 44),
          hrv('2026-10-15', '14:00', 90),
        ],
      },
    });
    const [session] = await enrich([mainSleep()]);
    expect(session.avg_overnight_hrv).toBe(42);
    expect(session.resting_heart_rate).toBeUndefined();
  });

  test('uses the latest resting heart rate on the wake day', async () => {
    setReads({
      RestingHeartRate: {
        records: [
          rhr('2026-10-15', '06:00', 60),
          rhr('2026-10-15', '09:00', 57),
        ],
      },
    });
    const [session] = await enrich([mainSleep()]);
    expect(session.resting_heart_rate).toBe(57);
  });

  test('puts the main sleep values on a nap from the same wake day', async () => {
    setReads({
      HeartRateVariabilityRmssd: {
        records: [
          hrv('2026-10-15', '01:00', 40),
          hrv('2026-10-15', '03:00', 44),
          hrv('2026-10-15', '13:10', 90),
        ],
      },
      RestingHeartRate: { records: [rhr('2026-10-15', '09:00', 57)] },
    });
    const result = await enrich([nap(), mainSleep()]);
    for (const session of result) {
      expect(session.avg_overnight_hrv).toBe(42);
      expect(session.resting_heart_rate).toBe(57);
    }
  });

  test('a failed HRV read leaves HRV unset but keeps resting heart rate', async () => {
    setReads({
      HeartRateVariabilityRmssd: new Error('permission denied'),
      RestingHeartRate: { records: [rhr('2026-10-15', '09:00', 57)] },
    });
    const [session] = await enrich([mainSleep()]);
    expect(session.avg_overnight_hrv).toBeUndefined();
    expect(session.resting_heart_rate).toBe(57);
  });

  test('returns records unchanged when both reads fail', async () => {
    setReads({
      HeartRateVariabilityRmssd: new Error('denied'),
      RestingHeartRate: new Error('denied'),
    });
    const input = [mainSleep()];
    const result = await enrich(input);
    expect(result).toEqual([mainSleep()]);
    expect(result[0]).not.toHaveProperty('avg_overnight_hrv');
    expect(result[0]).not.toHaveProperty('resting_heart_rate');
  });

  test('postProcessRaw enriches SleepSession records', async () => {
    setReads({
      HeartRateVariabilityRmssd: { records: [hrv('2026-10-15', '02:00', 50)] },
    });
    const result = (await postProcessRaw(
      { recordType: 'SleepSession' },
      [mainSleep()],
      createTelemetryRunContext()
    )) as Record<string, unknown>[];
    expect(result[0].avg_overnight_hrv).toBe(50);
  });
});
