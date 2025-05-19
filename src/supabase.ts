
// Basic Supabase client mockup
// In a real app, you would use the actual Supabase client

export const supabase = {
  from: (table: string) => ({
    select: (columns: string) => ({
      order: (column: string) => ({
        async then(resolve: (result: { data: any[]; error: any }) => void) {
          // Mock response for page_access_rules table
          if (table === 'page_access_rules') {
            resolve({
              data: [
                { page_key: 'dashboard', role: 'free', access_level: 'preview' },
                { page_key: 'dashboard', role: 'premium', access_level: 'full' },
                { page_key: 'dashboard', role: 'admin', access_level: 'full' },
                { page_key: 'mlb_dashboard', role: 'free', access_level: 'none' },
                { page_key: 'mlb_dashboard', role: 'premium', access_level: 'full' },
                { page_key: 'mlb_dashboard', role: 'admin', access_level: 'full' },
                { page_key: 'history', role: 'free', access_level: 'none' },
                { page_key: 'history', role: 'premium', access_level: 'full' },
                { page_key: 'history', role: 'admin', access_level: 'full' },
              ],
              error: null
            });
          } else {
            resolve({ data: [], error: null });
          }
        }
      })
    }),
    upsert: (data: any) => ({
      async then(resolve: (result: { error: any }) => void) {
        resolve({ error: null });
      }
    })
  }),
  functions: {
    invoke: async (functionName: string, options?: any) => {
      return { data: [], error: null };
    }
  }
};
