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
import HLTV, { ScoreboardUpdate, LogUpdate } from "hltv";
import { CommandInteraction, Message, TextChannel, ThreadChannel } from "discord.js";
import { Canvas } from "canvas";
import Table2canvas, { IColumn } from "table2canvas";
import { ScoreboardPlayer } from "hltv/lib/endpoints/connectToScorebot";
import { get, set } from "../cache";
import { FullMatch } from "hltv/lib/endpoints/getMatch";

module.exports = async (interaction: CommandInteraction) => {
  await interaction.deferReply();
  const id = interaction.options.getInteger("match_id", true);
  let msg: Message | undefined;
  let thread: ThreadChannel | undefined;
  let scoreBoard: ScoreboardUpdate | null = null;
  let match: FullMatch | null;

  const onConnect = async () => {
    await interaction.editReply("Connected to scoreboard");
    const channel = interaction.channel as TextChannel;
    msg = await channel?.send(`<@!${interaction.user.id}>`);
    if (!channel.isThread()) thread = await createThread(thread, channel, id, msg, interaction);
  };

  const ntrvl = setInterval(() => {
    if (!scoreBoard || !msg) return;
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

    msg.edit({
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

  const onLogUpdate = async (data: any) =>
    sendLog(Object.keys(data.log[0])[0], data.log[0][Object.keys(data.log[0])[0]], thread);

  const ntrvl2 = setInterval(async () => {
    match = get(id);
    if (!match)
      match = await HLTV.getMatch({ id })
        .then((m) => {
          let life: number = 6e4;
          if (m.date) {
            const now = new Date();
            const diff = m.date - now.getTime();
            life = Math.max(diff, 6e4);
          }
          set(id, m, m.status === "Over" ? 864e5 : life);
          return m;
        })
        .catch((e) => {
          console.log(e);

          return null;
        });
  }, 6e4);
  const onScoreboardUpdate = async (scoreboard: ScoreboardUpdate, done: any) => {
    if (match?.status == 'Over') {
      clearInterval(ntrvl);
      clearInterval(ntrvl2);
      await thread?.send('Match Over');
      thread?.setArchived(true);
      return done();
    }
    scoreBoard = scoreboard;
  };

  const onDisconnect = () => console.log("disconnected");

  try {
    HLTV.connectToScorebot({ id, onScoreboardUpdate, onConnect, onDisconnect, onLogUpdate });
  } catch (e) {
    interaction.editReply("❌ No live scoreboard");
  }
};

async function sendLog(type: string, data: any, thread: ThreadChannel | undefined) {
  if (!thread) return;
  const color = (str: string, color: string) => `[${color == "CT" ? 34 : 33}m${str}[0m`;

  const side = (str: string) => (str == "CT" ? "CT" : "T");

  switch (type) {
    case "RoundStart":
      thread.send(`Round started`);
      break;
    case "RoundEnd":
      const winner = side(data.winner);
      thread.send(
        `\`\`\`ansi\n${color(winner, winner)} won the round (${data.winType}) | (${color(
          data.counterTerroristScore,
          "CT"
        )} - ${color(data.terroristScore, "T")})\`\`\``
      );
      break;
    case "Restart":
      thread.send(`Restarted`);
      break;
    case "MatchStarted":
      thread.send(`Match started | Map: ${data.map}`);
      break;
    case "Kill":
      thread.send(
        `\`\`\`ansi\n${color(data.killerNick, data.killerSide)} killed ${color(
          data.victimNick,
          data.victimSide
        )} with ${data.weapon}\`\`\``
      );
      break;
    case "Suicide":
      thread.send(`\`\`\`ansi\n${color(data.playerNick, data.side)} killed themselves.\`\`\``);
      break;
    case "BombDefused":
      thread.send(`Bomb defused by ${data.playerNick}`);
      break;
    case "BombPlanted":
      thread.send(
        `Bomb planted by ${data.playerNick} (${color(data.ctPlayers, "CT")} on ${color(
          data.tPlayers,
          "T"
        )})`
      );
      break;
    case "PlayerJoin":
      thread.send(`${data.playerNick} joined.`);
      break;
    case "PlayerQuit":
      thread.send(`${data.playerNick} quit.`);
      break;
    default:
      break;
  }
}

async function createThread(
  thread: ThreadChannel | undefined,
  channel: TextChannel,
  id: number,
  msg: Message<boolean>,
  interaction: CommandInteraction
) {
  thread = await channel.threads
    .create({
      name: `Scoreboard for match ${id}`,
      startMessage: msg
    })
    .catch(() => {
      channel.send(`<@!${interaction.user.id}> Missing permissions to create thread`);
      return undefined;
    });
  return thread;
}

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
