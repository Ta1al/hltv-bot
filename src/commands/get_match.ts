/** Command Data
{
  name: "get_match",
  description: "Get match data from HLTV",
  options: [
    {
      type: 4, // Integer
      name: "match_id",
      description: "The match id",
      required: true
    }
  ]
}
*/
import HLTV from "hltv";
import {
  CommandInteraction,
  Message,
  MessageActionRow,
  MessageButton,
  MessageComponentInteraction,
  Client
} from "discord.js";
import { FullMatch } from "hltv/lib/endpoints/getMatch";
import { get, set } from "../cache";

module.exports = async (interaction: CommandInteraction, _client: Client, id: number, ephemeral = false) => {
  const i = await interaction.deferReply({ fetchReply: true, ephemeral });
  if (!id) id = interaction.options.getInteger("match_id", true);
  
  let match: FullMatch | null = get(id);
  if (!match)
    match = await HLTV.getMatch({ id })
      .then((m) => {
        let life: number = 6e4;
        if (m.date) {
          const now = new Date();
          const diff = m.date - now.getTime();
          life = Math.max(diff, 6e4);
        }
        set(id, m, m.status === "Over" ? 864e5 : life);
        return m;
      })
      .catch(e => {
        console.log(e);
        
        return null;
      });
  if (!match) return interaction.editReply("❌ Invalid match ID");

  const components = component(id, match);
  const embeds = [embed(match)];
  await interaction.editReply({ embeds, components });

  const msg = i as Message;
  const filter = (int: MessageComponentInteraction) => int.message.id == i.id;
  collector(msg, interaction, filter, match);
};

function component(id: number, match: FullMatch) {
  let row2;
  const row = new MessageActionRow().addComponents(
    new MessageButton()
      .setLabel("Match Page")
      .setStyle("LINK")
      .setURL(`https://www.hltv.org/matches/${id}/hltv-bot`)
  );
  if (match.status === "Live") {
    row.addComponents(
      new MessageButton()
        .setCustomId("score")
        .setLabel("Live Score")
        .setStyle("PRIMARY")
        .setDisabled(!match.hasScorebot),
      new MessageButton()
        .setCustomId("streams")
        .setLabel("Streams")
        .setStyle("PRIMARY")
        .setDisabled(match.streams.length === 0)
    );
  } else if (match.status === "Over") {
    row.addComponents(
      new MessageButton()
        .setCustomId("highlights")
        .setLabel("Highlights")
        .setStyle("PRIMARY")
        .setDisabled(match.highlights.length === 0),
      new MessageButton()
        .setCustomId("demos")
        .setLabel("Demos")
        .setStyle("PRIMARY")
        .setDisabled(match.demos.length === 0)
    );

    row2 = new MessageActionRow().addComponents(
      new MessageButton({
        label: "Reveal Winner",
        style: 3,
        customId: "winner"
      }),
      new MessageButton({
        label: "Maps",
        style: 1,
        customId: "maps"
      }),
      new MessageButton({
        label: "Vetoes",
        style: 1,
        customId: "veto"
      }),
      new MessageButton({
        label: "Player of the Match",
        style: 1,
        customId: "pom"
      }),
      new MessageButton({
        label: "Stats",
        style: 1,
        customId: `stats ${match.statsId}`
      })
    );
  }

  const components = [row];
  if (row2) components.push(row2);
  return components;
}

