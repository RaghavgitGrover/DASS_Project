import fs from "fs";
import readline from "readline";
import fetch from "node-fetch";

// Function to prompt user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question("Enter academic year (e.g., 2024-25): ", (year) => {
    rl.question("Enter semester (e.g., Spring/Fall): ", (semester) => {
        rl.question("Enter course code (e.g., CS1.404): ", async (courseCode) => {

            const filename = `student_course_data_${year}_${semester}.json`;
            const slotsFile = "Spring_2025_Mid_Sem.json"; // JSON file instead of .txt
            const api_url = `https://ims-dev.iiit.ac.in/exam_schedule_api.php?typ=getStudData&key=IMS&secret=ExamDegunGts&year=${year}&semester=${semester}`;

            console.log("Fetching student data from API...");

            try {
                // Fetch student data from API
                const response = await fetch(api_url);
                if (!response.ok) {
                    throw new Error("Failed to fetch data from API!");
                }
                const apiData = await response.json();

                // Extract student records matching the course code
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

                if (newEntries.length === 0) {
                    console.log(`No students found for course ${courseCode}!`);
                    rl.close();
                    return;
                }

                console.log(`${newEntries.length} students found. Updating file...`);

                // Read existing JSON file
                let jsonData = { "Applications": {} };
                if (fs.existsSync(filename)) {
                    const fileContent = fs.readFileSync(filename, "utf8");
                    jsonData = JSON.parse(fileContent);
                } else {
                    console.log(`File ${filename} does not exist. Creating a new one.`);
                }

                // Append new course details
                let applications = jsonData["Applications"];
                for (const entry of newEntries) {
                    applications[Object.keys(applications).length + 1] = entry;
                }

                // **Fix Serial Numbering**
                let reorderedApplications = {};
                let count = 1;
                for (const key in applications) {
                    reorderedApplications[count] = applications[key];
                    count++;
                }
                jsonData["Applications"] = reorderedApplications;

                // Write updated JSON back to the file
                fs.writeFileSync(filename, JSON.stringify(jsonData, null, 4));
                console.log(`Course ${courseCode} data appended successfully to ${filename}`);

                // === Find a Suitable Slot in JSON ===
                console.log("Finding suitable slot for the new course...");

                if (!fs.existsSync(slotsFile)) {
                    console.log(`Slots file ${slotsFile} not found!`);
                    rl.close();
                    return;
                }

                // Read and parse slots JSON file
                let slotsDict;
                try {
                    const slotsData = fs.readFileSync(slotsFile, "utf8");
                    slotsDict = JSON.parse(slotsData);
                    console.log("Slots data successfully parsed.");
                } catch (error) {
                    console.error("Error parsing slots JSON file:", error.message);
                    rl.close();
                    return;
                }

                // Find the least conflicting slot
                let assignedSlot = null;

                for (const slot in slotsDict) {
                    let slotCourses = slotsDict[slot];

                    // Check if the course conflicts with existing student courses
                    let conflict = false;
                    for (const entry of newEntries) {
                        let studentRoll = entry["rollnumber"];
                        let studentCourses = Object.values(applications)
                            .filter(s => s["rollnumber"] === studentRoll)
                            .map(s => s["coursecode"]);

                        if (studentCourses.some(course => slotCourses.includes(course))) {
                            conflict = true;
                            break;
                        }
                    }

                    if (!conflict) {
                        assignedSlot = slot;
                        slotsDict[slot].push(courseCode);
                        break;
                    }
                }

                if (assignedSlot) {
                    console.log(`Assigned ${courseCode} to Slot ${assignedSlot}`);

                    // Write updated slots back to JSON file
                    fs.writeFileSync(slotsFile, JSON.stringify(slotsDict, null, 4));
                    console.log(`Updated slot information saved to ${slotsFile}`);
                } else {
                    console.log(`No available slot found for ${courseCode}!`);
                }

            } catch (error) {
                console.error("Error processing the file:", error.message);
            } finally {
                rl.close();
            }
        });
    });
});
