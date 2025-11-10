const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { getUserById, getUserByEmail } = require('../services/users');
const { pool } = require('../db/pool');
require('dotenv').config();

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await getUserById(id);
    done(null, user);
  } catch (e) {
    done(e);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_REDIRECT_URI || '/auth/google/callback'
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails && profile.emails[0] && profile.emails[0].value;
        let user = null;
        // Try by google id first
        const byGoogle = await pool.query('SELECT id, email, role, google_id AS "googleId", created_at FROM users WHERE google_id = $1', [profile.id]);
        if (byGoogle.rows[0]) {
          user = byGoogle.rows[0];
        } else if (email) {
          // Try by email
          const existing = await getUserByEmail(email);
          if (existing) {
            // Attach google id if missing
            if (!existing.googleId) {
              await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [profile.id, existing.id]);
              existing.googleId = profile.id;
            }
            user = existing;
          }
        }
        if (!user) {
          // No account found, reject without creating
          return done(null, false, { message: 'NO_ACCOUNT' });
        }
        return done(null, user);
      } catch (e) {
        return done(e);
      }
    }
  )
);
