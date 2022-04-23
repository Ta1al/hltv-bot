import {
  CommandInteraction,
  Message,
  MessageActionRow,
  MessageSelectMenu,
  SelectMenuInteraction,
  WebhookEditMessageOptions,
} from "discord.js";
import HLTV, { MatchFilter, MatchPreview } from "hltv";
import { get, set } from "../db";

const message = async (interaction: CommandInteraction) => {
  const i = await interaction.deferReply({ fetchReply: true }),
    filter = (interaction.options.getString("filter") as MatchFilter) || undefined;

  let matches: MatchPreview[] = await getMatches(null, filter);
  if (!matches.length) return interaction.editReply("❌ Could not find matches");

  idleCollector(i as Message, interaction);
  return interaction.editReply(createMessage(matches));
};

const component = async (interaction: SelectMenuInteraction) => {
  return require('./getmatch').update(interaction, parseInt(interaction.values[0]));
};

module.exports = { message, component };

// ============================================================

function idleCollector(i: Message, interaction: CommandInteraction) {
  i.createMessageComponentCollector({ max: 1, idle: 30e3 }).on('end', (_, r) => {
    if (r === 'idle') interaction.editReply({ content: "⏰ Timed out", components: [] });
  })
}

// ============================================================

function createMessage(matches: MatchPreview[]): WebhookEditMessageOptions {
  const components = createComponents(matches);
  return { components };
}

function createComponents(matches: MatchPreview[]): MessageActionRow[] {
  const components = [
    new MessageActionRow().addComponents(
      new MessageSelectMenu({
        custom_id: "getmatches",
        placeholder: "Select a match",
        options: matches.map((m: MatchPreview) => ({
          label: `${m.team1?.name || "TBD"} vs ${m.team2?.name || "TBD"}`,
          description: `${m.event?.name || m.title || "N/A"}`,
          value: `${m.id}`,
        })),
      })
    ),
  ];
  return components;
}

// ============================================================

async function getMatches(eventId: number | null, filter: MatchFilter) {
  let matches: any[] = [];
  if (!eventId && !filter) matches = await get("matches");
  if (eventId && !filter) matches = await get(`matches_${eventId}`);
  if (filter) matches = await get(`matches_${filter}`);
  if (!matches)
    matches = await HLTV.getMatches({ eventIds: eventId ? [eventId] : [], filter })
      .then(m => {
        m = m.slice(0, 25);
        if (!eventId && !filter) set("matches", 36e5, m);
        if (eventId && !filter) set(`matches_${eventId}`, 36e5, m);
        if (filter) set(`matches_${filter}`, 36e5, m);
        return m;
      })
      .catch(() => []);
      
  return matches;
}
