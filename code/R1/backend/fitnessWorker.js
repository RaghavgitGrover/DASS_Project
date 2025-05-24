import workerpool from "workerpool";

const UNSCHEDULED = [-1, -1];
const UNSCHED_PENALTY = 75000;
const OVERLAP_PENALTY = 15000;
const CONSECUTIVE_PENALTY = 50;
const MULTIPLE_EXAMS_PENALTY = 100;

function fitness(sol, courses, numDays, numSlots) {
  let penalty = 0;
  const timeSlotConflicts = new Map(); // Map<`${day},${slot}`, Set<studentId>>
  const studentDaySlots = new Map(); // Map<studentId, Map<day, Set<slot>>>
  // Count unscheduled courses
  const unscheduledCount = Object.entries(sol).reduce((count, [_, [d, s]]) => {
    if (d === UNSCHEDULED[0] && s === UNSCHEDULED[1]) {
      return count + 1;
    }
    if (d < 0 || d >= numDays || s < 0 || s >= numSlots) {
      return count + 1;
    }
    return count;
  }, 0);
  penalty += unscheduledCount * UNSCHED_PENALTY;
  // Process all courses
  for (const course in sol) {
    const [d, s] = sol[course];
    if (
      d === UNSCHEDULED[0] ||
      s === UNSCHEDULED[1] ||
      d < 0 ||
      d >= numDays ||
      s < 0 ||
      s >= numSlots
    )
      continue;
    const students = courses[course]?.students;
    if (!students) continue;
    const timeSlotKey = `${d},${s}`;
    for (const student of students) {
      // Check for direct conflicts (same time slot)
      if (!timeSlotConflicts.has(timeSlotKey)) {
        timeSlotConflicts.set(timeSlotKey, new Set());
      }
      if (timeSlotConflicts.get(timeSlotKey).has(student)) {
        penalty += OVERLAP_PENALTY;
      } else {
        timeSlotConflicts.get(timeSlotKey).add(student);
      }
      // Track student schedules
      if (!studentDaySlots.has(student)) {
        studentDaySlots.set(student, new Map());
      }
      const studentDays = studentDaySlots.get(student);
      if (!studentDays.has(d)) {
        studentDays.set(d, new Set());
      }
      studentDays.get(d).add(s);
    }
  }
  // Evaluate student constraints
  for (const [student, dayMap] of studentDaySlots) {
    // Process each day for this student
    for (const [day, slots] of dayMap) {
      const daySlots = Array.from(slots).sort((a, b) => a - b);
      const dayInt = parseInt(day, 10);
      // More than 2 exams per day penalty
      if (daySlots.length > 2) {
        penalty += MULTIPLE_EXAMS_PENALTY * (daySlots.length - 2);
      }
      // Consecutive slots in same day
      for (let i = 0; i < daySlots.length - 1; i++) {
        if (daySlots[i + 1] - daySlots[i] === 1) {
          penalty += CONSECUTIVE_PENALTY;
        }
      }
      // Check consecutive days
      if (dayMap.has((dayInt + 1).toString())) {
        // Check last slot of current day and first slot of next day
        if (
          daySlots.includes(numSlots - 1) &&
          dayMap.get((dayInt + 1).toString()).has(0)
        ) {
          penalty += CONSECUTIVE_PENALTY;
        }
      }
    }
  }
  return penalty;
}

workerpool.worker({
  fitness: fitness,
});

// // highly optimized but gives wrong results sometimes
// import workerpool from "workerpool";

// // Penalty constants
// const UNSCHED_PENALTY = 75000;
// const OVERLAP_PENALTY = 15000;
// const CONSECUTIVE_PENALTY = 50;
// const MULTIPLE_EXAMS_PENALTY = 100;
// const UNSCHEDULED = [-1, -1];

// function fastFitness(solution, courses, studentIndex, numDays, numSlots) {
//   let penalty = 0;
//   const studentMap = new Map(Object.entries(studentIndex));
//   const slotConflicts = Array.from(
//     { length: numDays },
//     () => new Uint16Array(numSlots)
//   );
//   const studentSchedules = Array.from({ length: studentMap.size }, () =>
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
//       const sid = studentMap.get(student);
//       if (sid === undefined) continue;

//       // Track slot conflicts
//       slotConflicts[day][slot]++;

//       // Track student schedule using bitmask
//       studentSchedules[sid][day] |= 1 << slot;
//     }
//   }

//   // Second pass: calculate penalties
//   // Slot conflicts penalty
//   for (let day = 0; day < numDays; day++) {
//     for (let slot = 0; slot < numSlots; slot++) {
//       const count = slotConflicts[day][slot];
//       if (count > 1) penalty += (count - 1) * OVERLAP_PENALTY;
//     }
//   }

//   // Student constraints penalties
//   for (let sid = 0; sid < studentSchedules.length; sid++) {
//     const schedule = studentSchedules[sid];
//     for (let day = 0; day < numDays; day++) {
//       const slots = schedule[day];
//       if (!slots) continue;

//       // Multiple exams per day
//       const count = (slots.toString(2).match(/1/g) || []).length;
//       if (count > 2) penalty += (count - 2) * MULTIPLE_EXAMS_PENALTY;

//       // Consecutive slots (bitwise check)
//       let mask = slots & (slots << 1);
//       while (mask) {
//         if (mask & 1) penalty += CONSECUTIVE_PENALTY;
//         mask >>= 1;
//       }

//       // Cross-day consecutive check
//       if (day < numDays - 1) {
//         const nextDaySlots = schedule[day + 1];
//         if (slots & (1 << (numSlots - 1)) && nextDaySlots & 1) {
//           penalty += CONSECUTIVE_PENALTY;
//         }
//       }
//     }
//   }

//   return penalty;
// }

// workerpool.worker({
//   fastFitness: function (solution, courses, studentIndex, numDays, numSlots) {
//     // Convert studentIndex back to Map format
//     const studentMap = new Map(Object.entries(studentIndex));
//     return fastFitness(solution, courses, studentMap, numDays, numSlots);
//   },
// });
