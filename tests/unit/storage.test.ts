import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { LocalDiskStorageProvider, generateStorageKey } from '@/server/storage';

describe('StorageProvider & LocalDiskStorageProvider', () => {
  const testStorageDir = path.resolve(process.cwd(), '.test-storage');
  let provider: LocalDiskStorageProvider;

  beforeEach(async () => {
    provider = new LocalDiskStorageProvider('.test-storage');
    await fs.mkdir(testStorageDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testStorageDir, { recursive: true, force: true });
  });

  it('rejects path traversal keys with path separators or parent directory references', async () => {
    const invalidKeys = [
      '../evil.txt',
      '../../etc/passwd',
      'folder/file.png',
      'folder\\file.png',
      '..\\windows.txt',
      '/absolute/path.txt',
      '',
    ];

    const sampleBytes = Buffer.from('hello');

    for (const key of invalidKeys) {
      await expect(provider.put(key, sampleBytes, 'text/plain')).rejects.toThrow();
      await expect(provider.get(key)).rejects.toThrow();
      await expect(provider.delete(key)).rejects.toThrow();
    }
  });

  it('puts, gets, and deletes files safely', async () => {
    const key = generateStorageKey('txt');
    const bytes = Buffer.from('signature content', 'utf-8');

    // 1. Put
    await provider.put(key, bytes, 'text/plain');

    // 2. Get
    const retrieved = await provider.get(key);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.bytes.toString('utf-8')).toBe('signature content');
    expect(retrieved?.contentType).toBe('text/plain');

    // 3. Delete
    await provider.delete(key);
    const afterDelete = await provider.get(key);
    expect(afterDelete).toBeNull();
  });

  it('get returns null for non-existent file without throwing', async () => {
    const key = generateStorageKey('png');
    const result = await provider.get(key);
    expect(result).toBeNull();
  });

  it('delete does not throw for non-existent file', async () => {
    const key = generateStorageKey('png');
    await expect(provider.delete(key)).resolves.not.toThrow();
  });

  it('generateStorageKey creates a UUID-based key with given extension', () => {
    const key1 = generateStorageKey('png');
    expect(key1).toMatch(/^[0-9a-f-]{36}\.png$/);

    const key2 = generateStorageKey('.txt');
    expect(key2).toMatch(/^[0-9a-f-]{36}\.txt$/);
  });
});
