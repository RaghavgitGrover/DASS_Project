import workerpool from "workerpool";
import os from "os";
import path from "path";
import QuickLRU from "quick-lru";

const POP_SIZE = 100;
const GENERATIONS = 200;
const MUTATION_RATE = 0.5;
const UNSCHEDULED = [-1, -1];
const UNSCHED_PENALTY = 75000;
const ELITE_COUNT = 10;
const FITNESS_CACHE_SIZE = 5000;
const OVERLAP_PENALTY = 15000;
const CONSECUTIVE_PENALTY = 50;
const MULTIPLE_EXAMS_PENALTY = 100;

function processCoursesData(coursesData) {
  const courses = {};
  for (const course of coursesData) {
    courses[course.code] = {
      course_name: course.name,
      students: course.students || [],
    };
  }
  return courses;
}

function formatDate(date) {
  if (!(date instanceof Date) || isNaN(date)) {
    console.error(`Invalid date: ${date}`);
    return new Date().toISOString().split("T")[0];
  }
  return date.toISOString().split("T")[0];
}

function formatSlot(slotNumber) {
  if (typeof slotNumber !== "number" || isNaN(slotNumber)) {
    console.error(`Invalid slot number: ${slotNumber}`);
    return "1";
  }
  return `${Math.floor(slotNumber) + 1}`;
}

// Genetic Algorithm Functions (Optimized)
function randomSolution(courses, numDays, numSlots) {
  if (typeof numDays !== "number" || isNaN(numDays) || numDays <= 0) {
    console.error(`Invalid numDays in randomSolution: ${numDays}`);
    numDays = 1;
  }
  if (typeof numSlots !== "number" || isNaN(numSlots) || numSlots <= 0) {
    console.error(`Invalid numSlots in randomSolution: ${numSlots}`);
    numSlots = 1;
  }
  const sol = {};
  const courseKeys = Object.keys(courses);
  for (let i = 0; i < courseKeys.length; i++) {
    // Ensure we stay within bounds and generate valid numbers
    const day = Math.floor(Math.random() * numDays);
    const slot = Math.floor(Math.random() * numSlots);
    sol[courseKeys[i]] = [day, slot];
  }
  return sol;
}

function mutate(sol, courses, numDays, numSlots, mutationStrength = 0.5) {
  const newSol = { ...sol };
  const courseKeys = Object.keys(courses);
  const numMutations = Math.max(1, Math.floor(Math.random() * 3)); // Allow multiple mutations
  for (let m = 0; m < numMutations; m++) {
    const courseIdx = Math.floor(Math.random() * courseKeys.length);
    const course = courseKeys[courseIdx];
    const [currentDay, currentSlot] = sol[course];
    if (currentDay === UNSCHEDULED[0] && currentSlot === UNSCHEDULED[1]) {
      // Higher chance to schedule unscheduled courses
      if (Math.random() < 0.8) {
        newSol[course] = [
          Math.floor(Math.random() * numDays),
          Math.floor(Math.random() * numSlots),
        ];
      }
    } else {
      if (Math.random() < 0.95) {
        let newDay, newSlot;
        if (Math.random() < mutationStrength) {
          // Global mutation
          newDay = Math.floor(Math.random() * numDays);
          newSlot = Math.floor(Math.random() * numSlots);
        } else {
          // Local mutation with variable step size
          const dayStep = Math.floor(Math.random() * 3) - 1;
          const slotStep = Math.floor(Math.random() * 3) - 1;
          newDay = (currentDay + dayStep + numDays) % numDays;
          newSlot = (currentSlot + slotStep + numSlots) % numSlots;
          // Occasionally try to move away from weekends
          if (isWeekend(newDay) && Math.random() < 0.7) {
            newDay = (newDay + 2) % numDays;
          }
        }
        newSol[course] = [newDay, newSlot];
      } else {
        newSol[course] = [...UNSCHEDULED];
      }
    }
  }
  return newSol;
}

