import validator from 'validator';

export const validate = (rules) => (req, res, next) => {
  const errors = [];

  for (const [field, checks] of Object.entries(rules)) {
    const value = req.body[field];

    if (checks.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }

    if (value === undefined || value === null || value === '') continue;

    if (checks.isEmail && !validator.isEmail(String(value))) {
      errors.push(`${field} must be a valid email`);
    }

    if (checks.minLength && !validator.isLength(String(value), { min: checks.minLength })) {
      errors.push(`${field} must be at least ${checks.minLength} characters`);
    }

    if (checks.maxLength && !validator.isLength(String(value), { max: checks.maxLength })) {
      errors.push(`${field} must be at most ${checks.maxLength} characters`);
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Validation failed', details: errors });
  }

  next();
};