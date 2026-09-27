import multer from "multer";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype.startsWith("image/");
    const isVideo = file.mimetype.startsWith("video/");

    if (!isImage && !isVideo) {
      cb(new Error("Only image and video uploads are allowed"));
      return;
    }

    cb(null, true);
  },
});

/* 
What multer does

Multer's one job: parse multipart/form-data requests so you can access uploaded files.

When the browser sends a file, it doesn't send JSON — it sends the request as multipart/form-data: a special encoding that bundles the file's raw bytes + its metadata (filename, mimetype) + any other form fields, all glued together with "boundary" markers.

Express's normal body parsers can't read this format:

express.json() → only understands JSON
express.urlencoded() → only understands simple text fields, not files

So without multer, req.body for a file upload would just be garbage/empty. Multer is the translator that decodes that multipart blob into something usable.
*/