function crossover(sol1, sol2) {
  const child = {};
  const courses = Object.keys(sol1);
  // Improved crossover with intelligent mixing
  const useFirst = new Array(courses.length);
  const fitnessCache = new Map();
  // Calculate partial fitness for each course assignment
  for (let i = 0; i < courses.length; i++) {
    const course = courses[i];
    const assignment1 = sol1[course];
    const assignment2 = sol2[course];
    // Prefer scheduled over unscheduled
    if (
      assignment1[0] === UNSCHEDULED[0] &&
      assignment2[0] !== UNSCHEDULED[0]
    ) {
      useFirst[i] = false;
    } else if (
      assignment2[0] === UNSCHEDULED[0] &&
      assignment1[0] !== UNSCHEDULED[0]
    ) {
      useFirst[i] = true;
    } else {
      // Random selection with slight bias towards first parent
      useFirst[i] = Math.random() < 0.55;
    }
  }
  // Build child solution
  for (let i = 0; i < courses.length; i++) {
    const course = courses[i];
    child[course] = useFirst[i] ? [...sol1[course]] : [...sol2[course]];
  }
  return child;
}

function calculateFitness(sol, courses, numDays, numSlots) {
  let penalty = 0;
  const studentSchedules = new Map();
  const slotOccupancy = new Map();
  // Initialize slot occupancy
  for (let day = 0; day < numDays; day++) {
    slotOccupancy.set(day, new Map());
    for (let slot = 0; slot < numSlots; slot++) {
      slotOccupancy.get(day).set(slot, new Set());
    }
  }

  // Count unscheduled courses
  const unscheduledCount = Object.keys(sol).reduce((count, course) => {
    const [d, s] = sol[course];
    return d === UNSCHEDULED[0] && s === UNSCHEDULED[1] ? count + 1 : count;
  }, 0);
  penalty += unscheduledCount * UNSCHED_PENALTY;

  // Process scheduled courses
  for (const [courseCode, [day, slot]] of Object.entries(sol)) {
    if (day === UNSCHEDULED[0] && slot === UNSCHEDULED[1]) continue;
    const course = courses[courseCode];
    if (!course?.students) continue;
    for (const student of course.students) {
      // Track student schedules
      if (!studentSchedules.has(student)) {
        studentSchedules.set(student, new Map());
      }
      const studentDays = studentSchedules.get(student);
      if (!studentDays.has(day)) {
        studentDays.set(day, new Set());
      }
      // Check for direct conflicts
      if (studentDays.get(day).has(slot)) {
        penalty += OVERLAP_PENALTY;
      }
      studentDays.get(day).add(slot);
      // Track slot occupancy
      slotOccupancy.get(day).get(slot).add(student);
    }
  }
  // Evaluate student constraints
  for (const [student, dayMap] of studentSchedules) {
    for (const [day, slots] of dayMap) {
      const daySlots = Array.from(slots).sort((a, b) => a - b);
      // Same day penalties
      if (daySlots.length > 2) {
        penalty += MULTIPLE_EXAMS_PENALTY * (daySlots.length - 2);
      }
      // Consecutive slots
      for (let i = 0; i < daySlots.length - 1; i++) {
        if (daySlots[i + 1] - daySlots[i] === 1) {
          penalty += CONSECUTIVE_PENALTY;
        }
      }
      // Cross-day consecutive check
      const nextDay = parseInt(day) + 1;
      if (dayMap.has(nextDay)) {
        if (slots.has(numSlots - 1) && dayMap.get(nextDay).has(0)) {
          penalty += CONSECUTIVE_PENALTY;
        }
      }
    }
  }
  // Penalize uneven distribution
  for (const [day, slots] of slotOccupancy) {
    let dayTotal = 0;
    for (const [slot, students] of slots) {
      dayTotal += students.size;
    }
    const avgPerSlot = dayTotal / numSlots;
    for (const [slot, students] of slots) {
      const deviation = Math.abs(students.size - avgPerSlot);
      penalty += deviation * 100;
    }
  }
  return penalty;
}

