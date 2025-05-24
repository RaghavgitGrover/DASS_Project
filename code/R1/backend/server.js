// import express from "express";
// import cors from "cors";
// import bcrypt from "bcrypt";
// import fetch from "node-fetch";
// import { parseStringPromise } from "xml2js";
// import { generateTimetable } from "./timetableGenerator.js";
// import fs from "fs";
// import path from "path";
// import compression from "compression";
// import helmet from "helmet";
// import rateLimit from "express-rate-limit";
// import { v4 as uuidv4 } from "uuid";
// import morgan from "morgan";

// const app = express();

// app.use(helmet());
// app.use(
//   cors({
//     origin: process.env.FRONTEND_URL || "http://localhost:5173",
//     methods: ["GET", "POST", "PUT", "DELETE"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//     credentials: true,
//   })
// );
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 200, // Limit each IP to 200 requests per window
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: "Too many requests, please try again later",
// });
// app.use(limiter);
// app.use((req, res, next) => {
//   req.id = uuidv4();
//   res.setHeader("X-Request-ID", req.id);
//   next();
// });
// app.use(
//   morgan(
//     ":date[iso] :method :url :status :res[content-length] - :response-time ms - ID::req[id]"
//   )
// );

// // Compression should come after security middlewares
// app.use(compression());
// app.use(express.json({ limit: "50mb" }));
// app.use(express.urlencoded({ limit: "50mb", extended: true }));
// app.use(cors());

// // Define paths for data files
// const DATA_DIR = "./data";
// const USERS_FILE = path.join(DATA_DIR, "users.json");
// const TIMETABLES_FILE = path.join(DATA_DIR, "timetables.json");
// const COURSES_FILE = path.join(DATA_DIR, "courses.json");

// // Create data directory if it doesn't exist
// if (!fs.existsSync(DATA_DIR)) {
//   fs.mkdirSync(DATA_DIR);
// }

// // Helper functions for data persistence
// const readJSONFile = (filePath) => {
//   try {
//     if (!fs.existsSync(filePath)) {
//       fs.writeFileSync(
//         filePath,
//         JSON.stringify(filePath.includes("timetables.json") ? {} : [], null, 2)
//       );
//       return filePath.includes("timetables.json") ? {} : [];
//     }
//     const data = fs.readFileSync(filePath, "utf8");
//     return JSON.parse(data);
//   } catch (error) {
//     console.error(`Error reading ${filePath}:`, error);
//     return filePath.includes("timetables.json") ? {} : [];
//   }
// };

// const writeJSONFile = (filePath, data) => {
//   try {
//     fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
//   } catch (error) {
//     console.error(`Error writing to ${filePath}:`, error);
//   }
// };

// const processCoursesData = (rawData) => {
//   if (!rawData.Applications) return null;
//   const coursesMap = new Map();
//   Object.values(rawData.Applications).forEach((app) => {
//     if (app.coursecode && app.coursename && app.rollnumber) {
//       if (!coursesMap.has(app.coursecode)) {
//         coursesMap.set(app.coursecode, {
//           code: app.coursecode,
//           name: app.coursename,
//           students: new Set(),
//         });
//       }
//       coursesMap.get(app.coursecode).students.add(app.rollnumber);
//     }
//   });
//   return Array.from(coursesMap.values()).map((course) => ({
//     code: course.code,
//     name: course.name,
//     students: Array.from(course.students),
//   }));
// };

// app.post("/api/fetchCoursesData", async (req, res) => {
//   try {
//     const { year, semester, examType } = req.body;

//     // const response = await fetch(
//     //   `https://ims-dev.iiit.ac.in/exam_schedule_api.php?typ=getStudData&key=IMS&secret=ExamDegunGts&year=${year}&semester=${semester}`
//     // );

//     const response = await fetch("http://localhost:3001/data");

//     if (!response.ok) throw new Error("Failed to fetch data from IIIT API");
//     const rawData = await response.json();
//     const processedCourses = processCoursesData(rawData);
//     if (!processedCourses) throw new Error("Failed to process courses data");

//     const coursesData = {
//       year,
//       semester,
//       examType,
//       courses: processedCourses,
//     };

//     writeJSONFile(COURSES_FILE, coursesData);
//     res.json(coursesData);
//   } catch (error) {
//     console.error("Error fetching courses:", error);
//     res.status(500).json({ message: "Failed to fetch courses data" });
//   }
// });

// app.get("/api/coursesNames", (req, res) => {
//   try {
//     const coursesData = readJSONFile(COURSES_FILE);
//     if (!coursesData || !coursesData.courses) {
//       return res.status(404).json({
//         message: "No courses data available. Please fetch courses data first.",
//       });
//     }
//     res.json(coursesData);
//   } catch (error) {
//     console.error("Error getting course names:", error);
//     res.status(500).json({ message: "Failed to get course names" });
//   }
// });

// app.post("/api/signup", async (req, res) => {
//   const { username, email, password } = req.body;
//   console.log(`Signup request received for email: ${email}`);

//   const users = readJSONFile(USERS_FILE);
//   if (users.some((user) => user.email === email)) {
//     console.log(`Signup failed: Email ${email} already exists.`);
//     return res.status(400).json({ message: "Email already exists" });
//   }

//   const hashedPassword = await bcrypt.hash(password, 10);
//   const createdAt = new Date().toISOString();

//   users.push({
//     username,
//     email,
//     password: hashedPassword,
//     createdAt,
//     lastLogin: null,
//   });

//   writeJSONFile(USERS_FILE, users);
//   console.log(`Signup successful for email: ${email}`);
//   res.json({ message: "Signup successful" });
// });

// // Replace the CAS configuration in your server.js with this:

// const CAS_LOGIN_URL = "https://login.iiit.ac.in/cas/login";
// const CAS_VALIDATE_URL = "https://login.iiit.ac.in/cas/serviceValidate";
// // CRITICAL FIX: Change SERVICE_URL to point to frontend
// const SERVICE_URL = "http://localhost:5173/api/cas/callback";

// app.get("/api/cas/login", (req, res) => {
//   console.log("CAS login initiated");
//   const redirectUrl = `${CAS_LOGIN_URL}?service=${encodeURIComponent(
//     SERVICE_URL
//   )}`;
//   console.log("Redirecting to CAS:", redirectUrl);
//   res.redirect(redirectUrl);
// });

// // Keep your existing /api/cas/callback endpoint for backward compatibility
// app.get("/api/cas/callback", async (req, res) => {
//   const { ticket } = req.query;
//   console.log("CAS callback received at backend with ticket:", ticket);

//   if (!ticket) {
//     console.error("Missing CAS ticket");
//     return res.redirect(
//       "http://localhost:5173/login?error=Missing%20CAS%20ticket"
//     );
//   }

//   try {
//     const response = await fetch(
//       `${CAS_VALIDATE_URL}?ticket=${ticket}&service=${encodeURIComponent(
//         SERVICE_URL
//       )}`
//     );
//     const body = await response.text();
//     const parsed = await parseStringPromise(body);

//     const casResponse = parsed["cas:serviceResponse"];
//     const authenticationSuccess =
//       casResponse && casResponse["cas:authenticationSuccess"];

//     if (!authenticationSuccess) {
//       return res.redirect(
//         "http://localhost:5173/login?error=Authentication%20failed"
//       );
//     }

//     const email = authenticationSuccess[0]["cas:user"][0];
//     if (!email) {
//       return res.redirect(
//         "http://localhost:5173/login?error=Failed%20to%20extract%20email"
//       );
//     }

//     let users = readJSONFile(USERS_FILE);
//     let user = users.find((u) => u.email === email);

//     // Create user if not found
//     if (!user) {
//       user = {
//         email,
//         username: email.split("@")[0],
//         createdAt: new Date().toISOString(),
//         lastLogin: null,
//       };
//       users.push(user);
//       writeJSONFile(USERS_FILE, users);
//     }

//     user.lastLogin = new Date().toISOString();
//     writeJSONFile(USERS_FILE, users);

//     console.log(`CAS Login successful for email: ${email}`);

//     // Redirect to frontend with authentication success parameters
//     res.redirect(
//       `http://localhost:5173/cas-success?email=${encodeURIComponent(
//         email
//       )}&username=${encodeURIComponent(user.username)}`
//     );
//   } catch (error) {
//     console.error("CAS Callback Error:", error);
//     res.redirect("http://localhost:5173/login?error=Server%20error");
//   }
// });

// // ADD THIS NEW ENDPOINT: This will be called by your frontend CasCallback component
// app.get("/api/cas/validate", async (req, res) => {
//   const { ticket } = req.query;
//   console.log("CAS validate endpoint called with ticket:", ticket);

//   if (!ticket) {
//     return res.status(400).json({ message: "Missing CAS ticket" });
//   }

//   try {
//     const response = await fetch(
//       `${CAS_VALIDATE_URL}?ticket=${ticket}&service=${encodeURIComponent(
//         SERVICE_URL
//       )}`
//     );
//     const body = await response.text();
//     const parsed = await parseStringPromise(body);

//     const casResponse = parsed["cas:serviceResponse"];
//     const authenticationSuccess =
//       casResponse && casResponse["cas:authenticationSuccess"];

//     if (!authenticationSuccess) {
//       return res.status(401).json({ message: "Authenticating" }); // Message changed
//     }

//     const email = authenticationSuccess[0]["cas:user"][0];
//     if (!email) {
//       return res.status(401).json({ message: "Failed to extract email" });
//     }

//     let users = readJSONFile(USERS_FILE);
//     let user = users.find((u) => u.email === email);

//     // Create user if not found
//     if (!user) {
//       user = {
//         email,
//         username: email.split("@")[0],
//         createdAt: new Date().toISOString(),
//         lastLogin: null,
//       };
//       users.push(user);
//       writeJSONFile(USERS_FILE, users);
//     }

//     user.lastLogin = new Date().toISOString();
//     writeJSONFile(USERS_FILE, users);

//     console.log(`CAS validation successful for email: ${email}`);

//     // Return user info to frontend
//     res.json({
//       message: "Authentication successful",
//       email: user.email,
//       username: user.username,
//     });
//   } catch (error) {
//     console.error("CAS Validate Error:", error);
//     res.status(500).json({ message: "Server error during validation" });
//   }
// });

// app.post("/api/login", async (req, res) => {
//   const { email, password } = req.body;
//   console.log(`Login request received for email: ${email}`);

//   const users = readJSONFile(USERS_FILE);
//   const user = users.find((user) => user.email === email);

//   if (!user || !(await bcrypt.compare(password, user.password))) {
//     console.log(`Login failed: Invalid credentials for email: ${email}`);
//     return res.status(401).json({ message: "Invalid credentials" });
//   }

//   user.lastLogin = new Date().toISOString();
//   writeJSONFile(USERS_FILE, users);

//   console.log(`Login successful for email: ${email}`);
//   res.json({
//     message: "Login successful",
//     email: user.email,
//     username: user.username,
//   });
// });

// app.get("/api/user/:email", (req, res) => {
//   const { email } = req.params;
//   const users = readJSONFile(USERS_FILE);
//   const user = users.find((u) => u.email === email);

//   if (!user) {
//     return res.status(404).json({ message: "User not found" });
//   }

//   const { password, ...userDetails } = user;
//   res.json(userDetails);
// });

// app.post("/api/storeCoursesData", (req, res) => {
//   try {
//     const { year, semester, examType } = req.body;
//     const coursesData = readJSONFile(COURSES_FILE);

//     if (!coursesData || !coursesData.courses) {
//       return res.status(400).json({ message: "No courses data available" });
//     }

//     const updatedCoursesData = {
//       ...coursesData,
//       year,
//       semester,
//       examType,
//     };

//     writeJSONFile(COURSES_FILE, updatedCoursesData);

//     res.json({
//       message: "Courses data stored successfully",
//       data: updatedCoursesData,
//     });
//   } catch (error) {
//     console.error("Error storing courses data:", error);
//     res.status(500).json({ message: "Failed to store courses data" });
//   }
// });

// app.get("/api/fetchTimeTable", async (req, res) => {
//   try {
//     console.log("Received timetable generation request");
//     const selectedCourses = JSON.parse(req.query.selectedCourses);
//     const examConfig = JSON.parse(req.query.examConfig);

//     const coursesData = readJSONFile(COURSES_FILE);

//     if (!coursesData || !coursesData.courses) {
//       console.error("No courses data available");
//       return res.status(400).json({ error: "No courses data available" });
//     }

//     // Filter and map courses in a single pass
//     const selectedCoursesData = selectedCourses.reduce((acc, courseCode) => {
//       const course = coursesData.courses.find((c) => c.code === courseCode);
//       if (course) {
//         acc.push({
//           code: course.code,
//           name: course.name,
//           students: course.students,
//         });
//       }
//       return acc;
//     }, []);

//     if (selectedCoursesData.length === 0) {
//       console.error("No valid courses found in selection");
//       return res.status(400).json({ error: "No valid courses selected" });
//     }

//     if (
//       !examConfig.dates ||
//       !Array.isArray(examConfig.dates) ||
//       examConfig.dates.length === 0
//     ) {
//       console.error("No exam dates provided");
//       return res.status(400).json({ error: "Please select exam dates" });
//     }

//     const parsedDates = examConfig.dates.map((dateStr) => new Date(dateStr));
//     parsedDates.sort((a, b) => a - b);

//     // Generate timetables in parallel with a limit
//     const MAX_TIMETABLES = 3;
//     const timetablePromises = Array(MAX_TIMETABLES)
//       .fill()
//       .map(async () => {
//         const result = await generateTimetable(
//           selectedCoursesData,
//           parsedDates[0],
//           parsedDates,
//           examConfig.slots
//         );

