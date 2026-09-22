// Static content extracted from the myQode web app pages. Plain data only.

export const PHILOSOPHY = {
  title: `Qode Philosophy`,
  intro: [],
  sections: [
    { h: `Who We Are`, p: [`Qode is a SEBI-registered Portfolio Management Service (PMS) built on the principle that evidence, not opinion, should drive investment decisions. Founded by seasoned professionals with over a decade of experience in Indian markets, we exist to give investors a disciplined, transparent, and performance-oriented platform for long-term wealth creation.`] },
    { h: `What We Do`, p: [`We design and manage differentiated investment strategies that combine the power of quantitative models with the insight of fundamental research. Our range spans ETF-only portfolios, systematic momentum strategies, diversified growth funds, and high-conviction stock picks—offering clients the flexibility to align with their goals and risk appetite.`] },
    { h: `How We Work`, p: [`At Qode, every investment decision is guided by data, tested frameworks, and structured review processes. We believe in clarity over complexity: our clients receive concise updates that explain what we hold, why we hold it, and when we make changes. With bank-grade custody, strong operational controls, and a proactive investor support team, we ensure the experience is as robust as the strategy itself.`] },
    { h: `Why It Matters`, p: [`Markets are noisy and narratives change quickly. Qode’s approach is designed to cut through that noise. By combining systematic rigor with long-term conviction, we aim to protect portfolios in challenging times while positioning them to capture opportunities that can compound meaningfully over years.`] },
  ],
};

export const FOUNDATION = {
  title: `Note from Fund Managers`,
  intro: [],
  sections: [
    {
      h: `Rishabh Nahar`,
      p: [
        `Fund Manager`,
        `Investing, to me, has always been about process. Markets are unpredictable in the short run, but data, when studied carefully, reveals patterns that can guide us with discipline.`,
        `At Qode, our approach is rooted in systematic models that help us identify opportunities objectively, free from bias or noise.`,
        `But models alone are not enough — they must be applied with judgment, constant review, and a deep respect for risk. That's why we combine quantitative insights with robust portfolio construction, always seeking to maximize outcomes while protecting against drawdowns.`,
        `My goal is simple: to give investors confidence that every decision we take is grounded in evidence, tested rigorously, and aligned with the long-term compounding of their wealth.`,
      ],
    },
    {
      h: `Gaurav Didwania`,
      p: [
        `Fund Manager`,
        `Over the last 15+ years in Indian markets, I've seen cycles of euphoria and panic, trends that come and go, and businesses that either endure or fade.`,
        `What I've learned is that wealth creation doesn't come from chasing momentum alone — it comes from conviction in the right businesses and the patience to stay invested through volatility.`,
        `At Qode, I focus on marrying deep fundamental research with a long-term mindset. We look beyond stock prices to understand management quality, competitive advantage, financial strength, and industry dynamics.`,
        `For me, Qode is about trust and transparency — ensuring our investors not only achieve returns, but also understand the rationale behind every decision. That understanding builds confidence, and confidence is what allows compounding to work its magic.`,
      ],
    },
    { h: `Mission`, p: [`To support investors with data-driven, high-quality investment solutions that deliver superior risk-adjusted returns.`] },
    { h: `Vision`, p: [`To transform investment management with innovation and discipline, creating lasting value for our investors.`] },
  ],
};

// The source page has no separate benchmark field; left empty.
export const STRATEGIES = [
  {
    prefix: `QAW`,
    name: `Qode All Weather (QAW)™`,
    benchmark: ``,
    tagline: `Qode All Weather (QAW) is a multi-asset portfolio crafted to deliver consistent long-term performance without timing the markets. This robust framework ensures strong probability of outperforming large cap indices over longer horizons.`,
    points: [`Large cap Alpha`, `Highest Sharpe*`, `Smart Asset Mix`, `Downside Cushion`],
  },
  {
    prefix: `QTF`,
    name: `Qode Tactical Fund (QTF)™`,
    benchmark: ``,
    tagline: `Qode Tactical Fund harnesses the power of momentum, systematically allocating to the strongest market trends while avoiding laggards. This allows the strategy to capture upside faster and deliver higher long-term returns.`,
    points: [`Momentum Driven`, `Tactical Rebalance`, `Regime Switch`, `Hedge Overlay*`],
  },
  {
    prefix: `QGF`,
    name: `Qode Growth Fund (QGF)™`,
    benchmark: ``,
    tagline: `Qode Growth Fund (QGF) is a factor-based small-cap strategy designed to outperform over long periods. The strategy identifies fundamentally strong, high-growth businesses using a disciplined quantitative model.`,
    points: [`Quantitative Strategy`, `Small cap focused`, `Multifactor Model`, `Growth Investing`],
  },
];

