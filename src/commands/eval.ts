import { CommandInteraction } from "discord.js";
import util from "util";

const message = async (interaction: CommandInteraction) => {
  await interaction.deferReply({ ephemeral: interaction.options.getBoolean("ephemeral") ?? true });
  try {
    const evaled = await eval(interaction.options.getString("code", true));
    const result = util.inspect(evaled, { depth: interaction.options.getInteger("depth") ?? 0 });

    if (result.length > 1990)
      return interaction.editReply({
        files: [{ name: "result.js", attachment: Buffer.from(result) }],
      });
    else return interaction.editReply(`\`\`\`js\n${result}\`\`\``);
  } catch (e) {
    return interaction.editReply({ content: `\`\`\`js\n${e}\`\`\`` });
  }
};

module.exports = { message };