// Genetic Algorithm Core
export async function generateTimetable(
  coursesData,
  startDate,
  examDates,
  numSlots
) {
  console.log(
    `Starting timetable generation with ${coursesData.length} courses...`
  );
  console.log("Start date:", startDate);
  console.log("Exam dates:", examDates);
  console.log("Number of slots:", numSlots);
  const courses = processCoursesData(coursesData);
  // Create a worker pool with limited size
  const numWorkers = Math.min(os.cpus().length - 1, 4); // Leave one CPU free
  const pool = workerpool.pool(
    path.join(process.cwd(), ".", "fitnessWorker.js"),
    {
      maxWorkers: numWorkers,
      workerType: "thread",
    }
  );
  console.log(`Using ${numWorkers} workers for parallel processing`);
  const fitnessCache = new QuickLRU({ maxSize: FITNESS_CACHE_SIZE });
  try {
    // Generate initial population
    console.log("Generating initial population...");
    let population = Array(POP_SIZE)
      .fill()
      .map(() => randomSolution(courses, examDates.length, numSlots));
    let best = null;
    let bestFit = Infinity;
    const BATCH_SIZE = Math.max(5, Math.floor(POP_SIZE / (numWorkers * 2))); // Optimize batch size
    for (let gen = 0; gen < GENERATIONS; gen++) {
      if (gen % 10 === 0) {
        console.log(
          `Generation ${gen}/${GENERATIONS}, best fitness: ${bestFit}`
        );
      }
      // Evaluate fitness in optimized batches
      const populationWithFitness = [];
      for (let i = 0; i < population.length; i += BATCH_SIZE) {
        const batch = population.slice(
          i,
          Math.min(i + BATCH_SIZE, population.length)
        );
        const fitnessPromises = batch.map((sol) => {
          const hash = JSON.stringify(sol);
          if (fitnessCache.has(hash)) {
            return Promise.resolve(fitnessCache.get(hash));
          }
          return pool
            .exec("fitness", [sol, courses, examDates.length, numSlots])
            .then((fitness) => {
              fitnessCache.set(hash, fitness);
              return fitness;
            })
            .catch((err) => {
              console.error("Fitness calculation error:", err);
              return Infinity; // Return high penalty for failed calculations
            });
        });
        try {
          const fitnessBatch = await Promise.all(fitnessPromises);
          batch.forEach((sol, idx) =>
            populationWithFitness.push({ sol, fit: fitnessBatch[idx] })
          );
        } catch (error) {
          console.error("Batch processing error:", error);
          continue;
        }
      }
      if (populationWithFitness.length === 0) {
        console.error("No valid solutions in this generation");
        continue;
      }
      populationWithFitness.sort((a, b) => a.fit - b.fit);
      population = populationWithFitness.map((item) => item.sol);
      // Update best solution
      const currentBest = populationWithFitness[0];
      if (currentBest.fit < bestFit) {
        bestFit = currentBest.fit;
        best = { ...currentBest.sol };
        console.log(`New best fitness: ${bestFit}`);
      }
      // Early stopping if we have a good solution
      if (bestFit < 1000) {
        console.log("Found excellent solution, stopping early");
        break;
      }
      // Adaptive mutation rate
      const diversity = calculateDiversity(population);
      const adaptiveMutationRate = adjustMutationRate(diversity, MUTATION_RATE);
      // Create new population
      const newPopulation = population.slice(0, ELITE_COUNT);
      while (newPopulation.length < POP_SIZE) {
        const p1 = selectParent(population, populationWithFitness);
        const p2 = selectParent(population, populationWithFitness);
        let child = crossover(p1, p2);
        if (Math.random() < adaptiveMutationRate) {
          child = mutate(
            child,
            courses,
            examDates.length,
            numSlots,
            adaptiveMutationRate
          );
        }
        newPopulation.push(child);
      }
      population = newPopulation;
    }
    console.log("Timetable generation completed");
    // Convert to timetable format
    const { timetable, stats } = solutionToTimetable(
      best,
      coursesData,
      examDates,
      numSlots
    );
    return { timetable, stats, fitness: bestFit };
  } catch (error) {
    console.error("Timetable generation error:", error);
    throw error;
  } finally {
    await pool.terminate();
  }
}

