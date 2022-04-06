/** Command Data
 * {
  "name": "get_player_ranking",
  "description": "Get top players",
  "options": [
    {
      "type": 3,
      "name": "country",
      "description": "Country Filter"
     }
   ]
 }
 */

import { HLTV, PlayerRanking } from "hltv";
import { CommandInteraction } from "discord.js";
import { get, set } from "../cache";

module.exports = async (interaction: CommandInteraction) => {
  await interaction.deferReply();

  const country = interaction.options.getString("country") || undefined;

  let ranking: PlayerRanking[] | null = get(`ranking-${country || "all"}`);
  if (!ranking)
    ranking = await HLTV.getPlayerRanking(country ? { countries: [country] } : undefined)
      .then((r) => {
        r = r.slice(0, 30);
        set(`ranking-${country || "all"}`, r, 864e5); // 24h
        return r;
      })
      .catch(() => null);

  if (!ranking || !ranking.length) return interaction.editReply("❌ Could not get ranking");

  const embeds = [];
  embeds.push(makeEmbed(country, ranking.slice(0, 24)));
  if (ranking.length > 24) embeds.push(makeEmbed(country, ranking.slice(24)));
  interaction.editReply({ embeds });
};

function makeEmbed(country: string | undefined, ranking: PlayerRanking[]) {
  const rating = (r: number) => (r > 1 ? `[32m` : `[31m`) + r;
  return {
    title: `Top Players`,
    color: 0x2f3136,
    footer: { text: `Country: ${country || "Global"}` },
    fields: ranking.map((r) => ({
      name: r.player.name,
      value:
        `[Link](https://hltv.org/player/${r.player.id}/hltv-bot)\n` +
        `\`\`\`ansi\n[0m[35mRating: ${rating(r.rating1 || r.rating2 || 0)}\n[0m[35mMaps: [0m[34m${r.maps}\n[0m[35mRounds: [0m[34m${
          r.rounds
        }\n[0m[35mK/D: [0m[34m${r.kd}[0m\`\`\``,
      inline: true
    }))
  };
}
