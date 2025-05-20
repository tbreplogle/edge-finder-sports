
import { Router } from "express";
import { supabase } from "../../supabase";
import { authMiddleware } from "../middleware";

export const accessRulesRouter = Router();
accessRulesRouter.use(authMiddleware);

// GET  /api/access-rules
accessRulesRouter.get("/", async (_req, res) => {
  const { data, error } = await supabase
    .from("page_access_rules")
    .select("*")
    .order("page_key");
  if (error) return res.status(500).json({ error });
  res.json({ rules: data });
});

// POST /api/access-rules
accessRulesRouter.post("/", async (req, res) => {
  if (!req.user?.is_admin) return res.sendStatus(403);
  const { page_key, role, access_level } = req.body;
  const { error } = await supabase
    .from("page_access_rules")
    .upsert({ page_key, role, access_level });
  if (error) return res.status(500).json({ error });
  res.json({ ok: true });
});
