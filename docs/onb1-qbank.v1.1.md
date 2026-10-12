# ONB1 – AI Onboarding Interview Question Bank v1.1 (DRAFT 2026-10-11) - question bank (plain text)
Spec onb1.qbank.v1.1 · generated from Google Doc 19xKKFlRgnC0YkzyCMdFRp9FUIg_yfRNg9nHlmVXgy1A (revision AHj4eMQgfOSE537aREeovEgyKgar3o63xv4Jr7HFpXTkGLt_jsIK5bb6MfUp0B2KTnfrg93Y3IRziOaM92Zh2uJjYTwuiW6_vDHZX2kfuFU). Wording is copied verbatim from the doc.

## Budget settings
- Cap: 10 questions per interview, follow-ups included
- Max follow-ups: 3; max chain depth: 2
- Core slots (always asked): [1, 2, 3, 4, 5, 6, 10]; flex slots, drop order: [9, 8, 7]
- No budget left: skip_and_log
- Locations: sizing only (GEN_LOCATIONS has no follow-ups); reserved location follow-up slots: 0
- Rules never trigger from slots [8, 9]

## Conventions
- option_ids: Option id = the number shown in the doc. Options marked (non-ordinal) in the doc have ordinal=false and are excluded from option_gte/option_lte.
- followup_goal_and_required: The doc does not state goal/required for follow-up questions; per the appendix example, follow-ups are required=true and carry the goal of the question whose answer triggers them.
- child_rule_ids: Depth-2 branch rules are named <parent rule id> + "a" (appendix convention, e.g. GEN-R1a).
- swap_ins: A swap-in inherits the slot, slot_class and drop_priority of the generic question it replaces.

## Goals
- G1 Business type (generic: GEN_BUSINESS_TYPE)
- G2 Size: revenue band and locations (generic: GEN_LOCATIONS, GEN_REVENUE_BAND)
- G3 Team: headcount and roles (generic: GEN_HEADCOUNT, GEN_ROLES)
- G4 Current tools and software (generic: GEN_TOOLS)
- G5 Email / inbound message load (generic: GEN_EMAIL_LOAD)
- G6 Biggest pain or time sink (generic: GEN_PAIN)
- G7 90-day goals (generic: GEN_GOALS_90D)
- G8 Contact details and best time to reach them (generic: GEN_CONTACT)

## Industry map (GEN_BUSINESS_TYPE option → pack)
- 1 → restaurant · 2 → professional_services · 3 → professional_services · 4 → professional_services · 5 → home_services · 6 → medical_dental · 7 → generic · 8 → generic

## Generic questions (default 10-question path)
### GEN_BUSINESS_TYPE - slot 1 (core)
Text: "First, what kind of business do you run?"
Type: single_choice · Goal: G1 · Required: yes · Tags: generic
Same-screen optional detail (not counted): "Want to add a few words? (e.g., 'family dental practice', 'HVAC and plumbing', 'neighborhood bistro')"
Options:
  1. Restaurant, bar or café
  2. Law firm
  3. Accounting, tax or bookkeeping firm
  4. Other professional services (consulting, agency, financial advice)
  5. Home services or trades
  6. Medical or dental clinic
  7. Retail or e-commerce
  8. Other

### GEN_PAIN - slot 2 (core)
Text: "What eats up the most time for you or your team right now? Pick up to two."
Type: multi_choice (max 2) · Goal: G6 · Required: yes · Tags: generic
Same-screen optional comment (not counted): "Anything else we should know about it?"
Options:
  1. Email and inbox overload
  2. Answering calls and customer questions
  3. Scheduling and booking
  4. Data entry and copying info between tools
  5. Quotes, invoices and getting paid
  6. Reporting / knowing how the business is doing
  7. Hiring, training and onboarding staff
  8. Marketing, reviews and follow-ups
  9. Other (describe) [free text]

