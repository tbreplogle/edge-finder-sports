// ────────────────────────────────────────────────────────────────
// src/server/routes/accessRules.ts   (fully replace the file)
// ────────────────────────────────────────────────────────────────
import { Router, Request, Response, NextFunction } from 'express'
import { supabase } from '../../supabase'
import { authMiddleware } from '../middleware'

export const accessRulesRouter = Router()

// attach auth to *every* route
accessRulesRouter.use((req: Request, res: Response, next: NextFunction) =>
  authMiddleware(req, res, next)
)

// GET  /api/access-rules
accessRulesRouter.get('/', async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('page_access_rules')
    .select('*')
    .order('page_key')

  return error ? res.status(500).json({ error }) : res.json({ rules: data })
})

// POST /api/access-rules
accessRulesRouter.post('/', async (req: Request, res: Response) => {
  if (!req.user?.is_admin) return res.sendStatus(403)

  const { page_key, role, access_level } = req.body

  const { error } = await supabase
    .from('page_access_rules')
    .upsert({ page_key, role, access_level })

  return error ? res.status(500).json({ error }) : res.json({ ok: true })
})