export const STRATEGY_GLOSSARY = [
  { term: `Highest Sharpe*`, def: `A measure of risk-adjusted returns - higher values indicate better performance per unit of risk taken.` },
  { term: `Hedge Overlay*`, def: `Risk management technique using derivatives to protect against adverse market movements while maintaining upside potential.` },
  { term: `Uncharted*`, def: `Investing in lesser-known companies with limited analyst coverage, potentially offering undiscovered opportunities.` },
];

// The team page lists roles/channels (no named individuals). name = role heading, role = "Role"/"Purpose" text, bio = "When to Contact" text.
export const TEAM = [
  {
    name: `Fund Manager`,
    role: `Oversees your portfolio strategy and ensures alignment with Qode's philosophy.`,
    bio: `Strategy-specific queries and high-level portfolio discussions.`,
  },
  {
    name: `Investor Relations`,
    role: `Your regular point of contact. Shares monthly updates, schedules review calls, and addresses queries. Also helps with operations: onboarding, top‑ups, withdrawals, portal access.`,
    bio: `For reports, account queries, operational clarifications, and all quarterly/annual reviews.`,
  },
  {
    name: `Book A Call`,
    role: `Quick, hassle‑free scheduling of calls with your IR team.`,
    bio: ``,
  },
  {
    name: `WhatsApp/Email`,
    role: `Instant, informal, and quick communication.`,
    bio: `WhatsApp (IR Desk): +91 98203 00028 (9 AM – 5 PM). Email: investor.relations@qodeinvest.com. Join Qode Investor Circle: WhatsApp community for Qode investors.`,
  },
];

export const FAQ = [
  {
    topic: `Top-ups`,
    items: [
      { q: `Q1. How do I add more funds to my account?`, a: `You can top-up anytime via Cashfree. Execution happens once funds reflect (T+1).` },
      { q: `Q2. Can I set up a SIP?`, a: `Yes, we offer a Systematic Investment Plan option where fixed amounts are invested at set intervals.` },
      { q: `Q3. Can I set up a Systematic Transfer Plan (STP)?`, a: `Yes. We offer a Systematic Transfer Plan, where funds can be parked in the Qode Liquid Fund (QLF) and periodically transferred into core strategy portfolios.` },
      { q: `Q4. How much amount of top-up can an investor do?`, a: `Top-ups can be made in multiples of ₹1 lakhs, provided the total portfolio value remains above the SEBI-mandated minimum of ₹50 lakhs.` },
    ],
  },
  {
    topic: `Withdrawals`,
    items: [
      { q: `Q5. How do I withdraw money from my PMS account?`, a: `Submit a withdrawal request through our portal. Proceeds are credited to your bank account, typically within T+10 days.` },
      { q: `Q6. Is there any lock-in period for withdrawals?`, a: `No lock-in. Withdrawals are processed as per SEBI PMS guidelines. Partial withdrawals must maintain required minimums.` },
    ],
  },
  {
    topic: `Fees`,
    items: [
      { q: `Q7. How are fees charged?`, a: `Management fees are billed quarterly. Performance fees apply annually on the High Watermark principle.` },
      { q: `Q8. Do fees include GST?`, a: `Yes, all fees are subject to GST at prevailing rates.` },
    ],
  },
  {
    topic: `Taxes`,
    items: [
      { q: `Q9. Will Qode deduct taxes from my account?`, a: `Qode does not deduct capital gains tax. Investors are responsible for filing taxes; we provide tax packs annually.` },
      { q: `Q10. What about TDS on referral rewards or other payments?`, a: `Yes, referral rewards are subject to TDS as per law. Investment returns are not.` },
      { q: `Q11. Do you do Tax Loss Harvesting?`, a: `No. We do not undertake tax-loss harvesting within PMS portfolios, as our focus remains on evidence-based, long-term investing.` },
      { q: `Q12. Will I receive tax statements?`, a: `Yes. Investors receive annual tax packs, including realized and unrealized gains, dividend records, and other relevant documentation to assist with tax filing.` },
    ],
  },
  {
    topic: `Minimums & Customization`,
    items: [
      { q: `Q13. What is the minimum investment required?`, a: `As per SEBI regulations, the minimum investment for Portfolio Management Services is ₹50 lakhs.` },
      { q: `Q14. Can I customize my portfolio?`, a: `No. All clients within a strategy hold the same model portfolio to maintain fairness, transparency, and evidence-driven execution.` },
    ],
  },
  {
    topic: `Portal Access`,
    items: [
      { q: `Q15. How do I log in to see my portfolio?`, a: `Log in via WealthSpectrum using your registered email id below is the link (https://eclientreporting.nuvamaassetservices.com/wealthspectrum/app/loginWith)` },
      { q: `Q16. What if I forget my login password?`, a: `Use the 'Forgot Password' option on WealthSpectrum or contact our IR team for assistance.` },
    ],
  },
  {
    topic: `Risk & Operations`,
    items: [
      { q: `Q17. Can my portfolio lose value?`, a: `All investments carry risk, though Qode's strategies use discipline, diversification, and hedging to manage downside.` },
      { q: `Q18. How do you manage risk in extreme markets?`, a: `We follow defined risk controls — hedging policy, drawdown protocols, liquidity rules, and concentration discipline.` },
      { q: `Q19. Who holds custody of my assets?`, a: `Assets are held in your demat account with SEBI-registered custodians. Qode manages investments via POA only.` },
      { q: `Q20. What happens if Qode's systems go down?`, a: `We follow Business Continuity & Disaster Recovery (BCP/DR) protocols to ensure uninterrupted operations and client access.` },
      { q: `Q21. Can I switch between strategies?`, a: `Yes. Clients can request a strategy switch during the monthly rebalance cycle, subject to reallocation guidelines.` },
    ],
  },
];

