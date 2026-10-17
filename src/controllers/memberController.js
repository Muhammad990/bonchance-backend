import Member from '../models/Member.js';
import Counter from '../models/Counter.js';
import RechargeOrder from '../models/RechargeOrder.js';
import WithdrawalOrder from '../models/WithdrawalOrder.js';
import Order from '../models/Order.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logWalletTransaction } from '../utils/walletLogger.js';
import { todayKey } from '../utils/dailyCounterHelper.js';

const pad = (n) => String(n).padStart(2, '0');

const formatDateTime = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const generateInvitationCode = async () => {
  for (let attempt = 0; attempt < 25; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    const exists = await Member.findOne({ invitationCode: code });
    if (!exists) return code;
  }
  throw new ApiError(500, 'Unable to generate a unique invitation code');
};

const toPublicMember = (member) => {
  const data = member.toObject ? member.toObject() : { ...member };
  delete data.loginPassword;
  delete data.securityPin;
  return data;
};

// memberId wise total amount of a collection (e.g. pending withdrawals, approved recharges)
const sumByMemberId = async (Model, match, amountField) => {
  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: '$memberId', total: { $sum: `$${amountField}` } } },
  ]);
  const map = new Map();
  for (const row of rows) {
    map.set(row._id, Number(row.total) || 0);
  }
  return map;
};

export const getMembers = asyncHandler(async (req, res, next) => {
  const { name, userType, status, referredByCode, date } = req.query;
  const filter = {};

  if (name !== undefined && String(name).trim()) {
    const safe = String(name).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    filter.$or = [{ phoneNumber: rx }, { nickname: rx }];
  }

  if (date !== undefined && String(date).trim()) {
    filter.registrationTime = { $regex: `^${String(date).trim()}` };
  }

  if (referredByCode !== undefined && String(referredByCode).trim()) {
    filter.referredByCode = String(referredByCode).trim();
  }

  const USER_TYPE_MAP = {
    'Test User': 'Test User',
    'Agent User': 'Proxy User',
    'Official User': 'Regular User',
  };
  if (userType && USER_TYPE_MAP[userType]) {
    filter.userType = USER_TYPE_MAP[userType];
  }

  if (status === 'Enabled' || status === 'Disabled') {
    filter.status = status;
  }

  const members = await Member.find(filter).sort({ createdAt: -1 });

  // Wallet information ke totals (sirf listed members ke liye)
  const memberIds = members.map((m) => m.memberId);
  const byMember = { $in: memberIds };

  const [frozenMap, depositMap, withdrawMap, commissionMap] = await Promise.all([
    // Frozen funds = pending withdrawal requests (admin approval tak)
    sumByMemberId(WithdrawalOrder, { state: 'Pending', memberId: byMember }, 'withdrawalAmount'),
    // Total deposit = approved recharge orders
    sumByMemberId(RechargeOrder, { state: 'Approved', memberId: byMember }, 'rechargeAmount'),
    // Total withdraw = approved withdrawal orders
    sumByMemberId(WithdrawalOrder, { state: 'Approved', memberId: byMember }, 'withdrawalAmount'),
    // Total commission = completed orders se banay commission
    sumByMemberId(
      Order,
      { transactionStatus: 'Complete payment', memberId: byMember },
      'commission'
    ),
  ]);

  const data = members.map((m) => {
    const obj = m.toObject();
    obj.frozenFunds = frozenMap.get(m.memberId) || 0;
    obj.totalDeposits = depositMap.get(m.memberId) || 0;
    obj.totalWithdrawals = withdrawMap.get(m.memberId) || 0;
    obj.totalCommissions = commissionMap.get(m.memberId) || 0;
    return obj;
  });

  res.status(200).json(new ApiResponse(200, 'Members fetched successfully', data));
});

