const express = require('express');
const Stripe = require('stripe');
const router = express.Router();

// Initialize Stripe only if a key is provided to avoid startup crashes in dev
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2024-06-20' }) : null;

// Middleware to short-circuit routes when Stripe is not configured
router.use((req, res, next) => {
  if (!stripe) return res.status(501).json({ error: 'Stripe not configured' });
  return next();
});

router.post('/checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1
        }
      ],
      success_url: `${process.env.PUBLIC_URL || 'http://localhost:8080'}/dashboard?success=1`,
      cancel_url: `${process.env.PUBLIC_URL || 'http://localhost:8080'}/dashboard?canceled=1`,
      customer_email: req.user?.email || undefined
    });
    res.json({ id: session.id, url: session.url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Stripe error' });
  }
});

module.exports = router;
