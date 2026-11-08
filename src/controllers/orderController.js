import Order from '../models/Order.js';
import Member from '../models/Member.js';
import Product from '../models/Product.js';
import MembershipLevel from '../models/MembershipLevel.js';
import MemberOrderSetting from '../models/MemberOrderSetting.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logWalletTransaction } from '../utils/walletLogger.js';
import { syncDailyCounters, syncDailyCountersAsync } from '../utils/dailyCounterHelper.js';
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

const timeInWindow = async () => {
  const settings = await getBasicTimeSettings();
  let seconds;
  try {
    seconds = secondsInTimeZone(settings.systemTimeZone);
  } catch (error) {
    seconds = secondsInTimeZone('Asia/Bishkek');
  }
  return {
    allowed: isSecondsInWindow(seconds, settings.openingTime, settings.closingTime),
    openingTime: settings.openingTime,
    closingTime: settings.closingTime,
  };
};

const computeCommission = (price, rate) => {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return 0;
  const pct = r < 1 ? r * 100 : r;
  return Math.round(price * (pct / 100) * 100) / 100;
};

const withMemberVolume = async (member) => {
  const data = member.toObject ? member.toObject() : { ...member };
  delete data.loginPassword;
  delete data.securityPin;
  const level = await MembershipLevel.findOne({ name: member.vipLevel }).lean();
  if (level && level.dailyOrderVolume) {
    data.dailyOrderVolume = level.dailyOrderVolume;
  }
  return data;
};

const generateOrderNumber = () => {
  const stamp = formatDateTime(new Date()).replace(/[-: ]/g, '');
  const suffix = Math.floor(100 + Math.random() * 900);
  return `SC${stamp}${suffix}`;
};

export const startOrder = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) return next(new ApiError(401, 'Not authorized, no token provided'));

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    return next(
      new ApiError(401, err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token')
    );
  }

  const member = await Member.findById(decoded.id);
  if (!member) return next(new ApiError(401, 'Not authorized, user not found'));

  const orderWindow = await timeInWindow();
  if (!orderWindow.allowed) {
    return next(
      new ApiError(
        400,
        `Start is not allowed at this time. Working hours: ${orderWindow.openingTime} - ${orderWindow.closingTime}`
      )
    );
  }

  await syncDailyCountersAsync(member);
  if (member.isModified('taskStatusDate') || member.isModified('taskStatus')) await member.save();

  const level = await MembershipLevel.findOne({ name: member.vipLevel }).lean();
  const dailyVolume = Number(level?.dailyOrderVolume) || 30;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const usedToday = await Order.find({
    memberId: member.memberId,
    transactionStatus: 'Complete payment',
    createdAt: { $gte: todayStart },
  }).select('_id');

  if ((member.taskStatus || 0) >= dailyVolume && usedToday.length >= dailyVolume) {
    return next(new ApiError(400, `Daily order limit reached for your VIP level (${dailyVolume})`));
  }

  const existing = await Order.findOne({
    memberId: member.memberId,
    transactionStatus: 'Waiting for Payment',
  });
  if (existing) {
    return res.status(200).json(new ApiResponse(200, 'Order fetched', { order: existing }));
  }

  let product = null;
  let fromQueue = false;
  const setting = await MemberOrderSetting.findOne({ memberId: member.memberId });
  if (setting && setting.products && setting.products.length > 0) {
    const head = setting.products[0];
    product = {
      _id: head.productId,
      name: head.name || '',
      picture: head.picture || '',
      price: String(head.price ?? 0),
      rating: Number(head.rating) || 0,
      returnAmount: head.returnAmount,
      multiplier: head.multiplier,
    };
    fromQueue = true;
  } else {
    const products = await Product.find().lean();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const usedToday = await Order.find({
      memberId: member.memberId,
      createdAt: { $gte: todayStart },
    }).distinct('productId');
    const usedSet = new Set(usedToday.map((id) => String(id)));
    const available = products.filter((p) => !usedSet.has(String(p._id)));

    if (available.length === 0) {
      return next(new ApiError(400, 'No available products for today'));
    }

    product = available[Math.floor(Math.random() * available.length)];
  }

  const price = Math.round((Number(product.price) || 0) * 100) / 100;

  if ((Number(member.availableFunds) || 0) < price) {
    return next(new ApiError(400, 'Insufficient balance to place this order'));
  }

  if (fromQueue && setting) {
    setting.products.shift();
    await setting.save();
  }

  const commission = fromQueue && Number.isFinite(Number(product.returnAmount)) && Number(product.returnAmount) > 0
    ? Math.round(Number(product.returnAmount) * 100) / 100
    : computeCommission(price, level?.orderCommissionRate);
  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    memberId: member.memberId,
    username: member.phoneNumber,
    userNickname: member.nickname,
    balance: Math.round((Number(member.availableFunds) || 0) * 100) / 100,
    superiorId: member.superiorId || '',
    productId: String(product._id),
    productName: product.name || '',
    productPicture: product.picture || '',
    productRating: Number(product.rating) || 0,
    unitPrice: price,
    transactionVolume: (member.taskStatus || 0) + 1,
    transactionAmount: price,
    commission,
    transactionStatus: 'Waiting for Payment',
    orderTime: formatDateTime(new Date()),
    settlementTime: '',
  });

  res.status(201).json(new ApiResponse(201, 'Order started', { order }));
});

