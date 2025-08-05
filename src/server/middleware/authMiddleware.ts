import { NextFunction, Request, Response, RequestHandler } from 'express';
import { createClient } from '@supabase/supabase-js';

export type AppUser = {
  id?: string;
  email?: string | null;
  role?: string | null;
  is_admin?: boolean;
  auth_id?: string;
};

const supabaseUrl = process.env.SUPABASE_URL!;
const anonKey     = process.env.SUPABASE_ANON_KEY!;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const publicClient = createClient(supabaseUrl, anonKey);
const adminClient  = createClient(supabaseUrl, serviceKey);

/**
 * NOTE: We intentionally do NOT augment Express.Request with a `user` property
 * because your project already has a conflicting declaration.
 * Instead, we put the user on res.locals.user (Express best practice).
 */
const authMiddleware: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      res.status(401).json({ error: 'Missing Bearer token' });
      return;
    }

    const { data, error } = await publicClient.auth.getUser(token);
    if (error || !data?.user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    const authId = data.user.id;

    const { data: profile } = await adminClient
      .from('users')
      .select('id, email, role, is_admin')
      .eq('auth_id', authId)
      .maybeSingle();

    const user: AppUser = {
      id: profile?.id,
      email: profile?.email ?? data.user.email ?? null,
      role: profile?.role ?? 'free',
      is_admin: profile?.is_admin ?? false,
      auth_id: authId,
    };

    res.locals.user = user; // <- use res.locals instead of req.user
    next();
  } catch (e: any) {
    res.status(500).json({ error: String(e) });
  }
};

export default authMiddleware;
