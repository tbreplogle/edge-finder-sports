
import { Router, Request, Response } from "express";
import { supabase } from "../../supabase";
import { authMiddleware } from "../middleware";

export const accessRulesRouter = Router();

// Apply the auth middleware to all routes in this router
accessRulesRouter.use(authMiddleware);

// GET  /api/access-rules
accessRulesRouter.get("/", async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from("page_access_rules")
    .select("*")
    .order("page_key");
  if (error) return res.status(500).json({ error });
  res.json({ rules: data });
});

// POST /api/access-rules
accessRulesRouter.post("/", async (req: Request, res: Response) => {
  if (!req.user?.is_admin) return res.sendStatus(403);
  const { page_key, role, access_level } = req.body;
  const { error } = await supabase
    .from("page_access_rules")
    .upsert({ page_key, role, access_level });
  if (error) return res.status(500).json({ error });
  res.json({ ok: true });
});
