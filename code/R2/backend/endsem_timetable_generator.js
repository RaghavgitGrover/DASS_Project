import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to load and parse JSON file
function loadJsonFile(filePath) {
    try {
        const rawData = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        console.error(`Error loading JSON file ${filePath}:`, error);
        return null;
    }
}

// Function to get students enrolled in a course
function getStudentsInCourse(courseCode, studentData) {
    const students = new Set();
    for (const [_, application] of Object.entries(studentData.Applications)) {
        if (application.coursecode === courseCode) {
            students.add(application.rollnumber);
        }
    }
    return students;
}

// Function to check if there's a clash between students in two courses
function hasStudentClash(course1Students, course2Students) {
    for (const student of course1Students) {
        if (course2Students.has(student)) {
            return true;
        }
    }
    return false;
}

// Function to check for clashes in a slot
function hasClashInSlot(courseStudents, slotCourses, studentData) {
    // First collect all students from existing courses in the slot
    const allStudentsInSlot = new Set();
    for (const existingCourse of slotCourses) {
        const existingStudents = getStudentsInCourse(existingCourse.code, studentData);
        for (const student of existingStudents) {
            allStudentsInSlot.add(student);
        }
    }

    // Then check if any student from the new course is already in the slot
    for (const student of courseStudents) {
        if (allStudentsInSlot.has(student)) {
            return true;
        }
    }
    return false;
}

// Function to count consecutive exams for a student in a day
function countConsecutiveExams(studentCourses, daySlots) {
    let consecutiveCount = 0;
    let maxConsecutive = 0;

    for (const slot of daySlots) {
        const hasExam = slot.courses.some(course => studentCourses.has(course.code));
        if (hasExam) {
            consecutiveCount++;
            maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
        } else {
            consecutiveCount = 0;
        }
    }

    return maxConsecutive;
}

// Function to calculate timetable score (lower is better)
function calculateTimetableScore(timetable, studentCourses) {
    let totalScore = 0;
    const studentScores = new Map();

    // Calculate score for each day
    for (let day = 1; day <= 7; day++) {
        const dayKey = `day${day}`;
        const daySlots = timetable[dayKey].slots;

        // Calculate score for each student
        for (const [rollNumber, courses] of studentCourses) {
            const consecutiveExams = countConsecutiveExams(courses, daySlots);
            let studentScore = 0;

            // Scoring hierarchy:
            // 2 consecutive exams: 5 points
            // 1 exam or no consecutive: 0 points
            switch (consecutiveExams) {
                case 2:
                    studentScore = 5;
                    break;
                default:
                    studentScore = 0;
                    break;
            }

            // Track student's score
            if (!studentScores.has(rollNumber)) {
                studentScores.set(rollNumber, {
                    total: 0,
                    days: []
                });
            }
            studentScores.get(rollNumber).total += studentScore;
            studentScores.get(rollNumber).days.push({
                day: day,
                consecutiveExams,
                score: studentScore
            });

            totalScore += studentScore;
        }
    }

    return {
        totalScore,
        studentScores
    };
}

// Function to count number of student clashes between two courses
function countStudentClashes(course1Students, course2Students) {
    let clashCount = 0;
    for (const student of course1Students) {
        if (course2Students.has(student)) {
            clashCount++;
        }
    }
    return clashCount;
}

// Function to find course with least clashes
function findCourseWithLeastClashes(courseToPlace, slotCourses, studentData) {
    const courseToPlaceStudents = getStudentsInCourse(courseToPlace.code, studentData);
    let minClashes = Infinity;
    let bestCourse = null;
    let bestClashCount = 0;

    for (const existingCourse of slotCourses) {
        const existingStudents = getStudentsInCourse(existingCourse.code, studentData);
        const clashCount = countStudentClashes(courseToPlaceStudents, existingStudents);

        if (clashCount < minClashes) {
            minClashes = clashCount;
            bestCourse = existingCourse;
            bestClashCount = clashCount;
        }
    }

    return { course: bestCourse, clashCount: bestClashCount };
}

