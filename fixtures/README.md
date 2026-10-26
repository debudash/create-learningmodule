# Fixtures

Sample data used by tests and the demo seed, read only through the `@lcg/fixtures` package.

| File | What it is | Origin |
|---|---|---|
| `outlines/g6-u4-lightning-thief.csv` | The sample Unit Outline from the project brief | Newsela's Google Sheet, exported as CSV (unchanged) |
| `lessons/g6-u4-l03-spark.json` | Unit 4, Lesson 3 as Lesson JSON | Written for this project from the Outline row |

The Lesson fixture is original work. It is **not** Newsela's published Unit 4 Lesson 3, which is
part of the Answer Key ([ADR 0007](../docs/adr/0007-unit-4-held-out-as-answer-key.md)) and never
enters a prompt or a generation fixture.

## Short demo Outline

`outlines/g6-u4-short-demo.csv` is the first four Lessons of the sample Outline, cells unchanged, with one deliberate error: L2's Focus Standard `RI.6.9` is written `RI.6.9.a`, a code that does not exist. Importing it shows both kinds of Outline Issue:

- **Blocking**, so Continue stays disabled until they are resolved:
  - `RI.6.9.a` is not a standard (with "Did you mean RI.6.9?");
  - L4's "6.2" is not a complete code. This one is in the real sheet.
- **Warnings:**
  - three ELD codes whose descriptions match a different standard (L1, L2, L4);
  - the title says Unit 4 where the filenames say Unit 3.

It is Grade 6, Unit 4, L1 to L4, so generating it in replay mode serves the recorded Lessons.

`outlines/g6-u4-demo-no-L3.csv` is the same short demo without L3, so it imports L1, L2 and L4. L3 is the hand-written demo Lesson and has no recording, so this is the version to use for generating in replay mode (for example, on the hosted copy). It shows the same Blocking issues and ELD warnings.
