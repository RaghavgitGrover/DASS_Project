import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import axios from "axios";
import { parseStringPromise } from "xml2js";
import fs from "fs";
import path from "path";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import morgan from "morgan";
import { convertTxtToJson } from "./text_js.js";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import invigilationRoutes from './invigilation.js';
import schedule from 'node-schedule';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a transporter for sending emails
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'talukdarahana@gmail.com',
    pass: 'dqfm aofn zvee kvlb'
  }
});

// File path for storing scheduled jobs
const SCHEDULED_JOBS_FILE = path.join(__dirname, 'data', 'scheduled_jobs.json');

// Function to load scheduled jobs from file
function loadScheduledJobs() {
  try {
    if (fs.existsSync(SCHEDULED_JOBS_FILE)) {
      const data = fs.readFileSync(SCHEDULED_JOBS_FILE, 'utf8');
      const fileData = JSON.parse(data);

      // Make sure jobs is an array
      const jobs = Array.isArray(fileData.jobs) ? fileData.jobs : [];

      // Restore each job
      jobs.forEach(jobData => {
        const jobId = jobData.id;
        const reminderTime = new Date(jobData.scheduledFor);

        // Only restore jobs that haven't been executed yet
        if (reminderTime > new Date()) {
          const job = schedule.scheduleJob(reminderTime, async () => {
            try {
              const subject = `Reminder for Invigilation Duty on ${jobData.date}`;
              const message = `Dear Faculty/Staff Member,

TEST EMAIL TEST EMAIL..

Date: ${jobData.date}
Time: ${jobData.time}
Room: ${jobData.roomNumber}

Please ensure you arrive on time and follow all invigilation protocols.

Best regards,
Examination Cell`;

              const mailOptions = {
                from: 'talukdarahana@gmail.com',
                to: jobData.email,
                subject,
                text: message
              };

              await transporter.sendMail(mailOptions);
              console.log(`Email sent to ${jobData.email} for duty on ${jobData.date}`);

              // Remove the job from storage after it's executed
              removeJobFromStorage(jobId);
            } catch (error) {
              console.error(`Error sending scheduled email to ${jobData.email}:`, error);
            }
          });

          // Store the job reference
          scheduledJobs.set(jobId, job);
        }
      });

      console.log(`Restored ${jobs.length} scheduled jobs`);
    }
  } catch (error) {
    console.error('Error loading scheduled jobs:', error);
  }
}

// Function to save scheduled jobs to file
function saveScheduledJobs() {
  try {
    const jobs = [];
    scheduledJobs.forEach((job, jobId) => {
      const [email, date, time, roomNumber] = jobId.split('_');
      const jobData = {
        id: jobId,
        email,
        date,
        time,
        roomNumber,
        scheduledFor: job.nextInvocation().toISOString()
      };
      jobs.push(jobData);
    });

    fs.writeFileSync(SCHEDULED_JOBS_FILE, JSON.stringify({ jobs }, null, 2));
    console.log(`Saved ${jobs.length} scheduled jobs to file`);
  } catch (error) {
    console.error('Error saving scheduled jobs:', error);
  }
}

// Function to remove a job from storage
function removeJobFromStorage(jobId) {
  try {
    if (fs.existsSync(SCHEDULED_JOBS_FILE)) {
      const data = fs.readFileSync(SCHEDULED_JOBS_FILE, 'utf8');
      const fileData = JSON.parse(data);

      // Filter out the job with the given ID
      fileData.jobs = fileData.jobs.filter(job => job.id !== jobId);

      fs.writeFileSync(SCHEDULED_JOBS_FILE, JSON.stringify(fileData, null, 2));
      console.log(`Removed job ${jobId} from storage`);
    }
  } catch (error) {
    console.error('Error removing job from storage:', error);
  }
}

// Load scheduled jobs when server starts
loadScheduledJobs();

// Save scheduled jobs when server shuts down
process.on('SIGINT', () => {
  console.log('Saving scheduled jobs before shutdown...');
  saveScheduledJobs();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Saving scheduled jobs before shutdown...');
  saveScheduledJobs();
  process.exit(0);
});

const app = express();

// Security and middleware setup
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests, please try again later"
});
app.use(limiter);

// Request tracking
app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Logging
app.use(morgan(':date[iso] :method :url :status :res[content-length] - :response-time ms - ID::req[id]'));

// Compression and body parsing
app.use(compression());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Define paths for data files
const DATA_DIR = "./data";
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SLOTS_JSON_FILE = path.join(DATA_DIR, "class_tt.json");
const STUDENT_COURSE_DATA_FILE = path.join(DATA_DIR, "student_course_data.json");
const FORMATTED_SLOTS_FILE = path.join(DATA_DIR, "formatted_slots.json");
const FILTERED_STUDENT_DATA_FILE = path.join(DATA_DIR, "filtered_student_data.json");
const TIMETABLES_FILE = path.join(DATA_DIR, "timetables.json");
const SEATING_ARRANGEMENTS_FILE = path.join(DATA_DIR, "seatingArrangements.json");

console.log('Timetables file path:', TIMETABLES_FILE);

// Add this before your routes
app.use((req, res, next) => {
  console.log(`[ROUTE] ${req.method} ${req.originalUrl}`);
  next();
});

// Create data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper functions
const readJSONFile = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return null;
  }
};

const writeJSONFile = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing to ${filePath}:`, error);
    return false;
  }
};

// Authentication Routes

// Signup route
app.post("/api/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Read existing users
    const users = readJSONFile(USERS_FILE) || [];

    // Check if user already exists
    if (users.some((user) => user.email === email)) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = {
      id: uuidv4(),
      email,
      password: hashedPassword,
      name,
      createdAt: new Date().toISOString(),
    };

    // Add user to array and save
    users.push(newUser);
    if (!writeJSONFile(USERS_FILE, users)) {
      return res.status(500).json({ message: "Failed to create user" });
    }

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Login route
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Read users
    const users = readJSONFile(USERS_FILE) || [];

    // Find user
    const user = users.find((u) => u.email === email);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get user by email
app.get("/api/user/:email", (req, res) => {
  try {
    const { email } = req.params;
    const users = readJSONFile(USERS_FILE) || [];
    const user = users.find((u) => u.email === email);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name || email.split('@')[0], // Fallback to email username if name is missing
        createdAt: user.createdAt || "N/A",
        lastLogin: user.lastLogin || "N/A",
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// CAS Authentication Routes

// CAS Authentication Routes with CORRECT CAS URL

// CAS Login - initiates the CAS authentication flow
app.get("/api/cas/login", (req, res) => {
  // Using the correct CAS URL from the working link you provided
  const casUrl = "https://login.iiit.ac.in/cas/login";
  const serviceUrl = "http://localhost:3000/api/cas/callback";

  console.log(`Redirecting to CAS login at: ${casUrl}?service=${encodeURIComponent(serviceUrl)}`);

  // Redirect the user to the CAS login page
  res.redirect(`${casUrl}?service=${encodeURIComponent(serviceUrl)}`);
});

// CAS Callback - handles ticket validation from CAS server
app.get("/api/cas/callback", async (req, res) => {
  const { ticket } = req.query;

  console.log("CAS callback received with ticket:", ticket);

  if (!ticket) {
    console.error("No CAS ticket provided in callback");
    return res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/login?error=no_ticket`);
  }

  try {
    // Call CAS server to validate the ticket - also using the correct domain
    const serviceUrl = "http://localhost:3000/api/cas/callback";
    const validateUrl = `https://login.iiit.ac.in/cas/serviceValidate?ticket=${ticket}&service=${encodeURIComponent(serviceUrl)}`;

    console.log("Validating CAS ticket at:", validateUrl);

    const response = await fetch(validateUrl);
    const xmlData = await response.text();

    console.log("Raw XML response from CAS:", xmlData);

    // Parse XML response from CAS server
    const result = await parseStringPromise(xmlData);
    console.log("Parsed CAS response:", JSON.stringify(result, null, 2));

    // Check if authentication was successful
    if (result["cas:serviceResponse"] && result["cas:serviceResponse"]["cas:authenticationSuccess"]) {
      // Extract user information - adjust path based on your CAS server response structure
      const username = result["cas:serviceResponse"]["cas:authenticationSuccess"][0]["cas:user"][0];
      const email = `${username}`;

      console.log("CAS authentication successful for username:", username, "email:", email);

      // Check if user exists in your system
      const users = readJSONFile(USERS_FILE) || [];
      let user = users.find((u) => u.email === email);

      // Create user if they don't exist
      if (!user) {
        console.log("Creating new user for:", email);
        user = {
          id: uuidv4(),
          email,
          username,
          name: username,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        };
        users.push(user);
        writeJSONFile(USERS_FILE, users);
      } else {
        console.log("User already exists:", email);
        // Update last login time for existing user
        user.lastLogin = new Date().toISOString();
        writeJSONFile(USERS_FILE, users);
      }

      // Redirect back to the frontend with success parameters
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

      // CRITICAL FIX: Redirect to root path with auth params
      const redirectUrl = `${frontendUrl}/?casLogin=success&email=${encodeURIComponent(email)}&username=${encodeURIComponent(username)}`;

      console.log("Redirecting to frontend:", redirectUrl);
      res.redirect(redirectUrl);
    } else {
      // Authentication failed
      console.error("CAS authentication failed - no success response from CAS server");
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      res.redirect(`${frontendUrl}/login?error=authentication_failed`);
    }
  } catch (error) {
    console.error("CAS callback error:", error);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/login?error=server_error&message=${encodeURIComponent(error.message)}`);
  }
});

// API endpoint to validate CAS ticket directly (for API clients)
app.get("/api/cas/validate", async (req, res) => {
  const { ticket } = req.query;

  console.log("CAS validate API called with ticket:", ticket);

  if (!ticket) {
    console.error("No CAS ticket provided in validate API");
    return res.status(400).json({
      success: false,
      message: "No ticket provided"
    });
  }

  try {
    // Call CAS server to validate the ticket - using correct domain
    const serviceUrl = "http://localhost:3000/api/cas/callback";
    const validateUrl = `https://login.iiit.ac.in/cas/serviceValidate?ticket=${ticket}&service=${encodeURIComponent(serviceUrl)}`;

    console.log("Validating CAS ticket at:", validateUrl);

    const response = await fetch(validateUrl);
    const xmlData = await response.text();

    console.log("Raw XML response from CAS:", xmlData);

    // Parse XML response
    const result = await parseStringPromise(xmlData);
    console.log("Parsed CAS response:", JSON.stringify(result, null, 2));

    // Check if authentication was successful
    if (result["cas:serviceResponse"] && result["cas:serviceResponse"]["cas:authenticationSuccess"]) {
      // Extract user information
      const username = result["cas:serviceResponse"]["cas:authenticationSuccess"][0]["cas:user"][0];
      const email = `${username}`;

      console.log("CAS validation successful for username:", username, "email:", email);

      // Check if user exists
      const users = readJSONFile(USERS_FILE) || [];
      let user = users.find((u) => u.email === email);

      // Create user if they don't exist
      if (!user) {
        console.log("Creating new user for:", email);
        user = {
          id: uuidv4(),
          email,
          username,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        };
        users.push(user);
        writeJSONFile(USERS_FILE, users);
      } else {
        console.log("User already exists:", email);
        // Update last login time for existing user
        user.lastLogin = new Date().toISOString();
        writeJSONFile(USERS_FILE, users);
      }

      // Return user info as JSON
      return res.json({
        success: true,
        email,
        username
      });
    } else {
      // Authentication failed
      console.error("CAS validation failed - no success response from CAS server");
      return res.status(401).json({
        success: false,
        message: "CAS authentication failed"
      });
    }
  } catch (error) {
    console.error("CAS validate error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during CAS validation: " + error.message
    });
  }
});

//  ----------------------------------------------------
//  Timetable Handlers
//  ----------------------------------------------------