// Helper functions
function calculateDiversity(population) {
  const sampleSize = Math.min(10, population.length);
  let totalDifferences = 0;
  for (let i = 0; i < sampleSize; i++) {
    for (let j = i + 1; j < sampleSize; j++) {
      totalDifferences += Object.keys(population[i]).filter(
        (k) => population[i][k] !== population[j][k]
      ).length;
    }
  }
  return totalDifferences / ((sampleSize * (sampleSize - 1)) / 2);
}

function adjustMutationRate(diversity, baseRate) {
  if (diversity < 0.2) return Math.min(0.9, baseRate * 1.5);
  if (diversity > 0.8) return Math.max(0.1, baseRate * 0.8);
  return baseRate;
}

function selectParent(population, populationWithFitness) {
  const tournamentSize = Math.max(2, Math.floor(population.length / 5));
  let best = population[0];
  for (let i = 0; i < tournamentSize; i++) {
    const candidate = population[Math.floor(Math.random() * population.length)];
    if (
      populationWithFitness.findIndex((p) => p.sol === candidate) <
      populationWithFitness.findIndex((p) => p.sol === best)
    ) {
      best = candidate;
    }
  }
  return best;
}

export function solutionToTimetable(solution, coursesData, dates, numSlots) {
  // Validate inputs
  if (!solution || typeof solution !== "object") {
    console.error("Invalid solution object");
    return createEmptyResult(dates.length, numSlots);
  }
  if (!Array.isArray(coursesData)) {
    console.error("Invalid coursesData: not an array");
    return createEmptyResult(dates.length, numSlots);
  }
  if (
    typeof dates.length !== "number" ||
    isNaN(dates.length) ||
    dates.length <= 0
  ) {
    console.error(`Invalid dates length: ${dates.length}`);
    dates.length = 1; // Default to 1 day
  }
  if (typeof numSlots !== "number" || isNaN(numSlots) || numSlots <= 0) {
    console.error(`Invalid numSlots: ${numSlots}`);
    numSlots = 1; // Default to 1 slot
  }

  const timetable = {};
  const stats = {
    totalCourses: coursesData.length,
    scheduledCourses: 0,
    unscheduledCourses: 0,
    numDays: dates.length,
    numSlots: numSlots,
    slotUtilization: [],
  };

  // Initialize timetable structure with dynamic days and slots
  for (let day = 0; day < dates.length; day++) {
    const dayKey = formatDate(dates[day]);
    timetable[dayKey] = {};
    for (let slot = 0; slot < numSlots; slot++) {
      const slotKey = formatSlot(slot);
      timetable[dayKey][slotKey] = [];
    }
  }

  // Fill in the timetable
  Object.entries(solution).forEach(([courseCode, assignment]) => {
    if (!Array.isArray(assignment) || assignment.length !== 2) {
      console.error(`Invalid assignment for course ${courseCode}`);
      stats.unscheduledCourses++;
      return;
    }
    const [day, slot] = assignment.map(Number);

    // Check if the course is unscheduled or out of bounds
    if (
      isNaN(day) ||
      isNaN(slot) ||
      day === UNSCHEDULED[0] ||
      slot === UNSCHEDULED[1] ||
      day < 0 ||
      day >= dates.length ||
      slot < 0 ||
      slot >= numSlots
    ) {
      stats.unscheduledCourses++;
      return;
    }
    const dayKey = formatDate(dates[day]);
    const slotKey = formatSlot(slot);
    // Double check that the day and slot exist in the timetable
    if (!timetable[dayKey] || !timetable[dayKey][slotKey]) {
      console.error(`Invalid day/slot combination: day=${day}, slot=${slot}`);
      stats.unscheduledCourses++;
      return;
    }

    const courseData = coursesData.find((c) => c.code === courseCode);
    if (!courseData) {
      console.error(`Course data not found for code: ${courseCode}`);
      stats.unscheduledCourses++;
      return;
    }
    stats.scheduledCourses++;
    timetable[dayKey][slotKey].push({
      code: courseCode,
      name: courseData.name || "",
      students: courseData.students || [],
    });
  });

  // Calculate slot utilization
  const slotUtilization = [];
  for (let day = 0; day < dates.length; day++) {
    const dayKey = formatDate(dates[day]);
    const slots = [];
    for (let slot = 0; slot < numSlots; slot++) {
      const slotKey = formatSlot(slot);
      slots.push({
        slot: slotKey,
        count: timetable[dayKey][slotKey].length,
      });
    }
    slotUtilization.push({
      day: dayKey,
      slots: slots,
    });
  }

  return {
    timetable,
    stats: {
      totalCourses: coursesData.length,
      scheduledCourses: stats.scheduledCourses,
      unscheduledCourses: stats.unscheduledCourses,
      numDays: dates.length,
      numSlots,
      slotUtilization,
    },
  };
}

