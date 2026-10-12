ONB1 – AI Onboarding Interview Question Bank v1.1 (DRAFT 2026-10-11)
Owner: Vincent (StorenTech AI) · Builder: Bob the Builder · Status: DRAFT v1.1, not yet approved · v1.1 changes: locations is a sizing question only, with all location follow-ups removed; added Website flow (Google Calendar booking page, Ellie Inbox follow-up drafts)

Pipeline: "Start Your Map" on storentechai.com → ONB1 interview (or skip) → book a call → human review at StorenTech → discovery call → AI Opportunity Map → Build Plan

What this doc is: the full spec for the ONB1 interview app: the questions, the 10-question cap logic, four industry packs, follow-up rules, a machine-readable rules format, and guardrails. Bob, build from this. Where something says [TBD – Vincent], ask Vincent before you ship.

Website flow (for Bob)
Entry points: ONB1 is connected to every "Start Your Map" link or button on the StorenTech website (storentechai.com).
Choice screen: clicking "Start Your Map" opens a screen with two options. (a) "Answer a few quick questions first" leads to the ONB1 interview (up to 10 questions). (b) "Skip the questions and schedule a call" goes straight to the booking calendar.
After the interview: when someone finishes the interview, they land on the same booking calendar to book a call.
Skipped the interview: if someone books without doing the interview, the human discovery call covers the basics instead.
Booking tool: a Google Calendar appointment schedule (booking page) in the StorenTech Google Workspace. Both paths (a) and (b) link to or embed this same booking page.
Booking form: must collect name, email, phone and business name (all required), so StorenTech always has contact details, even when the interview is skipped.
Booking page and confirmation: show only a link to the ONB1 interview, as static text in the booking page description, so the link also appears in Google's confirmation. They do not show the prospect's interview answers.
Follow-up: once StorenTech has the prospect's email from the booking form, Ellie Inbox (Vincent's inbox bot) can follow up with the interview link (an optional step before the call). That follow-up is a draft that a person at StorenTech approves. Nothing is auto-sent.
Human review: a person at StorenTech reviews any interview answers before the call.
Note for Bob: check that the Google Calendar booking form can require phone and business name as custom fields, and that the static interview link shows up in Google's confirmation email. If either doesn't work natively, tell Vincent before building a workaround.

