import express, {Request} from 'express';
import bodyparser from 'body-parser';
import { generateToken, validateToken } from '../lib/token';
import { GenerateTokenRequest, generateTokenRequestSchema } from '../schemas/token';
import os from "os";

const serverId = os.hostname();
const tokenRouter = express.Router();

tokenRouter.post("/generate-token", bodyparser.json(), (req: Request<any, any, GenerateTokenRequest>, res) => {
  const parser = generateTokenRequestSchema.safeParse(req.body);
  res.setHeader("X-Server", serverId);
  if (!parser.success) {
    console.log(parser.error);
    return res
    .status(400)
    .json({
      message: "Invalid body"
    });
  }
  const token = generateToken(req.body);
  return res.json({
    token: token.value,
    expiry: token.expiry,
    expiryType: 'ms',
    matchKey: token.matchKey
  })
});

tokenRouter.post('/validate-token', bodyparser.json(), (req, res) => {
  const token = req.body?.token as string;
  res.setHeader("X-Server", serverId);

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