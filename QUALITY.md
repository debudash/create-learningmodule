# Quality, cost and load

All numbers come from real runs on 2026-10-25:
- **Generation:** the whole sample Unit (Grade 6, Unit 4, *The Lightning Thief*), generated live by Claude Sonnet 5.5 at effort `medium`, prompt version 2, 5 Lessons at a time.
- **AI Reviews:** Claude Haiku 5.5.
- **Load tests:** run against the Docker Compose stack on one laptop.

The run is recorded in `fixtures/recordings/`, so replay mode reproduces it at no cost.

## Summary

| | Result |
|---|---|
| Lessons generated | 46 of 46: 40 Lessons and 6 Flex Days. L3 is the hand-written demo Lesson. All 46 reached Draft. |
| Time | 14 minutes for the Unit; each call averages 82 s. |
| Cost | $7.65 generation + $0.05 AI Review = **$7.70 per Unit**, about $0.17 per Lesson. |
| Rule-Based checks | 46 of 46 pass pacing, Sections, Focus Standards taught, standard tags, Pulse Check and Student View. 2 ELD-support and 1 vocabulary warning. |
| AI Review | 106 of 137 standard verdicts "taught", 30 "partly", 1 "not taught". The Lesson's texts are used fully in 34 of 46, partly in 10, and missing in 2. |
| Against the Answer Key | Section structure and minutes match the published Lessons exactly. Focus Standards match the Outline every time (see below). |
| 25 reviewers at once | An edit reaches the others in 11 ms (p95 27 ms). Pages load in 306 ms (p95 405 ms). No errors. |

## Cost and time by Lesson Type

| Lesson Type | Lessons | Cost per Lesson | Average call | Output tokens per Lesson |
|---|---|---|---|---|
| Core Reading | 21 | $0.159 | 84 s | 13,786 |
| Core Writing | 9 | $0.228 | 83 s | 18,591 |
| Flex Day | 6 | $0.134 | 61 s | 10,034 |
| Writing | 6 | $0.148 | 71 s | 12,015 |
| Academic Discussion | 2 | $0.123 | 75 s | 10,444 |
| Spark | 2 | $0.169 | 145 s | 12,448 |

Tokens across the run:
- 432k uncached input;
- 104k written to the prompt cache;
- 887k read from it (the locked instructions, Unit context and example Lesson are cached per Unit and Lesson Type);
- 635k output.

Output is most of the cost.

A program of 4 Units would cost roughly $31 to generate. The brief's metric is staff time, not API spend.

## Reliability: first replies and repairs

| | Attempts |
|---|---|
| First reply valid as Lesson JSON | 18 of 49 |
| Valid after the one repair call | 28 |
| Still invalid after the repair, then retried and succeeded | 3 (L24, L26, L34) |
| Lessons that ended in Draft | 46 of 46 |

