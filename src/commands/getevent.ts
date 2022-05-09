import {
  ButtonInteraction,
  CommandInteraction,
  Message,
  MessageActionRow,
  MessageButton,
  MessageButtonStyleResolvable,
  MessageComponentInteraction,
  MessageEmbed,
  WebhookEditMessageOptions,
} from "discord.js";
import HLTV, { Article, FullEvent, FullEventHighlight, FullEventTeam } from "hltv";
import { format } from "util";
import { get, set } from "../db";

const message = async (interaction: CommandInteraction) => {
  const i = await interaction.deferReply({ fetchReply: true }),
    id = interaction.options.getInteger("event_id", true);

  const event = await getEvent(id);
  if (!event) return interaction.editReply("❌ Event not found");

  idleCollector(i as Message, event, interaction);
  return interaction.editReply(createMessage(event));
};

const component = async (interaction: ButtonInteraction) => {
  await interaction.deferReply({ ephemeral: true });
  const eventId = interaction.customId.split(" ")[1],
    label = interaction.customId.split(" ")[2],
    event = await getEvent(Number(eventId));

  if (["news", "highlights"].includes(label)) {
    if (!event) return;
    return interaction.editReply({
      embeds: [
        {
          title: `${label.toUpperCase()} for ${event?.name}`,
          color: 0x2f3136,
          description: createDescription(event[label as "highlights" | "news"]),
        },
      ],
    });
  }

  if (label == "teams") {
    if (!event) return;
    const format = (t: FullEventTeam) => {
      const name = t.id ? `[${t.name}](<https://hltv.org/team/${t.id}/hltv-bot>)` : t.name,
        rank = t.rankDuringEvent ?? "?",
        reason = t.reasonForParticipation ?? "";
      return `\`#${rank}\`. ${name} ${reason}`;
    };
    interaction.editReply({
      content: event.teams.map(t => format(t)).join("\n"),
    });
  }
};

module.exports = { message, component };

// ============================================================

function idleCollector(
  i: Message,
  event: FullEvent,
  interaction: CommandInteraction | MessageComponentInteraction
) {
  const msg = i as Message;
  msg.createMessageComponentCollector({ idle: 30e3 }).on("end", () => {
    const components = createComponents(event);
    components.forEach(c => c.components.forEach(b => (b.disabled = true)));

    interaction.editReply({ components });
  });
}

// ============================================================

function createMessage(event: FullEvent): WebhookEditMessageOptions {
  const embeds = [createEmbed(event)];
  const components = createComponents(event);

  return { embeds, components };
}

function createEmbed(event: FullEvent): MessageEmbed {
  return new MessageEmbed()
    .setColor("#2f3136")
    .setTitle(event.name)
    .setURL(`https://www.hltv.org/events/${event.id}/hltv-bot`)
    .setThumbnail(event.logo)
    .setDescription(`Prize Pool: ${event.prizePool}`)
    .setFooter({ text: `Event ID: ${event.id}` })
    .addFields([
      {
        name: "Start - End",
        value: `<t:${Math.floor((event.dateStart ?? 1000) / 1000)}>\n<t:${Math.floor(
          (event.dateEnd ?? 1000) / 1000
        )}>`,
        inline: true,
      },
      {
        name: "Location",
        value: event.location.name,
        inline: true,
      },
      {
        name: "Map Pool",
        value: `\`\`\`ansi\n[35m${event.mapPool.join(", ")}\`\`\``,
        inline: true,
      },
      ...event.formats.map(f => ({
        name: f.type,
        value: f.description,
      })),
    ]);
}

function createComponents(event: FullEvent): MessageActionRow[] {
  const components: MessageActionRow[] = [];

  const str = `getevent ${event.id}`;
  const button = (
    customId: string,
    label: string,
    style: MessageButtonStyleResolvable = "PRIMARY"
  ): MessageButton => {
    return new MessageButton().setCustomId(customId).setLabel(label).setStyle(style);
  };

  const firstRow = new MessageActionRow().addComponents(
    button(`${str} news`, "News").setDisabled(!event.news.length),
    button(`${str} highlights`, "Highlights").setDisabled(!event.highlights.length),
    button(`${str} teams`, "Teams").setDisabled(!event.teams.length)
  );

  const secondRow = new MessageActionRow().addComponents(
    button(`${str} matches`, "Matches"),
    button(`${str} results`, "Results")
  );

  components.push(firstRow, secondRow);

  return components;
}

// ============================================================

function createDescription(arr: Article[] | FullEventHighlight[] | undefined): string {
  if (!arr) return "";
  return arr
    .map((n, i) => {
      const emoji = i % 2 ? "🔸" : "🔹";
      const link = n.link.startsWith("/") ? newsLink(n.link) : n.link;
      const str = `${emoji} [${n.name}](${link})`;

      return str;

      function newsLink(link: any) {
        link = n.link.split("/");
        link.pop();
        return `https://hltv.org${link.join("/")}/hltv-bot`;
      }
    })
    .join("\n")
    .slice(0, 4000);
}

// ============================================================

async function getEvent(id: number): Promise<FullEvent | null> {
  let event: FullEvent | null = await get(`event_${id}`);
  if (!event)
    event = await HLTV.getEvent({ id })
      .then(e => {
        set(`event_${id}`, 36e5, e); // 1 hour
        return e;
      })
      .catch(() => null);
  return event;
}