//         // Optimize the response by only including necessary data
//         return {
//           timetable: result.timetable,
//           stats: {
//             totalCourses: result.stats.totalCourses,
//             scheduledCourses: result.stats.scheduledCourses,
//             unscheduledCourses: result.stats.unscheduledCourses,
//             year: coursesData.year,
//             semester: coursesData.semester,
//             examType: coursesData.examType,
//           },
//           fitness: result.fitness,
//         };
//       });

//     const timetables = await Promise.all(timetablePromises);

//     // Compress the response using a more efficient format
//     const response = {
//       timetables: timetables.map((result, index) => ({
//         id: index + 1,
//         ...result,
//       })),
//     };

//     // Set cache headers
//     res.set({
//       "Cache-Control": "public, max-age=3600",
//       "Content-Type": "application/json",
//     });

//     res.json(response);
//   } catch (error) {
//     console.error("Error generating timetables:", error);
//     res.status(500).json({ error: "Failed to generate timetables" });
//   }
// });

// app.post("/api/saveTimetable", (req, res) => {
//   try {
//     const { name, data } = req.body;
//     //console.log(data)
//     const timetables = readJSONFile(TIMETABLES_FILE);

//     // Find the next available ID
//     let nextId = 1;
//     while (timetables[nextId]) {
//       nextId++;
//     }

//     // Generate student statistics
//     const studentStats = {};
//     Object.entries(data.generatedTimetable).forEach(([date, slots]) => {
//       Object.entries(slots).forEach(([slot, courses]) => {
//         courses.forEach((course) => {
//           course.students.forEach((rollNumber) => {
//             if (!studentStats[rollNumber]) {
//               studentStats[rollNumber] = {
//                 totalExams: 0,
//                 daysWithMultipleExams: 0,
//                 consecutiveExams: 0,
//                 examSchedule: [],
//               };
//             }

//             const studentStat = studentStats[rollNumber];
//             studentStat.totalExams++;
//             studentStat.examSchedule.push({
//               date,
//               slot,
//               courseCode: course.code,
//             });
//           });
//         });
//       });
//     });

//     // Calculate conflicts for each student
//     Object.values(studentStats).forEach((stats) => {
//       const examsByDate = {};
//       stats.examSchedule.forEach((exam) => {
//         if (!examsByDate[exam.date]) {
//           examsByDate[exam.date] = [];
//         }
//         examsByDate[exam.date].push(exam);
//       });

//       Object.values(examsByDate).forEach((exams) => {
//         if (exams.length > 1) {
//           stats.daysWithMultipleExams++;
//         }
//       });

//       stats.examSchedule.sort((a, b) => {
//         const dateCompare = new Date(a.date) - new Date(b.date);
//         if (dateCompare === 0) {
//           return parseInt(a.slot) - parseInt(b.slot);
//         }
//         return dateCompare;
//       });

//       for (let i = 0; i < stats.examSchedule.length - 1; i++) {
//         const currentExam = stats.examSchedule[i];
//         const nextExam = stats.examSchedule[i + 1];

//         if (currentExam.date === nextExam.date) {
//           const currentSlot = parseInt(currentExam.slot);
//           const nextSlot = parseInt(nextExam.slot);
//           if (Math.abs(nextSlot - currentSlot) === 1) {
//             stats.consecutiveExams++;
//           }
//         }
//       }
//     });

//     timetables[nextId] = {
//       id: nextId,
//       name,
//       createdAt: new Date().toISOString(),
//       data: {
//         ...data,
//         stats: {
//           ...data.stats,
//           studentStats,
//         },
//       },
//     };

//     writeJSONFile(TIMETABLES_FILE, timetables);

//     res.json({
//       message: "Timetable saved successfully",
//       id: nextId,
//     });
//   } catch (error) {
//     console.error("Error saving timetable:", error);
//     res.status(500).json({ message: "Failed to save timetable" });
//   }
// });

// app.get("/api/timetables", (req, res) => {
//   try {
//     const timetables = readJSONFile(TIMETABLES_FILE);
//     const timetablesList = Object.values(timetables)
//       .filter((timetable) => timetable && timetable.data) // Filter out invalid entries
//       .map((timetable) => ({
//         id: timetable.id || 0,
//         name: timetable.name || "Untitled",
//         createdAt: timetable.createdAt || new Date().toISOString(),
//         year: timetable.data?.year || "N/A",
//         semester: timetable.data?.semester || "N/A",
//         examType: timetable.data?.examType || "N/A",
//         totalCourses: timetable.data?.stats?.totalCourses || 0,
//         scheduledCourses: timetable.data?.stats?.scheduledCourses || 0,
//       }));
//     res.json(timetablesList);
//   } catch (error) {
//     console.error("Error fetching timetables:", error);
//     res.status(500).json({
//       message: "Failed to fetch timetables",
//       error: error.message,
//     });
//   }
// });

// app.get("/api/timetable/:id", (req, res) => {
//   try {
//     const { id } = req.params;
//     const timetables = readJSONFile(TIMETABLES_FILE);
//     const timetable = timetables[id];

//     if (!timetable) {
//       return res.status(404).json({ message: "Timetable not found" });
//     }

//     res.json(timetable);
//   } catch (error) {
//     console.error("Error fetching timetable:", error);
//     res.status(500).json({ message: "Failed to fetch timetable" });
//   }
// });

// app.delete("/api/timetable/:id", (req, res) => {
//   try {
//     const { id } = req.params;
//     const timetables = readJSONFile(TIMETABLES_FILE);

//     if (!timetables[id]) {
//       return res.status(404).json({ message: "Timetable not found" });
//     }

//     delete timetables[id];
//     writeJSONFile(TIMETABLES_FILE, timetables);

//     res.json({ message: "Timetable deleted successfully" });
//   } catch (error) {
//     console.error("Error deleting timetable:", error);
//     res.status(500).json({ message: "Failed to delete timetable" });
//   }
// });

// // // Add rooms endpoint
// // app.get("/api/rooms", async (req, res) => {
// //   try {
// //     const response = await fetch(
// //       "https://ims-dev.iiit.ac.in/exam_schedule_api.php?typ=getRooms&key=IMS&secret=ExamDegunGts"
// //     );

// //     if (!response.ok) {
// //       throw new Error("Failed to fetch rooms from IIIT API");
// //     }

// //     const data = await response.json();

// //     // Check if data has the expected ExamRooms structure
// //     if (!data.ExamRooms || typeof data.ExamRooms !== "object") {
// //       console.error("Unexpected API response format:", data);
// //       throw new Error("Invalid response format from IIIT API");
// //     }

// //     // Process the rooms data
// //     const processedRooms = Object.entries(data.ExamRooms).map(([id, room]) => ({
// //       id: id,
// //       name: room.room,
// //       capacity: parseInt(room.capacity) || 0,
// //       block: room.room.split(" ")[0] || "Unknown",
// //     }));

// //     res.json(processedRooms);
// //   } catch (error) {
// //     console.error("Error fetching rooms:", error);
// //     res.status(500).json({
// //       message: "Failed to fetch rooms",
// //       error: error.message,
// //     });
// //   }
// // });

// // // Helper function to calculate section capacity
// // function calculateSectionCapacity(room) {
// //   return Math.floor(room.capacity / 4); // Divide room into 4 equal sections
// // }

// // // Room preferences with capacities and order
// // const ROOM_PREFERENCES = {
// //   // highest preference
// //   "H-101": { A: 15, B: 15, C: 15, D: 15, preference_order: 1 },
// //   "H-102": { A: 15, B: 15, C: 15, D: 15, preference_order: 2 },
// //   "H-103": { A: 24, B: 24, C: 24, D: 24, preference_order: 3 },
// //   "H-104": { A: 24, B: 24, C: 24, D: 24, preference_order: 4 },
// //   "H-201": { A: 15, B: 15, C: 15, D: 15, preference_order: 5 },
// //   "H-202": { A: 15, B: 15, C: 15, D: 15, preference_order: 6 },
// //   "H-203": { A: 24, B: 24, C: 24, D: 24, preference_order: 7 },
// //   "H-204": { A: 24, B: 24, C: 24, D: 24, preference_order: 8 },
// //   "H-301": { A: 15, B: 15, C: 15, D: 15, preference_order: 9 },
// //   "H-302": { A: 15, B: 15, C: 15, D: 15, preference_order: 10 },
// //   "H-303": { A: 24, B: 24, C: 24, D: 24, preference_order: 11 },
// //   "H-304": { A: 24, B: 24, C: 24, D: 24, preference_order: 12 },
// //   SH1: { A: 50, B: 50, C: 50, D: 50, preference_order: 13 },
// //   SH2: { A: 50, B: 50, C: 50, D: 50, preference_order: 14 },
// //   "H-105": { A: 50, B: 50, C: 50, D: 50, preference_order: 15 },
// //   "H-205": { A: 50, B: 50, C: 50, D: 50, preference_order: 16 },
// //   CR1: { A: 20, B: 20, C: 20, D: 20, preference_order: 17 },
// //   303: { A: 10, B: 10, C: 10, D: 10, preference_order: 18 },
// //   319: { A: 10, B: 10, C: 10, D: 10, preference_order: 19 },
// //   "A3 301": { A: 8, B: 8, C: 7, D: 7, preference_order: 20 },
// //   "B4 301": { A: 8, B: 8, C: 7, D: 7, preference_order: 21 },
// //   "B4 304": { A: 8, B: 8, C: 7, D: 7, preference_order: 22 },
// //   "B6 309": { A: 15, B: 15, C: 15, D: 15, preference_order: 23 },
// //   "Seminar Hall": { A: 45, B: 45, C: 45, D: 45, preference_order: 24 },
// //   // lowest preference
// // };

// // // Helper function to get room capacity and preference
// // function getRoomDetails(roomName) {
// //   return ROOM_PREFERENCES[roomName] || null;
// // }

// // // Helper function to check if sections can share same course
// // function canSectionsShareCourse(section1, section2) {
// //   return (
// //     (section1 === "A" && section2 === "C") ||
// //     (section1 === "C" && section2 === "A") ||
// //     (section1 === "B" && section2 === "D") ||
// //     (section1 === "D" && section2 === "B")
// //   );
// // }

// // // Helper function to get course code in a section
// // function getSectionCourseCode(section) {
// //   return section.length > 0 ? section[0].courseCode : null;
// // }

// // // Helper function to check if a room can accommodate more students
// // function canRoomAccommodateMoreStudents(room, courseCode) {
// //   const roomDetails = getRoomDetails(room.roomName);
// //   const totalCapacity = roomDetails
// //     ? roomDetails.A + roomDetails.B + roomDetails.C + roomDetails.D
// //     : room.capacity;

// //   const currentOccupancy = Object.values(room.sections).reduce(
// //     (sum, section) => sum + section.length,
// //     0
// //   );

// //   // Check if room has space
// //   if (currentOccupancy >= totalCapacity) {
// //     return false;
// //   }

// //   // Count unique courses in the room
// //   const coursesInRoom = new Set();
// //   Object.values(room.sections).forEach((section) => {
// //     if (section.length > 0) {
// //       coursesInRoom.add(section[0].courseCode);
// //     }
// //   });

// //   // If this is a new course, check if we can add another course
// //   if (!coursesInRoom.has(courseCode) && coursesInRoom.size >= 3) {
// //     return false;
// //   }

// //   return true;
// // }

// // // Helper function to get next available section in a room
// // function getNextAvailableSection(room, courseCode) {
// //   const sections = ["A", "B", "C", "D"];
// //   const roomDetails = getRoomDetails(room.roomName);

// //   // First try to find sections that already have this course
// //   for (const section of sections) {
// //     const sectionCourseCode = getSectionCourseCode(room.sections[section]);
// //     if (sectionCourseCode === courseCode) {
// //       const sectionCapacity = roomDetails
// //         ? roomDetails[section]
// //         : Math.floor(room.capacity / 4);
// //       if (room.sections[section].length < sectionCapacity) {
// //         return section;
// //       }
// //     }
// //   }

// //   // Then try to find empty sections
// //   for (const section of sections) {
// //     if (room.sections[section].length === 0) {
// //       return section;
// //     }
// //   }

// //   // Finally, try to find any section that has space and compatible course
// //   for (const section of sections) {
// //     const sectionCourseCode = getSectionCourseCode(room.sections[section]);
// //     if (!sectionCourseCode) continue;

// //     const sectionCapacity = roomDetails
// //       ? roomDetails[section]
// //       : Math.floor(room.capacity / 4);
// //     if (room.sections[section].length < sectionCapacity) {
// //       // Check if this section can share with existing sections
// //       let canShare = true;
// //       for (const otherSection of sections) {
// //         if (otherSection === section) continue;
// //         const otherCourseCode = getSectionCourseCode(
// //           room.sections[otherSection]
// //         );
// //         if (
// //           otherCourseCode &&
// //           otherCourseCode !== courseCode &&
// //           !canSectionsShareCourse(section, otherSection)
// //         ) {
// //           canShare = false;
// //           break;
// //         }
// //       }
// //       if (canShare) {
// //         return section;
// //       }
// //     }
// //   }

// //   return null;
// // }

// // // Place students in a room's sections according to rules
// // function placeStudentsInRoom(room, courseCode, courseName, students) {
// //   const remainingStudents = [...students];
// //   const roomDetails = getRoomDetails(room.roomName);

// //   while (remainingStudents.length > 0) {
// //     const section = getNextAvailableSection(room, courseCode);
// //     if (!section) break;

// //     const sectionCapacity = roomDetails
// //       ? roomDetails[section] - room.sections[section].length
// //       : Math.floor(room.capacity / 4) - room.sections[section].length;

// //     if (sectionCapacity <= 0) continue;

// //     const studentsToPlace = remainingStudents.splice(0, sectionCapacity);
// //     studentsToPlace.forEach((student) => {
// //       room.sections[section].push({
// //         seatNumber: room.sections[section].length + 1,
// //         student,
// //         courseCode,
// //         courseName,
// //       });
// //     });
// //   }

