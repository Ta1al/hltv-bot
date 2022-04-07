/** Command Data
 * {
  "name": "get_results",
  "description": "Get first 50 results from hltv.org/results page",
  "options": [
    {
      "type": 4,
      "name": "event_id",
      "description": "Filter matches by event ID."
    }
  ]
} */
import HLTV, { FullMatchResult } from "hltv";
import {
  CommandInteraction,
  Client,
  Message,
  MessageComponentInteraction,
  MessageActionRow
} from "discord.js";
import { get, set } from "../cache";

module.exports = async (
  interaction: CommandInteraction,
  _client: Client,
  eventId: number,
  ephemeral: boolean
) => {
  const i = await interaction.deferReply({ fetchReply: true, ephemeral });
  if (!eventId) eventId = interaction.options.getInteger("event_id") || 0;

  let results: FullMatchResult[] | null = get(eventId ? `results-${eventId}` : "results");
  if (!results)
    results = await HLTV.getResults(eventId ? { eventIds: [eventId] } : undefined)
      .then((r) => {
        r = r.slice(0, 49);
        set(eventId ? `results-${eventId}` : "results", r, 36e5); // 1h
        return r;
      })
      .catch(() => null);
  if (!results || !results.length) return interaction.editReply("❌ No results found");

  const components = [makeMenu(results.slice(0, 25), 0)];
  if (results.length > 25) components.push(makeMenu(results.slice(25), 1));
  await interaction.editReply({ components });

  const msg = i as Message;
  const filter = (int: MessageComponentInteraction) => int.message.id === i.id;
  msg
    .createMessageComponentCollector({ filter, idle: 3e4 })
    .on("collect", async (c) => {
      if (c.isSelectMenu()) return require("./get_match")(c, null, parseInt(c.values[0]), true);
    })
    .on("end", () => {
      interaction.editReply({ content: "Timed out", components: [] });
    });
};

function makeMenu(results: FullMatchResult[], i: number) {
  return new MessageActionRow().addComponents({
    type: "SELECT_MENU",
    customId: "results_" + i,
    placeholder: "Select a match",
    options: results.map((r) => ({
      label: `${r.team1.name} vs ${r.team2.name}`,
      description: r.event.name,
      value: `${r.id}`
    }))
  });
}