// Helper function to create empty result
function createEmptyResult(numDays, numSlots) {
  return {
    timetable: {},
    stats: {
      totalCourses: 0,
      scheduledCourses: 0,
      unscheduledCourses: 0,
      numDays,
      numSlots,
      slotUtilization: [],
    },
  };
}

function isWeekend(day) {
  return day % 7 === 5 || day % 7 === 6;
}

// // highly optimized but gives wrong results sometimes
// import workerpool from "workerpool";
// import os from "os";
// import path from "path";
// import QuickLRU from "quick-lru";

// // Adaptive parameters based on dataset size
// const BASE_POP_SIZE = 100;
// const BASE_GENERATIONS = 200;
// const MUTATION_RATE = 0.4;
// const UNSCHEDULED = [-1, -1];
// const ELITE_COUNT = 5;
// const FITNESS_CACHE_SIZE = 10000;

// // Precompute student-course index and bitmask utilities
// function createStudentIndex(courses) {
//   const index = new Map();
//   let studentId = 0;
//   for (const [code, course] of Object.entries(courses)) {
//     for (const student of course.students) {
//       if (!index.has(student)) index.set(student, studentId++);
//     }
//   }
//   return index;
// }

// function processCoursesData(coursesData) {
//   const courses = {};
//   for (const course of coursesData) {
//     courses[course.code] = {
//       students: course.students || [],
//       bitmask: 0,
//     };
//   }
//   return courses;
// }

// // Fast solution hashing
// function hashSolution(solution) {
//   let hash = 0;
//   for (const [key, [d, s]] of Object.entries(solution)) {
//     hash = (hash << 5) - hash + d * 1000 + s;
//     hash |= 0;
//   }
//   return hash;
// }

// // Optimized fitness calculation (run this in worker)
// function fastFitness(solution, courses, studentIndex, numDays, numSlots) {
//   let penalty = 0;
//   const slotConflicts = Array.from(
//     { length: numDays },
//     () => new Uint16Array(numSlots)
//   );
//   const studentSchedules = Array.from({ length: studentIndex.size }, () =>
//     Array.from({ length: numDays }, () => 0)
//   );
//   // First pass: collect conflicts and schedules
//   for (const [courseCode, [day, slot]] of Object.entries(solution)) {
//     if (day === UNSCHEDULED[0]) {
//       penalty += UNSCHED_PENALTY;
//       continue;
//     }
//     const course = courses[courseCode];
//     for (const student of course.students) {
//       const sid = studentIndex.get(student);
//       slotConflicts[day][slot]++;
//       studentSchedules[sid][day] |= 1 << slot;
//     }
//   }
//   // Second pass: calculate penalties
//   // Slot conflicts
//   for (let day = 0; day < numDays; day++) {
//     for (let slot = 0; slot < numSlots; slot++) {
//       const count = slotConflicts[day][slot];
//       if (count > 1) penalty += (count - 1) * OVERLAP_PENALTY;
//     }
//   }
//   // Student constraints
//   for (let sid = 0; sid < studentSchedules.length; sid++) {
//     const schedule = studentSchedules[sid];
//     for (let day = 0; day < numDays; day++) {
//       const slots = schedule[day];
//       if (!slots) continue;
//       // Multiple exams per day
//       const count = (slots.toString(2).match(/1/g) || []).length;
//       if (count > 2) penalty += (count - 2) * MULTIPLE_EXAMS_PENALTY;
//       // Consecutive slots
//       let mask = slots & (slots << 1);
//       while (mask) {
//         if (mask & 1) penalty += CONSECUTIVE_PENALTY;
//         mask >>= 1;
//       }
//       // Cross-day consecutive
//       if (day < numDays - 1) {
//         const nextDay = schedule[day + 1];
//         if (slots & (1 << (numSlots - 1)) && nextDay & 1) {
//           penalty += CONSECUTIVE_PENALTY;
//         }
//       }
//     }
//   }
//   return penalty;
// }

