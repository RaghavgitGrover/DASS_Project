import json
from collections import defaultdict
import sys

def load_timetable_from_file(filename):
    with open(filename, 'r') as f:
        timetable_data = json.load(f)
    return timetable_data["timetable"]

def load_student_registrations_from_file(filename):
    with open(filename, 'r') as f:
        registrations_data = json.load(f)
    return registrations_data["Applications"]

def build_course_to_slot_mapping(timetable):
    course_to_slot = {}
    for day_key, day_data in timetable.items():
        for slot_index, slot_data in enumerate(day_data["slots"]):
            for course in slot_data["courses"]:
                course_code = course["code"]
                course_to_slot[course_code] = (day_key, slot_index)
    return course_to_slot

def group_registrations_by_student(registrations):
    student_courses = defaultdict(list)
    for reg_id, reg_data in registrations.items():
        roll_number = reg_data["rollnumber"]
        course_code = reg_data["coursecode"]
        student_courses[roll_number].append(course_code)
    return student_courses

def find_conflicts(student_courses, course_to_slot):
    conflicts = {}
    for roll_number, courses in student_courses.items():
        schedule = defaultdict(list)
        for course in courses:
            if course in course_to_slot:
                day_slot = course_to_slot[course]
                schedule[day_slot].append(course)
        student_conflicts = {}
        for day_slot, slot_courses in schedule.items():
            if len(slot_courses) > 1:
                day, slot_index = day_slot
                student_conflicts[f"{day}_slot{slot_index}"] = slot_courses
        if student_conflicts:
            conflicts[roll_number] = student_conflicts
    return conflicts

def main(timetable_file, registrations_file):
    try:
        timetable = load_timetable_from_file(timetable_file)
        registrations = load_student_registrations_from_file(registrations_file)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error loading files: {e}")
        return

    course_to_slot = build_course_to_slot_mapping(timetable)
    student_courses = group_registrations_by_student(registrations)
    conflicts = find_conflicts(student_courses, course_to_slot)

    if conflicts:
        print("Exam schedule conflicts found:")
        print("=============================")
        for roll_number, student_conflicts in conflicts.items():
            print(f"\nStudent {roll_number} has conflicts:")
            for day_slot, courses in student_conflicts.items():
                print(f"  In {day_slot}: {', '.join(courses)}")
        print(f"\nTotal students with conflicts: {len(conflicts)}")
    else:
        print("No exam schedule conflicts found.")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python script.py <timetable_file> <registrations_file>")
    else:
        main(sys.argv[1], sys.argv[2])
