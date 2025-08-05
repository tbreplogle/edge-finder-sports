import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

interface AppUser {
  id?: string;
  email?: string | null;
  role?: string | null;
  is_admin?: boolean;
  auth_id?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AppUser;
    }
  }
}

const supabaseUrl = process.env.SUPABASE_URL!;
const anonKey     = process.env.SUPABASE_ANON_KEY!;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const publicClient = createClient(supabaseUrl, anonKey);
const adminClient  = createClient(supabaseUrl, serviceKey);

export default async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing Bearer token' });

    // Verify the JWT with Supabase
    const { data, error } = await publicClient.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid token' });

    const authId = data.user.id;

    // Look up profile row in public.users
    const { data: profile } = await adminClient
      .from('users')
      .select('id, email, role, is_admin')
      .eq('auth_id', authId)
      .maybeSingle();

    req.user = {
      ...profile,
      email: profile?.email ?? data.user.email ?? null,
      role: profile?.role ?? 'free',
      is_admin: profile?.is_admin ?? false,
      auth_id: authId,
    };

    next();
  } catch (e: any) {
    res.status(500).json({ error: String(e) });
  }
}