// function randomSolution(courses, numDays, numSlots) {
//   const sol = {};
//   for (const courseCode of Object.keys(courses)) {
//     if (Math.random() < 0.95) {
//       // 95% chance to schedule immediately
//       sol[courseCode] = [
//         Math.floor(Math.random() * numDays),
//         Math.floor(Math.random() * numSlots),
//       ];
//     } else {
//       sol[courseCode] = [...UNSCHEDULED];
//     }
//   }
//   return sol;
// }

// // Optimized genetic operators
// function fastMutate(solution, courses, numDays, numSlots) {
//   const mutated = {};
//   const keys = Object.keys(solution);
//   const mutateCount = Math.ceil(keys.length * 0.1);
//   for (let i = 0; i < mutateCount; i++) {
//     const course = keys[Math.floor(Math.random() * keys.length)];
//     const [day, slot] = solution[course];
//     if (day === UNSCHEDULED[0]) {
//       // Schedule unscheduled courses first
//       mutated[course] = [
//         Math.floor(Math.random() * numDays),
//         Math.floor(Math.random() * numSlots),
//       ];
//     } else {
//       // Local search mutation
//       mutated[course] = [
//         (day + (Math.floor(Math.random() * 3 - 1 + numDays) % numDays),
//         slot + (Math.floor(Math.random() * 3 - 1 + numSlots) % numSlots)),
//       ];
//     }
//   }
//   return { ...solution, ...mutated };
// }

// function fastCrossover(a, b) {
//   const child = {};
//   const keys = Object.keys(a);
//   for (const key of keys) {
//     child[key] = Math.random() < 0.5 ? a[key] : b[key];
//   }
//   return child;
// }

// function repairSolution(sol, courses, numDays, numSlots) {
//   const repairedSol = { ...sol };
//   const unscheduled = Object.entries(repairedSol)
//     .filter(([_, [d]]) => d === UNSCHEDULED[0])
//     .map(([course]) => course);
//   if (unscheduled.length === 0) return repairedSol;
//   const occupancy = new Map();
//   for (let d = 0; d < numDays; d++) {
//     occupancy.set(d, new Map());
//     for (let s = 0; s < numSlots; s++) {
//       occupancy.get(d).set(s, new Set());
//     }
//   }
//   Object.entries(repairedSol).forEach(([course, [day, slot]]) => {
//     if (day === UNSCHEDULED[0]) return;
//     courses[course]?.students?.forEach((student) => {
//       occupancy.get(day).get(slot).add(student);
//     });
//   });
//   unscheduled.forEach((course) => {
//     let bestDay = -1,
//       bestSlot = -1,
//       minConflicts = Infinity;
//     for (let d = 0; d < numDays; d++) {
//       for (let s = 0; s < numSlots; s++) {
//         let conflicts = 0;
//         courses[course]?.students?.forEach((student) => {
//           if (occupancy.get(d).get(s).has(student)) conflicts++;
//         });
//         if (conflicts < minConflicts) {
//           minConflicts = conflicts;
//           bestDay = d;
//           bestSlot = s;
//           if (conflicts === 0) break;
//         }
//       }
//       if (minConflicts === 0) break;
//     }
//     repairedSol[course] = [bestDay, bestSlot];
//     courses[course]?.students?.forEach((student) => {
//       occupancy.get(bestDay).get(bestSlot).add(student);
//     });
//   });
//   return repairedSol;
// }
// function formatDate(date) {
//   if (!(date instanceof Date) || isNaN(date)) {
//     return new Date().toISOString().split("T")[0];
//   }
//   return date.toISOString().split("T")[0];
// }