### GEN_LOCATIONS - slot 3 (core)
Text: "How many locations do you operate from? Count offices, shops, restaurants or clinics. If you work from one place or from home, that's 1."
Type: number · Goal: G2 · Required: yes · Tags: generic
Validation: {'integer': True, 'min': 1, 'max': 999}
Sizing only: no follow-ups

### GEN_HEADCOUNT - slot 4 (core)
Text: "About how many people work in the business, including you?"
Type: single_choice · Goal: G3 · Required: yes · Tags: generic
Options:
  1. Just me
  2. 2–5
  3. 6–15
  4. 16–50
  5. 51–150
  6. More than 150

### GEN_TOOLS - slot 5 (core)
Text: "Which tools does your team use day to day? Pick all that apply."
Type: multi_choice · Goal: G4 · Required: yes · Tags: generic
Options:
  1. Google Workspace (Gmail, Drive)
  2. Microsoft 365 (Outlook, Teams)
  3. Accounting (QuickBooks, Xero, etc.)
  4. CRM (HubSpot, Salesforce, etc.)
  5. Industry software (POS, practice management, field service, etc.)
  6. Scheduling or booking tools
  7. Phone system or answering service
  8. Project or task tools (Asana, Monday, Trello, etc.)
  9. Mostly spreadsheets and paper
  10. Other (type it) [free text]

### GEN_GOALS_90D - slot 6 (core)
Text: "Picture 90 days from now and things went really well. What's different? (For example: 'I'm not answering email at night' or 'we never miss a lead.')"
Type: long_text · Goal: G7 · Required: yes · Tags: generic
Validation: {'min_chars': 10, 'max_chars': 1000}

### GEN_EMAIL_LOAD - slot 7 (flex, drop priority 3)
Text: "On a typical weekday, about how many emails land in your team's main inbox(es) that someone has to read or answer?"
Type: single_choice · Goal: G5 · Required: yes · Tags: generic
Options:
  1. Fewer than 25
  2. 25–50
  3. 50–100
  4. 100–250
  5. More than 250
  6. Not sure [non-ordinal]

### GEN_REVENUE_BAND - slot 8 (flex, drop priority 2)
Text: "Roughly what's your annual revenue? A ballpark is fine, and you can skip this one."
Type: single_choice · Goal: G2 · Required: no · Tags: generic
Options:
  1. Under $500K
  2. $500K–$1M
  3. $1M–$5M
  4. $5M–$20M
  5. More than $20M
  6. Prefer not to say [non-ordinal]

### GEN_ROLES - slot 9 (flex, drop priority 1)
Text: "Which roles do you have on the team? Pick all that apply."
Type: multi_choice · Goal: G3 · Required: no · Tags: generic
Options:
  1. Owner / leadership
  2. Office / admin
  3. Sales
  4. Customer service / front desk
  5. Operations / field / production
  6. Finance / bookkeeping
  7. Marketing
  8. IT / tech
  9. Other [free text]

### GEN_CONTACT - slot 10 (core)
Text: "Last one! How can we reach you, and when's a good time?"
Type: contact_block · Goal: G8 · Required: yes · Tags: generic
Fields (counts as 1 question):
- full name (short text, required)
- business name (short text, required)
- role/title (short text, optional)
- work email (short text, required, validated)
- phone (short text, optional, validated)
- website (short text, optional)
- best time to reach you (single choice, required)
- time zone (auto-detected, editable)
Options for best time to reach you:
  1. Weekday mornings
  2. Weekday afternoons
  3. Weekday evenings
  4. Weekends
  5. Email is best

## Generic follow-up rules
- GEN-R2 (priority 2): IF GEN_EMAIL_LOAD in [4, 5] OR GEN_PAIN includes_any [1] THEN ask GEN_FU_EMAIL_TYPES
- GEN-R3 (priority 3): IF GEN_TOOLS includes_any [9] THEN ask GEN_FU_TECH_COMFORT

Generic follow-up questions:

