# Users

Who uses the tool, what they need from it, and the seeded accounts for the demo. Role definitions follow [GLOSSARY.md](../GLOSSARY.md).

## Roles

| Role | Who they are | What they do in the tool | Cannot |
|---|---|---|---|
| **Editor** | Content staff: instructional designers and lesson editors (replacing the freelance-authoring step) | Import Unit Outlines, resolve Outline Issues, write Generation Guidance, start and cancel generation, Regenerate, edit Lessons, use AI tools, claim Lessons, submit Lessons for review | Approve, request changes, Reopen, Publish |
| **Approver** | Lead content staff who sign off curriculum for state review | Everything an Editor can do, plus approve, request changes (with a reason), Reopen Approved Lessons, bulk approve, Publish Units | n/a |

Rules that apply to both:
- Nobody edits an Approved Lesson; it must be Reopened first.
- An Approver may approve a Lesson they edited (Self-Approval); it is allowed and always recorded.
- Approval over failing Quality Checks is allowed and recorded.
- Identity comes from sign-in and is trusted; every action is still checked against the role on the server.

## Personas

**Maya, instructional designer (Editor).** Wrote the Unit 4 Outline. Wants the tool to respect her design (lesson order, standards, vocabulary, Designer Notes) and to tell her where her Outline has mistakes before anything is generated. Measures success by "how much of the generated Lesson I can keep".

**Jordan, lesson editor (Editor).** One of 20+ staff working through a Unit. Wants to find their next Lesson quickly, see what the designer asked for beside the draft, fix content fast with AI help they control, and never overwrite a colleague.

**Priya, content lead (Approver).** Accountable for what goes to the state. Wants a review queue, confidence that each Lesson genuinely teaches its standards, an audit trail of who approved what and why, and a Release that cannot change after it ships.

**Downstream engineer (integration consumer).** Needs a stable, structured export of a Unit Release to load into Newsela's product.

## Demo accounts (seeded)

| Name | Role | Used to show |
|---|---|---|
| Maya Chen | Editor | Importing, Generation Guidance, generation |
| Jordan Ellis | Editor | Editing, co-editing (second browser), AI Suggestions |
| Sam Rivera | Editor | Assigned Lessons, Changes Requested |
| Priya Natarajan | Approver | Review queue, approve / request changes, Publish |
| Alex Kim | Approver | Self-Approval and Reopen scenarios |

Names are fictional.
