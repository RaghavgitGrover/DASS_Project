import express from "express";
import cors from "cors";
import axios from "axios";
import fs from "fs";
import path from "path";
import { convertTxtToJson } from "./text_js.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Define paths for data files
const DATA_DIR = "./data";
const SLOTS_JSON_FILE = path.join(DATA_DIR, "class_tt.json");
const STUDENT_COURSE_DATA_FILE = path.join(DATA_DIR, "student_course_data.json");
const FILTERED_STUDENT_DATA_FILE = path.join(DATA_DIR, "filtered_student_data.json");

// Create data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
  console.log("Creating data directory...");
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log("Data directory created successfully");
}

// Function to fetch student data from API
async function fetchStudentData(year, semester) {
  const apiUrl = `https://ims-dev.iiit.ac.in/exam_schedule_api.php?typ=getStudData&key=IMS&secret=ExamDegunGts&year=${year}&semester=${semester}`;
  console.log("API URL:", apiUrl);

  try {
    console.log("Making API request...");
    const response = await axios.get(apiUrl);
    const apiData = response.data;
    if (!apiData.Applications) {
      console.error("Invalid API response format:", JSON.stringify(apiData, null, 2));
      throw new Error("Student course data is not in the expected format");
    }

    console.log("Successfully fetched data from API");
    return apiData;
  } catch (error) {
    console.error("Error fetching data from API:", error.message);
    if (error.response) {
      console.error("API Error Response:", error.response.data);
      console.error("API Error Status:", error.response.status);
    }
    throw error;
  }
}

// Route to process exam data
app.post("/api/process-exam-data", async (req, res) => {
  try {
    const { content, year, semester } = req.body;

    if (!content || !year || !semester) {
      console.error("Missing required parameters:", { content: !!content, year, semester });
      return res.status(400).json({
        error: "Missing required parameters",
        message: "Please provide content, year, and semester",
        details: {
          content: !content ? "Missing" : "Present",
          year: !year ? "Missing" : year,
          semester: !semester ? "Missing" : semester
        }
      });
    }

    // Step 1: Convert text content to JSON
    console.log("Converting text content to JSON...");
    await convertTxtToJson(content, SLOTS_JSON_FILE);

    // Step 2: Read the converted slots JSON file
    console.log("Reading slots JSON file...");
    let slotsDict;
    const jsonData = fs.readFileSync(SLOTS_JSON_FILE, "utf8");
    slotsDict = JSON.parse(jsonData);
    console.log("Successfully parsed slots JSON with", Object.keys(slotsDict).length, "slots");

    // Step 3: Fetch student data from the API
    console.log("Fetching student data from API...");
    const apiData = await fetchStudentData(year, semester);
    const applications = apiData.Applications;
    console.log("Successfully fetched", Object.keys(applications).length, "student applications");

    // Step 4: Save the original API data
    console.log("Saving original API data...");
    fs.writeFileSync(STUDENT_COURSE_DATA_FILE, JSON.stringify(apiData, null, 4));
    console.log("Successfully saved original data to", STUDENT_COURSE_DATA_FILE);

    // Step 5: Filter student-course data to match only slot courses
    console.log("Filtering student-course data...");
    let filteredApplications = {};
    let totalCourses = 0;
    let matchedCourses = 0;

    for (let key in applications) {
      let entry = applications[key];
      let courseCode = entry.coursecode;
      totalCourses++;

      // Check if the course is in any slot
      if (Object.values(slotsDict).some(courses => courses.includes(courseCode))) {
        filteredApplications[key] = entry;
        matchedCourses++;
      }
    }

    console.log("Filtering results:", {
      totalCourses,
      matchedCourses,
      unmatchedCourses: totalCourses - matchedCourses
    });

    // Step 6: Save the filtered data to a separate file
    const filteredData = { "Applications": filteredApplications };
    fs.writeFileSync(FILTERED_STUDENT_DATA_FILE, JSON.stringify(filteredData, null, 4));
    console.log("Successfully saved filtered data to", FILTERED_STUDENT_DATA_FILE);

    console.log("Data processing completed successfully");

    // Send the filtered data in the response
    res.status(200).json({
      success: true,
      message: "Data processed successfully",
      data: filteredData
    });

  } catch (error) {
    console.error("Error processing exam data:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
      details: {
        stack: error.stack,
        type: error.name
      }
    });
  }
});

// Start server
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`API Server running on http://localhost:${PORT}`);
});