### GEN_FU_EMAIL_TYPES - follow-up
Text: "Which kinds of email take the most time?"
Type: multi_choice (max 3) · Goal: G5 · Required: yes · Tags: generic, professional_services
Options:
  1. Customer or client questions
  2. Scheduling and booking
  3. Quotes, orders or document requests
  4. Internal back-and-forth
  5. Billing and payments
  6. Vendor and sales emails
  7. Other

### GEN_FU_TECH_COMFORT - follow-up
Text: "How does your team feel about trying new tools?"
Type: single_choice · Goal: G4 · Required: yes · Tags: generic, restaurant
Options:
  1. Excited
  2. Open, if it's simple
  3. Prefer as little change as possible

## Industry: Restaurants, bars and cafés (tag restaurant)
Why: Heavy phone and DM traffic (reservations, catering, events), shift scheduling, inventory and ordering, reviews. Lots of repetitive guest communication that AI can answer or route.

Swap-in starter questions:

### RST_PAIN - slot 2 (core) · replaces GEN_PAIN
Text: "What eats up the most time running the restaurant right now? Pick up to two."
Type: multi_choice (max 2) · Goal: G6 · Required: yes · Tags: restaurant
Same-screen optional comment (not counted): "Anything else?"
Options:
  1. Phones and reservations
  2. Catering and private-event inquiries
  3. Staff scheduling and shift swaps
  4. Inventory, ordering and food cost
  5. Online reviews and guest feedback
  6. Hiring and training staff
  7. Reporting across shifts or locations
  8. Marketing and promotions
  9. Other (describe) [free text]

### RST_TEAM - slot 4 (core) · replaces GEN_HEADCOUNT
Text: "About how many people work across your restaurant(s), front and back of house combined?"
Type: single_choice · Goal: G3 · Required: yes · Tags: restaurant
Options:
  1. Fewer than 10
  2. 10–25
  3. 26–50
  4. 51–100
  5. More than 100

### RST_TOOLS - slot 5 (core) · replaces GEN_TOOLS
Text: "Which tools do you use to run the restaurant? Pick all that apply."
Type: multi_choice · Goal: G4 · Required: yes · Tags: restaurant
Options:
  1. POS (Toast, Square, Clover, etc.)
  2. Reservations or waitlist (OpenTable, Resy, Tock, etc.)
  3. Online ordering or delivery apps
  4. Staff scheduling (7shifts, HotSchedules, Homebase, etc.)
  5. Inventory or invoice tools (MarginEdge, xtraCHEF, etc.)
  6. Accounting (QuickBooks, Xero)
  7. Email or marketing tools
  8. Google Workspace or Microsoft 365
  9. Mostly spreadsheets and paper
  10. Other [free text]

### RST_INBOUND - slot 7 (flex, drop priority 3) · replaces GEN_EMAIL_LOAD
Text: "On a typical day, about how many guest messages come in across phone, email, your website and social DMs? (Reservations, catering, events, questions.)"
Type: single_choice · Goal: G5 · Required: yes · Tags: restaurant
Options:
  1. Fewer than 20
  2. 20–50
  3. 50–100
  4. 100–200
  5. More than 200
  6. Not sure [non-ordinal]

### RST_ROLES - slot 9 (flex, drop priority 1) · replaces GEN_ROLES
Text: "Which roles do you have? Pick all that apply."
Type: multi_choice · Goal: G3 · Required: no · Tags: restaurant
Options:
  1. Owner / operator
  2. General manager
  3. Chef / kitchen manager
  4. Front-of-house manager
  5. Events or catering coordinator
  6. Bookkeeper / accountant
  7. Marketing / social
  8. Servers, bartenders, hosts
  9. Line and prep cooks

Follow-up rules:
- RST-R2 (priority 2): IF RST_PAIN includes_any [1] OR RST_INBOUND option_gte 4 THEN ask RST_FU_CALLS
  - branch RST-R2a (priority 2): IF RST_FU_CALLS in [1, 3] THEN ask RST_FU_MISSED
