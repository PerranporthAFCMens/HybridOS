import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import './legal.css';

const CONTACT = 'hello@hybridone.co.uk';

/** Small, quiet links shown at the foot of public and app pages. */
export function LegalLinks() {
  return (
    <p className="legal-links">
      <Link to="/privacy">Privacy policy</Link> · <Link to="/data-deletion">Delete your data</Link>
    </p>
  );
}

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="legal">
      <h1>{title}</h1>
      <p className="legal-updated">Last updated 11 October 2026</p>
      <Card>{children}</Card>
      <LegalLinks />
    </main>
  );
}

export function PrivacyPolicy() {
  return (
    <Page title="Privacy policy">
      <p>HybridOne is the membership system your gym uses to run sign-ups, classes and memberships. This page explains what is stored about you and who can see it.</p>
      <h2>Who is responsible for your data</h2>
      <p>The gym you join decides how your membership information is used. HybridOne provides the system and looks after it securely on the gym’s behalf.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Your name, email address and password (stored securely, never readable).</li>
        <li>Your mobile number, address, date of birth and emergency contact, when you give them while joining.</li>
        <li>The terms and waiver you sign, your signature, and the date and time you signed.</li>
        <li>Your membership, class bookings and attendance.</li>
      </ul>
      <p>We do not store card or bank details. Payments, when switched on, are taken on the payment provider’s own secure form.</p>
      <h2>Why we use it</h2>
      <p>To set up and run your membership, let you book classes, keep a record of what you agreed to, and send you messages from your gym, such as your signed copy of the terms.</p>
      <h2>Who can see it</h2>
      <p>Other members can never see your details. Only the team at your gym (owners, admins and staff) can see them, and a gym owner can choose whether the team sees mobile numbers and addresses.</p>
      <h2>Sharing with other companies</h2>
      <p>We do not share your information with third parties, and we never sell it. The only time information goes to another company is when you choose it, by giving your consent inside the app. Examples are connecting a service such as Strava or paying through Stripe, and there may be others. You are always asked first, and you can disconnect at any time.</p>
      <h2>Who looks after it for us</h2>
      <p>Your data is stored with Supabase, and our emails are sent through Resend. They only handle data to provide those services for us, and they may not use it for anything else.</p>
      <h2>How long we keep it</h2>
      <p>For as long as you are a member, and afterwards only as long as the gym or the law requires. You can ask us to delete your data at any time.</p>
      <h2>Your rights</h2>
      <p>You can ask to see, correct or delete the data held about you. Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> or ask your gym. You can also see how to <Link to="/data-deletion">delete your data</Link>.</p>
      <h2>Contact</h2>
      <p><a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
    </Page>
  );
}

export function DataDeletion() {
  return (
    <Page title="Delete your data">
      <p>You can ask us to delete your account and the personal data we hold about you at any time.</p>
      <h2>How to ask</h2>
      <ol>
        <li>Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> from the address you signed up with. Put “Delete my data” in the subject line.</li>
        <li>Tell us which gym you joined, if you remember.</li>
        <li>We will confirm it is you, then delete your account and personal details within 30 days and let you know when it is done.</li>
      </ol>
      <h2>What happens</h2>
      <ul>
        <li>Your account, contact details, address and emergency contact are removed.</li>
        <li>Your membership ends. Any active membership is cancelled first.</li>
        <li>Some records may have to be kept where the law requires it, such as payment and accounting records. These are kept only for that purpose.</li>
      </ul>
      <h2>Signed in with Facebook or Google?</h2>
      <p>Deleting your data here removes it from HybridOne. To also remove HybridOne’s access from your Facebook or Google account, remove the app in that account’s settings.</p>
    </Page>
  );
}