export const GLOSSARY = [
  { term: `XIRR`, def: `Extended Internal Rate of Return that accounts for cash flows at different times.` },
  { term: `HWM (High Watermark)`, def: `The highest NAV reached; ensures performance fees are charged only on gains above that level.` },
  { term: `Benchmark`, def: `A reference index used to measure portfolio performance.` },
  { term: `Drawdown`, def: `The peak-to-trough decline in portfolio value, usually expressed as a percentage.` },
  { term: `STP (Systematic Transfer Plan)`, def: `Allows phased transfer of funds from a liquid portfolio into equity strategies.` },
  { term: `Custodian`, def: `A SEBI-registered entity that safeguards client funds and securities.` },
  { term: `Protective Put`, def: `An options contract used to limit downside risk by providing insurance against large market declines.` },
  { term: `Rebalancing`, def: `The process of aligning client portfolios back to the model portfolio to maintain uniformity and discipline.` },
  { term: `SEBI`, def: `The Securities and Exchange Board of India — the regulator for securities markets.` },
];

export const GRIEVANCE = {
  intro: [
    `We take every investor query seriously. If something isn't resolved quickly by our Investor Relations team, this structured framework ensures clarity and accountability.`,
  ],
  levels: [
    {
      level: `Level 1`,
      title: `Investor Relations (IR)`,
      body: [
        `Role: Your first point of contact for all queries — from portfolio updates to operational requests.`,
        `Response SLA: Within 1 business day.`,
      ],
      contact: [`investor.relations@qodeinvest.com`, `WhatsApp IR Desk`],
    },
    {
      level: `Level 2`,
      title: `Compliance Officer`,
      body: [
        `Role: If an issue isn't resolved by IR, it's escalated to the Compliance Officer for review and redressal.`,
        `Scope: Regulatory matters, delayed responses, or unresolved service issues.`,
        `Escalation Timeline: Within 24 hours of non‑resolution at Level 1.`,
      ],
      contact: [`compliance@qodeinvest.com`],
    },
    {
      level: `Level 3`,
      title: `Principal Officer`,
      body: [
        `Role: Final level of escalation, handled directly by the Principal Officer.`,
        `Scope: Persistent grievances or concerns requiring senior oversight.`,
        `Escalation Timeline: If unresolved at Compliance level within prescribed timeframes.`,
      ],
      contact: [`karan.salecha@qodeinvest.com`],
    },
  ],
  protection: [`All complaints and resolutions are documented and reviewed periodically.`],
};

