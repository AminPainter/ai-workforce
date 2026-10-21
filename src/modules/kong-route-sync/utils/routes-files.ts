const ROUTES_FILE = /^config\/routes(\.rb|\/.+\.rb)$/;

export function isRoutesFile(file: {
  filename: string;
  previous_filename?: string;
}): boolean {
  return [file.filename, file.previous_filename].some(
    (filename) => filename !== undefined && ROUTES_FILE.test(filename),
  );
}
