import { fiscalIssueSkill } from "./fiscal-issue.skill";
import { fiscalStatusSkill } from "./fiscal-status.skill";
import { fiscalCancelSkill } from "./fiscal-cancel.skill";
import { fiscalSearchSkill } from "./fiscal-search.skill";

export { fiscalIssueSkill, fiscalStatusSkill, fiscalCancelSkill, fiscalSearchSkill };

export const fiscalV2BaseSkills = [
  fiscalIssueSkill,
  fiscalStatusSkill,
  fiscalCancelSkill,
  fiscalSearchSkill,
] as const;
