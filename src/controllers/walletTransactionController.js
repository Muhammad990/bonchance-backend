import WalletTransaction from '../models/WalletTransaction.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getWalletTransactions = asyncHandler(async (req, res, next) => {
  const { name, type, date } = req.query;
  const filter = {};

  if (name && String(name).trim()) {
    filter.username = { $regex: String(name).trim(), $options: 'i' };
  }
  if (type && String(type).trim() && type !== 'All') {
    filter.type = String(type).trim();
  }
  if (date && String(date).trim()) {
    filter.time = { $regex: `^${String(date).trim()}` };
  }

  const records = await WalletTransaction.find(filter).sort({ createdAt: -1 });
  res
    .status(200)
    .json(new ApiResponse(200, 'Wallet transactions fetched successfully', records));
});