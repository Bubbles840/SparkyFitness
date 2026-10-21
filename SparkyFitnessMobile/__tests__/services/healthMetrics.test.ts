import { HEALTH_METRICS, metricReadKind } from '../../src/HealthMetrics';

describe('metricReadKind', () => {
  test('exactly the six day-aggregated metrics declare readKind cumulative-day', () => {
    const cumulative = HEALTH_METRICS.filter(
      (metric) => metricReadKind(metric) === 'cumulative-day'
    )
      .map((metric) => metric.recordType)
      .sort();

    expect(cumulative).toEqual([
      'ActiveCaloriesBurned',
      'BasalMetabolicRate',
      'Distance',
      'FloorsClimbed',
      'Steps',
      'TotalCaloriesBurned',
    ]);
  });

  test('derives min-max-avg-day from the aggregation strategy', () => {
    expect(metricReadKind({ aggregationStrategy: 'min-max-avg' })).toBe(
      'min-max-avg-day'
    );
    const heartRate = HEALTH_METRICS.find(
      (metric) => metric.recordType === 'HeartRate'
    );
    expect(metricReadKind(heartRate!)).toBe('min-max-avg-day');
  });

  test('defaults to raw for everything else, including sum/last strategies', () => {
    expect(metricReadKind({})).toBe('raw');
    expect(metricReadKind({ aggregationStrategy: 'sum' })).toBe('raw');
    expect(metricReadKind({ aggregationStrategy: 'last' })).toBe('raw');
  });

  test('an explicit readKind wins over the derived default', () => {
    expect(
      metricReadKind({ readKind: 'raw', aggregationStrategy: 'min-max-avg' })
    ).toBe('raw');
  });

  test('no metric carries the retired iosAggregatedSync flag', () => {
    for (const metric of HEALTH_METRICS) {
      expect(metric).not.toHaveProperty('iosAggregatedSync');
    }
  });
});

describe('HEALTH_METRICS', () => {
  test('Active Calories requests permissions needed for its total-minus-basal fallback', () => {
    const activeCaloriesMetric = HEALTH_METRICS.find(
      (metric) => metric.recordType === 'ActiveCaloriesBurned'
    );

    expect(activeCaloriesMetric?.permissions).toEqual(
      expect.arrayContaining([
        { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
        { accessType: 'read', recordType: 'TotalCaloriesBurned' },
        { accessType: 'read', recordType: 'BasalMetabolicRate' },
      ])
    );
  });

  test('Exercise Session requests dependent permissions needed for workout enrichment', () => {
    const exerciseSessionMetric = HEALTH_METRICS.find(
      (metric) => metric.recordType === 'ExerciseSession'
    );

    expect(exerciseSessionMetric).toBeDefined();
    expect(exerciseSessionMetric?.permissions).toEqual(
      expect.arrayContaining([
        { accessType: 'read', recordType: 'ExerciseSession' },
        { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
        { accessType: 'read', recordType: 'TotalCaloriesBurned' },
        { accessType: 'read', recordType: 'Distance' },
        { accessType: 'read', recordType: 'Steps' },
      ])
    );
  });
});

describe('Android mindfulness metric', () => {
  test('registers Android mindfulness as a raw read with its own read permission', () => {
    // HEALTH_METRICS filters by platform when the module loads, so load a
    // fresh copy with the fresh react-native it sees set to Android.
    let androidMetrics: typeof HEALTH_METRICS = [];
    jest.isolateModules(() => {
      const { Platform } = require('react-native');
      jest.replaceProperty(Platform, 'OS', 'android');
      androidMetrics = require('../../src/HealthMetrics').HEALTH_METRICS;
    });

    const mindfulness = androidMetrics.find(
      (m) => m.recordType === 'MindfulnessSession'
    );
    expect(mindfulness).toEqual(
      expect.objectContaining({
        platforms: ['android'],
        preferenceKey: 'syncMindfulnessEnabled',
        permissions: [{ accessType: 'read', recordType: 'MindfulnessSession' }],
      })
    );
    expect(metricReadKind(mindfulness!)).toBe('raw');
    // Sessions that reach Health Connect late (a meditation entered for
    // yesterday) are still read by background sync; the upsert keeps it safe.
    expect(mindfulness!.rollingLookbackDays).toBe(2);
    // Not offered on iOS, where HealthKit mindful sessions are not synced.
    expect(
      HEALTH_METRICS.find((m) => m.recordType === 'MindfulnessSession')
    ).toBeUndefined();
  });
});

describe('getHealthMetricLabel', () => {
  test('gives every Android and iOS metric its own label, not the generic fallback', () => {
    const { getHealthMetricLabel } = require('../../src/HealthMetrics');
    const echoDefault = (_key: string, options: { defaultValue: string }) =>
      options.defaultValue;
    const metricsFor = (os: 'android' | 'ios') => {
      let metrics: typeof HEALTH_METRICS = [];
      jest.isolateModules(() => {
        const { Platform } = require('react-native');
        jest.replaceProperty(Platform, 'OS', os);
        metrics = require('../../src/HealthMetrics').HEALTH_METRICS;
      });
      return metrics;
    };
    const unlabelled = [...metricsFor('android'), ...metricsFor('ios')]
      .filter((m) => getHealthMetricLabel(echoDefault, m) === 'Health metric')
      .map((m) => m.id);
    expect(unlabelled).toEqual([]);
  });
});
