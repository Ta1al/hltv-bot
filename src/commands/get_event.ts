/** Command Data
 * {
 "name": "get_match",
 "description": "Get event data from HLTV",
 "options": [
   {
     "type": 4,
     "name": "event_id",
     "description": "The event id",
     "required": true
    }
  ]
}
*/

import { FullEvent, HLTV } from "hltv";
import { CacheType, CommandInteraction, Message, MessageComponentInteraction } from "discord.js";
import { get, set } from "../cache";
module.exports = async (interaction: CommandInteraction) => {
  const i = await interaction.deferReply({ fetchReply: true });
  const id = interaction.options.getInteger("event_id", true);

  let event: FullEvent | null = get(id);
  if (!event)
    event = await HLTV.getEvent({ id })
      .then((e) => {
        set(id, e, 36e5); // 1 hour
        return e;
      })
      .catch(() => null);
  if (!event) return interaction.editReply("❌ Invalid Event ID");

  await interaction.editReply({
    embeds: [
      {
        title: event.name,
        url: `https://www.hltv.org/events/${event.id}/hltv-bot`,
        color: 0x2f3136,
        thumbnail: { url: event.logo },
        description: `Prize Pool: ${event.prizePool}`,
        fields: [
          {
            name: "Start - End",
            value: `<t:${Math.floor((event.dateStart ?? 1000) / 1000)}>\n<t:${Math.floor(
              (event.dateEnd ?? 1000) / 1000
            )}>`,
            inline: true
          },
          {
            name: "Location",
            value: event.location.name,
            inline: true
          },
          {
            name: "Map Pool",
            value: `\`\`\`ansi\n[35m${event.mapPool.join(", ")}\`\`\``,
            inline: true
          },
          ...event.formats.map((f) => ({
            name: f.type,
            value: f.description
          }))
        ]
      }
    ],
    components: [
      {
        type: "ACTION_ROW",
        components: [
          {
            type: "BUTTON",
            label: "News",
            customId: "news",
            style: "PRIMARY",
            disabled: event.news.length === 0
          },
          {
            type: "BUTTON",
            label: "Highlights",
            customId: "highlights",
            style: "PRIMARY",
            disabled: event.highlights.length === 0
          },
          {
            type: "BUTTON",
            label: "Teams",
            customId: "teams",
            style: "PRIMARY",
            disabled: event.teams.length === 0
          }
        ]
      },
      {
        type: "ACTION_ROW",
        components: [
          {
            type: "BUTTON",
            label: "Matches",
            customId: "matches",
            style: "PRIMARY"
          },
          {
            type: "BUTTON",
            label: "Results",
            customId: "results",
            style: "PRIMARY"
          }
        ]
      }
    ]
  });

  const msg = i as Message;
  const filter = (int: MessageComponentInteraction) => int.message.id == i.id;
  collector(msg, filter, event, interaction);
};

function collector(
  msg: Message<boolean>,
  filter: (int: MessageComponentInteraction) => boolean,
  event: FullEvent | null,
  interaction: CommandInteraction<CacheType>
) {
  msg
    .createMessageComponentCollector({ filter, idle: 3e4 })
    .on("collect", async (c) => {
      if (c.customId == "news") return await newsResponse(c, event);
      else if (c.customId == "highlights") return await highlightsResponse(c, event);
      else if (c.customId == "teams") return teamsReponse(c, event);
      else if (c.customId == "matches") return require("./get_matches")(c, null, event?.id, true);
      else if (c.customId == "results") return require("./get_results")(c, null, event?.id, true);
    })
    .on("end", () => {
      interaction.editReply({ components: [] });
    });
}

async function newsResponse(c: MessageComponentInteraction<CacheType>, event: FullEvent | null) {
  const ni = await c.reply({
    ephemeral: true,
    fetchReply: true,
    components: [
      {
        type: "ACTION_ROW",
        components: [
          {
            type: "SELECT_MENU",
            customId: "news_menu",
            placeholder: "Select news",
            options: event?.news.slice(0, 25).map((n, i) => ({
              label: n.name.slice(0, 100),
              value: `${i}`
            }))
          }
        ]
      }
    ]
  });
  const nim = ni as Message;
  const nifilter = (int: MessageComponentInteraction) => int.message.id === ni.id;
  newsCollector(nim, nifilter, event);
}

async function highlightsResponse(
  c: MessageComponentInteraction<CacheType>,
  event: FullEvent | null
) {
  const hi = await c.reply({
    ephemeral: true,
    fetchReply: true,
    components: [
      {
        type: "ACTION_ROW",
        components: [
          {
            type: "SELECT_MENU",
            customId: "highlights_menu",
            placeholder: "Select highlights",
            options: event?.highlights.slice(0, 25).map((h, i) => ({
              label: h.name.slice(0, 100),
              description: h.team1.name + " vs " + h.team2.name,
              value: `${i}`
            }))
          }
        ]
      }
    ]
  });
  const him = hi as Message;
  const hifilter = (int: MessageComponentInteraction) => int.message.id === hi.id;
  highlightsCollector(him, hifilter, event);
}

function teamsReponse(c: MessageComponentInteraction<CacheType>, event: FullEvent | null) {
  c.reply({
    ephemeral: true,
    embeds: [
      {
        color: 0x2f3136,
        description: `${event?.teams
          .map(
            (n) =>
              `\`#${n.rankDuringEvent || "?"}\` [${n.name}](https://hltv.org/team/${
                n.id
              }/hltv-bot) | ${n.reasonForParticipation}`
          )
          .join("\n")}`
      }
    ]
  });
}

function newsCollector(
  nim: Message<boolean>,
  nifilter: (int: MessageComponentInteraction) => boolean,
  event: FullEvent | null
) {
  nim.createMessageComponentCollector({ filter: nifilter, idle: 6e4 }).on("collect", (nic) => {
    if (nic.isSelectMenu())
      return nic.reply({
        ephemeral: true,
        content: event?.news[parseInt(nic.values[0])].name,
        components: [
          {
            type: "ACTION_ROW",
            components: [
              {
                type: "BUTTON",
                style: "LINK",
                label: "Visit",
                url: `https://hltv.org` + event?.news[parseInt(nic.values[0])].link
              }
            ]
          }
        ]
      });
  });
}

function highlightsCollector(
  him: Message<boolean>,
  hifilter: (int: MessageComponentInteraction) => boolean,
  event: FullEvent | null
) {
  him.createMessageComponentCollector({ filter: hifilter, idle: 6e4 }).on("collect", (hic) => {
    if (hic.isSelectMenu())
      return hic.reply({
        content: `${event?.highlights[parseInt(hic.values[0])].link}`,
        ephemeral: true
      });
  });
}
