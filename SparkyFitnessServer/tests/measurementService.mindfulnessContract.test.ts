import { beforeEach, describe, expect, it, vi } from 'vitest';
import measurementService from '../services/measurementService.js';
import * as mindfulnessRepository from '../models/mindfulnessRepository.js';
import { loadUserTimezone } from '../utils/timezoneLoader.js';

vi.mock('../utils/timezoneLoader.js', () => ({
  loadUserTimezone: vi.fn(),
}));
vi.mock('../models/measurementRepository');
vi.mock('../models/userRepository');
vi.mock('../models/exercise');
vi.mock('../models/exerciseEntry');
vi.mock('../models/sleepRepository');
vi.mock('../models/waterContainerRepository');
vi.mock('../models/activityDetailsRepository');
vi.mock('../models/foodRepository');
vi.mock('../models/mindfulnessRepository.js', () => ({
  createMindfulnessSession: vi.fn(),
}));

// The mobile app sends a Health Connect mindfulness session (Medito and the
// like) as an instant plus its recording offset, with no day string, and the
// record's own Health Connect id for idempotent re-sync.
const healthConnectSession = (overrides: Record<string, unknown> = {}) => ({
  type: 'MindfulnessSession',
  source: 'Health Connect',
  source_id: 'hc-1',
  timestamp: '2026-10-20T14:30:00.000Z',
  startTime: '2026-10-20T14:30:00.000Z',
  endTime: '2026-10-20T14:45:00.000Z',
  duration_seconds: 900,
  session_type: 'meditation',
  record_utc_offset_minutes: 540,
  ...overrides,
});

describe('Health Connect mindfulness sessions through processHealthData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadUserTimezone).mockResolvedValue('UTC');
    vi.mocked(mindfulnessRepository.createMindfulnessSession).mockResolvedValue(
      {} as Awaited<
        ReturnType<typeof mindfulnessRepository.createMindfulnessSession>
      >
    );
  });

  it('stores a Health Connect mindfulness session under its own provider and id, on its local start day', async () => {
    const result = await measurementService.processHealthData(
      [healthConnectSession()],
      'user-1',
      'user-1'
    );

    expect(result.errors).toEqual([]);
    expect(mindfulnessRepository.createMindfulnessSession).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        entry_date: '2026-10-20',
        provider: 'Health Connect',
        external_id: 'hc-1',
        duration_seconds: 900,
        session_type: 'meditation',
        start_time: '2026-10-20T14:30:00.000Z',
        end_time: '2026-10-20T14:45:00.000Z',
      }),
      'user-1'
    );
  });

  it("stays on the record's local day across midnight UTC", async () => {
    await measurementService.processHealthData(
      [
        healthConnectSession({
          timestamp: '2026-10-20T16:30:00.000Z',
          startTime: '2026-10-20T16:30:00.000Z',
          endTime: '2026-10-20T16:45:00.000Z',
        }),
      ],
      'user-1',
      'user-1'
    );

    // 16:30 UTC is 01:30 on the 21st at +09:00.
    expect(mindfulnessRepository.createMindfulnessSession).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ entry_date: '2026-10-21' }),
      'user-1'
    );
  });
});