// Route to fetch and process course data
app.get("/api/courses", async (req, res) => {
  try {
    // Step 1: Read slots data
    if (!fs.existsSync(SLOTS_JSON_FILE)) {
      return res.status(404).json({
        error: "Slots data not found",
        message: "Please process exam data first"
      });
    }

    let slotsDict;
    try {
      const slotsData = fs.readFileSync(SLOTS_JSON_FILE, "utf8");
      slotsDict = JSON.parse(slotsData);
    } catch (error) {
      console.error("Error parsing slots data:", error);
      return res.status(500).json({
        error: "Error processing slots data",
        message: error.message
      });
    }

    // Step 2: Read student course data
    if (!fs.existsSync(STUDENT_COURSE_DATA_FILE)) {
      return res.status(404).json({
        error: "Student data not found",
        message: "Please process exam data first"
      });
    }

    const studentData = JSON.parse(fs.readFileSync(STUDENT_COURSE_DATA_FILE, "utf8"));

    // Step 3: Create course mapping
    let courseMap = {};
    for (const key in studentData["Applications"]) {
      const entry = studentData["Applications"][key];
      courseMap[entry["coursecode"]] = entry["coursename"];
    }

    // Step 4: Transform slots data
    let formattedSlots = {};
    for (const slot in slotsDict) {
      formattedSlots[slot] = slotsDict[slot].map(courseCode => ({
        code: courseCode,
        name: courseMap[courseCode] || "Unknown Course"
      }));
    }

    // Step 5: Save formatted data
    fs.writeFileSync(FORMATTED_SLOTS_FILE, JSON.stringify(formattedSlots, null, 4));

    // Step 6: Return unique courses with their details
    let uniqueCourses = {};
    for (const slot in formattedSlots) {
      formattedSlots[slot].forEach(course => {
        if (!uniqueCourses[course.code]) {
          uniqueCourses[course.code] = {
            code: course.code,
            name: course.name,
            slots: []
          };
        }
        uniqueCourses[course.code].slots.push(slot);
      });
    }

    res.status(200).json({
      success: true,
      data: {
        courses: Object.values(uniqueCourses),
        totalCourses: Object.keys(uniqueCourses).length
      }
    });

  } catch (error) {
    console.error("Error processing course data:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// Route to add a course to slots
app.post("/api/add-course", async (req, res) => {
  try {
    console.log("Starting course addition process...");
    const { year, semester, courseCode, selectedCourses } = req.body;
    console.log(`Received request to add course: ${courseCode} for ${year} ${semester}`);

    if (!year || !semester || !courseCode) {
      console.log("Missing required parameters");
      return res.status(400).json({
        error: "Missing required parameters",
        message: "Please provide year, semester, and courseCode"
      });
    }

    // Step 1: Read student data from file
    console.log("Step 1: Reading student data from file...");
    const apiData = readJSONFile(STUDENT_COURSE_DATA_FILE);
    if (!apiData) {
      console.error("Failed to read student course data file");
      throw new Error("Failed to read student course data file!");
    }
    console.log("Successfully read student data file");

    // Step 2: Extract student records matching the course code
    console.log(`Step 2: Finding students enrolled in ${courseCode}...`);
    let newEntries = [];
    for (const key in apiData["Applications"]) {
      const student = apiData["Applications"][key];
      if (student["coursecode"] === courseCode) {
        newEntries.push({
          "rollnumber": student["rollnumber"],
          "coursecode": student["coursecode"],
          "coursename": student["coursename"]
        });
      }
    }
    console.log(`Found ${newEntries.length} students enrolled in ${courseCode}`);

    if (newEntries.length === 0) {
      console.log(`No students found for course ${courseCode}`);
      return res.status(404).json({
        error: "No students found",
        message: `No students found for course ${courseCode}`
      });
    }

    // Step 3: Update student course data file
    console.log("Step 3: Updating student course data file...");
    let jsonData = { "Applications": {} };
    if (fs.existsSync(FILTERED_STUDENT_DATA_FILE)) {
      const fileContent = fs.readFileSync(FILTERED_STUDENT_DATA_FILE, "utf8");
      jsonData = JSON.parse(fileContent);
    }

    // Append new course details
    let applications = jsonData["Applications"];
    for (const entry of newEntries) {
      applications[Object.keys(applications).length + 1] = entry;
    }

    // Fix serial numbering
    let reorderedApplications = {};
    let count = 1;
    for (const key in applications) {
      reorderedApplications[count] = applications[key];
      count++;
    }
    jsonData["Applications"] = reorderedApplications;
    console.log("Updated student course data with new entries");

    // Write updated JSON back to the file
    fs.writeFileSync(FILTERED_STUDENT_DATA_FILE, JSON.stringify(jsonData, null, 4));
    console.log("Successfully wrote updated data to file");

    // Step 4: Find suitable slot
    console.log("Step 4: Finding suitable slot...");
    if (!fs.existsSync(SLOTS_JSON_FILE)) {
      console.error("Slots file not found");
      return res.status(404).json({
        error: "Slots file not found",
        message: "Please process exam data first to create slots file"
      });
    }

    // Read and parse slots JSON file
    let slotsDict;
    try {
      const slotsData = fs.readFileSync(SLOTS_JSON_FILE, "utf8");
      slotsDict = JSON.parse(slotsData);
      console.log("Successfully read slots file");
    } catch (error) {
      console.error("Error parsing slots JSON file:", error);
      return res.status(500).json({
        error: "Error processing slots data",
        message: error.message
      });
    }

    // Find the least conflicting slot
    console.log("Looking for least conflicting slot...");
    let assignedSlot = null;
    for (const slot in slotsDict) {
      let slotCourses = slotsDict[slot];
      let conflict = false;

      // Check if the course conflicts with existing student courses
      for (const entry of newEntries) {
        let studentRoll = entry["rollnumber"];
        let studentCourses = Object.values(applications)
          .filter(s => s["rollnumber"] === studentRoll)
          .map(s => s["coursecode"]);

        if (studentCourses.some(course => slotCourses.includes(course))) {
          console.log(`Found conflict in slot ${slot} for student ${studentRoll}`);
          conflict = true;
          break;
        }
      }

      if (!conflict) {
        assignedSlot = slot;
        slotsDict[slot].push(courseCode);
        console.log(`Found suitable slot: ${slot}`);
        break;
      }
    }

    if (!assignedSlot) {
      console.log("No available slot found");
      return res.status(400).json({
        error: "No available slot",
        message: `No available slot found for ${courseCode}`
      });
    }

    // Write updated slots back to JSON file
    console.log("Writing updated slots to file...");
    fs.writeFileSync(SLOTS_JSON_FILE, JSON.stringify(slotsDict, null, 4));

    // Step 5: Update formatted slots file
    console.log("Step 5: Updating formatted slots file...");
    let formattedSlots = {};
    let courseMap = {};

    // Create course mapping from student data
    for (const key in jsonData["Applications"]) {
      const entry = jsonData["Applications"][key];
      courseMap[entry["coursecode"]] = entry["coursename"];
    }

    // Transform slots data with course names
    for (const slot in slotsDict) {
      formattedSlots[slot] = slotsDict[slot].map(courseCode => ({
        code: courseCode,
        name: courseMap[courseCode] || "Unknown Course"
      }));
    }

    // Update the formatted_slots.json file with the filtered data
    fs.writeFileSync(FORMATTED_SLOTS_FILE, JSON.stringify(formattedSlots, null, 2));

    // Then filter slots to only include selected courses if provided
    let filteredSlots = {};
    if (selectedCourses && Array.isArray(selectedCourses)) {
      for (const [slot, courses] of Object.entries(formattedSlots)) {
        const filteredCourses = courses.filter(course => selectedCourses.includes(course.code));
        if (filteredCourses.length > 0) {
          filteredSlots[slot] = filteredCourses;
        }
      }
    } else {
      // If no selected courses provided, use all courses
      filteredSlots = formattedSlots;
    }

    // Step 6: Return unique courses with their details
    console.log("Step 6: Preparing response with unique courses...");
    let uniqueCourses = {};
    for (const slot in filteredSlots) {
      filteredSlots[slot].forEach(course => {
        if (!uniqueCourses[course.code]) {
          uniqueCourses[course.code] = {
            code: course.code,
            name: course.name,
            slots: []
          };
        }
        uniqueCourses[course.code].slots.push(slot);
      });
    }

    console.log("Successfully completed course addition process");
    res.status(200).json({
      success: true,
      message: "Course added successfully",
      data: {
        courseCode,
        assignedSlot,
        studentsAdded: newEntries.length,
        courses: Object.values(uniqueCourses),
        totalCourses: Object.keys(uniqueCourses).length
      }
    });

  } catch (error) {
    console.error("Error adding course:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// Route to generate timetable
app.post("/api/generate-timetable", async (req, res) => {
  let examType = null;
  let selectedCourses = null;
  let unselectedCourses = null;
  let examConfig = null;

  try {
    const { type, selectedCourses: reqSelectedCourses, unselectedCourses: reqUnselectedCourses, examConfig: reqExamConfig } = req.body;
    examType = type;
    selectedCourses = reqSelectedCourses;
    unselectedCourses = reqUnselectedCourses;
    examConfig = reqExamConfig;

    if (!type || !["midsem", "endsem"].includes(type.toLowerCase())) {
      return res.status(400).json({
        error: "Invalid exam type",
        message: "Please provide a valid exam type (midsem/endsem)"
      });
    }

    if (!selectedCourses || !Array.isArray(selectedCourses) || selectedCourses.length === 0) {
      return res.status(400).json({
        error: "Invalid selected courses",
        message: "Please provide at least one selected course"
      });
    }

    if (!unselectedCourses || !Array.isArray(unselectedCourses)) {
      return res.status(400).json({
        error: "Invalid unselected courses",
        message: "Please provide unselected courses array"
      });
    }

    if (!examConfig || !examConfig.dates || !Array.isArray(examConfig.dates) || examConfig.dates.length === 0) {
      return res.status(400).json({
        error: "Invalid exam configuration",
        message: "Please provide valid exam dates"
      });
    }

    // Delete existing timetable files if they exist
    for (let i = 1; i <= 3; i++) {
      const files = [
        path.join(__dirname, `data/timetable_v${i}.json`),
        path.join(__dirname, `data/timetable_v${i}_stats.json`),
        path.join(__dirname, `data/timetable_v${i}_students.json`),
        path.join(__dirname, `data/timetable_v${i}.csv`)
      ];

      for (const file of files) {
        if (fs.existsSync(file)) {
          try {
            fs.unlinkSync(file);
            console.log(`Deleted existing file: ${file}`);
          } catch (error) {
            console.error(`Error deleting file ${file}:`, error);
          }
        }
      }
    }

    // Read the formatted slots data
    if (!fs.existsSync(FORMATTED_SLOTS_FILE)) {
      return res.status(404).json({
        error: "Formatted slots data not found",
        message: "Please process exam data first"
      });
    }

    // Read student data
    if (!fs.existsSync(STUDENT_COURSE_DATA_FILE)) {
      return res.status(404).json({
        error: "Student data not found",
        message: "Please process exam data first"
      });
    }

    const formattedSlotsData = JSON.parse(fs.readFileSync(FORMATTED_SLOTS_FILE, "utf8"));
    const studentData = JSON.parse(fs.readFileSync(STUDENT_COURSE_DATA_FILE, "utf8"));

    // First remove unselected courses from formatted slots
    const updatedFormattedSlots = {};
    for (const [slot, courses] of Object.entries(formattedSlotsData)) {
      const remainingCourses = courses.filter(course => !unselectedCourses.includes(course.code));
      if (remainingCourses.length > 0) {
        updatedFormattedSlots[slot] = remainingCourses;
      }
    }

    // Update the formatted_slots.json file with the filtered data
    fs.writeFileSync(FORMATTED_SLOTS_FILE, JSON.stringify(updatedFormattedSlots, null, 2));

    // Then filter slots to only include selected courses
    const filteredSlots = {};
    for (const [slot, courses] of Object.entries(updatedFormattedSlots)) {
      const filteredCourses = courses.filter(course => selectedCourses.includes(course.code));
      if (filteredCourses.length > 0) {
        filteredSlots[slot] = filteredCourses;
      }
    }

    // Create student courses map
    const studentCourses = new Map();
    for (const [_, application] of Object.entries(studentData.Applications)) {
      const rollNumber = application.rollnumber;
      const courseCode = application.coursecode;

      if (!studentCourses.has(rollNumber)) {
        studentCourses.set(rollNumber, new Set());
      }
      studentCourses.get(rollNumber).add(courseCode);
    }

    // Import the appropriate generator based on type
    let generator;
    if (type.toLowerCase() === "midsem") {
      const midsemModule = await import("./midsem_generator.js");
      generator = midsemModule.generateTimetable_full;
    } else {
      const endsemModule = await import("./endsem_timetable_generator.js");
      if (!endsemModule.generateTimetable_full) {
        throw new Error("generateTimetable function not found in endsem_timetable_generator.js");
      }
      generator = endsemModule.generateTimetable_full;
    }

    // Call the generator's main function
    const result = await generator();
    // Check if the result is valid
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Failed to generate timetable",
        data: result.data
      });
    }

    // Return the result
    res.status(200).json({
      success: true,
      message: `${type} timetable generated successfully`,
    });

  } catch (error) {
    console.error(`Error generating ${examType} timetable:`, error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
      details: {
        examType,
        selectedCoursesCount: selectedCourses?.length || 0,
        unselectedCoursesCount: unselectedCourses?.length || 0,
        examDatesCount: examConfig?.dates?.length || 0
      }
    });
  }
});

// Route to get a specific timetable version
app.get("/api/timetable_version/:version", async (req, res) => {
  try {
    const version = req.params.version;
    const timetablePath = path.join(__dirname, `data/timetable_v${version}.json`);
    const statsPath = path.join(__dirname, `data/timetable_v${version}_stats.json`);
    const studentsPath = path.join(__dirname, `data/timetable_v${version}_students.json`);

    // Check if files exist
    if (!fs.existsSync(timetablePath) || !fs.existsSync(statsPath)) {
      return res.status(404).json({
        success: false,
        message: `Timetable version ${version} not found`
      });
    }

    // Read timetable, stats, and students data
    const timetableData = JSON.parse(fs.readFileSync(timetablePath, 'utf8'));
    const statsData = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    const studentsData = fs.existsSync(studentsPath) ? JSON.parse(fs.readFileSync(studentsPath, 'utf8')) : null;

    // Send raw data
    res.status(200).json({
      success: true,
      data: {
        timetable: timetableData,
        stats: statsData,
        students: studentsData
      }
    });

  } catch (error) {
    console.error('Error fetching timetable:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch timetable data",
      error: error.message
    });
  }
});

// API Route to Check for Overlapping Courses
app.post('/api/checkConflicts', async (req, res) => {
  try {
      const { timetable, day, slot } = req.body;

      // Load student data asynchronously
      const studentData = JSON.parse(await fs.promises.readFile(FILTERED_STUDENT_DATA_FILE, 'utf-8'));

      // Debug: Log studentData to check its structure
      console.log("Student Data Loaded:", studentData);

      // Convert Applications object to an array of students
      const students = Object.values(studentData.Applications);

      const studentsWithConflicts = [];

      // Get the courses in the target slot
      const targetCourses = timetable.timetable[day].slots[slot - 1].courses.map(c => c.code);

      // Check each student for conflicts
      students.forEach(student => {
          // If a student is enrolled in a course in the target slot
          if (targetCourses.includes(student.coursecode)) {
              // Check if this student is enrolled in more than one course in the same slot (i.e., overlapping)
              const enrolledInSameSlot = students.filter(s => s.rollnumber === student.rollnumber && targetCourses.includes(s.coursecode));
              if (enrolledInSameSlot.length > 1) {
                  studentsWithConflicts.push(student.rollnumber); // or any other identifier, like student name
              }
          }
      });

      // If there are conflicts, return them in the response
      res.status(200).json({ conflicts: studentsWithConflicts });
  } catch (error) {
      console.error("Error checking conflicts:", error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Add new endpoint for getting timetable stats
app.post('/api/stats', async (req, res) => {
    try {
        const { timetable, examType } = req.body;
        if (!timetable || !timetable.timetable) {
            return res.status(400).json({ error: 'Timetable data is required' });
        }

        console.log('Exam type:', examType);
        //console.log('Timetable structure:', JSON.stringify(timetable.timetable, null, 2));

        // Initialize stats structure
        const stats = {
            totalStudents: {},
            details: {}
        };

        // Initialize all fields based on exam type
        if (examType === 'midsem') {
            stats.totalStudents = {
                twoConsecutive: 0,
                threeConsecutive: 0,
                fourConsecutive: 0,
                twoExamsPerDay: 0,
                threeExamsPerDay: 0
            };
            stats.details = {
                twoConsecutive: [],
                threeConsecutive: [],
                fourConsecutive: [],
                twoExamsPerDay: [],
                threeExamsPerDay: []
            };
        } else {
            stats.totalStudents = {
                twoConsecutive: 0
            };
            stats.details = {
                twoConsecutive: []
            };
        }

        // Read student data
        const studentData = readJSONFile('./data/filtered_student_data.json');
        if (!studentData || !studentData.Applications) {
            return res.status(500).json({ error: 'Failed to read student data' });
        }

        //console.log('Number of student applications:', Object.keys(studentData.Applications).length);

        // Group applications by rollnumber and collect course names
        const studentCourses = {};
        const courseNames = {};
        for (const [_, application] of Object.entries(studentData.Applications)) {
            const rollnumber = application.rollnumber;
            if (!studentCourses[rollnumber]) {
                studentCourses[rollnumber] = new Set();
            }
            studentCourses[rollnumber].add(application.coursecode);
            courseNames[application.coursecode] = application.coursename;
        }

        //console.log('Number of unique students:', Object.keys(studentCourses).length);

        // Process each student's schedule
        for (const [rollnumber, courses] of Object.entries(studentCourses)) {
            const studentSchedule = [];

            // Collect all exams for this student
            for (const [day, dayData] of Object.entries(timetable.timetable)) {
                for (let slotIndex = 0; slotIndex < dayData.slots.length; slotIndex++) {
                    const slot = dayData.slots[slotIndex];
                    if (slot.courses) {
                        for (const course of slot.courses) {
                            if (courses.has(course.code)) {
                                studentSchedule.push({
                                    day: parseInt(day.replace('day', '')),
                                    slot: slotIndex + 1, // Convert to 1-based slot number
                                    course: {
                                        code: course.code,
                                        name: courseNames[course.code] || course.code
                                    }
                                });
                            }
                        }
                    }
                }
            }

            // Only process if student has exams
            if (studentSchedule.length > 0) {
                //console.log(`Student ${rollnumber} has ${studentSchedule.length} exams scheduled`);
                //console.log('Student schedule:', JSON.stringify(studentSchedule, null, 2));

                // Sort schedule by day and slot
                studentSchedule.sort((a, b) => {
                    if (a.day !== b.day) return a.day - b.day;
                    return a.slot - b.slot;
                });

                // Track if student has each type of conflict
                let hasTwoConsecutive = false;
                let hasThreeConsecutive = false;
                let hasFourConsecutive = false;
                let hasTwoExamsPerDay = false;
                let hasThreeExamsPerDay = false;

                // Check for consecutive exams
                for (let i = 0; i < studentSchedule.length - 1; i++) {
                    const current = studentSchedule[i];
                    const next = studentSchedule[i + 1];

                    // Check if exams are on the same day and consecutive slots
                    if (current.day === next.day && next.slot === current.slot + 1) {
                        //console.log(`Found consecutive exams for student ${rollnumber}:`);
                        //console.log(`Day ${current.day}, Slot ${current.slot}: ${current.course.code}`);
                        //console.log(`Day ${next.day}, Slot ${next.slot}: ${next.course.code}`);

                        if (!hasTwoConsecutive) {
                            hasTwoConsecutive = true;
                            stats.totalStudents.twoConsecutive++;
                            stats.details.twoConsecutive.push({
                                rollNumber: rollnumber,
                                day: current.day,
                                courses: [[current.course, next.course]]
                            });
                            //console.log(`Added two consecutive for student ${rollnumber}`);
                        }

                        // Only check for more consecutive exams if it's midsem
                        if (examType === 'midsem' && i < studentSchedule.length - 2) {
                            const nextNext = studentSchedule[i + 2];
                            if (nextNext.day === next.day && nextNext.slot === next.slot + 1) {
                                if (!hasThreeConsecutive) {
                                    hasThreeConsecutive = true;
                                    stats.totalStudents.threeConsecutive++;
                                    stats.details.threeConsecutive.push({
                                        rollNumber: rollnumber,
                                        day: current.day,
                                        courses: [[current.course, next.course, nextNext.course]]
                                    });
                                }

                                if (i < studentSchedule.length - 3) {
                                    const nextNextNext = studentSchedule[i + 3];
                                    if (nextNextNext.day === nextNext.day && nextNextNext.slot === nextNext.slot + 1) {
                                        if (!hasFourConsecutive) {
                                            hasFourConsecutive = true;
                                            stats.totalStudents.fourConsecutive++;
                                            stats.details.fourConsecutive.push({
                                                rollNumber: rollnumber,
                                                day: current.day,
                                                courses: [[current.course, next.course, nextNext.course, nextNextNext.course]]
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Only check for multiple exams per day if it's midsem
                if (examType === 'midsem') {
                    const examsPerDay = {};
                    for (const exam of studentSchedule) {
                        if (!examsPerDay[exam.day]) {
                            examsPerDay[exam.day] = [];
                        }
                        examsPerDay[exam.day].push(exam.course);
                    }

                    for (const [day, courses] of Object.entries(examsPerDay)) {
                        if (courses.length >= 2 && !hasTwoExamsPerDay) {
                            hasTwoExamsPerDay = true;
                            stats.totalStudents.twoExamsPerDay++;
                            stats.details.twoExamsPerDay.push({
                                rollNumber: rollnumber,
                                day: parseInt(day),
                                courses: [courses]
                            });
                        }
                        if (courses.length >= 3 && !hasThreeExamsPerDay) {
                            hasThreeExamsPerDay = true;
                            stats.totalStudents.threeExamsPerDay++;
                            stats.details.threeExamsPerDay.push({
                                rollNumber: rollnumber,
                                day: parseInt(day),
                                courses: [courses]
                            });
                        }
                    }
                }
            }
        }

        //console.log('Final stats:', JSON.stringify(stats, null, 2));
        res.json(stats);
    } catch (error) {
        console.error('Error calculating stats:', error);
        res.status(500).json({ error: 'Failed to calculate statistics' });
    }
});

// Add new endpoint for getting student data
app.post('/api/students', async (req, res) => {
    try {
        const { timetable } = req.body;
        if (!timetable || !timetable.timetable) {
            return res.status(400).json({ error: 'Timetable data is required' });
        }

        // Read student data
        const studentData = readJSONFile('./data/filtered_student_data.json');
        if (!studentData || !studentData.Applications) {
            return res.status(500).json({ error: 'Failed to read student data' });
        }

        // Group applications by rollnumber and collect course names
        const studentCourses = {};
        const courseNames = {};
        for (const [_, application] of Object.entries(studentData.Applications)) {
            const rollnumber = application.rollnumber;
            if (!studentCourses[rollnumber]) {
                studentCourses[rollnumber] = new Set();
            }
            studentCourses[rollnumber].add(application.coursecode);
            courseNames[application.coursecode] = application.coursename;
        }

        // Process student data
        const processedStudentData = {};
        for (const [rollnumber, courses] of Object.entries(studentCourses)) {
            // Initialize schedule for this student with all days and slots
            const studentSchedule = {};
            const days = Object.keys(timetable.timetable).sort();
            const maxSlots = Math.max(...days.map(day => timetable.timetable[day].slots.length));

            // Initialize all days and slots
            for (const day of days) {
                studentSchedule[day] = {};
                for (let slotNum = 1; slotNum <= maxSlots; slotNum++) {
                    studentSchedule[day][`slot${slotNum}`] = [];
                }
            }

            // Fill in the courses for this student
            for (const [day, dayData] of Object.entries(timetable.timetable)) {
                for (let slotIndex = 0; slotIndex < dayData.slots.length; slotIndex++) {
                    const slot = dayData.slots[slotIndex];
                    if (slot.courses) {
                        for (const course of slot.courses) {
                            if (courses.has(course.code)) {
                                studentSchedule[day][`slot${slotIndex + 1}`] = [{
                                    code: course.code,
                                    name: courseNames[course.code] || course.code
                                }];
                            }
                        }
                    }
                }
            }

            processedStudentData[rollnumber] = studentSchedule;
        }

        res.json(processedStudentData);
    } catch (error) {
        console.error('Error processing student data:', error);
        res.status(500).json({ error: 'Failed to process student data' });
    }
});

// Route to save timetable
app.post("/api/saveTimetable", async (req, res) => {
    try {
        const { name, data } = req.body;

        if (!name || !data) {
            console.error("Name or data missing in request");
            return res.status(400).json({
                success: false,
                message: "Name and data are required"
            });
        }

        // Read existing timetables
        let timetables = [];
        if (fs.existsSync(TIMETABLES_FILE)) {
            const fileContent = fs.readFileSync(TIMETABLES_FILE, 'utf8');
            timetables = JSON.parse(fileContent);
        }

        // Check for duplicate names
        if (timetables.some(t => t.name === name)) {
            console.error("Duplicate timetable name:", name);
            return res.status(400).json({
                success: false,
                message: "A timetable with this name already exists"
            });
        }

        // Create new timetable entry
        const newTimetable = {
            id: uuidv4(),
            name,
            createdAt: new Date().toISOString(),
            data: {
                ...data,
                lastModified: new Date().toISOString()
            }
        };

        // Append new timetable to the list
        timetables.push(newTimetable);

        // Write back to file
        fs.writeFileSync(TIMETABLES_FILE, JSON.stringify(timetables, null, 2));
        console.log("Timetable written to file successfully:");

        res.status(200).json({
            success: true,
            message: "Timetable saved successfully",
            data: {
                id: newTimetable.id,
                name: newTimetable.name
            }
        });

    } catch (error) {
        console.error("Error saving timetable:", error);
        res.status(500).json({
            success: false,
            message: "Failed to save timetable",
            error: error.message
        });
    }
});

// Route to get all timetables
app.get("/api/timetables", async (req, res) => {
    try {
        // Read timetables from file
        let timetables = [];
        if (fs.existsSync(TIMETABLES_FILE)) {
            const fileContent = fs.readFileSync(TIMETABLES_FILE, 'utf8');
            timetables = JSON.parse(fileContent);
        }

        // Return list of timetables with basic info
        const timetableList = timetables.map(t => ({
            id: t.id,
            name: t.name,
            createdAt: t.createdAt,
            lastModified: t.data.lastModified
        }));
        console.log("Fetched timetables:", timetableList);
        if (timetableList.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No timetables found"
            });
        }

        res.status(200).json(timetableList);
    } catch (error) {
        console.error("Error fetching timetables:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch timetables",
            error: error.message
        });
    }
});

// Route to get a specific timetable by ID
app.get("/api/timetable/:id", async (req, res) => {
  console.log(`Requested !! timetable ID: "${req.params.id}"`);
    try {
        const { id } = req.params;
        console.log(`Requested timetable ID: "${id}"`);

        if (!fs.existsSync(TIMETABLES_FILE)) {
            console.error('Timetables file does not exist at:', TIMETABLES_FILE);
            return res.status(404).json({
                success: false,
                message: "No timetables file found"
            });
        }

        const rawData = fs.readFileSync(TIMETABLES_FILE, 'utf8');
        const timetables = JSON.parse(rawData);
        console.log('Available IDs:', timetables.map(t => t.id));

        const timetable = timetables.find(t =>
            t.id === id || t.id.toLowerCase() === id.toLowerCase()
        );

        if (!timetable) {
            console.error(`Timetable with ID "${id}" not found`);
            return res.status(404).json({
                success: false,
                message: `Timetable with ID "${id}" not found`
            });
        }

        res.status(200).json({
            success: true,
            data: timetable
        });
    } catch (error) {
        console.error('Error fetching timetable:', error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch timetable",
            error: error.message
        });
    }
});

// Route to delete a timetable
app.delete("/api/timetable_delete/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Read timetables from file
        let timetables = [];
        if (fs.existsSync(TIMETABLES_FILE)) {
            const fileContent = fs.readFileSync(TIMETABLES_FILE, 'utf8');
            timetables = JSON.parse(fileContent);
        }

        // Find the index of the timetable to delete
        const index = timetables.findIndex(t => t.id === id);

        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: "Timetable not found"
            });
        }

        // Remove the timetable from the array
        timetables.splice(index, 1);

        // Write the updated array back to file
        fs.writeFileSync(TIMETABLES_FILE, JSON.stringify(timetables, null, 2));

        res.status(200).json({
            success: true,
            message: "Timetable deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting timetable:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete timetable",
            error: error.message
        });
    }
});

app.get('/api/validate-json', (req, res) => {
  try {
      const data = fs.readFileSync(TIMETABLES_FILE, 'utf8');
      JSON.parse(data);
      res.json({ valid: true });
  } catch (error) {
      res.status(500).json({
          valid: false,
          error: error.message
      });
  }
});

//  ----------------------------------------------------
//  Profile Handlers
//  ----------------------------------------------------

app.get('/api/debug-id/:id', (req, res) => {
  const { id } = req.params;
  res.json({
      type: typeof id,
      value: id,
      length: id.length
  });
});

app.get('/api/debug-ids', (req, res) => {
  const rawData = fs.readFileSync(TIMETABLES_FILE, 'utf8');
  const timetables = JSON.parse(rawData);
  res.json(timetables.map(t => t.id));
});

//  ----------------------------------------------------
//  Seating Arrangement Handlers
//  ----------------------------------------------------

app.get("/api/rooms", async (req, res) => {
  console.log("Fetching rooms from IIIT API...");
  try {
    const response = await fetch(
      "https://ims-dev.iiit.ac.in/exam_schedule_api.php?typ=getRooms&key=IMS&secret=ExamDegunGts"
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch rooms from IIIT API: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (!data.ExamRooms || typeof data.ExamRooms !== "object") {
      console.error("Unexpected API response format for rooms:", data);
      throw new Error("Invalid response format from IIIT API for rooms");
    }

    // Process the rooms data into the desired format
    const processedRooms = Object.entries(data.ExamRooms).map(([id, room]) => ({
      id: id, // Keep the API's ID
      name: room.room, // Room name (e.g., "H-101")
      capacity: parseInt(room.capacity) || 0, // Ensure capacity is a number
      block: room.room.split(" ")[0] || "Unknown", // Extract block (e.g., "H")
    }));
    console.log(
      `Successfully fetched and processed ${processedRooms.length} rooms.`
    );
    res.json(processedRooms);
  } catch (error) {
    console.error("Error in GET /api/rooms:", error);
    res.status(500).json({
      message: "Failed to fetch rooms",
      error: error.message,
    });
  }
});

// Define detailed room preferences (capacities per section, preference order)
const ROOM_PREFERENCES = {
  // highest preference
  "H-101": {
    A: 15,
    B: 15,
    C: 15,
    D: 15,
    preference_order: 1,
    total_capacity: 60,
  },
  "H-102": {
    A: 15,
    B: 15,
    C: 15,
    D: 15,
    preference_order: 2,
    total_capacity: 60,
  },
  "H-103": {
    A: 24,
    B: 24,
    C: 24,
    D: 24,
    preference_order: 3,
    total_capacity: 96,
  },
  "H-104": {
    A: 24,
    B: 24,
    C: 24,
    D: 24,
    preference_order: 4,
    total_capacity: 96,
  },
  "H-201": {
    A: 15,
    B: 15,
    C: 15,
    D: 15,
    preference_order: 5,
    total_capacity: 60,
  },
  "H-202": {
    A: 15,
    B: 15,
    C: 15,
    D: 15,
    preference_order: 6,
    total_capacity: 60,
  },
  "H-203": {
    A: 24,
    B: 24,
    C: 24,
    D: 24,
    preference_order: 7,
    total_capacity: 96,
  },
  "H-204": {
    A: 24,
    B: 24,
    C: 24,
    D: 24,
    preference_order: 8,
    total_capacity: 96,
  },
  "H-301": {
    A: 15,
    B: 15,
    C: 15,
    D: 15,
    preference_order: 9,
    total_capacity: 60,
  },
  "H-302": {
    A: 15,
    B: 15,
    C: 15,
    D: 15,
    preference_order: 10,
    total_capacity: 60,
  },
  "H-303": {
    A: 24,
    B: 24,
    C: 24,
    D: 24,
    preference_order: 11,
    total_capacity: 96,
  },
  "H-304": {
    A: 24,
    B: 24,
    C: 24,
    D: 24,
    preference_order: 12,
    total_capacity: 96,
  },
  SH1: {
    A: 50,
    B: 50,
    C: 50,
    D: 50,
    preference_order: 13,
    total_capacity: 200,
  },
  SH2: {
    A: 50,
    B: 50,
    C: 50,
    D: 50,
    preference_order: 14,
    total_capacity: 200,
  },
  "H-105": {
    A: 50,
    B: 50,
    C: 50,
    D: 50,
    preference_order: 15,
    total_capacity: 200,
  },
  "H-205": {
    A: 50,
    B: 50,
    C: 50,
    D: 50,
    preference_order: 16,
    total_capacity: 200,
  },
  CR1: { A: 20, B: 20, C: 20, D: 20, preference_order: 17, total_capacity: 80 },
  // Example smaller rooms (adjust as needed from API/actuals)
  303: { A: 10, B: 10, C: 10, D: 10, preference_order: 18, total_capacity: 40 },
  319: { A: 10, B: 10, C: 10, D: 10, preference_order: 19, total_capacity: 40 },
  "A3 301": {
    A: 8,
    B: 8,
    C: 7,
    D: 7,
    preference_order: 20,
    total_capacity: 30,
  },
  "B4 301": {
    A: 8,
    B: 8,
    C: 7,
    D: 7,
    preference_order: 21,
    total_capacity: 30,
  },
  "B4 304": {
    A: 8,
    B: 8,
    C: 7,
    D: 7,
    preference_order: 22,
    total_capacity: 30,
  },
  "B6 309": {
    A: 15,
    B: 15,
    C: 15,
    D: 15,
    preference_order: 23,
    total_capacity: 60,
  },
  "Seminar Hall": {
    A: 45,
    B: 45,
    C: 45,
    D: 45,
    preference_order: 24,
    total_capacity: 180,
  },
  // Add other rooms as needed... ensure names match API output if possible
};

// Helper: Get room preference details
function getRoomDetails(roomName) {
  return ROOM_PREFERENCES[roomName] || null;
}

// Helper: Get capacity of a specific section (A, B, C, D)
function getSectionCapacity(roomName, sectionId, roomApiCapacity) {
  const details = getRoomDetails(roomName);
  if (details && details[sectionId] !== undefined) {
    return details[sectionId];
  }
  // Fallback: Distribute API capacity equally if no preference found
  return roomApiCapacity > 0 ? Math.floor(roomApiCapacity / 4) : 0;
}

// Helper: Get total room capacity (uses preference total_capacity if available)
function getTotalRoomCapacity(roomName, roomApiCapacity) {
  const details = getRoomDetails(roomName);
  if (details && details.total_capacity !== undefined) {
    return details.total_capacity;
  }
  return roomApiCapacity; // Fallback to API capacity
}

// Helper: Get course code in a section (returns null if empty)
function getSectionCourseCode(section) {
  return section.length > 0 ? section[0].courseCode : null;
}

// Helper: Get unique courses currently in a room's sections
function getUniqueCoursesInRoom(room) {
  const courses = new Set();
  if (room && room.sections) {
    // Add check for existence
    Object.values(room.sections).forEach((section) => {
      const courseCode = getSectionCourseCode(section);
      if (courseCode) {
        courses.add(courseCode);
      }
    });
  }
  return courses;
}

// CORRECTED Helper: Find best section for a student, ensuring single course per section
function findBestSectionForStudent(room, courseCode) {
  const sectionsPriority = ["A", "B", "C", "D"];
  const coursesInRoom = getUniqueCoursesInRoom(room);
  const isNewCourseForRoom = !coursesInRoom.has(courseCode);

  // Constraint 1: Max 3 unique courses per room
  if (isNewCourseForRoom && coursesInRoom.size >= 3) {
    return null;
  }

  // 1. Check sections already containing this course
  for (const sectionId of sectionsPriority) {
    const section = room.sections[sectionId];
    const sectionCapacity = getSectionCapacity(
      room.roomName,
      sectionId,
      room.capacity
    );
    const currentSectionCourse = getSectionCourseCode(section);

    if (
      currentSectionCourse === courseCode &&
      section.length < sectionCapacity
    ) {
      return sectionId; // Found space in section with same course
    }
  }

  // 2. Find an *empty* section, respecting pairing constraints
  for (const sectionId of ["A", "B", "C"]) {
    // Check A, B, C first
    const section = room.sections[sectionId];
    const sectionCapacity = getSectionCapacity(
      room.roomName,
      sectionId,
      room.capacity
    );

    if (section.length === 0 && sectionCapacity > 0) {
      // Check for pairing conflicts
      const courseInA = getSectionCourseCode(room.sections.A);
      const courseInC = getSectionCourseCode(room.sections.C);
      const courseInB = getSectionCourseCode(room.sections.B);
      let conflict = false;
      if (sectionId === "A" && courseInC && courseInC !== courseCode)
        conflict = true;
      if (sectionId === "C" && courseInA && courseInA !== courseCode)
        conflict = true;
      if (sectionId === "B") {
        const courseInD = getSectionCourseCode(room.sections.D);
        if (courseInD && courseInD !== courseCode) conflict = true;
      }
      if (!conflict) return sectionId; // Empty section without conflict found
    }
  }

  // Check empty section D last
  const sectionD = room.sections.D;
  const capacityD = getSectionCapacity(room.roomName, "D", room.capacity);
  if (sectionD.length === 0 && capacityD > 0) {
    const courseInB = getSectionCourseCode(room.sections.B);
    // Conflict if B has a *different* course
    if (!courseInB || courseInB === courseCode) {
      return "D"; // D is okay if B is empty or has the same course
    }
  }

  return null; // No suitable section found
}

app.post("/api/generateSeatingArrangement", async (req, res) => {
  // This is the full logic copied from the previous response
  try {
    console.log("Starting seating arrangement generation...");
    const { timetableId, roomIds } = req.body; // Expect timetable ID and array of selected room IDs
    if (!timetableId || !Array.isArray(roomIds)) {
      return res
        .status(400)
        .json({ message: "Missing timetableId or roomIds (must be an array)" });
    }
    console.log(
      `Generating for timetable ID: ${timetableId}, using max ${roomIds.length} rooms`
    );

    // --- 1. Fetch Timetable ---
    const timetables = readJSONFile(TIMETABLES_FILE);
    if (!timetables || !Array.isArray(timetables)) {
        console.error('Invalid timetables data format');
        return res.status(500).json({
            message: "Invalid timetables data format",
            error: "Timetables data is not in the expected format"
        });
    }

    const timetable = timetables.find(t => t.id === timetableId);
    if (!timetable) {
        console.error(`Timetable with ID "${timetableId}" not found`);
        return res.status(404).json({
            message: `Timetable with ID "${timetableId}" not found`
        });
    }

    // Check timetable structure more thoroughly
    if (!timetable.data || !timetable.data.timetable) {
        console.error('Invalid timetable structure');
        return res.status(500).json({
            message: "Invalid timetable structure",
            error: "Timetable data is missing required fields"
        });
    }

    // --- 2. Fetch and Process Rooms ---
    console.log("Fetching rooms data from API for seating...");
    let apiRoomsData;
    try {
      const response = await fetch(
        "https://ims-dev.iiit.ac.in/exam_schedule_api.php?typ=getRooms&key=IMS&secret=ExamDegunGts"
      );
      if (!response.ok)
        throw new Error(
          `Failed to fetch rooms from IIIT API: ${response.status} ${response.statusText}`
        );
      apiRoomsData = await response.json();
      if (
        !apiRoomsData.ExamRooms ||
        typeof apiRoomsData.ExamRooms !== "object"
      ) {
        throw new Error("Invalid rooms data format received from API");
      }
    } catch (fetchError) {
      console.error("Failed to fetch or parse rooms from API:", fetchError);
      return res.status(500).json({
        message: "Failed to fetch rooms from API",
        error: fetchError.message,
      });
    }

    // Filter API rooms based on the roomIds provided in the request
    const availableApiRooms = Object.entries(apiRoomsData.ExamRooms)
      .filter(([apiId]) => roomIds.includes(apiId)) // Filter by requested IDs
      .map(([id, room]) => ({
        id,
        name: room.room,
        capacity: parseInt(room.capacity) || 0, // API capacity
        block: room.room.split(" ")[0] || "Unknown",
      }));

    if (availableApiRooms.length === 0) {
      console.log(
        "No available rooms match the selected roomIds based on API response."
      );
      return res.status(400).json({
        message:
          "None of the selected rooms are available or found in the API.",
      });
    }
    console.log(
      `Found ${availableApiRooms.length} available rooms from API matching selection.`
    );

    // Calculate total capacity based *only* on selected & available rooms
    const totalCapacityAvailable = availableApiRooms.reduce(
      (sum, r) => sum + getTotalRoomCapacity(r.name, r.capacity),
      0
    );
    console.log(
      `Total calculated capacity across these rooms: ${totalCapacityAvailable}`
    );

    // --- 3. Prepare for Allocation ---
    const finalSeatingArrangement = {}; // { date: { slot: { ... } } }
    const metadata = {
      // Info about the run
      timetableName: timetable.name || `Timetable ${timetableId}`,
      totalRoomsSelectedAndAvailable: availableApiRooms.length,
      totalCapacityAvailable: totalCapacityAvailable,
      examDetails: {
        year: timetable.data.year || "N/A",
        semester: timetable.data.semester || "N/A",
        examType: timetable.data.examType || "N/A",
      },
    };
    const statistics = {}; // { date: { slot: { ... } } }

    // --- 4. Iterate Through Timetable Days and Slots ---
    const dates = Object.keys(timetable.data.timetable.timetable).sort();

    for (const date of dates) {
      finalSeatingArrangement[date] = {};
      statistics[date] = {};
      const dayData = timetable.data.timetable.timetable[date].slots;
      console.log(dayData);
      // Check if dayData is an object before proceeding
      if (typeof dayData !== "object" || dayData === null) {
        console.warn(`Invalid day data for date ${date}. Skipping.`);
        continue;
      }

      // Process each slot in the day
      const maxSlots = timetable.data.examType?.toLowerCase() === 'midsem' ? 4 : 2;
      for (let slot = 1; slot <= maxSlots; slot++) {
        const slotKey = `slot${slot}`;
        console.log(`\n--- Processing Date: ${date}, Slot: ${slotKey} ---`);

        // Access the slot data which is an array of courses
        const slotData = dayData[slot-1].courses || [];
        const coursesInSlotRaw = Array.isArray(slotData) ? slotData : [];

        // Ensure coursesInSlotRaw is an array before proceeding
        if (!Array.isArray(coursesInSlotRaw)) {
          console.warn(
            `Invalid courses data for ${date} Slot ${slotKey}. Expected array, got ${typeof coursesInSlotRaw}. Skipping slot.`
          );
          finalSeatingArrangement[date][slotKey] = {
            arrangements: [],
            totalStudents: 0,
            totalCapacity: totalCapacityAvailable,
            utilizationRate: 0,
            unassignedStudents: [],
            allocationMode: "Error - Invalid Input",
          };
          statistics[date][slotKey] = {
            totalStudents: 0,
            totalCapacity: totalCapacityAvailable,
            utilizationRate: 0,
            roomsUsedCount: 0,
            roomsUsed: [],
            unassignedCount: 0,
            unassignedDetails: [],
            allocationMode: "Error - Invalid Input",
          };
          continue;
        }

        // Filter/Prepare courses: Deep copy, filter empty, sort largest first
        let coursesToAllocate = JSON.parse(JSON.stringify(coursesInSlotRaw))
          .filter(
            (c) =>
              c && c.code && Array.isArray(c.students) && c.students.length > 0
          )
          .sort((a, b) => b.students.length - a.students.length);

        if (coursesToAllocate.length === 0) {
          console.log("No courses with students in this slot.");
          finalSeatingArrangement[date][slotKey] = {
            arrangements: [],
            totalStudents: 0,
            totalCapacity: totalCapacityAvailable,
            utilizationRate: 0,
            unassignedStudents: [],
            allocationMode: "N/A",
          };
          statistics[date][slotKey] = {
            totalStudents: 0,
            totalCapacity: totalCapacityAvailable,
            utilizationRate: 0,
            roomsUsedCount: 0,
            roomsUsed: [],
            unassignedCount: 0,
            unassignedDetails: [],
            allocationMode: "N/A",
          };
          continue;
        }

        let totalStudentsInSlot = coursesToAllocate.reduce(
          (sum, c) => sum + c.students.length,
          0
        );
        console.log(
          `Courses: ${coursesToAllocate
            .map((c) => `${c.code}(${c.students.length})`)
            .join(", ")}. Total: ${totalStudentsInSlot}`
        );

        // --- 5. Implement New Greedy Algorithm for Room Assignment ---
        console.log("\n--- Starting New Greedy Room Assignment Algorithm ---");

        // Sort rooms by preference (higher preference number first), then alphabetically
        const sortedRooms = [...availableApiRooms].sort((a, b) => {
          // First sort by preference (higher number first)
          const prefA = parseInt(a.preference) || 0;
          const prefB = parseInt(b.preference) || 0;
          if (prefB !== prefA) return prefB - prefA;
          // Then sort alphabetically by name
          return a.name.localeCompare(b.name);
        });

        console.log(`Room order by preference (highest first): ${sortedRooms.map(r => `${r.name}(${r.preference || 'null'})`).join(', ')}`);

        // Initialize room structures with sections
        const roomArrangements = sortedRooms.map(room => {
          // Calculate section capacities (divide room capacity into 4 parts)
          const sectionCapacity = Math.floor(room.capacity / 4);
          const extraCapacity = room.capacity % 4; // Handle remainder

          return {
            roomId: room.id,
            roomName: room.name,
            capacity: room.capacity,
            block: room.block,
            preference: room.preference,
            sections: {
              A: [],
              B: [],
              C: [],
              D: [] // D is used as backup
            },
            sectionCapacities: {
              A: sectionCapacity + (extraCapacity > 0 ? 1 : 0),
              B: sectionCapacity + (extraCapacity > 1 ? 1 : 0),
              C: sectionCapacity + (extraCapacity > 2 ? 1 : 0),
              D: sectionCapacity
            }
          };
        });

        console.log("Room section capacities:");
        roomArrangements.forEach(room => {
          console.log(`${room.roomName}: A=${room.sectionCapacities.A}, B=${room.sectionCapacities.B}, C=${room.sectionCapacities.C}, D=${room.sectionCapacities.D}`);
        });

        // Track unassigned students
        let unassignedStudents = [];

        // Process each course (already sorted by size - largest first)
        for (const course of coursesToAllocate) {
          console.log(`\nProcessing course ${course.code} with ${course.students.length} students`);

          // Create a copy of students to track assignments
          const studentsToAssign = [...course.students];

          // First pass: Assign to sections A, B, C in each room
          for (const room of roomArrangements) {
            if (studentsToAssign.length === 0) break;

            // Check if this course can be added to this room (max 3 unique courses per room)
            const coursesInRoom = new Set();
            for (const section of ['A', 'B', 'C']) {
              room.sections[section].forEach(seat => {
                if (seat.courseCode) coursesInRoom.add(seat.courseCode);
              });
            }

            // If room already has 3 different courses and this is a new course, skip this room
            if (coursesInRoom.size >= 3 && !coursesInRoom.has(course.code)) {
              console.log(`  Skipping room ${room.roomName} - already has 3 different courses`);
              continue;
            }

            // Try to assign students to sections A, B, C
            for (const section of ['A', 'B', 'C']) {
              // Check if this section is empty
              const sectionIsEmpty = room.sections[section].length === 0;

              if (sectionIsEmpty) {
                // Check if this course is already in another section (A, B, C)
                let courseAlreadyInOtherSection = false;
                for (const otherSection of ['A', 'B', 'C']) {
                  if (otherSection !== section && room.sections[otherSection].length > 0) {
                    const otherSectionCourse = room.sections[otherSection][0].courseCode;
                    if (otherSectionCourse === course.code) {
                      courseAlreadyInOtherSection = true;
                      break;
                    }
                  }
                }

                // Skip this section if the course is already in another section (A, B, C)
                if (courseAlreadyInOtherSection) {
                  console.log(`  Skipping section ${section} in room ${room.roomName} - course ${course.code} already in another section`);
                  continue;
                }

                // Calculate remaining capacity in this section
                const remainingCapacity = room.sectionCapacities[section];

                if (remainingCapacity > 0) {
                  console.log(`  Assigning to ${room.roomName} section ${section} (capacity: ${remainingCapacity})`);

                  // Assign as many students as possible to this section
                  const studentsToAssignToSection = studentsToAssign.splice(0, remainingCapacity);

                  // Add students to the section
                  studentsToAssignToSection.forEach((student, index) => {
                    room.sections[section].push({
                      seatNumber: `${section}${room.sections[section].length + 1}`,
                      student: student,
                      courseCode: course.code,
                      courseName: course.name
                    });
                  });

                  console.log(`    Assigned ${studentsToAssignToSection.length} students`);

                  if (studentsToAssign.length === 0) break;
                }
              }
            }
          }

          // Second pass: If we still have students, try to use section D
          // Prioritize rooms where section B has the same course
          if (studentsToAssign.length > 0) {
            console.log(`\n  Still have ${studentsToAssign.length} students to assign for ${course.code}, trying section D`);

            // First try rooms where section B has the same course
            for (const room of roomArrangements) {
              if (studentsToAssign.length === 0) break;

              // Check if section B has this course and section D is empty
              const sectionBHasThisCourse = room.sections.B.length > 0 && room.sections.B[0].courseCode === course.code;
              const sectionDIsEmpty = room.sections.D.length === 0;

              if (sectionBHasThisCourse && sectionDIsEmpty) {
                const remainingCapacity = room.sectionCapacities.D;

                console.log(`  Assigning to ${room.roomName} section D (matches section B course, capacity: ${remainingCapacity})`);

                // Assign as many students as possible to section D
                const studentsToAssignToSection = studentsToAssign.splice(0, remainingCapacity);

                // Add students to section D
                studentsToAssignToSection.forEach((student, index) => {
                  room.sections.D.push({
                    seatNumber: `D${room.sections.D.length + 1}`,
                    student: student,
                    courseCode: course.code,
                    courseName: course.name
                  });
                });

                console.log(`    Assigned ${studentsToAssignToSection.length} students to section D`);

                if (studentsToAssign.length === 0) break;
              }
            }

            // If we still have students, use any empty section D
            if (studentsToAssign.length > 0) {
              console.log(`\n  Still have ${studentsToAssign.length} students to assign for ${course.code}, trying any empty section D`);

              for (const room of roomArrangements) {
                if (studentsToAssign.length === 0) break;

                const sectionDIsEmpty = room.sections.D.length === 0;

                // Only use section D if it's empty and this course isn't already in sections A or C
                // (We allow it to match with section B)
                const courseInA = room.sections.A.length > 0 ? room.sections.A[0].courseCode : null;
                const courseInC = room.sections.C.length > 0 ? room.sections.C[0].courseCode : null;

                const conflictWithA = courseInA === course.code;
                const conflictWithC = courseInC === course.code;

                if (sectionDIsEmpty && !conflictWithA && !conflictWithC) {
                  const remainingCapacity = room.sectionCapacities.D;

                  console.log(`  Assigning to ${room.roomName} section D (capacity: ${remainingCapacity})`);

                  // Assign as many students as possible to section D
                  const studentsToAssignToSection = studentsToAssign.splice(0, remainingCapacity);

                  // Add students to section D
                  studentsToAssignToSection.forEach((student, index) => {
                    room.sections.D.push({
                      seatNumber: `D${room.sections.D.length + 1}`,
                      student: student,
                      courseCode: course.code,
                      courseName: course.name
                    });
                  });

                  console.log(`    Assigned ${studentsToAssignToSection.length} students to section D`);

                  if (studentsToAssign.length === 0) break;
                }
              }
            }
          }

          // If we still have unassigned students, add them to the unassigned list
          if (studentsToAssign.length > 0) {
            console.log(`  Unable to assign ${studentsToAssign.length} students for course ${course.code}`);
            unassignedStudents.push({
              courseCode: course.code,
              courseName: course.name,
              students: studentsToAssign
            });
          }
        }

        // Filter out empty rooms from the final arrangement
        const finalArrangementForSlot = roomArrangements.filter(room =>
          Object.values(room.sections).some(section => section.length > 0)
        );

        // Calculate statistics
        const totalAssignedStudents = totalStudentsInSlot -
          unassignedStudents.reduce((sum, c) => sum + c.students.length, 0);

        const utilization = totalCapacityAvailable > 0
          ? (totalAssignedStudents / totalCapacityAvailable) * 100
          : 0;

        // Store results
        finalSeatingArrangement[date][slotKey] = {
          arrangements: finalArrangementForSlot,
          totalStudents: totalAssignedStudents,
          totalCapacity: totalCapacityAvailable,
          utilizationRate: parseFloat(utilization.toFixed(2)),
          unassignedStudents: unassignedStudents,
          allocationMode: "Greedy by Course Size"
        };

        statistics[date][slotKey] = {
          totalStudents: totalAssignedStudents,
          totalCapacity: totalCapacityAvailable,
          utilizationRate: parseFloat(utilization.toFixed(2)),
          roomsUsedCount: finalArrangementForSlot.length,
          roomsUsed: finalArrangementForSlot.map(room => ({
            name: room.roomName,
            capacity: room.capacity,
            studentsPlaced: Object.values(room.sections).reduce(
              (sum, section) => sum + section.length, 0
            )
          })),
          unassignedCount: unassignedStudents.reduce(
            (sum, c) => sum + c.students.length, 0
          ),
          unassignedDetails: unassignedStudents,
          allocationMode: "Greedy by Course Size"
        };

        console.log(
          `Slot ${date} ${slotKey} finished. Assigned: ${totalAssignedStudents}. Unassigned: ${statistics[date][slotKey].unassignedCount}.`
        );
      } // End slot loop
    } // End date loop

    console.log("\n--- Seating arrangement generation complete ---");

    // --- 5. Send Response ---
    res.json({
      message: "Seating arrangement generated successfully",
      seatingArrangement: finalSeatingArrangement,
      metadata,
      statistics,
    });
  } catch (error) {
    console.error("Error in POST /api/generateSeatingArrangement:", error);
    console.error(error.stack); // Log stack trace for debugging
    res.status(500).json({
      message:
        "An internal error occurred during seating arrangement generation.",
      error: error.message, // Send error message back
    });
  }
});

app.post("/api/saveSeatingArrangement", (req, res) => {
    try {
        const { name, timetableId, seatingArrangement, metadata, statistics } = req.body;

        // --- Validation ---
        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({ message: "Invalid or missing 'name' for the seating arrangement." });
        }
        if (!timetableId) {
            return res.status(400).json({ message: "Missing 'timetableId' to link the arrangement." });
        }
        if (!seatingArrangement || typeof seatingArrangement !== 'object' || Object.keys(seatingArrangement).length === 0) {
            return res.status(400).json({ message: "Invalid or missing 'seatingArrangement' data." });
        }
        if (!metadata || typeof metadata !== 'object') {
            return res.status(400).json({ message: "Invalid or missing 'metadata'." });
        }
        if (!statistics || typeof statistics !== 'object') {
            return res.status(400).json({ message: "Invalid or missing 'statistics'." });
        }

        // --- Logic ---
        let savedArrangements = {};
        if (fs.existsSync(SEATING_ARRANGEMENTS_FILE)) {
            const fileContent = fs.readFileSync(SEATING_ARRANGEMENTS_FILE, 'utf8');
            if (fileContent.trim()) {
                savedArrangements = JSON.parse(fileContent);
            }
        }

        let nextId = 1;
        const existingIds = Object.keys(savedArrangements).map(Number).filter(id => !isNaN(id));
        if (existingIds.length > 0) {
            nextId = Math.max(...existingIds) + 1;
        }

        console.log(`Saving seating arrangement "${name.trim()}" with ID ${nextId}, linked to Timetable ID ${timetableId}`);

        savedArrangements[nextId] = {
            id: nextId,
            name: name.trim(),
            createdAt: new Date().toISOString(),
            timetableId: timetableId,
            seatingArrangement: seatingArrangement,
            metadata: metadata,
            statistics: statistics,
        };

        writeJSONFile(SEATING_ARRANGEMENTS_FILE, savedArrangements);

        res.status(201).json({
            message: "Seating arrangement saved successfully",
            id: nextId,
        });

    } catch (error) {
        console.error("Error in POST /api/saveSeatingArrangement:", error);
        res.status(500).json({ message: "Failed to save seating arrangement", error: error.message });
    }
});

// GET /api/seatingArrangements (List saved arrangements)
app.get("/api/seatingArrangements", (req, res) => {
    try {
        const dataPath = path.join(__dirname, 'data', 'seatingArrangements.json');
        fs.readFile(dataPath, 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading seatingArrangements.json:', err);
                return res.status(500).json({ error: 'Failed to read data file.' });
            }
            let arrangements;
            try {
                arrangements = parseArrangementsData(data).list;
            } catch (parseErr) {
                console.error('Error parsing seatingArrangements.json:', parseErr);
                return res.status(500).json({ error: parseErr.message });
            }
            res.json(arrangements);
        });
    } catch (error) {
        console.error("Error in GET /api/seatingArrangements:", error);
        res.status(500).json({ message: "Failed to fetch seating arrangements list", error: error.message });
    }
});

// GET /api/seatingArrangement/:id (Get by ID)
app.get("/api/seatingArrangement/:id", (req, res) => {
    try {
        const arrangementId = req.params.id;
        const dataPath = path.join(__dirname, 'data', 'seatingArrangements.json');
        fs.readFile(dataPath, 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading seatingArrangements.json:', err);
                return res.status(500).json({ error: 'Failed to read data file.' });
            }
            let arrangements;
            try {
                arrangements = parseArrangementsData(data).list;
            } catch (parseErr) {
                console.error('Error parsing seatingArrangements.json:', parseErr);
                return res.status(500).json({ error: parseErr.message });
            }
            const arrangement = arrangements.find(arr => String(arr.id) === String(arrangementId));
            if (!arrangement) {
                return res.status(404).json({ message: "Seating arrangement not found" });
            }
            res.json(arrangement);
        });
    } catch (error) {
        console.error(`Error fetching seating arrangement ID ${req.params.id}:`, error);
        res.status(500).json({ message: "Failed to fetch seating arrangement details", error: error.message });
    }
});

// DELETE /api/seatingArrangements/:id
app.delete('/api/seatingArrangements/:id', (req, res) => {
    const arrangementId = req.params.id;
    const dataPath = path.join(__dirname, 'data', 'seatingArrangements.json');
    fs.readFile(dataPath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading seatingArrangements.json:', err);
            return res.status(500).json({ error: 'Failed to read data file.' });
        }
        let arrangements, format, orig;
        try {
            const parsed = parseArrangementsData(data);
            arrangements = parsed.list;
            format = parsed.format;
            orig = parsed.orig;
        } catch (parseErr) {
            console.error('Error parsing seatingArrangements.json:', parseErr);
            return res.status(500).json({ error: parseErr.message });
        }
        const newArrangements = arrangements.filter(arr => String(arr.id) !== String(arrangementId));
        const toWrite = toOriginalFormat(newArrangements, format, orig);
        fs.writeFile(dataPath, JSON.stringify(toWrite, null, 2), 'utf8', (writeErr) => {
            if (writeErr) {
                console.error('Error writing seatingArrangements.json:', writeErr);
                return res.status(500).json({ error: 'Failed to update data file.' });
            }
            res.json({ success: true, message: 'Seating arrangement deleted.' });
        });
    });
});

function parseArrangementsData(data) {
    let json;
    try {
        json = JSON.parse(data);
    } catch (e) {
        throw new Error('Data file is corrupted.');
    }
    if (Array.isArray(json)) {
        return { list: json, format: 'array' };
    }
    if (json.arrangements && Array.isArray(json.arrangements)) {
        return { list: json.arrangements, format: 'arrangements' };
    }
    // Object-map: all keys are IDs and values are objects with id property
    if (
        typeof json === 'object' &&
        Object.values(json).every(
            v => typeof v === 'object' && v !== null && v.id !== undefined
        )
    ) {
        return { list: Object.values(json), format: 'objectMap', orig: json };
    }
    throw new Error('Data is not an array, an object with an arrangements array, or an object map.');
}

function toOriginalFormat(list, format, orig) {
    if (format === 'array') return list;
    if (format === 'arrangements') return { arrangements: list };
    if (format === 'objectMap') {
        const obj = {};
        list.forEach(item => { obj[String(item.id)] = item; });
        return obj;
    }
    return list;
}

//  ----------------------------------------------------
//  Invigilator Handlers
//  ----------------------------------------------------

const MAX_DUTIES = 2;
const MAX_DUTIES_WITH_RELAXATION = 3;

// Helper function to fetch invigilators
async function fetchInvigilators() {
  const response = await fetch('https://ims-dev.iiit.ac.in/exam_schedule_api.php?typ=getInvigilators&key=IMS&secret=ExamDegunGts');
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
}

// Helper function to get seating arrangement by ID
async function getSeatingArrangementById(inputId) {
  const rawData = JSON.parse(fs.readFileSync('./data/seatingArrangements.json'));
  const selected = rawData[inputId.toString()];
  if (!selected || !selected.seatingArrangement) {
    throw new Error(`❌ Seating arrangement with id=${inputId} not found.`);
  }
  return selected.seatingArrangement;
}

// Helper function to generate PDF
function generatePDF(assignments, filePath = './data/invigilation_assignments.pdf') {
  const doc = new jsPDF();
  const tableRows = [];

  for (const date of Object.keys(assignments)) {
    const slots = assignments[date];

    for (const slot of Object.keys(slots)) {
      const rooms = slots[slot];

      for (const roomId of Object.keys(rooms)) {
        const { roomName, invigilators } = rooms[roomId];

        const invigilatorList = invigilators
          .map(inv => `${inv.name} (${inv.type})`)
          .join(', ');

        tableRows.push([
          date,
          slot,
          `${roomName} (${roomId})`,
          invigilatorList
        ]);
      }
    }
  }

  autoTable(doc, {
    head: [['Date', 'Slot', 'Room No', 'Invigilators']],
    body: tableRows,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [0, 102, 204] },
    margin: { top: 20 },
  });

  doc.save(filePath);
  console.log(`📄 PDF generated: ${filePath}`);
  return filePath;
}

