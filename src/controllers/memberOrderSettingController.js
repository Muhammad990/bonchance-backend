import Member from '../models/Member.js';
import MemberOrderSetting from '../models/MemberOrderSetting.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const fetchSetting = async (memberId) => {
  return MemberOrderSetting.findOne({ memberId });
};

export const getMemberOrderSetting = asyncHandler(async (req, res, next) => {
  const member = await Member.findById(req.params.id);
  if (!member) return next(new ApiError(404, 'Member not found'));

  const setting = await fetchSetting(member.memberId);
  res.status(200).json(
    new ApiResponse(200, 'Order setting fetched', { products: setting ? setting.products : [] })
  );
});

export const saveMemberOrderSetting = asyncHandler(async (req, res, next) => {
  const member = await Member.findById(req.params.id);
  if (!member) return next(new ApiError(404, 'Member not found'));

  const raw = req.body.products;
  if (raw === undefined || !Array.isArray(raw)) {
    return next(new ApiError(400, 'Products must be an array'));
  }

  const products = raw
    .filter((p) => p && p.productId)
    .map((p) => ({
      productId: String(p.productId),
      name: String(p.name || '').trim(),
      picture: p.picture || '',
      price: Math.round((Number(p.price) || 0) * 100) / 100,
      rating: Number(p.rating) || 0,
    }));

  let setting = await fetchSetting(member.memberId);
  if (setting) {
    setting.products = products;
    await setting.save();
  } else {
    setting = await MemberOrderSetting.create({
      memberId: member.memberId,
      products,
    });
  }

  res.status(200).json(new ApiResponse(200, 'Order setting saved successfully', { products: setting.products }));
});

export const resetMemberOrderSetting = asyncHandler(async (req, res, next) => {
  const member = await Member.findById(req.params.id);
  if (!member) return next(new ApiError(404, 'Member not found'));

  await MemberOrderSetting.deleteOne({ memberId: member.memberId });
  res.status(200).json(new ApiResponse(200, 'Order setting reset successfully', { products: [] }));
});