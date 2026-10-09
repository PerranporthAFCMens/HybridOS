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
      { key: 'access', name: 'Access levels', text: 'What each level of staff login can see and do.', moved: true },
      { key: 'owners', name: 'Owners and admins', text: 'Invite and manage owners and admins.', moved: true },
      { key: 'door', name: 'Door access', text: 'The PIN members can reveal in their member view.', moved: true },
    ],
  },
  {
    title: 'Gym',
    items: [
      { key: 'class-setup', name: 'Class types', text: 'The classes you run and who can teach them.', moved: true },
      { key: 'resources', name: 'Rooms and equipment', text: 'Rooms, kit and the qualifications classes depend on.', moved: true },
    ],
  },
  {
    title: 'Members',
    items: [
      { key: 'member-view', name: 'What members see', text: 'Choose and order the tiles on the member home, and the promo panel.', moved: true },
      { key: 'membership-rules', name: 'Membership rules', text: 'What members can do themselves: pause, cancel or change plan, and what needs your approval.', moved: true },
      { key: 'membership-requests', name: 'Membership requests', text: 'Approve or decline pause, cancel and plan change requests.', moved: true },
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
