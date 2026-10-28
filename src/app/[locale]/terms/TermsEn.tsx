import Link from '@/components/LocalizedLink'
import { CONTACT_INFO } from '@/lib/contactInfo'
import {
  ArrowLeft,
  Shield,
  Ticket,
  AlertTriangle,
  CheckCircle2,
  Scale,
  FileText
} from 'lucide-react'

// Traduzione inglese dei Termini di Servizio, fornita per comodità:
// in caso di differenze prevale il testo italiano (TermsIt.tsx).
// Ogni modifica al testo italiano va riportata anche qui.
export default function TermsEn({ lastUpdate }: { lastUpdate: string }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to home</span>
          </Link>
          <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full border border-indigo-100">
            <FileText className="w-3.5 h-3.5" />
            Updated on {lastUpdate}
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <Scale className="w-4 h-4" />
            Official document
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Terms of Service and Rewards Program Rules
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            This document sets out the rules for using the Kumani platform and transparently governs
            the Rewards Program: points, bonuses, coupons and exclusive initiatives.
          </p>
          <p className="text-gray-500 text-sm italic max-w-2xl mx-auto mt-3">
            This is an English translation provided for convenience. In case of any discrepancy, the Italian version prevails.
          </p>
        </div>

        {/* Contents */}
        <nav className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 mb-10">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Contents</h2>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-indigo-700">
            <li><a href="#sez-1" className="hover:underline">1. Purpose and scope</a></li>
            <li><a href="#sez-2" className="hover:underline">2. Registration and account</a></li>
            <li><a href="#sez-3" className="hover:underline">3. Subscription and fees</a></li>
            <li><a href="#promo-lancio" className="hover:underline">3-bis. Launch promotion (Early Bird Discount)</a></li>
            <li><a href="#sez-4" className="hover:underline">4. KUMANI Ecosystem services</a></li>
            <li><a href="#sez-5" className="hover:underline">5. Listings board and user content</a></li>
            <li><a href="#sez-6" className="hover:underline">6. KU Karma and KU Points</a></li>
            <li><a href="#sez-7" className="hover:underline">7. Rewards Program rules</a></li>
            <li><a href="#sez-8" className="hover:underline">8. No monetary compensation from KUMANI</a></li>
            <li><a href="#sez-9" className="hover:underline">9. Privacy and personal data</a></li>
            <li><a href="#sez-10" className="hover:underline">10. Limitation of liability</a></li>
            <li><a href="#sez-11" className="hover:underline">11. Changes, maintenance and continuity</a></li>
            <li><a href="#sez-12" className="hover:underline">12. Withdrawal, suspension and closure</a></li>
            <li><a href="#sez-13" className="hover:underline">13. Governing law, jurisdiction and use outside Italy</a></li>
            <li><a href="#sez-14" className="hover:underline">14. Contact</a></li>
          </ol>
        </nav>

        <div className="space-y-8">
          {/* 1 */}
          <section id="sez-1" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Purpose and scope</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                These Terms of Service (the &ldquo;Terms&rdquo;) govern access to and use of the
                Kumani platform (&ldquo;Kumani&rdquo; or the &ldquo;Platform&rdquo;), operated by {CONTACT_INFO.company.name},
                VAT No. {CONTACT_INFO.company.vatNumber} (the &ldquo;Operator&rdquo;),
                including the KUMANI Ecosystem (the set of interconnected digital tools offered by the Platform), the tools it includes and the Rewards Program described in article 7.
              </p>
              <p>
                By registering for or using the Platform, the user accepts these Terms in full.
                Anyone who does not wish to accept them, even in part, must not use the services.
              </p>
            </div>
          </section>

          {/* 2 */}
          <section id="sez-2" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Registration and account</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                Access to the restricted services requires creating an account with real, up-to-date and complete information.
                Only one account per person is allowed: creating multiple or fake accounts is a serious breach of the Terms.
                To continue using the Platform the profile must be completed; once completed, the personal details
                (first name, surname, date of birth, contact details and residence, occupation) can only be changed by submitting a
                reasoned request from one&apos;s profile, which is reviewed by the Staff, to protect the security of the community.
              </p>
              <p>
                The user is responsible for keeping their credentials safe and for all activities carried out with their account.
                The Platform may suspend or close accounts in the event of fraud, misuse of the tools or breach of these Terms.
              </p>
            </div>
          </section>

          {/* 3 */}
          <section id="sez-3" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Subscription and fees</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                Access to the KUMANI Ecosystem and its tools is offered on a subscription basis at the prices published on the Platform
                (currently the Plus plan at €59/year and the Pro plan at €169/year). The Pro plan includes the tools of the Plus plan; some tools
                are free for all members. The free trial of the Pro plan, when offered, gives access only to the Pro tools
                and the free tools and does not renew automatically. There are no hidden costs or additional fees for the features included.
              </p>
              <p>
                Payments are handled by authorised third-party providers. Before paying, the user expressly accepts these
                Terms and the Privacy Policy; the renewal date and price are shown next to the payment button.
                The annual subscription renews automatically unless cancelled: the user can turn off automatic renewal at
                any time, even immediately after purchase, using the &ldquo;Turn off automatic renewal&rdquo; button on the
                <em> Subscription</em> page, and will continue to enjoy the services until the end of the period already paid for. Between 30 and 15 days before
                each renewal the user receives an email with the charge date, the amount and the link to
                turn off renewal.
              </p>
              <p>
                When the plan expires, content remains saved and can be viewed by its owner, but content cannot be created or edited
                in tools that are no longer included. Linked public pages (for example Link in Bio and CV) are no longer
                visible to visitors until the plan is renewed; Digital Receipts, which are shared with another
                party, remain viewable online for 12 months after the plan expires.
              </p>
            </div>
          </section>

          {/* 3-bis: launch promotion */}
          <section id="promo-lancio" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">3-bis. Launch Promotion Terms (&ldquo;Early Bird Discount&rdquo;)</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                <strong>Purpose of the promotion.</strong> This initiative consists of a commercial discount on the subscription fee for the
                KUMANI service, reserved exclusively for the first 50 (fifty) users who register an account on the platform.
              </p>
              <p>
                <strong>Discount conditions.</strong> The first 50 users to register, in chronological order, will receive a discount of
                100% on the value of the Plus Plan (nominal list price: €59.00), reducing the cost of the service to zero for 12 (twelve) months from the
                activation date. The discount is applied automatically when registration is completed; no payment
                details are required. To use the Plus Plan services the user must complete their profile with real information
                (first name, surname, date of birth, telephone number, full address and occupation): until then, access to the services
                remains suspended.
              </p>
              <p>
                <strong>At the end of the 12 months.</strong> The promotional subscription does not renew automatically and does not involve any
                charge: when it expires, the user returns to the free plan and remains free to take out, if they wish, a subscription
                at the list price then in force.
              </p>
              <p>
                <strong>Exclusion from the scope of prize competitions and prize promotions.</strong> Please note that this initiative does not
                constitute a prize promotion within the meaning of Italian Presidential Decree (D.P.R.) 430/2001. It is solely a price reduction and a
                price differentiation for promotional and commercial launch purposes applied to the Operator&apos;s own services, as permitted
                by art. 6, paragraph 1, letter c) of D.P.R. 430/2001. No draw, no lottery: a promotional launch rate is applied
                based on the chronological order of registration until the 50 available places are filled.
              </p>
              <p>
                <strong>Limits.</strong> Once the 50 available promotional places have been filled, the platform will automatically apply the
                standard list price of €59.00 to subsequent members. The discount cannot be converted into cash, is not transferable and does not give
                any right to refunds. Staff accounts, the platform&apos;s service accounts, agents and users who
                already have an active subscription when the discount is applied are excluded.
              </p>
            </div>
          </section>

          {/* 4 */}
          <section id="sez-4" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. KUMANI Ecosystem services</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                The Platform provides digital tools such as, by way of example: a dynamic QR code generator,
                a Link in Bio page, messaging templates, personal organisation tools (MemoLife, Spendly, Life Calendar),
                tools for professionals (Pro plan), group tools (Kordata, KUMANI Travel, KUMANI Events), a listings board and further
                features that may be added or updated over time. The Ecosystem tools may exchange
                data of the same user (for example deadlines shown in a single agenda) solely for the operation of the services.
              </p>
              <p>
                <strong className="text-gray-900">Time Bank (KUMANI Time Bank).</strong> This is a free mutual-help service between
                verified adult users: one hour of help given is worth one hour of help to be received, whatever the service. Hours
                have no economic value, cannot be bought, refunded or converted into money, points or discounts. Exchanges are
                occasional and free of charge between private individuals: ongoing work, professional advice (legal, tax, medical,
                psychological) and dangerous work are excluded. The Platform puts people in touch and neither performs nor guarantees the services: each
                participant is responsible for what they offer and how they carry it out, including towards third parties. Each exchange must be confirmed by both
                parties; in the event of a dispute the Staff decides, and may remove listings and suspend anyone who does not follow the rules. The Platform
                may set balance and hour limits to prevent abuse.
              </p>
              <p>
                <strong className="text-gray-900">Collective artwork (KUMANI Mosaic).</strong> This is a free game in which users place
                a few coloured tiles every day on a shared canvas. The tiles placed form a collective artwork of the community:
                by taking part, the user agrees that their contribution remains in the artwork even after the season ends or the
                account is deleted (in anonymous form) and that the Platform may display and share it. Composing
                offensive, discriminatory, advertising or illegal text or images is not allowed: the Staff may remove the tiles of anyone who does not follow
                the rules and suspend their participation. The number of tiles per day and the requirements for taking part are set by the
                Platform.
              </p>
              <p>
                <strong className="text-gray-900">Stories (Kumani Fabula).</strong> This is a free creative writing game. Stories remain
                private until the user chooses to publish them in the gallery, where they are visible to members with the author&apos;s first name and the initial
                of their surname. Anyone who publishes declares that the text is their own and grants the Platform the right to display it in the gallery and in
                sharing images; they may withdraw or delete it at any time. Content that is offensive, discriminatory,
                advertising, illegal or that concerns real people without their consent is not allowed. Stories by new members and stories that have been reported
                may be checked, hidden or removed by the Staff.
              </p>
              <p>
                <strong className="text-gray-900">Verification tools (SVAT, VeriFoto, CheckMail).</strong> The results are automatic indications and do not
                constitute an expert assessment or a guarantee of the reliability of websites, companies, images or emails: no automatic
                check detects 100% of scams. In CheckMail the email is analysed on the spot and is not stored
                by the Platform; the text may also be read by an artificial intelligence provider. In VeriFoto the basic checks
                take place on the user&apos;s device without uploading the photo; only if the user chooses to, a reduced copy stripped of
                metadata is sent to an external detection provider for analysis and is not stored by the
                Platform. The user must upload only images they have the right to use.
              </p>
              <p>
                <strong className="text-gray-900">Phone-to-computer transfer (Hoplà).</strong> Files travel directly between
                the user&apos;s devices over an encrypted peer-to-peer connection (WebRTC with DTLS encryption): they are not uploaded
                to or stored on the servers of the Platform or of other providers, and the Platform cannot see their content. To connect
                the two devices, only technical connection data (such as the devices&apos; network addresses) is exchanged
                for a few moments, through the Platform&apos;s infrastructure provider and a network discovery service;
                this data does not contain the files. The QR code is valid only while the page remains open on the computer, and each transfer must be
                confirmed by the recipient. The user is solely responsible for the files they send and receive: they must have the right to
                use and share them and may not transfer unlawful, violent, pornographic or offensive content, malicious software or files
                that infringe the confidentiality or rights of third parties. Hoplà is not a storage or backup service: the user
                always keeps a copy of their own files. The transfer depends on the network and the devices (for example, it may be interrupted when switching
                networks or when the screen is off) and is not guaranteed; the Platform is not liable for interrupted or
                incomplete transfers, without prejudice to the consumer rights provided for by law. In the event of misuse the Platform may
                suspend access to the service.
              </p>
              <p>
                <strong className="text-gray-900">Document signing (Sign PDF).</strong> The document is opened, signed and saved
                on the user&apos;s device: it is not uploaded to or stored on the Platform&apos;s servers. The signature applied with
                Sign PDF is a simple electronic signature: by confirming, the user accepts that it represents their own signature on the
                documents they sign, but it is not a qualified or advanced digital signature; its value is freely assessable under the
                law (in Italy, art. 20 of the Digital Administration Code) and for acts for which the law requires a qualified
                signature or an authenticated written form, other tools are needed. Only the user who uses the service signs:
                the user must sign only in their own name and only documents they have the right to sign, and is responsible for their
                content. The signature can be remembered, at the user&apos;s choice, only in their browser&apos;s storage.
              </p>
              <p>
                <strong className="text-gray-900">Community reports (Anti-Scam Network).</strong> Members can report
                phone numbers, websites, IBANs, email addresses, social media profiles and QR codes used for scams. Only this data may be reported,
                never people&apos;s names, and only genuine experiences: false or defamatory reports, or reports made to harm someone, are prohibited
                and may lead to the suspension of the account. Reports are checked by the Staff before becoming an
                alert, visible to anyone who checks the same data with the Platform&apos;s tools, together with the number of reports, the
                type of scam and the accounts given, without the name of the person who reported (at most the city). Alerts indicate a risk reported
                by the community and are not a formal finding: a number can be spoofed by third parties. Anyone who believes an alert is wrong (for
                example the holder of the number or the owner of the website) can dispute it from the alert itself or by writing to support@kumani.io; the Staff
                withdraws it if the dispute is well-founded. Alerts expire after 12 months without new reports; attached screenshots
                are seen only by the Staff and are deleted after the decision. A report to the community does not replace a report to the
                authorities.
              </p>
              <p>
                <strong className="text-gray-900">Community events (KUMANI Events).</strong> Events are organised by
                verified users, who are solely responsible for them (running the event, safety of the venue, permits and tax obligations).
                The Platform provides the tools (publication, registrations, passes and check-in), approves the first events of each
                organiser and may remove events or suspend organisers in the event of well-founded reports. Events for
                political purposes or religious proselytising, gambling and adult content not declared as 18+ are prohibited.
                Organisers and participants accept a code of conduct based on mutual respect and freedom from harassment.
              </p>
              <p>
                Any price indicated by the organiser is stated for information purposes only and is paid directly
                to the organiser: the Platform does not collect any sums on behalf of participants. Once the event has ended, the Platform
                charges the organiser a management fee equal to the percentage published at the time the
                event was created, calculated on the stated price multiplied by the number of registered participants; until the fee is paid
                the organiser cannot publish new events. Amounts below the minimum that can be paid by card are added to
                subsequent ones. Participants&apos; data is visible only to the organiser and used only to manage the event.
                After the event, participants can leave a review (rating and comment, published with their first name only):
                the average of the reviews and the history of events determine the organiser&apos;s level, which may also
                be lowered in the event of low ratings or events removed by the Staff. When the organiser uses check-in,
                participants&apos; absences are recorded and shown to the organisers of their subsequent events.
              </p>
              <p>
                An event may recur on several dates (series): each date is a separate event, with its own registrations, check-in, reviews and
                fee. If the organiser has an active Kumi Card and indicates this in the event, anyone who checks in
                automatically receives a stamp on the organiser&apos;s Kumi Card, according to the rules of that card: the
                card is created and linked to the participant&apos;s account, who finds it in the event page, and
                the organiser sees, among the customers of their Kumi Card, the first name and initial of the surname, the stamps and the rewards
                redeemed. This information is shown on the event page before registration.
              </p>
              <p>
                <strong className="text-gray-900">Group purchases (Kordata).</strong> Kordatas are proposed by verified users
                (organisers) and payment is made directly between participants and supplier: the Platform does not collect sums on
                behalf of third parties. When a Kordata with a professional supplier registered on the Platform becomes &ldquo;ordered&rdquo;,
                the Platform charges the supplier a management fee equal to the percentage communicated at the time of its
                acceptance, calculated on the group price for the quantities booked; until the fee is paid the supplier
                cannot accept new Kordatas. Amounts below the minimum that can be paid by card are added to subsequent ones.
              </p>
              <p>
                <strong className="text-gray-900">Identity verification.</strong> To propose Kordatas or organise events a
                verified identity is required: by means of an Italian tax code (codice fiscale) or by means of an identity document
                (passport, identity card, driving licence or residence permit) reviewed by the Staff. The image of the document
                is kept in a private archive, is visible only to the authorised Staff and is deleted immediately after verification:
                the Platform keeps only the outcome (approved or rejected), the type of document and the issuing country.
              </p>
              <p>
                The services are provided as they are and subject to availability. The Platform does not constitute an investment
                offer, a job opportunity or a promise of earnings: any result depends on the user&apos;s independent use of the tools.
              </p>
            </div>
          </section>

          {/* 5 */}
          <section id="sez-5" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Listings board and user content</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                Users are solely responsible for the content they publish (listings, images, contact details and offers).
                Unlawful, misleading or offensive content, or content that infringes the rights of third parties, is prohibited.
              </p>
              <p>
                The Platform merely makes digital spaces available: it is not a party to the relationships,
                agreements or transactions that arise between users and may remove non-compliant content without notice.
              </p>
            </div>
          </section>

          {/* 6 */}
          <section id="sez-6" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. KU Karma and KU Points</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                <strong className="text-gray-900">KU Karma.</strong> Using the services (daily login, use of the tools,
                other activities indicated on the Platform) earns KU Karma, in the amounts set by the Platform, which
                may change over time. The public leaderboard represents the level of activity and does not constitute a promise of earnings.
              </p>
              <p>
                <strong className="text-gray-900">KU Points.</strong> The user receives KU Points when a person they
                invited directly activates a subscription paid by card (Plus or Pro), upgrades from the Plus plan to the Pro plan (in
                proportion to the amount paid) or buys a pass, and through the Welcome Bonus. An invited person takes their place
                in the network (&ldquo;Your Kumani&rdquo;) only when they activate the subscription: until then they do not occupy any place. The Welcome
                Bonus is awarded when one of the user&apos;s five direct places is taken by a person invited
                by another user (spillover, or a place indicated by the person who invited them) who activates the subscription by card: part
                of the KU Points from the activation goes not to the person who invited them but to the user who welcomes that person among their Kumani.
                The amounts are set by the Platform and shown in the personal area. KU
                Points become final 15 days after the payment that generated them (the period for any withdrawal): until
                then they are visible but do not count towards qualifications and cannot be used. Activations via voucher and renewals do not earn KU Points; if the
                payment is refunded, the related points are removed.
              </p>
              <p>
                KU Points are used to showcase listings and for donations to the association supported by KUMANI.
                The Kuman Green, Kuman Star and Kuman Black qualifications are achieved with a minimum number of Plus or Pro activations
                paid by card by directly invited people and a minimum total number of KU Points earned (requirements
                shown in the personal area); once achieved, they give the reward vouchers described in section 7.8.
              </p>
            </div>
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-green-800 text-sm leading-relaxed">
                <strong>Transparency:</strong> KU Karma and KU Points are not money: KUMANI does not pay them out, refund them or
                convert them into cash. Simply registering other users, without a paid subscription, does not earn points.
              </p>
            </div>
          </section>

          {/* 7 */}
          <section id="sez-7" className="bg-white rounded-2xl border-2 border-indigo-200 p-6 sm:p-8 scroll-mt-24">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Ticket className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">7. Rewards Program Rules (Bonuses and Coupons)</h2>
            </div>

            <div className="text-gray-600 space-y-4 text-sm sm:text-base leading-relaxed">
              <p>
                <strong className="text-gray-900">7.1 Nature of the program.</strong> The Rewards Program is a loyalty initiative
                reserved for active subscribers. The benefits granted (bonuses and coupons) are commercial benefits
                linked to the use of the Platform&apos;s services. The program does not constitute a prize competition, a prize promotion
                or a game of chance or skill subject to authorisation, as it falls within the cases excluded from the applicable
                legislation (including, insofar as relevant, art. 6 of Italian Presidential Decree (D.P.R.) 430/2001), since the benefits are linked to the services
                offered by the Platform itself and not to mere games of chance.
              </p>
              <p>
                <strong className="text-gray-900">7.2 Types of benefits.</strong> The program may grant: (a) discount coupons
                usable within the KUMANI Ecosystem or with participating partners; (b) bonus points; (c) free periods of premium services;
                (d) access to exclusive initiatives reserved for active members.
              </p>
              <p>
                <strong className="text-gray-900">7.3 Exclusive initiatives.</strong> From time to time the Platform may organise
                promotional initiatives and awards reserved for active members. Each initiative will be announced with its own
                public rules (duration, participation requirements, nature of the benefits), available to read before joining.
                Participation is always voluntary and free of charge.
              </p>
              <p>
                <strong className="text-gray-900">7.4 Characteristics of the benefits.</strong> Bonuses, coupons and points are personal,
                non-transferable and cannot be converted into money with KUMANI. They do not constitute electronic money or
                accumulable value redeemable for cash. Vouchers, governed by section 7.8, are an exception.
              </p>
              <p>
                <strong className="text-gray-900">7.5 Expiry.</strong> Each bonus or coupon may carry an expiry date,
                communicated when it is granted. On expiry the benefit automatically ceases, with no right to a refund or recovery.
              </p>
              <p>
                <strong className="text-gray-900">7.6 Anti-fraud.</strong> In the event of fraudulent use (multiple accounts, automation,
                manipulation of points or coupons), the Platform may cancel the points and benefits accrued and suspend or close the account,
                without prejudice to any further legal remedies.
              </p>
              <p>
                <strong className="text-gray-900">7.7 Changes to the program.</strong> The Platform may change the Rewards Program
                by giving notice on this page. Benefits already granted remain valid under the conditions communicated when they were granted.
              </p>
              <p>
                <strong className="text-gray-900">7.8 Vouchers.</strong> On achieving a qualification the user receives in their
                personal area vouchers that activate a one-year KUMANI Plus subscription for a new person (the number of vouchers for
                each qualification is shown in the personal area); with Kuman Black they also receive a one-year Pro voucher usable for
                themselves and, after Kuman Black, one voucher for every number of new activations indicated by the Platform. Whoever generated a
                voucher cannot use it for themselves, except for the personal Pro voucher. Activations made with a voucher do not earn KU
                Points and do not count towards qualifications. If a refund means the requirements for a qualification are no longer met, any reward vouchers
                not yet used are cancelled. Vouchers are not refundable or convertible into money with KUMANI.
              </p>
              <p>
                KUMANI grants Vouchers as a promotional incentive in the form of a 100% discount on its own services.
                Any transfer, monetisation or resale of Vouchers to third parties by the user (Promoter) takes place
                entirely independently and under their sole responsibility: KUMANI is not a party to the transfer and the receipt that the
                Platform allows the user to prepare is the user&apos;s own document. It is the Promoter&apos;s responsibility to fulfil the tax and
                reporting obligations laid down by the legislation of their country of residence with regard to income deriving from such activities.
              </p>
              <p>
                <strong className="text-gray-900">7.9 Service pass.</strong> Some services, indicated on their page, can be
                activated individually for one year, without a subscription, with a one-off payment or with a pass code. The pass does not
                renew automatically. On the first purchase of a service pass, the person who invited the user may receive the KU Points
                indicated by the Platform for that service; in the event of a refund they are removed. If the user later activates a
                Plus or Pro subscription that includes services for which they have a paid pass that is still active, the unused part of the pass
                (calculated in proportion to the remaining days) is deducted from the first subscription payment and those
                passes end, replaced by the subscription; the KU Points for the activation are calculated in proportion
                to the amount actually paid. The same withdrawal and refund rules as for
                subscriptions apply to the purchase of a pass; in the event of a refund the pass is deactivated.
              </p>
            </div>

            <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm leading-relaxed">
                KU Points depend on the subscriptions paid by the people invited (section 6). No earnings are guaranteed or
                promised: the value of vouchers is a discount on KUMANI services, and whatever the user obtains by transferring them to
                third parties depends solely on them and falls under their responsibility (section 7.8).
              </p>
            </div>
          </section>

          {/* 8 */}
          <section id="sez-8" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. No monetary compensation from KUMANI</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                KUMANI does not pay users commissions, percentages or any other monetary compensation for invitations or for subscriptions
                purchased by the people invited. The only benefits linked to invitations are the KU Points and vouchers
                described in sections 6 and 7, which are not money and cannot be converted into cash with KUMANI.
              </p>
              <p>
                The referral and community organisation features (invite codes, matrix, contact network) serve to
                organise the community and share content. Sales Agents appointed by KUMANI operate under a
                separate contract, with a VAT number and commissions governed by that contract.
              </p>
            </div>
          </section>

          {/* 9 */}
          <section id="sez-9" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Privacy and personal data</h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              The processing of personal data is governed by the Privacy Policy available in the{' '}
              <Link href="/privacy" className="text-indigo-600 font-semibold hover:underline">Privacy</Link>
              {' '}section, in accordance with Regulation (EU) 2016/679 (GDPR) and the applicable national legislation.
            </p>
          </section>

          {/* 10 */}
          <section id="sez-10" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">10. Limitation of liability</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                The Platform is not liable for: content published by users; agreements and transactions between users;
                service interruptions due to force majeure or third-party providers; indirect damage resulting
                from the use of the tools.
              </p>
              <p>
                In any case, liability for wilful misconduct or gross negligence, and liability that cannot be excluded by law for the protection of consumers, remain unaffected.
              </p>
            </div>
          </section>

          {/* 11 */}
          <section id="sez-11" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">11. Changes, maintenance and continuity</h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              The Platform may carry out scheduled maintenance, announced where possible by means of a notice (maintenance mode),
              and change features or these Terms for technical or regulatory reasons. Material changes will be
              communicated reasonably in advance; continuing to use the services constitutes acceptance.
            </p>
          </section>

          {/* 12 */}
          <section id="sez-12" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">12. Withdrawal, suspension and closure</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                <strong>Right to withdraw from the subscription.</strong> A consumer user may withdraw from the paid
                subscription (Plus or Pro, including the upgrade from Plus to Pro) within 14 days of each payment, without giving any reason,
                from the <em>Subscription</em> page of the personal area (&ldquo;Exercise the right of withdrawal&rdquo;) or by
                any explicit statement sent via the Contact page. The refund is made within 14 days of the request, using
                the same means of payment used, and the subscription is closed when the refund is made.
              </p>
              <p>
                When paying, the consumer user expressly requests that the subscription (or the Pass) start immediately, during the
                withdrawal period: this request does not cause the loss of the right of withdrawal. In that case, if they withdraw, they receive a refund of only the unused part of the subscription, calculated in
                proportion to the days elapsed up to the withdrawal request (art. 57, paragraph 3, of the Italian Consumer Code). The request for immediate
                start is recorded with the date, time and text accepted.
              </p>
              <p>
                <strong>Purchases by businesses and professionals.</strong> Anyone who purchases the subscription for their own business
                or professional activity, stating their company name and VAT number and declaring this at payment, is not a consumer:
                for these purchases the 14-day right of withdrawal does not apply and the amount paid is not refundable, except in the cases
                provided for by law.
              </p>
              <p>
                After each payment (first purchase, upgrade to Pro, renewal, purchase of a Pass) the user receives by email the
                confirmation of the contract, with the purchase summary, the date and price of the automatic renewal (for subscriptions),
                the acceptance of the Terms and, for consumers, confirmation of the request for immediate start and instructions for
                withdrawal.
              </p>
              <p>
                Cancellation (from the Subscription page → &ldquo;Turn off automatic renewal&rdquo; or &ldquo;Manage or cancel
                subscription&rdquo;), on the other hand, stops subsequent renewals: the period already paid for remains active until expiry and does not give
                any right to a refund, without prejudice to the right of withdrawal within 14 days of payment. A request to delete the account
                immediately turns off automatic renewal.
              </p>
              <p>
                The user may also withdraw at any time by deleting their account: unused points, bonuses and coupons
                lapse at the time of deletion, with no right to compensation.
              </p>
              <p>
                The Platform may suspend or close accounts in breach of the Terms, with consequent forfeiture of the benefits accrued.
              </p>
              <p>
                During the suspension access is blocked and the account&apos;s public content (listings on the Board, presence in the
                leaderboards and in Spotlight, Link in Bio and CV) is not visible to other users; the invite code cannot be used
                for new registrations. The content is not deleted and becomes visible again if the suspension is lifted.
              </p>
            </div>
          </section>

          {/* 13 */}
          <section id="sez-13" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">13. Governing law, jurisdiction and use outside Italy</h2>
            <div className="text-gray-600 space-y-3 text-sm sm:text-base leading-relaxed">
            <p>
              These Terms are governed by Italian law. For disputes with consumer users, the court with jurisdiction is
              the one mandatorily established by law; for other users, the court of the place where the Platform operator is established.
              The option of using alternative dispute resolution procedures (ADR/ODR) remains unaffected.
              The mandatory consumer protection rules of the user&apos;s country of residence nevertheless continue to apply.
            </p>
            <p>
              The Platform was created in Italy and some features are designed in accordance with Italian legislation: identity
              verification via the Italian tax code (codice fiscale), the tax references in quotes and digital receipts, the Rewards
              Program (framed under the Italian rules on prize promotions), group purchases (Kordata)
              and events with payment on site. In other countries, where different laws apply (for example on consumer
              protection, prize promotions, events, invoicing, wellbeing and health-related tools, minimum age),
              some features may be reduced, modified, require different checks or be unavailable.
            </p>
            <p>
              Users who use the Platform outside Italy must comply with the rules of their own country,
              in particular when selling goods or services (Kordata suppliers, event organisers, professionals) and for the
              related tax obligations. The Platform may restrict access to individual features in certain countries
              where this is necessary to comply with local legislation.
            </p>
            </div>
          </section>

          {/* 14 */}
          <section id="sez-14" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-gray-900 mb-3">14. Contact</h2>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-4">
              For any questions about these Terms or the Rewards Program, you can contact the Platform Operator
              ({CONTACT_INFO.company.name}, VAT No. {CONTACT_INFO.company.vatNumber}) by writing to{' '}
              <a href={`mailto:${CONTACT_INFO.company.email}`} className="text-indigo-600 font-semibold hover:underline">{CONTACT_INFO.company.email}</a>{' '}
              or through the{' '}
              <Link href="/contact" className="text-indigo-600 font-semibold hover:underline">Contact</Link> page.
            </p>
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex gap-3">
              <Shield className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <p className="text-indigo-800 text-sm leading-relaxed">
                This document is published in a spirit of full transparency towards the community.
                Please read it carefully and let us know about anything that is unclear.
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t py-8 mt-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
          © 2026 Kumani — Terms of Service and Rewards Program Rules, updated on {lastUpdate}.
        </div>
      </footer>
    </div>
  )
}
