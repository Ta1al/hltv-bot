import { Client, Intents } from "discord.js";
import { connect } from "mongoose";
const { TOKEN, MONGO_URI } = process.env;

const client = new Client({
  intents: [Intents.FLAGS.GUILDS],
  sweepers: { messages: { lifetime: 30e3, interval: 30e3 } },
});

client.once("ready", () => {
  if (MONGO_URI) {
    connect(MONGO_URI);
    require("./db");
  }
  console.log("Ready");
});

client.on("interactionCreate", async interaction => {
  if (interaction.isCommand() || interaction.isMessageComponent()) {
    try {
      let commandName = interaction.isCommand() ?
        interaction.commandName :
        interaction.customId.split(" ")[0],
        command = require(`./commands/${commandName}.js`);

      return interaction.isCommand() ?
        command.message(interaction) :
        command.component(interaction);
    } catch (e) {
      console.error(e);
      return interaction.reply({ content: "An error occured.", ephemeral: true });
    }
  }
});

client.on("rateLimit", data => console.log(`Rate limit exceeded: ${data.path}`, data));
client.on("error", e => console.log("ClientError", e));
client.on("warn", e => console.log("ClientWarning", e));

process.on("uncaughtException", e => console.log("UncaughtException", e));
process.on("unhandledRejection", e => console.log("UnhandledRejection", e));

client.login(TOKEN);