- RST-R3 (priority 2): IF RST_PAIN includes_any [2] THEN ask RST_FU_EVENTS
  - branch RST-R3a (priority 2): IF RST_FU_EVENTS gte 10 THEN ask RST_FU_EVENT_FLOW
- RST-R4 (priority 3): IF RST_PAIN includes_any [3] THEN ask RST_FU_SCHED
- RST-R5 (priority 3): IF RST_PAIN includes_any [4] THEN ask RST_FU_INV
- RST-R6 (priority 4): IF RST_TOOLS includes_any [9] THEN ask GEN_FU_TECH_COMFORT

Follow-up questions:

### RST_FU_CALLS - follow-up
Text: "When do calls and messages pile up the most?"
Type: single_choice · Goal: G6 · Required: yes · Tags: restaurant
Options:
  1. During service rushes
  2. Before we open
  3. After we close
  4. All day
  5. Not sure

### RST_FU_MISSED - follow-up
Text: "What happens to calls nobody can pick up?"
Type: single_choice · Goal: G6 · Required: yes · Tags: restaurant
Options:
  1. Voicemail
  2. They ring out
  3. Forwarded to a manager's phone
  4. Answering service

### RST_FU_EVENTS - follow-up
Text: "About how many catering or private-event inquiries do you get in a month?"
Type: number · Goal: G6 · Required: yes · Tags: restaurant
Validation: {'integer': True, 'min': 0, 'max': 9999}

### RST_FU_EVENT_FLOW - follow-up
Text: "Walk us through how an inquiry turns into a booked event today."
Type: long_text · Goal: G6 · Required: yes · Tags: restaurant

### RST_FU_SCHED - follow-up
Text: "How do you build and share the staff schedule today?"
Type: single_choice · Goal: G6 · Required: yes · Tags: restaurant
Options:
  1. Scheduling app
  2. Spreadsheet
  3. Paper or whiteboard
  4. Group text

### RST_FU_INV - follow-up
Text: "How do you count inventory and place orders today?"
Type: single_choice · Goal: G6 · Required: yes · Tags: restaurant
Options:
  1. Software
  2. Spreadsheet
  3. Pen and paper
  4. The chef handles it by feel

### GEN_FU_TECH_COMFORT - follow-up
Text: "How does your team feel about trying new tools?"
Type: single_choice · Goal: G4 · Required: yes · Tags: generic, restaurant
Options:
  1. Excited
  2. Open, if it's simple
  3. Prefer as little change as possible

## Industry: Professional services (law, accounting/tax/bookkeeping, consulting) (tag professional_services)
Why: Email-heavy, document-heavy work: intake, chasing client documents, drafting routine letters, summarizing long files, seasonal crunch. High-value staff time and clear ROI.

Swap-in starter questions:

### PRO_PAIN - slot 2 (core) · replaces GEN_PAIN
Text: "What eats up the most time at the firm right now? Pick up to two. (Please don't include client names or case details.)"
Type: multi_choice (max 2) · Goal: G6 · Required: yes · Tags: professional_services
Same-screen optional comment (not counted): "Anything else?"
Options:
  1. New-client intake and onboarding
  2. Chasing clients for documents and info
  3. Email overload
  4. Drafting routine letters and documents
  5. Time tracking and billing
  6. Scheduling and reminders
  7. Reading and summarizing long documents
  8. Seasonal crunch (e.g., tax season)
  9. Other (describe) [free text]

### PRO_PROFESSIONALS - slot 4 (core) · replaces GEN_HEADCOUNT
Text: "How many people are on the team in total, and roughly how many are billable professionals (attorneys, CPAs, consultants)?"
Type: number · Goal: G3 · Required: yes · Tags: professional_services
Number fields (one screen, counts as 1 question): total, billable

