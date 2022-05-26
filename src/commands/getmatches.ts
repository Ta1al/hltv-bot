import {
  ButtonInteraction,
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
  return interaction.editReply(createMessage(matches, interaction.user.id));
};

const component = async (interaction: SelectMenuInteraction) => {
  if (interaction.user.id !== interaction.customId.split(" ")[1]) return;
  return require('./getmatch').update(interaction, parseInt(interaction.values[0]));
};

const update = async (interaction: ButtonInteraction, eventId: number) => {
  const i = await interaction.deferUpdate({ fetchReply: true });

  let matches: MatchPreview[] = await getMatches(eventId);
  if (!matches.length) return interaction.editReply("❌ Could not find matches");
  
  idleCollector(i as Message, interaction);
  return interaction.editReply(createMessage(matches, interaction.user.id));
}

module.exports = { message, component, update };

// ============================================================

function idleCollector(i: Message, interaction: CommandInteraction | ButtonInteraction) {
  i.createMessageComponentCollector({ max: 1, idle: 30e3 }).on('end', (_, r) => {
    if (r === 'idle') {
      const res = { content: "⏰ Timed out", components: [] };
      interaction.editReply(res);
    }
  })
}

// ============================================================

function createMessage(matches: MatchPreview[], userId: string): WebhookEditMessageOptions {
  const components = createComponents(matches, userId);
  return { components };
}

function createComponents(matches: MatchPreview[], userId: string): MessageActionRow[] {
  const components = [
    new MessageActionRow().addComponents(
      new MessageSelectMenu({
        custom_id: `getmatches ${userId}`,
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

async function getMatches(eventId: number | null, filter: MatchFilter | undefined = undefined) {
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
