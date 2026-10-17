import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getProfile = asyncHandler(async (req, res, next) => {
  res.status(200).json(new ApiResponse(200, 'Profile fetched successfully', req.user));
});