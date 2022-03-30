import { Client, CommandInteraction, Intents } from "discord.js";
const { TOKEN } = process.env;

const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

client.once("ready", () => {
  console.log("Ready");
});

client.on("interactionCreate", async interaction => {
  if (interaction.isCommand()) {
    try {
      return require(`./commands/${interaction.commandName}.js`)(client, interaction);
    } catch (e) {
      console.error(e);
      return interaction.reply({ content: "Command not found.", ephemeral: true });
    }
  }
});

client.on("rateLimit", (data) => console.log(`Rate limit exceeded: ${data.path}`, data));
client.on("error", (e) => console.log("ClientError", e));
client.on("warn", (e) => console.log("ClientWarning", e));

process.on("uncaughtException", (e) => console.log("UncaughtException", e));
process.on("unhandledRejection", (e) => console.log("UnhandledRejection", e));

client.login(TOKEN);
