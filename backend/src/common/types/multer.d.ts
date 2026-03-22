// Type declarations for multer file uploads.
// This augments the Express namespace so that Express.Multer.File is available
// without requiring @types/multer to be installed at compile time.
// Remove this file once @types/multer is installed.

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
        buffer: Buffer;
        stream: NodeJS.ReadableStream;
      }
    }
  }
}

export {};
