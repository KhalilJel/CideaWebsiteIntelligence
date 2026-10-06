import type { ImprovementPlan } from "../domain/improvement-plan.js";
import { improvementActionToCodingTask, type CodingTask } from "../domain/coding-task.js";

export function improvementPlanToCodingTasks(plan: ImprovementPlan): CodingTask[] {
  return plan.actions
    .filter(action => plan.selectedTopFive.includes(action.id))
    .map(action => improvementActionToCodingTask(action, plan.target, plan.websiteUrl));
}
