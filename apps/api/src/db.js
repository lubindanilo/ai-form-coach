const mongoose = require("mongoose");

async function connectMongo(mongoUrl) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUrl);
  console.log("[mongo] connected");
}

module.exports = { connectMongo };
