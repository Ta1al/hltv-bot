/** Command Data
 * {
  "name": "get_team_ranking",
  "description": "Get top teams",
  "options": [
    {
      "type": 3,
      "name": "country",
      "description": "Country Filter",
      "choices": [
        { "name": "United States", "value": "United States" },
        { "name": "Argentina", "value": "Argentina" },
        { "name": "Brazil", "value": "Brazil" },
        { "name": "Bulgaria", "value": "Bulgaria" },
        { "name": "Czech Republic", "value": "Czech Republic" },
        { "name": "Denmark", "value": "Denmark" },
        { "name": "Estonia", "value": "Estonia" },
        { "name": "Finland", "value": "Finland" },
        { "name": "France", "value": "France" },
        { "name": "Germany", "value": "Germany" },
        { "name": "Norway", "value": "Norway" },
        { "name": "Poland", "value": "Poland" },
        { "name": "Portugal", "value": "Portugal" },
        { "name": "Romania", "value": "Romania" },
        { "name": "Spain", "value": "Spain" },
        { "name": "Sweden", "value": "Sweden" },
        { "name": "Turkey", "value": "Turkey" },
        { "name": "United Kingdom", "value": "United Kingdom" },
        { "name": "Russia", "value": "Russia" },
        { "name": "Ukraine", "value": "Ukraine" },
        { "name": "China", "value": "China" },
        { "name": "Mongolia", "value": "Mongolia" },
        { "name": "Australia", "value": "Australia" },
      ]
     }
   ]
 }
 */

import { HLTV, TeamRanking } from "hltv";
import { CommandInteraction } from "discord.js";
import { get, set } from "../cache";

module.exports = async (interaction: CommandInteraction) => {
  await interaction.deferReply();

  const country = interaction.options.getString("country") || undefined;

  let ranking: TeamRanking[] | null = get(country ? `team_ranking_${country}` : "team_ranking");
  if (!ranking)
    ranking = await HLTV.getTeamRanking({ country })
      .then((r) => {
        set(country ? `team_ranking_${country}` : "team_ranking", r, 864e5); // 24h
        return r;
      })
      .catch(() => null);

  if (!ranking || !ranking.length) return interaction.editReply("❌ Could not get team ranking");

  const embeds = [];
  embeds.push(makeEmbed(country, ranking.slice(0, 25)));
  if (ranking.length > 25) embeds.push(makeEmbed(country, ranking.slice(25, 50)));
  interaction.editReply({ embeds });
};

function makeEmbed(country: string | undefined, ranking: TeamRanking[]) {
  return {
    title: `Top Teams`,
    color: 0x2f3136,
    footer: { text: `Country: ${country || "Global"}` },
    fields: ranking.map((r) => ({
      name: `${r.place}. ${r.team.name}`,
      value: `Points: ${r.points} | Change: ${
        r.change > 0 ? `+${r.change}` : r.change
      } | [Link](https://hltv.org/team/${r.team.id}/hltv-bot)`,
      inline: false
    }))
  };
}