function embed(match: FullMatch) {
  return {
    color: 0x2f3136,
    timestamp: new Date(match.date || 0),
    title: `${match.event.name}`,
    url: `https://www.hltv.org/events/${match.event.id}/hltv-bot`,
    description: `**Match Status:** ${match.status}`,
    footer: {
      text: `Event ID: ${match.event.id || "?"}`
    },
    fields: [
      {
        name: `${match.team1?.name || "?"}`,
        value: `ID: [\`${match.team1?.id || "?"}\`](https://www.hltv.org/team/${
          match.team1?.id
        }/hltv-bot)
            ${match.players.team1
              ?.map(
                (p) =>
                  `[${p.name}](https://www.hltv.org/players/${p.id}/hltv-bot) (\`${p.id || "?"}\`)`
              )
              .join("\n")}`,
        inline: true
      },
      {
        name: "vs",
        value: "_ _",
        inline: true
      },
      {
        name: `${match.team2?.name || "?"}`,
        value: `ID: [\`${match.team2?.id || "?"}\`](https://www.hltv.org/team/${
          match.team2?.id
        }/hltv-bot)
            ${match.players.team2
              ?.map(
                (p) =>
                  `[${p.name}](https://www.hltv.org/players/${p.id}/hltv-bot) (\`${p.id || "?"}\`)`
              )
              .join("\n")}`,
        inline: true
      },
      {
        name: "Format",
        value: `${match.format?.type || "?"} | ${match.format?.location || "?"}`
      },
      {
        name: "Significance",
        value: `${match.significance || "N/A"}`
      }
    ]
  };
}

function collector(
  msg: Message<boolean>,
  interaction: CommandInteraction,
  filter: (int: MessageComponentInteraction) => boolean,
  match: FullMatch | null
) {
  msg
    .createMessageComponentCollector({ filter, idle: 3e4 })
    .on("collect", (c) => {
      if (c.customId == "score") {
        return c.reply("no");
      } else if (c.customId == "streams") {
        const streams = match?.streams
          .map((s, i) => {
            if (!s.link.startsWith("http")) s.link = "https://hltv.org" + s.link;
            return `\`${i + 1}.\` [${s.name}](${s.link})`;
          })
          .join("\n");
        const embeds = [
          {
            title: "Streams",
            description: streams,
            color: 3092790
          }
        ];
        return c.reply({ embeds, ephemeral: true });
      } else if (c.customId == "highlights") {
        const highlights = match?.highlights
          .map((h, i) => `\`${i + 1}.\` [${h.title}](${h.link})`)
          .join("\n");
        const embeds = [
          {
            title: "Highlights",
            description: highlights,
            color: 3092790
          }
        ];
        return c.reply({ embeds, ephemeral: true });
      } else if (c.customId == "demos") {
        const demos = match?.demos
          .map((d, i) => {
            if (!d.link.startsWith("http")) d.link = "https://hltv.org" + d.link;
            return `\`${i + 1}.\` [${d.name}](${d.link})`;
          })
          .join("\n");
        const embeds = [
          {
            title: "Demos",
            description: demos,
            color: 3092790
          }
        ];
        return c.reply({ embeds, ephemeral: true });
      } else if (c.customId == "format") {
        return c.reply({
          content: `**Format:** ${match?.format?.location} | ${match?.format?.type}`,
          ephemeral: true
        });
      } else if (c.customId == "significance") {
        return c.reply({ content: `**Significance:** ${match?.significance}`, ephemeral: true });
      } else if (c.customId == "winner") {
        return c.reply({
          content: `**Winner:** ${match?.winnerTeam?.name} (\`${match?.winnerTeam?.id}\`)`,
          ephemeral: true
        });
      } else if (c.customId == "maps") {
        const maps = match?.maps
          .map(
            (m, i) =>
              `\`${i + 1}.\` ${m.name} | ${match?.team1?.name} **${
                m.result?.team1TotalRounds || 0
              } - ${m.result?.team2TotalRounds || 0}** ${match?.team2?.name}`
          )
          .join("\n");
        const embeds = [
          {
            title: "Maps",
            description: maps,
            color: 3092790
          }
        ];
        return c.reply({ embeds, ephemeral: true });
      } else if (c.customId == "pom") {
        const pom = match?.playerOfTheMatch;
        if (!pom) return c.reply({ content: `No player of the match`, ephemeral: true });
        return c.reply({
          content: `**Player of the Match:** ${match?.playerOfTheMatch?.name} (\`${match?.playerOfTheMatch?.id}\`)`,
          ephemeral: true
        });
      } else if (c.customId == "veto") {
        const vetoes = match?.vetoes;
        if (!vetoes?.length) return c.reply({ content: `No vetoes`, ephemeral: true });
        const str = vetoes
          .map((v, i) => `\`${i + 1}.\` ${v.team?.name || ""} ${v.type} *${v.map}*`)
          .join("\n");
        return c.reply({
          content: `**Veto:** \n${str}`,
          ephemeral: true
        });
      } else if (c.customId.startsWith("stats")) {
        return require("./get_match_stats")(c, null, c.customId.split(" ")[1], true);
      }
    })
    .on("end", () => {
      interaction.editReply({ content: "Timed Out", components: [] });
    });
}
