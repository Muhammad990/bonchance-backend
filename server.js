import app from './src/app.js';
import { connectDB } from './src/config/db.js';
import { seedAdmin } from './src/config/seedAdmin.js';
import { seedProducts } from './src/config/seedProducts.js';
import { seedMembershipLevels } from './src/config/seedMembershipLevels.js';
import { creditGradeSalaries } from './src/jobs/gradeSalaryJob.js';
import { env } from './src/config/env.js';

const start = async () => {
  try {
    await connectDB();

    await seedAdmin();
    await seedProducts();
    await seedMembershipLevels();

    app.listen(env.port, () => {
      console.log(`Server running in ${env.nodeEnv} mode on port ${env.port}`);
    });

    await creditGradeSalaries();
    setInterval(() => {
      creditGradeSalaries();
    }, 60 * 1000);
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

start();