export const createMember = asyncHandler(async (req, res, next) => {
  const {
    phoneNumber,
    nickname,
    creditScore,
    loginPassword,
    withdrawPassword,
    vipLevel,
    superiorId,
    todaySalaryPendingPayment,
  } = req.body;

  const missing = [];
  if (phoneNumber === undefined || phoneNumber === null || !String(phoneNumber).trim())
    missing.push('Phone Number');
  if (nickname === undefined || nickname === null || !String(nickname).trim())
    missing.push('Nickname');
  if (creditScore === undefined || creditScore === null || String(creditScore).trim() === '')
    missing.push('Credit Score');
  if (!loginPassword) missing.push('Login Password');
  if (!withdrawPassword) missing.push('Withdraw Password');
  if (!vipLevel) missing.push('VIP Level');
  if (superiorId === undefined || superiorId === null || String(superiorId).trim() === '')
    missing.push('Superior Id');
  if (
    todaySalaryPendingPayment === undefined ||
    todaySalaryPendingPayment === null ||
    String(todaySalaryPendingPayment).trim() === ''
  )
    missing.push('Today Salary Pending Payment');

  if (missing.length > 0) {
    return next(
      new ApiError(400, `Required fields are missing: ${missing.join(', ')}`, missing)
    );
  }

  if (String(loginPassword).trim().length < 6) {
    return next(new ApiError(400, 'Login password must be at least 6 characters'));
  }
  if (String(withdrawPassword).trim().length < 6) {
    return next(new ApiError(400, 'Withdraw password must be at least 6 characters'));
  }

  const credit = Number(creditScore);
  if (!Number.isFinite(credit)) {
    return next(new ApiError(400, 'Credit score must be a valid number'));
  }
  const salary = Number(todaySalaryPendingPayment);
  if (!Number.isFinite(salary)) {
    return next(new ApiError(400, 'Today salary pending payment must be a valid number'));
  }
  if (credit < 0) {
    return next(new ApiError(400, 'Credit score cannot be negative'));
  }
  if (salary < 0) {
    return next(new ApiError(400, 'Today salary pending payment cannot be negative'));
  }

  const phone = String(phoneNumber).trim();
  const nick = String(nickname).trim();

  const duplicate = await Member.findOne({
    $or: [{ phoneNumber: phone }, { nickname: nick }],
  });
  if (duplicate) {
    const field =
      duplicate.phoneNumber === phone ? 'Phone Number' : 'Nickname';
    return next(new ApiError(409, `${field} already exists`, [field]));
  }

  const seq = await Counter.next('memberId');
  const memberId = String(seq).padStart(4, '0');
  const invitationCode = await generateInvitationCode();
  const registrationTime = formatDateTime(new Date());

  const member = await Member.create({
    memberId,
    phoneNumber: phone,
    nickname: nick,
    creditScore: credit,
    loginPassword,
    securityPin: String(withdrawPassword).trim(),
    vipLevel: String(vipLevel).trim(),
    superiorId: String(superiorId).trim(),
    todaySalaryPendingPayment: salary,
    taskStatus: 0,
    taskStatusDate: todayKey(),
    invitationCode,
    registrationTime,
  });

  res
    .status(201)
    .json(new ApiResponse(201, 'Member created successfully', toPublicMember(member)));
});

export const deleteMember = asyncHandler(async (req, res, next) => {
  const member = await Member.findById(req.params.id);
  if (!member) return next(new ApiError(404, 'Member not found'));

  await member.deleteOne();
  res.status(200).json(new ApiResponse(200, 'Member deleted successfully'));
});

const parseProfile = (body) => {
  const { phoneNumber, nickname, creditScore, vipLevel, superiorId, todaySalaryPendingPayment } =
    body;

  const missing = [];
  if (phoneNumber === undefined || phoneNumber === null || !String(phoneNumber).trim())
    missing.push('Phone Number');
  if (nickname === undefined || nickname === null || !String(nickname).trim())
    missing.push('Nickname');
  if (creditScore === undefined || creditScore === null || String(creditScore).trim() === '')
    missing.push('Credit Score');
  if (!vipLevel) missing.push('VIP Level');
  if (superiorId === undefined || superiorId === null || String(superiorId).trim() === '')
    missing.push('Superior Id');
  if (
    todaySalaryPendingPayment === undefined ||
    todaySalaryPendingPayment === null ||
    String(todaySalaryPendingPayment).trim() === ''
  )
    missing.push('Today Salary Pending Payment');

  if (missing.length > 0) {
    return { error: new ApiError(400, `Required fields are missing: ${missing.join(', ')}`, missing) };
  }

  const credit = Number(creditScore);
  if (!Number.isFinite(credit) || credit < 0) {
    return { error: new ApiError(400, 'Credit score must be a non-negative number') };
  }
  const salary = Number(todaySalaryPendingPayment);
  if (!Number.isFinite(salary) || salary < 0) {
    return { error: new ApiError(400, 'Today salary pending payment must be a non-negative number') };
  }

  return {
    value: {
      phoneNumber: String(phoneNumber).trim(),
      nickname: String(nickname).trim(),
      creditScore: credit,
      vipLevel: String(vipLevel).trim(),
      superiorId: String(superiorId).trim(),
      todaySalaryPendingPayment: salary,
    },
  };
};

