import WithdrawalOrder from '../models/WithdrawalOrder.js';
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
import { getBasicTimeSettings, secondsInTimeZone, isSecondsInWindow } from '../utils/timeWindowHelper.js';

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

const buildBankInformation = (method, data) => {
  if (method === 'Bank Card') {
    return [
      `Bank Name: ${data.bankName || ''}`,
      `Bank Card Number: ${data.accountNumber || ''}`,
      `Account Name: ${data.accountHolderName || ''}`,
    ].join('\n');
  }
  if (method === 'USDT') {
    return [
      `USDT: ${data.usdtAddress || ''}`,
      `Protocol: ${data.usdtProtocol || ''}`,
      `Account Name: ${data.usdtFullName || ''}`,
    ].join('\n');
  }
  if (method === 'Wise') {
    return [`Wise: ${data.wiseEmail || ''}`, `Account Name: ${data.wiseFullName || ''}`].join(
      '\n'
    );
  }
  if (method === 'Revolut') {
    return [
      `Revolut: ${data.walletAddress || ''}`,
      `Account Name: ${data.revolutFullName || ''}`,
    ].join('\n');
  }
  return '';
};

export const createWithdrawalOrder = asyncHandler(async (req, res, next) => {
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

  const member = await Member.findById(decoded.id).select(
    '+loginPassword +securityPin'
  );
  if (!member) {
    return next(new ApiError(401, 'Not authorized, user not found'));
  }

  // Admin ne is member ke transactions band kiye hue hain to withdrawal nahi ho sakta
  if (member.transactions === 'Disabled') {
    return next(
      new ApiError(403, 'Transactions are disabled for your account. Please contact support.')
    );
  }

  // Admin ne site-wide transactions band kiye hue hain to withdrawal nahi ho sakta
  await assertTransactionsEnabled();

  // Withdrawal sirf 01:00:00 - 17:00:00 ke darmiyan allowed hai
  const basicSettings = await getBasicTimeSettings();
  let currentSeconds;
  try {
    currentSeconds = secondsInTimeZone(basicSettings.systemTimeZone);
  } catch (error) {
    currentSeconds = secondsInTimeZone('Asia/Bishkek');
  }
  if (!isSecondsInWindow(currentSeconds, basicSettings.withdrawalStartTime, basicSettings.withdrawalEndTime)) {
    return next(
      new ApiError(
        403,
        `Withdrawals are allowed between ${basicSettings.withdrawalStartTime} and ${basicSettings.withdrawalEndTime} only. Please try again during this time.`
      )
    );
  }

  const {
    method,
    withdrawalAmount,
    securityPin,
    bankName,
    accountNumber,
    accountHolderName,
    usdtAddress,
    usdtProtocol,
    usdtFullName,
    wiseEmail,
    wiseFullName,
    walletAddress,
    revolutFullName,
  } = req.body;

  // User ka saved withdrawal account hi asal source hai — client se override nahi hota
  const savedCard = await BankCard.findOne({ memberId: member.memberId });
  const pick = (saved, given) => {
    const s = String(saved || '').trim();
    return s ? s : String(given || '').trim();
  };

  const details = {
    bankName: pick(savedCard && savedCard.bankName, bankName),
    accountNumber: pick(savedCard && savedCard.accountNumber, accountNumber),
    accountHolderName: pick(savedCard && savedCard.accountHolderName, accountHolderName),
    usdtAddress: pick(savedCard && savedCard.usdtAddress, usdtAddress),
    usdtProtocol: pick(savedCard && savedCard.usdtProtocol, usdtProtocol) || 'ERC20',
    usdtFullName: pick(savedCard && savedCard.usdtFullName, usdtFullName),
    wiseEmail: pick(savedCard && savedCard.wiseEmail, wiseEmail),
    wiseFullName: pick(savedCard && savedCard.wiseFullName, wiseFullName),
    walletAddress: pick(savedCard && savedCard.revolutWallet, walletAddress),
    revolutFullName: pick(savedCard && savedCard.revolutFullName, revolutFullName),
  };

  const missing = [];
  if (!method || !['Bank Card', 'USDT', 'Wise', 'Revolut'].includes(method)) {
    missing.push('Withdrawal method');
  }
  if (!securityPin) missing.push('Security pin');

  const amountValue = Number(withdrawalAmount);
  if (withdrawalAmount === undefined || withdrawalAmount === null || Number.isNaN(amountValue))
    missing.push('Withdrawal amount');
  else if (amountValue <= 0) missing.push('Withdrawal amount must be greater than 0');

  // Withdrawal account detail us method ke hisaab se lazmi hai
  if (method === 'Bank Card') {
    if (!details.bankName) missing.push('Bank name');
    if (!details.accountNumber) missing.push('Card number');
    if (!details.accountHolderName) missing.push('Account holder name');
  } else if (method === 'USDT') {
    if (!details.usdtAddress) missing.push('USDT address');
    if (!details.usdtFullName) missing.push('Full name');
  } else if (method === 'Wise') {
    if (!details.wiseEmail) missing.push('Wise account email');
    if (!details.wiseFullName) missing.push('Full name');
  } else if (method === 'Revolut') {
    if (!details.walletAddress) missing.push('Wallet address');
    if (!details.revolutFullName) missing.push('Full name');
  }

  if (missing.length > 0) {
    return next(new ApiError(400, `Required fields are missing: ${missing.join(', ')}`, missing));
  }

  let pinOk = false;
  if (member.securityPin) {
    pinOk = await member.matchSecurityPin(securityPin);
  }
  if (!pinOk) {
    return next(new ApiError(400, 'Security pin is incorrect'));
  }
  if (!pinOk) {
    return next(new ApiError(400, 'Security pin is incorrect'));
  }

  if (amountValue > (Number(member.availableFunds) || 0)) {
    return next(new ApiError(400, 'Insufficient balance'));
  }

  const limits = await getLevelLimits(member.vipLevel);
  let handlingFee = 0;
  if (limits) {
    if (Number.isFinite(limits.minWithdrawal) && limits.minWithdrawal > 0 && amountValue < limits.minWithdrawal) {
      return next(
        new ApiError(
          400,
          `Withdrawal amount cannot be less than ${limits.minWithdrawal} for ${member.vipLevel}`
        )
      );
    }
    if (Number.isFinite(limits.maxWithdrawal) && limits.maxWithdrawal > 0 && amountValue > limits.maxWithdrawal) {
      return next(
        new ApiError(
          400,
          `Withdrawal amount cannot exceed ${limits.maxWithdrawal} for ${member.vipLevel}`
        )
      );
    }
    if (Number.isFinite(limits.withdrawalLimitCount) && limits.withdrawalLimitCount > 0) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const countToday = await WithdrawalOrder.countDocuments({
        memberId: member.memberId,
        state: { $nin: ['Rejected'] },
        createdAt: { $gte: todayStart },
      });
      if (countToday >= limits.withdrawalLimitCount) {
        return next(
          new ApiError(
            400,
            `Daily withdrawal limit reached. You can make ${limits.withdrawalLimitCount} withdrawal(s) per day.`
          )
        );
      }
    }
    if (Number.isFinite(limits.withdrawalFeeRate) && limits.withdrawalFeeRate > 0) {
      handlingFee = Math.round(amountValue * (limits.withdrawalFeeRate / 100) * 100) / 100;
    }
  }

  const bankInformation = buildBankInformation(method, details);

  const order = await WithdrawalOrder.create({
    memberId: member.memberId,
    username: member.nickname,
    superiorId: member.superiorId || '',
    method,
    bankInformation,
    withdrawalAmount: amountValue,
    handlingFee,
    fundsDeducted: true,
    state: 'Pending',
    reviewInformation: '',
    creationTime: formatDateTime(new Date()),
    processingTime: '',
  });

  // Withdrawal request ke waqt hi amount account se deduct kar do.
  // Approve par dobara deduct nahi hoga, reject par wapas refund hoga.
  const before = Math.round((Number(member.availableFunds) || 0) * 100) / 100;
  member.availableFunds = Math.round((before - amountValue) * 100) / 100;
  await member.save();

  await logWalletTransaction({
    member,
    before,
    after: member.availableFunds,
    description: 'Withdrawal request',
  });

  res.status(201).json(
    new ApiResponse(201, 'Withdrawal request submitted, waiting for approval', order)
  );
});

