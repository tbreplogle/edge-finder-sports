import { Router, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

router.get("/bets", async (_req: Request, res: Response): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await admin
    .from("mlb_daily_bets")
    .select("*")
    .eq("game_date", today)
    .order("game_time_ct", { ascending: true });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
});

router.get("/results", async (req: Request, res: Response): Promise<void> => {
  const season = String(req.query.season || "2025");
  const from = `${season}-01-01`;
  const to = `${season}-12-31`;
  const { data, error } = await admin
    .from("mlb_daily_results")
    .select("*")
    .gte("game_date", from)
    .lte("game_date", to)
    .order("game_date", { ascending: false });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
});

export default router;