// //   return remainingStudents;
// // }

// // // Sort rooms by suitability for a course
// // function sortRoomsBySuitability(rooms) {
// //   return [...rooms].sort((a, b) => {
// //     const detailsA = getRoomDetails(a.name);
// //     const detailsB = getRoomDetails(b.name);

// //     // If both rooms are in preference list
// //     if (detailsA && detailsB) {
// //       return detailsA.preference_order - detailsB.preference_order;
// //     }
// //     // If only one room is in preference list
// //     if (detailsA) return -1;
// //     if (detailsB) return 1;
// //     // If neither room is in preference list, sort by name
// //     return a.name.localeCompare(b.name);
// //   });
// // }

// // app.post("/api/generateSeatingArrangement", async (req, res) => {
// //   try {
// //     console.log("Starting seating arrangement generation...");
// //     const { timetableId, roomIds } = req.body;
// //     console.log(
// //       `Generating for timetable: ${timetableId}, rooms: ${roomIds.length}`
// //     );

// //     // Fetch timetable details
// //     const timetables = readJSONFile(TIMETABLES_FILE);
// //     const timetable = timetables[timetableId];

// //     if (!timetable) {
// //       console.log("Timetable not found");
// //       return res.status(404).json({ message: "Timetable not found" });
// //     }

// //     console.log(`Processing timetable: ${timetable.name}`);

// //     // Fetch rooms data
// //     console.log("Fetching rooms data from API...");
// //     const response = await fetch(
// //       "https://ims-dev.iiit.ac.in/exam_schedule_api.php?typ=getRooms&key=IMS&secret=ExamDegunGts"
// //     );

// //     if (!response.ok) {
// //       throw new Error("Failed to fetch rooms from IIIT API");
// //     }

// //     const roomsData = await response.json();
// //     if (!roomsData.ExamRooms) {
// //       console.log("Invalid rooms data format received");
// //       throw new Error("Invalid rooms data format");
// //     }

// //     // Process and sort rooms by preference order
// //     console.log("Processing room data...");
// //     const selectedRooms = Object.entries(roomsData.ExamRooms)
// //       .filter(([id]) => roomIds.includes(id))
// //       .map(([id, room]) => ({
// //         id,
// //         name: room.room,
// //         capacity: parseInt(room.capacity) || 0,
// //         block: room.room.split(" ")[0] || "Unknown",
// //       }))
// //       .sort((a, b) => {
// //         const detailsA = getRoomDetails(a.name);
// //         const detailsB = getRoomDetails(b.name);

// //         // If both rooms are in preference list
// //         if (detailsA && detailsB) {
// //           return detailsA.preference_order - detailsB.preference_order;
// //         }
// //         // If only one room is in preference list
// //         if (detailsA) return -1;
// //         if (detailsB) return 1;
// //         // If neither room is in preference list, sort by name
// //         return a.name.localeCompare(b.name);
// //       });

// //     console.log(
// //       `Selected ${
// //         selectedRooms.length
// //       } rooms with total capacity: ${selectedRooms.reduce(
// //         (sum, r) => sum + r.capacity,
// //         0
// //       )}`
// //     );
// //     console.log(
// //       "Rooms in preference order:",
// //       selectedRooms.map((r) => r.name).join(", ")
// //     );

// //     // Generate seating arrangement
// //     const seatingArrangement = {};
// //     const totalCapacity = selectedRooms.reduce(
// //       (sum, room) => sum + room.capacity,
// //       0
// //     );

// //     // Sort rooms by preference
// //     const sortedRooms = sortRoomsBySuitability(selectedRooms);

// //     // Initialize room arrangements
// //     const roomArrangements = sortedRooms.map((room) => ({
// //       roomId: room.id,
// //       roomName: room.name,
// //       capacity: room.capacity,
// //       block: room.block,
// //       sections: {
// //         A: [],
// //         B: [],
// //         C: [],
// //         D: [],
// //       },
// //     }));

// //     // Process each day and slot
// //     const totalDays = Object.keys(timetable.data.generatedTimetable).length;
// //     let processingDay = 0;

// //     Object.entries(timetable.data.generatedTimetable).forEach(
// //       ([date, slots]) => {
// //         processingDay++;
// //         console.log(`Processing day ${processingDay}/${totalDays}: ${date}`);
// //         seatingArrangement[date] = {};

// //         Object.entries(slots).forEach(([slot, courses]) => {
// //           console.log(`Processing slot: ${slot}`);
// //           seatingArrangement[date][slot] = {
// //             arrangements: [],
// //             totalStudents: 0,
// //             totalCapacity,
// //             utilizationRate: 0,
// //             unassignedStudents: [],
// //           };

// //           // Sort courses by number of students (descending)
// //           const sortedCourses = [...courses].sort(
// //             (a, b) => b.students.length - a.students.length
// //           );
// //           console.log(`Processing ${sortedCourses.length} courses`);

// //           // Process each course
// //           sortedCourses.forEach((course) => {
// //             let remainingStudents = [...course.students];

// //             // Try to place students in each room
// //             for (const room of roomArrangements) {
// //               if (remainingStudents.length === 0) break;

// //               if (canRoomAccommodateMoreStudents(room, course.code)) {
// //                 remainingStudents = placeStudentsInRoom(
// //                   room,
// //                   course.code,
// //                   course.name,
// //                   remainingStudents
// //                 );
// //               }
// //             }

// //             // Add remaining students to unassigned list
// //             if (remainingStudents.length > 0) {
// //               console.log(
// //                 `${remainingStudents.length} students of ${course.code} could not be placed`
// //               );
// //               seatingArrangement[date][slot].unassignedStudents.push({
// //                 courseCode: course.code,
// //                 courseName: course.name,
// //                 students: remainingStudents,
// //               });
// //             }
// //           });

// //           // Add only used rooms to the arrangement
// //           seatingArrangement[date][slot].arrangements = roomArrangements
// //             .filter((room) =>
// //               Object.values(room.sections).some((section) => section.length > 0)
// //             )
// //             .sort((a, b) => {
// //               const detailsA = getRoomDetails(a.roomName);
// //               const detailsB = getRoomDetails(b.roomName);

// //               if (detailsA && detailsB) {
// //                 return detailsA.preference_order - detailsB.preference_order;
// //               }
// //               if (detailsA) return -1;
// //               if (detailsB) return 1;
// //               return a.roomName.localeCompare(b.roomName);
// //             });

// //           // Calculate statistics
// //           const totalAssignedStudents = seatingArrangement[date][
// //             slot
// //           ].arrangements.reduce(
// //             (sum, room) =>
// //               sum +
// //               Object.values(room.sections).reduce(
// //                 (sectionSum, section) => sectionSum + section.length,
// //                 0
// //               ),
// //             0
// //           );

// //           seatingArrangement[date][slot].totalStudents = totalAssignedStudents;
// //           seatingArrangement[date][slot].utilizationRate =
// //             (totalAssignedStudents / totalCapacity) * 100;
// //         });
// //       }
// //     );

// //     console.log("Seating arrangement generation complete");

// //     // Add additional statistics to the response
// //     const metadata = {
// //       timetableName: timetable.name,
// //       totalRooms: selectedRooms.length,
// //       totalCapacity,
// //       examDetails: {
// //         year: timetable.data.year,
// //         semester: timetable.data.semester,
// //         examType: timetable.data.examType,
// //       },
// //     };

// //     // Calculate per-slot statistics
// //     const slotStatistics = {};
// //     Object.entries(seatingArrangement).forEach(([date, slots]) => {
// //       slotStatistics[date] = {};
// //       Object.entries(slots).forEach(([slot, slotData]) => {
// //         const stats = {
// //           totalStudents: slotData.totalStudents,
// //           totalCapacity: slotData.totalCapacity,
// //           utilizationRate: slotData.utilizationRate,
// //           roomsUsed: slotData.arrangements.map((room) => ({
// //             name: room.roomName,
// //             capacity: room.capacity,
// //             studentsPlaced: Object.values(room.sections).reduce(
// //               (sum, section) => sum + section.length,
// //               0
// //             ),
// //           })),
// //           unassignedStudents: slotData.unassignedStudents || [],
// //         };
// //         slotStatistics[date][slot] = stats;
// //       });
// //     });

// //     res.json({
// //       message: "Seating arrangement generated successfully",
// //       seatingArrangement,
// //       metadata,
// //       statistics: slotStatistics,
// //     });
// //   } catch (error) {
// //     console.error("Error generating seating arrangement:", error);
// //     res.status(500).json({ message: "Failed to generate seating arrangement" });
// //   }
// // });

// // GET /api/rooms - Fetches available rooms from the IIIT API
// app.get("/api/rooms", async (req, res) => {
//   try {
//     const response = await fetch(
//       "https://ims-dev.iiit.ac.in/exam_schedule_api.php?typ=getRooms&key=IMS&secret=ExamDegunGts"
//     );

//     if (!response.ok) {
//       throw new Error(
//         `Failed to fetch rooms from IIIT API: ${response.statusText}`
//       );
//     }

//     const data = await response.json();

//     // Check if data has the expected ExamRooms structure
//     if (!data.ExamRooms || typeof data.ExamRooms !== "object") {
//       console.error("Unexpected API response format:", data);
//       throw new Error("Invalid response format from IIIT API");
//     }

//     // Process the rooms data
//     const processedRooms = Object.entries(data.ExamRooms).map(([id, room]) => ({
//       id: id,
//       name: room.room,
//       // Use provided capacity, default to 0 if missing/invalid
//       capacity: parseInt(room.capacity) || 0,
//       block: room.room.split(" ")[0] || "Unknown",
//     }));

//     res.json(processedRooms);
//   } catch (error) {
//     console.error("Error fetching rooms:", error);
//     res.status(500).json({
//       message: "Failed to fetch rooms",
//       error: error.message,
//     });
//   }
// });

// // --- Configuration and Helpers ---

// // Room preferences with section capacities and preference order
// // Added total_capacity for convenience in sorting/calculations
// const ROOM_PREFERENCES = {
//   // highest preference
//   "H-101": {
//     A: 15,
//     B: 15,
//     C: 15,
//     D: 15,
//     preference_order: 1,
//     total_capacity: 60,
//   },
//   "H-102": {
//     A: 15,
//     B: 15,
//     C: 15,
//     D: 15,
//     preference_order: 2,
//     total_capacity: 60,
//   },
//   "H-103": {
//     A: 24,
//     B: 24,
//     C: 24,
//     D: 24,
//     preference_order: 3,
//     total_capacity: 96,
//   },
//   "H-104": {
//     A: 24,
//     B: 24,
//     C: 24,
//     D: 24,
//     preference_order: 4,
//     total_capacity: 96,
//   },
//   "H-201": {
//     A: 15,
//     B: 15,
//     C: 15,
//     D: 15,
//     preference_order: 5,
//     total_capacity: 60,
//   },
//   "H-202": {
//     A: 15,
//     B: 15,
//     C: 15,
//     D: 15,
//     preference_order: 6,
//     total_capacity: 60,
//   },
//   "H-203": {
//     A: 24,
//     B: 24,
//     C: 24,
//     D: 24,
//     preference_order: 7,
//     total_capacity: 96,
//   },
//   "H-204": {
//     A: 24,
//     B: 24,
//     C: 24,
//     D: 24,
//     preference_order: 8,
//     total_capacity: 96,
//   },
//   "H-301": {
//     A: 15,
//     B: 15,
//     C: 15,
//     D: 15,
//     preference_order: 9,
//     total_capacity: 60,
//   },
//   "H-302": {
//     A: 15,
//     B: 15,
//     C: 15,
//     D: 15,
//     preference_order: 10,
//     total_capacity: 60,
//   },
//   "H-303": {
//     A: 24,
//     B: 24,
//     C: 24,
//     D: 24,
//     preference_order: 11,
//     total_capacity: 96,
//   },
//   "H-304": {
//     A: 24,
//     B: 24,
//     C: 24,
//     D: 24,
//     preference_order: 12,
//     total_capacity: 96,
//   },
//   SH1: {
//     A: 50,
//     B: 50,
//     C: 50,
//     D: 50,
//     preference_order: 13,
//     total_capacity: 200,
//   },
//   SH2: {
//     A: 50,
//     B: 50,
//     C: 50,
//     D: 50,
//     preference_order: 14,
//     total_capacity: 200,
//   },
//   "H-105": {
//     A: 50,
//     B: 50,
//     C: 50,
//     D: 50,
//     preference_order: 15,
//     total_capacity: 200,
//   },
//   "H-205": {
//     A: 50,
//     B: 50,
//     C: 50,
//     D: 50,
//     preference_order: 16,
//     total_capacity: 200,
//   },
//   CR1: { A: 20, B: 20, C: 20, D: 20, preference_order: 17, total_capacity: 80 },
//   // Example smaller rooms (adjust capacities as needed)
//   303: { A: 10, B: 10, C: 10, D: 10, preference_order: 18, total_capacity: 40 },
//   319: { A: 10, B: 10, C: 10, D: 10, preference_order: 19, total_capacity: 40 },
//   "A3 301": {
//     A: 8,
//     B: 8,
//     C: 7,
//     D: 7,
//     preference_order: 20,
//     total_capacity: 30,
//   },
//   "B4 301": {
//     A: 8,
//     B: 8,
//     C: 7,
//     D: 7,
//     preference_order: 21,
//     total_capacity: 30,
//   },
//   "B4 304": {
//     A: 8,
//     B: 8,
//     C: 7,
//     D: 7,
//     preference_order: 22,
//     total_capacity: 30,
//   },
//   "B6 309": {
//     A: 15,
//     B: 15,
//     C: 15,
//     D: 15,
//     preference_order: 23,
//     total_capacity: 60,
//   },
//   "Seminar Hall": {
//     A: 45,
//     B: 45,
//     C: 45,
//     D: 45,
//     preference_order: 24,
//     total_capacity: 180,
//   },
//   // lowest preference
// };

