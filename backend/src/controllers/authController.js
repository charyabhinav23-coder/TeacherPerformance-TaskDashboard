const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const generateToken = require('../utils/generateToken');
const { sendMail } = require('../utils/mailer');
const { logAudit } = require('../utils/audit');
const logger = require('../utils/logger');

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please enter email and password' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        teacher: { include: { classroom: true } },
        parent: { include: { students: { include: { classroom: true } } } }
      }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Soft delete check
    if (user.deletedAt || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User account is deactivated' });
    }

    // Email verification check removed as per user request

    // Account lockout check
    if (user.lockoutUntil && new Date() < user.lockoutUntil) {
      const minutesLeft = Math.ceil((new Date(user.lockoutUntil) - new Date()) / 60000);
      return res.status(403).json({ success: false, message: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${minutesLeft} minutes.` });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      // Increment failed attempts
      const newAttempts = user.failedLoginAttempts + 1;
      const updates = { failedLoginAttempts: newAttempts };

      if (newAttempts >= 5) {
        updates.lockoutUntil = new Date(Date.now() + 15 * 60000); // 15 mins
        logAudit({
          userId: user.id,
          role: user.role,
          action: 'ACCOUNT_LOCKED',
          module: 'Auth',
          recordId: user.id,
          ipAddress: req.ip
        });
        
        // Send lockout email async
        sendMail(user.email, 'Account Locked - FirstCry Intellitots', '<p>Your account has been temporarily locked due to 5 consecutive failed login attempts. If this was not you, please contact the administrator immediately or reset your password.</p>').catch(e => logger.error(`Failed to send lockout email to ${user.email}`, e));
      }

      await prisma.user.update({ where: { id: user.id }, data: updates });

      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Successful login - reset counters
    if (user.failedLoginAttempts > 0 || user.lockoutUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockoutUntil: null }
      });
    }

    const token = generateToken(user.id);

    // Track session
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
        userAgent: req.get('User-Agent') || 'Unknown',
        ipAddress: req.ip,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    });

    logAudit({
      userId: user.id,
      role: user.role,
      action: 'LOGIN_SUCCESS',
      module: 'Auth',
      recordId: user.id,
      ipAddress: req.ip
    });

    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      teacher: user.teacher,
      parent: user.parent
    };

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { token, user: userResponse }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // Always return success to prevent email enumeration
    res.status(200).json({ success: true, message: 'If an account exists, a password reset email has been sent.' });

    if (!user || user.deletedAt || !user.isActive) return;

    // Generate Token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 15 * 60000), // 15 mins
        createdIp: req.ip
      }
    });

    logAudit({
      userId: user.id,
      role: user.role,
      action: 'PASSWORD_RESET_REQUESTED',
      module: 'Auth',
      recordId: user.id,
      ipAddress: req.ip
    });

    // Send email
    // In production, the URL would be FRONTEND_URL/reset-password?token=XYZ&email=user@email.com
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Reset Your FirstCry Intellitots Password</h2>
        <p>Hello ${user.name},</p>
        <p>We received a request to reset your password. Click the button below to create a new password.</p>
        <a href="${resetUrl}" style="background-color: #8b5cf6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
        <p>This link expires in 15 minutes.</p>
        <p>If you did not request this change, please ignore this email or contact your administrator if you suspect unauthorized activity.</p>
        <hr/>
        <p style="font-size: 12px; color: #888;">FirstCry Intellitots Administration</p>
      </div>
    `;

    await sendMail(user.email, 'Password Reset Request', emailHtml);

  } catch (error) {
    next(error);
  }
};

// @desc    Verify Email
// @route   GET /api/auth/verify-email
// @access  Public
const verifyEmail = async (req, res, next) => {
  try {
    const { token, email } = req.query;
    if (!token || !email) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }
    if (user.isEmailVerified) {
      return res.status(200).json({ success: true, message: 'Email is already verified' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenRecord = await prisma.emailVerificationToken.findFirst({
      where: {
        userId: user.id,
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() }
      }
    });

    if (!tokenRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification token' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true }
    });

    await prisma.emailVerificationToken.update({
      where: { id: tokenRecord.id },
      data: { usedAt: new Date() }
    });

    logAudit({
      userId: user.id,
      role: user.role,
      action: 'EMAIL_VERIFIED',
      module: 'Auth',
      recordId: user.id,
      ipAddress: req.ip
    });

    res.status(200).json({ success: true, message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Reset Token
// @route   GET /api/auth/verify-reset-token
// @access  Public
const verifyResetToken = async (req, res, next) => {
  try {
    const { email, token } = req.query;
    if (!email || !token) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() }
      }
    });

    if (!tokenRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    res.status(200).json({ success: true, message: 'Token is valid' });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res, next) => {
  try {
    const { email, token, password } = req.body;
    
    if (!email || !token || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Password strength check
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!strongPasswordRegex.test(password)) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() }
      }
    });

    if (!tokenRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    // Hash new password and update user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, failedLoginAttempts: 0, lockoutUntil: null }
    });

    // Invalidate token
    await prisma.passwordResetToken.update({
      where: { id: tokenRecord.id },
      data: { usedAt: new Date() }
    });

    // Revoke all existing sessions
    await prisma.session.deleteMany({ where: { userId: user.id } });

    logAudit({
      userId: user.id,
      role: user.role,
      action: 'PASSWORD_RESET_COMPLETED',
      module: 'Auth',
      recordId: user.id,
      ipAddress: req.ip
    });

    res.status(200).json({ success: true, message: 'Password updated successfully.' });

    // Send confirmation email asynchronously
    sendMail(user.email, 'Password Changed Successfully', '<p>Your password has been successfully reset. If this was not you, please contact the administrator immediately.</p>').catch(e => logger.error(`Failed to send password confirmation email to ${user.email}`, e));

  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getUserProfile = async (req, res, next) => {
  try {
    const userResponse = {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      phone: req.user.phone,
      teacher: req.user.teacher,
      parent: req.user.parent
    };
    res.status(200).json({ success: true, data: { user: userResponse } });
  } catch (error) {
    next(error);
  }
};

// @desc    Update current user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { name: name.trim(), phone: phone ? phone.trim() : null },
      include: {
        teacher: { include: { classroom: true } },
        parent: { include: { students: { include: { classroom: true } } } }
      }
    });

    logAudit({
      userId: req.user.id,
      role: req.user.role,
      action: 'PROFILE_UPDATED',
      module: 'Auth',
      recordId: req.user.id,
      newValues: { name: updatedUser.name, phone: updatedUser.phone },
      ipAddress: req.ip
    });

    const userResponse = {
      id: updatedUser.id, email: updatedUser.email, name: updatedUser.name,
      role: updatedUser.role, phone: updatedUser.phone, teacher: updatedUser.teacher, parent: updatedUser.parent
    };

    res.status(200).json({ success: true, message: 'Profile updated successfully', data: { user: userResponse } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  loginUser,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  verifyEmail,
  getUserProfile,
  updateUserProfile
};
