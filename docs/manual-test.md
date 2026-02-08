# Manual Test Checklist

Happy-path checklist for ONB1. Run in this order to validate end-to-end behavior.

1. Prospect intake: start a new conversation in the web UI, complete all steps through SUMMARY and SUBMIT, verify conversation/messages are stored, and confirm the Slack `Prospect Intake` message posts once with summary bullets.
2. End & Send Now: start a new conversation, trigger End & Send Now before finishing all steps, verify state is SUBMIT with an audit log entry, and confirm Slack handoff posts exactly once.
3. Existing client auth: request OTP using a seeded client email, verify token and session, then fetch projects and confirm at least one project is returned.
4. Client request intake: pick project, choose type, describe, set impact/urgency, attach a file, verify request row stored with Slack thread metadata, and confirm Slack post in `#onb1-intake` with attachment links.
5. Add-on detection: submit a `new` request type or mention a new integration, confirm add-on flag/rationale stored, and confirm Slack message includes the add-on note.
6. Estimate drafting: verify a draft estimate is generated and status is `draft`.
7. Invoice approval gate: call `POST /admin/estimates/{id}/approve`, confirm Stripe draft invoice is created and stored, call `POST /admin/invoices/{id}/send`, confirm Stripe sends the invoice and Slack thread posts the update, then call `POST /admin/invoices/{id}/send` again and verify it returns `already_sent`.
8. Attachments: upload a file using the presigned URL, verify attachment metadata stored, and confirm it appears in Slack handoff.
