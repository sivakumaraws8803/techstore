import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const uploadDirectory = path.resolve(
    currentDirectory,
    '../../../uploads/products'
);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1
    },
    fileFilter(req, file, callback) {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];

        if (!allowed.includes(file.mimetype)) {
            const error = new Error('Only JPG, PNG and WebP images are allowed');
            error.status = 400;
            return callback(error);
        }

        callback(null, true);
    }
});

function detectImage(buffer) {
    if (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
    ) {
        return 'jpg';
    }

    if (
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        )
    ) {
        return 'png';
    }

    if (
        buffer.length >= 12 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
        return 'webp';
    }

    return null;
}

export function uploadProductImage(req, res, next) {
    upload.single('image')(req, res, async (error) => {
        if (error) {
            return res.status(error.status || 400).json({
                error: error.code === 'LIMIT_FILE_SIZE'
                    ? 'Image must be 5 MB or smaller'
                    : error.message
            });
        }

        if (!req.file) {
            return next();
        }

        try {
            const extension = detectImage(req.file.buffer);

            if (!extension) {
                return res.status(400).json({
                    error: 'Invalid image file. Upload a genuine JPG, PNG or WebP image.'
                });
            }

            await fs.mkdir(uploadDirectory, { recursive: true });

            const filename = `${randomUUID()}.${extension}`;

            await fs.writeFile(
                path.join(uploadDirectory, filename),
                req.file.buffer,
                { flag: 'wx', mode: 0o644 }
            );

            req.body.image_url = `/uploads/products/${filename}`;

            next();
        } catch (writeError) {
            next(writeError);
        }
    });
}