export const RISK = {
  intro: [`Key operating policies that guide portfolio construction and risk management.`],
  policies: [
    { title: `Hedging Policy`, body: [`We use derivatives prudently to manage downside risk, not for speculation. Protective put options & hedges are employed where appropriate to safeguard portfolios against significant market declines.`] },
    { title: `Liquidity Rules`, body: [`We follow a defined liquidity policy to ensure capital is available for hedging and client needs.`] },
    { title: `Rebalance Policy`, body: [`All portfolios are rebalanced monthly, realigning holdings to strategy weights to control drift.`] },
    { title: `Concentration Limits`, body: [`We impose no sector caps; portfolios are built bottom‑up, with structural gold allocations.`] },
  ],
};

export const CADENCE = {
  title: `Reports & Reviews`,
  intro: [
    `Stay consistently informed with structured reports and timely reviews. From monthly updates to annual reviews, everything is designed to keep you aligned with your portfolio and goals.`,
  ],
  sections: [
    {
      h: `Monthly Report`,
      p: [
        `We will send fund-level performance; individual returns may differ`,
        `Delivered via Email — How: Sent directly to your registered email ID.`,
        `Performance Updates — Content: Performance summary across Qode strategies (QAW, QTF, QGF).`,
        `Timeline & Purpose — Timeline: Within the first 15 days of the following month.`,
        `Purpose: Keeps you updated consistently, without waiting for quarterly or annual reviews.`,
      ],
    },
    {
      h: `Quarterly Report`,
      p: [
        `Regulatory Disclosure — Mandated by SEBI: Shared within 15 days of quarter‑end.`,
        `What You Receive: Portfolio holdings & transactions`,
        `What You Receive: Performance vs. benchmark`,
        `What You Receive: Regulatory disclosures`,
        `Why It Matters — Purpose: Ensures full transparency and keeps you aligned with your portfolio on a regulatory‑mandated frequency.`,
      ],
    },
    {
      h: `Annual Review`,
      p: [
        `One‑on‑One Engagement — Format: Review session with your Fund Manager and Investor Relations team.`,
        `Deep‑Dive Agenda: Annual performance across strategies`,
        `Deep‑Dive Agenda: Risk‑return attribution & positioning`,
        `Deep‑Dive Agenda: Forward outlook & strategic adjustments`,
        `Cadence & Outcomes — Timeline: Once every year.`,
        `Purpose: Align long‑term goals, review progress, and set expectations for the year ahead.`,
      ],
    },
    {
      h: `Response SLA`,
      p: [
        `Standard Queries — Email / WhatsApp: Response within 1 business day.`,
        `Operational Requests — Top‑up, withdrawal, KYC: Acknowledged next day, executed as per regulatory timelines.`,
        `Escalations — Routing: Escalated within 24 hours to Compliance if not resolved.`,
      ],
    },
  ],
};

export const REFERRAL = {
  title: `Refer an Investor`,
  intro: [
    `Share the Qode experience. Earn rewards for helping us grow together. At Qode, we value the trust you place in us. If you know someone who would benefit from disciplined, evidence‑based investing, you can refer them to us and earn rewards once their investment begins.`,
  ],
  points: [
    `Reward: ₹15,000 for every ₹50 lakh of fresh investments referred.`,
    `Example: Referral of ₹1 Cr = ₹30,000 reward.`,
    `Eligibility: Reward applicable once the referred investor's funds are deployed.`,
    `Payout Timeline: Processed within 30 days of investment confirmation.`,
    `Tax: Subject to TDS as per applicable law.`,
  ],
};

export const VOICE = {
  title: `Why Your Feedback Matters`,
  intro: [
    `Every portfolio at Qode is built with discipline, but the way we serve you is shaped by listening. Your input tells us what we’re doing right, what we can refine, and how we can make your experience smoother.`,
    `Whether it’s the clarity of our reports, the ease of a top-up, or the value of review calls, your perspective helps us get better—step by step.`,
    `Why Your Experience Matters`,
    `Numbers tell part of the story. The other part is how you feel as an investor—your confidence, your peace of mind, and your trust in our process. When you share your journey with Qode, it not only guides us but also inspires future investors to invest with conviction.`,
    `If you’ve had a positive journey with Qode, we’d love to hear your story. Testimonials may highlight: your onboarding experience, clarity of communication, and confidence in Qode’s investment philosophy.`,
    `With your consent, selected testimonials may be anonymized and featured in our website, decks, and newsletters to inspire other investors.`,
  ],
};

