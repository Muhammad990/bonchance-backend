import Product from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const pad = (n) => String(n).padStart(2, '0');

export const formatDateTime = (d = new Date()) => {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const getProducts = asyncHandler(async (req, res, next) => {
  const { name, date } = req.query;
  const filter = {};

  if (name && String(name).trim()) {
    filter.name = { $regex: String(name).trim(), $options: 'i' };
  }

  if (date && String(date).trim()) {
    filter.creationTime = { $regex: `^${String(date).trim()}` };
  }

  const products = await Product.find(filter).sort({ pId: 1 });
  res.status(200).json(new ApiResponse(200, 'Products fetched successfully', products));
});

export const createProduct = asyncHandler(async (req, res, next) => {
  const { name, price, picture, rating } = req.body;

  const lastProduct = await Product.findOne().sort({ pId: -1 });
  const nextId = lastProduct ? lastProduct.pId + 1 : 1;

  const numericRating =
    rating === undefined || rating === null || rating === '' ? 0 : Number(rating);
  if (Number.isNaN(numericRating)) {
    return next(new ApiError(400, 'Rating must be a number'));
  }

  const product = await Product.create({
    pId: nextId,
    name: (name || '').trim(),
    price: (price || '').trim(),
    rating: numericRating,
    picture: picture || '',
    creationTime: formatDateTime(new Date()),
  });

  res.status(201).json(new ApiResponse(201, 'Product created successfully', product));
});

export const updateProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) return next(new ApiError(404, 'Product not found'));

  const { name, price, picture, rating } = req.body;
  if (name !== undefined) product.name = String(name).trim();
  if (price !== undefined) product.price = String(price).trim();
  if (rating !== undefined && rating !== null && rating !== '') {
    const numericRating = Number(rating);
    if (Number.isNaN(numericRating)) {
      return next(new ApiError(400, 'Rating must be a number'));
    }
    product.rating = numericRating;
  }
  if (picture !== undefined) product.picture = picture;

  await product.save();
  res.status(200).json(new ApiResponse(200, 'Product updated successfully', product));
});

export const deleteProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) return next(new ApiError(404, 'Product not found'));

  await product.deleteOne();
  res.status(200).json(new ApiResponse(200, 'Product deleted successfully'));
});