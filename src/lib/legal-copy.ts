// Legal and account copy, approved by the owner. Shown only when the accounts flag is on.
// Text is verbatim; change it only by a named edit from the owner.

export const AGE_TICK_LABEL = 'I confirm I am 18 or older.';
export const AGE_BLOCKED_MESSAGE =
  'Accounts are for adults only, for now. You can still browse everything on the site without one.';

export const ALERT_CONSENT_TEXT =
  'Email me when sets on my wishlist are released or change price. You can stop any time.';
export const ALERT_FOOTER_TEMPLATE =
  'You are getting this because you turned on alerts at Bricks of India. Unsubscribe here: {unsubscribe}. Delete your account: {delete}.';

export const PRIVACY_SECTIONS: { lead: string; text: string }[] = [
  {
    lead: 'Who we are.',
    text: 'Bricks of India (bricksofindia.com) is run by Abhinav Bhargav, a sole proprietor in India. Questions about your data: privacy@bricksofindia.com.',
  },
  {
    lead: 'What we collect, and only if you make an account:',
    text: 'your email address, or the Google account email if you sign in with Google; the sets you heart, the sets you say you own, and the alerts you switch on; a record that you confirmed you are 18 or older, and when.',
  },
  {
    lead: 'What we collect from everyone, with or without an account:',
    text: 'basic visit information, such as which pages are opened, to see what is useful. This is anonymous and is not tied to your name or email.',
  },
  {
    lead: 'Why we use it:',
    text: 'to keep your wishlist and collection, and to email you the alerts you asked for (new releases, price drops, price rises); to fix problems and keep the site safe. We do not sell your data. We do not use it for advertising.',
  },
  {
    lead: 'Who can see it.',
    text: 'Only us, and the service providers we need to run the site and send email. They may handle your data only to do that job.',
  },
  {
    lead: 'How long we keep it.',
    text: 'Until you delete your account, or you stop using it for 24 months of no sign-in (we email you a month before), whichever comes first.',
  },
  {
    lead: 'Your data.',
    text: 'To correct or delete your data, use Delete my data or write to privacy@bricksofindia.com. We reply within 30 days.',
  },
  {
    lead: 'Complaints.',
    text: 'Write to Abhinav Bhargav, Sole Proprietor, at corrections@bricksofindia.com.',
  },
  {
    lead: 'Changes.',
    text: 'If this notice changes in a way that matters, we will say so on the site and in an email to account holders.',
  },
];

export const TERMS_SECTIONS: { lead: string; text: string }[] = [
  {
    lead: '1 What this site is.',
    text: 'A guide and price comparison for LEGO in India. We are not LEGO and not a retailer. LEGO is a trademark of the LEGO Group, which does not sponsor or endorse this site.',
  },
  {
    lead: '2 Prices and stock.',
    text: 'Prices and stock come from other shops and change without notice. We work hard to keep them right, but we cannot promise they are. Always check the shop\'s own page before you pay. We are not responsible for what a shop charges or ships.',
  },
  {
    lead: '3 Our opinions.',
    text: 'Reviews and verdicts are our opinion. They are not financial advice.',
  },
  {
    lead: '4 Links.',
    text: 'Some links to shops may earn us a commission at no cost to you. The affiliate disclosure page explains this.',
  },
  {
    lead: '5 Accounts.',
    text: 'Adults only. Keep your sign-in safe. You can delete your account at any time. We can close accounts used to abuse the site.',
  },
  {
    lead: '6 Fair use.',
    text: 'Use the site as an ordinary visitor would. Do not post anything unlawful or offensive.',
  },
  {
    lead: '7 Our content.',
    text: 'The writing, design and data on this site belong to Bricks of India. Personal, non-commercial sharing with a link back is welcome.',
  },
  {
    lead: '8 Limits.',
    text: 'The site is provided as it is. To the extent the law allows, we are not liable for loss from using it.',
  },
  {
    lead: '9 Law.',
    text: 'Indian law applies. Courts in Mumbai have jurisdiction.',
  },
  {
    lead: '10 Contact.',
    text: 'hello@bricksofindia.com.',
  },
];

export const DELETE_HEADING = 'Want out? Fair enough.';
export const DELETE_PARAGRAPHS = [
  'Deleting your account removes your email, your wishlist, your collection and your alert settings from the site. It cannot be undone.',
  'Signed in? Press the button below and confirm by email.',
  'Cannot sign in? Write to privacy@bricksofindia.com from the email address on the account and we will do it for you.',
  'Your data is removed from the live site straight away.',
];
export const DELETE_BUTTON = 'Delete my account';
export const DELETE_DONE_TEXT =
  'Done. Your account is gone. You will get one last email to confirm it.';

// Held out of the delete page until T1 confirms the backup retention. Not rendered anywhere.
// Set the sentence here when it is approved; while null, nothing is shown.
export const HELD_DELETE_BACKUP_SENTENCE: string | null = null;