export const completeOrder = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) return next(new ApiError(401, 'Not authorized, no token provided'));

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    return next(
      new ApiError(401, err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token')
    );
  }

  const member = await Member.findById(decoded.id);
  if (!member) return next(new ApiError(401, 'Not authorized, user not found'));

  syncDailyCounters(member);
  if (member.isModified('taskStatusDate')) await member.save();

  const order = await Order.findById(req.params.id);
  if (!order) return next(new ApiError(404, 'Order not found'));

  if (order.memberId !== member.memberId) {
    return next(new ApiError(403, 'Not authorized to complete this order'));
  }

  if (order.transactionStatus !== 'Waiting for Payment') {
    return next(new ApiError(400, 'Order has already been completed'));
  }

  const commission = Math.round((Number(order.commission) || 0) * 100) / 100;
  const before = Math.round((Number(member.availableFunds) || 0) * 100) / 100;

  member.taskStatus = (member.taskStatus || 0) + 1;
  member.todayProfit = Math.round((Number(member.todayProfit) || 0) * 100 + commission * 100) / 100;
  member.availableFunds = Math.round(before * 100 + commission * 100) / 100;
  await member.save();

  order.transactionStatus = 'Complete payment';
  order.settlementTime = formatDateTime(new Date());
  order.transactionVolume = member.taskStatus;
  await order.save();

  await logWalletTransaction({
    member,
    before,
    after: member.availableFunds,
    description: 'Transaction Commission',
  });

  const memberData = await withMemberVolume(member);
  res.status(200).json(new ApiResponse(200, 'Order completed successfully', { order, member: memberData }));
});

export const getMyPendingOrder = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) return next(new ApiError(401, 'Not authorized, no token provided'));

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    return next(
      new ApiError(401, err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token')
    );
  }

  const member = await Member.findById(decoded.id);
  if (!member) return next(new ApiError(401, 'Not authorized, user not found'));

  const order = await Order.findOne({
    memberId: member.memberId,
    transactionStatus: 'Waiting for Payment',
  });
  res.status(200).json(new ApiResponse(200, 'Pending order fetched', { order: order || null }));
});

export const getMyOrders = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) return next(new ApiError(401, 'Not authorized, no token provided'));

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    return next(
      new ApiError(401, err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token')
    );
  }

  const member = await Member.findById(decoded.id);
  if (!member) return next(new ApiError(401, 'Not authorized, user not found'));

  const { status } = req.query;
  const filter = { memberId: member.memberId };
  if (status && String(status).trim()) {
    filter.transactionStatus = { $regex: String(status).trim(), $options: 'i' };
  }

  const orders = await Order.find(filter).sort({ createdAt: -1 });
  res.status(200).json(new ApiResponse(200, 'My orders fetched successfully', orders));
});

export const getOrders = asyncHandler(async (req, res, next) => {
  const { orderNumber, name, date, status } = req.query;
  const filter = {};

  if (orderNumber && String(orderNumber).trim()) {
    filter.orderNumber = { $regex: String(orderNumber).trim(), $options: 'i' };
  }

  if (name && String(name).trim()) {
    filter.$or = [
      { username: { $regex: String(name).trim(), $options: 'i' } },
      { userNickname: { $regex: String(name).trim(), $options: 'i' } },
    ];
  }

  if (date && String(date).trim()) {
    filter.orderTime = { $regex: `^${String(date).trim()}` };
  }

  if (status && String(status).trim()) {
    filter.transactionStatus = { $regex: String(status).trim(), $options: 'i' };
  }

  const orders = await Order.find(filter).sort({ createdAt: -1 });
  res.status(200).json(new ApiResponse(200, 'Orders fetched successfully', orders));
});