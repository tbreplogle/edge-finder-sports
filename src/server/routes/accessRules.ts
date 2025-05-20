// src/server/routes/accessRules.ts

import { Router, Request, Response, NextFunction } from "express";
import { supabase } from "../../supabase";
import { authMiddleware } from "../middleware";

export const accessRulesRouter = Router();

// ── apply auth to all routes ───────────────────────────────────────────────
accessRulesRouter.use((req: Request, res: Response, next: NextFunction) => {
  authMiddleware(req, res, next);
});

// ── GET /api/access-rules ─────────────────────────────────────────────────
accessRulesRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("page_access_rules")
      .select("*")
      .order("page_key", { ascending: true });

    if (error) {
      console.error("Error fetching access rules:", error);
      res.status(500).json({ error });
      return;
    }

    res.json({ rules: data });
  } catch (err) {
    console.error("Unexpected error fetching access rules:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/access-rules ────────────────────────────────────────────────
accessRulesRouter.post("/", async (req: Request, res: Response) => {
  try {
    // your authMiddleware should set req.user
    if (!req.user?.is_admin) {
      res.sendStatus(403);
      return;
    }

    const { page_key, role, access_level } = req.body;
    const { error } = await supabase
      .from("page_access_rules")
      .upsert(
        { page_key, role, access_level },
        { onConflict: ["page_key", "role"] }
      );

    if (error) {
      console.error("Error upserting access rule:", error);
      res.status(500).json({ error });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Unexpected error upserting access rule:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
