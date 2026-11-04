import { Link, useParams } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { LEGAL } from '../lib/legal';
import NotFound from './NotFound';

/**
 * Public pages Google Play and Indian law ask for: privacy policy, terms,
 * support/grievance contact and how to delete an account. They need no sign-in,
 * so the same URLs work as the Play Console links (e.g. https://<site>/legal/privacy).
 */
const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-6 text-[15px] font-bold text-[color:var(--text)]">{children}</h2>
);
const P = ({ children }: { children: React.ReactNode }) => <p className="mt-2">{children}</p>;
const Mail = () => (
  <a className="font-semibold text-brand-600 underline" href={`mailto:${LEGAL.supportEmail}`}>
    {LEGAL.supportEmail}
  </a>
);

function Privacy() {
  return (
    <>
      <P>
        This policy explains what {LEGAL.appName} (operated by {LEGAL.operator}) collects, why, and
        the choices you have. It applies to the Android app and the website.
      </P>
      <H>What we collect</H>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          <b>Account:</b> your name, email address and profile photo from Google sign-in, and the
          area you choose. Your email is never shown to other users.
        </li>
        <li>
          <b>Listings:</b> the titles, descriptions, prices, photos and locality you post. Listings
          are public.
        </li>
        <li>
          <b>Messages:</b> chats and offers you send to other users, stored so both sides can see
          the conversation.
        </li>
        <li>
          <b>Activity:</b> saved ads, blocks, reports, reviews you write, and listing view counts.
        </li>
        <li>
          <b>Payments:</b> if you buy a boost, Razorpay processes the payment. We receive the
          order and payment IDs and amount — never your card, UPI or bank details.
        </li>
        <li>
          <b>Device:</b> a notification token if you allow push notifications, and basic crash and
          diagnostic data.
        </li>
      </ul>
      <H>How we use it</H>
      <P>
        To run the marketplace: show listings, deliver messages and notifications, prevent fraud
        and abuse, review reported content, process boosts, and comply with the law. We do not sell
        your personal data or use it for third-party advertising.
      </P>
      <H>Who we share it with</H>
      <P>
        Service providers that host and run {LEGAL.appName}: Google Firebase (sign-in, database,
        file storage, notifications — servers in India, asia-south1) and Razorpay (payments). We
        may disclose information when required by law or to protect users from harm.
      </P>
      <H>How long we keep it</H>
      <P>
        While your account is active. When you delete your account we delete your profile details,
        listings, photos, saved ads, blocks, notifications and reviews you wrote. Messages you sent
        stay visible to the other person in that conversation under “Deleted user”. Payment records
        are kept as required by tax law.
      </P>
      <H>Your choices and rights</H>
      <P>
        You can edit your profile, delete listings, turn off notifications and{' '}
        <Link to="/legal/delete-account" className="font-semibold text-brand-600 underline">
          delete your account
        </Link>{' '}
        at any time. Under India's Digital Personal Data Protection Act, 2023 you may ask to see,
        correct or erase your data, or raise a grievance — write to <Mail />.
      </P>
      <H>Children</H>
      <P>{LEGAL.appName} is for people aged 18 and over.</P>
      <H>Security</H>
      <P>
        Data is encrypted in transit, and access is restricted by security rules so users can only
        read and change what they are allowed to.
      </P>
      <H>Changes</H>
      <P>We will post any changes here and update the date above.</P>
    </>
  );
}

