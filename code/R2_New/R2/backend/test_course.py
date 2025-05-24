import json

def count_unique_courses(json_file_path):
    """
    Count the number of unique courses in the provided JSON file.

    Args:
        json_file_path (str): Path to the JSON file containing application data

    Returns:
        int: Number of unique courses
        list: List of unique course codes with their names
    """
    # Read the JSON file
    with open(json_file_path, 'r') as file:
        data = json.load(file)

    # Extract all course codes and course names
    unique_courses = {}

    for app_id, app_info in data["Applications"].items():
        course_code = app_info.get("coursecode")
        course_name = app_info.get("coursename")

        if course_code:
            unique_courses[course_code] = course_name

    # Return count and list of unique courses
    unique_course_list = [{"code": code, "name": name} for code, name in unique_courses.items()]

    return len(unique_courses), unique_course_list

# Example usage
if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        file_path = sys.argv[1]
    else:
        file_path = "/home/user/Desktop/SEMESTER4/DASS/dass-spring-2025-project-team-39/code/New/backend/data/filtered_student_data.json"

    try:
        # Run the function
        count, courses = count_unique_courses(file_path)

        # Print results
        print(f"Number of unique courses: {count}")
        print("Unique courses:")
        for course in courses:
            print(f"  {course['code']}: {course['name']}")
    except FileNotFoundError:
        print(f"Error: File '{file_path}' not found")
    except json.JSONDecodeError:
        print(f"Error: '{file_path}' contains invalid JSON")
    except Exception as e:
        print(f"Error: {str(e)}")