app.get('/api/invigilators', async (req, res) => {
  console.log
  try {
    const data = await fetchInvigilators();
    res.status(200).json(data);
  } catch (err) {
    console.error('Failed to fetch invigilators:', err);
    res.status(500).json({ error: 'Failed to fetch invigilators' });
  }
});

// Main API endpoint for assigning invigilators
app.post('/api/assign-invigilators', async (req, res) => {
  try {
    const { seatingId } = req.body; // Expect seating plan ID

    if (!seatingId) {
      return res.status(400).json({ success: false, message: 'Seating plan ID is required' });
    }

    const warnings = [];
    const assigned = {};
    const dutyCount = {};
    const slotAssigned = {};

    const invigilatorsData = await fetchInvigilators();
    const faculty = Object.values(invigilatorsData.Faculty).map(f => ({ name: f.name, type: 'faculty' }));
    const staff = Object.values(invigilatorsData.Staff).map(s => ({ name: s.name, type: 'staff' }));
    const allInvigilators = [...faculty, ...staff];

    const seatingArrangements = await getSeatingArrangementById(seatingId);

    const allSlots = new Set();
    for (const date in seatingArrangements) {
      for (const slot in seatingArrangements[date]) {
        allSlots.add(slot);
      }
    }

    const slotAvailability = {};
    for (const slot of allSlots) {
      slotAvailability[slot] = allInvigilators;
    }

    function isAvailable(slot, name) {
      return !slotAssigned[slot]?.has(name);
    }

    for (const date in seatingArrangements) {
      assigned[date] = {};

      const slotsForDate = Object.entries(seatingArrangements[date])
        .filter(([_, slotData]) => slotData && slotData.arrangements);

      for (const [slot, slotData] of slotsForDate) {
        console.log(`Processing Date: ${date}, Slot: ${slot}`);

        assigned[date][slot] = {};
        slotAssigned[slot] = new Set();

        const availableList = slotAvailability[slot] || [];
        const peoplePool = new Map(availableList.map(p => [p.name, p.type]));

        const activeRooms = slotData.arrangements.filter(room =>
          Object.values(room.sections).some(section => section.length > 0)
        );

        if (activeRooms.length === 0) {
          console.log("No active arrangements for Date: ${date}, Slot: ${slot}");
          continue;
        }

        const shuffledRooms = [...activeRooms].sort(() => Math.random() - 0.5);

        for (const room of shuffledRooms) {
          const { roomId, roomName } = room;
          let invigilators = [];

          const shuffledPool = [...peoplePool.entries()].sort(() => Math.random() - 0.5);

          let facultyAssigned = false;
          for (const [name, type] of shuffledPool) {
            if (type === 'faculty' && (dutyCount[name] || 0) < MAX_DUTIES && isAvailable(slot, name)) {
              invigilators.push(name);
              dutyCount[name] = (dutyCount[name] || 0) + 1;
              slotAssigned[slot].add(name);
              facultyAssigned = true;
              break;
            }
          }

          if (!facultyAssigned) {
            for (const [name, type] of shuffledPool) {
              if (type === 'faculty' && (dutyCount[name] || 0) < MAX_DUTIES_WITH_RELAXATION && isAvailable(slot, name)) {
                invigilators.push(name);
                dutyCount[name] = (dutyCount[name] || 0) + 1;
                slotAssigned[slot].add(name);
                warnings.push(`Date ${date}, Slot ${slot}, Room ${roomName}: Assigned faculty ${name} with ${dutyCount[name]} duties`);
                facultyAssigned = true;
                break;
              }
            }
          }

          let staffAssigned = false;
          for (const [name, type] of shuffledPool) {
            if (!invigilators.includes(name) && type === 'staff' && (dutyCount[name] || 0) < MAX_DUTIES && isAvailable(slot, name)) {
              invigilators.push(name);
              dutyCount[name] = (dutyCount[name] || 0) + 1;
              slotAssigned[slot].add(name);
              staffAssigned = true;
              break;
            }
          }

          if (!staffAssigned && invigilators.length > 0) {
            for (const [name, type] of shuffledPool) {
              if (!invigilators.includes(name) && type === 'staff' && (dutyCount[name] || 0) < MAX_DUTIES_WITH_RELAXATION && isAvailable(slot, name)) {
                invigilators.push(name);
                dutyCount[name] = (dutyCount[name] || 0) + 1;
                slotAssigned[slot].add(name);
                warnings.push(`Date ${date}, Slot ${slot}, Room ${roomName}: Assigned staff ${name} with ${dutyCount[name]} duties`);
                staffAssigned = true;
                break;
              }
            }
          }

          if (invigilators.length < 2) {
            for (const [name, type] of shuffledPool) {
              if (!invigilators.includes(name) && (dutyCount[name] || 0) < MAX_DUTIES && isAvailable(slot, name)) {
                invigilators.push(name);
                dutyCount[name] = (dutyCount[name] || 0) + 1;
                slotAssigned[slot].add(name);
                break;
              }
            }

            if (invigilators.length < 2) {
              for (const [name, type] of shuffledPool) {
                if (!invigilators.includes(name) && (dutyCount[name] || 0) < MAX_DUTIES_WITH_RELAXATION && isAvailable(slot, name)) {
                  invigilators.push(name);
                  dutyCount[name] = (dutyCount[name] || 0) + 1;
                  slotAssigned[slot].add(name);
                  warnings.push(`Date ${date}, Slot ${slot}, Room ${roomName}: Assigned ${type} ${name} with ${dutyCount[name]} duties`);
                  break;
                }
              }
            }
          }

          if (invigilators.length < 2) {
            warnings.push(`[WARNING] Date ${date}, Slot ${slot}, Room ${roomName}: Only ${invigilators.length} invigilator(s) assigned`);
          }

          if (!invigilators.some(name => peoplePool.get(name) === 'faculty')) {
            warnings.push(`[WARNING] Date ${date}, Slot ${slot}, Room ${roomName}: No faculty assigned`);
          }

          assigned[date][slot][roomId] = {
            roomName,
            invigilators: invigilators.map(name => ({
              name,
              type: peoplePool.get(name) || 'unknown'
            }))
          };
        }
      }
    }

    const dutySummary = { faculty: {}, staff: {} };
    for (const [person, count] of Object.entries(dutyCount)) {
      const type = allInvigilators.find(p => p.name === person)?.type || 'unknown';
      if (type === 'faculty') dutySummary.faculty[person] = count;
      else if (type === 'staff') dutySummary.staff[person] = count;
    }

    if (!fs.existsSync('./data')) {
      fs.mkdirSync('./data', { recursive: true });
    }

    fs.writeFileSync('./data/invigilation_assignments.json', JSON.stringify(assigned, null, 2));
    fs.writeFileSync('./data/duty_counts.json', JSON.stringify(dutyCount, null, 2));
    fs.writeFileSync('./data/warnings.json', JSON.stringify(warnings, null, 2));
    fs.writeFileSync('./data/duty_summary.json', JSON.stringify(dutySummary, null, 2));

    res.status(200).json({
      success: true,
      message: '✅ Invigilation assignment complete!',
      data: {
        assigned,
        dutyCount,
        warnings,
        dutySummary,
        files: {
          assignments: '/data/invigilation_assignments.json',
          dutyCounts: '/data/duty_counts.json',
          warnings: '/data/warnings.json',
          dutySummary: '/data/duty_summary.json'
        }
      }
    });

  } catch (error) {
    console.error('Error in assign-invigilators endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign invigilators',
      error: error.message
    });
  }
});

