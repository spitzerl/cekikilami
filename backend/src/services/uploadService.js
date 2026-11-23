import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileTypeFromBuffer } from 'file-type';
import { generateUploadFilename } from '../security/tokens.js';
import { UPLOAD_LIMITS } from '../config/game.js';
import Music from '../models/Music.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, '../../uploads');

const AUDIO_TYPES = new Map([
  ['audio/mpeg', '.mp3'],
  ['audio/mp3', '.mp3'],
  ['audio/wav', '.wav'],
  ['audio/x-wav', '.wav'],
  ['audio/ogg', '.ogg'],
  ['audio/vorbis', '.ogg'],
  ['audio/mp4', '.m4a'],
  ['audio/x-m4a', '.m4a'],
  ['audio/m4a', '.m4a'],
]);

export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export async function detectAudioExtension(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected) return null;
  return AUDIO_TYPES.get(detected.mime) || null;
}

export async function saveUpload(buffer, extension) {
  await ensureUploadDir();
  const filename = generateUploadFilename(extension);
  const absolutePath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(absolutePath, buffer, { flag: 'wx', mode: 0o640 });
  return {
    filePath: `/uploads/${filename}`,
    fileSize: buffer.length,
    absolutePath,
  };
}

export async function deleteUpload(filePath) {
  if (typeof filePath !== 'string' || !filePath.startsWith('/uploads/')) return false;
  const filename = path.basename(filePath);
  if (!filename || filename === '.gitkeep') return false;
  const absolutePath = path.join(UPLOAD_DIR, filename);
  if (path.dirname(absolutePath) !== UPLOAD_DIR) return false;
  try {
    await fs.unlink(absolutePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    console.warn(`Unable to delete upload ${filename}:`, error.message);
    return false;
  }
}

export async function deleteUploadsForMusics(musics) {
  await Promise.all((musics || []).map((music) => deleteUpload(music.file_path)));
}

export async function cleanupOrphanUploads() {
  await ensureUploadDir();
  const referenced = new Set(
    (await Music.listLocalUploadPaths()).map((filePath) => path.basename(filePath))
  );
  const entries = await fs.readdir(UPLOAD_DIR);
  const now = Date.now();

  for (const entry of entries) {
    if (entry === '.gitkeep' || referenced.has(entry)) continue;
    const absolutePath = path.join(UPLOAD_DIR, entry);
    try {
      const stats = await fs.stat(absolutePath);
      if (!stats.isFile()) continue;
      if (now - stats.mtimeMs < UPLOAD_LIMITS.orphanTtlMs) continue;
      await fs.unlink(absolutePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`Unable to clean orphan upload ${entry}:`, error.message);
      }
    }
  }
}
