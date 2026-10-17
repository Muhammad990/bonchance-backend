import RechargeOrder from '../models/RechargeOrder.js';
import Member from '../models/Member.js';
import BankCard from '../models/BankCard.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logWalletTransaction } from '../utils/walletLogger.js';
import { getLevelLimits } from '../utils/membershipLevelHelper.js';
import { assertTransactionsEnabled } from './settingController.js';
import jwt from 'jsonwebtoken';

const pad = (n) => String(n).padStart(2, '0');

const formatDateTime = (d = new Date()) => {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

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

export const createRechargeOrder = asyncHandler(async (req, res, next) => {
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

  const member = await Member.findById(decoded.id);
  if (!member) {
    return next(new ApiError(401, 'Not authorized, user not found'));
  }

  // Admin ne is member ke transactions band kiye hue hain to deposit nahi ho sakta
  if (member.transactions === 'Disabled') {
    return next(
      new ApiError(403, 'Transactions are disabled for your account. Please contact support.')
    );
  }

  // Admin ne site-wide transactions band kiye hue hain to deposit nahi ho sakta
  await assertTransactionsEnabled();

  const { bankName, cardNumber, accountHolderName, rechargeAmount } = req.body;

  // User ki saved bank card hi asal source hai — client values override nahi karti
  const savedCard = await BankCard.findOne({ memberId: member.memberId });
  const finalBankName = savedCard ? savedCard.bankName : bankName;
  const finalCardNumber = savedCard ? savedCard.accountNumber : cardNumber;
  const finalHolderName = savedCard ? savedCard.accountHolderName : accountHolderName;

  const missing = [];
  if (!finalBankName || !String(finalBankName).trim()) missing.push('Bank name');
  if (!finalCardNumber || !String(finalCardNumber).trim()) missing.push('Card number');
  if (!finalHolderName || !String(finalHolderName).trim())
    missing.push('Account holder name');

  const amountValue = Number(rechargeAmount);
  if (rechargeAmount === undefined || rechargeAmount === null || Number.isNaN(amountValue))
    missing.push('Recharge amount');
  else if (amountValue <= 0) missing.push('Recharge amount must be greater than 0');

  if (missing.length > 0) {
    return next(new ApiError(400, `Required fields are missing: ${missing.join(', ')}`, missing));
  }

  const limits = await getLevelLimits(member.vipLevel);
  if (limits) {
    if (Number.isFinite(limits.depositMin) && limits.depositMin > 0 && amountValue < limits.depositMin) {
      return next(
        new ApiError(
          400,
          `Deposit amount cannot be less than ${limits.depositMin} for ${member.vipLevel}`
        )
      );
    }
    if (Number.isFinite(limits.depositMax) && limits.depositMax > 0 && amountValue > limits.depositMax) {
      return next(
        new ApiError(
          400,
          `Deposit amount cannot exceed ${limits.depositMax} for ${member.vipLevel}`
        )
      );
    }
  }

  const order = await RechargeOrder.create({
    memberId: member.memberId,
    username: member.nickname,
    superiorId: member.superiorId || '',
    bankName: String(finalBankName).trim(),
    cardNumber: String(finalCardNumber).trim(),
    accountHolderName: String(finalHolderName).trim(),
    rechargeAmount: amountValue,
    paymentVoucher: 'none',
    state: 'Pending',
    creationTime: formatDateTime(new Date()),
    processingTime: '',
  });

  if (!savedCard) {
    await BankCard.create({
      memberId: member.memberId,
      username: member.nickname,
      superiorId: member.superiorId || '',
      phoneNumber: member.phoneNumber,
      bankName: String(finalBankName).trim(),
      accountNumber: String(finalCardNumber).trim(),
      accountHolderName: String(finalHolderName).trim(),
      branch: '-',
      time: formatDateTime(new Date()),
    });
  }

  res.status(201).json(
    new ApiResponse(201, 'Recharge order submitted, waiting for approval', order)
  );
});

// User apni khud ki deposit history dekh sake (history button)
export const getMyRechargeOrders = asyncHandler(async (req, res, next) => {
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

  const member = await Member.findById(decoded.id);
  if (!member) {
    return next(new ApiError(401, 'Not authorized, user not found'));
  }

  const orders = await RechargeOrder.find({ memberId: member.memberId }).sort({
    createdAt: -1,
  });
  res
    .status(200)
    .json(new ApiResponse(200, 'Deposit history fetched successfully', orders));
});

export const getRechargeOrders = asyncHandler(async (req, res, next) => {
  const { name, state, date } = req.query;
  const filter = {};

  if (name && String(name).trim()) {
    filter.username = { $regex: String(name).trim(), $options: 'i' };
  }
  if (state && String(state).trim() && state !== 'All') {
    filter.state = String(state).trim();
  }
  if (date && String(date).trim()) {
    filter.creationTime = { $regex: `^${String(date).trim()}` };
  }

  const orders = await RechargeOrder.find(filter).sort({ createdAt: -1 });
  res.status(200).json(new ApiResponse(200, 'Recharge orders fetched successfully', orders));
});

export const approveRechargeOrder = asyncHandler(async (req, res, next) => {
  const order = await RechargeOrder.findById(req.params.id);
  if (!order) {
    return next(new ApiError(404, 'Recharge order not found'));
  }

  if (order.state === 'Approved') {
    return res
      .status(200)
      .json(new ApiResponse(200, 'Recharge order is already approved', order));
  }

  const member = await Member.findOne({ memberId: order.memberId });
  if (!member) {
    return next(new ApiError(404, 'Member not found for this recharge order'));
  }

  order.state = 'Approved';
  order.processingTime = formatDateTime(new Date());
  await order.save();

  const before = Number(member.availableFunds) || 0;
  member.availableFunds = before + (Number(order.rechargeAmount) || 0);
  await member.save();

  await logWalletTransaction({
    member,
    before,
    after: member.availableFunds,
    description: 'Recharge approved',
  });

  res.status(200).json(new ApiResponse(200, 'Recharge order approved successfully', order));
});