// // Helper: Get room details (preference and section capacities)
// function getRoomDetails(roomName) {
//   return ROOM_PREFERENCES[roomName] || null; // Return null if not in preferences
// }

// // Helper: Get capacity of a specific section (prioritizing preferences)
// function getSectionCapacity(roomName, sectionId, roomApiCapacity) {
//   const details = getRoomDetails(roomName);
//   if (details && details[sectionId] !== undefined) {
//     return details[sectionId];
//   }
//   // Fallback: Distribute API capacity equally among 4 sections if preference missing
//   return roomApiCapacity > 0 ? Math.floor(roomApiCapacity / 4) : 0;
// }

// // Helper: Get total room capacity (prioritizing preferences)
// function getTotalRoomCapacity(roomName, roomApiCapacity) {
//   const details = getRoomDetails(roomName);
//   // Use total_capacity from preferences if available
//   if (details && details.total_capacity !== undefined) {
//     return details.total_capacity;
//   }
//   // Fallback: Use API capacity if preference or total_capacity missing
//   return roomApiCapacity;
// }

// // Helper: Get course code currently assigned to a section
// function getSectionCourseCode(section) {
//   // Assumes section is an array of { student, courseCode, ... } objects
//   return section.length > 0 ? section[0].courseCode : null;
// }

// // Helper: Get unique course codes currently assigned within a room
// function getUniqueCoursesInRoom(room) {
//   const courses = new Set();
//   // Iterate through the sections (A, B, C, D) of the room object
//   Object.values(room.sections).forEach((section) => {
//     const courseCode = getSectionCourseCode(section);
//     if (courseCode) {
//       courses.add(courseCode);
//     }
//   });
//   return courses;
// }

// // *** CORRECTED Helper: Find the best available section in a room for a specific course ***
// // Ensures a section only holds students from a single course.
// function findBestSectionForStudent(room, courseCode) {
//   const sectionsPriority = ["A", "B", "C", "D"]; // Order to check/assign sections
//   const coursesInRoom = getUniqueCoursesInRoom(room);
//   const isNewCourseForRoom = !coursesInRoom.has(courseCode);

//   // Constraint 1: Check overall room course limit (max 3 unique courses)
//   if (isNewCourseForRoom && coursesInRoom.size >= 3) {
//     // console.log(`Room ${room.roomName} full course limit (has ${Array.from(coursesInRoom).join(',')}), cannot add ${courseCode}`);
//     return null; // Cannot add a 4th unique course to the room
//   }

//   // Strategy:
//   // 1. Find a section *already containing this course* with available space.
//   // 2. Find an *empty* section (Prefer A, B, C first, then D) that doesn't conflict with pairing rules.

//   // 1. Check existing sections for the *same* course
//   for (const sectionId of sectionsPriority) {
//     const section = room.sections[sectionId];
//     const sectionCapacity = getSectionCapacity(
//       room.roomName,
//       sectionId,
//       room.capacity
//     ); // Use room.capacity (API capacity) as fallback
//     const currentSectionCourse = getSectionCourseCode(section);

//     if (
//       currentSectionCourse === courseCode &&
//       section.length < sectionCapacity
//     ) {
//       // console.log(`Found existing section ${sectionId} in ${room.roomName} for ${courseCode}`);
//       return sectionId; // Found space in existing section for this course
//     }
//   }

//   // 2. Find an *empty* section, checking pairing constraints
//   // If we reach here, no section currently holds this course (or they are full).

//   // Check sections A, B, C first
//   for (const sectionId of ["A", "B", "C"]) {
//     const section = room.sections[sectionId];
//     const sectionCapacity = getSectionCapacity(
//       room.roomName,
//       sectionId,
//       room.capacity
//     );

//     if (section.length === 0 && sectionCapacity > 0) {
//       // Section is empty, check potential conflicts based on pairing rules
//       const courseInA = getSectionCourseCode(room.sections.A);
//       const courseInC = getSectionCourseCode(room.sections.C);
//       const courseInB = getSectionCourseCode(room.sections.B);
//       // courseInD check is needed only when assigning B or D

//       let conflict = false;
//       if (sectionId === "A" && courseInC && courseInC !== courseCode)
//         conflict = true; // C has different course
//       if (sectionId === "C" && courseInA && courseInA !== courseCode)
//         conflict = true; // A has different course
//       if (sectionId === "B") {
//         const courseInD = getSectionCourseCode(room.sections.D);
//         if (courseInD && courseInD !== courseCode) conflict = true; // D has different course
//       }
//       // No need to check D for section C, or A/C for section B

//       if (!conflict) {
//         // console.log(`Found empty section ${sectionId} in ${room.roomName} for ${courseCode}`);
//         return sectionId; // No conflict, suitable empty section
//       }
//       // else { console.log(`Conflict assigning ${courseCode} to empty ${sectionId} in ${room.roomName} due to pairing rules.`); }
//     }
//   }

//   // Try empty section D last
//   const sectionD = room.sections.D;
//   const capacityD = getSectionCapacity(room.roomName, "D", room.capacity);
//   if (sectionD.length === 0 && capacityD > 0) {
//     const courseInB = getSectionCourseCode(room.sections.B);
//     if (courseInB && courseInB !== courseCode) {
//       // Conflict: B has a different course, D cannot take this one due to B/D pairing constraint.
//       // console.log(`Conflict assigning ${courseCode} to empty D in ${room.roomName} due to B having ${courseInB}`);
//       return null;
//     }
//     // No conflict with B, empty D is suitable.
//     // console.log(`Found empty section D in ${room.roomName} for ${courseCode}`);
//     return "D";
//   }

//   // If no suitable section (existing with space or empty without conflict) is found
//   // console.log(`No suitable section found in ${room.roomName} for ${courseCode}`);
//   return null;
// }

// // --- Main Seating Arrangement Generation Endpoint ---

// // POST /api/generateSeatingArrangement
// app.post("/api/generateSeatingArrangement", async (req, res) => {
//   try {
//     console.log("Starting seating arrangement generation...");
//     const { timetableId, roomIds } = req.body;
//     if (!timetableId || !Array.isArray(roomIds)) {
//       return res
//         .status(400)
//         .json({ message: "Missing timetableId or roomIds" });
//     }
//     console.log(
//       `Generating for timetable: ${timetableId}, using max ${roomIds.length} rooms`
//     );

//     // --- 1. Fetch Timetable ---
//     const timetables = readJSONFile(TIMETABLES_FILE);
//     const timetable = timetables[timetableId];
//     if (!timetable || !timetable.data || !timetable.data.generatedTimetable) {
//       console.log(
//         `Timetable not found or invalid structure for ID: ${timetableId}`
//       );
//       return res
//         .status(404)
//         .json({ message: "Timetable not found or invalid structure" });
//     }
//     console.log(`Processing timetable: ${timetable.name}`);

//     // --- 2. Fetch and Process Rooms ---
//     console.log("Fetching rooms data from API...");
//     let apiRoomsData;
//     try {
//       const response = await fetch(
//         "https://ims-dev.iiit.ac.in/exam_schedule_api.php?typ=getRooms&key=IMS&secret=ExamDegunGts"
//       );
//       if (!response.ok)
//         throw new Error(`API Error ${response.status}: ${response.statusText}`);
//       apiRoomsData = await response.json();
//       if (
//         !apiRoomsData.ExamRooms ||
//         typeof apiRoomsData.ExamRooms !== "object"
//       ) {
//         throw new Error("Invalid rooms data format received from API");
//       }
//     } catch (fetchError) {
//       console.error("Failed to fetch or parse rooms from API:", fetchError);
//       return res.status(500).json({
//         message: "Failed to fetch rooms from API",
//         error: fetchError.message,
//       });
//     }

//     // Filter API rooms based on selected roomIds provided in the request
//     const availableApiRooms = Object.entries(apiRoomsData.ExamRooms)
//       .filter(([id]) => roomIds.includes(id)) // Only use rooms requested by the user
//       .map(([id, room]) => ({
//         id,
//         name: room.room,
//         capacity: parseInt(room.capacity) || 0, // API provided capacity
//         block: room.room.split(" ")[0] || "Unknown",
//       }));

//     if (availableApiRooms.length === 0) {
//       console.log(
//         "No available rooms match the selected roomIds based on API response."
//       );
//       // It's better to inform the user rather than sending 500
//       return res.status(400).json({
//         message:
//           "None of the selected rooms are available or found in the API.",
//       });
//     }

//     console.log(
//       `Found ${availableApiRooms.length} available rooms from API matching selection.`
//     );

//     // Calculate total capacity based on selected & available rooms (using helper for preference priority)
//     const totalCapacityAvailable = availableApiRooms.reduce(
//       (sum, r) => sum + getTotalRoomCapacity(r.name, r.capacity),
//       0
//     );
//     console.log(
//       `Total calculated capacity across these rooms: ${totalCapacityAvailable}`
//     );

//     // --- 3. Prepare for Allocation ---
//     const finalSeatingArrangement = {}; // Structure: { date: { slot: { ...安排... } } }
//     const metadata = {
//       // Information about the generation run
//       timetableName: timetable.name,
//       totalRoomsSelectedAndAvailable: availableApiRooms.length,
//       totalCapacityAvailable: totalCapacityAvailable,
//       examDetails: {
//         year: timetable.data.year,
//         semester: timetable.data.semester,
//         examType: timetable.data.examType,
//       },
//       roomPreferencesUsed: Object.keys(ROOM_PREFERENCES).length, // Just info
//     };
//     const statistics = {}; // Structure: { date: { slot: { ...统计... } } }

//     // --- 4. Iterate Through Timetable Days and Slots ---
//     const dates = Object.keys(timetable.data.generatedTimetable).sort(); // Process chronologically

//     for (const date of dates) {
//       finalSeatingArrangement[date] = {};
//       statistics[date] = {};
//       const slots = timetable.data.generatedTimetable[date];
//       const slotKeys = Object.keys(slots).sort(); // Process slots chronologically (e.g., Slot 1, Slot 2)

//       for (const slot of slotKeys) {
//         console.log(`\n--- Processing Date: ${date}, Slot: ${slot} ---`);
//         const coursesInSlotRaw = slots[slot] || [];

//         // Filter out courses with no students and sort by student count (descending)
//         let coursesToAllocate = JSON.parse(JSON.stringify(coursesInSlotRaw)) // Deep copy to avoid mutation
//           .filter((c) => c.students && c.students.length > 0)
//           .sort((a, b) => b.students.length - a.students.length);

//         if (coursesToAllocate.length === 0) {
//           console.log("No courses with students in this slot.");
//           finalSeatingArrangement[date][slot] = {
//             arrangements: [],
//             totalStudents: 0,
//             totalCapacity: totalCapacityAvailable,
//             utilizationRate: 0,
//             unassignedStudents: [],
//           };
//           statistics[date][slot] = {
//             totalStudents: 0,
//             totalCapacity: totalCapacityAvailable,
//             utilizationRate: 0,
//             roomsUsedCount: 0,
//             roomsUsed: [],
//             unassignedCount: 0,
//             unassignedDetails: [],
//             allocationMode: "N/A",
//           };
//           continue; // Skip to the next slot
//         }

//         let totalStudentsInSlot = coursesToAllocate.reduce(
//           (sum, c) => sum + c.students.length,
//           0
//         );
//         console.log(
//           `Courses to allocate: ${coursesToAllocate
//             .map((c) => `${c.code} (${c.students.length})`)
//             .join(", ")}. Total Students: ${totalStudentsInSlot}`
//         );

//         let slotArrangementResult = null; // Stores the final room arrangements for the slot
//         let unassignedStudentsListResult = []; // Stores unassigned students for the slot
//         let finalAllocationMode = "Preference"; // Default mode

//         // --- Allocation Loop (Attempt 1: Preference, Attempt 2: Capacity if needed) ---
//         for (let attempt = 1; attempt <= 2; attempt++) {
//           let useCapacityOrder = attempt === 2; // Use capacity order only on the second attempt
//           console.log(
//             `\nAllocation Attempt ${attempt}: ${
//               useCapacityOrder ? "Capacity Order" : "Preference Order"
//             }`
//           );

//           // --- 4a. Sort Rooms for this attempt ---
//           const sortedRoomsForAttempt = [...availableApiRooms].sort((a, b) => {
//             const detailsA = getRoomDetails(a.name);
//             const detailsB = getRoomDetails(b.name);
//             // Assign high number for non-preferred rooms to sort them last
//             const prefA = detailsA ? detailsA.preference_order : Infinity;
//             const prefB = detailsB ? detailsB.preference_order : Infinity;

//             if (useCapacityOrder) {
//               // Sort by Capacity (Descending)
//               const capacityA = getTotalRoomCapacity(a.name, a.capacity);
//               const capacityB = getTotalRoomCapacity(b.name, b.capacity);
//               if (capacityB !== capacityA) return capacityB - capacityA;
//               // If capacity is equal, fall back to preference order (ascending)
//               if (prefA !== prefB) return prefA - prefB;
//             } else {
//               // Sort by Preference (Ascending)
//               if (prefA !== prefB) return prefA - prefB;
//               // If preference is equal, fall back to capacity (descending)
//               const capacityA = getTotalRoomCapacity(a.name, a.capacity);
//               const capacityB = getTotalRoomCapacity(b.name, b.capacity);
//               if (capacityB !== capacityA) return capacityB - capacityA;
//             }

//             // Final fallback: sort by name if all else is equal
//             return a.name.localeCompare(b.name);
//           });

//           console.log(
//             `Room Order for Attempt ${attempt}: ${sortedRoomsForAttempt
//               .map(
//                 (r) =>
//                   `${r.name}(Pref:${
//                     getRoomDetails(r.name)?.preference_order ?? "N/A"
//                   },Cap:${getTotalRoomCapacity(r.name, r.capacity)})`
//               )
//               .join(", ")}`
//           );