export const CONTACT = {
  phones: [
    { label: `Investor Relations`, number: `+91 98203 00028` },
    { label: `HR Queries`, number: `+91 98203 00032` },
  ],
  emails: [
    { label: `Investor Relations`, address: `investor.relations@qodeinvest.com` },
    { label: `HR Queries`, address: `hr@qodeinvest.com` },
  ],
  address: [
    `2nd Floor, Tree Building, Raghuvanshi Mills Compound, Gandhi Nagar, Upper Worli, Lower Parel, Mumbai, Maharashtra 400013`,
    `India`,
  ],
  hours: [`WhatsApp (IR Desk): 9 AM – 5 PM`],
};

export const LEGAL = {
  privacy: {
    title: `Privacy Policy`,
    sections: [
      { h: ``, p: [`At Qode (Qode), we prioritize the privacy and security of our clients' personal, financial, and transactional information. Our commitment to safeguarding your privacy is integral to our relationship with you, and we employ advanced technology to ensure a secure online experience. This Privacy Policy outlines how we collect, use, protect, and share information obtained through our website qodeinvest.com, and it reflects our dedication to protecting your privacy.`] },
      { h: `Information Collection & Use`, p: [`Qode collects personal information such as your name, address, email address, phone number, birth date, PAN, Aadhaar, occupation, income, risk profile, nominee details, investment details, and bank details. This information is gathered through various means, including email, forms, and WhatsApp groups, and is used to facilitate account opening, KYC processes, and account management. We also use this information to keep you informed about our latest product announcements, special offers, and to provide you with better services.`] },
      { h: `Sharing and Disclosure of Information`, p: [`Qode may share your personal information with third parties, including custodians like ICICI Bank, KYC and KRA centers, CRM systems, auditors, and other service providers, to add value and improve the quality of services we provide. This sharing of information will be done in strict compliance with confidentiality standards and only when necessary for audits, account opening, or as required by law.`] },
      { h: `Protection of Information`, p: [`We are committed to protecting your information with the same degree of care that we apply to our own confidential information. This includes taking all reasonable steps to prevent unauthorized use, dissemination, or publication of your personal information. Access to your personal information on our website is secured through a unique login ID and password, which you are advised to handle carefully and change periodically.`] },
      { h: `Cookies and Web Analytics`, p: [`Our website uses cookies and Google Analytics to enhance your browsing experience, remember your preferences, and improve site navigation. These cookies do not collect personal sensitive information. By using our website, you consent to the placement of these cookies on your device. You are free to disable or delete these cookies through your web browser settings.`] },
      { h: `Your Rights and Responsibilities`, p: [`You have the right to access, update, and correct your personal information. We encourage you to keep your information accurate and up-to-date by using the features available on our website. Please be aware that disclosing confidential information obtained through our services to third parties without our consent may constitute a breach of this policy.`] },
      { h: `Changes to the Privacy Policy`, p: [`Qode reserves the right to update or modify this Privacy Policy at any time without prior notice. We encourage you to review this policy periodically to stay informed about how we are protecting your information.`] },
      { h: `Contact Us`, p: [`If you have any questions or concerns about this Privacy Policy or our privacy practices, please contact us through our website qodeinvest.com. This Privacy Policy is governed by the laws of India and is designed to comply with all relevant legal and regulatory requirements, including those set forth by SEBI. It does not create any contractual or other legal rights on behalf of any party.`] },
    ],
  },
  terms: {
    title: `Terms & Conditions`,
    sections: [
      { h: ``, p: [`By accessing & using the website of Qode (hereinafter referred to as "Qode"), including any of its web pages, you signify your agreement to these Terms & Conditions. It is important that you read these terms each time you access our website, as they may be amended from time to time at Qode's sole discretion qodeinvest.com, & it reflects our dedication to protecting your privacy.`] },
      { h: `Use of Information & Materials:`, p: [`The content provided on Qode's website is for general informational purposes only & should not be considered as financial advice or a recommendation to invest. The website content is not intended to be an offer or solicitation for investment in any financial products mentioned. Investments are subject to market risks, including the potential loss of principal. Past performance is not indicative of future results. Users are advised to seek independent financial advice before making any investment decisions.`] },
      { h: `Copyright & Intellectual Property:`, p: [`All content on Qode's website, including text, graphics, logos, & images, is the property of Qode or its content suppliers & is protected by copyright & other intellectual property laws. Unauthorized use, reproduction, or distribution of any material from this website is strictly prohibited.`] },
      { h: `No Warranties:`, p: [`Qode makes no warranties or representations about the accuracy, completeness, or suitability of the information on its website. All content is provided "as is" without any warranty of any kind. Qode, its affiliates, & their respective officers, directors, employees, or agents will not be liable for any damages arising from the use of this website.`] },
      { h: `Exclusion of Liability:`, p: [`Qode will not be liable for any damages or losses arising from the use of this website, including but not limited to direct, indirect, incidental, punitive, & consequential damages. This exclusion applies to damages from the use of or reliance on any information provided, any transactions conducted through the website, & unauthorized access or alteration of your transmissions or data.`] },
      { h: `Governing Law:`, p: [`These Terms & Conditions are governed by the laws of India. Any disputes arising out of or in connection with this website are to be submitted to the exclusive jurisdiction of the courts in Mumbai, India.`] },
      { h: `Privacy & Security:`, p: [`Qode takes the privacy & security of its users seriously. Please review our Privacy Policy to understand how we protect your information.`] },
      { h: `Hyperlinks:`, p: [`This website may contain links to other websites. Qode is not responsible for the content or privacy practices of these external sites. Users are advised to read the privacy policy of external sites before disclosing any personal information on qodeinvest.com. Qode reserves the right to amend these Terms & Conditions at any time. Any such changes will be posted on this page. Your continued use of the website following the posting of changes to these terms will mean you accept those changes.`] },
      { h: `Amendments:`, p: [`Qode reserves the right to amend these Terms & Conditions at any time. Any such changes will be posted on this page. Your continued use of the website following the posting of changes to these terms will mean you accept those changes.`] },
      { h: `Contact Information:`, p: [`If you have any questions or concerns about these Terms & Conditions, please contact us at investor.relations@qodeinvest.com.`] },
    ],
  },
  cancellation: {
    title: `Refund and Cancellation`,
    sections: [
      { h: ``, p: [`As a portfolio management service, Qode does not offer refunds or cancellations. All investments are actively managed on your behalf and are subject to market risks; once investment decisions are executed, they cannot be undone. Please review your investment commitments carefully before proceeding.`] },
    ],
  },
};