// function formatSlot(slotNumber) {
//   return `${Math.floor(slotNumber) + 1}`;
// }

// function createEmptyResult(numDays, numSlots) {
//   const result = {
//     timetable: {},
//     stats: {
//       totalCourses: 0,
//       scheduledCourses: 0,
//       unscheduledCourses: 0,
//       numDays: numDays,
//       numSlots: numSlots,
//       slotUtilization: [],
//     },
//   };
//   // Initialize empty timetable structure
//   const dummyDate = new Date();
//   for (let d = 0; d < numDays; d++) {
//     const dayKey = formatDate(new Date(dummyDate.getTime() + d * 86400000));
//     result.timetable[dayKey] = {};
//     for (let s = 0; s < numSlots; s++) {
//       result.timetable[dayKey][formatSlot(s)] = [];
//     }
//   }
//   return result;
// }

// export function solutionToTimetable(solution, coursesData, dates, numSlots) {
//   // Validate inputs
//   if (!solution || typeof solution !== "object") {
//     console.error("Invalid solution object");
//     return createEmptyResult(dates.length, numSlots);
//   }
//   if (!Array.isArray(coursesData)) {
//     console.error("Invalid coursesData: not an array");
//     return createEmptyResult(dates.length, numSlots);
//   }
//   if (
//     typeof dates.length !== "number" ||
//     isNaN(dates.length) ||
//     dates.length <= 0
//   ) {
//     console.error(`Invalid dates length: ${dates.length}`);
//     dates.length = 1; // Default to 1 day
//   }
//   if (typeof numSlots !== "number" || isNaN(numSlots) || numSlots <= 0) {
//     console.error(`Invalid numSlots: ${numSlots}`);
//     numSlots = 1; // Default to 1 slot
//   }
//   const timetable = {};
//   const stats = {
//     totalCourses: coursesData.length,
//     scheduledCourses: 0,
//     unscheduledCourses: 0,
//     numDays: dates.length,
//     numSlots: numSlots,
//     slotUtilization: [],
//   };
//   // Initialize timetable structure with dynamic days and slots
//   for (let day = 0; day < dates.length; day++) {
//     const dayKey = formatDate(dates[day]);
//     timetable[dayKey] = {};
//     for (let slot = 0; slot < numSlots; slot++) {
//       const slotKey = formatSlot(slot);
//       timetable[dayKey][slotKey] = [];
//     }
//   }
//   // Fill in the timetable
//   Object.entries(solution).forEach(([courseCode, assignment]) => {
//     if (!Array.isArray(assignment) || assignment.length !== 2) {
//       console.error(`Invalid assignment for course ${courseCode}`);
//       stats.unscheduledCourses++;
//       return;
//     }
//     const [day, slot] = assignment.map(Number);
//     // Check if the course is unscheduled or out of bounds
//     if (
//       isNaN(day) ||
//       isNaN(slot) ||
//       day === UNSCHEDULED[0] ||
//       slot === UNSCHEDULED[1] ||
//       day < 0 ||
//       day >= dates.length ||
//       slot < 0 ||
//       slot >= numSlots
//     ) {
//       stats.unscheduledCourses++;
//       return;
//     }
//     const dayKey = formatDate(dates[day]);
//     const slotKey = formatSlot(slot);
//     // Double check that the day and slot exist in the timetable
//     if (!timetable[dayKey] || !timetable[dayKey][slotKey]) {
//       console.error(`Invalid day/slot combination: day=${day}, slot=${slot}`);
//       stats.unscheduledCourses++;
//       return;
//     }
//     const courseData = coursesData.find((c) => c.code === courseCode);
//     if (!courseData) {
//       console.error(`Course data not found for code: ${courseCode}`);
//       stats.unscheduledCourses++;
//       return;
//     }
//     stats.scheduledCourses++;
//     timetable[dayKey][slotKey].push({
//       code: courseCode,
//       name: courseData.name || "",
//       students: courseData.students || [],
//     });
//   });
//   // Calculate slot utilization
//   const slotUtilization = [];
//   for (let day = 0; day < dates.length; day++) {
//     const dayKey = formatDate(dates[day]);
//     const slots = [];
//     for (let slot = 0; slot < numSlots; slot++) {
//       const slotKey = formatSlot(slot);
//       slots.push({
//         slot: slotKey,
//         count: timetable[dayKey][slotKey].length,
//       });
//     }
//     slotUtilization.push({
//       day: dayKey,
//       slots: slots,
//     });
//   }
//   return {
//     timetable,
//     stats: {
//       totalCourses: coursesData.length,
//       scheduledCourses: stats.scheduledCourses,
//       unscheduledCourses: stats.unscheduledCourses,
//       numDays: dates.length,
//       numSlots,
//       slotUtilization,
//     },
//   };
// }