// GET endpoint to retrieve assignment results
app.get('/api/invigilation-assignments/:seatingId?', (req, res) => {
  try {
    let assignments;

    if (req.params.seatingId) {
      // If a specific seating ID is requested, filter assignments (implementation depends on how you store this)
      // This is a placeholder - you would implement the actual filtering logic
      const allAssignments = JSON.parse(fs.readFileSync('./data/invigilation_assignments.json'));
      assignments = Array.isArray(allAssignments) ? allAssignments : Object.values(allAssignments); // Replace with filtered data when implemented
    } else {
      // Return all assignments
      const allAssignments = JSON.parse(fs.readFileSync('./data/invigilation_assignments.json'));
      assignments = Array.isArray(allAssignments) ? allAssignments : Object.values(allAssignments);
    }

    res.status(200).json({
      success: true,
      data: assignments
    });
  } catch (error) {
    console.error('Error retrieving invigilation assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve invigilation assignments',
      error: error.message
    });
  }
});

// Download endpoint for PDF
app.get('/api/download/invigilation-pdf', (req, res) => {
  try {
    const pdfPath = path.resolve('./data/invigilation_assignments.pdf');

    if (fs.existsSync(pdfPath)) {
      res.download(pdfPath, 'invigilation_assignments.pdf');
    } else {
      res.status(404).json({
        success: false,
        message: 'PDF file not found'
      });
    }
  } catch (error) {
    console.error('Error downloading PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download PDF',
      error: error.message
    });
  }
});

