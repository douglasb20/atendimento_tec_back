import { rename, readFile } from 'node:fs';
import { promisify } from 'node:util';
import * as crypto from 'node:crypto';
import * as dotenv from 'dotenv';
import { DataSource, EntityManager } from 'typeorm';

dotenv.config();

const algorithm = 'aes-256-cbc'; //Using AES encryption
const key = Buffer.from(process.env.CRYPTO_KEY, 'hex');

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

export function gerarCodigoSeguro(qtd_chars: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < qtd_chars; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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

export function getExtension(mimeType: string): string {
  return mimeType.split(';')[0].split('/')[1];
}

export function toMMSS(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;

  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function formatFileSize(bytes) {
  const kb = 1024;
  const mb = kb * 1024;
  const gb = mb * 1024;

  if (bytes < kb) {
    return `${bytes} B`;
  } else if (bytes < mb) {
    return `${(bytes / kb).toFixed(2)} KB`;
  } else if (bytes < gb) {
    return `${(bytes / mb).toFixed(2)} MB`;
  } else {
    return `${(bytes / gb).toFixed(2)} GB`;
  }
}

export async function runInTransaction<T>(
  dataSource: DataSource,
  fn: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  const qr = dataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    const result = await fn(qr.manager);
    await qr.commitTransaction();
    return result;
  } catch (e) {
    await qr.rollbackTransaction();
    throw e;
  } finally {
    await qr.release();
  }
}

/**
 * O nome completo a partir das duas colunas.
 *
 * Existe para a concatenação viver num lugar só: `name` e `last_name` são
 * separados no banco desde a migration `1789530000000`, e montar
 * `` `${name} ${last_name}` `` na mão espalharia o tratamento do sobrenome
 * nulo - que é o caso comum, não a exceção (contato de empresa, `pushName` de
 * uma palavra).
 */
export const nomeCompleto = (
  pessoa?: { name?: string | null; last_name?: string | null } | null,
): string => [pessoa?.name, pessoa?.last_name].filter(Boolean).join(' ').trim();

/**
 * Divide um nome livre em primeiro nome + sobrenome, na primeira palavra.
 *
 * ⚠️ É **heurística**, e o principal consumidor é o `pushName` do WhatsApp -
 * texto que o contato escolhe, não nome civil. "Douglas A. Silva" sai certo;
 * "Automatec Sistemas" ganha o sobrenome "Sistemas". Foi decisão de projeto
 * dividir mesmo assim, para o cadastro já nascer separado.
 *
 * Nome de uma palavra devolve `last_name: null`, nunca uma cópia do nome.
 */
export const separaNome = (
  completo?: string | null,
): { name: string; last_name: string | null } => {
  const limpo = (completo ?? '').trim().replace(/\s+/g, ' ');

  if (!limpo) return { name: '', last_name: null };

  const espaco = limpo.indexOf(' ');

  return espaco === -1
    ? { name: limpo, last_name: null }
    : { name: limpo.slice(0, espaco), last_name: limpo.slice(espaco + 1) };
};
