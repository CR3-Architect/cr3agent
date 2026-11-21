import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export class PathEscapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathEscapeError';
  }
}

/**
 * The folder the agent is allowed to touch with its file tools.
 * Every path the model supplies goes through resolve(), which:
 *  - resolves it against the folder,
 *  - follows symlinks on the part that already exists,
 *  - and refuses anything that ends up outside the folder.
 */
export class Workspace {
  readonly root: string;
  private realRootPromise: Promise<string> | null = null;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  private realRoot(): Promise<string> {
    this.realRootPromise ??= fs.realpath(this.root);
    return this.realRootPromise;
  }

  private assertInside(realRoot: string, full: string, input: string | undefined): void {
    const rel = path.relative(realRoot, full);
    if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) {
      throw new PathEscapeError(`Path is outside the project folder: ${input ?? '.'}`);
    }
  }

  /** Resolve a model-supplied path to a real absolute path inside the folder. */
  async resolve(input: string | undefined): Promise<string> {
    const realRoot = await this.realRoot();
    const requested = path.resolve(realRoot, input && input.length > 0 ? input : '.');

    let probe = requested;
    for (;;) {
      try {
        const real = await fs.realpath(probe);
        const full = path.join(real, path.relative(probe, requested));
        this.assertInside(realRoot, full, input);
        return full;
      } catch (err) {
        if (err instanceof PathEscapeError) throw err;
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== 'ENOENT' && code !== 'ENOTDIR') throw err;

        // realpath failed. If something exists here it is a dangling symlink,
        // and writing through it could land outside the folder.
        let exists = true;
        try {
          await fs.lstat(probe);
        } catch {
          exists = false;
        }
        if (exists) {
          throw new PathEscapeError(`Refusing to follow a broken symlink: ${input ?? '.'}`);
        }

        const parent = path.dirname(probe);
        if (parent === probe) throw err;
        probe = parent;
      }
    }
  }

  /** Path relative to the folder, for showing to the model and the user. */
  async rel(full: string): Promise<string> {
    const realRoot = await this.realRoot();
    const r = path.relative(realRoot, full) || '.';
    return r.split(path.sep).join('/');
  }
}
