import { useReadyAuth } from '../auth/AuthProvider';
import { Button } from '../ui/Button';
import { Card, Empty, SectionTitle } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { ClassForm } from './ClassForm';
import { useClassForEdit } from './useClasses';

/** Loads a saved class and opens the same form as Add class, filled in, to change it. */
export function EditClass({ sessionId, onClose, onSaved }: { sessionId: string; onClose: () => void; onSaved: (startsAt: Date) => void }) {
  const { gym } = useReadyAuth();
  const q = useClassForEdit(gym.gymId, sessionId);
  if (q.data) return <ClassForm editing={q.data} onClose={onClose} onSaved={onSaved} />;
  return (
    <Modal title="Edit class" onClose={onClose}>
      <SectionTitle title="Edit class" action={<Button onClick={onClose}>Close</Button>} />
      <Card>
        <Empty>{q.isError ? 'Could not load this class. Close and try again.' : 'Loading class…'}</Empty>
      </Card>
    </Modal>
  );
}
