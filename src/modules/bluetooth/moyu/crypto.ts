/** 魔域 WCU_MY32：与 GAN Gen2 相同的 AES-128 加盐方案（Weilong / csTimer）。 */

export const MOYU_ROOT_KEY = Uint8Array.of(
  0x15,
  0x77,
  0x3a,
  0x5c,
  0x67,
  0x0e,
  0x2d,
  0x1f,
  0x17,
  0x67,
  0x2a,
  0x13,
  0x9b,
  0x67,
  0x52,
  0x57,
);

export const MOYU_ROOT_IV = Uint8Array.of(
  0x11,
  0x23,
  0x26,
  0x25,
  0x86,
  0x2a,
  0x2c,
  0x3b,
  0x55,
  0x06,
  0x7f,
  0x31,
  0x7e,
  0x67,
  0x21,
  0x57,
);

const BLOCK = 16;
const ZEROS = new Uint8Array(BLOCK);
const PADDING_PLAIN = new Uint8Array(BLOCK).fill(BLOCK);

export type MoyuKeyIv = { key: Uint8Array; iv: Uint8Array };

/** MAC 为 6 字节正常序；盐为反转后加到 key/iv 前 6 字节（% 255）。 */
export function deriveMoyuKeyIv(mac: Uint8Array): MoyuKeyIv {
  if (mac.length !== 6) {
    throw new Error("MAC 须为 6 字节");
  }
  const key = new Uint8Array(MOYU_ROOT_KEY);
  const iv = new Uint8Array(MOYU_ROOT_IV);
  for (let i = 0; i < 6; i += 1) {
    key[i] = (MOYU_ROOT_KEY[i]! + mac[5 - i]!) % 255;
    iv[i] = (MOYU_ROOT_IV[i]! + mac[5 - i]!) % 255;
  }
  return { key, iv };
}

/** 解析 `AA:BB:…` 或 12 位十六进制为 6 字节。 */
export function parseMacAddress(mac: string): Uint8Array {
  const hex = mac.trim().replace(/[^0-9a-fA-F]/g, "");
  if (hex.length !== 12) {
    throw new Error("MAC 地址格式无效");
  }
  const out = new Uint8Array(6);
  for (let i = 0; i < 6; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * 设备名 `WCU_MY32_XXXX` → 默认 MAC `CF:30:16:00:XX:XX`（与 csTimer 一致）。
 */
export function macFromMoyuDeviceName(name: string | undefined): string | null {
  const match = /^WCU_MY32_([0-9A-Fa-f]{4})$/.exec(name?.trim() ?? "");
  if (!match) {
    return null;
  }
  const tag = match[1]!.toUpperCase();
  return `CF:30:16:00:${tag.slice(0, 2)}:${tag.slice(2, 4)}`;
}

async function importAesKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", keyBytes, "AES-CBC", false, [
    "encrypt",
    "decrypt",
  ]);
}

/** AES-128 ECB 单块解密（Web Crypto CBC 无填充技巧，与 cubing/bluetooth 相同）。 */
async function decryptEcbBlock(
  key: CryptoKey,
  ciphertextBlock: Uint8Array,
): Promise<Uint8Array> {
  const paddingBlock = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-CBC", iv: ciphertextBlock },
      key,
      PADDING_PLAIN,
    ),
  ).subarray(0, BLOCK);
  const cbcCiphertext = new Uint8Array(BLOCK * 2);
  cbcCiphertext.set(ciphertextBlock, 0);
  cbcCiphertext.set(paddingBlock, BLOCK);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-CBC", iv: ZEROS },
      key,
      cbcCiphertext,
    ),
  );
  return plain.subarray(0, BLOCK);
}

async function encryptEcbBlock(
  key: CryptoKey,
  plaintextBlock: Uint8Array,
): Promise<Uint8Array> {
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-CBC", iv: ZEROS },
      key,
      plaintextBlock,
    ),
  );
  return encrypted.subarray(0, BLOCK);
}

function xorBlock(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(BLOCK);
  for (let i = 0; i < BLOCK; i += 1) {
    out[i] = a[i]! ^ b[i]!;
  }
  return out;
}

async function decryptCbcBlock(
  key: CryptoKey,
  iv: Uint8Array,
  block: Uint8Array,
): Promise<Uint8Array> {
  return xorBlock(await decryptEcbBlock(key, block), iv);
}

async function encryptCbcBlock(
  key: CryptoKey,
  iv: Uint8Array,
  block: Uint8Array,
): Promise<Uint8Array> {
  return encryptEcbBlock(key, xorBlock(block, iv));
}

/** 解密 20 字节通知包（先尾块后首块）。 */
export async function decryptMoyuPacket(
  keyIv: MoyuKeyIv,
  data: Uint8Array,
): Promise<Uint8Array> {
  if (data.length < BLOCK) {
    throw new Error("密文过短");
  }
  const key = await importAesKey(keyIv.key);
  const res = new Uint8Array(data);
  if (res.length > BLOCK) {
    const end = await decryptCbcBlock(
      key,
      keyIv.iv,
      res.subarray(res.length - BLOCK),
    );
    res.set(end, res.length - BLOCK);
  }
  const start = await decryptCbcBlock(key, keyIv.iv, res.subarray(0, BLOCK));
  res.set(start, 0);
  return res;
}

/** 加密请求包（先首块后尾块）。 */
export async function encryptMoyuPacket(
  keyIv: MoyuKeyIv,
  data: Uint8Array,
): Promise<Uint8Array> {
  if (data.length < BLOCK) {
    throw new Error("明文过短");
  }
  const key = await importAesKey(keyIv.key);
  const res = new Uint8Array(data);
  const start = await encryptCbcBlock(key, keyIv.iv, res.subarray(0, BLOCK));
  res.set(start, 0);
  if (res.length > BLOCK) {
    const end = await encryptCbcBlock(
      key,
      keyIv.iv,
      res.subarray(res.length - BLOCK),
    );
    res.set(end, res.length - BLOCK);
  }
  return res;
}