// Phase 1: Redistribute courses from slots 15-16 to slots 1-14
function redistributeFromSlots15_16(timetableData, studentData) {
    const timetable = {
        day1: { slots: Array(2).fill(null).map(() => ({ courses: [] })) },
        day2: { slots: Array(2).fill(null).map(() => ({ courses: [] })) },
        day3: { slots: Array(2).fill(null).map(() => ({ courses: [] })) },
        day4: { slots: Array(2).fill(null).map(() => ({ courses: [] })) },
        day5: { slots: Array(2).fill(null).map(() => ({ courses: [] })) },
        day6: { slots: Array(2).fill(null).map(() => ({ courses: [] })) },
        day7: { slots: Array(2).fill(null).map(() => ({ courses: [] })) }
    };

    // Place all courses in their original slots
    for (const [slotNumber, slotCourses] of Object.entries(timetableData)) {
        const slotNum = parseInt(slotNumber);
        if (slotNum >= 15 && slotNum <= 16) continue; // Skip slots 15-16 for now

        const day = Math.floor((slotNum - 1) / 2) + 1;
        const slot = (slotNum - 1) % 2;
            const dayKey = `day${day}`;

        // Add roll numbers to each course
        const coursesWithRollNumbers = slotCourses.map(course => {
            const courseStudents = getStudentsInCourse(course.code, studentData);
            return {
                ...course,
                students: Array.from(courseStudents)
            };
        });

        timetable[dayKey].slots[slot].courses = coursesWithRollNumbers;
    }

    // Get courses from slots 15-16
    const coursesToRedistribute = [];
    for (const [slotNumber, slotCourses] of Object.entries(timetableData)) {
        const slotNum = parseInt(slotNumber);
        if (slotNum >= 15 && slotNum <= 16) {
            coursesToRedistribute.push(...slotCourses);
        }
    }

    // Try to place each course from slots 15-16
    for (const course of coursesToRedistribute) {
        const courseStudents = getStudentsInCourse(course.code, studentData);
        let placed = false;

        // First try direct placement
        for (let day = 1; day <= 7; day++) {
            const dayKey = `day${day}`;
            for (let slot = 0; slot < 2; slot++) {
                if (!hasClashInSlot(courseStudents, timetable[dayKey].slots[slot].courses, studentData)) {
                    timetable[dayKey].slots[slot].courses.push(course);
                    placed = true;
                    break;
                }
            }
            if (placed) break;
        }

        // If direct placement failed, try to move conflicting courses
        if (!placed) {
            console.log(`\nTrying to find a solution for ${course.code} by moving conflicting courses...`);
            let bestSolution = null;
            let bestSolutionScore = Infinity;

            // Try each slot to find where we want to place the course
            for (let targetDay = 1; targetDay <= 7; targetDay++) {
                const targetDayKey = `day${targetDay}`;
                for (let targetSlot = 0; targetSlot < 2; targetSlot++) {
                    const targetSlotCourses = timetable[targetDayKey].slots[targetSlot].courses;

                    // Find all courses in this slot that have clashes with our course
                    const conflictingCourses = [];
                    for (const existingCourse of targetSlotCourses) {
                        const existingStudents = getStudentsInCourse(existingCourse.code, studentData);
                        if (hasStudentClash(courseStudents, existingStudents)) {
                            conflictingCourses.push(existingCourse);
                        }
                    }

                    // Try to find new positions for all conflicting courses
                    const tempTimetable = JSON.parse(JSON.stringify(timetable));
                    tempTimetable[targetDayKey].slots[targetSlot].courses =
                        tempTimetable[targetDayKey].slots[targetSlot].courses
                            .filter(c => !conflictingCourses.some(conflict => conflict.code === c.code));

                    // Try to place each conflicting course
                    let allConflictsPlaced = true;
                    const moves = [];

                    for (const conflictCourse of conflictingCourses) {
                        const conflictStudents = getStudentsInCourse(conflictCourse.code, studentData);
                        let conflictPlaced = false;

                        // Try to find a new position for this conflicting course
                        for (let newDay = 1; newDay <= 7; newDay++) {
                            const newDayKey = `day${newDay}`;
                            for (let newSlot = 0; newSlot < 2; newSlot++) {
                                // Skip the target slot where we want to place the original course
                                if (newDay === targetDay && newSlot === targetSlot) continue;

                                if (!hasClashInSlot(conflictStudents, tempTimetable[newDayKey].slots[newSlot].courses, studentData)) {
                                    tempTimetable[newDayKey].slots[newSlot].courses.push(conflictCourse);
                                    moves.push({
                                        course: conflictCourse,
                                        fromDay: targetDay,
                                        fromSlot: targetSlot,
                                        toDay: newDay,
                                        toSlot: newSlot
                                    });
                                    conflictPlaced = true;
                                    break;
                                }
                            }
                            if (conflictPlaced) break;
                        }

                        if (!conflictPlaced) {
                            allConflictsPlaced = false;
                            break;
                        }
                    }

                    // If we found a solution that places all conflicting courses
                    if (allConflictsPlaced) {
                        // Calculate a score for this solution (lower is better)
                        const solutionScore = moves.length;
                        if (solutionScore < bestSolutionScore) {
                            bestSolutionScore = solutionScore;
                            bestSolution = {
                                targetDay,
                                targetSlot,
                                moves
                            };
                        }
                    }
                }
            }

            // If we found a solution, execute it
            if (bestSolution) {
                console.log(`Found a solution for ${course.code}:`);
                console.log(`Moving ${bestSolution.moves.length} conflicting courses to make space in Day ${bestSolution.targetDay} Slot ${bestSolution.targetSlot + 1}`);

                // Execute all moves
                for (const move of bestSolution.moves) {
                    const fromDayKey = `day${move.fromDay}`;
                    const toDayKey = `day${move.toDay}`;

                    // Remove course from original position
                    timetable[fromDayKey].slots[move.fromSlot].courses =
                        timetable[fromDayKey].slots[move.fromSlot].courses
                            .filter(c => c.code !== move.course.code);

                    // Add to new position
                    timetable[toDayKey].slots[move.toSlot].courses.push(move.course);

                    console.log(`- Moved ${move.course.code} from Day ${move.fromDay} Slot ${move.fromSlot + 1} to Day ${move.toDay} Slot ${move.toSlot + 1}`);
                }

                // Now place the original course
                const targetDayKey = `day${bestSolution.targetDay}`;
                timetable[targetDayKey].slots[bestSolution.targetSlot].courses.push(course);
                placed = true;
            }
        }

        if (!placed) {
            console.error(`Error: Could not place course ${course.code} even after trying to move conflicting courses. Stopping timetable generation.`);
            return null;
        }
    }

    return timetable;
}

