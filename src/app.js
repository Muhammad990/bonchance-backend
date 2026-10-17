import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import productRoutes from './routes/productRoutes.js';
import membershipLevelRoutes from './routes/membershipLevelRoutes.js';
import memberRoutes from './routes/memberRoutes.js';
import rechargeOrderRoutes from './routes/rechargeOrderRoutes.js';
import withdrawalOrderRoutes from './routes/withdrawalOrderRoutes.js';
import walletTransactionRoutes from './routes/walletTransactionRoutes.js';
import bankCardRoutes from './routes/bankCardRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import settingRoutes from './routes/settingRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import { ApiResponse } from './utils/ApiResponse.js';

const app = express();

app.use(helmet());

const allowedOrigins = env.corsOrigin.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));

if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

app.get('/', (req, res) => {
  res.status(200).json(
    new ApiResponse(200, 'Backend server is running', {
      health: '/api/health',
      endpoints: {
        auth: ['/api/auth/register', '/api/auth/login'],
        users: ['/api/users/profile'],
      },
    })
  );
});

app.get('/api/health', (req, res) => {
  res.status(200).json(new ApiResponse(200, 'Server is running'));
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/membership-levels', membershipLevelRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/recharge-orders', rechargeOrderRoutes);
app.use('/api/withdrawal-orders', withdrawalOrderRoutes);
app.use('/api/wallet-transactions', walletTransactionRoutes);
app.use('/api/bank-cards', bankCardRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;