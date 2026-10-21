import { metricsCoveredByGrant } from '../../src/utils/healthPermissionGrants';
import type { HealthMetric } from '../../src/HealthMetrics';

const metric = (
  stateKey: string,
  permissions: HealthMetric['permissions']
): HealthMetric =>
  ({ id: stateKey, stateKey, permissions }) as unknown as HealthMetric;

describe('metricsCoveredByGrant', () => {
  test('keeps the metrics whose own permissions were all granted', () => {
    const steps = metric('isStepsSyncEnabled', [
      { accessType: 'read', recordType: 'Steps' },
    ]);
    const activeCalories = metric('isCaloriesSyncEnabled', [
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      { accessType: 'read', recordType: 'BasalMetabolicRate' },
    ]);
    // A Health Connect without the mindfulness feature cannot grant this one.
    const mindfulness = metric('isMindfulnessSyncEnabled', [
      { accessType: 'read', recordType: 'MindfulnessSession' },
    ]);

    const covered = metricsCoveredByGrant(
      [steps, activeCalories, mindfulness],
      [
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
        { accessType: 'write', recordType: 'BasalMetabolicRate' },
      ]
    );

    expect([...covered]).toEqual(['isStepsSyncEnabled']);
  });
});