//           // --- 4b. Initialize Room Structures for this attempt ---
//           // Create a fresh structure for each attempt
//           let currentRoomArrangements = sortedRoomsForAttempt.map((room) => ({
//             roomId: room.id,
//             roomName: room.name,
//             capacity: room.capacity, // Original API capacity for reference
//             block: room.block,
//             sections: { A: [], B: [], C: [], D: [] },
//             totalCalcCapacity: getTotalRoomCapacity(room.name, room.capacity), // Calculated capacity
//           }));

//           // --- 4c. Prepare Student Lists for Allocation ---
//           let remainingStudentsMap = new Map(); // Map<courseCode, studentList>
//           coursesToAllocate.forEach((course) => {
//             // Ensure students array exists and create a copy
//             remainingStudentsMap.set(
//               course.code,
//               course.students ? [...course.students] : []
//             );
//           });
//           let totalRemainingInAttempt = totalStudentsInSlot;

//           // --- 4d. Iterative Student Placement ---
//           let roomIndex = 0; // Start checking from the first room in the sorted list
//           let placedInCycle = true; // Flag to check if progress is made in a full pass

//           while (totalRemainingInAttempt > 0 && placedInCycle) {
//             placedInCycle = false; // Reset flag for this pass

//             // Iterate through courses (largest first based on initial sort)
//             for (let course of coursesToAllocate) {
//               const courseCode = course.code;
//               const studentsForCourse = remainingStudentsMap.get(courseCode);

//               if (studentsForCourse && studentsForCourse.length > 0) {
//                 const studentToPlace = studentsForCourse[0]; // Get the next student for this course

//                 // Try to find a spot in rooms, cycling through the sorted list
//                 let searchStartIdx = roomIndex; // Start searching from the room after the last successful placement
//                 let foundSpot = false;
//                 for (let i = 0; i < currentRoomArrangements.length; i++) {
//                   let currentRoomCheckIdx =
//                     (searchStartIdx + i) % currentRoomArrangements.length;
//                   let room = currentRoomArrangements[currentRoomCheckIdx];

//                   // *** Use the corrected helper function ***
//                   const bestSectionId = findBestSectionForStudent(
//                     room,
//                     courseCode
//                   );

//                   if (bestSectionId) {
//                     // Place the student
//                     const section = room.sections[bestSectionId];
//                     section.push({
//                       // Simple seat number within the section for now
//                       seatNumber: `${bestSectionId}${section.length + 1}`,
//                       student: studentToPlace, // Store the student ID/object
//                       courseCode: courseCode,
//                       courseName: course.name,
//                     });

//                     // Update remaining counts
//                     studentsForCourse.shift(); // Remove placed student
//                     totalRemainingInAttempt--;
//                     roomIndex = currentRoomCheckIdx; // Update the index for the next search start
//                     placedInCycle = true; // We made progress
//                     foundSpot = true;
//                     // console.log(`Placed ${studentToPlace} (${courseCode}) in ${room.roomName}-${bestSectionId}`);
//                     break; // Stop searching for this student, move to the next
//                   }
//                 } // End room search loop for one student
//                 // If foundSpot is false after checking all rooms, this student cannot be placed in this cycle.
//               }
//             } // End course loop for one cycle

//             // Optimization: If a full pass through all students yielded no placements, break.
//             if (!placedInCycle && totalRemainingInAttempt > 0) {
//               console.log(
//                 `Stopping allocation cycle for Attempt ${attempt}: No student placed in a full pass. Remaining: ${totalRemainingInAttempt}`
//               );
//               break;
//             }
//           } // End while loop for placing students in this attempt

//           // --- 4e. Check Results of the Attempt ---
//           let currentUnassigned = [];
//           remainingStudentsMap.forEach((students, code) => {
//             if (students.length > 0) {
//               const courseInfo = coursesToAllocate.find((c) => c.code === code);
//               currentUnassigned.push({
//                 courseCode: code,
//                 courseName: courseInfo ? courseInfo.name : "Unknown Course",
//                 students: students, // List of remaining student IDs/objects
//               });
//             }
//           });

//           // --- 4f. Decide Outcome Based on Attempt ---
//           if (currentUnassigned.length === 0) {
//             // Success! All students placed in this attempt.
//             console.log(
//               `Attempt ${attempt} (${
//                 useCapacityOrder ? "Capacity" : "Preference"
//               }) successful. All ${totalStudentsInSlot} students placed.`
//             );
//             slotArrangementResult = currentRoomArrangements; // Keep this result
//             unassignedStudentsListResult = [];
//             finalAllocationMode = useCapacityOrder
//               ? "Capacity (Full)"
//               : "Preference";
//             break; // Exit the attempt loop (no need for attempt 2 if 1 succeeded)
//           } else if (attempt === 1) {
//             // Attempt 1 (Preference) failed. Log and proceed to attempt 2.
//             const unassignedCount = currentUnassigned.reduce(
//               (sum, c) => sum + c.students.length,
//               0
//             );
//             console.log(
//               `Attempt 1 (Preference) resulted in ${unassignedCount} unassigned students. Trying capacity order.`
//             );
//             // Continue to the next iteration (attempt = 2)
//           } else {
//             // Attempt 2 (Capacity) also failed (or was the only attempt and failed).
//             const unassignedCount = currentUnassigned.reduce(
//               (sum, c) => sum + c.students.length,
//               0
//             );
//             console.log(
//               `Attempt 2 (Capacity) finished with ${unassignedCount} unassigned students.`
//             );
//             slotArrangementResult = currentRoomArrangements; // Keep the result of the capacity attempt
//             unassignedStudentsListResult = currentUnassigned;
//             finalAllocationMode = "Capacity (Partial)";
//             // Loop will naturally end here.
//           }
//         } // End allocation attempts loop

//         // --- 4g. Finalize and Store Slot Results ---
//         // Filter out completely empty rooms from the final arrangement
//         const finalArrangementForSlot = (slotArrangementResult || []).filter(
//           (room) =>
//             Object.values(room.sections).some((section) => section.length > 0)
//         );

//         // Sort the rooms in the final arrangement *always* by preference order for consistent output
//         finalArrangementForSlot.sort((a, b) => {
//           const detailsA = getRoomDetails(a.roomName);
//           const detailsB = getRoomDetails(b.roomName);
//           const prefA = detailsA ? detailsA.preference_order : Infinity;
//           const prefB = detailsB ? detailsB.preference_order : Infinity;
//           if (prefA !== prefB) return prefA - prefB;
//           // Fallback sort by name if preference is the same or missing
//           return a.roomName.localeCompare(b.roomName);
//         });

//         const totalAssignedStudents =
//           totalStudentsInSlot -
//           unassignedStudentsListResult.reduce(
//             (sum, c) => sum + c.students.length,
//             0
//           );
//         const slotCapacity = totalCapacityAvailable; // Use the total capacity of selected & available rooms
//         const utilization =
//           slotCapacity > 0 ? (totalAssignedStudents / slotCapacity) * 100 : 0;

//         // Store the final arrangement and stats for this slot
//         finalSeatingArrangement[date][slot] = {
//           arrangements: finalArrangementForSlot,
//           totalStudents: totalAssignedStudents,
//           totalCapacity: slotCapacity,
//           utilizationRate: parseFloat(utilization.toFixed(2)), // Format utilization rate
//           unassignedStudents: unassignedStudentsListResult,
//           allocationMode: finalAllocationMode,
//         };

//         // Calculate and store statistics for this slot
//         statistics[date][slot] = {
//           totalStudents: totalAssignedStudents,
//           totalCapacity: slotCapacity,
//           utilizationRate: parseFloat(utilization.toFixed(2)),
//           roomsUsedCount: finalArrangementForSlot.length,
//           roomsUsed: finalArrangementForSlot.map((room) => ({
//             name: room.roomName,
//             capacity: room.totalCalcCapacity, // Calculated capacity for the room
//             studentsPlaced: Object.values(room.sections).reduce(
//               (sum, section) => sum + section.length,
//               0
//             ),
//           })),
//           unassignedCount: unassignedStudentsListResult.reduce(
//             (sum, c) => sum + c.students.length,
//             0
//           ),
//           unassignedDetails: unassignedStudentsListResult,
//           allocationMode: finalAllocationMode,
//         };

//         console.log(
//           `Slot ${date} ${slot} finished. Assigned: ${totalAssignedStudents}. Unassigned: ${statistics[date][slot].unassignedCount}. Mode: ${finalAllocationMode}`
//         );
//       } // End slot loop
//     } // End date loop

//     console.log("\n--- Seating arrangement generation complete ---");

//     // --- 5. Send Response ---
//     res.json({
//       message: "Seating arrangement generated successfully",
//       seatingArrangement: finalSeatingArrangement,
//       metadata,
//       statistics,
//     });
//   } catch (error) {
//     console.error("Error generating seating arrangement:", error);
//     // Log the stack trace for better debugging server-side
//     console.error(error.stack);
//     res.status(500).json({
//       message:
//         "An internal error occurred during seating arrangement generation.",
//       error: error.message, // Include error message for client-side info (optional)
//     });
//   }
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

//
//
//
//
//
//
//









import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import fetch from "node-fetch"; // Ensure node-fetch is installed
import { parseStringPromise } from "xml2js";
import { generateTimetable } from "./timetableGenerator.js"; // Assuming this exists and works
import fs from "fs";
import path from "path";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import morgan from "morgan";
// import axios from "axios"; // axios is not used in the final seating logic, can be removed if not needed elsewhere

const app = express();

// --- Middleware Setup ---
app.use(helmet()); // Basic security headers
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173", // Allow your frontend
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
const limiter = rateLimit({
  // Basic rate limiting
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests, please try again later",
});
app.use(limiter);
app.use((req, res, next) => {
  // Request ID logging
  req.id = uuidv4();
  res.setHeader("X-Request-ID", req.id);
  next();
});
app.use(
  // Logging format
  morgan(
    ":date[iso] :method :url :status :res[content-length] - :response-time ms - ID::req[id]"
  )
);
app.use(compression()); // Compress responses
app.use(express.json({ limit: "50mb" })); // Parse JSON bodies
app.use(express.urlencoded({ limit: "50mb", extended: true })); // Parse URL-encoded bodies
// app.use(cors()); // This is redundant as specific CORS is configured above

// --- Data Paths and Helpers ---
const DATA_DIR = "./data";
const USERS_FILE = path.join(DATA_DIR, "users.json");
const TIMETABLES_FILE = path.join(DATA_DIR, "timetables.json");
const COURSES_FILE = path.join(DATA_DIR, "courses.json");
const SEATING_ARRANGEMENTS_FILE = path.join(DATA_DIR, "seatingArrangements.json");

// Create data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true }); // Ensure parent dirs are created if needed
}

// Helper function to read JSON file safely
const readJSONFile = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      // Initialize file with appropriate default structure
      const defaultData = filePath.includes("timetables.json") ? {} : [];
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    const data = fs.readFileSync(filePath, "utf8");
    // Handle empty file case
    return data
      ? JSON.parse(data)
      : filePath.includes("timetables.json")
      ? {}
      : [];
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    // Return default structure on error
    return filePath.includes("timetables.json") ? {} : [];
  }
};

// Helper function to write JSON file safely
const writeJSONFile = (filePath, data) => {
  try {
    // Ensure directory exists before writing
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error writing to ${filePath}:`, error);
  }
};

// --- Course Data Processing ---
const processCoursesData = (rawData) => {
  if (!rawData || !rawData.Applications) {
    // Added null check for rawData
    console.warn(
      "Raw data or Applications field missing in processCoursesData"
    );
    return null;
  }
  const coursesMap = new Map();
  Object.values(rawData.Applications).forEach((app) => {
    // Add checks for potentially missing properties
    if (app && app.coursecode && app.coursename && app.rollnumber) {
      if (!coursesMap.has(app.coursecode)) {
        coursesMap.set(app.coursecode, {
          code: app.coursecode,
          name: app.coursename,
          students: new Set(),
        });
      }
      // Ensure student set exists before adding
      const courseEntry = coursesMap.get(app.coursecode);
      if (courseEntry && courseEntry.students) {
        courseEntry.students.add(app.rollnumber);
      }
    } else {
      // console.warn("Skipping incomplete application data:", app);
    }
  });

  // Convert map to array, handling potential empty map
  if (coursesMap.size === 0) {
    return [];
  }

  return Array.from(coursesMap.values()).map((course) => ({
    code: course.code,
    name: course.name,
    students: course.students ? Array.from(course.students) : [], // Ensure students is an array
  }));
};

// --- API Endpoints ---

// Root endpoint for basic check
app.get("/", (req, res) => {
  res.send("Exam Seating Arrangement API is running.");
});

// Fetch courses from IIIT API (or local mock) and store
app.post("/api/fetchCoursesData", async (req, res) => {
  try {
    const { year, semester, examType } = req.body;
    console.log(
      `Fetching courses for Year: ${year}, Semester: ${semester}, Exam: ${examType}`
    );

    // --- CHOOSE ONE SOURCE ---
    // Option 1: Live API
    // const apiUrl = `https://ims-dev.iiit.ac.in/exam_schedule_api.php?typ=getStudData&key=IMS&secret=ExamDegunGts&year=${year}&semester=${semester}`;
    // const response = await fetch(apiUrl);

    // Option 2: Local Mock Server (as in your original code)
    // Make sure this local server is running and serving the expected JSON structure
    const response = await fetch("http://localhost:3001/data"); // Assuming this serves mock data
    // --- END CHOOSE ONE ---

    if (!response.ok) {
      console.error(
        `Failed to fetch data. Status: ${response.status} ${response.statusText}`
      );
      // Attempt to read response body for more details if available
      let errorBody = "";
      try {
        errorBody = await response.text();
      } catch (e) {}
      throw new Error(
        `Failed to fetch data from source. Status: ${response.status}. Body: ${errorBody}`
      );
    }

    const rawData = await response.json();
    console.log("Raw data received, processing..."); // Log success

    const processedCourses = processCoursesData(rawData);

    if (!processedCourses) {
      console.error("Processing courses data resulted in null or undefined.");
      throw new Error("Failed to process courses data - check raw data format");
    }
    console.log(`Processed ${processedCourses.length} courses.`);

    const coursesData = {
      year,
      semester,
      examType,
      courses: processedCourses,
    };

    writeJSONFile(COURSES_FILE, coursesData);
    console.log(`Courses data saved to ${COURSES_FILE}`);
    res.json(coursesData);
  } catch (error) {
    console.error("Error in /api/fetchCoursesData:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch courses data", error: error.message });
  }
});

