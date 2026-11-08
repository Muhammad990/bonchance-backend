import User from '../models/User.js';
import Admin from '../models/Admin.js';
import Member from '../models/Member.js';
import Counter from '../models/Counter.js';
import MembershipLevel from '../models/MembershipLevel.js';
import WithdrawalOrder from '../models/WithdrawalOrder.js';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateToken } from '../utils/generateToken.js';
import { getLevelLimits } from '../utils/membershipLevelHelper.js';
import { syncDailyCounters, syncDailyCountersAsync, todayKey } from '../utils/dailyCounterHelper.js';

export const register = asyncHandler(async (req, res, next) => {
  const { name, email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new ApiError(409, 'User with this email already exists'));
  }

  const user = await User.create({ name, email, password });

  res.status(201).json(
    new ApiResponse(201, 'User registered successfully', {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    })
  );
});

export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    return next(new ApiError(401, 'Invalid email or password'));
  }

  res.status(200).json(
    new ApiResponse(200, 'Login successful', {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    })
  );
});

export const adminLogin = asyncHandler(async (req, res, next) => {
  const username = (req.body.username || '').trim().toLowerCase();
  const password = req.body.password || '';

  const admin = await Admin.findOne({ username }).select('+password');
  if (!admin || !(await admin.matchPassword(password))) {
    return next(new ApiError(401, 'Invalid username or password'));
  }

  res.status(200).json(
    new ApiResponse(200, 'Login successful', {
      _id: admin._id,
      username: admin.username,
      role: admin.role,
      token: generateToken(admin._id),
    })
  );
});

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

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

const setAuthCookie = (res, token) => {
  res.setHeader(
    'Set-Cookie',
    `token=${token}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`
  );
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

const normalizeIp = (ip) => {
  if (!ip) return '';
  let value = String(ip);
  if (value.startsWith('::ffff:')) value = value.replace('::ffff:', '');
  if (value === '::1') value = '127.0.0.1';
  return value;
};

const isLoopback = (ip) => !ip || ip === '127.0.0.1' || ip === 'localhost' || ip === '::1';

const getClientIp = (req) => {
  const forwarded = (req.headers['x-forwarded-for'] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (forwarded.length > 0) return normalizeIp(forwarded[0]);
  return normalizeIp(req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : req.ip);
};

const getPublicIp = async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    if (!res.ok) return '';
    const json = await res.json();
    return json && json.ip ? normalizeIp(json.ip) : '';
  } catch (err) {
    return '';
  } finally {
    clearTimeout(timer);
  }
};

const getDisplayIp = async (req) => {
  const direct = getClientIp(req);
  if (isLoopback(direct)) {
    const publicIp = await getPublicIp();
    if (publicIp) return publicIp;
  }
  return direct || '-';
};

const publicMember = (member) => {
  const data = member.toObject ? member.toObject() : { ...member };
  delete data.loginPassword;
  delete data.securityPin;
  return data;
};

export const appRegister = asyncHandler(async (req, res, next) => {
  const { nickname, username, password, confirmPassword, securityPin, invitationCode } =
    req.body;

  const missing = [];
  if (nickname === undefined || nickname === null || !String(nickname).trim())
    missing.push('Nickname');
  if (username === undefined || username === null || !String(username).trim())
    missing.push('Username or Phone');
  if (!password) missing.push('Login password');
  if (!confirmPassword) missing.push('Confirm login password');
  if (!securityPin || !String(securityPin).trim()) missing.push('Security pin');

  if (missing.length > 0) {
    return next(
      new ApiError(400, `Required fields are missing: ${missing.join(', ')}`, missing)
    );
  }

  if (String(password).length < 6) {
    return next(new ApiError(400, 'Login password must be at least 6 characters'));
  }
  if (String(password) !== String(confirmPassword)) {
    return next(new ApiError(400, 'Passwords do not match'));
  }
  if (String(securityPin).trim().length < 4) {
    return next(new ApiError(400, 'Security pin must be at least 4 characters'));
  }

  const phone = String(username).trim();
  const nick = String(nickname).trim();

  const duplicate = await Member.findOne({
    $or: [{ phoneNumber: phone }, { nickname: nick }],
  });
  if (duplicate) {
    const field = duplicate.phoneNumber === phone ? 'Username or Phone' : 'Nickname';
    return next(new ApiError(409, `${field} already exists`, [field]));
  }

  const seq = await Counter.next('memberId');
  const memberId = String(seq).padStart(4, '0');
  const ownInvitationCode = await generateInvitationCode();
  const firstLevel = await MembershipLevel.findOne().sort({ grade: 1 });

  const member = await Member.create({
    memberId,
    phoneNumber: phone,
    nickname: nick,
    creditScore: 100,
    loginPassword: String(password),
    securityPin: String(securityPin).trim(),
    vipLevel: firstLevel ? firstLevel.name : 'VIP1',
    superiorId: '5983',
    todaySalaryPendingPayment: 0,
    taskStatus: 0,
    taskStatusDate: todayKey(),
    invitationCode: ownInvitationCode,
    referredByCode:
      invitationCode !== undefined && invitationCode !== null
        ? String(invitationCode).trim()
        : '',
    registrationTime: formatDateTime(new Date()),
  });

  const token = generateToken(member._id);
  setAuthCookie(res, token);

  res.status(201).json(
    new ApiResponse(201, 'Registration successful', {
      token,
      member: publicMember(member),
    })
  );
});

