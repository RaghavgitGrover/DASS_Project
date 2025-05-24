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
    for (const existingCourse of slotCourses) {
        const existingStudents = getStudentsInCourse(existingCourse.code, studentData);
        if (hasStudentClash(courseStudents, existingStudents)) {
            return true;
        }
    }
    return false;
}

// Function to check for student clashes in midsem timetable
function checkMidsemTimetableClashes(timetableData, studentData) {
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
        studentCourses.forEach((courses, rollNumber) => {
            const studentCoursesInSlot = slotCourses.filter(course => courses.has(course.code));

            if (studentCoursesInSlot.length > 1) {
                clashes.push({
                    student: rollNumber,
                    slot: slotNumber,
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
    const studentScores = new Map(); // Track scores for each student
    let hasFourConsecutive = false; // Flag to track if any student has 4 consecutive exams

    // Calculate score for each day
    for (let day = 1; day <= 4; day++) {
        const dayKey = `day${day}`;
        const daySlots = timetable[dayKey].slots;

        // Calculate score for each student
        for (const [rollNumber, courses] of studentCourses) {
            const consecutiveExams = countConsecutiveExams(courses, daySlots);
            let studentScore = 0;

            // Modified scoring hierarchy:
            // 4 consecutive exams: 1000 points (extremely high penalty)
            // 3 consecutive exams: 5 points
            // 2 consecutive exams: 2 points
            // 1 exam or no consecutive: 0 points
            switch (consecutiveExams) {
                case 4:
                    studentScore = 1000;
                    hasFourConsecutive = true;
                    break;
                case 3:
                    studentScore = 5;
                    break;
                case 2:
                    studentScore = 2;
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
        studentScores,
        hasFourConsecutive
    };
}

// Function to create a random timetable
function createRandomTimetable(timetableData, studentData) {
    const timetable = {
        day1: { slots: Array(4).fill(null).map(() => ({ courses: [] })) },
        day2: { slots: Array(4).fill(null).map(() => ({ courses: [] })) },
        day3: { slots: Array(4).fill(null).map(() => ({ courses: [] })) },
        day4: { slots: Array(4).fill(null).map(() => ({ courses: [] })) }
    };

    const processedCourses = new Set();
    const allCourses = [];

    // Collect all courses
    for (const slotCourses of Object.values(timetableData)) {
        for (const course of slotCourses) {
            if (!processedCourses.has(course.code)) {
                allCourses.push(course);
                processedCourses.add(course.code);
            }
        }
    }

    // Shuffle courses
    for (let i = allCourses.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allCourses[i], allCourses[j]] = [allCourses[j], allCourses[i]];
    }

    // Place courses randomly
    for (const course of allCourses) {
        const courseStudents = getStudentsInCourse(course.code, studentData);
        let placed = false;

        // Try each day and slot combination
        for (let day = 1; day <= 4; day++) {
            const dayKey = `day${day}`;
            for (let slot = 0; slot < 4; slot++) {
                if (!hasClashInSlot(courseStudents, timetable[dayKey].slots[slot].courses, studentData)) {
                    // Add roll numbers to the course object
                    const courseWithStudents = {
                        ...course,
                        rollnumbers: courseStudents
                    };
                    timetable[dayKey].slots[slot].courses.push(courseWithStudents);
                    placed = true;
                    break;
                }
            }
            if (placed) break;
        }
    }

    return timetable;
}

// // Function to create a population of timetables
// function createPopulation(size, timetableData, studentData) {
//     const population = [];
//     for (let i = 0; i < size; i++) {
//         population.push(createRandomTimetable(timetableData, studentData));
//     }
//     return population;
// }

// // Function to calculate fitness of a timetable
// function calculateFitness(timetable, studentCourses) {
//     const scoreResult = calculateTimetableScore(timetable, studentCourses);
//     const stats = generateConsecutiveExamStats(timetable, studentCourses);

//     // Calculate total consecutive exams
//     const totalConsecutive = stats.twoConsecutive.length +
//                            stats.threeConsecutive.length +
//                            stats.fourConsecutive.length;

//     // Lower score and fewer consecutive exams means better fitness
//     return 1 / (scoreResult.totalScore + totalConsecutive * 10);
// }

// // Function to select parents using tournament selection
// function selectParent(population, fitnesses) {
//     const tournamentSize = 3;
//     let bestIndex = Math.floor(Math.random() * population.length);

//     for (let i = 1; i < tournamentSize; i++) {
//         const index = Math.floor(Math.random() * population.length);
//         if (fitnesses[index] > fitnesses[bestIndex]) {
//             bestIndex = index;
//         }
//     }

//     return population[bestIndex];
// }

// // Function to crossover two timetables
// function crossover(parent1, parent2) {
//     const child = {
//         day1: { slots: Array(4).fill(null).map(() => ({ courses: [] })) },
//         day2: { slots: Array(4).fill(null).map(() => ({ courses: [] })) },
//         day3: { slots: Array(4).fill(null).map(() => ({ courses: [] })) },
//         day4: { slots: Array(4).fill(null).map(() => ({ courses: [] })) }
//     };

//     // Randomly choose which parent to take each day from
//     for (let day = 1; day <= 4; day++) {
//         const dayKey = `day${day}`;
//         const parent = Math.random() < 0.5 ? parent1 : parent2;
//         child[dayKey] = JSON.parse(JSON.stringify(parent[dayKey]));
//     }

//     return child;
// }

// // Function to mutate a timetable
// function mutate(timetable, timetableData, studentData) {
//     const mutated = JSON.parse(JSON.stringify(timetable));

//     // Randomly select a day and slot
//     const day = Math.floor(Math.random() * 4) + 1;
//     const dayKey = `day${day}`;
//     const slot = Math.floor(Math.random() * 4);

//     // If there are courses in this slot, try to move one
//     if (mutated[dayKey].slots[slot].courses.length > 0) {
//         const courseIndex = Math.floor(Math.random() * mutated[dayKey].slots[slot].courses.length);
//         const course = mutated[dayKey].slots[slot].courses[courseIndex];
//         const courseStudents = getStudentsInCourse(course.code, studentData);

//         // Try to move the course to a different slot
//         for (let newDay = 1; newDay <= 4; newDay++) {
//             const newDayKey = `day${newDay}`;
//             for (let newSlot = 0; newSlot < 4; newSlot++) {
//                 if (newDay === day && newSlot === slot) continue;

//                 if (!hasClashInSlot(courseStudents, mutated[newDayKey].slots[newSlot].courses, studentData)) {
//                     mutated[dayKey].slots[slot].courses.splice(courseIndex, 1);
//                     mutated[newDayKey].slots[newSlot].courses.push(course);
//                     return mutated;
//                 }
//             }
//         }
//     }

//     return mutated;
// }

// Function to generate a timetable using genetic algorithm
function generateTimetable(timetableData, studentData, studentCourses) {
    // First check for clashes in the original timetable
    const clashes = checkMidsemTimetableClashes(timetableData, studentData);
    if (clashes.length > 0) {
        console.log('Found clashes in the original timetable. Cannot proceed with optimization.');
        return null;
    }

    // Start with the existing timetable structure
    const timetable = {
        day1: { slots: Array(4).fill(null).map(() => ({ courses: [] })) },
        day2: { slots: Array(4).fill(null).map(() => ({ courses: [] })) },
        day3: { slots: Array(4).fill(null).map(() => ({ courses: [] })) },
        day4: { slots: Array(4).fill(null).map(() => ({ courses: [] })) }
    };

    // Place all courses in their original slots
    for (const [slotNumber, slotCourses] of Object.entries(timetableData)) {
        const day = Math.floor((parseInt(slotNumber) - 1) / 4) + 1;
        const slot = (parseInt(slotNumber) - 1) % 4;
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

    // Phase 1: Try to optimize by swapping slots between days
    const maxSlotSwapAttempts = 50; // Increased attempts to find a solution without 4 consecutive exams
    let bestTimetable = JSON.parse(JSON.stringify(timetable));
    let bestScore = calculateTimetableScore(timetable, studentCourses).totalScore;
    let bestHasFourConsecutive = calculateTimetableScore(timetable, studentCourses).hasFourConsecutive;

    // Create a random order of days and slots to try
    const dayOrder = [1, 2, 3, 4].sort(() => Math.random() - 0.5);
    const slotOrder = [0, 1, 2, 3].sort(() => Math.random() - 0.5);

    for (let attempt = 0; attempt < maxSlotSwapAttempts; attempt++) {
        let improvementFound = false;
        const currentTimetable = JSON.parse(JSON.stringify(bestTimetable));

        // Try swapping slots between different days in random order
        for (const day1 of dayOrder) {
            const day1Key = `day${day1}`;
            for (const slot1 of slotOrder) {
                const slot1Courses = currentTimetable[day1Key].slots[slot1].courses;
                if (slot1Courses.length === 0) continue;

                // Try swapping with other days in random order
                const otherDays = dayOrder.filter(d => d !== day1).sort(() => Math.random() - 0.5);
                for (const day2 of otherDays) {
                    const day2Key = `day${day2}`;
                    // Try slots in random order
                    const otherSlots = slotOrder.filter(s => s !== slot1).sort(() => Math.random() - 0.5);
                    for (const slot2 of otherSlots) {
                        const slot2Courses = currentTimetable[day2Key].slots[slot2].courses;

                        // Check if swapping would create any clashes
                        let hasClash = false;
                        for (const course of slot2Courses) {
                            const courseStudents = getStudentsInCourse(course.code, studentData);
                            if (hasClashInSlot(courseStudents, currentTimetable[day1Key].slots[slot1].courses, studentData)) {
                                hasClash = true;
                                break;
                            }
                        }

                        if (!hasClash) {
                            for (const course of slot1Courses) {
                                const courseStudents = getStudentsInCourse(course.code, studentData);
                                if (hasClashInSlot(courseStudents, currentTimetable[day2Key].slots[slot2].courses, studentData)) {
                                    hasClash = true;
                                    break;
                                }
                            }
                        }

                        if (!hasClash) {
                            currentTimetable[day1Key].slots[slot1].courses = slot2Courses;
                            currentTimetable[day2Key].slots[slot2].courses = slot1Courses;

                            const newScoreResult = calculateTimetableScore(currentTimetable, studentCourses);
                            const newScore = newScoreResult.totalScore;
                            const newHasFourConsecutive = newScoreResult.hasFourConsecutive;

                            // Prioritize solutions without 4 consecutive exams
                            if ((!newHasFourConsecutive && bestHasFourConsecutive) ||
                                (newHasFourConsecutive === bestHasFourConsecutive && newScore < bestScore)) {
                                bestScore = newScore;
                                bestHasFourConsecutive = newHasFourConsecutive;
                                bestTimetable = JSON.parse(JSON.stringify(currentTimetable));
                                improvementFound = true;
                            } else {
                                currentTimetable[day1Key].slots[slot1].courses = slot1Courses;
                                currentTimetable[day2Key].slots[slot2].courses = slot2Courses;
                            }
                        }
                    }
                }
            }
        }

        if (!improvementFound) break;
    }

    // If we still have 4 consecutive exams, try Phase 2 with more aggressive optimization
    if (bestHasFourConsecutive) {
        const maxCourseMoveAttempts = 50; // Increased attempts
        let currentTimetable = JSON.parse(JSON.stringify(bestTimetable));

        for (let attempt = 0; attempt < maxCourseMoveAttempts; attempt++) {
            let improvementFound = false;

            // Get statistics about consecutive exams
            const stats = generateConsecutiveExamStats(currentTimetable, studentCourses, studentData);

            // Focus on students with 4 consecutive exams first
            const studentsWithFourConsecutive = stats.fourConsecutive;
            if (studentsWithFourConsecutive.length === 0) break;

            // Create a map of courses to how many students have 4 consecutive exams with them
            const courseConsecutiveCount = new Map();

            // Count how many students have 4 consecutive exams with each course
            for (const student of studentsWithFourConsecutive) {
                for (const consecutiveSet of student.consecutiveCourses) {
                    for (const course of consecutiveSet) {
                        if (!courseConsecutiveCount.has(course.code)) {
                            courseConsecutiveCount.set(course.code, 0);
                        }
                        courseConsecutiveCount.set(course.code, courseConsecutiveCount.get(course.code) + 1);
                    }
                }
            }

            // Sort courses by how many students have 4 consecutive exams with them
            const sortedCourses = Array.from(courseConsecutiveCount.entries())
                .sort((a, b) => b[1] - a[1]);

            // Try to move the most problematic courses
            const coursesToTry = sortedCourses
                .filter(([_, count]) => count > 0)
                .sort(() => Math.random() - 0.5)
                .slice(0, Math.floor(Math.random() * 3) + 2); // Try 2-4 courses randomly

            // Try to move the selected courses
            for (const [courseCode, count] of coursesToTry) {
                // Find the course in the current timetable
                let course = null;
                let currentDay = null;
                let currentSlot = null;

                for (const day of dayOrder) {
                    const dayKey = `day${day}`;
                    for (let slot = 0; slot < 4; slot++) {
                        const courseIndex = currentTimetable[dayKey].slots[slot].courses.findIndex(c => c.code === courseCode);
                        if (courseIndex !== -1) {
                            course = currentTimetable[dayKey].slots[slot].courses[courseIndex];
                            currentDay = dayKey;
                            currentSlot = slot;
                    break;
                }
            }
                    if (course) break;
                }

                if (!course) continue;

                const courseStudents = getStudentsInCourse(course.code, studentData);
                let bestNewDay = null;
                let bestNewSlot = null;
                let bestNewScore = bestScore;
                let bestNewHasFourConsecutive = bestHasFourConsecutive;

                // Try moving the course to every possible slot in random order
                const possibleSlots = [];
                for (let day = 1; day <= 4; day++) {
                    const dayKey = `day${day}`;
                    for (let slot = 0; slot < 4; slot++) {
                        if (dayKey === currentDay && slot === currentSlot) continue;
                        possibleSlots.push({ day, slot, dayKey });
                    }
                }
                possibleSlots.sort(() => Math.random() - 0.5);

                for (const { day, slot, dayKey } of possibleSlots) {
                    if (!hasClashInSlot(courseStudents, currentTimetable[dayKey].slots[slot].courses, studentData)) {
                        // Temporarily move the course
                        currentTimetable[currentDay].slots[currentSlot].courses =
                            currentTimetable[currentDay].slots[currentSlot].courses.filter(c => c.code !== course.code);
                        currentTimetable[dayKey].slots[slot].courses.push(course);

                        const newScoreResult = calculateTimetableScore(currentTimetable, studentCourses);
                        const newScore = newScoreResult.totalScore;
                        const newHasFourConsecutive = newScoreResult.hasFourConsecutive;

                        // Prioritize solutions without 4 consecutive exams
                        if ((!newHasFourConsecutive && bestNewHasFourConsecutive) ||
                            (newHasFourConsecutive === bestNewHasFourConsecutive && newScore < bestNewScore)) {
                            bestNewScore = newScore;
                            bestNewHasFourConsecutive = newHasFourConsecutive;
                            bestNewDay = dayKey;
                            bestNewSlot = slot;
                        }

                        // Move the course back
                        currentTimetable[dayKey].slots[slot].courses =
                            currentTimetable[dayKey].slots[slot].courses.filter(c => c.code !== course.code);
                        currentTimetable[currentDay].slots[currentSlot].courses.push(course);
                    }
                }

                // If we found a better position, make the move
                if (bestNewDay && bestNewSlot) {
                    currentTimetable[currentDay].slots[currentSlot].courses =
                        currentTimetable[currentDay].slots[currentSlot].courses.filter(c => c.code !== course.code);
                    currentTimetable[bestNewDay].slots[bestNewSlot].courses.push(course);

                    const newScoreResult = calculateTimetableScore(currentTimetable, studentCourses);
                    if ((!newScoreResult.hasFourConsecutive && bestHasFourConsecutive) ||
                        (newScoreResult.hasFourConsecutive === bestHasFourConsecutive && newScoreResult.totalScore < bestScore)) {
                        bestScore = newScoreResult.totalScore;
                        bestHasFourConsecutive = newScoreResult.hasFourConsecutive;
                        bestTimetable = JSON.parse(JSON.stringify(currentTimetable));
                        improvementFound = true;
                    } else {
                        // Revert if no improvement
                        currentTimetable[bestNewDay].slots[bestNewSlot].courses =
                            currentTimetable[bestNewDay].slots[bestNewSlot].courses.filter(c => c.code !== course.code);
                        currentTimetable[currentDay].slots[currentSlot].courses.push(course);
                    }
                }
            }

            if (!improvementFound) break;
        }
    }

    return bestTimetable;
}

// Function to generate statistics for consecutive exams
function generateConsecutiveExamStats(timetable, studentCourses, studentData) {
    const stats = {
        twoConsecutive: [],
        threeConsecutive: [],
        fourConsecutive: []
    };

    // Calculate stats for each day
    for (let day = 1; day <= 4; day++) {
        const dayKey = `day${day}`;
        const daySlots = timetable[dayKey].slots;

        // Calculate stats for each student
        for (const [rollNumber, courses] of studentCourses) {
            const consecutiveExams = countConsecutiveExams(courses, daySlots);

            if (consecutiveExams >= 2) {
                // Find which courses are consecutive
                let consecutiveCourses = [];
                let currentStreak = [];

                for (const slot of daySlots) {
                    const studentCoursesInSlot = slot.courses.filter(course => courses.has(course.code));
                    if (studentCoursesInSlot.length > 0) {
                        currentStreak.push(...studentCoursesInSlot);
                    } else {
                        if (currentStreak.length >= 2) {
                            consecutiveCourses.push([...currentStreak]);
                        }
                        currentStreak = [];
                    }
                }

                // Check if there's a streak at the end of the day
                if (currentStreak.length >= 2) {
                    consecutiveCourses.push([...currentStreak]);
                }

                const studentInfo = {
                    rollNumber,
                    day: day,
                    consecutiveCourses
                };

                switch (consecutiveExams) {
                    case 4:
                        stats.fourConsecutive.push(studentInfo);
                        break;
                    case 3:
                        stats.threeConsecutive.push(studentInfo);
                        break;
                    case 2:
                        stats.twoConsecutive.push(studentInfo);
                        break;
                }
            }
        }
    }

    return stats;
}

// Function to format statistics for file output
function formatStatsForOutput(timetable, stats, studentCourses) {
    // Calculate exam distribution across days
    const distribution = calculateExamDistribution(timetable, studentCourses);

    // Track students with 2/3 exams in any day
    const twoExamsStudents = [];
    const threeExamsStudents = [];

    distribution.details.forEach((dayExams, rollNumber) => {
        if (dayExams.some(count => count === 2)) twoExamsStudents.push(rollNumber);
        if (dayExams.some(count => count === 3)) threeExamsStudents.push(rollNumber);
    });

    return {
        totalStudents: {
            twoConsecutive: stats.twoConsecutive.length,
            threeConsecutive: stats.threeConsecutive.length,
            fourConsecutive: stats.fourConsecutive.length,
            twoExamsPerDay: twoExamsStudents.length,
            threeExamsPerDay: threeExamsStudents.length
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
            })),
            threeConsecutive: stats.threeConsecutive.map(student => ({
                rollNumber: student.rollNumber,
                day: student.day,
                courses: student.consecutiveCourses.map(courses =>
                    courses.map(course => ({
                        code: course.code,
                        name: course.name
                    }))
                )
            })),
            fourConsecutive: stats.fourConsecutive.map(student => ({
                rollNumber: student.rollNumber,
                day: student.day,
                courses: student.consecutiveCourses.map(courses =>
                    courses.map(course => ({
                        code: course.code,
                        name: course.name
                    })),
                )
            })),
            twoExamsPerDay: twoExamsStudents,
            threeExamsPerDay: threeExamsStudents
        }
    };
}

// Function to format timetable as CSV
function createTimetableCSV(timetable, version) {
    // Create header row with slots
    let csvContent = 'Day,Slot 1,Slot 2,Slot 3,Slot 4\n';

    // Add each day as a row
    for (let day = 1; day <= 4; day++) {
        const dayKey = `day${day}`;
        let row = `Day ${day}`;

        // Add each slot's courses to the row
        for (let slot = 0; slot < 4; slot++) {
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

// Function to optimize common consecutive exam patterns
function optimizeCommonConsecutiveExams(timetable, studentCourses, studentData) {
    const stats = generateConsecutiveExamStats(timetable, studentCourses, studentData);
    const courseFrequency = new Map(); // Map to store how often each course appears in consecutive exams

    // Count frequency of each course in consecutive exams
    for (const student of [...stats.twoConsecutive, ...stats.threeConsecutive]) {
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
        if (courseInfo.count < 2) continue; // Skip courses that only appear once in consecutive exams

        const course = courseInfo.course;
        let currentDay = null;
        let currentSlot = null;

        // Find current position of the course
        for (let day = 1; day <= 4; day++) {
            const dayKey = `day${day}`;
            for (let slot = 0; slot < 4; slot++) {
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
        for (let day = 1; day <= 4; day++) {
            const dayKey = `day${day}`;
            for (let slot = 0; slot < 4; slot++) {
                if (dayKey === currentDay && slot === currentSlot) continue;

                // Check if moving would create any clashes
                if (!hasClashInSlot(courseStudents, bestTimetable[dayKey].slots[slot].courses, studentData)) {
                    // Temporarily move the course
                    bestTimetable[currentDay].slots[currentSlot].courses =
                        bestTimetable[currentDay].slots[currentSlot].courses.filter(c => c.code !== course.code);
                    bestTimetable[dayKey].slots[slot].courses.push(course);

                    const newScore = calculateTimetableScore(bestTimetable, studentCourses);

                    // Only accept if it improves the score and doesn't create 4 consecutive exams
                    if (newScore.totalScore < bestNewScore && !newScore.hasFourConsecutive) {
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

function createStudentTimetables(bestTimetable, studentCourses) {
    const studentTimetables = {};

    studentCourses.forEach((courses, rollNumber) => {
      const studentSchedule = {};

      // Initialize empty structure
      for (let day = 1; day <= 4; day++) {
        studentSchedule[`day${day}`] = {
          slot1: [], slot2: [], slot3: [], slot4: []
        };
      }

      // Find courses in each slot
      for (let day = 1; day <= 4; day++) {
        const dayKey = `day${day}`;
        for (let slot = 0; slot < 4; slot++) {
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

/**
 * Optimize timetable with focus on reducing 3 consecutive exams
 * @param {Object} timetable - Current timetable
 * @param {Map} studentCourses - Map of student roll numbers to their courses
 * @param {Object} studentData - Student application data
 * @returns {Object} - Optimized timetable
 */
function reduceThreeConsecutiveExams(timetable, studentCourses, studentData) {
    console.log('\nFocusing on reducing 3 consecutive exams...');

    // Create a deep copy of the timetable to work with
    let currentTimetable = JSON.parse(JSON.stringify(timetable));
    let bestTimetable = JSON.parse(JSON.stringify(timetable));

    // Get initial stats and score
    const initialStats = generateConsecutiveExamStats(currentTimetable, studentCourses, studentData);
    const initialScoreResult = calculateTimetableScore(currentTimetable, studentCourses);
    let bestScore = initialScoreResult.totalScore;
    let bestThreeConsecutiveCount = initialStats.threeConsecutive.length;

    console.log(`Initial state: ${bestThreeConsecutiveCount} students with 3 consecutive exams`);

    // Maximum number of attempts
    const maxAttempts = 100;
    let attempts = 0;
    let improvements = 0;

    // Track courses that already failed to improve the situation to avoid wasting attempts
    const failedMoves = new Set();

    // Keep trying until we run out of attempts or can't improve further
    while (attempts < maxAttempts && bestThreeConsecutiveCount > 0) {
        // Get current statistics focused on 3 consecutive exams
        const stats = generateConsecutiveExamStats(currentTimetable, studentCourses, studentData);

        // If there are no more students with 3 consecutive exams, we can stop
        if (stats.threeConsecutive.length === 0) {
            break;
        }

        // Identify the most problematic courses involved in 3 consecutive exams
        const courseCounts = new Map();
        for (const student of stats.threeConsecutive) {
            for (const courseSet of student.consecutiveCourses) {
                for (const course of courseSet) {
                    if (!courseCounts.has(course.code)) {
                        courseCounts.set(course.code, {
                            course: course,
                            count: 0,
                            students: new Set()
                        });
                    }

                    courseCounts.get(course.code).count++;
                    courseCounts.get(course.code).students.add(student.rollNumber);
                }
            }
        }

        // Sort courses by frequency in 3 consecutive exam cases
        const sortedCourses = Array.from(courseCounts.entries())
            .filter(([courseCode]) => !failedMoves.has(courseCode))
            .sort((a, b) => b[1].count - a[1].count);

        // If no courses left to try, break
        if (sortedCourses.length === 0) {
            console.log('No more courses available to move that haven\'t been tried already.');
            break;
        }

        // Get the most problematic course
        const [courseCode, courseInfo] = sortedCourses[0];

        // Find current position of the course
        let currentDay = null;
        let currentSlot = null;

        for (let day = 1; day <= 4; day++) {
            const dayKey = `day${day}`;
            for (let slot = 0; slot < 4; slot++) {
                const courseIndex = currentTimetable[dayKey].slots[slot].courses.findIndex(c => c.code === courseCode);
                if (courseIndex !== -1) {
                    currentDay = dayKey;
                    currentSlot = slot;
                    break;
                }
            }
            if (currentDay) break;
        }

        if (!currentDay) {
            // console.log(`Couldn't find course ${courseCode} in timetable. Skipping.`);
            failedMoves.add(courseCode);
            attempts++;
            continue;
        }

        const course = currentTimetable[currentDay].slots[currentSlot].courses.find(c => c.code === courseCode);
        const courseStudents = getStudentsInCourse(courseCode, studentData);

        let bestMoveDay = null;
        let bestMoveSlot = null;
        let lowestThreeConsecutiveCount = bestThreeConsecutiveCount;

        // Try moving this course to every other possible slot
        for (let day = 1; day <= 4; day++) {
            const dayKey = `day${day}`;
            for (let slot = 0; slot < 4; slot++) {
                // Skip current position
                if (dayKey === currentDay && slot === currentSlot) continue;

                // Check if moving would create any clashes
                if (!hasClashInSlot(courseStudents, currentTimetable[dayKey].slots[slot].courses, studentData)) {
                    // Temporarily move the course
                    currentTimetable[currentDay].slots[currentSlot].courses =
                        currentTimetable[currentDay].slots[currentSlot].courses.filter(c => c.code !== courseCode);
                    currentTimetable[dayKey].slots[slot].courses.push(course);

                    // Check if this reduces 3 consecutive exams without causing 4 consecutive
                    const newStats = generateConsecutiveExamStats(currentTimetable, studentCourses, studentData);
                    const newScoreResult = calculateTimetableScore(currentTimetable, studentCourses);

                    // Prioritize: 1. No new 4-consecutive exams, 2. Reduced 3-consecutive count
                    if (!newScoreResult.hasFourConsecutive && newStats.threeConsecutive.length < lowestThreeConsecutiveCount) {
                        lowestThreeConsecutiveCount = newStats.threeConsecutive.length;
                        bestMoveDay = dayKey;
                        bestMoveSlot = slot;
                    }

                    // Move course back for next iteration
                    currentTimetable[dayKey].slots[slot].courses =
                        currentTimetable[dayKey].slots[slot].courses.filter(c => c.code !== courseCode);
                    currentTimetable[currentDay].slots[currentSlot].courses.push(course);
                }
            }
        }

        // Apply the best move if found
        if (bestMoveDay && bestMoveSlot) {
            // Make the move permanent
            currentTimetable[currentDay].slots[currentSlot].courses =
                currentTimetable[currentDay].slots[currentSlot].courses.filter(c => c.code !== courseCode);
            currentTimetable[bestMoveDay].slots[bestMoveSlot].courses.push(course);

            // Get new statistics
            const newStats = generateConsecutiveExamStats(currentTimetable, studentCourses, studentData);
            const newScoreResult = calculateTimetableScore(currentTimetable, studentCourses);

            // console.log(`Moved course ${courseCode} from ${currentDay} slot ${currentSlot} to ${bestMoveDay} slot ${bestMoveSlot}`);
            // console.log(`Reduced students with 3 consecutive exams from ${bestThreeConsecutiveCount} to ${newStats.threeConsecutive.length}`);

            // Update best timetable
            bestTimetable = JSON.parse(JSON.stringify(currentTimetable));
            bestScore = newScoreResult.totalScore;
            bestThreeConsecutiveCount = newStats.threeConsecutive.length;
            improvements++;
        } else {
            // Mark this course as having no useful moves
            failedMoves.add(courseCode);
            // console.log(`No beneficial moves found for course ${courseCode}`);
        }

        attempts++;
    }

    // console.log(`\nOptimization completed after ${attempts} attempts with ${improvements} improvements`);
    // console.log(`Final state: ${bestThreeConsecutiveCount} students with 3 consecutive exams (${initialStats.threeConsecutive.length - bestThreeConsecutiveCount} reduction)`);

    return bestTimetable;
}

// Function to balance exam distribution across days
function balanceExamDistribution(timetable, studentCourses, studentData) {
    // console.log('\nBalancing exam distribution across days...');

    // Create a deep copy of the timetable to work with
    let currentTimetable = JSON.parse(JSON.stringify(timetable));
    let bestTimetable = JSON.parse(JSON.stringify(timetable));

    // Calculate initial student exam distribution by day
    const initialDistribution = calculateExamDistribution(currentTimetable, studentCourses);
    //console.log('Initial exam distribution:', initialDistribution.summary);

    // Maximum number of attempts
    const maxAttempts = 50;
    let attempts = 0;
    let improvements = 0;

    // Track failed moves to avoid repeating
    const failedMoves = new Set();

    while (attempts < maxAttempts) {
        // Calculate current distribution
        const distribution = calculateExamDistribution(currentTimetable, studentCourses);

        // Find the most unbalanced students (those with 3+ exams on one day and 0 on another)
        const unbalancedStudents = findUnbalancedStudents(distribution.details);

        if (unbalancedStudents.length === 0) {
            console.log('No more significantly unbalanced students found.');
            break;
        }

        // Pick a student randomly from the unbalanced ones
        const studentInfo = unbalancedStudents[Math.floor(Math.random() * unbalancedStudents.length)];

        // Try to move one of their exams from heaviest day to lightest day
        const courseToMove = findCourseToMove(
            studentInfo,
            currentTimetable,
            studentCourses,
            studentData,
            failedMoves
        );

        if (!courseToMove) {
            attempts++;
            continue;
        }

        const { course, fromDay, fromSlot, toDay, toSlot } = courseToMove;

        // Make the move
        const fromDayKey = `day${fromDay}`;
        const toDayKey = `day${toDay}`;

        // Remove course from source
        currentTimetable[fromDayKey].slots[fromSlot].courses =
            currentTimetable[fromDayKey].slots[fromSlot].courses.filter(c => c.code !== course.code);

        // Add to destination
        currentTimetable[toDayKey].slots[toSlot].courses.push(course);

        // Check if this improved the situation
        const newStats = generateConsecutiveExamStats(currentTimetable, studentCourses, studentData);
        const newScoreResult = calculateTimetableScore(currentTimetable, studentCourses);

        // Accept the move if it doesn't create 4 consecutive exams and doesn't increase 3 consecutive exams
        if (!newScoreResult.hasFourConsecutive &&
            newStats.threeConsecutive.length <= distribution.threeConsecutiveCount) {

            //console.log(`Moved course ${course.code} from day ${fromDay} slot ${fromSlot} to day ${toDay} slot ${toSlot}`);
            //console.log(`This helped balance exams for student ${studentInfo.rollNumber}`);

            bestTimetable = JSON.parse(JSON.stringify(currentTimetable));
            improvements++;
        } else {
            // Revert the move
            currentTimetable[toDayKey].slots[toSlot].courses =
                currentTimetable[toDayKey].slots[toSlot].courses.filter(c => c.code !== course.code);
            currentTimetable[fromDayKey].slots[fromSlot].courses.push(course);

            // Record this as a failed move
            failedMoves.add(`${course.code}-${fromDay}-${fromSlot}-${toDay}-${toSlot}`);
        }

        attempts++;
    }

    console.log(`\nBalancing completed after ${attempts} attempts with ${improvements} improvements`);
    const finalDistribution = calculateExamDistribution(bestTimetable, studentCourses);
    console.log('Final exam distribution:', finalDistribution.summary);

    return bestTimetable;
}

// Helper function to calculate exam distribution
function calculateExamDistribution(timetable, studentCourses) {
    const distribution = {
        details: new Map(),
        summary: {
            maxPerDay: 0,
            avgExamsPerDay: 0,
            studentsWithThreePlusExamsInOneDay: 0
        },
        threeConsecutiveCount: 0
    };

    // Initialize student exam count by day
    for (const [rollNumber, _] of studentCourses) {
        distribution.details.set(rollNumber, [0, 0, 0, 0]); // Days 1-4
    }

    // Count exams per day for each student
    for (let day = 1; day <= 4; day++) {
        const dayKey = `day${day}`;
        for (let slot = 0; slot < 4; slot++) {
            for (const course of timetable[dayKey].slots[slot].courses) {
                for (const [rollNumber, courses] of studentCourses) {
                    if (courses.has(course.code)) {
                        const studentDays = distribution.details.get(rollNumber);
                        studentDays[day-1]++;
                    }
                }
            }
        }
    }

    // Calculate statistics
    let totalMaxPerDay = 0;
    let studentsWithThreePlus = 0;

    for (const [_, dayExams] of distribution.details) {
        const maxExams = Math.max(...dayExams);
        totalMaxPerDay += maxExams;

        if (maxExams >= 3) {
            studentsWithThreePlus++;
        }
    }

    distribution.summary.maxPerDay = totalMaxPerDay / distribution.details.size;
    distribution.summary.studentsWithThreePlusExamsInOneDay = studentsWithThreePlus;

    // Calculate consecutive exams
    const stats = generateConsecutiveExamStats(timetable, studentCourses);
    distribution.threeConsecutiveCount = stats.threeConsecutive.length;

    return distribution;
}

// Helper function to find unbalanced students
function findUnbalancedStudents(distributionDetails) {
    const unbalanced = [];

    for (const [rollNumber, dayExams] of distributionDetails) {
        const maxExams = Math.max(...dayExams);
        const minExams = Math.min(...dayExams);

        // Consider a student unbalanced if they have 3+ exams on one day and 0 on another
        if (maxExams >= 3 && minExams === 0) {
            const heaviestDay = dayExams.indexOf(maxExams) + 1;
            const lightestDays = [];

            for (let i = 0; i < dayExams.length; i++) {
                if (dayExams[i] === minExams) {
                    lightestDays.push(i + 1);
                }
            }

            unbalanced.push({
                rollNumber,
                heaviestDay,
                lightestDays,
                dayExams
            });
        }
    }

    return unbalanced;
}

// Helper function to find a course that can be moved
function findCourseToMove(studentInfo, timetable, studentCourses, studentData, failedMoves) {
    const { rollNumber, heaviestDay, lightestDays } = studentInfo;
    const studentCourseSet = studentCourses.get(rollNumber);

    // Find courses this student has on their heaviest day
    const heaviestDayKey = `day${heaviestDay}`;
    const candidateCourses = [];

    for (let slot = 0; slot < 4; slot++) {
        for (const course of timetable[heaviestDayKey].slots[slot].courses) {
            if (studentCourseSet.has(course.code)) {
                candidateCourses.push({
                    course,
                    fromDay: heaviestDay,
                    fromSlot: slot
                });
            }
        }
    }

    // Randomize candidate ordering
    candidateCourses.sort(() => Math.random() - 0.5);

    // Try each candidate course
    for (const candidate of candidateCourses) {
        const courseStudents = getStudentsInCourse(candidate.course.code, studentData);

        // Try each potential destination day/slot
        for (const toDay of lightestDays) {
            const toDayKey = `day${toDay}`;

            for (let toSlot = 0; toSlot < 4; toSlot++) {
                // Skip if this move has already failed
                const moveKey = `${candidate.course.code}-${heaviestDay}-${candidate.fromSlot}-${toDay}-${toSlot}`;
                if (failedMoves.has(moveKey)) continue;

                // Check if moving would create any clashes
                if (!hasClashInSlot(courseStudents, timetable[toDayKey].slots[toSlot].courses, studentData)) {
                    return {
                        course: candidate.course,
                        fromDay: heaviestDay,
                        fromSlot: candidate.fromSlot,
                        toDay,
                        toSlot
                    };
                }
            }
        }
    }

    return null;
}

// Function to check if two timetables are identical
function areTimetablesIdentical(timetable1, timetable2) {
    for (let day = 1; day <= 4; day++) {
        const dayKey = `day${day}`;
        for (let slot = 0; slot < 4; slot++) {
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

async function generateTimetable_full(){
    // Load timetable data
    const timetableData = loadJsonFile(path.join(__dirname, 'data/formatted_slots.json'));

    // Load student data
    const studentData = loadJsonFile(path.join(__dirname, 'data/student_course_data.json'));

    // Create student summary for internal use
    const studentSummary = new Map();

    // Count courses per student
    for (const [_, application] of Object.entries(studentData.Applications)) {
        const rollNumber = application.rollnumber;
        if (!studentSummary.has(rollNumber)) {
            studentSummary.set(rollNumber, {
                courses: new Set(),
                totalCourses: 0
            });
        }
        studentSummary.get(rollNumber).courses.add(application.coursecode);
        studentSummary.get(rollNumber).totalCourses++;
    }

    // Check for clashes in midsem timetable
    const originalClashes = checkMidsemTimetableClashes(timetableData, studentData);

    // Write clashes to a file
    const clashesOutputPath = path.join(__dirname, 'data/midsem_timetable_clashes.json');
    fs.writeFileSync(clashesOutputPath, JSON.stringify(originalClashes, null, 2));
    console.log(`\nMidsem timetable clashes have been written to ${clashesOutputPath}`);

    if (originalClashes.length > 0) {
        console.log('\nFound clashes in the original timetable. Please resolve these clashes before generating new timetables.');
        return {
            success: false,
            message: "Clashes found in the original timetable. Please resolve these clashes before generating new timetables.",
            data: originalClashes
        }
    } else {
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

        // Generate 25 timetables and store them with their scores
        console.log('\nGenerating 25 timetables to find the best ones...');
        const allTimetables = [];

        for (let i = 1; i <= 25; i++) {
            console.log(`\nGenerating Timetable ${i}/25`);
            let timetable = generateTimetable(timetableData, studentData, studentCourses);

            // Optimize common consecutive exam patterns
            console.log('Optimizing common consecutive exam patterns...');
            timetable = optimizeCommonConsecutiveExams(timetable, studentCourses, studentData);

            // Now specifically target reducing 3-consecutive exams
            console.log('Focusing on reducing 3-consecutive exams...');
            timetable = reduceThreeConsecutiveExams(timetable, studentCourses, studentData);

            // Optionally balance exam distribution
            timetable = balanceExamDistribution(timetable, studentCourses, studentData);

            const scoreResult = calculateTimetableScore(timetable, studentCourses);
            const stats = generateConsecutiveExamStats(timetable, studentCourses, studentData);

            // Store timetable with its score and stats
            allTimetables.push({
                timetable,
                score: scoreResult.totalScore,
                studentScores: scoreResult.studentScores,
                stats: stats,
                hasFourConsecutive: scoreResult.hasFourConsecutive
            });
        }

        // Sort timetables by score (lower is better) and filter out those with 4 consecutive exams
        const validTimetables = allTimetables
            .filter(t => !t.hasFourConsecutive)
            .sort((a, b) => a.score - b.score);

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
            fs.writeFileSync(studentTtPath, JSON.stringify(studentTimetables, null, 2));
            console.log(`Student timetable mapping for version ${i + 1} written to ${studentTtPath}`);

            //const formattedStats = formatStatsForOutput(timetable.stats);
            const formattedStats = formatStatsForOutput(
                timetable.timetable,
                timetable.stats,
                studentCourses
            );

            // Write the timetable to a JSON file with roll numbers
            const outputPath = path.join(__dirname, `data/timetable_v${i + 1}.json`);
            fs.writeFileSync(outputPath, JSON.stringify({
                timetable: timetable.timetable,
                score: timetable.score,
                studentScores: timetable.studentScores,
                description: `Timetable version ${i + 1} with minimized consecutive exams (total score: ${timetable.score})`,
                rollNumbers: true // Flag to indicate roll numbers are included
            }, null, 2));

            // Write statistics to a separate JSON file
            const statsOutputPath = path.join(__dirname, `data/timetable_v${i + 1}_stats.json`);
            fs.writeFileSync(statsOutputPath, JSON.stringify(formattedStats, null, 2));

            // Write timetable to CSV file
            const csvContent = createTimetableCSV(timetable.timetable, i + 1);
            const csvOutputPath = path.join(__dirname, `data/timetable_v${i + 1}.csv`);
            fs.writeFileSync(csvOutputPath, csvContent);

            console.log(`\nBest Timetable ${i + 1} has been written to ${outputPath}`);
            console.log(`Statistics for version ${i + 1} have been written to ${statsOutputPath}`);
            console.log(`CSV version of timetable ${i + 1} has been written to ${csvOutputPath}`);
            console.log(`Total Score: ${timetable.score} (lower is better)`);
            console.log('\nConsecutive Exam Statistics:');
            console.log(`Students with 2 consecutive exams: ${formattedStats.totalStudents.twoConsecutive}`);
            console.log(`Students with 3 consecutive exams: ${formattedStats.totalStudents.threeConsecutive}`);
            console.log(`Students with 4 consecutive exams: ${formattedStats.totalStudents.fourConsecutive}`);
        }

        // Log summary of all generated timetables
        console.log('\nSummary of all generated timetables:');
        console.log(`Total timetables generated: ${allTimetables.length}`);
        console.log(`Valid timetables (no 4 consecutive exams): ${validTimetables.length}`);
        console.log(`Unique valid timetables: ${uniqueTimetables.length}`);
        console.log(`Best score achieved: ${validTimetables[0]?.score || 'N/A'}`);
        console.log(`Average score: ${validTimetables.reduce((sum, t) => sum + t.score, 0) / validTimetables.length}`);
    }
    return {
        success: true,
        message: "Timetable generated successfully"
    }
}


// Export the data
export {
    generateTimetable_full
};
