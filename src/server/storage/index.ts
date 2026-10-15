import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export interface StorageProvider {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ bytes: Buffer; contentType?: string } | null>;
  delete(key: string): Promise<void>;
}

export class LocalDiskStorageProvider implements StorageProvider {
  private readonly rootDir: string;

  constructor(rootDir: string = process.env.STORAGE_DIR || '.data') {
    this.rootDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), rootDir);
  }

  getRootDir(): string {
    return this.rootDir;
  }

  private validateKey(key: string): string {
    if (!key || typeof key !== 'string') {
      throw new Error('Storage key must be a non-empty string');
    }

    // Reject any key containing path separators (/ or \) or '..'
    if (key.includes('/') || key.includes('\\') || key.includes('..')) {
      throw new Error(`Path traversal attempt or invalid character in key: ${key}`);
    }

    const resolvedPath = path.resolve(this.rootDir, key);

    // Assert that the resolved path stays strictly inside rootDir
    const rootWithSep = this.rootDir.endsWith(path.sep) ? this.rootDir : `${this.rootDir}${path.sep}`;
    if (!resolvedPath.startsWith(rootWithSep)) {
      throw new Error(`Path traversal detected: key resolves outside root directory`);
    }

    return resolvedPath;
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.rootDir, { recursive: true });
  }

  async put(key: string, bytes: Buffer, _contentType: string): Promise<void> {
    void _contentType;
    const filePath = this.validateKey(key);
    await this.ensureDir();
    await fs.writeFile(filePath, bytes);
  }

  async get(key: string): Promise<{ bytes: Buffer; contentType?: string } | null> {
    const filePath = this.validateKey(key);
    try {
      const bytes = await fs.readFile(filePath);
      let contentType = 'application/octet-stream';
      if (key.endsWith('.png')) {
        contentType = 'image/png';
      } else if (key.endsWith('.txt')) {
        contentType = 'text/plain';
      }
      return { bytes, contentType };
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.validateKey(key);
    try {
      await fs.unlink(filePath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }
}

export function generateStorageKey(extension: string): string {
  const cleanExt = extension.replace(/^\./, '');
  return `${crypto.randomUUID()}.${cleanExt}`;
}

export const storageProvider: StorageProvider = new LocalDiskStorageProvider();