export const appLogin = asyncHandler(async (req, res, next) => {
  const identifier = String(req.body.identifier || '').trim();
  const password = String(req.body.password || '');

  if (!identifier || !password) {
    return next(new ApiError(400, 'Username or Phone and password are required'));
  }

  const member = await Member.findOne({
    $or: [{ phoneNumber: identifier }, { nickname: identifier }],
  }).select('+loginPassword');

  if (!member || !(await member.matchLoginPassword(password))) {
    return next(new ApiError(401, 'Invalid username or password'));
  }

  if (member.status === 'Disabled') {
    return next(new ApiError(403, 'Your Account is Disabled'));
  }

  member.lastLoginTime = formatDateTime(new Date());
  member.lastLoginIp = await getDisplayIp(req);
  await member.save();

  const token = generateToken(member._id);
  setAuthCookie(res, token);

  res.status(200).json(
    new ApiResponse(200, 'Login successful', {
      token,
      member: publicMember(member),
    })
  );
});

export const getMe = asyncHandler(async (req, res, next) => {
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

  await syncDailyCountersAsync(member);
  if (member.isModified('taskStatusDate') || member.isModified('taskStatus') || member.isModified('todayProfit')) {
    await member.save();
  }

  const data = publicMember(member);
  const level = await MembershipLevel.findOne({ name: member.vipLevel }).lean();
  if (level && level.dailyOrderVolume) {
    data.dailyOrderVolume = level.dailyOrderVolume;
  }
  data.vipLimits = await getLevelLimits(member.vipLevel);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  data.withdrawalCountToday = await WithdrawalOrder.countDocuments({
    memberId: member.memberId,
    state: { $nin: ['Rejected'] },
    createdAt: { $gte: todayStart },
  });

  res
    .status(200)
    .json(new ApiResponse(200, 'Session fetched', { member: data }));
});

export const changePassword = asyncHandler(async (req, res, next) => {
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

  const { type, oldPassword, newPassword } = req.body;

  if (type !== 'login' && type !== 'withdraw') {
    return next(new ApiError(400, 'Invalid password type'));
  }
  if (!oldPassword || !newPassword) {
    return next(new ApiError(400, 'Old password and new password are required'));
  }
  if (String(newPassword).length < 6) {
    return next(new ApiError(400, 'New password must be at least 6 characters'));
  }
  if (String(oldPassword) === String(newPassword)) {
    return next(new ApiError(400, 'New password must be different from the old password'));
  }

  const member = await Member.findById(decoded.id).select('+loginPassword +securityPin');
  if (!member) {
    return next(new ApiError(401, 'Not authorized, user not found'));
  }

  if (type === 'login') {
    if (!(await member.matchLoginPassword(oldPassword))) {
      return next(new ApiError(400, 'Old login password is incorrect'));
    }
    member.loginPassword = String(newPassword);
  } else {
    if (!member.securityPin || !(await member.matchSecurityPin(oldPassword))) {
      return next(new ApiError(400, 'Old pin is incorrect'));
    }
    member.securityPin = String(newPassword);
  }

  await member.save();

  res.status(200).json(
    new ApiResponse(
      200,
      type === 'login' ? 'Login password updated successfully' : 'Security pin updated successfully',
      { member: publicMember(member) }
    )
  );
});

export const adminChangePassword = asyncHandler(async (req, res, next) => {
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

  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return next(new ApiError(400, 'Old password and new password are required'));
  }
  if (String(newPassword).length < 6) {
    return next(new ApiError(400, 'New password must be at least 6 characters'));
  }
  if (String(oldPassword) === String(newPassword)) {
    return next(new ApiError(400, 'New password must be different from the old password'));
  }

  const admin = await Admin.findById(decoded.id).select('+password');
  if (!admin) {
    return next(new ApiError(401, 'Not authorized, admin not found'));
  }

  if (!(await admin.matchPassword(String(oldPassword)))) {
    return next(new ApiError(400, 'Old password is incorrect'));
  }

  admin.password = String(newPassword);
  await admin.save();

  res.status(200).json(
    new ApiResponse(200, 'Password updated successfully', { username: admin.username })
  );
});

export const adminChangeUsername = asyncHandler(async (req, res, next) => {
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

  const newUsername = String(req.body.newUsername || '').trim().toLowerCase();

  if (!newUsername) {
    return next(new ApiError(400, 'New username is required'));
  }
  if (newUsername.length > 50) {
    return next(new ApiError(400, 'Username cannot exceed 50 characters'));
  }

  const admin = await Admin.findById(decoded.id);
  if (!admin) {
    return next(new ApiError(401, 'Not authorized, admin not found'));
  }
  if (admin.username === newUsername) {
    return next(new ApiError(400, 'New username must be different from the current username'));
  }
  const duplicate = await Admin.findOne({ username: newUsername });
  if (duplicate) {
    return next(new ApiError(409, 'Username is already in use'));
  }

  admin.username = newUsername;
  await admin.save();

  res.status(200).json(
    new ApiResponse(200, 'Username updated successfully', { username: admin.username })
  );
});

export const markRejectionSeen = asyncHandler(async (req, res, next) => {
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

  member.unseenRejection = false;
  member.rejectionReason = '';
  await member.save();

  res
    .status(200)
    .json(new ApiResponse(200, 'Rejection notification cleared', { member: publicMember(member) }));
});