// User apni khud ki withdrawal history dekh sake (history button)
export const getMyWithdrawalOrders = asyncHandler(async (req, res, next) => {
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

  const orders = await WithdrawalOrder.find({ memberId: member.memberId }).sort({
    createdAt: -1,
  });
  res
    .status(200)
    .json(new ApiResponse(200, 'Withdrawal history fetched successfully', orders));
});

export const getWithdrawalOrders = asyncHandler(async (req, res, next) => {
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

  const orders = await WithdrawalOrder.find(filter).sort({ createdAt: -1 });
  res.status(200).json(new ApiResponse(200, 'Withdrawal orders fetched successfully', orders));
});

export const editWithdrawalOrder = asyncHandler(async (req, res, next) => {
  const order = await WithdrawalOrder.findById(req.params.id);
  if (!order) {
    return next(new ApiError(404, 'Withdrawal order not found'));
  }

  if (order.state !== 'Pending') {
    return next(new ApiError(400, 'Withdrawal order has already been reviewed'));
  }

  const { withdrawalAmount, handlingFee } = req.body;

  if (withdrawalAmount !== undefined && withdrawalAmount !== null && withdrawalAmount !== '') {
    const amountValue = Math.round(Number(withdrawalAmount) * 100) / 100;
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      return next(new ApiError(400, 'Withdrawal amount must be greater than 0'));
    }

    const oldAmount = Math.round((Number(order.withdrawalAmount) || 0) * 100) / 100;
    if (order.fundsDeducted && amountValue !== oldAmount) {
      const member = await Member.findOne({ memberId: order.memberId });
      if (!member) {
        return next(new ApiError(404, 'Member not found'));
      }

      const delta = Math.round((amountValue - oldAmount) * 100) / 100;
      const before = Math.round((Number(member.availableFunds) || 0) * 100) / 100;
      if (delta > 0 && delta > before) {
        return next(new ApiError(400, 'Insufficient balance for this withdrawal'));
      }

      member.availableFunds = Math.round((before - delta) * 100) / 100;
      await member.save();

      await logWalletTransaction({
        member,
        before,
        after: member.availableFunds,
        description: delta > 0 ? 'Withdrawal amount increased' : 'Withdrawal amount decreased',
      });
    }

    order.withdrawalAmount = amountValue;
  }

  if (handlingFee !== undefined && handlingFee !== null && handlingFee !== '') {
    const feeValue = Number(handlingFee);
    if (Number.isNaN(feeValue) || feeValue < 0) {
      return next(new ApiError(400, 'Handling fee cannot be negative'));
    }
    order.handlingFee = feeValue;
  } else {
    order.handlingFee = 0;
  }

  await order.save();
  res.status(200).json(new ApiResponse(200, 'Withdrawal order updated successfully', order));
});