// The portal guide lists report names grouped by type; it has no per-report descriptions,
// so desc = report type (plus the "used for" note where the source gives one).
export const REPORTS = [
  { title: `Account Statement - Non unitized`, desc: `Accounting & Financial Report` },
  { title: `Account Statement`, desc: `Accounting & Financial Report` },
  { title: `Profit and Loss Account - Balance Sheet`, desc: `Accounting & Financial Report. Used for: Annual Compliance Reports` },
  { title: `Trial Balance`, desc: `Accounting & Financial Report` },
  { title: `Transaction Statement`, desc: `Activity Report. Used for: Annual Compliance Reports` },
  { title: `Capital Register`, desc: `Activity Report. Used for: Annual Compliance Reports` },
  { title: `Bank Book`, desc: `Activity Report` },
  { title: `Statement of Interest`, desc: `Income, Expenses & Tax Report` },
  { title: `Statement of Dividend`, desc: `Income, Expenses & Tax Report` },
  { title: `Corporate Benefit`, desc: `Income, Expenses & Tax Report. Used for: Annual Compliance Reports` },
  { title: `Statement of Expenses`, desc: `Income, Expenses & Tax Report. Used for: Annual Compliance Reports` },
  { title: `Statement of Capital Gain/Loss`, desc: `Income, Expenses & Tax Report. Used for: Annual Compliance Reports` },
  { title: `Portfolio Fact Sheet`, desc: `Portfolio Reporting & Performance` },
  { title: `Portfolio Position Analysis`, desc: `Portfolio Reporting & Performance` },
  { title: `Portfolio Performance Summary`, desc: `Portfolio Reporting & Performance` },
  { title: `Performance Appraisal`, desc: `Portfolio Reporting & Performance. Used for: Annual Compliance Reports` },
  { title: `Portfolio Performance with Benchmarks`, desc: `Portfolio Reporting & Performance` },
  { title: `Performance by Security Since Inception`, desc: `Portfolio Reporting & Performance` },
  { title: `Portfolio Appraisal`, desc: `Portfolio Reporting & Performance` },
  { title: `PMS Investor Report`, desc: `Combined Report. Used for: Quarterly Compliance Reports` },
];
