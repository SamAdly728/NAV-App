const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { findOrCreateUser, getUserById } = require('../services/users');
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
        const user = await findOrCreateUser({ googleId: profile.id, email });
        done(null, user);
      } catch (e) {
        done(e);
      }
    }
  )
);
