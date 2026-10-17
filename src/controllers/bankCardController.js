import BankCard from '../models/BankCard.js';
import Member from '../models/Member.js';
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

const verifyMember = async (req, next) => {
  const token = readToken(req);
  if (!token) {
    next(new ApiError(401, 'Not authorized, no token provided'));
    return null;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    next(
      new ApiError(401, err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token')
    );
    return null;
  }

  const member = await Member.findById(decoded.id);
  if (!member) {
    next(new ApiError(401, 'Not authorized, user not found'));
    return null;
  }
  return member;
};

const pad = (n) => String(n).padStart(2, '0');

const formatDateTime = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;


export const getBankCards = asyncHandler(async (req, res, next) => {
  const { name, date } = req.query;
  const filter = {};

  if (name && String(name).trim()) {
    filter.username = { $regex: String(name).trim(), $options: 'i' };
  }
  if (date && String(date).trim()) {
    filter.time = { $regex: `^${String(date).trim()}` };
  }

  const cards = await BankCard.find(filter).sort({ createdAt: -1 });
  res.status(200).json(new ApiResponse(200, 'Bank cards fetched successfully', cards));
});

export const getMyBankCard = asyncHandler(async (req, res, next) => {
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

  const card = await BankCard.findOne({ memberId: member.memberId });
  res.status(200).json(new ApiResponse(200, 'Bank card fetched successfully', card || null));
});

// User panel — Withdrawal Account form submit (Bank Card List mein save hota hai)
export const saveMyBankCard = asyncHandler(async (req, res, next) => {
  const member = await verifyMember(req, next);
  if (!member) return;

  const b = req.body || {};
  const val = (v) => String(v === undefined || v === null ? '' : v).trim();

  const bank = {
    bankName: val(b.bankName),
    accountNumber: val(b.accountNumber),
    accountHolderName: val(b.accountHolderName),
  };
  const usdt = { usdtAddress: val(b.usdtAddress), usdtFullName: val(b.usdtFullName) };
  const wise = { wiseEmail: val(b.wiseEmail), wiseFullName: val(b.wiseFullName) };
  const revolut = {
    revolutWallet: val(b.revolutWallet),
    revolutFullName: val(b.revolutFullName),
  };

  const bankCount = Object.values(bank).filter(Boolean).length;
  const usdtCount = Object.values(usdt).filter(Boolean).length;
  const wiseCount = Object.values(wise).filter(Boolean).length;
  const revolutCount = Object.values(revolut).filter(Boolean).length;

  if (bankCount === 0 && usdtCount === 0 && wiseCount === 0 && revolutCount === 0) {
    return next(new ApiError(400, 'Please fill in at least one withdrawal account detail'));
  }
  if (bankCount > 0 && bankCount < 3) {
    return next(
      new ApiError(400, 'Bank Name, Card Number and Account Name are all required')
    );
  }
  if (usdtCount > 0 && usdtCount < 2) {
    return next(new ApiError(400, 'USDT address and full name are both required'));
  }
  if (wiseCount > 0 && wiseCount < 2) {
    return next(new ApiError(400, 'Wise account email and full name are both required'));
  }
  if (revolutCount > 0 && revolutCount < 2) {
    return next(new ApiError(400, 'Revolut wallet address and full name are both required'));
  }

  const payload = {
    username: member.nickname,
    superiorId: member.superiorId || '',
    phoneNumber: member.phoneNumber,
  };
  if (bankCount === 3) Object.assign(payload, bank);
  if (usdtCount === 2) {
    payload.usdtAddress = usdt.usdtAddress;
    payload.usdtFullName = usdt.usdtFullName;
    payload.usdtProtocol = val(b.usdtProtocol) || 'ERC20';
  }
  if (wiseCount === 2) Object.assign(payload, wise);
  if (revolutCount === 2) Object.assign(payload, revolut);

  const existing = await BankCard.findOne({ memberId: member.memberId });

  let card;
  if (existing) {
    Object.assign(existing, payload);
    card = await existing.save();
  } else {
    card = await BankCard.create({
      memberId: member.memberId,
      branch: '-',
      time: formatDateTime(new Date()),
      ...payload,
    });
  }

  res.status(200).json(new ApiResponse(200, 'Withdrawal account saved successfully', card));
});

export const updateBankCard = asyncHandler(async (req, res, next) => {
  const card = await BankCard.findById(req.params.id);
  if (!card) {
    return next(new ApiError(404, 'Bank card not found'));
  }

  const b = req.body || {};
  const set = (v) => (v === undefined || v === null ? undefined : String(v).trim());

  const bankName = set(b.bankName);
  const accountNumber = set(b.accountNumber);
  const accountHolderName = set(b.accountHolderName);
  const branch = set(b.branch);

  if (bankName !== undefined && bankName === '') {
    return next(new ApiError(400, 'Bank name cannot be empty'));
  }
  if (accountNumber !== undefined && accountNumber === '') {
    return next(new ApiError(400, 'Card number cannot be empty'));
  }

  // Sirf wo hi fields update hoti hain jo request mein aayi hain —
  // kisi ek account type ka edit doosre account type ko overwrite nahi karta
  if (bankName !== undefined) card.bankName = bankName;
  if (accountNumber !== undefined) card.accountNumber = accountNumber;
  if (accountHolderName !== undefined) card.accountHolderName = accountHolderName;
  if (branch !== undefined) card.branch = branch;

  const usdtAddress = set(b.usdtAddress);
  const usdtProtocol = set(b.usdtProtocol);
  const usdtFullName = set(b.usdtFullName);
  if (usdtAddress !== undefined) card.usdtAddress = usdtAddress;
  if (usdtProtocol !== undefined) card.usdtProtocol = usdtProtocol || 'ERC20';
  if (usdtFullName !== undefined) card.usdtFullName = usdtFullName;

  const wiseEmail = set(b.wiseEmail);
  const wiseFullName = set(b.wiseFullName);
  if (wiseEmail !== undefined) card.wiseEmail = wiseEmail;
  if (wiseFullName !== undefined) card.wiseFullName = wiseFullName;

  const revolutWallet = set(b.revolutWallet);
  const revolutFullName = set(b.revolutFullName);
  if (revolutWallet !== undefined) card.revolutWallet = revolutWallet;
  if (revolutFullName !== undefined) card.revolutFullName = revolutFullName;

  await card.save();

  res.status(200).json(new ApiResponse(200, 'Bank card updated successfully', card));
});