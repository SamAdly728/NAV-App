const express = require('express');
const router = express.Router();
// Placeholder for Dropbox integration
// Later: use official Dropbox SDK @dropbox/dropbox or dropbox-v2-api

router.post('/upload', async (req, res) => {
  // TODO: implement file upload to Dropbox
  res.json({ status: 'pending', message: 'Dropbox upload not implemented yet' });
});

module.exports = router;
