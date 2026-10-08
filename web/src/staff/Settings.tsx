import { useReadyAuth } from '../auth/AuthProvider';
import { links, type LinkKey } from '../shell/legacy';
import { LinkButton } from '../ui/Button';
import { Card } from '../ui/Card';
import '../members/members.css';
import './staff.css';

const GROUPS: { title: string; items: { key: LinkKey; name: string; text: string; moved?: boolean }[] }[] = [
  {
    title: 'People',
    items: [
      { key: 'staff', name: 'Staff', text: 'Logins, hours, qualifications and removing access.', moved: true },
      { key: 'admin-access', name: 'Access levels', text: 'What each level of login can see and do.' },
      { key: 'access-settings', name: 'Door and entry access', text: 'Who can get in, and when.' },
    ],
  },
  {
    title: 'Gym',
    items: [
      { key: 'class-setup', name: 'Class types', text: 'The classes you run and who can teach them.', moved: true },
      { key: 'resources', name: 'Rooms and equipment', text: 'Rooms, kit and the qualifications classes depend on.', moved: true },
      { key: 'layout', name: 'Gym layout', text: 'The floor plan.' },
    ],
  },
  {
    title: 'Members and connections',
    items: [
      { key: 'member-view', name: 'What members see', text: 'Choose what shows in the member app.' },
      { key: 'integrations', name: 'Integrations', text: 'Payments, door systems and other connections.' },
    ],
  },
];

export function Settings() {
  const { gym } = useReadyAuth();
  return (
    <>
      <header className="page-top">
        <div>
          <div className="eyebrow">Settings and staff</div>
          <h1>Settings</h1>
          <div className="muted">Set up {gym.gymName}.</div>
        </div>
      </header>
      {GROUPS.map((g) => (
        <Card key={g.title}>
          <h3>{g.title}</h3>
          <ul className="settings-list">
            {g.items.map((i) => (
              <li key={i.key}>
                <div>
                  <b>{i.name}</b>
                  <div className="muted">{i.text}</div>
                </div>
                <LinkButton href={links[i.key]}>Open</LinkButton>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </>
  );
}
