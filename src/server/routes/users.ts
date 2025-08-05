import { Router, RequestHandler } from 'express';
import { createClient } from '@supabase/supabase-js';
import authMiddleware from '../middleware/authMiddleware';

const router = Router();

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const listUsers: RequestHandler = async (req, res) => {
  const user = res.locals.user; // from authMiddleware
  if (!user?.is_admin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const { data, error } = await admin
    .from('users')
    .select('id, email, role, is_admin')
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
};

const updateUserRole: RequestHandler = async (req, res) => {
  const user = res.locals.user;
  if (!user?.is_admin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const { id } = req.params;
  const { role } = req.body || {};
  if (!role) {
    res.status(400).json({ error: 'Missing role' });
    return;
  }

  const { data, error } = await admin
    .from('users')
    .update({ role })
    .eq('id', id)
    .select('id, email, role, is_admin')
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
};

router.get('/', authMiddleware, listUsers);
router.put('/:id', authMiddleware, updateUserRole);

export default router;