// Phase 2: Shuffle slots across 7 days while keeping courses within slots intact
function shuffleSlotsAcrossDays(timetable, studentCourses) {
    // Collect all slots with their courses
    const slots = [];
    for (let day = 1; day <= 7; day++) {
        const dayKey = `day${day}`;
        for (let slot = 0; slot < 2; slot++) {
            slots.push({
                day: day,
                slot: slot,
                courses: [...timetable[dayKey].slots[slot].courses]
            });
        }
    }

    // Shuffle the slots randomly
    for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [slots[i], slots[j]] = [slots[j], slots[i]];
    }

    // Create new empty timetable
    const shuffledTimetable = {
        day1: { slots: Array(2).fill(null).map(() => ({ courses: [] })) },
        day2: { slots: Array(2).fill(null).map(() => ({ courses: [] })) },
        day3: { slots: Array(2).fill(null).map(() => ({ courses: [] })) },
        day4: { slots: Array(2).fill(null).map(() => ({ courses: [] })) },
        day5: { slots: Array(2).fill(null).map(() => ({ courses: [] })) },
        day6: { slots: Array(2).fill(null).map(() => ({ courses: [] })) },
        day7: { slots: Array(2).fill(null).map(() => ({ courses: [] })) }
    };

    // Place slots in new positions
    let slotIndex = 0;
    for (let day = 1; day <= 7; day++) {
        const dayKey = `day${day}`;
        for (let slot = 0; slot < 2; slot++) {
            shuffledTimetable[dayKey].slots[slot].courses = slots[slotIndex].courses;
            slotIndex++;
        }
    }

    // Try to optimize slot positions to minimize consecutive exams
    let bestTimetable = JSON.parse(JSON.stringify(shuffledTimetable));
    let bestScore = calculateTimetableScore(shuffledTimetable, studentCourses).totalScore;
    const maxAttempts = 50;
    let attempts = 0;

    while (attempts < maxAttempts) {
        // Create a copy of the current timetable
        const currentTimetable = JSON.parse(JSON.stringify(bestTimetable));

        // Try swapping two random slots
        const day1 = Math.floor(Math.random() * 7) + 1;
        const day2 = Math.floor(Math.random() * 7) + 1;
        const slot1 = Math.floor(Math.random() * 2);
        const slot2 = Math.floor(Math.random() * 2);

        const day1Key = `day${day1}`;
        const day2Key = `day${day2}`;

        // Swap the slots
        [currentTimetable[day1Key].slots[slot1].courses, currentTimetable[day2Key].slots[slot2].courses] =
        [currentTimetable[day2Key].slots[slot2].courses, currentTimetable[day1Key].slots[slot1].courses];

        // Calculate new score
        const newScore = calculateTimetableScore(currentTimetable, studentCourses).totalScore;

        // If the new arrangement is better, keep it
        if (newScore < bestScore) {
            bestTimetable = currentTimetable;
            bestScore = newScore;
        }

        attempts++;
    }

    return bestTimetable;
}

