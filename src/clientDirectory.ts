import { readFileSync } from "node:fs";
import { z } from "zod";

const ClientSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
});

export type Client = z.infer<typeof ClientSchema>;

/**
 * Maps the shorthand technicians actually type ("ACME", "BB") to a real client
 * record. Resolution happens in code, not in the model, so a hallucinated
 * client name can never reach the PSA.
 */
export class ClientDirectory {
  private readonly byKey = new Map<string, Client>();

  constructor(readonly clients: Client[]) {
    for (const client of clients) {
      for (const key of [client.name, client.id, ...client.aliases]) {
        this.byKey.set(normalize(key), client);
      }
    }
  }

  static fromFile(path: string): ClientDirectory {
    const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
    return new ClientDirectory(z.array(ClientSchema).parse(raw));
  }

  resolve(alias: string): Client | undefined {
    return this.byKey.get(normalize(alias));
  }

  /** Compact list for the prompt so the model knows which shorthand is valid. */
  describeForPrompt(): string {
    return this.clients
      .map((c) => `- ${c.name} (also written as: ${c.aliases.join(", ")})`)
      .join("\n");
  }
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
