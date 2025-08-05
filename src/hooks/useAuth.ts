import { useEffect, useState } from 'react';

export default function useAuth() {
  const [user, setUser] = useState<{ role?: string; is_admin?: boolean } | null>(null);

  useEffect(() => {
    setUser(JSON.parse(localStorage.getItem('user') || 'null'));
  }, []);

  return {
    user,
    isAdmin: !!user?.is_admin,
    isPremium: user?.role === 'premium' || user?.role === 'enterprise',
  };
}
