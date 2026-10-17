import SiteSetting from '../models/SiteSetting.js';
import Admin from '../models/Admin.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import jwt from 'jsonwebtoken';

const readToken = (req) => {
  const bearer =
    req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null;
  if (bearer) return bearer;

  const cookies = (req.headers.cookie || '').split(';');
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split('=');
    if (name === 'token') return rest.join('=');
  }
  return null;
};

// Public — user panel ko pata chale ke transactions band hain ya nahi
export const getSettings = asyncHandler(async (req, res) => {
  const setting = await SiteSetting.getGeneral();

  res.status(200).json(
    new ApiResponse(200, 'Settings fetched successfully', {
      transactionsDisabled: !!setting.transactionsDisabled,
      disabledMessage: setting.disabledMessage,
    })
  );
});

// Admin only — token cookie ya Bearer se admin verify hota hai
export const updateSettings = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) {
    return next(new ApiError(401, 'Not authorized, no token provided'));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    return next(
      new ApiError(401, err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token')
    );
  }

  const admin = await Admin.findById(decoded.id);
  if (!admin) {
    return next(new ApiError(401, 'Not authorized, admin only'));
  }

  const { transactionsDisabled, disabledMessage } = req.body;
  const setting = await SiteSetting.getGeneral();

  if (transactionsDisabled !== undefined) {
    setting.transactionsDisabled = !!transactionsDisabled;
  }
  if (disabledMessage !== undefined) {
    const text = String(disabledMessage).trim();
    setting.disabledMessage = text || SiteSetting.DEFAULT_DISABLED_MESSAGE;
  }

  await setting.save();

  res.status(200).json(
    new ApiResponse(200, 'Settings updated successfully', {
      transactionsDisabled: setting.transactionsDisabled,
      disabledMessage: setting.disabledMessage,
    })
  );
});

// Deposit / Withdrawal create hone se pehle yeh call karo
export const assertTransactionsEnabled = async () => {
  const setting = await SiteSetting.getGeneral();
  if (setting.transactionsDisabled) {
    throw new ApiError(
      403,
      setting.disabledMessage || SiteSetting.DEFAULT_DISABLED_MESSAGE
    );
  }
};