// Get stored course names and details
app.get("/api/coursesNames", (req, res) => {
  try {
    const coursesData = readJSONFile(COURSES_FILE);
    if (
      !coursesData ||
      !coursesData.courses ||
      coursesData.courses.length === 0
    ) {
      // Check if courses array is empty too
      return res.status(404).json({
        message: "No courses data available. Please fetch courses data first.",
      });
    }
    // Return the whole structure including year/sem/type
    res.json(coursesData);
  } catch (error) {
    console.error("Error getting course names:", error);
    res.status(500).json({ message: "Failed to get course names" });
  }
});

// --- User Authentication Endpoints --- (Keep these as they were)
app.post("/api/signup", async (req, res) => {
  const { username, email, password } = req.body;
  console.log(`Signup request received for email: ${email}`);

  const users = readJSONFile(USERS_FILE);
  if (users.some((user) => user.email === email)) {
    console.log(`Signup failed: Email ${email} already exists.`);
    return res.status(400).json({ message: "Email already exists" });
  }
  try {
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
  } catch (hashError) {
    console.error("Error hashing password during signup:", hashError);
    res.status(500).json({ message: "Server error during signup" });
  }
});

const CAS_LOGIN_URL = "https://login.iiit.ac.in/cas/login";
const CAS_VALIDATE_URL = "https://login.iiit.ac.in/cas/serviceValidate";
const SERVICE_URL = process.env.FRONTEND_URL
  ? `${process.env.FRONTEND_URL}/api/cas/callback`
  : "http://localhost:5173/api/cas/callback"; // Point to frontend callback handler path

app.get("/api/cas/login", (req, res) => {
  console.log("CAS login initiated");
  const redirectUrl = `${CAS_LOGIN_URL}?service=${encodeURIComponent(
    SERVICE_URL
  )}`;
  console.log("Redirecting to CAS:", redirectUrl);
  res.redirect(redirectUrl);
});

// LEGACY Backend Callback - Keep for potential direct backend hits, redirects to frontend
app.get("/api/cas/callback", async (req, res) => {
  const { ticket } = req.query;
  console.log("CAS legacy callback received at backend with ticket:", ticket);

  if (!ticket) {
    console.error("Missing CAS ticket in legacy callback");
    // Redirect to frontend login page with error
    return res.redirect(
      `${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/login?error=Missing%20CAS%20ticket`
    );
  }

  // Redirect immediately to the frontend success page, passing the ticket.
  // The frontend will then call /api/cas/validate with this ticket.
  console.log(
    "Redirecting legacy callback to frontend CAS success page with ticket"
  );
  res.redirect(
    `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/cas-success?ticket=${ticket}`
  );
});

// CAS Validation endpoint - Called by frontend after successful CAS redirect
app.get("/api/cas/validate", async (req, res) => {
  const { ticket } = req.query;
  console.log("CAS validate endpoint called with ticket:", ticket);

  if (!ticket) {
    console.warn("CAS validate called without a ticket.");
    return res.status(400).json({ message: "Missing CAS ticket" });
  }

  try {
    const validateUrl = `${CAS_VALIDATE_URL}?ticket=${ticket}&service=${encodeURIComponent(
      SERVICE_URL
    )}`;
    console.log("Validating ticket with CAS:", validateUrl);
    const response = await fetch(validateUrl);
    const body = await response.text();

    // Basic check if response is XML-like before parsing
    if (!body || !body.trim().startsWith("<")) {
      console.error("Invalid response received from CAS validation:", body);
      return res
        .status(500)
        .json({ message: "Invalid response from CAS server" });
    }

    const parsed = await parseStringPromise(body);

    const casResponse = parsed["cas:serviceResponse"];
    const authenticationSuccess =
      casResponse && casResponse["cas:authenticationSuccess"];

    if (!authenticationSuccess) {
      console.warn("CAS authentication failed for ticket:", ticket);
      // It's better to return 401 Unauthorized than a generic message
      const failure = casResponse && casResponse["cas:authenticationFailure"];
      const failureReason = failure
        ? failure[0]?.$?.code || failure[0]
        : "Unknown reason";
      return res
        .status(401)
        .json({ message: `CAS Authentication Failed: ${failureReason}` });
    }

    // Extract user email
    const email = authenticationSuccess[0]?.["cas:user"]?.[0];
    if (!email) {
      console.error("Failed to extract email from successful CAS response.");
      return res
        .status(500)
        .json({ message: "Failed to extract email from CAS response" });
    }

    console.log(`CAS validation successful for email: ${email}`);

    // Find or create user in local database
    let users = readJSONFile(USERS_FILE);
    let user = users.find((u) => u.email === email);

    if (!user) {
      console.log(`Creating new user entry for CAS login: ${email}`);
      user = {
        email,
        username: email.split("@")[0], // Default username from email prefix
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(), // Set last login on creation too
      };
      users.push(user);
    } else {
      console.log(`Updating last login for existing user: ${email}`);
      user.lastLogin = new Date().toISOString();
    }
    writeJSONFile(USERS_FILE, users); // Save changes

    // Return user info to frontend
    res.json({
      message: "Authentication successful",
      email: user.email,
      username: user.username,
    });
  } catch (error) {
    console.error("Error during CAS validation:", error);
    // Check for specific error types if needed (e.g., network error vs. parsing error)
    res.status(500).json({
      message: "Server error during CAS validation",
      error: error.message,
    });
  }
});

