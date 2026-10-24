# Standards come from a checked-in dataset built by a script, never from the model or a live lookup

Official CA standards text (Grade 6 CCSS ELA, ELD, and the Model School Library Standards the Outline calls "Media Literacy") is stored in a checked-in JSON dataset produced by a build script from Common Standards Project data, corrected where that data is wrong (ELD Part II item 2 is mis-coded as `PII.6.1a/b`), and checked against the CDE PDFs. Standards are fixed reference data: the import preview must validate codes instantly and offline, prompts must carry the exact official wording, and tests must be deterministic.

## Considered Options

- **The model's own knowledge**: unverifiable wording for content headed to state approval.
- **Live web lookup per generation**: CDE publishes PDFs behind bot protection; slow, costly, non-deterministic, and it breaks mid-Unit if a page moves.