### PRO_TOOLS - slot 5 (core) · replaces GEN_TOOLS
Text: "Which tools does the firm use day to day? Pick all that apply."
Type: multi_choice · Goal: G4 · Required: yes · Tags: professional_services
Options:
  1. Practice management (Clio, MyCase, PracticePanther, Karbon, TaxDome, Canopy, etc.)
  2. Accounting or tax software (QuickBooks, Xero, Drake, Lacerte, UltraTax, etc.)
  3. Document storage (SharePoint, Google Drive, Dropbox, NetDocuments, etc.)
  4. E-signature (DocuSign, Adobe Sign)
  5. Client portal
  6. CRM or intake tool
  7. Time tracking and billing
  8. Microsoft 365 or Google Workspace
  9. Mostly spreadsheets, email and paper
  10. Other [free text]

### PRO_EMAIL - slot 7 (flex, drop priority 3) · replaces GEN_EMAIL_LOAD
Text: "On a typical weekday, about how many emails does each professional on your team get?"
Type: single_choice · Goal: G5 · Required: yes · Tags: professional_services
Options:
  1. Fewer than 25
  2. 25–50
  3. 50–100
  4. 100–200
  5. More than 200
  6. Not sure [non-ordinal]

### PRO_ROLES - slot 9 (flex, drop priority 1) · replaces GEN_ROLES
Text: "Which roles do you have? Pick all that apply."
Type: multi_choice · Goal: G3 · Required: no · Tags: professional_services
Options:
  1. Partners / owners
  2. Attorneys, CPAs or consultants
  3. Paralegals, associates or staff accountants
  4. Reception / admin
  5. Billing / bookkeeping
  6. Intake / marketing
  7. IT
  8. Other

Follow-up rules:
- PRO-R2 (priority 2): IF PRO_PAIN includes_any [2] THEN ask PRO_FU_DOCS
  - branch PRO-R2a (priority 2): IF PRO_FU_DOCS in [1, 3, 4] THEN ask PRO_FU_DOC_HOURS
- PRO-R3 (priority 2): IF PRO_PAIN includes_any [1] THEN ask PRO_FU_INTAKE
  - branch PRO-R3a (priority 2): IF PRO_FU_INTAKE gte 20 THEN ask PRO_FU_INTAKE_STEPS
- PRO-R4 (priority 2): IF PRO_PAIN includes_any [3] OR PRO_EMAIL option_gte 4 THEN ask GEN_FU_EMAIL_TYPES
- PRO-R5 (priority 3): IF PRO_PAIN includes_any [8] THEN ask PRO_FU_SEASON
- PRO-R6 (priority 3): IF PRO_TOOLS includes_any [9] AND NOT (PRO_TOOLS includes_any [1]) THEN ask PRO_FU_TRACKING

Follow-up questions:

### PRO_FU_DOCS - follow-up
Text: "How do clients send you documents today?"
Type: single_choice · Goal: G6 · Required: yes · Tags: professional_services
Options:
  1. Email attachments
  2. Client portal
  3. Paper or drop-off
  4. A mix

### PRO_FU_DOC_HOURS - follow-up
Text: "About how many hours a week does the team spend chasing missing documents?"
Type: number · Goal: G6 · Required: yes · Tags: professional_services
Validation: {'integer': True, 'min': 0, 'max': 200}

### PRO_FU_INTAKE - follow-up
Text: "About how many new-client inquiries do you get in a month?"
Type: number · Goal: G6 · Required: yes · Tags: professional_services
Validation: {'integer': True, 'min': 0, 'max': 9999}

### PRO_FU_INTAKE_STEPS - follow-up
Text: "What happens between first contact and a signed engagement today?"
Type: long_text · Goal: G6 · Required: yes · Tags: professional_services

### GEN_FU_EMAIL_TYPES - follow-up
Text: "Which kinds of email take the most time?"
Type: multi_choice (max 3) · Goal: G5 · Required: yes · Tags: generic, professional_services
Options:
  1. Customer or client questions
  2. Scheduling and booking
  3. Quotes, orders or document requests
  4. Internal back-and-forth
  5. Billing and payments
  6. Vendor and sales emails
  7. Other

### PRO_FU_SEASON - follow-up
Text: "Which months are busiest, and do you bring on extra help?"
Type: short_text · Goal: G6 · Required: yes · Tags: professional_services

