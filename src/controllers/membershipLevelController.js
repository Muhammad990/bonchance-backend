import MembershipLevel from '../models/MembershipLevel.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const pad = (n) => String(n).padStart(2, '0');

export const formatDateTime = (d = new Date()) => {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const STRING_FIELDS = [
  'dailyOrderVolume',
  'taskWheel',
  'limitAmount',
  'lowestPriceOfGoods',
  'highestPriceOfGoods',
  'upgradeRewards',
  'price',
  'minWithdrawalAmount',
  'maxWithdrawalAmount',
  'withdrawalFeeRate',
  'withdrawalLimitCount',
  'orderCommissionRate',
  'gradeSalary',
];

export const getMembershipLevels = asyncHandler(async (req, res, next) => {
  const levels = await MembershipLevel.find().sort({ grade: 1 });
  res
    .status(200)
    .json(new ApiResponse(200, 'Membership levels fetched successfully', levels));
});

export const createMembershipLevel = asyncHandler(async (req, res, next) => {
  const { name, picture } = req.body;

  if (!name || !String(name).trim()) {
    return next(new ApiError(400, 'Name is required'));
  }

  const lastLevel = await MembershipLevel.findOne().sort({ grade: -1 });
  const nextGrade = lastLevel ? lastLevel.grade + 1 : 1;

  const data = {
    grade: nextGrade,
    name: String(name).trim(),
    picture: picture || '',
    creationTime: formatDateTime(new Date()),
  };
  for (const field of STRING_FIELDS) {
    data[field] = req.body[field] !== undefined ? String(req.body[field]).trim() : '';
  }

  const level = await MembershipLevel.create(data);

  res.status(201).json(new ApiResponse(201, 'Membership level created successfully', level));
});

export const updateMembershipLevel = asyncHandler(async (req, res, next) => {
  const level = await MembershipLevel.findById(req.params.id);
  if (!level) return next(new ApiError(404, 'Membership level not found'));

  if (req.body.name !== undefined) level.name = String(req.body.name).trim();
  if (req.body.picture !== undefined) level.picture = req.body.picture;

  for (const field of STRING_FIELDS) {
    if (req.body[field] !== undefined) {
      level[field] = String(req.body[field]).trim();
    }
  }

  await level.save();
  res.status(200).json(new ApiResponse(200, 'Membership level updated successfully', level));
});

export const deleteMembershipLevel = asyncHandler(async (req, res, next) => {
  const level = await MembershipLevel.findById(req.params.id);
  if (!level) return next(new ApiError(404, 'Membership level not found'));

  await level.deleteOne();
  res.status(200).json(new ApiResponse(200, 'Membership level deleted successfully'));
});