app.post('/api/saveInvigilationAssignment', (req, res) => {
  try {
    const {
      name,
      seatingArrangementId,
      invigilation,
      dutyCount,
      warnings,
      dutySummary
    } = req.body;

    // Validate required fields
    if (!name || !seatingArrangementId || !invigilation) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, seatingArrangementId, or invigilation data'
      });
    }

    // Create new assignment object
    const newAssignment = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      name,
      seatingArrangementId,
      invigilation,
      dutyCount,
      warnings,
      dutySummary
    };

    // Save to JSON file
    const filePath = path.resolve('./data/invigilation_assignments.json');
    let existingData = {};

    // Read existing data if file exists
    if (fs.existsSync(filePath)) {
      existingData = JSON.parse(fs.readFileSync(filePath));
    }

    // Add new assignment
    existingData[newAssignment.id] = newAssignment;

    // Write updated data
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));

    res.status(201).json({
      success: true,
      id: newAssignment.id,
      message: 'Invigilation assignment saved successfully'
    });

  } catch (error) {
    console.error('Error saving invigilation assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save invigilation assignment',
      error: error.message
    });
  }
});

// Save a generated invigilation assignment (generated by algorithm, not user-saved)
app.post('/api/generated-invigilation-assignment', (req, res) => {
  try {
    const { seatingArrangementId, invigilation, dutyCount, warnings, dutySummary } = req.body;
    if (!seatingArrangementId || !invigilation) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    let assignments = [];
    const filePath = path.join(DATA_DIR, 'generated_invigilation_assignments.json');
    if (fs.existsSync(filePath)) {
      assignments = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const newAssignment = {
      id,
      seatingArrangementId,
      invigilation,
      dutyCount,
      warnings,
      dutySummary,
      createdAt
    };
    assignments.push(newAssignment);
    fs.writeFileSync(filePath, JSON.stringify(assignments, null, 2));
    res.status(201).json({ message: 'Generated invigilation assignment saved successfully', id });
  } catch (error) {
    console.error('Error saving generated invigilation assignment:', error);
    res.status(500).json({ message: 'Failed to save generated invigilation assignment' });
  }
});

// Save a user-saved invigilation assignment (confirmed by user)
app.post('/api/saved-invigilation-assignment', (req, res) => {
  try {
    const { name, seatingArrangementId, invigilation, dutyCount, warnings, dutySummary } = req.body;
    if (!name || !seatingArrangementId || !invigilation) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    let assignments = [];
    const filePath = path.join(DATA_DIR, 'saved_invigilation_assignments.json');
    if (fs.existsSync(filePath)) {
      assignments = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
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
    fs.writeFileSync(filePath, JSON.stringify(assignments, null, 2));
    res.status(201).json({ message: 'Saved invigilation assignment saved successfully', id });
  } catch (error) {
    console.error('Error saving saved invigilation assignment:', error);
    res.status(500).json({ message: 'Failed to save saved invigilation assignment' });
  }
});

// Fetch all generated invigilation assignments
app.get('/api/generated-invigilation-assignments', (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, 'generated_invigilation_assignments.json');
    let assignments = [];
    if (fs.existsSync(filePath)) {
      assignments = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    res.json({ data: assignments });
  } catch (error) {
    console.error('Error fetching generated invigilation assignments:', error);
    res.status(500).json({ message: 'Failed to fetch generated invigilation assignments' });
  }
});

// Fetch all saved invigilation assignments
app.get('/api/saved-invigilation-assignments', (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, 'saved_invigilation_assignments.json');
    let assignments = [];
    if (fs.existsSync(filePath)) {
      assignments = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    res.json({ data: assignments });
  } catch (error) {
    console.error('Error fetching saved invigilation assignments:', error);
    res.status(500).json({ message: 'Failed to fetch saved invigilation assignments' });
  }
});

