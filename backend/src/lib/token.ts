import { GenerateTokenRequest } from "../schemas/token";
import { hashString } from "./hash";


export function generateToken(request: GenerateTokenRequest) {
  const expiry = Math.round(Date.now()) + (1000 * 60 * 10);

  let matchKey = request.matchType + "_" + request.region + "_" + request.skillRange;
  matchKey = Buffer.from(matchKey, 'utf8').toString('base64').replaceAll('=', '');
  
  const tokenData = JSON.stringify({
    userId: Math.round(Math.random() * 100_00),
    expiry,
    matchKey
  });
  const token = Buffer.from(tokenData, 'utf8').toString('hex');
  const hash = hashString(token);

  const finalToken = token.length + '$' + token + hash
  return {
    value: finalToken,
    expiry,
    matchKey
  }
}

export function validateToken(token: string) {
  const delimeter = token.indexOf('$');
  const tokenLength = parseInt(token.substring(0, delimeter));
  const actualToken = token.substring(delimeter + 1, tokenLength + delimeter + 1);
  const hashFromToken = token.substring(delimeter + 1 + tokenLength);
  const originalHash = hashString(actualToken);
  const valid = hashFromToken == originalHash;
  const tokenData = JSON.parse(Buffer.from(actualToken, 'hex').toString('utf-8'));
  return {
    valid: valid || tokenData.expiry < Date.now(),
    actualToken,
    tokenData
  };
}