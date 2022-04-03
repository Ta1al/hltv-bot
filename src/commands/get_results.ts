import HLTV from "hltv";
import { CommandInteraction, Client, Message, MessageComponentInteraction } from "discord.js";
// TODO: Actually make this command
module.exports = async (
  interaction: CommandInteraction,
  _client: Client,
  eventId: number,
  ephemeral: boolean
) => {
  const i = await interaction.deferReply({ fetchReply: true, ephemeral });
  const results = await HLTV.getResults({ eventIds: [eventId] });
  await interaction.editReply({
    components: [
      {
        type: "ACTION_ROW",
        components: [
          {
            type: "SELECT_MENU",
            customId: "results",
            placeholder: "Select a match",
            options: results.slice(0, 25).map((r) => ({
              label: `${r.team1.name} vs ${r.team2.name}`,
              description: `${r.result.team1} - ${r.result.team2}`,
              value: `${r.id}`
            }))
          }
        ]
      }
    ]
  });

  const msg = i as Message;
  const filter = (int: MessageComponentInteraction) => int.message.id === i.id;
  msg.createMessageComponentCollector({ filter, idle: 3e4 }).on("collect", async (c) => {
    if (c.isSelectMenu()) return require("./get_match")(c, null, parseInt(c.values[0]), true);
  }).on("end", () => {
    interaction.editReply({ components: [] });
  })
};
