import "dotenv/config";
import express from "express";
import cors from "cors";
import { accessRulesRouter } from "./routes/accessRules";
import usersRoutes from "./routes/users";
import previewsRoutes from "./routes/previews";
import mlbRoutes from "./routes/mlb";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("API is running");
});

app.use("/api/access-rules", accessRulesRouter);
app.use("/api/users", usersRoutes);
app.use("/api/previews", previewsRoutes);
app.use("/api/mlb", mlbRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