### PRO_FU_TRACKING - follow-up
Text: "Where do client matters and deadlines live today?"
Type: single_choice · Goal: G4 · Required: yes · Tags: professional_services
Options:
  1. Spreadsheets
  2. Calendar only
  3. Paper files
  4. In people's heads

## Industry: Home services and trades (HVAC, plumbing, electrical, cleaning, landscaping, etc.) (tag home_services)
Why: Missed calls are lost revenue. After-hours lead capture, booking and dispatch, estimate follow-up and invoicing are all very automatable.

Swap-in starter questions:

### HOME_PAIN - slot 2 (core) · replaces GEN_PAIN
Text: "What eats up the most time right now? Pick up to two."
Type: multi_choice (max 2) · Goal: G6 · Required: yes · Tags: home_services
Same-screen optional comment (not counted): "Anything else?"
Options:
  1. Missed calls and after-hours leads
  2. Scheduling and dispatch
  3. Following up on quotes and estimates
  4. Invoicing and getting paid
  5. Reviews and reputation
  6. Hiring and training techs
  7. Job paperwork, photos and notes
  8. Seasonal ups and downs
  9. Other (describe) [free text]

### HOME_TECHS - slot 4 (core) · replaces GEN_HEADCOUNT
Text: "How many techs or crew members are out in the field on a typical day? And how many people work in the office?"
Type: number · Goal: G3 · Required: yes · Tags: home_services
Number fields (one screen, counts as 1 question): field, office

### HOME_TOOLS - slot 5 (core) · replaces GEN_TOOLS
Text: "Which tools do you use to run jobs and the office? Pick all that apply."
Type: multi_choice · Goal: G4 · Required: yes · Tags: home_services
Options:
  1. Field service software (ServiceTitan, Housecall Pro, Jobber, Workiz, etc.)
  2. Accounting (QuickBooks, Xero)
  3. Phone system or answering service
  4. Online booking on our website
  5. Lead sites (Angi, Thumbtack, Yelp, Google Local Services)
  6. Google Business Profile
  7. Google Workspace or Microsoft 365
  8. Paper tickets, whiteboard or spreadsheets
  9. Other [free text]

### HOME_LEADS - slot 7 (flex, drop priority 3) · replaces GEN_EMAIL_LOAD
Text: "On a typical weekday, about how many calls, texts, emails and web leads come in?"
Type: single_choice · Goal: G5 · Required: yes · Tags: home_services
Options:
  1. Fewer than 10
  2. 10–25
  3. 25–50
  4. 50–100
  5. More than 100
  6. Not sure [non-ordinal]

### HOME_BOOKING - slot 9 (flex, drop priority 1) · replaces GEN_ROLES
Text: "Who answers calls and books jobs today? Pick all that apply."
Type: multi_choice · Goal: G3 · Required: no · Tags: home_services
Options:
  1. Owner
  2. Office staff or dispatcher
  3. Techs, between jobs
  4. Answering service
  5. Nobody consistently

Follow-up rules:
- HOME-R2 (priority 1): IF HOME_PAIN includes_any [1] OR HOME_LEADS option_gte 4 THEN ask HOME_FU_MISSED
  - branch HOME-R2a (priority 1): IF HOME_FU_MISSED in [3, 4, 5] THEN ask HOME_FU_AFTERHOURS
- HOME-R3 (priority 2): IF HOME_PAIN includes_any [3] THEN ask HOME_FU_QUOTES
  - branch HOME-R3a (priority 2): IF HOME_FU_QUOTES gte 20 THEN ask HOME_FU_QUOTE_CHASE
- HOME-R4 (priority 3): IF HOME_PAIN includes_any [4] THEN ask HOME_FU_PAY
- HOME-R5 (priority 3): IF HOME_TOOLS includes_any [8] AND NOT (HOME_TOOLS includes_any [1]) THEN ask HOME_FU_DISPATCH
- HOME-R6 (priority 3): IF HOME_PAIN includes_any [2] AND HOME_TECHS.field gte 5 THEN ask HOME_FU_JOBS