0. Ground rules (read first)
Hard cap: at most 10 questions per interview, follow-ups included. The engine must never show an 11th question.
What counts as a question: every question screen or AI turn that asks for an answer counts as 1, including follow-ups.
What does NOT count: the intro/consent screen, the confirmation screen, same-screen optional fields (the "detail" box on Q1, the "anything else?" box on the pain question), and re-prompts after an invalid answer (for example, a mistyped email).
Fixed slot map: 10 slots. Slots 1–6 and 10 are the always-ask core (7 questions). Slots 7, 8 and 9 are flex slots.
Follow-ups consume flex slots. Each follow-up drops one unasked flex slot, in this order: slot 9 first, then slot 8, then slot 7. Max 3 follow-ups per interview. Max chain depth 2 (a follow-up can trigger one child follow-up; a child never triggers another).
Dropped questions aren't lost. Their goal is marked "deferred" in the output, and StorenTech covers it on the human discovery call.
Industry packs swap questions 1:1. A swap-in takes over the slot, the core/flex status and the drop position of the generic question it replaces, so the count never changes.
The AI interviewer may lightly personalize wording (use the prospect's first name or business name). It may not add questions, change answer options or change what a question means.


1. Goals the interview must answer


2. Generic question bank
Options are numbered. The number is the option ID that rules refer to (for example GEN_PAIN option 1 = "Email and inbox overload"). Options marked (non-ordinal), like "Not sure", are left out of greater-than / less-than comparisons.


Industry mapping from GEN_BUSINESS_TYPE: 1 → restaurant pack · 2, 3, 4 → professional services pack · 5 → home services pack · 6 → medical/dental pack · 7, 8 → generic path (no pack).
2.1 Recommended default 10-question path (no industry pack)

Default count: 10 questions when no follow-ups fire. With follow-ups it's still 10: 7 core plus any mix of flex questions and follow-ups (up to 3 follow-ups).

Why this order: pain comes second so pain-based follow-ups fire early, while flex slots are still free. Flex slots come last so they're the ones that get dropped. Contact comes last so the prospect has seen value before handing over details.
2.2 Slot budget algorithm (Bob: implement exactly)
Start with the 10-slot plan (generic, or with industry swaps applied after Q1 is answered).
After each answer, evaluate every rule whose trigger question was just answered. Sort the rules that fire by priority (1 = highest), then by their order in this doc.
For each rule that fires, in that order: if follow-ups asked < 3 AND at least one flex slot is still unasked → mark the highest-drop-order unasked flex slot as dropped (9, then 8, then 7), then ask the follow-up right away.
Otherwise, skip the follow-up and log it as followup_skipped (with the rule ID) for the human reviewer.
A child follow-up (depth 2) goes through the same check, right after its parent.
Invariant check before showing any question: asked + remaining_core_unasked + 1 <= 10. If it would fail, don't show the question.
Rules never key off slot 8 or 9 answers. By then there's no flex slot left to spend, so those rules could never fire. GEN_LOCATIONS (slot 3) is sizing only: no rule keys off it, and no follow-up slot is reserved for locations.
2.3 Generic follow-up rules (apply on the generic path)
GEN-R2 (priority 2). IF GEN_EMAIL_LOAD option in [4, 5] OR GEN_PAIN includes 1 → THEN ask GEN_FU_EMAIL_TYPES: "Which kinds of email take the most time?" Multi (max 3): 1 Customer or client questions · 2 Scheduling and booking · 3 Quotes, orders or document requests · 4 Internal back-and-forth · 5 Billing and payments · 6 Vendor and sales emails · 7 Other. No child.
GEN-R3 (priority 3). IF GEN_TOOLS includes 9 → THEN ask GEN_FU_TECH_COMFORT: "How does your team feel about trying new tools?" Single: 1 Excited · 2 Open, if it's simple · 3 Prefer as little change as possible. No child.

Locations are sizing only (decided by Vincent in v1.1): GEN_LOCATIONS asks how many locations there are, and that's all. No follow-up fires on it in the generic path or in any industry pack, and no slot is reserved for locations. ONB1 is early discovery before a human gets involved, so it assumes the prospect starts with one location. Scope (all locations or one) and any per-location detail are covered on the human discovery call.


3. Industry packs
3.0 Industries chosen and why

Active rules per pack = that pack's own rules. No pack has a locations rule. GEN_LOCATIONS is sizing only everywhere. GEN-R2 and GEN-R3 key off generic IDs that get swapped out, so they won't fire inside a pack unless their trigger question is still in the plan.


3.1 Restaurant pack (tag: restaurant)
Generic on purpose: no client names, data or details.

Swap-in starter questions


Unchanged from generic: slots 1, 3, 6, 8, 10.

Follow-up rules

RST-R2 (priority 2). IF RST_PAIN includes 1 OR RST_INBOUND option ≥ 4 → THEN ask RST_FU_CALLS: "When do calls and messages pile up the most?" Single: 1 During service rushes · 2 Before we open · 3 After we close · 4 All day · 5 Not sure. Branches into: if option in [1, 3] → RST_FU_MISSED: "What happens to calls nobody can pick up?" (1 Voicemail · 2 They ring out · 3 Forwarded to a manager's phone · 4 Answering service).
RST-R3 (priority 2). IF RST_PAIN includes 2 → THEN ask RST_FU_EVENTS: "About how many catering or private-event inquiries do you get in a month?" Number (0–9999). Branches into: if ≥ 10 → RST_FU_EVENT_FLOW: "Walk us through how an inquiry turns into a booked event today." (long text).
RST-R4 (priority 3). IF RST_PAIN includes 3 → THEN ask RST_FU_SCHED: "How do you build and share the staff schedule today?" Single: 1 Scheduling app · 2 Spreadsheet · 3 Paper or whiteboard · 4 Group text. No child.
RST-R5 (priority 3). IF RST_PAIN includes 4 → THEN ask RST_FU_INV: "How do you count inventory and place orders today?" Single: 1 Software · 2 Spreadsheet · 3 Pen and paper · 4 The chef handles it by feel. No child.
RST-R6 (priority 4). IF RST_TOOLS includes 9 → THEN ask GEN_FU_TECH_COMFORT (same question and choices as GEN-R3). No child.


3.2 Professional services pack (tag: professional_services, for law, accounting/tax/bookkeeping, consulting)
Swap-in starter questions


Follow-up rules

PRO-R2 (priority 2). IF PRO_PAIN includes 2 → THEN ask PRO_FU_DOCS: "How do clients send you documents today?" Single: 1 Email attachments · 2 Client portal · 3 Paper or drop-off · 4 A mix. Branches into: if option in [1, 3, 4] → PRO_FU_DOC_HOURS: "About how many hours a week does the team spend chasing missing documents?" (number 0–200).
PRO-R3 (priority 2). IF PRO_PAIN includes 1 → THEN ask PRO_FU_INTAKE: "About how many new-client inquiries do you get in a month?" Number (0–9999). Branches into: if ≥ 20 → PRO_FU_INTAKE_STEPS: "What happens between first contact and a signed engagement today?" (long text).
PRO-R4 (priority 2). IF PRO_PAIN includes 3 OR PRO_EMAIL option ≥ 4 → THEN ask GEN_FU_EMAIL_TYPES (same question and choices as GEN-R2). No child.
PRO-R5 (priority 3). IF PRO_PAIN includes 8 → THEN ask PRO_FU_SEASON: "Which months are busiest, and do you bring on extra help?" Short text. No child.
PRO-R6 (priority 3). IF PRO_TOOLS includes 9 AND NOT includes 1 → THEN ask PRO_FU_TRACKING: "Where do client matters and deadlines live today?" Single: 1 Spreadsheets · 2 Calendar only · 3 Paper files · 4 In people's heads. No child.


3.3 Home services and trades pack (tag: home_services)
Swap-in starter questions


Follow-up rules

HOME-R2 (priority 1). IF HOME_PAIN includes 1 OR HOME_LEADS option ≥ 4 → THEN ask HOME_FU_MISSED: "Roughly what share of calls go unanswered, especially after hours?" Single: 1 Under 10% · 2 10–25% · 3 25–50% · 4 Over 50% · 5 No idea. Branches into: if option in [3, 4, 5] → HOME_FU_AFTERHOURS: "What happens to calls after hours today?" (1 Voicemail · 2 Answering service · 3 Forwarded to the owner's cell · 4 Nothing, they ring out).
HOME-R3 (priority 2). IF HOME_PAIN includes 3 → THEN ask HOME_FU_QUOTES: "About how many estimates do you send in a month?" Number (0–9999). Branches into: if ≥ 20 → HOME_FU_QUOTE_CHASE: "How do you follow up on estimates that haven't been accepted?" (1 We call · 2 We text or email · 3 Software sends reminders · 4 We usually don't).
HOME-R4 (priority 3). IF HOME_PAIN includes 4 → THEN ask HOME_FU_PAY: "How long does it usually take to get paid after a job is done?" Single: 1 Same day · 2 Within a week · 3 2–4 weeks · 4 Longer than a month. No child.
HOME-R5 (priority 3). IF HOME_TOOLS includes 8 AND NOT includes 1 → THEN ask HOME_FU_DISPATCH: "How do techs get their schedule and job details each day?" Single: 1 An app · 2 Text or phone call · 3 Paper tickets · 4 They stop by the shop. No child.
HOME-R6 (priority 3). IF HOME_PAIN includes 2 AND HOME_TECHS.field ≥ 5 → THEN ask HOME_FU_JOBS: "About how many jobs do you schedule on a typical day?" Number (0–999). No child.

Note: HOME_BOOKING is slot 9, so no rule keys off it (see §2.2 step 7). A human reviewer reads it.


3.4 Medical and dental clinic pack (tag: medical_dental)
Extra guardrail: ask about processes only. Never ask for patient names, dates of birth, diagnoses, insurance member IDs or any other patient health information. Every free-text box in this pack shows: "Please describe how things work. No patient names or health details."

Swap-in starter questions


Follow-up rules

MED-R2 (priority 2). IF MED_PAIN includes 2 → THEN ask MED_FU_NOSHOW: "Roughly what share of appointments end up as no-shows or late cancellations?" Single: 1 Under 5% · 2 5–10% · 3 10–20% · 4 Over 20% · 5 Not sure. Branches into: if option in [3, 4, 5] → MED_FU_REMIND: "How do you remind patients about appointments today?" (1 Automated texts or emails · 2 Staff make calls · 3 Both · 4 We don't send reminders).
MED-R3 (priority 2). IF MED_PAIN includes 1 OR MED_COMMS option ≥ 4 → THEN ask MED_FU_PHONES: "When do the phones get busiest?" Single: 1 First thing in the morning · 2 Lunch hour · 3 End of day · 4 All day · 5 Not sure. Branches into: if option in [1, 2, 3, 4] → MED_FU_OVERFLOW: "What happens when every line is busy?" (1 Voicemail · 2 Long hold times · 3 Rolls to an answering service · 4 Calls get missed).
MED-R4 (priority 2). IF MED_PAIN includes 3 → THEN ask MED_FU_VERIFY: "About how many insurance verifications or prior authorizations does your team handle each week?" Number (0–9999). No child.
MED-R5 (priority 3). IF MED_PAIN includes 4 → THEN ask MED_FU_INTAKE: "How do new patients fill out intake forms today?" Single: 1 Paper clipboard at the visit · 2 PDF by email · 3 Online forms · 4 A mix. No child.
MED-R6 (priority 3). IF MED_PAIN includes 7 → THEN ask MED_FU_FAX: "About how many faxes or referral documents come in on a typical day?" Single: 1 Fewer than 10 · 2 10–30 · 3 30–75 · 4 More than 75. No child.


3.5 Worked example (restaurant, cap check)
Prospect: restaurant, 3 locations, pain = phones and catering.

Slot 1: GEN_BUSINESS_TYPE → 1 (Restaurant). Restaurant pack loads.
Slot 2: RST_PAIN → [1, 2]. RST-R2 and RST-R3 fire (both priority 2; R2 comes first in the doc). RST-R2: drop slot 9 and ask RST_FU_CALLS → "During service rushes" → child RST_FU_MISSED: drop slot 8 and ask. Follow-ups used: 2. RST-R3: drop slot 7 and ask RST_FU_EVENTS → 15 → child would need a 4th follow-up and no flex is left, so skipped and logged.
Slot 3: GEN_LOCATIONS → 3. Sizing only, so no follow-up fires. Discovery assumes they start with one location; per-location detail goes to the human discovery call. Then slots 4–6: RST_TEAM, RST_TOOLS, GEN_GOALS_90D.
Slot 10: GEN_CONTACT.

Total asked: 7 core + 3 follow-ups = 10. Deferred goals: G5 (RST_INBOUND), G2 revenue part, G3 roles part. All are flagged for the discovery call.


4. Machine-readable appendix (rules format)
Field reference: id (string, unique, UPPER_SNAKE) · text (string, may contain {first_name}) · type (single_choice, multi_choice, number, short_text, long_text, contact_block) · options (array of {id: int, label, ordinal: bool}) · goal (G1–G8) · required (bool) · industry_tags (array; "generic" means every path) · slot (1–10, or null for follow-ups) · slot_class (core, flex, followup) · replaces (generic id, for swap-ins) · followups (array of triggers).

Condition operators: eq, gte, lte (number) · in (single choice, option ids) · option_gte, option_lte (single choice, ordinal options only) · includes_any, includes_all (multi choice) · combinators any, all, not.

{
  "spec_version": "onb1.qbank.v1.1",
  "limits": { "max_questions": 10, "max_followups": 3, "max_chain_depth": 2 },
  "core_slots": [1, 2, 3, 4, 5, 6, 10],
  "flex_slots_drop_order": [9, 8, 7],
  "on_no_budget": "skip_and_log",
  "industry_map": { "1": "restaurant", "2": "professional_services", "3": "professional_services",
                    "4": "professional_services", "5": "home_services", "6": "medical_dental",
                    "7": "generic", "8": "generic" },
  "questions": [
    {
      "id": "GEN_LOCATIONS",
      "text": "How many locations do you operate from? Count offices, shops, restaurants or clinics. If you work from one place or from home, that's 1.",
      "type": "number",
      "validation": { "integer": true, "min": 1, "max": 999 },
      "options": [],
      "goal": "G2",
      "required": true,
      "industry_tags": ["generic"],
      "slot": 3,
      "slot_class": "core",
      "sizing_only": true,
      "followups": []
    },
    {
      "id": "RST_PAIN",
      "text": "What eats up the most time running the restaurant right now? Pick up to two.",
      "type": "multi_choice",
      "max_selections": 2,
      "comment_field": { "label": "Anything else?", "type": "long_text", "required": false, "counts_as_question": false },
      "options": [
        { "id": 1, "label": "Phones and reservations", "ordinal": false },
        { "id": 2, "label": "Catering and private-event inquiries", "ordinal": false },
        { "id": 3, "label": "Staff scheduling and shift swaps", "ordinal": false },
        { "id": 4, "label": "Inventory, ordering and food cost", "ordinal": false },
        { "id": 5, "label": "Online reviews and guest feedback", "ordinal": false },
        { "id": 6, "label": "Hiring and training staff", "ordinal": false },
        { "id": 7, "label": "Reporting across shifts or locations", "ordinal": false },
        { "id": 8, "label": "Marketing and promotions", "ordinal": false },
        { "id": 9, "label": "Other (describe)", "ordinal": false, "free_text": true }
      ],
      "goal": "G6",
      "required": true,
      "industry_tags": ["restaurant"],
      "slot": 2,
      "slot_class": "core",
      "replaces": "GEN_PAIN",
      "followups": [
        { "rule_id": "RST-R2", "priority": 2,
          "condition": { "any": [
            { "q": "RST_PAIN", "op": "includes_any", "value": [1] },
            { "q": "RST_INBOUND", "op": "option_gte", "value": 4 } ] },
          "then": "RST_FU_CALLS" },
        { "rule_id": "RST-R3", "priority": 2,
          "condition": { "q": "RST_PAIN", "op": "includes_any", "value": [2] },
          "then": "RST_FU_EVENTS" }
      ]
    }
  ]
}

Encoding notes for Bob:

A rule that spans two questions (like RST-R2) is evaluated after each question it references is answered. It fires at most once per interview.
A condition on a question that hasn't been asked (or was dropped) evaluates to false.
Encode every question and rule in §2–§3 in this format. The three objects above are the pattern.
Output record per interview: answers by question id, industry_tag, asked_order, dropped_slots, followups_asked, followups_skipped (rule ids), and goal_status for G1–G8 (answered, partial or deferred).


5. Guardrails
5.1 Business info only. Never ask for, and actively block, sensitive personal data:

No Social Security numbers, tax IDs for individuals, card or bank numbers, passwords, login credentials or API keys.
No customer, client or patient personal details (names, health info, case details).
Validation on every free-text field: if the input matches an SSN pattern (e.g., 123-45-6789), a 13–19 digit card-like number that passes a Luhn check, or words like "password:" or "pwd", don't store it. Show: "Looks like that might include sensitive info. Please remove it. We only need a general description." Log a redacted flag only.
The AI interviewer must never ask for any of the above, even if the prospect offers it.

5.2 Tell the prospect how answers are used. Intro screen copy (before Q1, doesn't count toward the 10). [TBD – Vincent: final wording and privacy-policy link]

"Hi! This takes about 5 minutes: 10 quick questions, max. Your answers help StorenTech AI prepare your AI Opportunity Map, a short list of the places AI can save your business time. A real person at StorenTech reviews everything before we reach out. We only ask about your business, never passwords, card numbers, Social Security numbers, or customer or patient personal details. We use your answers to prepare your Map and to contact you, and we don't sell them."

Include a "Continue" button (counts as consent) and a link to the privacy policy.

5.3 A human reviews, and nothing is auto-sent beyond the confirmation.

All submissions go to a StorenTech review queue (Vincent or a team member). Nothing goes straight into a Map, quote, proposal, calendar invite, CRM sequence or marketing list.
The only automatic outputs are: (a) the interview's own confirmation, meaning the on-screen confirmation plus one confirmation email to the work email entered (with the booking-page link), and (b) Google Calendar's standard booking confirmation, which shows the static ONB1 interview link. Any follow-up email, including Ellie Inbox's follow-up with the interview link, is a draft that a person at StorenTech approves before it's sent. None of these makes promises about price or results.
Confirmation copy:

"Thanks, {first_name}, you're all set! Here's what happens next: pick a time for a quick call on the calendar below. Someone at StorenTech will personally review your answers before the call. After the call, we'll prepare your AI Opportunity Map."

5.4 Other build rules.

No real client names, data or details anywhere in the app, its examples or its seed data.
The prospect can go back and edit any answer before submitting. Editing an answer re-runs rules, but follow-ups already shown still count toward the 10.
Store submissions with access limited to the StorenTech team. [TBD – Vincent: retention period]


6. Open items for Vincent
Approve the slot map (core 1–6 and 10, flex 7–9, drop order 9 → 8 → 7).
Confirm intro and confirmation wording and the privacy-policy link.
Confirm the four industry packs, or swap one (e.g., real estate or retail).
Set the follow-up SLA shown to prospects (currently none promised) and the data-retention period.
RESOLVED (v1.1, Vincent): locations. Discovery assumes the prospect starts with one location. GEN_LOCATIONS is a sizing question only, the scope and per-location follow-ups are removed, no follow-up slot is reserved, and per-location detail is deferred to the human discovery call.
RESOLVED (v1.1, Vincent): booking tool. Use a Google Calendar appointment schedule (booking page) in the StorenTech Google Workspace. See "Website flow (for Bob)".
RESOLVED (v1.1, Vincent): interview answers are NOT attached to the booking. The booking page and its confirmation only show a link to the ONB1 interview. The booking form always collects name, email, phone and business name. Ellie Inbox then follows up with the interview link as a draft that a person approves; nothing is auto-sent. A person at StorenTech reviews any answers before the call.
OPEN (Bob to verify): the Google Calendar booking form can require phone and business name as custom fields, and the static interview link in the booking page description shows up in Google's confirmation email. If either doesn't work natively, tell Vincent before building a workaround.