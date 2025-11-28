const express = require('express');
const router = express.Router();

const { fetchDashboardSummary } = require('../services/dashboard');

router.get('/summary', async (req, res, next) => {
  try {
    const data = await fetchDashboardSummary(req.user);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
