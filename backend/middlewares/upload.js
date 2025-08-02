const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        const baseName = path.parse(file.originalname).name.replace(/\\/g, '/');
        cb(null, baseName + '-' + uniqueSuffix + ext);
    }
});

module.exports = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (![".jpg", ".jpeg", ".png"].includes(ext)) {
            return cb(new Error("Unsupported file type!"), false);
        }
        cb(null, true);
    }
});