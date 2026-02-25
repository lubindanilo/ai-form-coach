const express = require("express");
const cors = require("cors");

const { connectMongo } = require("./db");
const uploadsRouter = require("./routes/uploads");
const poseRouter = require("./routes/pose");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/uploads", uploadsRouter);
app.use("/api/pose", poseRouter);

async function main() {
  const port = Number(process.env.PORT || 3000);
  await connectMongo(process.env.MONGO_URL);
  app.listen(port, () => console.log(`[api] listening on :${port}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
