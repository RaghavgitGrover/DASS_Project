# Automated Examination Timetable Generator

## Overview
This project aims to automate the generation of optimized examination timetables, seating arrangement and invigilation duty roster for Mid-Semester and End-Semester exams for the Examination Cell of IIITH. The solution extracts necessary data from a database and applies Generic Algorithm to generate an efficient and conflict-free timetable.

## Features
- **Automated Timetable Generation**: Avoids conflicts, minimizes consecutive exam slots for students and evenly distributes exams.
- **Statistical Insights**: Provides analysis on exam scheduling efficiency.
- **Export Options**: Generates timetables in PDF and Excel format.

## Data Inputs
The system fetches data from the database, including:
- Course codes and enrolled students.

## Installation and Usage
1. Clone the repository:
   ```sh
   git clone <repo-url>
   cd <repo-folder>
   cd code
   ```
2. Backend Installation and running:
    ```sh
    cd backend
    npm install workerpool
    npm install quick-lru
    npm install bson
    node server.js
    ```
2. Frontend Installation and running:
   ```sh
   cd frontend
   npm install
   npm run dev
   ```

## Technologies Used
- **Algorithm Development**: Python
- **Database**: MySQL
- **Backend**: Javascript
- **Frontend**: React.js

## Contributors
- **Algorithm**: Raghav
- **Backend**: Ahana
- **Integration**: Keerthana
- **Frontend**: Ananya
- **Database**: Himani

## Future Enhancements
- Implement Exam Seating Arrangement generation.
- Implement Exam Invigilator Allocation
- Deployment into IIITH domain.