// Phase 3: Optimize based on most mentioned exams in consecutive stats
function optimizeBasedOnMostMentioned(timetable, studentCourses, studentData) {
    const stats = generateConsecutiveExamStats(timetable, studentCourses);
    const courseFrequency = new Map();

    // Count frequency of each course in consecutive exams
    for (const student of stats.twoConsecutive) {
        for (const consecutiveSet of student.consecutiveCourses) {
            for (const course of consecutiveSet) {
                if (!courseFrequency.has(course.code)) {
                    courseFrequency.set(course.code, {
                        course: course,
                        count: 0,
                        students: new Set()
                    });
                }
                courseFrequency.get(course.code).count++;
                courseFrequency.get(course.code).students.add(student.rollNumber);
            }
        }
    }

    // Sort courses by frequency (most common first)
    const sortedCourses = Array.from(courseFrequency.entries())
        .sort((a, b) => b[1].count - a[1].count);

    let bestTimetable = JSON.parse(JSON.stringify(timetable));
    let bestScore = calculateTimetableScore(timetable, studentCourses).totalScore;

    // Try to optimize each course, starting with the most frequent ones
    for (const [courseCode, courseInfo] of sortedCourses) {
        if (courseInfo.count < 2) continue;

        const course = courseInfo.course;
        let currentDay = null;
        let currentSlot = null;

        // Find current position of the course
        for (let day = 1; day <= 7; day++) {
            const dayKey = `day${day}`;
            for (let slot = 0; slot < 2; slot++) {
                if (bestTimetable[dayKey].slots[slot].courses.some(c => c.code === course.code)) {
                    currentDay = dayKey;
                    currentSlot = slot;
                    break;
                }
            }
            if (currentDay) break;
        }

        if (!currentDay) continue;

        const courseStudents = getStudentsInCourse(course.code, studentData);
        let bestNewDay = null;
        let bestNewSlot = null;
        let bestNewScore = bestScore;

        // Try moving the course to every possible slot
        for (let day = 1; day <= 7; day++) {
            const dayKey = `day${day}`;
            for (let slot = 0; slot < 2; slot++) {
                if (dayKey === currentDay && slot === currentSlot) continue;

                // Check if moving would create any clashes
                if (!hasClashInSlot(courseStudents, bestTimetable[dayKey].slots[slot].courses, studentData)) {
                    // Temporarily move the course
                    bestTimetable[currentDay].slots[currentSlot].courses =
                        bestTimetable[currentDay].slots[currentSlot].courses.filter(c => c.code !== course.code);
                    bestTimetable[dayKey].slots[slot].courses.push(course);

                    const newScore = calculateTimetableScore(bestTimetable, studentCourses);

                    // Only accept if it improves the score
                    if (newScore.totalScore < bestNewScore) {
                        bestNewScore = newScore.totalScore;
                        bestNewDay = dayKey;
                        bestNewSlot = slot;
                    }

                    // Move the course back
                    bestTimetable[dayKey].slots[slot].courses =
                        bestTimetable[dayKey].slots[slot].courses.filter(c => c.code !== course.code);
                    bestTimetable[currentDay].slots[currentSlot].courses.push(course);
                }
            }
        }

        // If we found a better position, make the move
        if (bestNewDay && bestNewSlot) {
            bestTimetable[currentDay].slots[currentSlot].courses =
                bestTimetable[currentDay].slots[currentSlot].courses.filter(c => c.code !== course.code);
            bestTimetable[bestNewDay].slots[bestNewSlot].courses.push(course);
            bestScore = bestNewScore;
        }
    }

    return bestTimetable;
}

