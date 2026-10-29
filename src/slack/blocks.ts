import type { KnownBlock } from "@slack/types";
import type { ResolvedEntry } from "../psa/types.js";

export const APPROVE_ACTION = "approve_entries";
export const CANCEL_ACTION = "cancel_entries";

function entryLine(e: ResolvedEntry): string {
  const miles = e.mileage ? `, ${e.mileage} mi` : "";
  return `*${e.clientName}* - ${e.date} - ${e.hours}h ${e.workType}${miles}\n${e.summary}`;
}

/** The approval card: nothing is written until the technician clicks Approve. */
export function previewBlocks(
  pendingId: string,
  entries: ResolvedEntry[],
  questions: string[],
): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: "Here's what I'll log. Nothing is saved until you approve." },
    },
    ...entries.map(
      (e): KnownBlock => ({ type: "section", text: { type: "mrkdwn", text: entryLine(e) } }),
    ),
  ];

  if (questions.length > 0) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: `:grey_question: ${questions.join(" ")}` }],
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        style: "primary",
        action_id: APPROVE_ACTION,
        value: pendingId,
        text: { type: "plain_text", text: "Approve" },
      },
      {
        type: "button",
        action_id: CANCEL_ACTION,
        value: pendingId,
        text: { type: "plain_text", text: "Cancel" },
      },
    ],
  });

  return blocks;
}
