import json
import re

# Load JSON data with student applications
def load_student_data(json_path):
    with open(json_path, 'r') as f:
        data = json.load(f)
    student_courses = {}
    for app in data["Applications"].values():
        roll_number = app["rollnumber"]
        course_code = app["coursecode"]
        if roll_number not in student_courses:
            student_courses[roll_number] = []
        student_courses[roll_number].append(course_code)
    return student_courses

# Parse exam schedule from the text file
def parse_exam_schedule(txt_path):
    exam_schedule = {}
    with open(txt_path, 'r') as f:
        content = f.read()
    pattern = r'([A-Z]+\d+\.\d+) \((.*?)\): (\d{2}/\d{2}/\d{4}), Slot (\d)'
    matches = re.findall(pattern, content)
    for code, name, date, slot in matches:
        if date not in exam_schedule:
            exam_schedule[date] = {}
        if slot not in exam_schedule[date]:
            exam_schedule[date][slot] = []
        exam_schedule[date][slot].append(code)
    return exam_schedule

# Check for conflicts
def check_conflicts(student_courses, exam_schedule):
    conflicts = {}
    for student, courses in student_courses.items():
        student_exams = {}
        # Map each course to its exam date and slot
        for course in courses:
            for date, slots in exam_schedule.items():
                for slot, slot_courses in slots.items():
                    if course in slot_courses:
                        if date not in student_exams:
                            student_exams[date] = {}
                        if slot not in student_exams[date]:
                            student_exams[date][slot] = []
                        student_exams[date][slot].append(course)

        # Check for conflicts
        for date, slots in student_exams.items():
            for slot, courses in slots.items():
                if len(courses) > 1:
                    if student not in conflicts:
                        conflicts[student] = []
                    conflicts[student].append((date, slot, courses))
    return conflicts

# Main function
def main(json_path, txt_path):
    student_courses = load_student_data(json_path)
    exam_schedule = parse_exam_schedule(txt_path)
    conflicts = check_conflicts(student_courses, exam_schedule)

    if conflicts:
        print("Conflicts found:")
        for student, conflict_list in conflicts.items():
            print(f"Student {student} has conflicts:")
            for date, slot, courses in conflict_list:
                print(f"  Date: {date}, Slot: {slot}, Courses: {', '.join(courses)}")
    else:
        print("No conflicts found.")

# Example usage
main('/home/user/Desktop/SEMESTER4/DASS/dass-spring-2025-project-team-39/code/backend/2425endsemspringdata.json', '/home/user/Desktop/SEMESTER4/DASS/dass-spring-2025-project-team-39/code/backend/exam_schedule_stats1.txt')