function Terms() {
  return (
    <>
      <P>
        By using {LEGAL.appName} you agree to these terms. {LEGAL.appName} is a platform where
        people list and find second-hand items and services; we are not a party to any deal between
        buyers and sellers.
      </P>
      <H>Your account</H>
      <P>
        You must be 18 or older and give accurate information. You are responsible for activity on
        your account.
      </P>
      <H>Listings and conduct</H>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Only list items you own or are allowed to sell, described honestly, with real photos.</li>
        <li>
          No illegal, stolen, counterfeit, hazardous or adult items; no weapons, drugs, animals
          protected by law, or prescription medicines.
        </li>
        <li>No spam, scams, harassment, hate speech or sharing others' personal information.</li>
      </ul>
      <P>
        We may review, hide or remove content and suspend accounts that break these rules or the
        law. Repeatedly reported listings are hidden pending review.
      </P>
      <H>Deals between users</H>
      <P>
        Inspect items before paying and meet in safe public places. {LEGAL.appName} does not hold
        payments for items, guarantee items or verify every user, and is not liable for losses from
        deals between users, to the extent permitted by law.
      </P>
      <H>Paid boosts</H>
      <P>
        Boosts show a listing higher for a fixed period. They are processed by Razorpay and are
        non-refundable once active, unless the listing is removed by us in error.
      </P>
      <H>Intermediary status</H>
      <P>
        {LEGAL.appName} acts as an intermediary under the Information Technology Act, 2000 and the
        IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021. Complaints can be
        sent to our Grievance Officer (see{' '}
        <Link to="/legal/support" className="font-semibold text-brand-600 underline">
          Support
        </Link>
        ).
      </P>
      <H>Governing law</H>
      <P>These terms are governed by the laws of India; courts in Kolkata have jurisdiction.</P>
    </>
  );
}

function Support() {
  return (
    <>
      <P>
        Need help with an ad, a chat, a payment or your account? Email <Mail /> — we reply within 48
        hours.
      </P>
      <P>
        To report a listing or user, use <b>Report</b> on the ad or in the chat. Our team reviews
        reports within 24 hours.
      </P>
      <H>Grievance Officer</H>
      <P>
        As required by the IT Rules, 2021:
        <br />
        <b>{LEGAL.grievanceOfficer}</b>
        <br />
        {LEGAL.operator}, {LEGAL.address}
        <br />
        Email: <Mail />
        <br />
        Complaints are acknowledged within 24 hours and resolved within 15 days.
      </P>
    </>
  );
}

function DeleteAccount() {
  return (
    <>
      <P>You can delete your {LEGAL.appName} account and its data at any time.</P>
      <H>In the app</H>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>Open {LEGAL.appName} and sign in.</li>
        <li>
          Go to <b>Account</b> → <b>Delete account</b>.
        </li>
        <li>Confirm. Deletion happens immediately.</li>
      </ol>
      <H>Without the app</H>
      <P>
        Email <Mail /> from the Google account you signed in with, with the subject “Delete my
        account”. We delete it within 7 days and confirm by email.
      </P>
      <H>What is deleted</H>
      <P>
        Your profile, listings and their photos, saved ads, blocked users, notifications and reviews
        you wrote. Messages you sent remain visible to the other person in that chat, shown as from
        “Deleted user”. Records of paid boosts are kept for up to 8 years where tax law requires it.
      </P>
    </>
  );
}

const DOCS: Record<string, { title: string; body: () => JSX.Element }> = {
  privacy: { title: 'Privacy policy', body: Privacy },
  terms: { title: 'Terms of use', body: Terms },
  support: { title: 'Support & grievances', body: Support },
  'delete-account': { title: 'Delete your account', body: DeleteAccount },
};

export default function Legal() {
  const { doc = '' } = useParams();
  const page = DOCS[doc];
  if (!page) return <NotFound />;
  const Body = page.body;
  return (
    <div className="mx-auto max-w-2xl">
      <TopBar back="/profile" title={page.title} />
      <article className="px-5 pb-12 text-[13.5px] leading-relaxed text-muted">
        <p className="text-[11.5px]">Last updated {LEGAL.updated}</p>
        <Body />
        <nav className="mt-8 flex flex-wrap gap-x-4 gap-y-2 border-t pt-4 text-[12px] font-semibold hairline">
          {Object.entries(DOCS)
            .filter(([k]) => k !== doc)
            .map(([k, d]) => (
              <Link key={k} to={`/legal/${k}`} className="text-brand-600">
                {d.title}
              </Link>
            ))}
        </nav>
      </article>
    </div>
  );
}
