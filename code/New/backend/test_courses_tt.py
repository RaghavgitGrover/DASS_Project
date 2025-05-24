import json

def count_total_courses(json_file_path):
    """
    Count the total number of courses in the timetable.

    Args:
        json_file_path (str): Path to the JSON file

    Returns:
        int: Total number of courses
    """
    try:
        # Read the JSON file
        with open(json_file_path, 'r') as file:
            data = json.load(file)

        # Initialize course count
        total_courses = 0

        # Navigate through the nested structure
        timetable = data.get('timetable', {})

        # Iterate through each day
        for day, day_info in timetable.items():
            # Get slots for the day
            slots = day_info.get('slots', [])

            # Iterate through each slot
            for slot in slots:
                # Count courses in the slot
                courses = slot.get('courses', [])
                total_courses += len(courses)

        return total_courses

    except FileNotFoundError:
        print(f"Error: File {json_file_path} not found.")
        return 0
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON format in {json_file_path}.")
        return 0
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return 0

# Specify the path to your JSON file
json_file_path = 'timetable_v3.json'

# Count and print the total number of courses
total_courses = count_total_courses(json_file_path)
print(f"Total number of courses: {total_courses}")