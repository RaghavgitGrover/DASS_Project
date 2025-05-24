import fs from "fs";
import axios from "axios";
import readline from "readline";

// Function to prompt user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Step 1: Take user input
rl.question("Enter academic year (e.g., 2024-25): ", (year) => {
    rl.question("Enter semester (e.g., Spring/Fall): ", async (semester) => {
        const apiUrl = `https://ims-dev.iiit.ac.in/exam_schedule_api.php?typ=getStudData&key=IMS&secret=ExamDegunGts&year=${year}&semester=${semester}`;

        try {
            // Step 2: Fetch data from the API
            console.log("Fetching student data from API...");
            const response = await axios.get(apiUrl);
            const apiData = response.data;

            if (!apiData.Applications) {
                console.error("Invalid API response format!");
                rl.close();
                return;
            }

            const applications = apiData.Applications; // Extract student-course mappings

            // Step 3: Read slots from the provided JSON file
            const jsonFile = "Spring_2025_Mid_Sem.json"; // Ensure correct filename

            console.log("Reading slots JSON file...");
            let slotsDict;
            try {
                const jsonData = fs.readFileSync(jsonFile, "utf8");
                slotsDict = JSON.parse(jsonData); // Parse JSON directly
            } catch (error) {
                console.error("Error parsing slots JSON file! Ensure it's correctly formatted.");
                rl.close();
                return;
            }

            // Step 4: Filter student-course data to match only slot courses
            console.log("Filtering student-course data...");
            let filteredApplications = {};

            for (let key in applications) {
                let entry = applications[key];
                let courseCode = entry.coursecode;

                // Check if the course is in any slot
                if (Object.values(slotsDict).some(courses => courses.includes(courseCode))) {
                    filteredApplications[key] = entry; // Keep only valid courses
                }
            }

            // Step 5: Save the data as JSON in the required format
            const outputData = { "Applications": filteredApplications };
            const outputFilename = `student_course_data_${year}_${semester}.json`;

            fs.writeFileSync(outputFilename, JSON.stringify(outputData, null, 4));

            console.log(`Filtered student course data saved to ${outputFilename}`);
        } catch (error) {
            console.error("Error fetching data from API or processing data:", error.message);
        } finally {
            rl.close();
        }
    });
});
