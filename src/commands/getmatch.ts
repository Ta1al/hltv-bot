import {
  ButtonInteraction,
  CommandInteraction,
  Message,
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
  const i = await interaction.deferReply({ fetchReply: true });
  const id = interaction.options.getInteger("match_id", true);
  const match = await getMatch(id);
  if (!match) return interaction.editReply("❌ Match not found");

  idleCollector(i as Message, match, interaction);
  return interaction.editReply(createMessage(match));
};

const component = async (interaction: ButtonInteraction) => {
  await interaction.deferReply({ ephemeral: true });
  const args = interaction.customId.split(" "),
    id = parseInt(args[1]),
    label = args[2],
    match = await getMatch(id);
  if (!match) return;

  if (label === "live") return interaction.editReply("not implemented");
  if (label === "stats") return interaction.editReply("not implemented");
  if (["streams", "highlights", "demos"].includes(label)) {
    const embeds = [
      createButtonEmbed(
        label.toUpperCase(),
        createUrlDescription(match[label as "streams" | "highlights" | "demos"])
      ),
    ];
    return interaction.editReply({ embeds });
  }
  if (label === "result") {
    const embeds = [
      createButtonEmbed(
        "RESULT",
        `${match.team1?.name} ${match.score.team1} - ${match.score.team2} ${match.team2?.name}`
      ),
    ];
    const pom = match.playerOfTheMatch;
    embeds[0].addFields([
      {
        name: "Player of the Match",
        value: `${pom?.name} [\`${pom?.id}\`](https://www.hltv.org/player/${pom?.id}/hltv-bot)`,
        inline: true,
      },
      {
        name: "Maps",
        value: match.maps
          .map(
            (m, i) =>
              `\`${i + 1}.\` ${m.name} | ${match?.team1?.name} **${
                m.result?.team1TotalRounds || 0
              } - ${m.result?.team2TotalRounds || 0}** ${match?.team2?.name}`
          )
          .join("\n"),
      },
      {
        name: "Vetoes",
        value: match.vetoes
          .map((v, i) => `\`${i + 1}.\` ${v.team?.name || ""} ${v.type} *${v.map}*`)
          .join("\n"),
      },
    ]);

    return interaction.editReply({ embeds });
  }
};

const update = async (interaction: MessageComponentInteraction, id: number) => {
  const i = await interaction.deferUpdate({ fetchReply: true });
  const match = await getMatch(id);
  if (!match) return interaction.editReply("❌ Match not found");

  idleCollector(i as Message, match, interaction);
  return interaction.editReply(createMessage(match));
};

module.exports = { message, component, update };

// ============================================================

function idleCollector(
  i: Message,
  match: FullMatch,
  interaction: CommandInteraction | MessageComponentInteraction
) {
  const msg = i as Message;
  msg.createMessageComponentCollector({ idle: 30e3 }).on("end", () => {
    const components = createComponents(match);
    components.forEach(c => c.components.forEach(b => (b.disabled = true)));

    interaction.editReply({ components });
  });
}

// ============================================================

function createMessage(match: FullMatch): WebhookEditMessageOptions {
  const embed = createEmbed(match);
  const components = createComponents(match);
  return { embeds: [embed], components };
}

function createEmbed(match: FullMatch): MessageEmbed {
  const players = (id: number | undefined, team: Player[]) => {
    return `Team ID: [\`${id || "?"}\`](https://www.hltv.org/team/${id}/hltv-bot)
    **Players:**
    ${team
      .map(p => `${p.name} [\`${p.id}\`](https://www.hltv.org/player/${p.id}/hltv-bot)`)
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

  const str = `getmatch ${match.id}`;
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
      button(`${str} live`, "Live Score").setDisabled(!match.hasScorebot),
      button(`${str} streams`, "Streams").setDisabled(!match.streams.length)
    );
  } else if (match.status === "Over") {
    firstRow.addComponents(
      button(`${str} highlights`, "Highlights").setDisabled(!match.highlights.length),
      button(`${str} demos`, "Demos").setDisabled(!match.demos.length)
    );

    secondRow = new MessageActionRow().addComponents(
      button(`${str} result`, "Result", "SUCCESS"),
      button(`${str} stats`, "Stats")
    );
  }

  components.push(firstRow);
  if (secondRow) components.push(secondRow);
  return components;
}

// ============================================================

function createButtonEmbed(title: string, description: string): MessageEmbed {
  const embed = new MessageEmbed().setTitle(title).setDescription(description).setColor("#2f3136");
  return embed;
}

function createUrlDescription(arr: any[]): string {
  return arr
    .map((s, i) => {
      if (!s.link.startsWith("http")) s.link = "https://hltv.org" + s.link;
      return `\`${i + 1}.\` [${s.name || s.title}](${s.link})`;
    })
    .join("\n")
    .slice(0, 4000);
}

// ============================================================

async function getMatch(id: number): Promise<FullMatch | null> {
  let match = await get(`${id}`);
  if (!match) {
    match = await hltv
      .getMatch({ id })
      .then(m => {
        let life = 60e3;
        const now = new Date().getTime();
        if (["Scheduled", "Postponed"].includes(m.status)) life = (m.date || now) - now;
        if (m.status === "Over") life = 864e5;
        set(`${id}`, life, m);
        return m;
      })
      .catch(() => null);
  }
  return match;
}
