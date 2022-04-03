/** Command Data
 * {
  "name": "get_events",
  "description": "Get events from HLTV",
  "options": [
    {
      "type": 3,
      "name": "event_type",
      "description": "Event type filter",
      "choices": [
        {
          "name": "Major",
          "value": "Major"
        },
        {
          "name": "International LAN",
          "value": "Intl. LAN"
        },
        {
          "name": "Regional LAN",
          "value": "Reg. LAN"
        },
        {
          "name": "Local LAN",
          "value": "Local LAN"
        },
        {
          "name": "Online",
          "value": "Online"
        },
        {
          "name": "Other",
          "value": "Other"
        }
      ]
    }
  ]
}
 */

import HLTV, { EventPreview } from "hltv";
import { CacheType, CommandInteraction, Message, MessageComponentInteraction } from "discord.js";
import { fromText } from "hltv/lib/shared/EventType";
import { get, set } from "../cache";

module.exports = async (interaction: CommandInteraction) => {
  const i = await interaction.deferReply({ fetchReply: true });
  const eventType = interaction.options.getString("event_type");

  let events: EventPreview[] | null = get(eventType ? `events_${eventType}` : "events");
  if (!events)
    events = await HLTV.getEvents(eventType ? { eventType: fromText(eventType) } : {})
      .then((e) => {
        e = e.slice(0, 25);
        set(eventType ? `events_${eventType}` : "events", e, 864e5); // 24h
        return e;
      })
      .catch(() => null);

  if (!events || !events.length) return interaction.editReply("❌ No events found.");

  await interaction.editReply({
    components: [
      {
        type: "ACTION_ROW",
        components: [
          {
            type: "SELECT_MENU",
            customId: "events",
            options: events.map((e) => ({
              label: e.name,
              description: e.location?.name || "",
              value: `${e.id}`
            }))
          }
        ]
      }
    ]
  });

  const msg = i as Message;
  const filter = (int: MessageComponentInteraction) => int.message.id == i.id;
  collector(msg, filter, interaction);
};

function collector(
  msg: Message<boolean>,
  filter: (int: MessageComponentInteraction) => boolean,
  interaction: CommandInteraction<CacheType>
) {
  msg
    .createMessageComponentCollector({ filter, idle: 6e4 })
    .on("collect", (c) => {
      if (c.isSelectMenu()) return require("./get_event")(c, null, parseInt(c.values[0]), true);
    })
    .on("end", () => {
      interaction.editReply({ content: "Timed out.", components: [] });
    });
}
