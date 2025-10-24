const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cors = require("cors");

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect("mongodb://localhost:27017/fileDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const conn = mongoose.connection;
let gfs;

conn.once("open", () => {
  console.log("✅ MongoDB connected");
  gfs = new mongoose.mongo.GridFSBucket(conn.db, { bucketName: "uploads" });
});

// Multer storage (memory storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload File
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  console.log("📥 Received file:", req.file.originalname);

  const writeStream = gfs.openUploadStream(req.file.originalname, {
    contentType: req.file.mimetype,
  });

  writeStream.end(req.file.buffer);

  writeStream.on("finish", (file) => {
    console.log("✅ Saved to GridFS:", file.filename);
    res.json({
      fileId: file._id,
      fileName: file.filename,
      fileUrl: `http://localhost:${PORT}/files/${file._id}`,
    });
  });

  writeStream.on("error", (err) => {
    console.error("❌ Error saving file:", err);
    res.status(500).json({ error: "Error saving file" });
  });
});

// Get all files
app.get("/files", async (req, res) => {
  try {
    const files = await conn.db.collection("uploads.files").find().toArray();
    res.json(
      files.map((f) => ({
        fileId: f._id,
        fileName: f.filename,
        fileUrl: `http://localhost:${PORT}/files/${f._id}`,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: "Error fetching files" });
  }
});

// Get file by ID
app.get("/files/:id", (req, res) => {
  try {
    const readStream = gfs.openDownloadStream(
      new mongoose.Types.ObjectId(req.params.id)
    );

    readStream.on("error", () => res.status(404).json({ error: "File not found" }));
    readStream.pipe(res);
  } catch (err) {
    res.status(400).json({ error: "Invalid file ID" });
  }
});

// Delete file
app.delete("/files/:id", (req, res) => {
  try {
    gfs.delete(new mongoose.Types.ObjectId(req.params.id), (err) => {
      if (err) return res.status(500).json({ error: "Deletion failed" });
      res.json({ message: "File deleted successfully" });
    });
  } catch (err) {
    res.status(400).json({ error: "Invalid file ID" });
  }
});

// Start server
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
