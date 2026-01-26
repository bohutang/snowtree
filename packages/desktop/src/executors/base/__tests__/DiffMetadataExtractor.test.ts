import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiffMetadataExtractor } from '../DiffMetadataExtractor';
import * as fs from 'fs/promises';

// Mock fs/promises
vi.mock('fs/promises');

describe('DiffMetadataExtractor', () => {
  let extractor: DiffMetadataExtractor;
  const mockCwd = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();
    extractor = new DiffMetadataExtractor({ cwd: mockCwd });
  });

  describe('extractClaudeEdit', () => {
    it('should return the exact old_string and new_string from Edit tool', async () => {
      const originalSection = 'This is the original content.';
      const updatedSection = 'This is the updated content.';

      const metadata = {
        input: {
          file_path: '/test/project/README.md',
          old_string: originalSection,
          new_string: updatedSection,
        },
      };

      const result = await extractor.extract('Edit', metadata);

      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0].filePath).toBe('/test/project/README.md');
      // Should return the exact strings provided by Edit tool
      expect(result![0].oldString).toBe(originalSection);
      expect(result![0].newString).toBe(updatedSection);
    });

    it('should return the exact strings for multiline edits', async () => {
      const oldCode = `console.log('Hi');
  return false;`;
      const newCode = `console.log('Hello, World!');
  return true;`;

      const metadata = {
        input: {
          file_path: '/test/project/index.ts',
          old_string: oldCode,
          new_string: newCode,
        },
      };

      const result = await extractor.extract('Edit', metadata);

      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      // Should return the exact strings, not full file content
      expect(result![0].oldString).toBe(oldCode);
      expect(result![0].newString).toBe(newCode);
    });

    it('should return null for missing input', async () => {
      const result = await extractor.extract('Edit', {});
      expect(result).toBeNull();
    });

    it('should return null for missing file_path', async () => {
      const metadata = {
        input: {
          old_string: 'old',
          new_string: 'new',
        },
      };

      const result = await extractor.extract('Edit', metadata);
      expect(result).toBeNull();
    });

    it('should return null for missing old_string', async () => {
      const metadata = {
        input: {
          file_path: '/test/file.md',
          new_string: 'new',
        },
      };

      const result = await extractor.extract('Edit', metadata);
      expect(result).toBeNull();
    });

    it('should return null for missing new_string', async () => {
      const metadata = {
        input: {
          file_path: '/test/file.md',
          old_string: 'old',
        },
      };

      const result = await extractor.extract('Edit', metadata);
      expect(result).toBeNull();
    });
  });

  describe('extractClaudeWrite', () => {
    it('should return full content for new file', async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error('File not found'));

      const metadata = {
        input: {
          file_path: '/test/project/new-file.md',
          content: '# New Document\n\nContent here.',
        },
      };

      const result = await extractor.extract('Write', metadata);

      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0].oldString).toBe('');
      expect(result![0].newString).toBe('# New Document\n\nContent here.');
      expect(result![0].isNewFile).toBe(true);
    });

    it('should return old and new content for existing file', async () => {
      const existingContent = '# Old Document\n\nOld content.';
      vi.mocked(fs.stat).mockResolvedValue({ size: 100 } as any);
      vi.mocked(fs.readFile).mockResolvedValue(existingContent);

      const metadata = {
        input: {
          file_path: '/test/project/existing.md',
          content: '# New Document\n\nNew content.',
        },
      };

      const result = await extractor.extract('Write', metadata);

      expect(result).not.toBeNull();
      expect(result![0].oldString).toBe(existingContent);
      expect(result![0].newString).toBe('# New Document\n\nNew content.');
      expect(result![0].isNewFile).toBeFalsy();
    });
  });

  describe('extractClaudeBash', () => {
    it('should extract diff for rm command', async () => {
      const fileContent = 'file content to be deleted';
      vi.mocked(fs.stat).mockResolvedValue({ size: 100 } as any);
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const metadata = {
        input: {
          command: 'rm /test/project/file.txt',
        },
      };

      const result = await extractor.extract('Bash', metadata);

      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0].oldString).toBe(fileContent);
      expect(result![0].newString).toBe('');
      expect(result![0].isDelete).toBe(true);
    });

    it('should extract diff for rm -f command', async () => {
      const fileContent = 'content';
      vi.mocked(fs.stat).mockResolvedValue({ size: 100 } as any);
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const metadata = {
        input: {
          command: 'rm -f /test/project/file.txt',
        },
      };

      const result = await extractor.extract('Bash', metadata);

      expect(result).not.toBeNull();
      expect(result![0].isDelete).toBe(true);
    });

    it('should return null for non-rm commands', async () => {
      const metadata = {
        input: {
          command: 'ls -la',
        },
      };

      const result = await extractor.extract('Bash', metadata);
      expect(result).toBeNull();
    });

    it('should handle multiple files in rm command', async () => {
      vi.mocked(fs.stat).mockResolvedValue({ size: 100 } as any);
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('content1')
        .mockResolvedValueOnce('content2');

      const metadata = {
        input: {
          command: 'rm file1.txt file2.txt',
        },
      };

      const result = await extractor.extract('Bash', metadata);

      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
      expect(result![0].oldString).toBe('content1');
      expect(result![1].oldString).toBe('content2');
    });
  });

  describe('extractCodexFileChange', () => {
    it('should extract diff from unified diff format', async () => {
      const metadata = {
        changes: [
          {
            path: '/test/file.ts',
            diff: `--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 const a = 1;
-const b = 2;
+const b = 3;
 const c = 3;`,
            kind: { type: 'update' },
          },
        ],
      };

      const result = await extractor.extract('fileChange', metadata);

      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0].filePath).toBe('/test/file.ts');
      expect(result![0].oldString).toContain('const b = 2;');
      expect(result![0].newString).toContain('const b = 3;');
    });

    it('should handle new file with content', async () => {
      const metadata = {
        changes: [
          {
            path: '/test/new-file.ts',
            content: 'export const hello = "world";',
            kind: { type: 'add' },
          },
        ],
      };

      const result = await extractor.extract('fileChange', metadata);

      expect(result).not.toBeNull();
      expect(result![0].oldString).toBe('');
      expect(result![0].newString).toBe('export const hello = "world";');
      expect(result![0].isNewFile).toBe(true);
    });

    it('should handle file deletion', async () => {
      const metadata = {
        changes: [
          {
            path: '/test/deleted-file.ts',
            content: 'old content',
            kind: { type: 'delete' },
          },
        ],
      };

      const result = await extractor.extract('fileChange', metadata);

      expect(result).not.toBeNull();
      expect(result![0].oldString).toBe('old content');
      expect(result![0].newString).toBe('');
      expect(result![0].isDelete).toBe(true);
    });
  });

  describe('extractCodexCommand', () => {
    it('should extract diff for rm command same as Claude Bash', async () => {
      const fileContent = 'file to delete';
      vi.mocked(fs.stat).mockResolvedValue({ size: 100 } as any);
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const metadata = {
        command: 'rm /test/file.txt',
      };

      const result = await extractor.extract('commandExecution', metadata);

      expect(result).not.toBeNull();
      expect(result![0].oldString).toBe(fileContent);
      expect(result![0].newString).toBe('');
      expect(result![0].isDelete).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should return null for unknown tool', async () => {
      const result = await extractor.extract('UnknownTool', { input: {} });
      expect(result).toBeNull();
    });

    it('should return null for null metadata', async () => {
      const result = await extractor.extract('Edit', undefined);
      expect(result).toBeNull();
    });

    it('should skip binary files for Write tool', async () => {
      vi.mocked(fs.stat).mockResolvedValue({ size: 100 } as any);
      vi.mocked(fs.readFile).mockResolvedValue('binary\0content');

      const metadata = {
        input: {
          file_path: '/test/binary.bin',
          content: 'new content',
        },
      };

      const result = await extractor.extract('Write', metadata);

      // Should treat as new file since binary file is skipped
      expect(result).not.toBeNull();
      expect(result![0].oldString).toBe('');
      expect(result![0].newString).toBe('new content');
      expect(result![0].isNewFile).toBe(true);
    });

    it('should skip large files for Write tool', async () => {
      vi.mocked(fs.stat).mockResolvedValue({ size: 2 * 1024 * 1024 } as any); // 2MB

      const metadata = {
        input: {
          file_path: '/test/large.md',
          content: 'new content',
        },
      };

      const result = await extractor.extract('Write', metadata);

      // Should treat as new file since large file is skipped
      expect(result).not.toBeNull();
      expect(result![0].oldString).toBe('');
      expect(result![0].newString).toBe('new content');
      expect(result![0].isNewFile).toBe(true);
    });
  });
});
