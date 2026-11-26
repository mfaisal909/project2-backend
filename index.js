
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import dns from "dns";
import Student from "./models/Student.js";

dotenv.config();

// Use public DNS so MongoDB Atlas SRV records resolve reliably
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const app = express();

// Environment variables
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL
      ? process.env.CLIENT_URL.split(",").map((url) => url.trim())
      : true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Health check
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Student Management API is running",
  });
});

// API health status
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    server: "running",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// Get all students
app.get("/api/students", async (req, res, next) => {
  try {
    const students = await Student.find()
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: students.length,
      data: students,
    });
  } catch (error) {
    next(error);
  }
});

// Get student by ID
app.get("/api/students/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.status(200).json({
      success: true,
      data: student,
    });
  } catch (error) {
    next(error);
  }
});

// Create student
app.post("/api/students", async (req, res, next) => {
  try {
    const { name, fatherName, rollNo, email, semester, section } = req.body;

    if (
      !name?.trim() ||
      !rollNo?.trim() ||
      !email?.trim() ||
      semester === undefined ||
      !section?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, roll no, email, semester and section are required",
      });
    }

    const student = await Student.create({
      name: name.trim(),
      fatherName: fatherName?.trim(),
      rollNo: rollNo.trim(),
      email: email.trim().toLowerCase(),
      semester,
      section: section.trim(),
    });

    res.status(201).json({
      success: true,
      message: "Student created successfully",
      data: student,
    });
  } catch (error) {
    next(error);
  }
});

// Update student
app.put("/api/students/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    const { name, fatherName, rollNo, email, semester, section } = req.body;

    const student = await Student.findByIdAndUpdate(
      id,
      {
        ...(name !== undefined && { name: name.trim() }),
                ...(fatherName !== undefined && { fatherName: fatherName.trim() }),
        ...(rollNo !== undefined && { rollNo: rollNo.trim() }),
        ...(email !== undefined && {
          email: email.trim().toLowerCase(),
        }),
        ...(semester !== undefined && { semester }),
        ...(section !== undefined && { section: section.trim() }),
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Student updated successfully",
      data: student,
    });
  } catch (error) {
    next(error);
  }
});

// Delete student
app.delete("/api/students/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    const student = await Student.findByIdAndDelete(id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Student deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("API Error:", error);

  if (res.headersSent) {
    return next(error);
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: Object.values(error.errors).map((e) => e.message),
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "This record already exists",
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid data format",
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// Start server
const startServer = async () => {
  try {
    if (!MONGO_URI) {
      throw new Error("MONGO_URI is missing in .env file");
    }

    await mongoose.connect(MONGO_URI);

    console.log("MongoDB connected successfully");

    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`${signal} received. Shutting down...`);

      server.close(async () => {
        await mongoose.connection.close();
        console.log("Server and MongoDB connection closed");
        process.exit(0);
      });
    };

    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));

  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();

export default app;
