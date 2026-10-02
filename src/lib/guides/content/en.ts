import type { GuidesContent } from '@/lib/guides/types'

const content: GuidesContent = {
  categories: {
    start: { title: 'Getting started', text: 'Create your account, log in and discover your dashboard.' },
    promote: { title: 'Promoting KUMANI', text: 'Invite the people you know with your link and use vouchers.' },
    wallet: { title: 'The Wallet', text: 'Card, points, donations, badges and receipts in one place.' },
    promoteTools: { title: "Tools for promoting", text: "Guides to the services that help you spread the word about KUMANI." },
    security: { title: "Security", text: "Guides to the services that help you spot and stop scams." },
    community: { title: "Community", text: "Guides to the services for meeting, helping each other and playing together." },
    organize: { title: "Work and organisation", text: "Guides to the services for work, money, deadlines and your diary." },
    wellness: { title: "Wellbeing and leisure", text: "Guides to the services for focusing, relaxing, creating and travelling." },
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
    {
      slug: "kumani-cv",
      category: "organize",
      title: "KUMANI CV",
      summary: "Create your European-style CV: every PDF has a QR code leading to your always up-to-date public page.",
      minutes: 4,
      steps: [
        {
          title: "Create a new CV",
          text: "Tap “New CV”. The CV is European-style and every PDF has a QR code leading to your public page: whoever scans it always sees the latest version."
        },
        {
          title: "Name, language and template",
          text: "Give the CV a name (for example “Italian CV”), choose the content language and one of the three templates: Minimal, Classic or Sidebar. Then add a photo and your details.",
          tip: "You can create several CVs, for example one in Italian and one in English."
        },
        {
          title: "Experience, education and skills",
          text: "Fill in the sections with “Add experience”, “Add education”, skills, languages, certifications and links. With “Preview” you see right away how it looks."
        },
        {
          title: "Create, download and share",
          text: "Tap “Create CV”. Then you can download the PDF, copy the public link or share it via WhatsApp and email. If you update the CV, the link and QR always show the new version."
        }
      ],
      cta: {
        label: "Open KUMANI CV",
        href: "/marketplace/kumani-cv"
      }
    },
    {
      slug: "findo",
      category: "organize",
      title: "Findo",
      summary: "Your personal inventory: record where you keep things and find them in a moment.",
      minutes: 2,
      steps: [
        {
          title: "Your personal inventory",
          text: "Record where you keep things (documents, tools, valuables) and find them in a moment. To start, tap “Add item”."
        },
        {
          title: "Record an item",
          text: "Add a photo, write what you’re recording, choose where it is (or create a new location), then category and tags. Tap “Save item”.",
          tip: "Locations are reusable: “Bedroom wardrobe”, “Cellar”, “Office”… If you move an item, Findo keeps the history of where it’s been."
        },
        {
          title: "Find things again",
          text: "Search by name, tag or location, show favourites only, or open “Manage locations” to see what’s in each place."
        }
      ],
      cta: {
        label: "Open Findo",
        href: "/marketplace/findo"
      }
    },
    {
      slug: "life-calendar",
      category: "organize",
      title: "Life Calendar",
      summary: "Documents, car, home, contracts and subscriptions: all your deadlines in one place, with renewals and reminders.",
      minutes: 2,
      steps: [
        {
          title: "All your deadlines in one place",
          text: "At the top you see how many deadlines are on track, coming up, urgent or expired. Tap “New deadline” to add one."
        },
        {
          title: "Add a deadline",
          text: "Write what you want to remember (ID card, car insurance, MOT…), choose the category and, if you like, a profile: a person, a car, a home. Then enter the due date."
        },
        {
          title: "Renewal and reminders",
          text: "Choose whether it repeats (every month, every year, every 2 years…) and when to remind you, from 180 days to 1 day before. We remind you on the dashboard and in the MemoLife calendar."
        }
      ],
      cta: {
        label: "Open Life Calendar",
        href: "/marketplace/life-calendar"
      }
    },
    {
      slug: "memolife",
      category: "organize",
      title: "MemoLife",
      summary: "Your diary: appointments, reminders, notes and contacts, together with bills and deadlines.",
      minutes: 2,
      steps: [
        {
          title: "Your diary",
          text: "MemoLife brings together appointments, reminders, notes and contacts in the Today, Calendar, Reminders, Notes and Contacts tabs. The calendar also shows your Spendly bills and Life Calendar deadlines."
        },
        {
          title: "Add something",
          text: "Tap the “+” button at the bottom and choose appointment, reminder, note or contact. From here you can also add a bill (Spendly) or a document deadline (Life Calendar)."
        }
      ],
      cta: {
        label: "Open MemoLife",
        href: "/marketplace/memolife"
      }
    },
    {
      slug: "spendly",
      category: "organize",
      title: "Spendly",
      summary: "Your personal budget month by month: income, bills and expenses under control.",
      minutes: 3,
      steps: [
        {
          title: "Your annual budget",
          text: "In the “Annual Dashboard” you see the year’s income, fixed expenses, variable expenses and net balance, with the balance trend month by month."
        },
        {
          title: "The tabs",
          text: "At the top you switch between tabs: Dashboard, Income, Bills, Fixed Expenses and Variable Expenses. In each one, tap “New” to add an entry."
        },
        {
          title: "Monthly monitoring",
          text: "Choose a month to see its details: income, expenses, balance and variable expenses by category. The colours tell you whether the month is positive, on watch or critical."
        },
        {
          title: "Bills",
          text: "In the “Bills” tab add electricity, gas, water, phone… with “New bill”: they repeat automatically and you record what you actually paid. If you close a contract, deactivate it."
        }
      ],
      cta: {
        label: "Open Spendly",
        href: "/marketplace/spendly"
      }
    },
    {
      slug: "svat",
      category: "organize",
      title: "SVAT – Anti-Fraud Check",
      summary: "Check in seconds whether a website, a VAT number or a QR code can be trusted.",
      minutes: 2,
      steps: [
        {
          title: "Choose what to check",
          text: "You can check a website (“Website Check”), a VAT number (“VAT Number Check”) or a QR code (“QR Check”)."
        },
        {
          title: "The trust score",
          text: "Enter the website address and tap “Run Verification”: in a few seconds you get a score from 0 to 100 and a verdict."
        },
        {
          title: "The checks in detail",
          text: "Below you see how many checks are OK, worth watching or risky: domain and DNS, security, content, legal pages, reviews and business model."
        },
        {
          title: "Check a VAT number",
          text: "In the “VAT Number Check” tab enter an Italian or European VAT number to find out whether it’s active and who it belongs to.",
          tip: "A good score is a clue, not a guarantee: before paying, also read the Anti-Scam Manual."
        }
      ],
      cta: {
        label: "Open SVAT",
        href: "/marketplace/svat"
      }
    },
    {
      slug: "focus",
      category: "wellness",
      title: "KUMANI Focus",
      summary: "Work in intervals: focus and short breaks, with a long break every 4 sessions.",
      minutes: 2,
      steps: [
        {
          title: "Start a session",
          text: "Write what you’re focusing on and tap “Start”: the countdown begins. You can skip a phase or start over; a soft sound tells you at every change."
        },
        {
          title: "Choose your rhythm",
          text: "Classic 25/5, Long 50/10, Short 15/3 or Custom. You can turn on sound, vibration, keep the screen on and get a notification at every change."
        },
        {
          title: "Your sessions today",
          text: "See how many sessions you completed and how many minutes you focused today. It resets every day and stays only on your device.",
          tip: "Open “Tips for better focus” for a few suggestions."
        }
      ],
      cta: {
        label: "Open Focus",
        href: "/marketplace/focus"
      }
    },
    {
      slug: "mandala",
      category: "wellness",
      title: "KUMANI Mandala",
      summary: "Draw with one finger: your stroke becomes a symmetrical mandala. No skill required.",
      minutes: 2,
      steps: [
        {
          title: "Draw with one finger",
          text: "Draw a line on the canvas: it’s repeated symmetrically and becomes a mandala in seconds."
        },
        {
          title: "Choose symmetry and colours",
          text: "Choose the symmetry (6, 8, 12 or 16 segments), a dark or ivory background, brush or eraser, thickness and colour. “Undo” takes a step back, “Clear” starts over."
        },
        {
          title: "Download your mandala",
          text: "Tap “Download PNG” to save the drawing and share it, for example on WhatsApp.",
          tip: "To relax even more, you can listen to Neurobalance waves while you draw."
        }
      ],
      cta: {
        label: "Open Mandala",
        href: "/marketplace/mandala"
      }
    },
    {
      slug: "mosaic",
      category: "wellness",
      title: "KUMANI Mosaic",
      summary: "Every Kumano places a few tiles a day on a shared canvas: a work created by the whole community.",
      minutes: 2,
      steps: [
        {
          title: "A work of the whole community",
          text: "Every Kumano leaves their mark on the shared canvas: nobody owns it, everyone created it. You can zoom in, replay how it grew, share it and download it."
        },
        {
          title: "How it works",
          text: "Every day you get a few tiles: tap a free square, choose a colour and confirm. A placed tile stays forever. Tiles renew at midnight and each season has a theme and an end date.",
          tip: "You can place tiles after 7 days of logging in to KUMANI. If you also use another KUMANI service the same day, you get a bonus tile."
        },
        {
          title: "Your achievements",
          text: "Unlock the season’s achievements: Co-founder of the artwork, Final tile and Mosaicist. If you see offensive writing or an ad, tap one of its tiles and report the area."
        }
      ],
      cta: {
        label: "Open Mosaic",
        href: "/marketplace/mosaic"
      }
    },
    {
      slug: "oxygen",
      category: "wellness",
      title: "OXYGEN",
      summary: "Three minutes to breathe again, with 4-7-8 breathing: breathe in for 4 seconds, hold for 7, breathe out for 8.",
      minutes: 2,
      steps: [
        {
          title: "Choose how to breathe",
          text: "Choose the guided session (about 3 minutes, with a few words along the way) or just breathe, and how many cycles: 4 are recommended. You can turn on sound and vibration to breathe with your eyes closed."
        },
        {
          title: "Before you start",
          text: "Sit or lie down somewhere quiet, never while driving. The first time do at most 4 cycles and, if you feel dizzy, stop and breathe normally.",
          tip: "OXYGEN is a relaxation exercise, not a medical device: it doesn’t replace a doctor’s advice."
        },
        {
          title: "Start breathing",
          text: "Tap “Start breathing”: the circle grows and shrinks with you and guides you step by step."
        }
      ],
      cta: {
        label: "Open OXYGEN",
        href: "/marketplace/oxygen"
      }
    },
    {
      slug: "fabula",
      category: "wellness",
      title: "Kumani Fabula",
      summary: "Six dice, one story: write a micro-story with today’s dice and read the community’s.",
      minutes: 2,
      steps: [
        {
          title: "Today’s roll",
          text: "In “Today’s roll” the dice are the same for the whole community and change at midnight. With “Free roll” you can roll whenever you like."
        },
        {
          title: "Roll and write",
          text: "Tap “Roll the dice”: you get a character, place, object, emotion, action and atmosphere. Write a micro-story (up to 900 characters) that uses them all; if you like, try the 60-second challenge."
        },
        {
          title: "Gallery and stories",
          text: "Publish the story in the “Gallery” or keep it in “My stories”. Read how others told the same dice, in seven languages: no rankings, just applause.",
          tip: "Write every day to earn the “Steady pen” achievement."
        }
      ],
      cta: {
        label: "Open Fabula",
        href: "/marketplace/fabula"
      }
    },
    {
      slug: "neurobalance",
      category: "wellness",
      title: "Neurobalance",
      summary: "Audio sessions with binaural frequencies and nature sounds, for a relaxing break.",
      minutes: 2,
      steps: [
        {
          title: "Choose a session",
          text: "Put on stereo headphones, choose a session (for example “Deep rest”, “Fluid focus” or “Mindful reset”), adjust the volume and tap “Start session”."
        },
        {
          title: "Special Sound",
          text: "Carrier frequencies to listen to with stereo headphones, at a low, comfortable volume. Tap the play button next to the one you want."
        },
        {
          title: "Nature sounds",
          text: "Rain, ocean, stream, forest, wind, fire, night and thunderstorm: turn one on and mix it into your session.",
          tip: "Neurobalance is meant for relaxation, it isn’t a therapy."
        }
      ],
      cta: {
        label: "Open Neurobalance",
        href: "/marketplace/neurobalance"
      }
    },
    {
      slug: "aureya",
      category: "wellness",
      title: "Aureya",
      summary: "Three quick self-check tests, hearing, visual acuity and the Amsler grid, to repeat and compare over time.",
      minutes: 3,
      steps: [
        {
          title: "First of all",
          text: "Aureya is a self-check tool, not a medical device, and doesn’t replace a check-up. Results depend on headphones, volume, screen, light and distance: they’re indicative."
        },
        {
          title: "The acoustic test",
          text: "You hear a series of tones at different frequencies, one ear at a time, and tap “I hear it” as soon as you perceive them. Between sounds there’s a pause of silence of varying length: tap only when you really hear the sound."
        },
        {
          title: "Visual acuity and the Amsler grid",
          text: "In the visual acuity test you say which way the letter “E” is facing as it gets smaller, with no time limit. In the Amsler grid you look at the dot in the centre and mark the areas where the lines look wavy, blurred or missing. Both are done one eye at a time.",
          tip: "The first time you measure the screen by placing a credit card on it: this shows the letter and grid at the right size."
        },
        {
          title: "Compare over time",
          text: "Each test saves the date and result in the “Test history”, so you can compare them over time.",
          tip: "If you notice a decline, wavy lines or missing areas, especially for the first time, see a doctor or an eye specialist."
        }
      ],
      cta: {
        label: "Open Aureya",
        href: "/marketplace/aureya"
      }
    },
    {
      slug: "travel",
      category: "wellness",
      title: "KUMANI Travel",
      summary: "The trip that organises itself: a day-by-day itinerary and checklist shared with your travel companions.",
      minutes: 2,
      steps: [
        {
          title: "Create a trip",
          text: "Tap “New trip”, add dates and activities: the itinerary builds day by day. In the checklist, note what not to forget and who’s taking care of it.",
          tip: "Creating a trip requires a subscription; joining a trip you were invited to doesn’t."
        },
        {
          title: "Invite or join with a code",
          text: "From the trip, tap “Invite to the trip” and send the link or code to your companions. If you received a code, enter it under “Got an invite code?” and tap “Join”."
        }
      ],
      cta: {
        label: "Open KUMANI Travel",
        href: "/viaggi"
      }
    },
  ],
}

export default content
