import express from 'express';
import bodyparser from 'body-parser';
import { generateToken, validateToken } from '../lib/token';

const tokenRouter = express.Router();

tokenRouter.get("/generate-token", (req, res) => {
  const token = generateToken();

  return res.json({
    token: token.value,
    expiry: token.expiry,
    expiryType: 'ms'
  })
});

tokenRouter.post('/validate-token', bodyparser.json(), (req, res) => {
  const token = req.body?.token as string;

  if (!token || token.length <= 50 || !token.includes('$')) {
    return res.status(400).send('Invalid token');
  }
  
  const validatedToken = validateToken(token);

  if (!validatedToken.valid) {
    return res.status(400).send('Invalid or expired token');
  }

  return res.json(validatedToken);
});

export default tokenRouter;