export const approveWithdrawalOrder = asyncHandler(async (req, res, next) => {
  const order = await WithdrawalOrder.findById(req.params.id);
  if (!order) {
    return next(new ApiError(404, 'Withdrawal order not found'));
  }

  if (order.state === 'Approved') {
    return res.status(200).json(new ApiResponse(200, 'Withdrawal order is already approved', order));
  }

  if (order.state !== 'Pending') {
    return next(new ApiError(400, 'Withdrawal order has already been reviewed'));
  }

  // Purane pending orders jinka amount abhi tak deduct nahi hua, unke liye
  // approve par deduct karo. Naye orders ka amount request ke waqt hi deduct ho chuka hai.
  if (!order.fundsDeducted) {
    const member = await Member.findOne({ memberId: order.memberId });
    if (!member) {
      return next(new ApiError(404, 'Member not found'));
    }

    const amount = Math.round((Number(order.withdrawalAmount) || 0) * 100) / 100;
    const before = Math.round((Number(member.availableFunds) || 0) * 100) / 100;
    if (amount > before) {
      return next(new ApiError(400, 'Insufficient balance for this withdrawal'));
    }

    member.availableFunds = Math.round((before - amount) * 100) / 100;
    await member.save();

    await logWalletTransaction({
      member,
      before,
      after: member.availableFunds,
      description: 'Withdrawal approved',
    });

    order.fundsDeducted = true;
  }

  order.state = 'Approved';
  order.processingTime = formatDateTime(new Date());
  await order.save();

  res.status(200).json(new ApiResponse(200, 'Withdrawal order approved successfully', order));
});

export const rejectWithdrawalOrder = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;
  if (!reason || !String(reason).trim()) {
    return next(new ApiError(400, 'Rejection reason is required'));
  }

  const order = await WithdrawalOrder.findById(req.params.id);
  if (!order) {
    return next(new ApiError(404, 'Withdrawal order not found'));
  }

  if (order.state === 'Rejected') {
    return res.status(200).json(new ApiResponse(200, 'Withdrawal order is already rejected', order));
  }

  if (order.state !== 'Pending') {
    return next(new ApiError(400, 'Withdrawal order has already been reviewed'));
  }

  const member = await Member.findOne({ memberId: order.memberId });
  let refunded = false;
  let before = 0;

  // Request ke waqt deduct hua amount reject par account mein wapas kar do.
  if (member && order.fundsDeducted) {
    const amount = Math.round((Number(order.withdrawalAmount) || 0) * 100) / 100;
    before = Math.round((Number(member.availableFunds) || 0) * 100) / 100;
    member.availableFunds = Math.round((before + amount) * 100) / 100;
    refunded = true;
  }

  order.state = 'Rejected';
  order.reviewInformation = String(reason).trim();
  order.processingTime = formatDateTime(new Date());
  order.fundsDeducted = false;
  await order.save();

  if (member) {
    member.unseenRejection = true;
    member.rejectionReason = String(reason).trim();
    await member.save();

    if (refunded) {
      await logWalletTransaction({
        member,
        before,
        after: member.availableFunds,
        description: 'Withdrawal rejected - refund',
      });
    }
  }

  res.status(200).json(new ApiResponse(200, 'Withdrawal order rejected successfully', order));
});