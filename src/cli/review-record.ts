import { decideReviewRecord, getReviewRecord } from "../integrations/review-store.js";
import { humanReviewDecisionSchema } from "../domain/human-review.js";

const [command, reviewId, action, reviewer, ...noteParts] = process.argv.slice(2);

if (!command || !reviewId) {
  throw new Error(
    "Usage: npm run review:record -- show <review-id> | decide <review-id> <approve|reject|iterate> <reviewer> <note>"
  );
}

if (command === "show") {
  const record = await getReviewRecord(reviewId);
  if (!record) throw new Error("Review record not found.");
  console.log(JSON.stringify(record, null, 2));
} else if (command === "decide") {
  if (!action || !reviewer || noteParts.length === 0) {
    throw new Error("Usage: npm run review:record -- decide <review-id> <approve|reject|iterate> <reviewer> <note>");
  }
  const decision = humanReviewDecisionSchema.parse({
    action,
    reviewer,
    note: noteParts.join(" "),
    reviewedAt: new Date().toISOString()
  });
  const result = await decideReviewRecord(reviewId, decision);
  console.log(JSON.stringify(result, null, 2));
} else {
  throw new Error(`Unknown review command: ${command}. Use show or decide.`);
}
