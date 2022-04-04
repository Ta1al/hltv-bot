/** Command Data
 * {
  "name": "get_matches",
  "description": "Get all matches from hltv.org/matches page",
  "options": [
    {
      "type": 4,
      "name": "event_id",
      "description": "Filter matches by event ID."
    },
    {
      "type": 3,
      "name": "filter",
      "description": "Filter matches by pre-set categories. Overrides other filters.",
      "choices": [
        {
          "name": "top_tier",
          "value": "top_tier"
        },
        {
          "name": "lan_only",
          "value": "lan_only"
        }
      ]
    }
  ]
} */

import HLTV, { MatchFilter, MatchPreview } from "hltv";
import {
  Message,
  MessageComponentInteraction,
  CommandInteraction,
  MessageActionRow,
  MessageSelectMenu,
  Client
} from "discord.js";
import { get, set } from "./../cache";

module.exports = async (
  interaction: CommandInteraction,
  _client: Client,
  eventId: number | undefined,
  ephemeral: boolean
) => {
  const i = await interaction.deferReply({ fetchReply: true, ephemeral });
  let str;
  let filter: MatchFilter | undefined;
  if (!ephemeral) {
    str = interaction.options.getString("filter") || undefined;
    if (str) filter = str === "top_tier" ? MatchFilter.TopTier : MatchFilter.LanOnly;
    eventId = interaction.options.getInteger("event_id") || undefined;
  }

  // cache
  let matches: any;
  if (!eventId && !filter) matches = get("matches");
  if (eventId && !filter) matches = get(`matches_${eventId}`);
  if (filter) matches = get(`matches_${filter}`);
  if (!matches)
    matches = await HLTV.getMatches({ eventIds: eventId ? [eventId] : [], filter }).then((m) => {
      m = m.slice(0, 25);
      if (!eventId && !filter) set("matches", m, 6e4);
      if (eventId && !filter) set(`matches_${eventId}`, m, 6e4);
      if (filter) set(`matches_${filter}`, m, 6e4);
      return m;
    });

  const row = new MessageActionRow().addComponents(
    new MessageSelectMenu({
      custom_id: "matches",
      placeholder: "Select a match",
      options: matches.map((m: MatchPreview) => ({
        label: `${m.team1?.name || "TBD"} vs ${m.team2?.name || "TBD"}`,
        description: `${m.event?.name || m.title || "N/A"}`,
        value: `${m.id}`
      }))
    })
  );

  await interaction.editReply({ components: [row] });

  const msg = i as Message;
  const cfilter = (int: MessageComponentInteraction) => int.message.id == i.id;
  msg
    .createMessageComponentCollector({ filter: cfilter, idle: 3e4 })
    .on("collect", async (int) => {
      if (!int.isSelectMenu()) return;
      require("./get_match")(int, null, int.values[0], true);
    })
    .on("end", () => {
      interaction.editReply({ content: "Timed out", components: [] });
    });
};
