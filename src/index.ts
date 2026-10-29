import Anthropic from "@anthropic-ai/sdk";
import { ClientDirectory } from "./clientDirectory.js";
import { loadConfig, todayIn } from "./config.js";
import { BudgetGuard, FileBudgetStore, costUsd } from "./costGuard.js";
import { parseNotes } from "./parser.js";
import { InMemoryPsa } from "./psa/mockPsa.js";
import { createSlackApp } from "./slack/app.js";
import { PendingStore } from "./slack/handlers.js";

const config = loadConfig();

// Fail at startup if the configured model has no price, so the budget cap always works.
costUsd(config.CLAUDE_MODEL, { input_tokens: 0, output_tokens: 0 });

const anthropic = new Anthropic();
const clients = ClientDirectory.fromFile(config.CLIENTS_FILE);

const app = createSlackApp(
  { botToken: config.SLACK_BOT_TOKEN, appToken: config.SLACK_APP_TOKEN },
  {
    parse: (note, ctx) => parseNotes(anthropic, config.CLAUDE_MODEL, note, ctx),
    context: () => ({ today: todayIn(config.TIMEZONE), timezone: config.TIMEZONE, clients }),
    budget: new BudgetGuard(config.MONTHLY_BUDGET_USD, new FileBudgetStore(config.BUDGET_FILE)),
    model: config.CLAUDE_MODEL,
    psa: new InMemoryPsa(),
    pending: new PendingStore(),
  },
);

await app.start();
console.log(`Time entry bot running with ${config.CLAUDE_MODEL}, budget $${config.MONTHLY_BUDGET_USD}/month.`);
