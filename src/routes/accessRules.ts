
import express, { Request, Response } from 'express';

export const accessRulesRouter = express.Router();

// Middleware to check authentication for all routes
accessRulesRouter.use((req: Request, res: Response, next) => {
  // For now, just pass through for development
  next();
});

// Get all access rules
accessRulesRouter.get('/', async (_req: Request, res: Response) => {
  try {
    // Hardcoded data for development
    const rules = [
      { id: 1, page_key: 'dashboard', role: 'free', access_level: 'preview' },
      { id: 2, page_key: 'dashboard', role: 'premium', access_level: 'full' },
      { id: 3, page_key: 'dashboard', role: 'admin', access_level: 'full' },
      { id: 4, page_key: 'reports', role: 'free', access_level: 'none' },
      { id: 5, page_key: 'reports', role: 'premium', access_level: 'full' },
      { id: 6, page_key: 'reports', role: 'admin', access_level: 'full' },
    ];
    
    return res.json({ rules });
  } catch (err) {
    console.error('Error fetching access rules:', err);
    return res.status(500).json({ error: 'Failed to fetch access rules' });
  }
});

// Update an access rule
accessRulesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const rule = req.body;
    
    // In a real app, this would update the database
    console.log('Updating rule:', rule);
    
    return res.json({ success: true, rule });
  } catch (err) {
    console.error('Error updating access rule:', err);
    return res.status(500).json({ error: 'Failed to update access rule' });
  }
});
