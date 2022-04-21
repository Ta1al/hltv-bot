import {
  CommandInteraction,
  MessageActionRow,
  MessageButton,
  MessageButtonStyleResolvable,
  MessageComponentInteraction,
  MessageEmbed,
  WebhookEditMessageOptions,
} from "discord.js";
import { get, set } from "../db";
import hltv, { Player } from "hltv";
import { FullMatch } from "hltv/lib/endpoints/getMatch";

const message = async (interaction: CommandInteraction) => {
  await interaction.deferReply();
  const id = interaction.options.getInteger("match_id", true);
  const match = await getMatch(id);
  if (!match) return interaction.editReply("❌ Match not found");

  const msg = createMessage(match);
  return interaction.editReply(msg);
};

const component = (interaction: MessageComponentInteraction) => { };

module.exports = { message, component };

function createMessage(match: FullMatch): WebhookEditMessageOptions {
  const embed = createEmbed(match);
  const components = createComponents(match);
  return { embeds: [embed], components };
}

function createEmbed(match: FullMatch): MessageEmbed {
  const players = (id: number | undefined, team: Player[]) => {
    return `ID: [\`${id || "?"}\`](https://www.hltv.org/team/${id}/hltv-bot)
    ${team
        .map(p => `[${p.name}](https://www.hltv.org/players/${p.id}/hltv-bot) (\`${p.id || "?"}\`)`)
        .join("\n")}`;
  };
  const embed = new MessageEmbed()
    .setColor("#2f3136")
    .setTimestamp(new Date(match.date || 0))
    .setTitle(`${match.event.name}`)
    .setURL(`https://www.hltv.org/events/${match.event.id}/hltv-bot`)
    .setDescription(`**Match Status:** ${match.status}`)
    .setFooter({ text: `Match ID: ${match.id} | Event ID: ${match.event.id || "?"}` })
    .addField(`${match.team1?.name || "?"}`, players(match.team1?.id, match.players.team1), true)
    .addField("VS", "_ _", true)
    .addField(`${match.team2?.name || "?"}`, players(match.team2?.id, match.players.team2), true)
    .addField("Format", `${match.format?.type || "?"} | ${match.format?.location || "?"}`, true)
    .addField("Significance", `${match.significance || "N/A"}`, true);

  return embed;
}

function createComponents(match: FullMatch): MessageActionRow[] {
  const components: MessageActionRow[] = [];

  const str = `getMatch ${match.id}`;
  const button = (
    customId: string,
    label: string,
    style: MessageButtonStyleResolvable = "PRIMARY"
  ): MessageButton => {
    return new MessageButton().setCustomId(customId).setLabel(label).setStyle(style);
  };

  let secondRow;
  const firstRow = new MessageActionRow().addComponents(
    button("", "Match Page", "LINK").setURL(`https://www.hltv.org/matches/${match.id}/hltv-bot`)
  );
  if (match.status === "Live") {
    firstRow.addComponents(
      button(`${str} score`, "Live Score").setDisabled(!match.hasScorebot),
      button(`${str} streams`, "Streams").setDisabled(!match.streams.length)
    );
  } else if (match.status === "Over") {
    firstRow.addComponents(
      button(`${str} highlights`, "Highlights").setDisabled(!match.highlights.length),
      button(`${str} demos`, "Demos").setDisabled(!match.demos.length)
    );

    secondRow = new MessageActionRow().addComponents(
      button(`${str} winner`, "Winner", "SUCCESS"),
      button(`${str} pom`, "Player of the Match"),
      button(`${str} maps`, "Maps"),
      button(`${str} veto`, "Vetoes"),
      button(`${str} stats`, "Stats")
    );
  }

  components.push(firstRow);
  if (secondRow) components.push(secondRow);
  return components;
}

async function getMatch(id: number): Promise<FullMatch | null> {
  let match = await get(`${id}`);
  if (!match) {
    match = await hltv
      .getMatch({ id })
      .then(m => {
        let life: number = 60e3;
        if (m.date) {
          const now = new Date().getTime();
          const diff = m.date - now;
          life = Math.max(diff, life);
        }
        set(`${id}`, life, m);
        return m;
      })
      .catch(() => null);
  }
  return match;
}
