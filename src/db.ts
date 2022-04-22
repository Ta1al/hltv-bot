import { Schema, model } from "mongoose";

const schema = new Schema({
  name: String,
  eol: { type: Number, required: true },
  value: {},
})

export const db = model("db", schema);

export const get = async (name: string) => {
  const doc = await db.findOne({ name });
  return doc ? doc.value : null;
};
export const set = async (name: string, eol: number, value: any) => {
  eol += new Date().getTime();
  return await db.updateOne({ name }, { $set: { eol, value } }, { upsert: true });
};

setInterval(() => db.deleteMany({ eol: { $lt: new Date().getTime() } }), 60e3);
