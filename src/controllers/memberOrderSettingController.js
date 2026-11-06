import Member from '../models/Member.js';
import MemberOrderSetting from '../models/MemberOrderSetting.js';
import MembershipLevel from '../models/MembershipLevel.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const fetchSetting = async (memberId) => MemberOrderSetting.findOne({ memberId });

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

  const level = await MembershipLevel.findOne({ name: member.vipLevel }).lean();
  let commissionRate = Number(level?.orderCommissionRate) || 0;
  if (commissionRate > 1) commissionRate /= 100;

  const products = raw
    .filter((p) => p && p.productId)
    .map((p) => {
      const price = Math.round((Number(p.price) || 0) * 100) / 100;
      const multiplier = Math.max(0, Number(p.multiplier) || 1);
      const baseProfit = price * commissionRate;
      const returnAmount = Math.round(baseProfit * multiplier * 100) / 100;
      return {
        productId: String(p.productId),
        name: String(p.name || '').trim(),
        picture: p.picture || '',
        price,
        rating: Number(p.rating) || 0,
        multiplier,
        returnAmount,
      };
    });

  for (const product of products) {
    if (product.returnAmount > product.price) {
      return next(new ApiError(400, `Return Amount cannot be greater than Product Price for ${product.name || 'product'}`));
    }
  }

  let setting = await fetchSetting(member.memberId);
  if (setting) {
    setting.products = products;
    await setting.save();
  } else {
    setting = await MemberOrderSetting.create({ memberId: member.memberId, products });
  }

  res.status(200).json(new ApiResponse(200, 'Order setting saved successfully', { products: setting.products }));
});

export const resetMemberOrderSetting = asyncHandler(async (req, res, next) => {
  const member = await Member.findById(req.params.id);
  if (!member) return next(new ApiError(404, 'Member not found'));

  await MemberOrderSetting.deleteOne({ memberId: member.memberId });
  res.status(200).json(new ApiResponse(200, 'Order setting reset successfully', { products: [] }));
});