# Issue log

Every bug fixed in this project: one entry per issue, fixed test-first in its own commit. The commit message holds the issue, root cause, fix and test; the fix site and the regression test carry the same ID.

| ID | Found by | Issue | Commit |
|---|---|---|---|
| LCG-1 | Phase 1 spec review | An Outline row with an unknown Lesson Type raised a Blocking issue no resolution could clear, so the import could never be confirmed | `15909d2` |
| LCG-2 | Phase 1 spec review | A mistyped ELD code was silently kept as a Designer Note and the standard disappeared | `3f4b323` |
| LCG-3 | Phase 1 spec review | Standard ranges written with a spaced hyphen ("W.6.3.a - e") were not expanded | `6587360` |
| LCG-4 | Phase 2 spec review | A Pulse Check could have no correct choice, or several | `fd7009b` |
| LCG-5 | Phase 2 spec review | The server stored Lessons whose Sections had been removed or reordered | `9174c26` |
| LCG-6 | Phase 2 spec review | A renamed Lesson kept its old title on the board and in headings | `3f6d54b` |
| LCG-7 | Phase 2 spec review | Whole-Lesson writes (Regenerate, Restore) were overwritten by open editors | `9fc121d` |
| LCG-8 | Phase 2 spec review | A Lesson approved while open stayed editable for the people editing it | `0aeb942` |
| LCG-9 | Phase 3 spec review | Regenerate discarded the content it replaced | `b70ec09` |
| LCG-10 | Phase 3 spec review | A cancelled-then-restarted Lesson could be generated twice | `cbe9ec5` |
| LCG-11 | Phase 3 spec review | A worker crash on the last attempt left a Lesson Generating forever | `fd48f57` |
| LCG-12 | Phase 3 spec review | Generation Attempts recorded the wrong model and cost | `7e527a8` |
| LCG-13 | Phase 3 spec review | The import wizard trusted the proposal sent back by the browser | `25819e8` |
| LCG-14 | Phase 3 spec review | A regenerated Flex Day did not wait for the rest of its Arc | `5848f20` |
| LCG-15 | Phase 4 spec review | A crafted review request could move a Lesson out of its workflow | `7a6d951` |
| LCG-16 | Phase 4 spec review | Restoring a Version did not count as editing, so Self-Approval went unflagged | `035203e` |
| LCG-17 | Phase 4 spec review | An Approved Version could miss the last edits made before approval | `c1ff848` |
| LCG-18 | Phase 4 spec review | Bulk approve skipped the stale-state and same-Unit checks | `ee7ff50` |
| LCG-19 | Phase 5 spec review | AI Review verdicts on old content still counted as failing checks | `85bd844` |
| LCG-20 | Phase 5 spec review | A review of content edited mid-review was saved as current | `35a548e` |
| LCG-21 | Phase 5 spec review | Two reviews finishing together duplicated the results | `2db8018` |
| LCG-22 | Phase 5 standards review | AI Review cost and model were not recorded or counted in the Unit cost | `2c9f3a0` |
| LCG-23 | Phase 5 spec review | In replay mode every AI Review failed and was retried; the key ignored the content | `6cf2fe4` |
| LCG-24 | Phase 5 spec review | Lesson text could close the review prompt's tags and address the reviewer | `0038e71` |
| LCG-25 | Phase 6 spec review | Accepting an AI Suggestion could wipe a colleague's edit made during the server round-trip | `1a1121f` |
| LCG-26 | Phase 6 spec review | An AI Suggestion was recorded as accepted before it was applied | `c80e90c` |
| LCG-27 | Browser re-check, Phase 6 | Accepting an AI Suggestion set off an endless re-render | `6f274e7` |
| LCG-28 | First live trial | The API refused every Lesson: the whole generation output was too large to compile as a structured-output grammar | `7e32d69` |
| LCG-29 | First live trial | A retry that started late (the machine had slept) was failed by the stall sweep while it ran | `7f0e797` |
| LCG-30 | First live trial | A generation result that arrived after the Lesson was failed was stored anyway, leaving content in a Generation Failed Lesson | `9b04ee1` |
| LCG-31 | First live trial | The AI Review judged every Lesson against the Unit's anchor text, so Lessons reading the Outline's other texts failed | `084cdc7` |
| LCG-32 | First live trial | The Student View check failed Lessons whose teacher asks aloud the question students read | `5a26121` |
