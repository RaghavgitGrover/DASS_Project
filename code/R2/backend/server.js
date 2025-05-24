import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import { generateTimetable } from "./timetableGenerator.js";
import fs from "fs";
import path from "path";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import morgan from "morgan";
import { convertTxtToJson } from "./text_js.js";

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests, please try again later"
});
app.use(limiter);
app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});
app.use(morgan(':date[iso] :method :url :status :res[content-length] - :response-time ms - ID::req[id]'));

// Compression should come after security middlewares
app.use(compression());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cors());

// Define paths for data files
const DATA_DIR = "./data";
const USERS_FILE = path.join(DATA_DIR, "users.json");
const TIMETABLES_FILE = path.join(DATA_DIR, "timetables.json");
const COURSES_FILE = path.join(DATA_DIR, "courses.json");
const INVIGILATION_ASSIGNMENTS_FILE = path.join(DATA_DIR, "invigilation_assignments.json");
const SAVED_INVIGILATION_ASSIGNMENTS_FILE = path.join(DATA_DIR, "saved_invigilation_assignments.json");

// Create data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// Helper functions for data persistence
const readJSONFile = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(
        filePath,
        JSON.stringify(filePath.includes("timetables.json") ? {} : [], null, 2)
      );
      return filePath.includes("timetables.json") ? {} : [];
    }
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return filePath.includes("timetables.json") ? {} : [];
  }
};

const writeJSONFile = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error writing to ${filePath}:`, error);
  }
};

const processCoursesData = (rawData) => {
  if (!rawData.Applications) return null;
  const coursesMap = new Map();
  Object.values(rawData.Applications).forEach((app) => {
    if (app.coursecode && app.coursename && app.rollnumber) {
      if (!coursesMap.has(app.coursecode)) {
        coursesMap.set(app.coursecode, {
          code: app.coursecode,
          name: app.coursename,
          students: new Set(),
        });
      }
      coursesMap.get(app.coursecode).students.add(app.rollnumber);
    }
  });
  return Array.from(coursesMap.values()).map((course) => ({
    code: course.code,
    name: course.name,
    students: Array.from(course.students),
  }));
};

app.post("/api/fetchCoursesData", async (req, res) => {
  try {
    const { year, semester, examType } = req.body;

    const response = await fetch(
      `https://ims-dev.iiit.ac.in/exam_schedule_api.php?typ=getStudData&key=IMS&secret=ExamDegunGts&year=${year}&semester=${semester}`
    );

    //const response = await fetch("http://localhost:3001/data");

    if (!response.ok) throw new Error("Failed to fetch data from IIIT API");
    const rawData = await response.json();
    const processedCourses = processCoursesData(rawData);
    if (!processedCourses) throw new Error("Failed to process courses data");

    const coursesData = {
      year,
      semester,
      examType,
      courses: processedCourses,
    };

    writeJSONFile(COURSES_FILE, coursesData);
    res.json(coursesData);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ message: "Failed to fetch courses data" });
  }
});

app.get("/api/coursesNames", (req, res) => {
  try {
    const coursesData = readJSONFile(COURSES_FILE);
    if (!coursesData || !coursesData.courses) {
      return res.status(404).json({
        message: "No courses data available. Please fetch courses data first.",
      });
    }
    res.json(coursesData);
  } catch (error) {
    console.error("Error getting course names:", error);
    res.status(500).json({ message: "Failed to get course names" });
  }
});

