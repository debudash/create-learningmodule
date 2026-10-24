# @lcg/standards

Official Grade 6 California standards (CCSS ELA, ELD, and the Model School Library Standards that
Outlines call "Media Literacy"), with lookups by canonical code, code normalisation, and the ELD
description check used for import Warnings. See ADR 0006 for why this is a checked-in dataset.

- `data/standards.grade6.json`: the dataset, built by `pnpm --filter @lcg/standards build:data`
  from the Common Standards Project files in `docs/source/standards/`. Do not edit it by hand;
  change `scripts/build-standards.ts` and rebuild. The file lists the corrections applied to the
  source data (e.g. ELD Part II item 2, coded `PII.6.1a/b` in CSP).
- `normalizeCode(raw, framework)`: syntax only (`W.6.3a` to `W.6.3.a`, `2.1.a` to `MSLS.6.2.1.a`).
- `getStandard`, `hasStandard`, `listStandards`: lookups take canonical codes only.
- `suggestEldCode(code, description)`: deterministic word-overlap check; the method and its
  calibration against the sample Outline are described in `src/eld-match.ts`.

## Attribution

Standards data derives from the [Common Standards Project](https://commonstandardsproject.com),
licensed [CC BY 3.0 US](http://creativecommons.org/licenses/by/3.0/us/); rights holder D2L
Corporation (formerly Desire2Learn Incorporated). Source documents, by ASN identifier:

| Framework | ASN ID   | Document                                                                                        |
| --------- | -------- | ----------------------------------------------------------------------------------------------- |
| CCSS-ELA  | D2515047 | California Common Core State Standards: English Language Arts and Literacy                      |
| ELD       | D2659716 | California English Language Development Standards                                               |
| MSLS      | D2622356 | Model School Library Standards for California Public Schools, Kindergarten Through Grade Twelve |

The California Department of Education publications are the authority; the CSP data was checked
and corrected against them:
[finalelaccssstandards.pdf](http://www.cde.ca.gov/be/st/ss/documents/finalelaccssstandards.pdf),
[eldstndspublication14.pdf](http://www.cde.ca.gov/sp/el/er/documents/eldstndspublication14.pdf),
[librarystandards.pdf](http://www.cde.ca.gov/be/st/ss/documents/librarystandards.pdf)
(copies in `docs/source/standards/`).
