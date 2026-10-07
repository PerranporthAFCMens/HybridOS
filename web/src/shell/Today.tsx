import { useReadyAuth } from '../auth/AuthProvider';
import { Card } from '../ui/Card';

/** Foundation placeholder. The real Today screen is step 2 of REBUILD_PLAN.md. */
export function Today() {
  const { gym, access } = useReadyAuth();
  return (
    <>
      <h1>Today</h1>
      <Card>
        <p>
          {gym.gymName} · role <strong>{gym.role}</strong> · access <strong>{access}</strong>
        </p>
        <p className="muted">New app foundation. Screens move here one at a time.</p>
      </Card>
    </>
  );
}
