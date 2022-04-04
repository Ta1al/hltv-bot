/** Command Data
 * {
  "name": "get_recent_threads",
  "description": "Get recent threads from HLTV forum"
}
 */

import { HLTV, Thread } from "hltv";
import { get, set } from "../cache";
import { CommandInteraction } from "discord.js";

module.exports = async (interaction: CommandInteraction) => {
  await interaction.deferReply();

  let threads: Thread[] | null = get("threads");
  if (!threads)
    threads = await HLTV.getRecentThreads()
      .then((t) => {
        t = t.slice(0, 25);
        set("threads", t, 6e4);
        return t;
      })
      .catch(() => null);

  if (!threads) return interaction.editReply("❌ Could not find threads");

  interaction.editReply({
    embeds: [{
      title: "Recent Threads",
      color: 0x2f3136,
      fields: threads.map((t) => ({
        name: `${t.title}`,
        value: `[Link](https://htlv.org${t.link})
        ${t.replies} replies
        **Category:** ${t.category}`,
        inline: true,
      })),
    }]
  })
};
