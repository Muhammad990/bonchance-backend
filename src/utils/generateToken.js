import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const generateToken = (id) => {
  return jwt.sign({ id }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
};