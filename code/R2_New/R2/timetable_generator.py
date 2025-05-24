import json
import random
from typing import Dict, List, Set, Tuple
from collections import defaultdict

def load_data():
    # Load lecture timetable
    with open('code/New/backend/mon_tues_wed.json', 'r') as f:
        lecture_data = json.load(f)

    # Load student course data
    with open('code/New/backend/2425endsemspringdata.json', 'r') as f:
        student_data = json.load(f)

    return lecture_data, student_data

def get_course_students(student_data: Dict) -> Dict[str, Set[str]]:
    """Create a mapping of course names to sets of student roll numbers."""
    course_students = defaultdict(set)

    for _, application in student_data['Applications'].items():
        course_name = application['coursename']
        roll_number = application['rollnumber']
        course_students[course_name].add(roll_number)

    return course_students

def get_course_timeslots(lecture_data: Dict) -> Dict[str, List[Tuple[str, int]]]:
    """Create a mapping of course names to their lecture timeslots."""
    course_timeslots = defaultdict(list)

    for day in lecture_data['days']:
        day_id = day['id']
        for schedule in lecture_data['schedule']:
            if schedule['day'] == day_id:
                for timeslot in schedule['courses']:
                    slot_id = timeslot['timeslot']
                    for course in timeslot['courses']:
                        course_name = course['name']
                        course_timeslots[course_name].append((day_id, slot_id))

    return course_timeslots

def find_course_conflicts(course_students: Dict[str, Set[str]],
                         course_timeslots: Dict[str, List[Tuple[str, int]]]) -> List[Tuple[str, str]]:
    """Find pairs of courses that have student conflicts."""
    conflicts = []

    courses = list(course_students.keys())
    for i in range(len(courses)):
        for j in range(i + 1, len(courses)):
            course1, course2 = courses[i], courses[j]
            students1 = course_students[course1]
            students2 = course_students[course2]

            # If there's any overlap in students
            if students1 & students2:
                conflicts.append((course1, course2))

    return conflicts

def generate_exam_schedule(course_students: Dict[str, Set[str]],
                          course_timeslots: Dict[str, List[Tuple[str, int]]],
                          num_days: int = 4,
                          slots_per_day: int = 4) -> Dict[str, Tuple[int, int]]:
    """Generate an optimized exam schedule."""
    # Get all courses
    courses = list(course_students.keys())
    num_courses = len(courses)

    # Initialize schedule
    schedule = {}
    used_slots = set()

    # Find conflicts
    conflicts = find_course_conflicts(course_students, course_timeslots)
    conflict_graph = defaultdict(set)
    for course1, course2 in conflicts:
        conflict_graph[course1].add(course2)
        conflict_graph[course2].add(course1)

    # Sort courses by number of conflicts (most conflicting first)
    courses.sort(key=lambda x: len(conflict_graph[x]), reverse=True)

    # Try to schedule each course
    for course in courses:
        # Try each possible slot
        for day in range(num_days):
            for slot in range(slots_per_day):
                slot_key = (day, slot)

                # Skip if slot is already used
                if slot_key in used_slots:
                    continue

                # Check for conflicts with already scheduled courses
                has_conflict = False
                for scheduled_course, scheduled_slot in schedule.items():
                    if scheduled_course in conflict_graph[course]:
                        if scheduled_slot[0] == day:  # Same day
                            has_conflict = True
                            break

                if not has_conflict:
                    schedule[course] = slot_key
                    used_slots.add(slot_key)
                    break

    return schedule

def format_schedule(schedule: Dict[str, Tuple[int, int]],
                   lecture_data: Dict) -> Dict:
    """Format the schedule into a structured output."""
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday']
    slots = ['9:00 AM - 11:00 AM', '11:30 AM - 1:30 PM',
             '2:00 PM - 4:00 PM', '4:30 PM - 6:30 PM']

    formatted_schedule = {
        'metadata': {
            'title': 'End Semester Examination Schedule',
            'version': '1.0',
            'date': 'Spring 2025'
        },
        'schedule': []
    }

    for day in range(4):
        day_schedule = {
            'day': days[day],
            'slots': []
        }

        for slot in range(4):
            slot_courses = []
            for course, (scheduled_day, scheduled_slot) in schedule.items():
                if scheduled_day == day and scheduled_slot == slot:
                    slot_courses.append(course)

            if slot_courses:
                day_schedule['slots'].append({
                    'time': slots[slot],
                    'courses': slot_courses
                })

        formatted_schedule['schedule'].append(day_schedule)

    return formatted_schedule

def main():
    # Load data
    lecture_data, student_data = load_data()

    # Process data
    course_students = get_course_students(student_data)
    course_timeslots = get_course_timeslots(lecture_data)

    # Generate schedule
    schedule = generate_exam_schedule(course_students, course_timeslots)

    # Format and save schedule
    formatted_schedule = format_schedule(schedule, lecture_data)

    with open('code/New/backend/exam_schedule.json', 'w') as f:
        json.dump(formatted_schedule, f, indent=2)

if __name__ == '__main__':
    main()