// Function to generate statistics for consecutive exams
function generateConsecutiveExamStats(timetable, studentCourses) {
    const stats = {
        twoConsecutive: []
    };

    // Calculate stats for each day
    for (let day = 1; day <= 7; day++) {
        const dayKey = `day${day}`;
        const daySlots = timetable[dayKey].slots;

        // Calculate stats for each student
        for (const [rollNumber, courses] of studentCourses) {
            const consecutiveExams = countConsecutiveExams(courses, daySlots);

            if (consecutiveExams === 2) {
                // Find which courses are consecutive
                let consecutiveCourses = [];
                let currentStreak = [];

                for (const slot of daySlots) {
                    const studentCoursesInSlot = slot.courses.filter(course => courses.has(course.code));
                    if (studentCoursesInSlot.length > 0) {
                        currentStreak.push(...studentCoursesInSlot);
                    } else {
                        if (currentStreak.length === 2) {
                            consecutiveCourses.push([...currentStreak]);
                        }
                        currentStreak = [];
                    }
                }

                // Check if there's a streak at the end of the day
                if (currentStreak.length === 2) {
                    consecutiveCourses.push([...currentStreak]);
                }

                const studentInfo = {
                    rollNumber,
                    day: day,
                    consecutiveCourses
                };

                stats.twoConsecutive.push(studentInfo);
            }
        }
    }

    return stats;
}

// Function to format statistics for file output
function formatStatsForOutput(stats, timetable, studentCourses) {
    return {
        totalStudents: {
            twoConsecutive: stats.twoConsecutive.length
        },
        details: {
            twoConsecutive: stats.twoConsecutive.map(student => ({
                rollNumber: student.rollNumber,
                day: student.day,
                courses: student.consecutiveCourses.map(courses =>
                    courses.map(course => ({
                        code: course.code,
                        name: course.name
                    }))
                )
            }))
        }
    };
}

// Function to format timetable as CSV
function createTimetableCSV(timetable, version) {
    // Create header row with slots
    let csvContent = 'Day,Slot 1,Slot 2\n';

    // Add each day as a row
    for (let day = 1; day <= 7; day++) {
        const dayKey = `day${day}`;
        let row = `Day ${day}`;

        // Add each slot's courses to the row
        for (let slot = 0; slot < 2; slot++) {
            const courses = timetable[dayKey].slots[slot].courses;
            if (courses.length === 0) {
                row += ',';
            } else {
                // Format each course on a new line
                const courseStrings = courses.map(course => `${course.code}: ${course.name}`).join('\n');
                row += `,"${courseStrings}"`;
            }
        }

        csvContent += row + '\n';
    }

    return csvContent;
}

