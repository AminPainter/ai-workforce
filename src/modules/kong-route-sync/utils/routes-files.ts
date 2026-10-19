import type { PullRequestFile } from '../../github/services/github-api.service';

const ROUTES_FILE = /^config\/routes(\.rb|\/.+\.rb)$/;

export function isRoutesFile(file: PullRequestFile): boolean {
  return [file.filename, file.previous_filename].some(
    (filename) => filename !== undefined && ROUTES_FILE.test(filename),
  );
}
