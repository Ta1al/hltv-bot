/** Command Data
 {
   name: "scorebot",
  description: "Get live scoreboard of a match",
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
// TODO: Cache the scoreupdates
import HLTV, { ScoreboardUpdate } from "hltv";
import { CommandInteraction } from "discord.js";
import { Canvas } from "canvas";
import Table2canvas, { IColumn } from "table2canvas";
import { ScoreboardPlayer } from "hltv/lib/endpoints/connectToScorebot";

module.exports = async (interaction: CommandInteraction) => {
  await interaction.deferReply();
  const id = interaction.options.getInteger("match_id", true);

  let scoreBoard: ScoreboardUpdate | null = null;

  const ntrvl = setInterval(() => {
    if (!scoreBoard) return;
    const ct = buffer(
      columns(),
      makeData(scoreBoard.CT),
      `CT - ${scoreBoard.ctTeamName} - ${scoreBoard.ctTeamScore}`
    );
    const t = buffer(
      columns(),
      makeData(scoreBoard.TERRORIST),
      `T - ${scoreBoard.terroristTeamName} - ${scoreBoard.tTeamScore}`
    );
    interaction.editReply({
      embeds: [
        {
          color: scoreBoard.live ? 0x00ff00 : 0xff0000,
          description: `${scoreBoard.ctTeamScore} - ${scoreBoard.tTeamScore}`,
          fields: [
            {
              name: "CT Alive",
              value: `${scoreBoard.CT.filter((p) => p.alive).length}`,
              inline: true
            },
            {
              name: "T Alive",
              value: `${scoreBoard.TERRORIST.filter((p) => p.alive).length}`,
              inline: true
            },
            { name: "Map", value: scoreBoard.mapName },
            {
              name: "Bomb",
              value: scoreBoard.bombPlanted ? "Planted" : "Not planted",
              inline: true
            },
            { name: "Round", value: `${scoreBoard.currentRound}`, inline: true }
          ]
        }
      ],
      files: [
        { attachment: ct, name: "ct.jpg" },
        { attachment: t, name: "t.jpg" }
      ]
    });
  }, 2000);

  const onScoreboardUpdate = (scoreboard: ScoreboardUpdate, done: any) => {
    if (!scoreboard.live) {
      clearInterval(ntrvl);
      return done();
    };
    scoreBoard = scoreboard;
  };
  HLTV.connectToScorebot({ id, onScoreboardUpdate });
};

function columns(): IColumn<any>[] {
  return [
    { title: "Status", dataIndex: "status" },
    { title: "Player", dataIndex: "player" },
    { title: "HP", dataIndex: "hp" },
    { title: "Kills", dataIndex: "kills" },
    { title: "Assists", dataIndex: "assists" },
    { title: "Deaths", dataIndex: "deaths" },
    { title: "ADR", dataIndex: "adr" },
    { title: "Money", dataIndex: "money" }
  ];
}

function makeData(team: ScoreboardPlayer[]) {
  return team.map((p) => ({
    status: p.alive ? "✔" : "💀",
    player: p.name,
    hp: p.hp,
    kills: p.score,
    assists: p.assists,
    deaths: p.deaths,
    adr: p.damagePrRound.toFixed(1),
    money: p.money
  }));
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
