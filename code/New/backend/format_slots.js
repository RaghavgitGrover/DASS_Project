import fs from "fs";

// File Paths
const slotsFile = "Spring_2025_Mid_Sem.json"; // Updated to JSON file
const studentDataFile = "student_course_data_2024-25_Spring.json";
const outputFile = "formatted_slots.json";

// Step 1: Read and parse the slots JSON file
if (!fs.existsSync(slotsFile)) {
    console.error(`Error: Slots file '${slotsFile}' not found!`);
    process.exit(1);
}

let slotsDict;
try {
    const slotsData = fs.readFileSync(slotsFile, "utf8");
    slotsDict = JSON.parse(slotsData);
} catch (error) {
    console.error(`Error parsing ${slotsFile}: ${error.message}`);
    process.exit(1);
}

// Step 2: Read and parse the student registration JSON
if (!fs.existsSync(studentDataFile)) {
    console.error(`Error: Student data file '${studentDataFile}' not found!`);
    process.exit(1);
}

const studentData = JSON.parse(fs.readFileSync(studentDataFile, "utf8"));

// Step 3: Create a mapping of course codes to names
let courseMap = {};
for (const key in studentData["Applications"]) {
    const entry = studentData["Applications"][key];
    courseMap[entry["coursecode"]] = entry["coursename"];
}

// Step 4: Transform the slots data to the required format
let formattedSlots = {};

for (const slot in slotsDict) {
    formattedSlots[slot] = slotsDict[slot].map(courseCode => ({
        code: courseCode,
        name: courseMap[courseCode] || "Unknown Course"
    }));
}

// Step 5: Write the formatted output to a new JSON file
fs.writeFileSync(outputFile, JSON.stringify(formattedSlots, null, 4));

console.log(`Formatted slot data has been saved to '${outputFile}' successfully!`);
