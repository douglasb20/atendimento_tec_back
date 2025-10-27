import { rename, readFile } from 'node:fs';
import { promisify } from 'node:util';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

const algorithm = 'aes-256-cbc'; //Using AES encryption
const key = crypto.randomBytes(32);

//Encrypting text
export const encrypt = (text: string) => {
  const cipher = crypto.createCipheriv(
    algorithm,
    Buffer.from(key),
    Buffer.from(process.env.CRYPTO_IV, 'hex'),
  );
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return encrypted.toString('hex');
};

// Decrypting text
export const decrypt = (encryptedData: string) => {
  const iv = Buffer.from(process.env.CRYPTO_IV, 'hex');
  const encryptedText = Buffer.from(encryptedData, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
};

export const move_file = async (oldPath: string, newPath: string) => {
  const mv = promisify(rename);
  await mv(oldPath, newPath);
};

export async function ToBase64(filePath: string) {
  const rf = promisify(readFile);
  const file = await rf(filePath);

  return Buffer.from(file).toString('base64');
}

export const sleep = async (ms: number) =>
  await new Promise((resolve) => setTimeout(resolve, ms * 1000));
