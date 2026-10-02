import type { GuidesContent } from '@/lib/guides/types'

const content: GuidesContent = {
  categories: {
    start: { title: 'Getting started', text: 'Create your account, log in and discover your dashboard.' },
    promote: { title: 'Promoting KUMANI', text: 'Invite the people you know with your link and use vouchers.' },
    wallet: { title: 'The Wallet', text: 'Card, points, donations, badges and receipts in one place.' },
    promoteTools: { title: "Tools for promoting", text: "Guides to the services that help you spread the word about KUMANI." },
  },
  guides: [
    {
      slug: 'registrazione',
      category: 'start',
      title: 'How to sign up',
      summary: 'Create your KUMANI account in a few minutes and activate it with the code you receive by email.',
      minutes: 3,
      steps: [
        {
          title: 'Open KUMANI and tap “Get Started”',
          text: 'On the homepage, tap the gold “Get Started” button at the top right. If someone sent you their invite link, open it: their code is filled in automatically.',
        },
        {
          title: 'Fill in your details',
          text: 'Enter your first name, last name, email and a password of at least 6 characters, then choose your country and your city.',
          tip: 'Use an email you check often: that’s where the code to activate your account arrives.',
        },
        {
          title: 'Invite code and voucher (optional)',
          text: 'If a Kumano invited you, enter their invite code. If you received a KUMANI voucher, enter it in the “Activation voucher code” field: your subscription is activated right away. If you have a shop, a practice or a business, tick “I’m a professional”. Then tap “Create your account”.',
        },
        {
          title: 'Verify your email',
          text: 'We send you a code by email. Enter it in the “Verification code” field and tap “Verify and activate account”. Done: you’re in!',
          tip: 'Can’t find the email? Check your spam folder or tap “Resend code”.',
        },
      ],
      cta: { label: 'Create your account', href: '/register' },
    },
    {
      slug: 'accesso',
      category: 'start',
      title: 'How to log in',
      summary: 'Get into your account and recover your password if you’ve forgotten it.',
      minutes: 2,
      steps: [
        {
          title: 'Enter email and password',
          text: 'On the homepage, tap “Log in”, enter the email and password you chose when you signed up and tap “Log in”.',
        },
        {
          title: 'Forgot your password?',
          text: 'Tap “Forgot password?” below the login button.',
        },
        {
          title: 'Reset your password',
          text: 'Enter your email and tap “Reset Password”: we send you a code to choose a new one. Then log in with the new password.',
          tip: 'You can add KUMANI to your phone’s Home screen: it opens like an app.',
        },
      ],
      cta: { label: 'Go to login', href: '/login' },
    },
    {
      slug: 'dashboard',
      category: 'start',
      title: 'Your dashboard',
      summary: 'What you’ll find in the dashboard and how to reach the services you use most.',
      minutes: 3,
      steps: [
        {
          title: 'The top bar',
          text: 'At the top you can change the language, open your profile and the Wallet, and log out. The star takes you to your favorite services.',
        },
        {
          title: 'The free services',
          text: 'The “Free” tier holds the services included for every member, with no time limit. Tap “Open” to use them and the little star to add them to your favorites.',
        },
        {
          title: 'The three service tiers',
          text: 'Services are split into three tiers: Free, Base and Pro. A Base or Pro subscription unlocks every service in that tier; with a Pass you can also activate a single service.',
        },
        {
          title: 'Points, subscription and invite code',
          text: 'Further down you’ll see the KU Karma you collect every day by logging in, your subscription status (with “Subscribe now” or “Activate via Voucher”) and your personal invite code.',
        },
        {
          title: 'The Community and the other pages',
          text: 'At the bottom you’ll find your KUMANI Community and quick links to the other pages: Community, Wallet and Noticeboard.',
        },
      ],
      cta: { label: 'Open the dashboard', href: '/dashboard' },
    },
    {
      slug: 'invito',
      category: 'promote',
      title: 'Inviting with your link',
      summary: 'Share your invite code or link and follow the people who join your KUMANI star.',
      minutes: 3,
      steps: [
        {
          title: 'Your invite code',
          text: 'Your personal invite code is in the dashboard. Tap the icon next to it to copy it: whoever signs up with your link joins your KUMANI star.',
        },
        {
          title: 'Share the link',
          text: 'On the Community page your link is ready: copy it, tap “Invite on WhatsApp” or “Share…” to send it with Instagram, Telegram and the other apps on your phone.',
          tip: 'A personal message works better than one sent to everyone: tell them why KUMANI is useful to you.',
        },
        {
          title: 'Your KUMANI star',
          text: 'The star shows the 5 people you invited directly and how many active people there are under each position. Anyone who signed up but hasn’t activated a subscription yet appears under “Not yet KUMANI”.',
        },
        {
          title: 'How you earn KU Points',
          text: 'The rules are in the Wallet: you receive KU Points when someone you invited activates a subscription by paying with a card or upgrades to Pro, and with the Structure Bonus.',
        },
      ],
      cta: { label: 'Open your Community', href: '/dashboard/rete' },
    },
    {
      slug: 'voucher',
      category: 'promote',
      title: 'Creating and using vouchers',
      summary: 'Turn KU Points into vouchers to give away and activate a voucher you received.',
      minutes: 3,
      steps: [
        {
          title: 'Redeem a points pack',
          text: 'In the Wallet, in the voucher section, spend your KU Points to redeem a pack: you receive a credit in euros to create vouchers. Under each pack you can see how many points you still need.',
        },
        {
          title: 'Create a voucher',
          text: 'With the credit, choose the plan (Base or Pro, one year) and whether the voucher is a gift or for sale, then tap “Create voucher”.',
        },
        {
          title: 'Received a voucher?',
          text: 'Enter the code in the “Received a voucher?” field and tap “Redeem”: your subscription is activated right away. You can also enter it when you sign up.',
        },
      ],
      cta: { label: 'Go to vouchers', href: '/wallet' },
    },
    {
      slug: 'wallet',
      category: 'wallet',
      title: 'Using the Wallet',
      summary: 'Your card, points, donations, badges and receipts: here’s what you’ll find in the Wallet.',
      minutes: 4,
      steps: [
        {
          title: 'Your Membership card',
          text: 'At the top is your KUMANI card with member number, active plan and expiry date. You can save the QR code with “Download QR”.',
        },
        {
          title: 'Your points',
          text: 'Here you see your KU Karma, earned every day by logging in and using the tools, and your KU Points, received when someone you invited activates a subscription. Points are not money and can only be used inside the platform.',
        },
        {
          title: 'Donate your KU Points',
          text: 'In the Donations section you can donate your KU Points to the association KUMANI supports: every 10 points donated = €1, which KUMANI pays to the association.',
        },
        {
          title: 'Badges',
          text: 'The Kuman Green, Kuman Star and Kuman Black badges unlock with the total KU Points you’ve earned. The bar tells you how many points you need for the next one.',
        },
        {
          title: 'Receipts, coupons and renewal discount',
          text: 'Further down you’ll find Digital Receipts (Pro plan), the coupons you got in the Ecosystem and the subscription renewal discount you can get with KU Karma.',
        },
      ],
      cta: { label: 'Open the Wallet', href: '/wallet' },
    },
    {
      slug: "qr-generator",
      category: "promoteTools",
      title: "Dynamic QR Code",
      summary: "Create the QR code of your invite link, choose the colours and download it to print or share.",
      minutes: 2,
      steps: [
        {
          title: "Your link is already inside",
          text: "The QR leads to your personal invite link. The “Target Link” is locked, so whoever scans it always joins your KUMANI star."
        },
        {
          title: "Choose the colours",
          text: "Change the “QR Code Color” and the “Background Color”, or tap one of the “Quick Themes”.",
          tip: "Keep good contrast between QR and background: a QR that is too light is hard to read."
        },
        {
          title: "Download the QR",
          text: "Check the preview and tap “Download PNG”: the image is high resolution, good for printing too."
        },
        {
          title: "Where to use it",
          text: "Print it on business cards and flyers, share it on social media or add it to your email signature."
        }
      ],
      cta: {
        label: "Open the Dynamic QR Code",
        href: "/marketplace/qr-generator"
      }
    },
    {
      slug: "whatsapp-messages",
      category: "promoteTools",
      title: "WhatsApp Messages",
      summary: "Ready-made messages with your invite link: choose the right tone and send it in seconds.",
      minutes: 2,
      steps: [
        {
          title: "Choose the message",
          text: "There are 4 messages for different situations: casual, formal, emotional and after a meeting. Your invite link is already in the text."
        },
        {
          title: "Copy or send",
          text: "Tap “Send on WhatsApp” to open WhatsApp with the message ready and choose who to send it to. Or tap “Copy message” and paste it wherever you like, even in another app.",
          tip: "In WhatsApp you can edit the text before sending it: add the person’s name."
        },
        {
          title: "Tips for effective messages",
          text: "Always personalise the message, don’t send it to too many people at once and follow up with a call or a voice message."
        }
      ],
      cta: {
        label: "Open WhatsApp Messages",
        href: "/marketplace/whatsapp-messages"
      }
    },
    {
      slug: "link-in-bio",
      category: "promoteTools",
      title: "Link in Bio",
      summary: "Create your personal page with your links, to put in your Instagram, TikTok and other social bios.",
      minutes: 3,
      steps: [
        {
          title: "Write your bio",
          text: "In the “Bio Text” field write a sentence about yourself: it appears below your name."
        },
        {
          title: "Colour and special themes",
          text: "Choose the page colour. You can preview the special themes (Northern lights, Moon over the lake, Savannah sunset) by tapping them: KU Karma are only used if you decide to unlock them."
        },
        {
          title: "Add your links and save",
          text: "Tap “Add Link” to add your links (website, social, shop…): your KUMANI invite link is always there. Then tap “Save Page”.",
          tip: "Further down you can preview how the page will look."
        },
        {
          title: "Share your page",
          text: "Copy the page link and put it in your social bios, or tap “Visit your Link in Bio” to see it. Remember to save before sharing."
        }
      ],
      cta: {
        label: "Open Link in Bio",
        href: "/marketplace/link-in-bio"
      }
    },
    {
      slug: "spotlight",
      category: "promoteTools",
      title: "Kumano of the Day",
      summary: "Tell your story and join the community showcase: every day one Kumano is featured. Reserved for active subscribers.",
      minutes: 3,
      steps: [
        {
          title: "Tell your story",
          text: "Fill in your name or nickname (never your surname), city, country, job or passion and a short story that can be read in 20 seconds."
        },
        {
          title: "Choose your favourite tools",
          text: "Tap the KUMANI tools you use most: they appear together with your story."
        },
        {
          title: "Consent and submit",
          text: "Tick the consent to be shown to the community (the one for the homepage is optional) and tap “Save and join the showcase”. The KUMANI Staff approves the story, then it enters the Kumano of the Day rotation.",
          tip: "You can remove your story from the showcase or the homepage whenever you like, from this same page."
        }
      ],
      cta: {
        label: "Tell your story",
        href: "/marketplace/spotlight"
      }
    },
    {
      slug: "events",
      category: "promoteTools",
      title: "KUMANI Events",
      summary: "Find community meetups, workshops and evenings, sign up with one tap and get in with your pass.",
      minutes: 3,
      steps: [
        {
          title: "Find an event",
          text: "Search by city, country, language and date, or tap “Online only” for online events."
        },
        {
          title: "Sign up and get your pass",
          text: "Open the event and tap “Join”: you get your pass with QR right away, and you’ll find it in “My passes”. Show it at the entrance: the organiser scans it and you’re in.",
          tip: "If the event is full you can join the waiting list: if a spot frees up, you get in automatically."
        },
        {
          title: "Organise an event",
          text: "Want to organise a meetup in your city or online? Tap “Organise an event”."
        },
        {
          title: "Become a verified organiser",
          text: "To organise events you need to be a Verified Kumano: tap “Become a verified organiser” and follow the steps. Then, from “My events”, you manage attendees and check-in."
        }
      ],
      cta: {
        label: "Open KUMANI Events",
        href: "/events"
      }
    },
  ],
}

export default content