Follow-up questions:

### HOME_FU_MISSED - follow-up
Text: "Roughly what share of calls go unanswered, especially after hours?"
Type: single_choice · Goal: G6 · Required: yes · Tags: home_services
Options:
  1. Under 10%
  2. 10–25%
  3. 25–50%
  4. Over 50%
  5. No idea

### HOME_FU_AFTERHOURS - follow-up
Text: "What happens to calls after hours today?"
Type: single_choice · Goal: G6 · Required: yes · Tags: home_services
Options:
  1. Voicemail
  2. Answering service
  3. Forwarded to the owner's cell
  4. Nothing, they ring out

### HOME_FU_QUOTES - follow-up
Text: "About how many estimates do you send in a month?"
Type: number · Goal: G6 · Required: yes · Tags: home_services
Validation: {'integer': True, 'min': 0, 'max': 9999}

### HOME_FU_QUOTE_CHASE - follow-up
Text: "How do you follow up on estimates that haven't been accepted?"
Type: single_choice · Goal: G6 · Required: yes · Tags: home_services
Options:
  1. We call
  2. We text or email
  3. Software sends reminders
  4. We usually don't

### HOME_FU_PAY - follow-up
Text: "How long does it usually take to get paid after a job is done?"
Type: single_choice · Goal: G6 · Required: yes · Tags: home_services
Options:
  1. Same day
  2. Within a week
  3. 2–4 weeks
  4. Longer than a month

### HOME_FU_DISPATCH - follow-up
Text: "How do techs get their schedule and job details each day?"
Type: single_choice · Goal: G4 · Required: yes · Tags: home_services
Options:
  1. An app
  2. Text or phone call
  3. Paper tickets
  4. They stop by the shop

### HOME_FU_JOBS - follow-up
Text: "About how many jobs do you schedule on a typical day?"
Type: number · Goal: G6 · Required: yes · Tags: home_services
Validation: {'integer': True, 'min': 0, 'max': 999}

## Industry: Medical and dental clinics (tag medical_dental)
Why: Front-desk phone volume, scheduling and no-shows, intake paperwork, insurance verification, faxes and referrals. Large admin load per provider. (Extra privacy guardrails apply, see §5.)
Free-text notice on every box in this pack: "Please describe how things work. No patient names or health details."

Swap-in starter questions:

### MED_PAIN - slot 2 (core) · replaces GEN_PAIN
Text: "What eats up the most time at the practice right now? Pick up to two."
Type: multi_choice (max 2) · Goal: G6 · Required: yes · Tags: medical_dental
Same-screen optional comment (not counted): "Anything else?"
Options:
  1. Phone volume and hold times
  2. Scheduling, no-shows and cancellations
  3. Insurance verification and prior authorizations
  4. New-patient intake and paperwork
  5. Billing and collections
  6. Recalls and reactivating patients
  7. Faxes and referrals
  8. Front-desk turnover and training
  9. Other (describe) [free text]

### MED_PROVIDERS - slot 4 (core) · replaces GEN_HEADCOUNT
Text: "How many providers see patients (doctors, dentists, hygienists, therapists, NPs/PAs), and how many support staff do you have?"
Type: number · Goal: G3 · Required: yes · Tags: medical_dental
Number fields (one screen, counts as 1 question): providers, support

### MED_TOOLS - slot 5 (core) · replaces GEN_TOOLS
Text: "Which systems does the practice use? Pick all that apply."
Type: multi_choice · Goal: G4 · Required: yes · Tags: medical_dental
Options:
  1. EHR/EMR or practice management (Epic, athenahealth, eClinicalWorks, Dentrix, Eaglesoft, Open Dental, etc.)
  2. Patient reminders or texting (Weave, RevenueWell, Solutionreach, etc.)
  3. Online booking (Zocdoc, NexHealth, our website, etc.)
  4. Billing service or clearinghouse
  5. Phone system or answering service
  6. eFax
  7. Microsoft 365 or Google Workspace
  8. Paper forms and spreadsheets
  9. Other [free text]

