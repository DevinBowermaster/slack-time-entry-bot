import { App } from "@slack/bolt";
import { APPROVE_ACTION, CANCEL_ACTION } from "./blocks.js";
import { handleApprove, handleCancel, handleNote, type HandlerDeps } from "./handlers.js";

export function createSlackApp(
  tokens: { botToken: string; appToken: string },
  deps: HandlerDeps,
): App {
  const app = new App({ token: tokens.botToken, appToken: tokens.appToken, socketMode: true });

  // Plain messages in DMs or channels the bot is in. Ignore bots and edits.
  app.message(async ({ message, say }) => {
    if (message.subtype !== undefined || !("text" in message) || !message.text) return;
    const reply = await handleNote(deps, message.user, message.text);
    await say({ text: reply.text, blocks: reply.blocks });
  });

  app.action(APPROVE_ACTION, async ({ ack, body, action, respond }) => {
    await ack();
    if (action.type !== "button") return;
    const reply = await handleApprove(deps, action.value ?? "", body.user.id);
    await respond({ text: reply.text, replace_original: true });
  });

  app.action(CANCEL_ACTION, async ({ ack, body, action, respond }) => {
    await ack();
    if (action.type !== "button") return;
    const reply = handleCancel(deps, action.value ?? "", body.user.id);
    await respond({ text: reply.text, replace_original: true });
  });

  return app;
}