function createStudentTimetables(bestTimetable, studentCourses) {
    const studentTimetables = {};

    studentCourses.forEach((courses, rollNumber) => {
        const studentSchedule = {};

        // Initialize empty structure
        for (let day = 1; day <= 7; day++) {
            studentSchedule[`day${day}`] = {
                slot1: [], slot2: []
            };
        }

        // Find courses in each slot
        for (let day = 1; day <= 7; day++) {
            const dayKey = `day${day}`;
            for (let slot = 0; slot < 2; slot++) {
                const slotKey = `slot${slot + 1}`;
                bestTimetable[dayKey].slots[slot].courses.forEach(course => {
                    if (courses.has(course.code)) {
                        studentSchedule[dayKey][slotKey].push({
                            code: course.code,
                            name: course.name
                        });
                    }
                });
            }
        }

        studentTimetables[rollNumber] = studentSchedule;
    });

    return studentTimetables;
}

// Function to check if two timetables are identical
function areTimetablesIdentical(timetable1, timetable2) {
    for (let day = 1; day <= 7; day++) {
        const dayKey = `day${day}`;
        for (let slot = 0; slot < 2; slot++) {
            const courses1 = timetable1[dayKey].slots[slot].courses;
            const courses2 = timetable2[dayKey].slots[slot].courses;

            if (courses1.length !== courses2.length) return false;

            // Sort courses by code to ensure consistent comparison
            const sortedCourses1 = [...courses1].sort((a, b) => a.code.localeCompare(b.code));
            const sortedCourses2 = [...courses2].sort((a, b) => a.code.localeCompare(b.code));

            for (let i = 0; i < sortedCourses1.length; i++) {
                if (sortedCourses1[i].code !== sortedCourses2[i].code) return false;
            }
        }
    }
    return true;
}

// Function to analyze clashes in the timetable
function analyzeClashes(timetableData, studentData) {
    const clashes = [];
    const studentCourses = new Map();

    // First, get all courses for each student
    for (const [_, application] of Object.entries(studentData.Applications)) {
        const rollNumber = application.rollnumber;
        const courseCode = application.coursecode;

        if (!studentCourses.has(rollNumber)) {
            studentCourses.set(rollNumber, new Set());
        }
        studentCourses.get(rollNumber).add(courseCode);
    }

    // Check each slot
    for (const [slotNumber, slotCourses] of Object.entries(timetableData)) {
        const slotNum = parseInt(slotNumber);
        const day = Math.floor((slotNum - 1) / 2) + 1;
        const slot = (slotNum - 1) % 2;

        // Check each student's courses in this slot
        studentCourses.forEach((courses, rollNumber) => {
            const studentCoursesInSlot = slotCourses.filter(course => courses.has(course.code));

            if (studentCoursesInSlot.length > 1) {
                clashes.push({
                    student: rollNumber,
                    day: day,
                    slot: slot + 1,
                    courses: studentCoursesInSlot.map(course => ({
                        code: course.code,
                        name: course.name
                    }))
                });
            }
        });
    }

    return clashes;
}

