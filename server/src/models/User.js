const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['admin', 'resident', 'maintenance', 'owner'];

// NFR-03: passwords are stored as bcrypt hashes with a cost factor of at least 12.
// BCRYPT_ROUNDS can raise the cost, but never lower it below 12.
const MIN_SALT_ROUNDS = 12;
const SALT_ROUNDS = Math.max(MIN_SALT_ROUNDS, Number(process.env.BCRYPT_ROUNDS) || MIN_SALT_ROUNDS);

/**
 * A person who can log in (FR-02). The role decides what they can access (FR-14).
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name can be at most 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, 'Enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      // bcrypt only uses the first 72 bytes of a password
      maxlength: [72, 'Password can be at most 72 characters'],
      select: false, // never returned by queries unless asked for with .select('+password')
    },
    role: {
      type: String,
      enum: { values: ROLES, message: `Role must be one of: ${ROLES.join(', ')}` },
      default: 'resident',
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Hash the password whenever it is set or changed (NFR-03).
// Note: this runs on save()/create() only, so always change passwords with save(), not updateOne().
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

/**
 * Checks a plain-text password against the stored hash.
 * The user must have been loaded with .select('+password').
 */
userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.statics.ROLES = ROLES;
userSchema.statics.SALT_ROUNDS = SALT_ROUNDS;

module.exports = mongoose.model('User', userSchema);
