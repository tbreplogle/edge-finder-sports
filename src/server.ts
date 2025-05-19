
import express from 'express';
import { accessRulesRouter } from './routes/accessRules';

const app = express();
app.use(express.json());

// API routes
app.use("/api/access-rules", accessRulesRouter);

// Start the server if this file is run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