// Main function to generate timetable
async function generateTimetable_full() {
    // Load timetable data
    const timetableData = loadJsonFile(path.join(__dirname, 'data/formatted_slots.json'));

    // Load student data
    const studentData = loadJsonFile(path.join(__dirname, 'data/student_course_data.json'));

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

    // Add this after loading the data but before generating timetables
    console.log('\nAnalyzing clashes in the original timetable...');
    const originalClashes = analyzeClashes(timetableData, studentData);

    if (originalClashes.length > 0) {
        console.log('\nFound clashes in the original timetable:');
        return {
            success: false,
            message: "Clashes found in the original timetable. Please resolve these clashes before generating new timetables.",
            data: originalClashes
        }
    } else {
        console.log('No clashes found in the original timetable.');
    }

    // Generate 25 timetables and store them with their scores
    console.log('\nGenerating 25 timetables to find the best ones...');
    const allTimetables = [];

    for (let i = 1; i <= 25; i++) {
        console.log(`\nGenerating Timetable ${i}/25`);

        // Phase 1: Redistribute courses from slots 15-16
        console.log('Phase 1: Redistributing courses from slots 15-16...');
        let timetable = redistributeFromSlots15_16(timetableData, studentData);

        // If redistribution failed, skip this iteration
        if (!timetable) {
            console.log('Skipping this iteration due to redistribution failure');
            continue;
        }

        // Phase 2: Shuffle all slots across 7 days
        console.log('Phase 2: Shuffling all slots across 7 days...');
        timetable = shuffleSlotsAcrossDays(timetable, studentCourses);

        // Phase 3: Optimize based on most mentioned exams
        console.log('Phase 3: Optimizing based on most mentioned exams...');
        timetable = optimizeBasedOnMostMentioned(timetable, studentCourses, studentData);

        const scoreResult = calculateTimetableScore(timetable, studentCourses);
        const stats = generateConsecutiveExamStats(timetable, studentCourses);

        // Store timetable with its score and stats
        allTimetables.push({
            timetable,
            score: scoreResult.totalScore,
            studentScores: scoreResult.studentScores,
            stats: stats
        });
    }

    // Sort timetables by score (lower is better)
    const validTimetables = allTimetables.sort((a, b) => a.score - b.score);

    // Remove duplicate timetables
    const uniqueTimetables = [];
    for (const timetable of validTimetables) {
        let isDuplicate = false;
        for (const uniqueTimetable of uniqueTimetables) {
            if (areTimetablesIdentical(timetable.timetable, uniqueTimetable.timetable)) {
                isDuplicate = true;
                break;
            }
        }
        if (!isDuplicate) {
            uniqueTimetables.push(timetable);
        }
    }

    // Select the 3 best unique timetables
    const bestTimetables = uniqueTimetables.slice(0, 3);

    // Save the best timetables
    for (let i = 0; i < bestTimetables.length; i++) {
        const timetable = bestTimetables[i];

        const studentTimetables = createStudentTimetables(timetable.timetable, studentCourses);

        // Write to file
        const studentTtPath = path.join(__dirname, `data/timetable_v${i + 1}_students.json`);
        fs.writeFileSync(studentTtPath, JSON.stringify(studentTimetables, null, 2), { flag: 'w' });
        console.log(`Student timetable mapping for version ${i + 1} written to ${studentTtPath}`);

        const formattedStats = formatStatsForOutput(
            timetable.stats,
            timetable.timetable,
            studentCourses
        );

        // Write the timetable to a JSON file
        const outputPath = path.join(__dirname, `data/timetable_v${i + 1}.json`);
        fs.writeFileSync(outputPath, JSON.stringify({
            timetable: timetable.timetable,
            score: timetable.score,
            studentScores: timetable.studentScores,
            description: `Redistributed timetable version ${i + 1} with minimized consecutive exams (total score: ${timetable.score})`,
            rollNumbers: true // Flag to indicate roll numbers are included
        }, null, 2), { flag: 'w' });

        // Write statistics to a separate JSON file
        const statsOutputPath = path.join(__dirname, `data/timetable_v${i + 1}_stats.json`);
        fs.writeFileSync(statsOutputPath, JSON.stringify(formattedStats, null, 2), { flag: 'w' });

        // Write timetable to CSV file
        const csvContent = createTimetableCSV(timetable.timetable, i + 1);
        const csvOutputPath = path.join(__dirname, `data/timetable_v${i + 1}.csv`);
        fs.writeFileSync(csvOutputPath, csvContent, { flag: 'w' });

        console.log(`\nBest Timetable ${i + 1} has been written to ${outputPath}`);
        console.log(`Statistics for version ${i + 1} have been written to ${statsOutputPath}`);
        console.log(`CSV version of timetable ${i + 1} has been written to ${csvOutputPath}`);
        console.log(`Total Score: ${timetable.score} (lower is better)`);
        console.log('\nConsecutive Exam Statistics:');
        console.log(`Students with 2 consecutive exams: ${formattedStats.totalStudents.twoConsecutive}`);
    }

    // Log summary of all generated timetables
    console.log('\nSummary of all generated timetables:');
    console.log(`Total timetables generated: ${allTimetables.length}`);
    console.log(`Unique timetables: ${uniqueTimetables.length}`);
    console.log(`Best score achieved: ${validTimetables[0]?.score || 'N/A'}`);
    console.log(`Average score: ${validTimetables.reduce((sum, t) => sum + t.score, 0) / validTimetables.length}`);

    return {
        success: true,
        message: "Timetable generated successfully"
    };
}
// Export the data
export {
    generateTimetable_full
};
