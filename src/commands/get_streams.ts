/**
 * {
  "name": "get_streams",
  "description": "Get top streams from HLTV front page"
}
 */

import { CommandInteraction } from "discord.js";
import { get, set } from "../cache";
import HLTV, { FullStream } from "hltv";

module.exports = async (interaction: CommandInteraction) => {
  await interaction.deferReply({ fetchReply: true });

  let streams: FullStream[] | null = get("streams");
  if (!streams)
    streams = await HLTV.getStreams()
      .then((s) => {
        s = s.slice(0, 25);
        set("streams", s, 6e4);
        return s;
      })
      .catch(() => null);

  if (!streams) return interaction.editReply("❌ Could not find streams");

  interaction.editReply({
    embeds: [
      {
        title: "Top Streams",
        color: 0x2f3136,
        fields: streams.map((s) => ({
          name: `${s.name}`,
          value: `[Link](${s.link})
          ${s.viewers} viewers
          **Category:** ${s.category}
          **Country:** ${s.country.name}`,
          inline: true
        }))
      }
    ]
  });
};