Why first replies failed, counted from the recordings:
- **Support-table rows carry the wrong fields** (missing `situation` or `tryThis`, other blocks' fields, or misspellings such as `tryTry`): 26 replies.
- **A teacher script written with its move as the block type** (`{"type": "teach", ...}`): 17 replies.
- **Not valid JSON:** 10 replies. Most broke down at one of those `"teach"` blocks.

Two decisions shape this:
- **Why the schema is in the prompt.** The API refuses the whole-Lesson schema as a structured-output grammar: one Section compiles, a whole Lesson does not (LCG-28, ADR 0005). The JSON Schema is therefore in the cached prompt, and every reply is validated, with one repair call and then retries.
- **Already applied.** A block typed `teach`, `say` or `ask` is now read as that teacher script before validation. Measured offline on the recorded replies, that alone saves 4 of the 31 repairs.

Next step:
- **What:** add two short examples of a correct teacher script and support-table row to the locked instructions, then measure on a trial run.
- **Expected gain:** most of the remaining repairs. Each repair is a second full-length call, so fewer repairs cut both cost and time.
- **Further option:** generating per Section with structured outputs, since one Section compiles, would make replies valid every time. But it costs more calls and makes the Lesson less coherent.

## Quality Checks across the Unit

Rule-Based checks are deterministic and run on every stored Lesson.

| Check | Pass | Warn | Fail |
|---|---|---|---|
| Sections required by the Lesson Type | 46 | 0 | 0 |
| Lesson pacing (50 minutes) and Section pacing | 46 / 46 | 0 | 0 |
| Every Focus Standard taught by an Activity | 46 | 0 | 0 |
| Standard tags real and among the Lesson's standards | 46 | 0 | 0 |
| Pulse Check where the Lesson Type calls for one | 46 | 0 | 0 |
| Student View holds no teacher-only material | 46 | 0 | 0 |
| Outline vocabulary defined | 45 | 1 | 0 |
| Integrated ELD support per Learning in Action Activity | 126 | 2 | 0 |

The AI Review (Haiku, about $0.001 per Lesson) asks for judgement:
- Of 137 Focus Standard verdicts, 106 say the standard is taught, 30 "partly" and 1 "not taught". The "partly" verdicts are useful pointers for Approvers. For example, RI.6.7 is "partly" taught when every source is print and none is visual media.
- The Lesson's texts are fully used in 34 Lessons, partly in 10 (usually where the Outline leaves passage choice to the teacher), and missing in 2.

## Against the Answer Key (published Unit 4)

Published Unit 4 is held out: it is never used in prompts or examples (ADR 0007). The source documents include three published Unit 4 Lessons. The table compares them with our generated Lessons. Published numbering counts Flex Days, so published Lesson 45 is our L41. Run it with `packages/db/scripts/answer-key.ts 1 4 45:L41`.

| | L1: What Are Myths? | L4: The Lightning Thief, Chapter 1 | L41: Seminar and Podcast Showcase |
|---|---|---|---|
| Sections and minutes | Same as published (Spark: Launch 15, Learning in Action 30, Look Back 5) | Same (5 / 10 / 30 / 5 / 0) | Same (5 / 10 / 30 / 5 / 0) |
| Focus Standards | L.6.4.b, RI.6.1, RI.6.4, SL.6.1.a: same as published | RL.6.1, RL.6.2, L.6.4, as the Outline asks; published uses L.6.4.a, RL.6.4, RL.6.6 | SL.6.1, 6.2, 6.4, 6.5, 6.6, as the Outline asks; published uses L.6.3.a, SL.6.4.a, SL.6.6 |
| ELD Standards | Same codes at standard level (published also lists Bridging/Emerging/Expanding levels) | PI.6.6 shared; ours adds PI.6.7 and PII.6.5, published uses PII.6.2b | Same codes |
| Vocabulary | myth, mythology, infer, values (published: mythology, myth, phenomenon, origin, sacred) | 15 words, including 4 of the published 7 (immortal, sarcastic, expelled, probation) | 6 words; seminar is shared |
| Texts | "What Are Myths?" plus the Outline's Coolidge passages | The Lightning Thief | The Lightning Thief plus the students' essays |
| Length (Teacher View words) | 2,061 (published 1,248) | 3,537 (3,295) | 2,873 (2,746) |

What this shows:
- **Structure is right.** Sections, their order and their minutes match the published Lessons exactly. That comes from the house structure enforced by the schema and the rule checks.
- **The Outline is followed.** Where Focus Standards differ (L4 and L41), the generated Lesson teaches exactly what its Outline row asks. The published Lessons moved away from the Outline during final authoring. The system follows the Outline by design; an Editor or Approver can make such a change in review.
- **Length is in range, sometimes generous.** L1 is longer than the published Lesson because it scripts every teacher move and sample response, which suits teachers with little preparation time.

## Load: 20+ reviewers at once

`apps/collab/scripts/load-test.ts` simulates reviewers against the containers:
- people work five to a Lesson;
- each edits their Lesson over the collaboration server every 2 s;
- each loads the Unit board and their Lesson page every 5 s;
- each run lasts 60 s.

| Reviewers | Edit reaches the others (p50 / p95 / max) | Unit board page (p50 / p95) | Lesson page (p50 / p95) | Errors |
|---|---|---|---|---|
| 25 on 5 Lessons | 11 / 27 / 108 ms | 306 / 404 ms | 308 / 405 ms | 0 |
| 50 on 10 Lessons | 14 / 40 / 160 ms | 541 / 643 ms | 555 / 661 ms | 0 |

Memory stayed under 500 MB per container: web 478 MB at 50 reviewers, collab 168 MB, Postgres 218 MB.

Two caveats:
- **Production build, one laptop.** This is one web process in a production build. Page time grows with load because each request renders on the server.
- **Fly would add a little.** Two small Fly machines and a managed Postgres would add some network latency but no new bottleneck. The design keeps everything in Postgres, and editing traffic goes to the collaboration server, not the web app.
