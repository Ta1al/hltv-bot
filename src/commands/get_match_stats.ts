/** Command Data
 {
   name: "get_match_stats",
  description: "Get match stats from HLTV",
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

// TODO: fix command data (replace match_id with match_stats_id)
// TODO: Add match stats
import { CommandInteraction } from "discord.js";
import { get, set } from "../cache";
import { FullMatchStats, HLTV } from "hltv";
import { Canvas } from "canvas";
import Table2canvas, { IColumn } from "table2canvas";

module.exports = async (interaction: CommandInteraction) => {
  await interaction.deferReply();
  const id = interaction.options.getInteger("match_id", true);

  let matchStats: FullMatchStats | null = get(id);
  if (!matchStats)
    matchStats = await HLTV.getMatchStats({ id })
      .then((m) => {
        console.log(m);

        set(id, m, 864e5);
        return m;
      })
      .catch(() => null);
  if (!matchStats) return interaction.editReply("❌ Invalid match id");

  const bfr = buffer(makeColumns(matchStats), makeData(matchStats), matchStats);

  interaction.editReply({ files: [{ attachment: bfr, name: `stats.jpg` }] });
};

function makeData(matchStats: FullMatchStats): any[] {
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

function makeColumns(matchStats: FullMatchStats): IColumn<any>[] {
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

function buffer(columns: IColumn[], dataSource: any[], matchStats: FullMatchStats): Buffer {
  const table = new Table2canvas({
    canvas: new Canvas(2, 2),
    columns,
    dataSource,
    bgColor: "#36393f",
    text: `${matchStats.team1.name} vs ${matchStats.team2.name}`,
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