// Fetch a single generated invigilation assignment by ID
app.get('/api/generated-invigilation-assignments/:id', (req, res) => {
  try {
    const { id } = req.params;
    const filePath = path.join(DATA_DIR, 'generated_invigilation_assignments.json');
    let assignments = [];
    if (fs.existsSync(filePath)) {
      assignments = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    const assignment = assignments.find(a => a.id === id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    res.json({ data: assignment });
  } catch (error) {
    console.error('Error fetching generated invigilation assignment:', error);
    res.status(500).json({ message: 'Failed to fetch generated invigilation assignment' });
  }
});

// Fetch a single saved invigilation assignment by ID
app.get('/api/saved-invigilation-assignments/:id', (req, res) => {
  try {
    const { id } = req.params;
    const filePath = path.join(DATA_DIR, 'saved_invigilation_assignments.json');
    let assignments = [];
    if (fs.existsSync(filePath)) {
      assignments = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    const assignment = assignments.find(a => a.id === id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    res.json({ data: assignment });
  } catch (error) {
    console.error('Error fetching saved invigilation assignment:', error);
    res.status(500).json({ message: 'Failed to fetch saved invigilation assignment' });
  }
});

// Delete a saved invigilation assignment by ID
app.delete('/api/saved-invigilation-assignments/:id', (req, res) => {
  try {
    const { id } = req.params;
    const filePath = path.join(DATA_DIR, 'saved_invigilation_assignments.json');

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'No assignments found' });
    }

    let assignments = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Check if the assignment exists
    if (!assignments[id]) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Delete the assignment
    delete assignments[id];

    // Write the updated assignments back to the file
    fs.writeFileSync(filePath, JSON.stringify(assignments, null, 2));

    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({ message: 'Failed to delete assignment' });
  }
});

// POST /api/save-invigilation-assignment to save to saved_invigilation_assignments.json
app.post('/api/save-invigilation-assignment', async (req, res) => {
  try {
    const DATA_PATH = path.join(__dirname, 'data', 'saved_invigilation_assignments.json');
    let assignments = {};
    if (fs.existsSync(DATA_PATH)) {
      assignments = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    }
    // Accept assignment object from frontend
    const { name, seatingArrangementId, invigilation, dutyCount, warnings, dutySummary } = req.body;
    if (!name || !seatingArrangementId || !invigilation) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    // Use a generated id (timestamp + random) as the key
    const id = `${Date.now()}_${Math.floor(Math.random()*10000)}`;
    assignments[id] = {
      id,
      name,
      seatingArrangementId,
      invigilation,
      dutyCount,
      warnings,
      dutySummary,
      savedAt: new Date().toISOString()
    };
    fs.writeFileSync(DATA_PATH, JSON.stringify(assignments, null, 2));
    res.json({ message: 'Invigilation assignment saved successfully', id });
  } catch (error) {
    console.error('Error saving invigilation assignment:', error);
    res.status(500).json({ message: 'Failed to save invigilation assignment' });
  }
});

//  ----------------------------------------------------
//  Invigilation Routes
//  ----------------------------------------------------

// Function to get faculty/staff email by ID
function getEmailById(id) {
  try {
    const filePath = path.join(__dirname, 'invigilation_api.json');
    console.log(`Reading email data from: ${filePath}`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Check in Faculty section first
    if (data.Faculty && data.Faculty[id]) {
      return data.Faculty[id].email;
    }

    // Then check in Staff section
    if (data.Staff && data.Staff[id]) {
      return data.Staff[id].email;
    }

    console.log(`No email found for ID: ${id}`);
    return null;
  } catch (error) {
    console.error('Error reading invigilation_api.json:', error);
    return null;
  }
}

// Store scheduled jobs with their IDs
const scheduledJobs = new Map();

// Function to schedule an email
function scheduleEmail(email, date, time, roomNumber) {
  console.log(`Attempting to schedule email for: ${email}, ${date}, ${time}, ${roomNumber}`);

  // Parse the date and time
  const [year, month, day] = date.split('-');
  const [hours, minutes] = time.split(':');

  // Create a Date object for the duty time
  const dutyTime = new Date(year, month - 1, day, hours, minutes);

  // Calculate the reminder time (24 hours before)
  const reminderTime = new Date(dutyTime);
  reminderTime.setHours(reminderTime.getHours() - 24);

  // Generate a unique job ID
  const jobId = `${email}_${date}_${time}_${roomNumber}`;
  console.log(`Generated job ID: ${jobId}`);
  console.log(`Scheduled for: ${reminderTime}`);

  // Schedule the email
  const job = schedule.scheduleJob(reminderTime, async () => {
    try {
      const subject = `Reminder for Invigilation Duty on ${date}`;
      const message = `Dear Faculty/Staff Member,

TEST EMAIL TEST EMAIL..

Date: ${date}
Time: ${time}
Room: ${roomNumber}

Please ensure you arrive on time and follow all invigilation protocols.

Best regards,
Examination Cell`;

      const mailOptions = {
        from: 'talukdarahana@gmail.com',
        to: email,
        subject,
        text: message
      };

      await transporter.sendMail(mailOptions);
      console.log(`Email sent to ${email} for duty on ${date}`);

      // Remove the job from storage after it's executed
      removeJobFromStorage(jobId);
    } catch (error) {
      console.error(`Error sending scheduled email to ${email}:`, error);
    }
  });

  // Store the job with its ID
  scheduledJobs.set(jobId, job);
  console.log(`Current number of scheduled jobs: ${scheduledJobs.size}`);

  // Save the job to the file
  saveScheduledJobs();

  return jobId;
}

// Function to cancel all scheduled emails
function cancelAllScheduledEmails() {
  let count = 0;
  for (const [jobId, job] of scheduledJobs) {
    job.cancel();
    scheduledJobs.delete(jobId);
    count++;
  }

  // Clear the jobs file
  try {
    fs.writeFileSync(SCHEDULED_JOBS_FILE, JSON.stringify({ jobs: [] }, null, 2));
    console.log('Cleared all scheduled jobs from file');
  } catch (error) {
    console.error('Error clearing scheduled jobs file:', error);
  }

  console.log(`Cancelled ${count} scheduled emails`);
  return count;
}

// Function to get all scheduled emails
function getScheduledEmails() {
  console.log(`Getting scheduled emails. Current jobs count: ${scheduledJobs.size}`);
  const scheduledEmailsList = [];
  for (const [jobId, job] of scheduledJobs) {
    if (!job) {
      console.log(`Skipping null job with ID: ${jobId}`);
      continue;
    }
    const [email, date, time, roomNumber] = jobId.split('_');
    try {
      const nextInvocation = job.nextInvocation();
      console.log(`Found scheduled email: ${email} for ${date} ${time}`);
      scheduledEmailsList.push({
        jobId,
        email,
        date,
        time,
        roomNumber,
        scheduledFor: nextInvocation
      });
    } catch (error) {
      console.error(`Error getting next invocation for job ${jobId}:`, error);
      // Add the job without the nextInvocation if it fails
      scheduledEmailsList.push({
        jobId,
        email,
        date,
        time,
        roomNumber,
        scheduledFor: null
      });
    }
  }
  return scheduledEmailsList;
}

// Endpoint to cancel all scheduled emails
app.post('/api/cancel-scheduled-emails', (req, res) => {
  try {
    const cancelledCount = cancelAllScheduledEmails();
    res.json({
      message: `Successfully cancelled ${cancelledCount} scheduled emails`,
      cancelledCount
    });
  } catch (error) {
    console.error('Error cancelling scheduled emails:', error);
    res.status(500).json({ message: 'Failed to cancel scheduled emails' });
  }
});

// Endpoint to get all scheduled emails
app.get('/api/scheduled-emails', (req, res) => {
  try {
    const scheduledEmails = getScheduledEmails();
    res.json({
      scheduledEmails,
      count: scheduledEmails.length
    });
  } catch (error) {
    console.error('Error getting scheduled emails:', error);
    res.status(500).json({ message: 'Failed to get scheduled emails' });
  }
});

// Schedule invigilation emails
app.post('/api/schedule-invigilation-emails', async (req, res) => {
  try {
    console.log('Received request to schedule emails');
    const { assignments } = req.body;
    console.log('Received assignments:', assignments);

    if (!assignments || !Array.isArray(assignments)) {
      console.error('Invalid assignments data:', assignments);
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Schedule emails for each assignment
    assignments.forEach(({ id, date, time, roomNumber }) => {
      console.log(`Processing assignment for ID: ${id}`);
      const email = getEmailById(id);
      if (email) {
        console.log(`Found email for ID ${id}: ${email}`);
        scheduleEmail(email, date, time, roomNumber);
      } else {
        console.error(`No email found for ID: ${id}`);
      }
    });

    console.log('Successfully processed all assignments');
    res.json({ message: 'Emails scheduled successfully' });
  } catch (error) {
    console.error('Error scheduling emails:', error);
    res.status(500).json({ message: 'Failed to schedule emails' });
  }
});

//  ----------------------------------------------------
//  Invigilation Routes
//  ----------------------------------------------------


app.use('/api/invigilation', invigilationRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`);
});