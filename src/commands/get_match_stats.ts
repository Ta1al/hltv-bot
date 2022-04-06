/** Command Data
 {
   name: "get_match_stats",
  description: "Get match stats from HLTV",
  options: [
    {
      type: 4, // Integer
      name: "match_stats_id",
      description: "The match stats id (different than map ID)",
      required: true
    }
  ]
}
*/

import { Client, CommandInteraction } from "discord.js";
import { get, set } from "../cache";
import { FullMatchStats, HLTV } from "hltv";
import { Canvas } from "canvas";
import Table2canvas, { IColumn } from "table2canvas";
import { PlayerStats } from "hltv/lib/endpoints/getMatchMapStats";

module.exports = async (interaction: CommandInteraction, _client: Client, id: number, ephemeral = false) => {
  await interaction.deferReply({ ephemeral });
  if(!id) id = interaction.options.getInteger("match_stats_id", true);

  let matchStats: FullMatchStats | null = get(id);
  if (!matchStats)
    matchStats = await HLTV.getMatchStats({ id })
      .then((m) => {
        set(id, m, 864e5);
        return m;
      })
      .catch(() => null);
  if (!matchStats) return interaction.editReply("❌ Invalid match id");

  const bfr = buffer(
    makeOverviewColumns(matchStats),
    makeOverviewData(matchStats),
    `${matchStats.team1.name} vs ${matchStats.team2.name}`
  );

  const team1 = buffer(
    makeTeamColumns(),
    makeTeamData(matchStats.playerStats.team1),
    `${matchStats.team1.name}`
  );
  const team2 = buffer(
    makeTeamColumns(),
    makeTeamData(matchStats.playerStats.team2),
    `${matchStats.team2.name}`
  );
  interaction.editReply({
    files: [
      { attachment: bfr, name: "overview.png" },
      { attachment: team1, name: "team1.png" },
      { attachment: team2, name: "team2.png" }
    ]
  });
};

function makeTeamData(teamStats: PlayerStats[]): any[] {
  return teamStats.map((p) => ({
    name: p.player.name,
    kills: `${p.kills} (${p.hsKills})`,
    deaths: p.deaths,
    assists: `${p.assists} (${p.flashAssists})`,
    kd: p.killDeathsDifference,
    kast: p.KAST,
    rating: p.rating2 || p.rating1,
    adr: p.ADR
  }));
}
function makeTeamColumns(): IColumn<any>[] {
  return [
    { title: "Name", dataIndex: "name" },
    { title: "Kills (HS)", dataIndex: "kills" },
    { title: "Deaths", dataIndex: "deaths" },
    { title: "Assists (Flashes)", dataIndex: "assists" },
    { title: "K/D", dataIndex: "kd" },
    { title: "KAST", dataIndex: "kast" },
    { title: "Rating", dataIndex: "rating" },
    { title: "ADR", dataIndex: "adr" }
  ];
}

function makeOverviewData(matchStats: FullMatchStats): any[] {
  return [
    {
      team1firstKills: matchStats.overview.firstKills.team1,
      team2firstKills: matchStats.overview.firstKills.team2,
      team1clutchesWon: matchStats.overview.clutchesWon.team1,
      team2clutchesWon: matchStats.overview.clutchesWon.team2,
      mostkillsPlayer: matchStats.overview.mostKills.name,
      mostkillsKills: matchStats.overview.mostKills.value,
      mostdamagePlayer: matchStats.overview.mostDamage?.name,
      mostdamageDamage: matchStats.overview.mostDamage?.value,
      mostassistsPlayer: matchStats.overview.mostAssists.name,
      mostassistsAssists: matchStats.overview.mostAssists.value,
      mostawpkillsPlayer: matchStats.overview.mostAWPKills.name,
      mostawpkillsKills: matchStats.overview.mostAWPKills.value,
      mostfirstkillsPlayer: matchStats.overview.mostFirstKills.name,
      mostfirstkillsKills: matchStats.overview.mostFirstKills.value,
      bestratingPlayer: matchStats.overview.bestRating2?.name,
      bestratingRating: matchStats.overview.bestRating2?.value
    }
  ];
}

function makeOverviewColumns(matchStats: FullMatchStats): IColumn<any>[] {
  return [
    {
      title: "Overview",
      children: [
        {
          title: "First Kills",
          children: [
            {
              title: `${matchStats.team1.name}`,
              dataIndex: "team1firstKills"
            },
            {
              title: `${matchStats.team2.name}`,
              dataIndex: "team2firstKills"
            }
          ]
        },
        {
          title: "Clutches Won",
          children: [
            {
              title: `${matchStats.team1.name}`,
              dataIndex: "team1clutchesWon"
            },
            {
              title: `${matchStats.team2.name}`,
              dataIndex: "team2clutchesWon"
            }
          ]
        },
        {
          title: "Most Kills",
          children: [
            {
              title: "Player",
              dataIndex: "mostkillsPlayer"
            },
            {
              title: `Kills`,
              dataIndex: "mostkillsKills"
            }
          ]
        },
        {
          title: "Most Damage",
          children: [
            {
              title: "Player",
              dataIndex: "mostdamagePlayer"
            },
            {
              title: "Damage",
              dataIndex: "mostdamageDamage"
            }
          ]
        },
        {
          title: "Most Assists",
          children: [
            {
              title: "Player",
              dataIndex: "mostassistsPlayer"
            },
            {
              title: "Assists",
              dataIndex: "mostassistsAssists"
            }
          ]
        },
        {
          title: "Most AWP Kills",
          children: [
            {
              title: "Player",
              dataIndex: "mostawpkillsPlayer"
            },
            {
              title: "Kills",
              dataIndex: "mostawpkillsKills"
            }
          ]
        },
        {
          title: "Most First Kills",
          children: [
            {
              title: "Player",
              dataIndex: "mostfirstkillsPlayer"
            },
            {
              title: "Kills",
              dataIndex: "mostfirstkillsKills"
            }
          ]
        },
        {
          title: "Best Rating",
          children: [
            {
              title: "Player",
              dataIndex: "bestratingPlayer"
            },
            {
              title: "Rating",
              dataIndex: "bestratingRating"
            }
          ]
        }
      ]
    }
  ];
}

function buffer(columns: IColumn[], dataSource: any[], str: string): Buffer {
  const table = new Table2canvas({
    canvas: new Canvas(2, 2),
    columns,
    dataSource,
    bgColor: "#36393f",
    text: str,
    textStyle: {
      color: "#fff",
      textAlign: "center",
      fontFamily: "Arial"
    },
    style: {
      color: "#fff",
      fontSize: "20px",
      textAlign: "center"
    }
  });
  return table.canvas.toBuffer();
}
