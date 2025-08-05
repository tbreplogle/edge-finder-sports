import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import authMiddleware from '../middleware/authMiddleware';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service role for admin ops
);

// GET /api/users
router.get('/', authMiddleware, async (req, res) => {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, email, role, is_admin')
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

// PUT /api/users/:id
router.put('/:id', authMiddleware, async (req, res) => {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { id } = req.params;
  const { role } = req.body ?? {};
  if (!role) {
    return res.status(400).json({ error: 'Missing role' });
  }

  const { data, error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', id)
    .select('id, email, role, is_admin')
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

export default router;