export const updateMember = asyncHandler(async (req, res, next) => {
  const member = await Member.findById(req.params.id);
  if (!member) return next(new ApiError(404, 'Member not found'));

  const parsed = parseProfile(req.body);
  if (parsed.error) return next(parsed.error);

  const duplicate = await Member.findOne({
    _id: { $ne: member._id },
    $or: [
      { phoneNumber: parsed.value.phoneNumber },
      { nickname: parsed.value.nickname },
    ],
  });
  if (duplicate) {
    const field =
      duplicate.phoneNumber === parsed.value.phoneNumber ? 'Phone Number' : 'Nickname';
    return next(new ApiError(409, `${field} already exists`, [field]));
  }

  Object.assign(member, parsed.value);
  await member.save();

  res.status(200).json(new ApiResponse(200, 'Member updated successfully', toPublicMember(member)));
});

export const adjustBalance = asyncHandler(async (req, res, next) => {
  const member = await Member.findById(req.params.id);
  if (!member) return next(new ApiError(404, 'Member not found'));

  const { amount, action } = req.body;

  if (action !== 'add' && action !== 'deduct') {
    return next(new ApiError(400, 'Action must be either "add" or "deduct"'));
  }

  const value = Number(amount);
  if (amount === undefined || amount === null || String(amount).trim() === '') {
    return next(new ApiError(400, 'Amount is required'));
  }
  if (!Number.isFinite(value)) {
    return next(new ApiError(400, 'Amount must be a valid number'));
  }
  if (value < 0) {
    return next(new ApiError(400, 'Amount cannot be negative'));
  }
  if (action === 'deduct' && value > member.availableFunds) {
    return next(new ApiError(400, 'Insufficient available funds'));
  }

  const before = Number(member.availableFunds) || 0;
  const after =
    Math.round((action === 'add' ? before + value : before - value) * 100) / 100;

  member.availableFunds = after;
  await member.save();

  await logWalletTransaction({
    member,
    before,
    after,
    description: action === 'add' ? 'Balance adjustment (add)' : 'Balance adjustment (deduct)',
  });

  res.status(200).json(
    new ApiResponse(200, 'Balance adjusted successfully', toPublicMember(member))
  );
});

export const updateCommission = asyncHandler(async (req, res, next) => {
  const member = await Member.findById(req.params.id);
  if (!member) return next(new ApiError(404, 'Member not found'));

  const { totalCommissions } = req.body;
  if (totalCommissions === undefined || totalCommissions === null || String(totalCommissions).trim() === '') {
    return next(new ApiError(400, 'Commission is required'));
  }
  const value = Number(totalCommissions);
  if (!Number.isFinite(value) || value < 0) {
    return next(new ApiError(400, 'Commission must be a non-negative number'));
  }

  member.totalCommissions = Math.round(value * 100) / 100;
  await member.save();

  res.status(200).json(
    new ApiResponse(200, 'Commission updated successfully', toPublicMember(member))
  );
});

export const updateMemberPasswords = asyncHandler(async (req, res, next) => {
  const member = await Member.findById(req.params.id).select('+loginPassword +securityPin');
  if (!member) return next(new ApiError(404, 'Member not found'));

  const { loginPassword, withdrawPassword } = req.body;
  const hasLogin = loginPassword !== undefined && String(loginPassword) !== '';
  const hasWithdraw = withdrawPassword !== undefined && String(withdrawPassword) !== '';

  if (!hasLogin && !hasWithdraw) {
    return next(
      new ApiError(400, 'Provide Login Password or Withdraw Password to change')
    );
  }
  if (hasLogin && String(loginPassword).length < 6) {
    return next(new ApiError(400, 'Login password must be at least 6 characters'));
  }
  if (hasWithdraw && String(withdrawPassword).length < 6) {
    return next(new ApiError(400, 'Withdraw password must be at least 6 characters'));
  }

  if (hasLogin) member.loginPassword = loginPassword;
  if (hasWithdraw) member.securityPin = String(withdrawPassword).trim();
  await member.save();

  res
    .status(200)
    .json(new ApiResponse(200, 'Password updated successfully', toPublicMember(member)));
});

const STATE_FIELDS = {
  status: ['Enabled', 'Disabled'],
  transactions: ['Enabled', 'Disabled'],
  userType: ['Regular User', 'Test User', 'Proxy User'],
};

export const updateMemberState = asyncHandler(async (req, res, next) => {
  const member = await Member.findById(req.params.id);
  if (!member) return next(new ApiError(404, 'Member not found'));

  const updates = {};
  for (const [field, allowed] of Object.entries(STATE_FIELDS)) {
    if (req.body[field] !== undefined) {
      if (!allowed.includes(req.body[field])) {
        return next(
          new ApiError(400, `Invalid value for ${field}. Allowed: ${allowed.join(', ')}`)
        );
      }
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return next(new ApiError(400, 'No valid field to update'));
  }

  Object.assign(member, updates);
  await member.save();

  res.status(200).json(new ApiResponse(200, 'Member updated successfully', toPublicMember(member)));
});
