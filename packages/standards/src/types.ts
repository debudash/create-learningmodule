/** The standards frameworks a Unit Outline can cite. */
export type Framework =
  /** California Common Core State Standards for ELA/Literacy */
  | 'CCSS-ELA'
  /** California English Language Development Standards */
  | 'ELD'
  /** Model School Library Standards, cited in Outlines as "Media Literacy" */
  | 'MSLS';

/** Text of an ELD standard at each proficiency level. */
export interface ProficiencyLevels {
  emerging: string;
  expanding: string;
  bridging: string;
}

/**
 * One official standard. Codes are canonical (see normalizeCode):
 *   CCSS-ELA  "RL.6.1", "W.6.3.a"
 *   ELD       "ELD.PI.6.6" (item), "ELD.PI.6.6.a" (sub-item)
 *   MSLS      "MSLS.6.2.1.a"
 */
export interface Standard {
  code: string;
  framework: Framework;
  grade: number;
  /** Official text. For an ELD item this is its title, e.g. "Reading/viewing closely". */
  text: string;
  /** ELD items and sub-items only: the official text at each proficiency level. */
  levels?: ProficiencyLevels;
  parent?: string;
  children: string[];
}
