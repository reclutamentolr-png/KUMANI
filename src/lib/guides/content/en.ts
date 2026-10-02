import type { GuidesContent } from '@/lib/guides/types'

const content: GuidesContent = {
  categories: {
    start: { title: 'Getting started', text: 'Create your account, log in and discover your dashboard.' },
    promote: { title: 'Promoting KUMANI', text: 'Invite the people you know with your link and use vouchers.' },
    wallet: { title: 'The Wallet', text: 'Card, points, donations, badges and receipts in one place.' },
    promoteTools: { title: "Tools for promoting", text: "Guides to the services that help you spread the word about KUMANI." },
    security: { title: "Security", text: "Guides to the services that help you spot and stop scams." },
    community: { title: "Community", text: "Guides to the services for meeting, helping each other and playing together." },
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
          text: 'The rules are in the Wallet: you receive KU Points when someone you invited activates a subscription by paying with a card or upgrades to Pro, and with the Welcome Bonus.',
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
    {
      slug: "antitruffa",
      category: "security",
      title: "Anti-Scam Manual",
      summary: "The most common scams, with real examples and what to do right away: read it, save it and share it with the people you love.",
      minutes: 2,
      steps: [
        {
          title: "Download or print it",
          text: "At the top, tap “Download or print the manual”: your phone’s or computer’s print window opens, where you can also save it as a PDF."
        },
        {
          title: "Share it with the people you love",
          text: "Send it to parents, grandparents and friends via WhatsApp, Facebook, Telegram, X, LinkedIn or email, or copy the link. Anyone who signs up from your link joins your network."
        },
        {
          title: "The 10-second test",
          text: "Before clicking, replying or paying, ask yourself the 6 questions of the test: if even one answer is “yes”, it’s almost certainly a scam.",
          tip: "Right below are the 6 golden rules: they alone are enough to avoid most scams."
        },
        {
          title: "Choose a chapter",
          text: "From the contents, go to the chapter you need: email and texts, phone calls, at your front door, chats, shopping, investments… Tap a scam to open it and read examples and what to do. At the end you’ll find what to do right away if you’ve been scammed."
        }
      ],
      cta: {
        label: "Open the Anti-Scam Manual",
        href: "/marketplace/antitruffa"
      }
    },
    {
      slug: "verifica-iban",
      category: "security",
      title: "IBAN Check",
      summary: "Check the IBAN before a bank transfer: whether it’s written correctly, which country it’s from and which warning signs to watch for.",
      minutes: 2,
      steps: [
        {
          title: "Paste the IBAN",
          text: "Paste the IBAN you were given, with or without spaces, and tap “Check the IBAN”. The check happens entirely on your phone: the IBAN is never sent or saved."
        },
        {
          title: "Read the result",
          text: "You see whether the IBAN is written correctly and which country it’s from. For Italian IBANs you also see its parts: CIN, ABI (the bank), CAB (the branch) and account number.",
          tip: "If there’s a mistake, we tell you where: for example a missing character or two swapped digits."
        },
        {
          title: "What are you paying for?",
          text: "Choose the closest answer (a private seller, a holiday home, an online shop, an investment…) and your country: we show you the warning signs to watch for."
        },
        {
          title: "Before making the transfer",
          text: "Remember: a valid IBAN doesn’t guarantee the recipient is honest. Read the tips before paying: an instant transfer can’t be cancelled."
        }
      ],
      cta: {
        label: "Open IBAN Check",
        href: "/marketplace/verifica-iban"
      }
    },
    {
      slug: "checkmail",
      category: "security",
      title: "CheckMail",
      summary: "Got a suspicious email? Upload or copy it: we check the sender, links, attachments and text and tell you how risky it is.",
      minutes: 3,
      steps: [
        {
          title: "Choose how to load the email",
          text: "There are three ways: “Upload the file” (the email saved as .eml or .msg, the most complete), “Paste the source” or “From your phone”. Each one comes with instructions for Gmail, Outlook and other programs."
        },
        {
          title: "Enter the email and analyse it",
          text: "From your phone, just copy the sender, subject and text with any links, then tap “Analyze the email”.",
          tip: "Below the button you can see how many checks you have left today."
        },
        {
          title: "The risk level",
          text: "The result tells you whether the risk is low, medium or high and lists what we found: fake sender, shortened links, pressure, requests for your details…"
        },
        {
          title: "What to do",
          text: "Follow the advice: for example don’t click, don’t open attachments and don’t reply. With “Check another email” you start again.",
          tip: "CheckMail gives clues, not certainties: if in doubt, contact the company through its official channels."
        }
      ],
      cta: {
        label: "Open CheckMail",
        href: "/marketplace/checkmail"
      }
    },
    {
      slug: "verifoto",
      category: "security",
      title: "VeriFoto",
      summary: "Check whether a photo is real or was created or retouched with artificial intelligence, before you trust it.",
      minutes: 2,
      steps: [
        {
          title: "Choose the photo",
          text: "Tap “Choose a photo” and pick the image to check (JPG, PNG or WebP up to 15 MB). The basic checks happen on your phone."
        },
        {
          title: "The risk that it’s AI or retouched",
          text: "You see a verdict and a risk percentage: 0–30% low, 31–69% uncertain, 70–100% high. Below are the clues found, such as digital certificates and camera data."
        },
        {
          title: "The retouch map",
          text: "Tap “Retouch map”: areas much brighter than the rest can point to pasted or retouched parts. It’s a visual aid, not proof."
        },
        {
          title: "Second opinion and the original photo",
          text: "For an extra check use the AI detector: agree to send a reduced copy of the photo and tap “Analyse with the AI detector”. With Google Lens or TinEye you can search whether the same photo already exists online.",
          tip: "VeriFoto gives clues, not certainties: if in doubt, don’t trust it."
        }
      ],
      cta: {
        label: "Open VeriFoto",
        href: "/marketplace/verifoto"
      }
    },
    {
      slug: "documento-sicuro",
      category: "security",
      title: "Safe Document",
      summary: "Before sending a photo of an ID, add a caption with purpose and date and cover the details that aren’t needed.",
      minutes: 3,
      steps: [
        {
          title: "Choose the photo of the document",
          text: "Tap “Choose a photo” to pick it from your gallery or “Take a photo”. The photo stays on your phone: it’s never uploaded or saved."
        },
        {
          title: "Cover the details that aren’t needed",
          text: "Tap “Cover an area” and drag your finger over the photo to put a black rectangle over the document number, signature or photo, if they weren’t asked for.",
          tip: "We also tell you if the photo contains hidden data, such as GPS location: it’s gone from the downloaded copy."
        },
        {
          title: "Add the protection caption",
          text: "Choose what you’re sending it for (renting, bank, job, online purchase…) and to whom: the caption with purpose and date repeats diagonally across the whole photo. You can change its text, visibility, size and colour.",
          tip: "Use a different caption for each person: if the copy gets passed around, you’ll know where it came from."
        },
        {
          title: "Download or send the copy",
          text: "Tap “Download the protected copy” or “Share”: you get a new copy with the caption and covered areas, without hidden data. The original isn’t touched."
        }
      ],
      cta: {
        label: "Open Safe Document",
        href: "/marketplace/documento-sicuro"
      }
    },
    {
      slug: "listings",
      category: "community",
      title: "Community Listings",
      summary: "Post services and products, find what you need and message whoever posted.",
      minutes: 3,
      steps: [
        {
          title: "Search for a listing",
          text: "Type what you’re looking for, choose category, country and city and tap “Search”. Featured listings appear first."
        },
        {
          title: "Post your listing",
          text: "Tap “New Listing”: posting costs some KU Karma, shown on the button. Write a title, category and description; price and image are optional.",
          tip: "If you don’t have enough KU Karma, log in every day to collect them. Listings last 30 days, then you can repost them with one click."
        },
        {
          title: "Where it is",
          text: "Choose country and city. For services and consulting, tick “Also available online / remotely”: the listing appears in every city of the country."
        },
        {
          title: "Featured (optional)",
          text: "You can feature the listing right away in the Featured section with KU Points, choosing for how many days. Then tap “Publish Listing”."
        },
        {
          title: "Your messages",
          text: "In “My messages” you’ll find conversations with people who wrote to you about a listing or whom you wrote to. For your privacy, messages are deleted automatically after 30 days."
        }
      ],
      cta: {
        label: "Open Community Listings",
        href: "/marketplace/listings"
      }
    },
    {
      slug: "timebank",
      category: "community",
      title: "KUMANI Time Bank",
      summary: "Help someone for an hour and earn an hour, to spend when you need a hand.",
      minutes: 3,
      steps: [
        {
          title: "1 hour = 1 hour",
          text: "You help someone for an hour and earn an hour, which you spend when you need a hand. Hours aren’t worth money and can’t be turned into points or discounts."
        },
        {
          title: "Verify and join",
          text: "Tap “Verify and join”: you need to have been a member for at least 30 days, a complete profile, be of age, a verified identity (tax code or ID) and accepted rules. Then you create your profile and get your welcome hours.",
          tip: "You can verify your identity and accept the rules right away, even if some requirement is still missing."
        },
        {
          title: "Ask for or offer help",
          text: "On the board, filter requests and offers by category, in person or online, and city. Post with “Ask for help” or “Offer help”, or reply with “I can help”: hours move from one balance to the other when you both confirm."
        },
        {
          title: "Safe exchanges",
          text: "The first time, meet in a public place or online. Nobody should ask you for money, gifts or bank details; no professional advice or dangerous jobs. If something’s wrong, report it: the Staff steps in."
        }
      ],
      cta: {
        label: "Open the Time Bank",
        href: "/marketplace/timebank"
      }
    },
    {
      slug: "convivio",
      category: "community",
      title: "Kordata",
      summary: "Group buying among Kumani: together you buy better, straight from the producer or the shop.",
      minutes: 3,
      steps: [
        {
          title: "Together you buy better",
          text: "A Kumano proposes a group purchase from a producer or shop and the others join: once the minimum is reached the order goes ahead and everyone pays the supplier directly."
        },
        {
          title: "Join a Kordata",
          text: "Under “Open” you’ll find active Kordate, by category (food and wine, tech, travel and events, home and energy…). Open the one you like and tap “I’m in”: we’ll let you know when the minimum is reached. Under “Mine” you’ll find the ones you’re part of.",
          tip: "Once you join you can see who’s taking part and write in the group chat."
        },
        {
          title: "Propose a Kordata",
          text: "Tap “Propose a Kordata”. To protect those who join you need to become an organiser: an active subscription for at least 30 days, a complete profile, a verified identity and the organiser’s rules accepted."
        },
        {
          title: "How payment works",
          text: "KUMANI doesn’t handle payments: once the minimum is reached, everyone pays the supplier directly following the organiser’s instructions, and the organiser is responsible for what they propose."
        }
      ],
      cta: {
        label: "Open Kordata",
        href: "/marketplace/convivio"
      }
    },
    {
      slug: "affinity",
      category: "community",
      title: "KUMANI Affinity",
      summary: "A 20-question game to discover your archetype, challenge a friend and meet people on your wavelength.",
      minutes: 3,
      steps: [
        {
          title: "Answer 20 questions",
          text: "Tap “Start the game” and answer 20 quick questions: there are no right or wrong answers.",
          tip: "We only save your map (5 values) and your archetype, never your individual answers. You can delete it whenever you like."
        },
        {
          title: "Your archetype and your map",
          text: "At the end you discover your KUMANI archetype and your Affinity Map on 5 values: adventure, values, rhythm, curiosity and warmth. You can share it or play again."
        },
        {
          title: "Play in Duo",
          text: "Tap “Send the Duo link” and send it to a friend or partner: they play, even without signing up, and you instantly find out how compatible you are."
        },
        {
          title: "Affinity Friends",
          text: "Every week Kumi introduces you to a few people on your wavelength. Choose the languages you speak, add a sentence about yourself, give your consent and tap “Turn on introductions”. The chat only opens if you both say yes.",
          tip: "Only subscribed adults who chose to take part are included. You can block, report or pause whenever you like."
        }
      ],
      cta: {
        label: "Open Affinity",
        href: "/marketplace/affinity"
      }
    },
    {
      slug: "veritas",
      category: "community",
      title: "Veritas",
      summary: "The “Who’s lying?” game for 3 to 8 players: friends can play even without signing up.",
      minutes: 2,
      steps: [
        {
          title: "Create a room",
          text: "Enter your nickname, choose the question language and number of rounds and tap “Create the room”. Invite friends with the link or code: 3 to 8 players, even without signing up."
        },
        {
          title: "Join with a code",
          text: "If a friend has already created a room, enter their code and tap “Join the room”."
        },
        {
          title: "How to play",
          text: "Each round brings a question: everyone writes the truth, except one person who secretly makes something up. Read the anonymous answers and vote for the liar. Whoever spots the liar gets 1 point; the liar gets 1 point for each person fooled."
        }
      ],
      cta: {
        label: "Open Veritas",
        href: "/marketplace/veritas"
      }
    },
  ],
}

export default content