// Standard email/password login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  console.log(`Login request received for email: ${email}`);

  const users = readJSONFile(USERS_FILE);
  const user = users.find((user) => user.email === email);

  // Check if user exists and has a password (CAS users might not initially)
  if (!user || !user.password) {
    console.log(
      `Login failed: User ${email} not found or has no password set.`
    );
    return res
      .status(401)
      .json({ message: "Invalid credentials or user setup issue." });
  }

  try {
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.log(`Login failed: Invalid password for email: ${email}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Update last login time
    user.lastLogin = new Date().toISOString();
    writeJSONFile(USERS_FILE, users);

    console.log(`Login successful for email: ${email}`);
    res.json({
      message: "Login successful",
      email: user.email,
      username: user.username,
    });
  } catch (compareError) {
    console.error(`Error comparing password for ${email}:`, compareError);
    res.status(500).json({ message: "Server error during login" });
  }
});

// Get user details (excluding password)
app.get("/api/user/:email", (req, res) => {
  try {
    const { email } = req.params;
    // Basic email validation might be useful here
    if (!email || !email.includes("@")) {
      return res
        .status(400)
        .json({ message: "Invalid email format provided." });
    }

    const users = readJSONFile(USERS_FILE);
    const user = users.find((u) => u.email === email);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Explicitly destructure and exclude password
    const { password, ...userDetails } = user;
    res.json(userDetails);
  } catch (error) {
    console.error("Error fetching user details:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch user details", error: error.message });
  }
});

// --- Timetable Management Endpoints --- (Keep these as they were)
app.post("/api/storeCoursesData", (req, res) => {
  try {
    const { year, semester, examType } = req.body;
    const coursesData = readJSONFile(COURSES_FILE);

    if (!coursesData || !coursesData.courses) {
      return res.status(400).json({
        message: "No courses data available to update. Fetch courses first.",
      });
    }

    // Update only the metadata fields
    const updatedCoursesData = {
      ...coursesData, // Keep existing courses
      year: year !== undefined ? year : coursesData.year, // Update if provided
      semester: semester !== undefined ? semester : coursesData.semester,
      examType: examType !== undefined ? examType : coursesData.examType,
    };

    writeJSONFile(COURSES_FILE, updatedCoursesData);

    res.json({
      message:
        "Courses metadata (Year, Semester, Exam Type) stored successfully",
      data: updatedCoursesData,
    });
  } catch (error) {
    console.error("Error storing courses metadata:", error);
    res.status(500).json({ message: "Failed to store courses metadata" });
  }
});

app.get("/api/fetchTimeTable", async (req, res) => {
  // This seems to call your timetableGenerator.js - assuming it works correctly
  // Keep the logic as it was, but ensure error handling is robust
  try {
    console.log("Received timetable generation request");
    // Validate query parameters
    if (!req.query.selectedCourses || !req.query.examConfig) {
      return res.status(400).json({
        error: "Missing selectedCourses or examConfig query parameters.",
      });
    }

    let selectedCourses, examConfig;
    try {
      selectedCourses = JSON.parse(req.query.selectedCourses);
      examConfig = JSON.parse(req.query.examConfig);
      if (!Array.isArray(selectedCourses))
        throw new Error("selectedCourses must be an array.");
      if (typeof examConfig !== "object" || examConfig === null)
        throw new Error("examConfig must be an object.");
    } catch (parseError) {
      console.error("Error parsing query parameters:", parseError);
      return res
        .status(400)
        .json({ error: "Invalid format for selectedCourses or examConfig." });
    }

    const coursesData = readJSONFile(COURSES_FILE);

    if (
      !coursesData ||
      !coursesData.courses ||
      coursesData.courses.length === 0
    ) {
      console.error("No courses data available for timetable generation.");
      return res.status(400).json({
        error: "No courses data available. Please fetch courses first.",
      });
    }

    // Filter courses based on selection
    const selectedCoursesData = coursesData.courses.filter((c) =>
      selectedCourses.includes(c.code)
    );

    if (selectedCoursesData.length === 0) {
      console.error(
        "None of the selected courses were found in the stored data."
      );
      return res
        .status(400)
        .json({ error: "No valid courses selected or found." });
    }
    console.log(
      `Generating timetable for ${selectedCoursesData.length} courses.`
    );

    if (
      !examConfig.dates ||
      !Array.isArray(examConfig.dates) ||
      examConfig.dates.length === 0
    ) {
      console.error("No exam dates provided in examConfig.");
      return res
        .status(400)
        .json({ error: "Please select exam dates in the configuration." });
    }

    // Ensure dates are valid Date objects and sort them
    const parsedDates = examConfig.dates
      .map((dateStr) => new Date(dateStr))
      .filter((d) => !isNaN(d.getTime()));
    if (parsedDates.length !== examConfig.dates.length) {
      console.error("Invalid date format found in examConfig.dates");
      return res.status(400).json({ error: "Invalid date format provided." });
    }
    parsedDates.sort((a, b) => a - b); // Sort chronologically

    const startDate = parsedDates[0];
    const numberOfSlots = parseInt(examConfig.slots, 10) || 2; // Default to 2 slots if not specified or invalid

    // Generate multiple timetables (adjust MAX_TIMETABLES as needed)
    const MAX_TIMETABLES = 3; // Example: Generate 3 options
    const timetablePromises = Array(MAX_TIMETABLES)
      .fill()
      .map(async (_, index) => {
        console.log(`Generating timetable option ${index + 1}...`);
        // Assuming generateTimetable is asynchronous and returns the structure needed
        const result = await generateTimetable(
          selectedCoursesData,
          startDate, // Pass the earliest date
          parsedDates, // Pass all available dates
          numberOfSlots // Pass the number of slots per day
        );
        // Structure the response for each timetable option
        return {
          id: index + 1, // Assign a temporary ID
          timetable: result.timetable, // The generated schedule
          stats: {
            // Include relevant stats
            totalCourses:
              result.stats?.totalCourses ?? selectedCoursesData.length,
            scheduledCourses: result.stats?.scheduledCourses ?? 0,
            unscheduledCourses: result.stats?.unscheduledCourses ?? [],
            // Add year/sem/type from the source data
            year: coursesData.year,
            semester: coursesData.semester,
            examType: coursesData.examType,
          },
          fitness: result.fitness, // Include fitness score if provided by generator
        };
      });

    const generatedTimetables = await Promise.all(timetablePromises);
    console.log(`Generated ${generatedTimetables.length} timetable options.`);

    // Format the final response
    const response = { timetables: generatedTimetables };

    // Set cache headers (optional, adjust max-age as needed)
    res.set({
      "Cache-Control": "public, max-age=600", // Cache for 10 minutes
      "Content-Type": "application/json",
    });

    res.json(response);
  } catch (error) {
    console.error("Error generating timetables:", error);
    res
      .status(500)
      .json({ error: "Failed to generate timetables", details: error.message });
  }
});

// app.post("/api/saveTimetable", (req, res) => {
//   try {
//     const { name, data } = req.body; // data should be one of the generated { timetable: ..., stats: ... } objects

//     if (!name || !data || !data.timetable || !data.stats) {
//       return res.status(400).json({
//         message:
//           "Invalid data format for saving timetable. 'name' and 'data' (with timetable and stats) are required.",
//       });
//     }

//     const timetables = readJSONFile(TIMETABLES_FILE);

//     // Find the next available numeric ID
//     let nextId = 1;
//     const existingIds = Object.keys(timetables)
//       .map(Number)
//       .filter((id) => !isNaN(id));
//     if (existingIds.length > 0) {
//       nextId = Math.max(...existingIds) + 1;
//     }

//     console.log(`Saving timetable "${name}" with ID ${nextId}`);

//     // --- Student Statistics Calculation (copied from your original code) ---
//     // This assumes data.timetable has the structure { date: { slot: [ { code, name, students: [roll] } ] } }
//     const studentStats = {};
//     const generatedTimetable = data.timetable; // Use the timetable structure from the request body

//     if (typeof generatedTimetable !== "object" || generatedTimetable === null) {
//       console.warn(
//         "Generated timetable data is missing or not an object in the request. Skipping student stats calculation."
//       );
//     } else {
//       Object.entries(generatedTimetable).forEach(([date, slots]) => {
//         if (typeof slots !== "object" || slots === null) return; // Skip if slots is not an object
//         Object.entries(slots).forEach(([slot, courses]) => {
//           if (!Array.isArray(courses)) return; // Skip if courses is not an array
//           courses.forEach((course) => {
//             if (!course || !Array.isArray(course.students)) return; // Skip if course or students array is invalid
//             course.students.forEach((rollNumber) => {
//               // Initialize student entry if it doesn't exist
//               if (!studentStats[rollNumber]) {
//                 studentStats[rollNumber] = {
//                   totalExams: 0,
//                   daysWithMultipleExams: 0, // Exams on the same day (different slots)
//                   // consecutiveExams: 0, // Consecutive slots on the same day - Replaced by simpler logic below
//                   scheduleConflicts: 0, // Same day, same slot (should not happen with valid generator)
//                   examSchedule: [], // { date, slot, courseCode }
//                 };
//               }

//               const studentStat = studentStats[rollNumber];
//               studentStat.totalExams++;
//               studentStat.examSchedule.push({
//                 date: date, // Use the date key directly
//                 slot: slot, // Use the slot key directly
//                 courseCode: course.code,
//               });
//             });
//           });
//         });
//       });

//       // Calculate conflicts/stats per student
//       Object.values(studentStats).forEach((stats) => {
//         // Sort exams chronologically for easier conflict checking
//         stats.examSchedule.sort((a, b) => {
//           const dateA = new Date(a.date);
//           const dateB = new Date(b.date);
//           if (dateA.getTime() !== dateB.getTime()) {
//             return dateA - dateB;
//           }
//           // If dates are the same, sort by slot number (assuming slots are numeric strings like '1', '2')
//           return parseInt(a.slot) - parseInt(b.slot);
//         });

//         const examsByDaySlot = {}; // Store counts for each day/slot combination

//         for (let i = 0; i < stats.examSchedule.length; i++) {
//           const exam = stats.examSchedule[i];
//           const key = `${exam.date}-${exam.slot}`;

//           // Count exams in the same slot (direct conflict)
//           if (!examsByDaySlot[key]) examsByDaySlot[key] = 0;
//           examsByDaySlot[key]++;
//           if (examsByDaySlot[key] > 1) {
//             stats.scheduleConflicts++; // Increment conflict count for this student
//           }

//           // Check for exams on the same day (multiple exams) - simplified
//           if (i > 0) {
//             const prevExam = stats.examSchedule[i - 1];
//             if (exam.date === prevExam.date && exam.slot !== prevExam.slot) {
//               // Check if this day has already been counted for multiple exams
//               if (!stats.countedMultiExamDays)
//                 stats.countedMultiExamDays = new Set();
//               if (!stats.countedMultiExamDays.has(exam.date)) {
//                 stats.daysWithMultipleExams++;
//                 stats.countedMultiExamDays.add(exam.date); // Mark day as counted
//               }
//             }
//           }
//         }
//         // Clean up temporary set
//         delete stats.countedMultiExamDays;
//       });
//     } // End student stats calculation block

//     // Store the timetable
//     timetables[nextId] = {
//       id: nextId,
//       name: name,
//       createdAt: new Date().toISOString(),
//       // Store the original data received, plus the calculated student stats
//       data: {
//         year: data.stats?.year || "N/A", // Get year/sem/type from input data.stats
//         semester: data.stats?.semester || "N/A",
//         examType: data.stats?.examType || "N/A",
//         generatedTimetable: generatedTimetable, // The actual schedule { date: { slot: [...] } }
//         stats: {
//           // Original stats + student stats
//           ...(data.stats || {}), // Include original stats like totalCourses etc.
//           studentStats: studentStats, // Add the calculated student stats
//         },
//       },
//     };

//     writeJSONFile(TIMETABLES_FILE, timetables);
//     console.log(`Timetable ${nextId} ("${name}") saved successfully.`);

//     res.json({
//       message: "Timetable saved successfully",
//       id: nextId, // Return the new ID
//     });
//   } catch (error) {
//     console.error("Error saving timetable:", error);
//     res
//       .status(500)
//       .json({ message: "Failed to save timetable", error: error.message });
//   }
// });


app.post("/api/saveTimetable", (req, res) => {
  try {
    // Expect 'name' and the complex 'data' object from the frontend
    const { name, data } = req.body; // Changed 'timetableData' to 'data'

    // --- *** UPDATED VALIDATION *** ---
    // Validate 'name'
    if (!name || typeof name !== 'string' || name.trim() === '') {
         console.error("Save timetable failed: Invalid or missing 'name'. Received name:", name);
         return res.status(400).json({ message: "Invalid or missing 'name' for the timetable." });
    }
    // Validate the top-level 'data' object exists
    if (!data || typeof data !== 'object') {
         console.error("Save timetable failed: Missing or invalid 'data' object in request body.");
         return res.status(400).json({ message: "Missing or invalid 'data' object in request body." });
    }
    // Validate structure *inside* the 'data' object
    if (!data.generatedTimetable || typeof data.generatedTimetable !== 'object' || data.generatedTimetable === null) {
        console.error("Save timetable failed: Invalid or missing 'generatedTimetable' inside 'data'. Received data.generatedTimetable:", data.generatedTimetable);
        return res.status(400).json({ message: "Invalid or missing 'generatedTimetable' schedule structure within 'data'." });
    }
     if (!data.stats || typeof data.stats !== 'object' || data.stats === null) {
        console.error("Save timetable failed: Invalid or missing 'stats' inside 'data'. Received data.stats:", data.stats);
        return res.status(400).json({ message: "Invalid or missing 'stats' structure within 'data'." });
    }

    // Extract necessary parts directly from the received 'data' object
    const generatedTimetable = data.generatedTimetable; // The actual schedule object { date: { slot: [...] } }
    const receivedStats = data.stats;                 // The stats object sent from frontend { totalCourses: ..., studentStats: {...}, conflicts: {...}, etc. }
    const receivedFormData = data.formData || {};     // Get formData if sent

    // --- Proceed with saving ---
    const timetables = readJSONFile(TIMETABLES_FILE);

    // Find the next available numeric ID
    let nextId = 1;
    const existingIds = Object.keys(timetables).map(Number).filter(id => !isNaN(id));
    if (existingIds.length > 0) {
      nextId = Math.max(...existingIds) + 1;
    }

    console.log(`Saving timetable "${name}" with ID ${nextId}`);

    // --- Student Statistics Calculation ---
    // We can potentially *trust* the studentStats sent from the frontend OR recalculate here.
    // For consistency and ensuring backend logic is the source of truth, let's recalculate.
    const studentStats = {}; // Recalculate server-side
     if (typeof generatedTimetable === 'object' && generatedTimetable !== null) {
        Object.entries(generatedTimetable).forEach(([date, slots]) => {
          if (typeof slots !== 'object' || slots === null) return;
          Object.entries(slots).forEach(([slot, courses]) => {
            if (!Array.isArray(courses)) return;
            courses.forEach((course) => {
              if (!course || !Array.isArray(course.students)) return;
              course.students.forEach((rollNumber) => {
                 if (rollNumber === null || rollNumber === undefined) return;
                if (!studentStats[rollNumber]) {
                  studentStats[rollNumber] = { totalExams: 0, daysWithMultipleExams: 0, scheduleConflicts: 0, examSchedule: [] };
                }
                const studentStat = studentStats[rollNumber];
                studentStat.totalExams++;
                studentStat.examSchedule.push({ date, slot, courseCode: course.code });
              });
            });
          });
        });

       // Calculate conflicts/stats per student based on recalculated schedule
       Object.values(studentStats).forEach((stats) => {
             stats.examSchedule.sort((a, b) => { /* ... chronological sort ... */
                const dateA = new Date(a.date); const dateB = new Date(b.date);
                if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
                return parseInt(a.slot) - parseInt(b.slot);
             });
             const examsByDaySlot = {}; let countedMultiExamDays = new Set();
              for (let i = 0; i < stats.examSchedule.length; i++) { /* ... conflict checking logic ... */
                const exam = stats.examSchedule[i]; const key = `${exam.date}-${exam.slot}`;
                if (!examsByDaySlot[key]) examsByDaySlot[key] = 0;
                examsByDaySlot[key]++; if (examsByDaySlot[key] > 1) stats.scheduleConflicts++;
                 if (i > 0) { const prevExam = stats.examSchedule[i-1]; if (exam.date === prevExam.date && exam.slot !== prevExam.slot) { if (!countedMultiExamDays.has(exam.date)) { stats.daysWithMultipleExams++; countedMultiExamDays.add(exam.date); } } }
             }
        });
     } else {
         console.warn("Skipping student stats recalculation due to invalid generatedTimetable structure.");
     }
     // --- End Student Statistics Calculation ---


    // --- Store the timetable with a consistent structure ---
    timetables[nextId] = {
      id: nextId,
      name: name.trim(), // Use the provided name, trimmed
      createdAt: new Date().toISOString(),
      // Standardize the saved structure under 'data' key
      data: {
        // Extract metadata from received data/formdata
        year: receivedFormData.year || data.year || "N/A", // Prioritize formData if available
        semester: receivedFormData.semester || data.semester || "N/A",
        examType: receivedFormData.examType || data.examType || "N/A",
        // Store the actual timetable schedule here
        generatedTimetable: generatedTimetable,
        // Combine original stats (if needed) with recalculated student stats
        stats: {
          totalCourses: receivedStats.totalCourses || 0, // Use stats sent from frontend
          scheduledCourses: receivedStats.scheduledCourses || 0,
          unscheduledCourses: receivedStats.unscheduledCourses || 0,
          // Use the RECALCULATED student stats for consistency
          studentStats: studentStats,
          // Optionally store conflicts calculated on frontend if needed, or recalculate
          conflicts: receivedStats.conflicts || {}, // Keep conflicts from frontend for now
          slotUtilization: receivedStats.slotUtilization || [], // Keep from frontend
        },
         // Keep other potentially useful info from the original 'data' object if desired
         formData: receivedFormData,
         examConfig: data.examConfig || {},
         fitness: data.fitness // Keep fitness if sent
      },
    };

    // Write the updated timetables object back to the file
    writeJSONFile(TIMETABLES_FILE, timetables);
    console.log(`Timetable ${nextId} ("${name.trim()}") saved successfully.`);

    // Send success response with the new ID
    res.status(201).json({ // Use 201 Created status
      message: "Timetable saved successfully",
      id: nextId,
    });
  } catch (error) {
    console.error("Error in POST /api/saveTimetable:", error);
     // Log the request body if possible to see what was actually received
     if(req.body) {
        console.error("Received request body:", JSON.stringify(req.body, null, 2));
     }
    res.status(500).json({ message: "Failed to save timetable", error: error.message });
  }
});

app.get("/api/timetables", (req, res) => {
  try {
    const timetables = readJSONFile(TIMETABLES_FILE);
    // Map timetable data to a summary list for frontend display
    const timetablesList = Object.values(timetables)
      // Ensure basic structure exists before mapping
      .filter((tt) => tt && tt.id && tt.name && tt.data && tt.data.stats)
      .map((timetable) => ({
        id: timetable.id,
        name: timetable.name,
        createdAt: timetable.createdAt || new Date(0).toISOString(), // Provide default if missing
        year: timetable.data.year || "N/A",
        semester: timetable.data.semester || "N/A",
        examType: timetable.data.examType || "N/A",
        // Safely access nested stats properties
        totalCourses: timetable.data.stats.totalCourses || 0,
        scheduledCourses: timetable.data.stats.scheduledCourses || 0,
      }))
      // Sort by creation date, newest first
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(timetablesList);
  } catch (error) {
    console.error("Error fetching timetables list:", error);
    res.status(500).json({
      message: "Failed to fetch timetables list",
      error: error.message,
    });
  }
});

app.get("/api/timetable/:id", (req, res) => {
  try {
    const { id } = req.params;
    // Validate ID format if necessary (e.g., ensure it's a number)
    const timetableId = parseInt(id, 10);
    if (isNaN(timetableId)) {
      return res.status(400).json({ message: "Invalid timetable ID format." });
    }

    const timetables = readJSONFile(TIMETABLES_FILE);
    const timetable = timetables[timetableId]; // Access using the numeric ID

    if (!timetable) {
      console.log(`Timetable with ID ${timetableId} not found.`);
      return res.status(404).json({ message: "Timetable not found" });
    }

    // Return the full timetable data
    res.json(timetable);
  } catch (error) {
    console.error(`Error fetching timetable ID ${req.params.id}:`, error);
    res.status(500).json({
      message: "Failed to fetch timetable details",
      error: error.message,
    });
  }
});

app.delete("/api/timetable/:id", (req, res) => {
  try {
    const { id } = req.params;
    // Validate ID
    const timetableId = parseInt(id, 10);
    if (isNaN(timetableId)) {
      return res.status(400).json({ message: "Invalid timetable ID format." });
    }

    const timetables = readJSONFile(TIMETABLES_FILE);

    if (!timetables[timetableId]) {
      console.log(
        `Attempted to delete non-existent timetable ID ${timetableId}`
      );
      return res.status(404).json({ message: "Timetable not found" });
    }

    console.log(`Deleting timetable ID ${timetableId}`);
    delete timetables[timetableId]; // Delete the entry
    writeJSONFile(TIMETABLES_FILE, timetables); // Save the updated object

    res.json({ message: "Timetable deleted successfully" });
  } catch (error) {
    console.error(`Error deleting timetable ID ${req.params.id}:`, error);
    res
      .status(500)
      .json({ message: "Failed to delete timetable", error: error.message });
  }
});

// --- Room and Seating Arrangement Logic ---

// GET /api/rooms (Using fetch as expected by seating logic)
// *** REMOVED the duplicate /api/rooms endpoint that used axios ***
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

// *** CORRECTED / NEW Seating Arrangement Preferences and Helpers ***

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

// *** CORRECTED / NEW Seating Arrangement Endpoint ***
// Matches the frontend call: POST /api/generateSeatingArrangement
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
    const timetable = timetables[timetableId];
    // Check timetable structure more thoroughly
    if (
      !timetable ||
      !timetable.data ||
      !timetable.data.generatedTimetable ||
      typeof timetable.data.generatedTimetable !== "object"
    ) {
      console.log(
        `Timetable not found or has invalid structure for ID: ${timetableId}`
      );
      return res
        .status(404)
        .json({ message: "Timetable not found or invalid structure" });
    }
    console.log(
      `Processing timetable: ${timetable.name || `ID ${timetableId}`}`
    );

    // --- 2. Fetch and Process Rooms ---
    console.log("Fetching rooms data from API for seating...");
    let apiRoomsData;
    try {
      const response = await fetch(
        "https://ims-dev.iiit.ac.in/exam_schedule_api.php?typ=getRooms&key=IMS&secret=ExamDegunGts"
      );
      if (!response.ok)
        throw new Error(`API Error ${response.status}: ${response.statusText}`);
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
    const dates = Object.keys(timetable.data.generatedTimetable).sort();

    for (const date of dates) {
      finalSeatingArrangement[date] = {};
      statistics[date] = {};
      const slots = timetable.data.generatedTimetable[date];

      // Check if slots is an object before proceeding
      if (typeof slots !== "object" || slots === null) {
        console.warn(`Invalid slots data for date ${date}. Skipping.`);
        continue;
      }

      const slotKeys = Object.keys(slots).sort(); // Sort slots (e.g., '1', '2')

      for (const slot of slotKeys) {
        console.log(`\n--- Processing Date: ${date}, Slot: ${slot} ---`);
        const coursesInSlotRaw = slots[slot] || [];

        // Ensure coursesInSlotRaw is an array before proceeding
        if (!Array.isArray(coursesInSlotRaw)) {
          console.warn(
            `Invalid courses data for ${date} Slot ${slot}. Expected array, got ${typeof coursesInSlotRaw}. Skipping slot.`
          );
          finalSeatingArrangement[date][slot] = {
            arrangements: [],
            totalStudents: 0,
            totalCapacity: totalCapacityAvailable,
            utilizationRate: 0,
            unassignedStudents: [],
            allocationMode: "Error - Invalid Input",
          };
          statistics[date][slot] = {
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
          finalSeatingArrangement[date][slot] = {
            arrangements: [],
            totalStudents: 0,
            totalCapacity: totalCapacityAvailable,
            utilizationRate: 0,
            unassignedStudents: [],
            allocationMode: "N/A",
          };
          statistics[date][slot] = {
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

        let slotArrangementResult = null;
        let unassignedStudentsListResult = [];
        let finalAllocationMode = "Preference";

        // --- Allocation Loop (Attempt 1: Pref, Attempt 2: Cap if needed) ---
        for (let attempt = 1; attempt <= 2; attempt++) {
          let useCapacityOrder = attempt === 2;
          console.log(
            `\nAllocation Attempt ${attempt}: ${
              useCapacityOrder ? "Capacity Order" : "Preference Order"
            }`
          );

          // 4a. Sort Rooms for this attempt
          const sortedRoomsForAttempt = [...availableApiRooms].sort((a, b) => {
            const detailsA = getRoomDetails(a.name);
            const detailsB = getRoomDetails(b.name);
            const prefA = detailsA ? detailsA.preference_order : Infinity;
            const prefB = detailsB ? detailsB.preference_order : Infinity;
            const capacityA = getTotalRoomCapacity(a.name, a.capacity);
            const capacityB = getTotalRoomCapacity(b.name, b.capacity);

            if (useCapacityOrder) {
              // Capacity Sort (Desc) -> Pref (Asc) -> Name (Asc)
              if (capacityB !== capacityA) return capacityB - capacityA;
              if (prefA !== prefB) return prefA - prefB;
            } else {
              // Preference Sort (Asc) -> Capacity (Desc) -> Name (Asc)
              if (prefA !== prefB) return prefA - prefB;
              if (capacityB !== capacityA) return capacityB - capacityA;
            }
            return a.name.localeCompare(b.name); // Final tie-breaker
          });
          // console.log(`Room Order: ${sortedRoomsForAttempt.map(r => r.name).join(', ')}`);

          // 4b. Initialize Room Structures for this attempt
          let currentRoomArrangements = sortedRoomsForAttempt.map((room) => ({
            roomId: room.id,
            roomName: room.name,
            capacity: room.capacity, // API capacity
            block: room.block,
            sections: { A: [], B: [], C: [], D: [] },
            totalCalcCapacity: getTotalRoomCapacity(room.name, room.capacity),
          }));

          // 4c. Prepare Student Lists
          let remainingStudentsMap = new Map();
          coursesToAllocate.forEach((course) => {
            remainingStudentsMap.set(course.code, [...course.students]);
          });
          let totalRemainingInAttempt = totalStudentsInSlot;

          // 4d. Iterative Student Placement
          let roomIndex = 0;
          let placedInCycle = true;
          while (totalRemainingInAttempt > 0 && placedInCycle) {
            placedInCycle = false;
            for (let course of coursesToAllocate) {
              // Iterate courses (largest first)
              const courseCode = course.code;
              const studentsForCourse = remainingStudentsMap.get(courseCode);

              if (studentsForCourse && studentsForCourse.length > 0) {
                const studentToPlace = studentsForCourse[0];
                let foundSpot = false;
                for (let i = 0; i < currentRoomArrangements.length; i++) {
                  // Cycle through rooms
                  let currentRoomCheckIdx =
                    (roomIndex + i) % currentRoomArrangements.length;
                  let room = currentRoomArrangements[currentRoomCheckIdx];
                  const bestSectionId = findBestSectionForStudent(
                    room,
                    courseCode
                  );

                  if (bestSectionId) {
                    const section = room.sections[bestSectionId];
                    section.push({
                      seatNumber: `${bestSectionId}${section.length + 1}`,
                      student: studentToPlace,
                      courseCode: courseCode,
                      courseName: course.name,
                    });
                    studentsForCourse.shift();
                    totalRemainingInAttempt--;
                    roomIndex = currentRoomCheckIdx; // Update starting point for next student
                    placedInCycle = true;
                    foundSpot = true;
                    break; // Placed this student, move to next
                  }
                } // End room search loop
              }
            } // End course loop for one cycle
            if (!placedInCycle && totalRemainingInAttempt > 0) {
              console.log(
                `Stopping cycle for Attempt ${attempt}: No placement possible. Remaining: ${totalRemainingInAttempt}`
              );
              break;
            }
          } // End while loop for placement in this attempt

          // 4e. Check Results
          let currentUnassigned = [];
          remainingStudentsMap.forEach((students, code) => {
            if (students.length > 0) {
              const courseInfo = coursesToAllocate.find((c) => c.code === code);
              currentUnassigned.push({
                courseCode: code,
                courseName: courseInfo ? courseInfo.name : "Unknown Course",
                students: students,
              });
            }
          });

          // 4f. Decide Outcome
          if (currentUnassigned.length === 0) {
            // Success
            console.log(
              `Attempt ${attempt} (${
                useCapacityOrder ? "Capacity" : "Preference"
              }) successful.`
            );
            slotArrangementResult = currentRoomArrangements;
            unassignedStudentsListResult = [];
            finalAllocationMode = useCapacityOrder
              ? "Capacity (Full)"
              : "Preference";
            break; // Done with attempts for this slot
          } else if (attempt === 1) {
            // Pref failed, try Cap
            console.log(
              `Attempt 1 (Preference) failed. Unassigned: ${currentUnassigned.reduce(
                (s, c) => s + c.students.length,
                0
              )}. Trying Capacity.`
            );
          } else {
            // Cap also failed
            console.log(
              `Attempt 2 (Capacity) failed. Unassigned: ${currentUnassigned.reduce(
                (s, c) => s + c.students.length,
                0
              )}.`
            );
            slotArrangementResult = currentRoomArrangements; // Keep Cap result
            unassignedStudentsListResult = currentUnassigned;
            finalAllocationMode = "Capacity (Partial)";
          }
        } // End allocation attempts loop

        // 4g. Finalize and Store Slot Results
        const finalArrangementForSlot = (slotArrangementResult || []).filter(
          (room) =>
            Object.values(room.sections).some((section) => section.length > 0)
        ); // Remove empty rooms

        // Sort final list *always* by preference order for display consistency
        finalArrangementForSlot.sort((a, b) => {
          const detailsA = getRoomDetails(a.roomName);
          const detailsB = getRoomDetails(b.roomName);
          const prefA = detailsA ? detailsA.preference_order : Infinity;
          const prefB = detailsB ? detailsB.preference_order : Infinity;
          if (prefA !== prefB) return prefA - prefB;
          return a.roomName.localeCompare(b.name); // Name as tie-breaker
        });

        const totalAssignedStudents =
          totalStudentsInSlot -
          unassignedStudentsListResult.reduce(
            (sum, c) => sum + c.students.length,
            0
          );
        const utilization =
          totalCapacityAvailable > 0
            ? (totalAssignedStudents / totalCapacityAvailable) * 100
            : 0;

        finalSeatingArrangement[date][slot] = {
          arrangements: finalArrangementForSlot,
          totalStudents: totalAssignedStudents,
          totalCapacity: totalCapacityAvailable,
          utilizationRate: parseFloat(utilization.toFixed(2)),
          unassignedStudents: unassignedStudentsListResult,
          allocationMode: finalAllocationMode,
        };

        statistics[date][slot] = {
          totalStudents: totalAssignedStudents,
          totalCapacity: totalCapacityAvailable,
          utilizationRate: parseFloat(utilization.toFixed(2)),
          roomsUsedCount: finalArrangementForSlot.length,
          roomsUsed: finalArrangementForSlot.map((room) => ({
            name: room.roomName,
            capacity: room.totalCalcCapacity,
            studentsPlaced: Object.values(room.sections).reduce(
              (sum, section) => sum + section.length,
              0
            ),
          })),
          unassignedCount: unassignedStudentsListResult.reduce(
            (sum, c) => sum + c.students.length,
            0
          ),
          unassignedDetails: unassignedStudentsListResult,
          allocationMode: finalAllocationMode,
        };
        console.log(
          `Slot ${date} ${slot} finished. Assigned: ${totalAssignedStudents}. Unassigned: ${statistics[date][slot].unassignedCount}. Mode: ${finalAllocationMode}`
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
        if (!timetableId) { // Check if timetableId is provided
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
        const savedArrangements = readJSONFile(SEATING_ARRANGEMENTS_FILE);

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
            timetableId: timetableId, // Store the link
            // Store the data received directly from the generation step
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
        const savedArrangements = readJSONFile(SEATING_ARRANGEMENTS_FILE);
        const list = Object.values(savedArrangements)
            .filter(sa => sa && sa.id && sa.name) // Basic validation
            .map(sa => ({
                id: sa.id,
                name: sa.name,
                createdAt: sa.createdAt || new Date(0).toISOString(),
                timetableId: sa.timetableId,
                // Include key metadata for display
                examType: sa.metadata?.examDetails?.examType || 'N/A',
                semester: sa.metadata?.examDetails?.semester || 'N/A',
                year: sa.metadata?.examDetails?.year || 'N/A',
                totalStudents: Object.values(sa.statistics || {}).reduce((sum, dateSlots) =>
                    sum + Object.values(dateSlots).reduce((slotSum, slotData) => slotSum + (slotData.totalStudents || 0), 0)
                , 0) // Calculate total students across all slots
            }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Sort newest first

        res.json(list);

    } catch (error) {
        console.error("Error in GET /api/seatingArrangements:", error);
        res.status(500).json({ message: "Failed to fetch seating arrangements list", error: error.message });
    }
});

// GET /api/seatingArrangement/:id (Get details of one arrangement)
app.get("/api/seatingArrangement/:id", (req, res) => {
    try {
        const { id } = req.params;
        const arrangementId = parseInt(id, 10);
        if (isNaN(arrangementId)) {
            return res.status(400).json({ message: "Invalid seating arrangement ID format." });
        }

        const savedArrangements = readJSONFile(SEATING_ARRANGEMENTS_FILE);
        const arrangement = savedArrangements[arrangementId];

        if (!arrangement) {
            console.log(`Seating arrangement with ID ${arrangementId} not found.`);
            return res.status(404).json({ message: "Seating arrangement not found" });
        }

        // Return the full saved data object
        res.json(arrangement);

    } catch (error) {
        console.error(`Error fetching seating arrangement ID ${req.params.id}:`, error);
        res.status(500).json({ message: "Failed to fetch seating arrangement details", error: error.message });
    }
});

// --- Server Start ---
const PORT = process.env.PORT || 3000; // Use 3000 as default based on your error log
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Data directory: ${path.resolve(DATA_DIR)}`); // Log resolved path
  console.log(`Timetables file: ${TIMETABLES_FILE}`);
  console.log(`Courses file: ${COURSES_FILE}`);
  console.log(`Users file: ${USERS_FILE}`);
  console.log(
    `Frontend URL configured for CORS/CAS: ${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }`
  );
  console.log(`CAS Service URL: ${SERVICE_URL}`);
});