app.post("/api/signup", async (req, res) => {
  const { username, email, password } = req.body;
  console.log(`Signup request received for email: ${email}`);

  const users = readJSONFile(USERS_FILE);
  if (users.some((user) => user.email === email)) {
    console.log(`Signup failed: Email ${email} already exists.`);
    return res.status(400).json({ message: "Email already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const createdAt = new Date().toISOString();

  users.push({
    username,
    email,
    password: hashedPassword,
    createdAt,
    lastLogin: null,
  });

  writeJSONFile(USERS_FILE, users);
  console.log(`Signup successful for email: ${email}`);
  res.json({ message: "Signup successful" });
});

// Replace the CAS configuration in your server.js with this:

const CAS_LOGIN_URL = "https://login.iiit.ac.in/cas/login";
const CAS_VALIDATE_URL = "https://login.iiit.ac.in/cas/serviceValidate";
// CRITICAL FIX: Change SERVICE_URL to point to frontend
const SERVICE_URL = "http://localhost:5173/api/cas/callback";

app.get("/api/cas/login", (req, res) => {
  console.log("CAS login initiated");
  const redirectUrl = `${CAS_LOGIN_URL}?service=${encodeURIComponent(
    SERVICE_URL
  )}`;
  console.log("Redirecting to CAS:", redirectUrl);
  res.redirect(redirectUrl);
});

// Keep your existing /api/cas/callback endpoint for backward compatibility
app.get("/api/cas/callback", async (req, res) => {
  const { ticket } = req.query;
  console.log("CAS callback received at backend with ticket:", ticket);

  if (!ticket) {
    console.error("Missing CAS ticket");
    return res.redirect(
      "http://localhost:5173/login?error=Missing%20CAS%20ticket"
    );
  }

  try {
    const response = await fetch(
      `${CAS_VALIDATE_URL}?ticket=${ticket}&service=${encodeURIComponent(
        SERVICE_URL
      )}`
    );
    const body = await response.text();
    const parsed = await parseStringPromise(body);

    const casResponse = parsed["cas:serviceResponse"];
    const authenticationSuccess =
      casResponse && casResponse["cas:authenticationSuccess"];

    if (!authenticationSuccess) {
      return res.redirect(
        "http://localhost:5173/login?error=Authentication%20failed"
      );
    }

    const email = authenticationSuccess[0]["cas:user"][0];
    if (!email) {
      return res.redirect(
        "http://localhost:5173/login?error=Failed%20to%20extract%20email"
      );
    }

    let users = readJSONFile(USERS_FILE);
    let user = users.find((u) => u.email === email);

    // Create user if not found
    if (!user) {
      user = {
        email,
        username: email.split("@")[0],
        createdAt: new Date().toISOString(),
        lastLogin: null,
      };
      users.push(user);
      writeJSONFile(USERS_FILE, users);
    }

    user.lastLogin = new Date().toISOString();
    writeJSONFile(USERS_FILE, users);

    console.log(`CAS Login successful for email: ${email}`);

    // Redirect to frontend with authentication success parameters
    res.redirect(
      `http://localhost:5173/cas-success?email=${encodeURIComponent(
        email
      )}&username=${encodeURIComponent(user.username)}`
    );
  } catch (error) {
    console.error("CAS Callback Error:", error);
    res.redirect("http://localhost:5173/login?error=Server%20error");
  }
});

// ADD THIS NEW ENDPOINT: This will be called by your frontend CasCallback component
app.get("/api/cas/validate", async (req, res) => {
  const { ticket } = req.query;
  console.log("CAS validate endpoint called with ticket:", ticket);

  if (!ticket) {
    return res.status(400).json({ message: "Missing CAS ticket" });
  }

  try {
    const response = await fetch(
      `${CAS_VALIDATE_URL}?ticket=${ticket}&service=${encodeURIComponent(
        SERVICE_URL
      )}`
    );
    const body = await response.text();
    const parsed = await parseStringPromise(body);

    const casResponse = parsed["cas:serviceResponse"];
    const authenticationSuccess =
      casResponse && casResponse["cas:authenticationSuccess"];

    if (!authenticationSuccess) {
      return res.status(401).json({ message: "Authenticating" }); // Message changed
    }

    const email = authenticationSuccess[0]["cas:user"][0];
    if (!email) {
      return res.status(401).json({ message: "Failed to extract email" });
    }

    let users = readJSONFile(USERS_FILE);
    let user = users.find((u) => u.email === email);

    // Create user if not found
    if (!user) {
      user = {
        email,
        username: email.split("@")[0],
        createdAt: new Date().toISOString(),
        lastLogin: null,
      };
      users.push(user);
      writeJSONFile(USERS_FILE, users);
    }

    user.lastLogin = new Date().toISOString();
    writeJSONFile(USERS_FILE, users);

    console.log(`CAS validation successful for email: ${email}`);

    // Return user info to frontend
    res.json({
      message: "Authentication successful",
      email: user.email,
      username: user.username,
    });
  } catch (error) {
    console.error("CAS Validate Error:", error);
    res.status(500).json({ message: "Server error during validation" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  console.log(`Login request received for email: ${email}`);

  const users = readJSONFile(USERS_FILE);
  const user = users.find((user) => user.email === email);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    console.log(`Login failed: Invalid credentials for email: ${email}`);
    return res.status(401).json({ message: "Invalid credentials" });
  }

  user.lastLogin = new Date().toISOString();
  writeJSONFile(USERS_FILE, users);

  console.log(`Login successful for email: ${email}`);
  res.json({
    message: "Login successful",
    email: user.email,
    username: user.username,
  });
});

app.get("/api/user/:email", (req, res) => {
  const { email } = req.params;
  const users = readJSONFile(USERS_FILE);
  const user = users.find((u) => u.email === email);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const { password, ...userDetails } = user;
  res.json(userDetails);
});

app.post("/api/storeCoursesData", (req, res) => {
  try {
    const { year, semester, examType } = req.body;
    const coursesData = readJSONFile(COURSES_FILE);

    if (!coursesData || !coursesData.courses) {
      return res.status(400).json({ message: "No courses data available" });
    }

    const updatedCoursesData = {
      ...coursesData,
      year,
      semester,
      examType,
    };

    writeJSONFile(COURSES_FILE, updatedCoursesData);

    res.json({
      message: "Courses data stored successfully",
      data: updatedCoursesData,
    });
  } catch (error) {
    console.error("Error storing courses data:", error);
    res.status(500).json({ message: "Failed to store courses data" });
  }
});

app.get("/api/fetchTimeTable", async (req, res) => {
  try {
    console.log("Received timetable generation request");
    const selectedCourses = JSON.parse(req.query.selectedCourses);
    const examConfig = JSON.parse(req.query.examConfig);

    const coursesData = readJSONFile(COURSES_FILE);

    if (!coursesData || !coursesData.courses) {
      console.error("No courses data available");
      return res.status(400).json({ error: "No courses data available" });
    }

    // Filter and map courses in a single pass
    const selectedCoursesData = selectedCourses.reduce((acc, courseCode) => {
      const course = coursesData.courses.find((c) => c.code === courseCode);
      if (course) {
        acc.push({
          code: course.code,
          name: course.name,
          students: course.students,
        });
      }
      return acc;
    }, []);

    if (selectedCoursesData.length === 0) {
      console.error("No valid courses found in selection");
      return res.status(400).json({ error: "No valid courses selected" });
    }

    if (
      !examConfig.dates ||
      !Array.isArray(examConfig.dates) ||
      examConfig.dates.length === 0
    ) {
      console.error("No exam dates provided");
      return res.status(400).json({ error: "Please select exam dates" });
    }

    const parsedDates = examConfig.dates.map((dateStr) => new Date(dateStr));
    parsedDates.sort((a, b) => a - b);

    // Generate timetables in parallel with a limit
    const MAX_TIMETABLES = 3;
    const timetablePromises = Array(MAX_TIMETABLES)
      .fill()
      .map(async () => {
        const result = await generateTimetable(
          selectedCoursesData,
          parsedDates[0],
          parsedDates,
          examConfig.slots
        );

        // Optimize the response by only including necessary data
        return {
          timetable: result.timetable,
          stats: {
            totalCourses: result.stats.totalCourses,
            scheduledCourses: result.stats.scheduledCourses,
            unscheduledCourses: result.stats.unscheduledCourses,
            year: coursesData.year,
            semester: coursesData.semester,
            examType: coursesData.examType,
          },
          fitness: result.fitness,
        };
      });

    const timetables = await Promise.all(timetablePromises);

    // Compress the response using a more efficient format
    const response = {
      timetables: timetables.map((result, index) => ({
        id: index + 1,
        ...result,
      })),
    };

    // Set cache headers
    res.set({
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/json",
    });

    res.json(response);
  } catch (error) {
    console.error("Error generating timetables:", error);
    res.status(500).json({ error: "Failed to generate timetables" });
  }
});

app.post("/api/saveTimetable", (req, res) => {
  try {
    const { name, data } = req.body;
    //console.log(data)
    const timetables = readJSONFile(TIMETABLES_FILE);

    // Find the next available ID
    let nextId = 1;
    while (timetables[nextId]) {
      nextId++;
    }

    // Generate student statistics
    const studentStats = {};
    Object.entries(data.generatedTimetable).forEach(([date, slots]) => {
      Object.entries(slots).forEach(([slot, courses]) => {
        courses.forEach((course) => {
          course.students.forEach((rollNumber) => {
            if (!studentStats[rollNumber]) {
              studentStats[rollNumber] = {
                totalExams: 0,
                daysWithMultipleExams: 0,
                consecutiveExams: 0,
                examSchedule: [],
              };
            }

            const studentStat = studentStats[rollNumber];
            studentStat.totalExams++;
            studentStat.examSchedule.push({
              date,
              slot,
              courseCode: course.code,
            });
          });
        });
      });
    });

    // Calculate conflicts for each student
    Object.values(studentStats).forEach((stats) => {
      const examsByDate = {};
      stats.examSchedule.forEach((exam) => {
        if (!examsByDate[exam.date]) {
          examsByDate[exam.date] = [];
        }
        examsByDate[exam.date].push(exam);
      });

      Object.values(examsByDate).forEach((exams) => {
        if (exams.length > 1) {
          stats.daysWithMultipleExams++;
        }
      });

      stats.examSchedule.sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare === 0) {
          return parseInt(a.slot) - parseInt(b.slot);
        }
        return dateCompare;
      });

      for (let i = 0; i < stats.examSchedule.length - 1; i++) {
        const currentExam = stats.examSchedule[i];
        const nextExam = stats.examSchedule[i + 1];

        if (currentExam.date === nextExam.date) {
          const currentSlot = parseInt(currentExam.slot);
          const nextSlot = parseInt(nextExam.slot);
          if (Math.abs(nextSlot - currentSlot) === 1) {
            stats.consecutiveExams++;
          }
        }
      }
    });

    timetables[nextId] = {
      id: nextId,
      name,
      createdAt: new Date().toISOString(),
      data: {
        ...data,
        stats: {
          ...data.stats,
          studentStats,
        },
      },
    };

    writeJSONFile(TIMETABLES_FILE, timetables);

    res.json({
      message: "Timetable saved successfully",
      id: nextId,
    });
  } catch (error) {
    console.error("Error saving timetable:", error);
    res.status(500).json({ message: "Failed to save timetable" });
  }
});

app.get("/api/timetables", (req, res) => {
  try {
    const timetables = readJSONFile(TIMETABLES_FILE);
    const timetablesList = Object.values(timetables)
      .filter((timetable) => timetable && timetable.data) // Filter out invalid entries
      .map((timetable) => ({
        id: timetable.id || 0,
        name: timetable.name || "Untitled",
        createdAt: timetable.createdAt || new Date().toISOString(),
        year: timetable.data?.year || "N/A",
        semester: timetable.data?.semester || "N/A",
        examType: timetable.data?.examType || "N/A",
        totalCourses: timetable.data?.stats?.totalCourses || 0,
        scheduledCourses: timetable.data?.stats?.scheduledCourses || 0,
      }));
    res.json(timetablesList);
  } catch (error) {
    console.error("Error fetching timetables:", error);
    res.status(500).json({
      message: "Failed to fetch timetables",
      error: error.message,
    });
  }
});

app.get("/api/timetable/:id", (req, res) => {
  try {
    const { id } = req.params;
    const timetables = readJSONFile(TIMETABLES_FILE);
    const timetable = timetables[id];

    if (!timetable) {
      return res.status(404).json({ message: "Timetable not found" });
    }

    res.json(timetable);
  } catch (error) {
    console.error("Error fetching timetable:", error);
    res.status(500).json({ message: "Failed to fetch timetable" });
  }
});

app.delete("/api/timetable/:id", (req, res) => {
  try {
    const { id } = req.params;
    const timetables = readJSONFile(TIMETABLES_FILE);

    if (!timetables[id]) {
      return res.status(404).json({ message: "Timetable not found" });
    }

    delete timetables[id];
    writeJSONFile(TIMETABLES_FILE, timetables);

    res.json({ message: "Timetable deleted successfully" });
  } catch (error) {
    console.error("Error deleting timetable:", error);
    res.status(500).json({ message: "Failed to delete timetable" });
  }
});

// Routes for text to JSON conversion
app.post("/api/convert-text-to-json", async (req, res) => {
    try {
        const { content } = req.body;
        const jsonFilePath = 'Spring_2025_Mid_Sem.json'; // Fixed file path

        if (!content) {
            return res.status(400).json({
                error: "Missing required parameter",
                message: "Please provide the content"
            });
        }

        // Convert the content
        await convertTxtToJson(content, jsonFilePath);

        // Check if the JSON file was created
        if (!fs.existsSync(jsonFilePath)) {
            return res.status(500).json({
                error: "Conversion failed",
                message: "Failed to create JSON file"
            });
        }

        // Read the converted JSON file
        const jsonContent = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

        res.status(200).json({
            success: true,
            message: "Content converted successfully",
            data: jsonContent
        });

    } catch (error) {
        console.error("Error converting content:", error);
        res.status(500).json({
            error: "Internal server error",
            message: error.message
        });
    }
});

// Save Invigilation Assignment
app.post("/api/saveInvigilationAssignment", (req, res) => {
  try {
    const { name, seatingArrangementId, invigilation, dutyCount, warnings, dutySummary } = req.body;
    if (!name || !seatingArrangementId || !invigilation) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const assignments = readJSONFile(INVIGILATION_ASSIGNMENTS_FILE);
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const newAssignment = {
      id,
      name,
      seatingArrangementId,
      invigilation,
      dutyCount,
      warnings,
      dutySummary,
      createdAt
    };
    assignments.push(newAssignment);
    writeJSONFile(INVIGILATION_ASSIGNMENTS_FILE, assignments);
    res.status(201).json({ message: "Invigilation assignment saved successfully", id });
  } catch (error) {
    console.error("Error saving invigilation assignment:", error);
    res.status(500).json({ message: "Failed to save invigilation assignment" });
  }
});

// Fetch All Invigilation Assignments
app.get("/api/invigilation-assignments", (req, res) => {
  try {
    const assignments = readJSONFile(INVIGILATION_ASSIGNMENTS_FILE);
    res.json({ data: assignments });
  } catch (error) {
    console.error("Error fetching invigilation assignments:", error);
    res.status(500).json({ message: "Failed to fetch invigilation assignments" });
  }
});

// Fetch Single Invigilation Assignment by ID
app.get("/api/invigilation-assignments/:id", (req, res) => {
  try {
    const { id } = req.params;
    const assignments = readJSONFile(INVIGILATION_ASSIGNMENTS_FILE);
    const assignment = assignments.find(a => a.id === id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }
    res.json({ data: assignment });
  } catch (error) {
    console.error("Error fetching invigilation assignment:", error);
    res.status(500).json({ message: "Failed to fetch invigilation assignment" });
  }
});

// Endpoint to fetch saved invigilation assignments
app.get("/api/saved-invigilation-assignments", (req, res) => {
  try {
    const data = readJSONFile(SAVED_INVIGILATION_ASSIGNMENTS_FILE);
    res.json(data);
  } catch (error) {
    console.error("Error reading saved invigilation assignments:", error);
    res.status(500).json({ message: "Failed to fetch saved invigilation assignments" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
