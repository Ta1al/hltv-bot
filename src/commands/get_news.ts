/** Command Data
 * {
  "name": "get_news",
  "description": "Get recent news from HLTV",
  "options": [
   {
     "type": 4,
     "name": "event_id",
     "description": "Filter news with event ID"
    }
  ]
}
 */

import { HLTV, NewsPreview } from "hltv";
import { get, set } from "../cache";
import {
  CacheType,
  Client,
  CommandInteraction,
  Message,
  MessageComponentInteraction
} from "discord.js";

module.exports = async (
  interaction: CommandInteraction,
  _client: Client,
  eventId: number | null,
  ephemeral = false
) => {
  const i = await interaction.deferReply({ fetchReply: true, ephemeral });
  if (!eventId) eventId = interaction.options.getInteger("event_id");
  let news: NewsPreview[] | null = get(eventId ? "news" : `news_${eventId}`);
  if (!news)
    news = await HLTV.getNews({ eventIds: eventId ? [eventId] : [] })
      .then((n) => {
        n = n.slice(0, 25);
        set(eventId ? "news" : `news_${eventId}`, n, 6e4);
        return n;
      })
      .catch(() => null);

  if (!news || !news.length) return interaction.editReply("❌ Could not find news");

  await interaction.editReply({
    components: [
      {
        type: "ACTION_ROW",
        components: [
          {
            type: "SELECT_MENU",
            customId: "news",
            options: news.map((n, i) => ({
              label: n.title,
              description: n.country.name,
              value: `${i}`
            }))
          }
        ]
      }
    ]
  });

  const msg = i as Message;
  const filter = (int: MessageComponentInteraction) => int.message.id == i.id;
  collector(msg, filter, news, interaction);
};

function collector(
  msg: Message<boolean>,
  filter: (int: MessageComponentInteraction) => boolean,
  news: NewsPreview[] | null,
  interaction: CommandInteraction<CacheType>
) {
  msg
    .createMessageComponentCollector({ filter, idle: 6e4 })
    .on("collect", async (c) => {
      if (c.isSelectMenu()) {
        if (!news) return;
        const index = parseInt(c.values[0]);
        c.reply({
          ephemeral: true,
          embeds: [
            {
              title: news[index].title,
              color: 0x2f3136,
              description: `${news[index].comments} comments
              **Country:** ${news[index].country.name}`,
              timestamp: news[index].date
            }
          ],
          components: [
            {
              type: "ACTION_ROW",
              components: [
                {
                  type: "BUTTON",
                  label: "Visit",
                  style: "LINK",
                  url: `https://hltv.org${news[index].link}`
                }
              ]
            }
          ]
        });
      }
    })
    .on("end", () => {
      interaction.editReply({ content: "Timed Out", components: [] });
    });
}