### MED_COMMS - slot 7 (flex, drop priority 3) · replaces GEN_EMAIL_LOAD
Text: "On a typical day, about how many calls, texts and emails does your front desk handle?"
Type: single_choice · Goal: G5 · Required: yes · Tags: medical_dental
Options:
  1. Fewer than 25
  2. 25–75
  3. 75–150
  4. 150–300
  5. More than 300
  6. Not sure [non-ordinal]

### MED_STAFF - slot 9 (flex, drop priority 1) · replaces GEN_ROLES
Text: "Which roles keep the front office running? Pick all that apply."
Type: multi_choice · Goal: G3 · Required: no · Tags: medical_dental
Options:
  1. Front desk / reception
  2. Scheduling coordinator
  3. Billing / insurance specialist
  4. Medical or dental assistants
  5. Office or practice manager
  6. Outsourced call center or answering service
  7. Other

Follow-up rules:
- MED-R2 (priority 2): IF MED_PAIN includes_any [2] THEN ask MED_FU_NOSHOW
  - branch MED-R2a (priority 2): IF MED_FU_NOSHOW in [3, 4, 5] THEN ask MED_FU_REMIND
- MED-R3 (priority 2): IF MED_PAIN includes_any [1] OR MED_COMMS option_gte 4 THEN ask MED_FU_PHONES
  - branch MED-R3a (priority 2): IF MED_FU_PHONES in [1, 2, 3, 4] THEN ask MED_FU_OVERFLOW
- MED-R4 (priority 2): IF MED_PAIN includes_any [3] THEN ask MED_FU_VERIFY
- MED-R5 (priority 3): IF MED_PAIN includes_any [4] THEN ask MED_FU_INTAKE
- MED-R6 (priority 3): IF MED_PAIN includes_any [7] THEN ask MED_FU_FAX

Follow-up questions:

### MED_FU_NOSHOW - follow-up
Text: "Roughly what share of appointments end up as no-shows or late cancellations?"
Type: single_choice · Goal: G6 · Required: yes · Tags: medical_dental
Options:
  1. Under 5%
  2. 5–10%
  3. 10–20%
  4. Over 20%
  5. Not sure

### MED_FU_REMIND - follow-up
Text: "How do you remind patients about appointments today?"
Type: single_choice · Goal: G6 · Required: yes · Tags: medical_dental
Options:
  1. Automated texts or emails
  2. Staff make calls
  3. Both
  4. We don't send reminders

### MED_FU_PHONES - follow-up
Text: "When do the phones get busiest?"
Type: single_choice · Goal: G6 · Required: yes · Tags: medical_dental
Options:
  1. First thing in the morning
  2. Lunch hour
  3. End of day
  4. All day
  5. Not sure

### MED_FU_OVERFLOW - follow-up
Text: "What happens when every line is busy?"
Type: single_choice · Goal: G6 · Required: yes · Tags: medical_dental
Options:
  1. Voicemail
  2. Long hold times
  3. Rolls to an answering service
  4. Calls get missed

### MED_FU_VERIFY - follow-up
Text: "About how many insurance verifications or prior authorizations does your team handle each week?"
Type: number · Goal: G6 · Required: yes · Tags: medical_dental
Validation: {'integer': True, 'min': 0, 'max': 9999}

### MED_FU_INTAKE - follow-up
Text: "How do new patients fill out intake forms today?"
Type: single_choice · Goal: G6 · Required: yes · Tags: medical_dental
Options:
  1. Paper clipboard at the visit
  2. PDF by email
  3. Online forms
  4. A mix

### MED_FU_FAX - follow-up
Text: "About how many faxes or referral documents come in on a typical day?"
Type: single_choice · Goal: G6 · Required: yes · Tags: medical_dental
Options:
  1. Fewer than 10
  2. 10–30
  3. 30–75
  4. More than 75