// // Main optimized algorithm
// export async function generateTimetable(
//   coursesData,
//   startDate,
//   examDates,
//   numSlots
// ) {
//   const courses = processCoursesData(coursesData);
//   const studentIndex = createStudentIndex(courses);
//   const numDays = examDates.length;
//   const numCourses = coursesData.length;
//   // Adaptive parameters
//   const { popSize, generations } = (() => {
//     if (numCourses > 1000) return { popSize: 50, generations: 80 };
//     if (numCourses > 500) return { popSize: 75, generations: 100 };
//     return { popSize: BASE_POP_SIZE, generations: BASE_GENERATIONS };
//   })();
//   const pool = workerpool.pool(
//     path.join(process.cwd(), ".", "fitnessWorker.js"),
//     {
//       maxWorkers: Math.min(os.cpus().length, 8),
//       workerType: "thread",
//     }
//   );
//   try {
//     // Initialize population
//     let population = Array(popSize)
//       .fill()
//       .map(() => randomSolution(courses, numDays, numSlots));
//     const fitnessCache = new QuickLRU({ maxSize: FITNESS_CACHE_SIZE });
//     let bestSolution = null;
//     let bestFitness = Infinity;
//     for (let gen = 0; gen < generations; gen++) {
//       // Parallel fitness evaluation
//       const fitnesses = await Promise.all(
//         population.map((solution) => {
//           const hash = hashSolution(solution);
//           return fitnessCache.has(hash)
//             ? Promise.resolve(fitnessCache.get(hash))
//             : pool
//                 .exec("fastFitness", [solution, courses, numDays, numSlots])
//                 .then((f) => {
//                   fitnessCache.set(hash, f);
//                   return f;
//                 });
//         })
//       );
//       // Update best solution
//       const currentBest = Math.min(...fitnesses);
//       if (currentBest < bestFitness) {
//         bestFitness = currentBest;
//         bestSolution = population[fitnesses.indexOf(currentBest)];
//       }
//       // Early termination
//       if (bestFitness === 0) break;
//       // Selection and reproduction
//       const elite = population
//         .map((sol, i) => ({ sol, fit: fitnesses[i] }))
//         .sort((a, b) => a.fit - b.fit)
//         .slice(0, ELITE_COUNT)
//         .map((item) => item.sol);
//       const newPopulation = [...elite];
//       while (newPopulation.length < popSize) {
//         const parents = [
//           selectParent(population, fitnesses),
//           selectParent(population, fitnesses),
//         ];
//         const child = fastCrossover(parents[0], parents[1]);
//         newPopulation.push(fastMutate(child, courses, numDays, numSlots));
//       }
//       population = newPopulation;
//     }
//     // Post-processing
//     const repaired = repairSolution(bestSolution, courses, numDays, numSlots);
//     return solutionToTimetable(repaired, coursesData, examDates, numSlots);
//   } finally {
//     await pool.terminate();
//   }
// }

// function selectParent(population, fitnesses) {
//   const total = fitnesses.reduce((sum, f) => sum + 1 / (1 + f), 0);
//   let threshold = Math.random() * total;
//   for (let i = 0; i < population.length; i++) {
//     threshold -= 1 / (1 + fitnesses[i]);
//     if (threshold <= 0) return population[i];
//   }
//   return population[0];
// }
