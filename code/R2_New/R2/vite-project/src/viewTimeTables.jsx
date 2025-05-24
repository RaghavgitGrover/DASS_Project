import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast, ToastContainer } from 'react-toastify';
import { Download, Eye, Trash2, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'react-toastify/dist/ReactToastify.css';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const fetchStudentData = async (version) => {
    try {
      const response = await fetch(`http://localhost:3000/api/timetable_version/${version}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch timetable version ${version}`);
      }
      
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error(`Error fetching timetable version ${version}:`, error);
      return null;
    }
  };

const ViewTimeTables = () => {
    const [timetables, setTimetables] = useState([]);
    const [selectedTimetable, setSelectedTimetable] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedSection, setExpandedSection] = useState(null);

    useEffect(() => {
        fetchAllTimetableDetails();
    }, []);

    const fetchAllTimetableDetails = async () => {
        setIsLoading(true);
        setTimetables([]);
        
        try {
            // Step 1: Fetch the list of timetables
            console.log("Fetching timetable list...");
            const listResponse = await fetch('http://localhost:3000/api/timetables');
            
            if (!listResponse.ok) {
                throw new Error('Failed to fetch timetable list');
            }
            
            let timetableList = await listResponse.json();
            console.log("Timetable list fetched:", timetableList);
            
            if (!timetableList || timetableList.length === 0) {
                console.log("No timetables found");
                setTimetables([]);
                setIsLoading(false);
                return;
            }

            // Step 2: Fetch details for each timetable
            const validTimetables = [];
            
            for (const timetable of timetableList) {
                if (!timetable.id) continue;
                
                try {
                    console.log(`Fetching details for timetable ${timetable.id}...`);
                    const detailsResponse = await fetch(`http://localhost:3000/api/timetable/${timetable.id}`);
                    
                    if (!detailsResponse.ok) {
                        console.warn(`Failed to fetch details for timetable ${timetable.id}`);
                        continue;
                    }
                    
                    const data = await detailsResponse.json();
                    
                    if (data && data.id) {
                        validTimetables.push(data);
                    }
                } catch (error) {
                    console.error(`Error fetching details for timetable ${timetable.id}:`, error);
                }
            }
            
            console.log(`Successfully fetched ${validTimetables.length} timetables`);
            setTimetables(validTimetables);
        } catch (error) {
            console.error('Error fetching timetables:', error);
            toast.error('Failed to load timetables. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadPDF = (timetable) => {
        try {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 10;

            // Title
            doc.setFontSize(16);
            doc.text(timetable.name || 'Timetable', pageWidth / 2, margin, { align: 'center' });
            doc.setFontSize(12);
            doc.text(`${timetable.data?.year || ''} - ${timetable.data?.semester || ''} - ${timetable.data?.examType === 'midsem' ? 'Mid Semester' : 'End Semester'}`, pageWidth / 2, margin + 7, { align: 'center' });
            doc.setFontSize(12);

            // Transform timetable data for the table
            const tableData = [];
            
            // Check what structure the timetable has and format accordingly
            if (timetable.data?.timetable?.timetable) {
                // New format with day/slot structure
                const tt = timetable.data.timetable.timetable;
                Object.keys(tt).sort().forEach(day => {
                    const dayRow = [day.replace('day', 'Day ')];
                    
                    // For each slot (up to 4)
                    for (let i = 0; i < 4; i++) {
                        const slot = tt[day].slots[i];
                        if (slot && slot.courses && slot.courses.length > 0) {
                            dayRow.push(
                                slot.courses.map(course => `${course.code}\n${course.name.substring(0, 25)}`).join('\n\n')
                            );
                        } else {
                            dayRow.push('-');
                        }
                    }
                    
                    tableData.push(dayRow);
                });
            } else if (timetable.data?.generatedTimetable) {
                // Legacy format with dates/slots
                Object.entries(timetable.data.generatedTimetable).forEach(([date, slots]) => {
                    const row = [date];
                    const slotKeys = Object.keys(slots).sort();
                    
                    for (let i = 0; i < 4; i++) {
                        const slotKey = slotKeys[i] || '';
                        const courses = slots[slotKey] || [];
                        if (courses.length > 0) {
                            row.push(
                                courses.map(course => `${course.code}\n${course.name.substring(0, 25)}`).join('\n\n')
                            );
                        } else {
                            row.push('-');
                        }
                    }
                    
                    tableData.push(row);
                });
            } else {
                // Fallback if no recognized structure
                tableData.push(['No data available', '-', '-', '-', '-']);
            }

            // Table formatting
            const dateColWidth = 20;
            const remainingWidth = pageWidth - margin * 2 - dateColWidth;
            const slotColWidth = remainingWidth / 4;

            autoTable(doc, {
                head: [['Day', 'Slot 1', 'Slot 2', 'Slot 3', 'Slot 4']],
                body: tableData,
                startY: margin + 15,
                margin: { left: margin, right: margin },
                columnStyles: {
                    0: { cellWidth: dateColWidth, fontStyle: 'bold' },
                    1: { cellWidth: slotColWidth },
                    2: { cellWidth: slotColWidth },
                    3: { cellWidth: slotColWidth },
                    4: { cellWidth: slotColWidth }
                },
                headStyles: { fillColor: [41, 41, 41] },
                styles: { fontSize: 8, cellPadding: 3 }
            });

            const fileName = `${timetable.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);
            toast.success("PDF downloaded successfully");
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Failed to generate PDF');
        }
    };

    const handleDownloadExcel = (timetable) => {
    try {
        let wsData = [];

        // Header row
        wsData.push(['Day/Date', 'Slot 1', 'Slot 2', 'Slot 3', 'Slot 4']);

        // Check the structure and format accordingly
        if (timetable.data?.timetable?.timetable) {
            // New format with day/slot structure
            const tt = timetable.data.timetable.timetable;
            Object.keys(tt).sort().forEach(day => {
                const dayRow = [day.replace('day', 'Day ')];

                for (let i = 0; i < 4; i++) {
                    const slot = tt[day].slots[i];
                    if (slot && slot.courses && slot.courses.length > 0) {
                        const cellContent = slot.courses.map(course => `${course.code} - ${course.name}`).join('\n');
                        dayRow.push(cellContent);
                    } else {
                        dayRow.push('');
                    }
                }

                wsData.push(dayRow);
            });
        } else if (timetable.data?.generatedTimetable) {
            // Legacy format
            Object.entries(timetable.data.generatedTimetable).forEach(([date, slots]) => {
                const row = [date];
                const slotKeys = Object.keys(slots).sort();

                for (let i = 0; i < 4; i++) {
                    const slotKey = slotKeys[i] || '';
                    const courses = slots[slotKey] || [];
                    if (courses.length > 0) {
                        const cellContent = courses.map(course => `${course.code} - ${course.name}`).join('\n');
                        row.push(cellContent);
                    } else {
                        row.push('');
                    }
                }

                wsData.push(row);
            });
        } else {
            // Fallback if no recognized structure
            wsData.push(['No data available', '', '', '', '']);
        }

        // Convert data to sheet
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Auto column widths
        const wscols = [
            { wch: 20 },
            { wch: 40 },
            { wch: 40 },
            { wch: 40 },
            { wch: 40 }
        ];
        ws['!cols'] = wscols;

        // Wrap text for all cells
        Object.keys(ws).forEach(cell => {
            if (cell[0] !== '!') {
                ws[cell].s = { alignment: { wrapText: true, vertical: 'top' } };
            }
        });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Timetable');

        const fileName = `${timetable.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);

        toast.success("Excel file downloaded successfully");
    } catch (error) {
        console.error('Error generating Excel:', error);
        toast.error('Failed to generate Excel file');
    }
};


    const handleDeleteTimetable = async (id) => {
        if (!window.confirm('Are you sure you want to delete this timetable?')) {
            return;
        }
        try {
            const response = await fetch(`http://localhost:3000/api/timetable/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                throw new Error('Failed to delete timetable');
            }
            toast.success('Timetable deleted successfully');
            setTimetables(prev => prev.filter(t => t.id !== id));
        } catch (error) {
            console.error('Error:', error);
            toast.error('Failed to delete timetable');
        }
    };
    
    // Filter timetables based on search query
    const filteredTimetables = timetables.filter(timetable => {
        const searchStr = searchQuery.toLowerCase();
        return (
            (timetable.name && timetable.name.toLowerCase().includes(searchStr)) ||
            (timetable.data?.year && timetable.data.year.toLowerCase().includes(searchStr)) ||
            (timetable.data?.semester && timetable.data.semester.toLowerCase().includes(searchStr)) ||
            (timetable.data?.examType && 
                (timetable.data.examType === 'midsem' ? 'mid semester' : 'end semester').includes(searchStr))
        );
    });

    const extractStudentData = (timetable) => {
        const twoConsecutiveStudents = [];
        const threeConsecutiveStudents = [];
        let twoConsecutiveCount = 0;
        let threeConsecutiveCount = 0;
        const studentExamMap = new Map();
      
        if (timetable.data?.stats?.details) {
          const details = timetable.data.stats.details;
      
          // Extract students with 2 consecutive exams
          if (details.twoConsecutive) {
            details.twoConsecutive.forEach(student => {
              twoConsecutiveStudents.push(student.rollNumber);
      
              // Add to studentExamMap if not already there
              if (!studentExamMap.has(student.rollNumber)) {
                studentExamMap.set(student.rollNumber, []);
              }
            });
            twoConsecutiveCount = twoConsecutiveStudents.length;
          }
      
          // Extract students with 3 consecutive exams
          if (details.threeConsecutive) {
            details.threeConsecutive.forEach(student => {
              threeConsecutiveStudents.push(student.rollNumber);
      
              // Add to studentExamMap if not already there
              if (!studentExamMap.has(student.rollNumber)) {
                studentExamMap.set(student.rollNumber, []);
              }
            });
            threeConsecutiveCount = threeConsecutiveStudents.length;
          }
        }
      
        // Next, extract all courses for each student by examining the timetable
        if (timetable.data?.timetable?.timetable) {
          const tt = timetable.data.timetable.timetable;
          
          // Get all courses for each roll number from twoConsecutive and threeConsecutive details
          const coursesForStudent = {};
          
          // First, collect all courses from consecutive exams data
          if (timetable.data?.stats?.details?.twoConsecutive) {
            timetable.data.stats.details.twoConsecutive.forEach(student => {
              if (!coursesForStudent[student.rollNumber]) {
                coursesForStudent[student.rollNumber] = new Set();
              }
              
              student.courses.forEach(courseSet => {
                courseSet.forEach(course => {
                  coursesForStudent[student.rollNumber].add(course.code);
                });
              });
            });
          }
          
          if (timetable.data?.stats?.details?.threeConsecutive) {
            timetable.data.stats.details.threeConsecutive.forEach(student => {
              if (!coursesForStudent[student.rollNumber]) {
                coursesForStudent[student.rollNumber] = new Set();
              }
              
              student.courses.forEach(courseSet => {
                courseSet.forEach(course => {
                  coursesForStudent[student.rollNumber].add(course.code);
                });
              });
            });
          }
          
          // Now use this information to find all occurrences of these courses in the timetable
          Object.entries(coursesForStudent).forEach(([rollNumber, courseSet]) => {
            const schedule = [];
            
            Object.entries(tt).forEach(([day, dayData]) => {
              dayData.slots.forEach((slot, slotIndex) => {
                if (slot && slot.courses) {
                  slot.courses.forEach(course => {
                    if (courseSet.has(course.code)) {
                      schedule.push({
                        day,
                        slot: `Slot ${slotIndex + 1}`,
                        courseCode: course.code,
                        courseName: course.name
                      });
                    }
                  });
                }
              });
            });
            
            if (schedule.length > 0) {
              studentExamMap.set(rollNumber, schedule);
            }
          });
        }
      
        // If we have students data directly from the timetable_v*_students.json file
        if (timetable.data?.students) {
          Object.entries(timetable.data.students).forEach(([rollNumber, data]) => {
            const schedule = [];
            
            if (data.examSchedule) {
              Object.entries(data.examSchedule).forEach(([day, slots]) => {
                Object.entries(slots).forEach(([slot, courses]) => {
                  if (courses && courses.length > 0) {
                    courses.forEach(course => {
                      schedule.push({
                        day,
                        slot,
                        courseCode: course.code,
                        courseName: course.name
                      });
                    });
                  }
                });
              });
            }
            
            if (schedule.length > 0) {
              studentExamMap.set(rollNumber, schedule);
            }
          });
        }
      
        return {
          twoConsecutiveStudents,
          threeConsecutiveStudents,
          twoConsecutiveCount,
          threeConsecutiveCount,
          studentExamMap
        };
      };

    const renderTimetable = (selectedTimetable) => {
        const isEndsem = selectedTimetable.data?.examType === "endsem";

        return (
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="border p-2 font-semibold">Date/Time</th>
                            {!isEndsem && <th className="border p-2 font-semibold">Slot 1</th>}
                            {!isEndsem && <th className="border p-2 font-semibold">Slot 2</th>}
                            {!isEndsem && <th className="border p-2 font-semibold">Slot 3</th>}
                            {!isEndsem && <th className="border p-2 font-semibold">Slot 4</th>}
                            {isEndsem && <th className="border p-2 font-semibold">Slot 1</th>}
                            {isEndsem && <th className="border p-2 font-semibold">Slot 2</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {(() => {
                            if (selectedTimetable.data?.timetable?.timetable) {
                                const tt = selectedTimetable.data.timetable.timetable;
                                return Object.keys(tt)
                                    .sort()
                                    .map((day) => (
                                        <tr key={day}>
                                            <td className="border p-2 font-medium">
                                                {day.replace("day", "Day ")}
                                            </td>
                                            {!isEndsem &&
                                                [0, 1, 2, 3].map((slotIndex) => {
                                                    const slot = tt[day].slots[slotIndex];
                                                    return (
                                                        <td key={slotIndex} className="border p-2">
                                                            {slot &&
                                                            slot.courses &&
                                                            slot.courses.length > 0 ? (
                                                                <div className="space-y-2">
                                                                    {slot.courses.map(
                                                                        (course, i) => (
                                                                            <div
                                                                                key={i}
                                                                                className="text-sm"
                                                                            >
                                                                                <div className="font-medium">
                                                                                    {course.code}
                                                                                </div>
                                                                                <div className="text-xs text-gray-600">
                                                                                    {course.name}
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="text-sm text-gray-500">
                                                                    -
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            {isEndsem &&
                                                [0, 1].map((slotIndex) => {
                                                    const slot = tt[day].slots[slotIndex];
                                                    return (
                                                        <td key={slotIndex} className="border p-2">
                                                            {slot &&
                                                            slot.courses &&
                                                            slot.courses.length > 0 ? (
                                                                <div className="space-y-2">
                                                                    {slot.courses.map(
                                                                        (course, i) => (
                                                                            <div
                                                                                key={i}
                                                                                className="text-sm"
                                                                            >
                                                                                <div className="font-medium">
                                                                                    {course.code}
                                                                                </div>
                                                                                <div className="text-xs text-gray-600">
                                                                                    {course.name}
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="text-sm text-gray-500">
                                                                    -
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                        </tr>
                                    ));
                            } else {
                                return (
                                    <tr>
                                        <td className="border p-2 font-medium">
                                            No data available
                                        </td>
                                        <td className="border p-2 text-sm text-gray-500">-</td>
                                        <td className="border p-2 text-sm text-gray-500">-</td>
                                        <td className="border p-2 text-sm text-gray-500">-</td>
                                        <td className="border p-2 text-sm text-gray-500">-</td>
                                    </tr>
                                );
                            }
                        })()}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderStudentStatistics = (selectedTimetable) => {
        const {
            twoConsecutiveStudents,
            threeConsecutiveStudents,
            twoConsecutiveCount,
            threeConsecutiveCount,
        } = extractStudentData(selectedTimetable);

        // Extract exam schedules for all students
        const studentExamSchedules = selectedTimetable.data?.stats?.details?.twoConsecutive || [];

        return (
            <div className="bg-white rounded-lg border p-4">
                <div
                    className="flex justify-between items-center mb-4 cursor-pointer"
                    onClick={() => toggleSection("students")}
                >
                    <h3 className="text-lg font-semibold">Student Statistics</h3>
                    <Button variant="ghost" size="sm">
                        {expandedSection === "students" ? "Hide" : "Show"}
                    </Button>
                </div>

                {expandedSection === "students" && (
                    <div>
                        {/* Display consecutive exam counts */}
                        <div className="mb-4">
                            <p className="text-sm text-gray-600">
                                Students with 2 consecutive exams:{" "}
                                <span className="font-bold">{twoConsecutiveCount}</span>
                            </p>
                            <p className="text-sm text-gray-600">
                                Students with 3 consecutive exams:{" "}
                                <span className="font-bold">{threeConsecutiveCount}</span>
                            </p>
                        </div>

                        {/* Display student table for consecutive exams */}
                        <div className="h-[400px] overflow-y-auto border rounded-lg mb-6">
                            <table className="w-full">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-sm font-medium">
                                            Roll Numbers (2 Consecutive Exams)
                                        </th>
                                        <th className="px-4 py-2 text-left text-sm font-medium">
                                            Roll Numbers (3 Consecutive Exams)
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Render rows for the maximum number of students in either category */}
                                    {Array.from(
                                        { length: Math.max(twoConsecutiveStudents.length, threeConsecutiveStudents.length) },
                                        (_, index) => (
                                            <tr key={index} className="hover:bg-gray-50 border-t">
                                                <td className="px-4 py-2 text-sm">
                                                    {twoConsecutiveStudents[index] || "-"}
                                                </td>
                                                <td className="px-4 py-2 text-sm">
                                                    {threeConsecutiveStudents[index] || "-"}
                                                </td>
                                            </tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Display student exam schedules */}
                        <div className="h-[400px] overflow-y-auto border rounded-lg">
                            <table className="w-full">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-sm font-medium">
                                            Roll Number
                                        </th>
                                        <th className="px-4 py-2 text-left text-sm font-medium">
                                            Exam Schedule
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {studentExamSchedules.length > 0 ? (
                                        studentExamSchedules.map((student, index) => (
                                            <tr key={index} className="hover:bg-gray-50 border-t">
                                                <td className="px-4 py-2 text-sm">
                                                    {student.rollNumber}
                                                </td>
                                                <td className="px-4 py-2 text-sm">
                                                    {student.courses.map((coursePair, i) => (
                                                        <div key={i} className="mb-2">
                                                            {coursePair.map((course, j) => (
                                                                <div key={j}>
                                                                    {course.code} - {course.name}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td
                                                colSpan={2}
                                                className="px-4 py-2 text-sm text-gray-500 text-center"
                                            >
                                                No exam schedules available
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const toggleSection = (section) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-[calc(100vh-4rem)] mt-16">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-lg">Loading timetables...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] mt-16 bg-gray-100 p-4">
            <ToastContainer position="top-right" autoClose={3000} />

            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold">Saved Timetables</h1>
                    {/* <div className="w-1/3">
                        <Input
                            type="text"
                            placeholder="Search timetables..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full"
                        />
                    </div> */}
                </div>

                {/* Timetable cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTimetables.length > 0 ? (
                        filteredTimetables.map((timetable) => (
                            <Card key={timetable.id} className="bg-white hover:shadow-md transition-shadow">
                                <CardContent className="p-6">
                                    <h2 className="text-xl font-semibold mb-2 truncate" title={timetable.name}>
                                        {timetable.name}
                                    </h2>
                                    <div className="space-y-2 text-sm text-gray-600">
                                        <p>Year: {timetable.data?.year || 'N/A'}</p>
                                        <p>Semester: {timetable.data?.semester || 'N/A'}</p>
                                        <p>Exam Type: {
                                            timetable.data?.examType === 'midsem' 
                                                ? 'Mid Semester' 
                                                : timetable.data?.examType === 'endsem'
                                                    ? 'End Semester'
                                                    : 'N/A'
                                        }</p>
                                        <p>Created: {new Date(timetable.createdAt).toLocaleDateString()}</p>
                                        
                                        {/* Calculate total courses from the timetable if available */}
                                        {(() => {
                                            let totalCourses = 0;
                                            let scheduledCourses = 0;
                                            
                                            if (timetable.data?.timetable?.timetable) {
                                                // New format
                                                const tt = timetable.data.timetable.timetable;
                                                const uniqueCourses = new Set();
                                                
                                                Object.values(tt).forEach(day => {
                                                    day.slots.forEach(slot => {
                                                        if (slot && slot.courses) {
                                                            slot.courses.forEach(course => {
                                                                uniqueCourses.add(course.code);
                                                            });
                                                        }
                                                    });
                                                });
                                                
                                                totalCourses = uniqueCourses.size;
                                                scheduledCourses = uniqueCourses.size;
                                            } else if (timetable.data?.stats) {
                                                // Legacy format
                                                totalCourses = timetable.data.stats.totalCourses || 0;
                                                scheduledCourses = timetable.data.stats.scheduledCourses || 0;
                                            }
                                            
                                            return (
                                                <>
                                                    <p>Total Courses: {totalCourses}</p>
                                                    <p>Scheduled Courses: {scheduledCourses}</p>
                                                </>
                                            );
                                        })()}
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-4">
                                        <Button
                                            onClick={() => setSelectedTimetable(timetable)}
                                            className="flex-1 bg-gray-900 text-white hover:bg-gray-700"
                                        >
                                            <Eye className="w-4 h-4 mr-2" />
                                            View Details
                                        </Button>
                                        <Button
                                            onClick={() => handleDownloadPDF(timetable)}
                                            className="flex-1 min-w-[120px]"
                                        >
                                            <Download className="w-4 h-4 mr-2" />
                                            PDF
                                        </Button>
                                        <Button
                                            onClick={() => handleDownloadExcel(timetable)}
                                            className="flex-1 min-w-[120px] bg-green-600 text-white hover:bg-green-500"
                                        >
                                            <Download className="w-4 h-4 mr-2" />
                                            Excel
                                        </Button>
                                        <Button
                                            onClick={() => handleDeleteTimetable(timetable.id)}
                                            className="flex-1 min-w-[120px] bg-red-600 text-white hover:bg-red-500"
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Delete
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <div className="col-span-3 text-center py-12">
                            <p className="text-gray-500">
                                {searchQuery 
                                    ? 'No timetables match your search criteria.' 
                                    : 'No timetables found. Generate a timetable first!'}
                            </p>
                            {searchQuery && (
                                <Button 
                                    className="mt-4" 
                                    variant="outline" 
                                    onClick={() => setSearchQuery('')}
                                >
                                    Clear Search
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Timetable Details Dialog */}
            <Dialog open={!!selectedTimetable} onOpenChange={(open) => !open && setSelectedTimetable(null)}>
                <DialogContent className="max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">{selectedTimetable?.name}</DialogTitle>
                    </DialogHeader>
                    {selectedTimetable && (
                        <div className="space-y-6">
                            {/* Timetable Info */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-sm text-gray-600">Total Courses</p>
                                    <p className="text-3xl font-bold">
                                        {(() => {
                                            let totalCourses = 0;
                                            
                                            if (selectedTimetable.data?.timetable?.timetable) {
                                                // New format
                                                const tt = selectedTimetable.data.timetable.timetable;
                                                const uniqueCourses = new Set();
                                                
                                                Object.values(tt).forEach(day => {
                                                    day.slots.forEach(slot => {
                                                        if (slot && slot.courses) {
                                                            slot.courses.forEach(course => {
                                                                uniqueCourses.add(course.code);
                                                            });
                                                        }
                                                    });
                                                });
                                                
                                                totalCourses = uniqueCourses.size;
                                            } else if (selectedTimetable.data?.stats) {
                                                // Legacy format
                                                totalCourses = selectedTimetable.data.stats.totalCourses || 0;
                                            }
                                            
                                            return totalCourses;
                                        })()}
                                    </p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-sm text-gray-600">Scheduled Courses</p>
                                    <p className="text-3xl font-bold text-green-700">
                                        {(() => {
                                            let scheduledCourses = 0;
                                            
                                            if (selectedTimetable.data?.timetable?.timetable) {
                                                // New format - same as total courses since all are scheduled
                                                const tt = selectedTimetable.data.timetable.timetable;
                                                const uniqueCourses = new Set();
                                                
                                                Object.values(tt).forEach(day => {
                                                    day.slots.forEach(slot => {
                                                        if (slot && slot.courses) {
                                                            slot.courses.forEach(course => {
                                                                uniqueCourses.add(course.code);
                                                            });
                                                        }
                                                    });
                                                });
                                                
                                                scheduledCourses = uniqueCourses.size;
                                            } else if (selectedTimetable.data?.stats) {
                                                // Legacy format
                                                scheduledCourses = selectedTimetable.data.stats.scheduledCourses || 0;
                                            }
                                            
                                            return scheduledCourses;
                                        })()}
                                    </p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-sm text-gray-600">Unscheduled Courses</p>
                                    <p className="text-3xl font-bold text-red-700">
                                        {(() => {
                                            let unscheduledCourses = 0;
                                            
                                            if (selectedTimetable.data?.timetable?.timetable) {
                                                // New format - all courses are scheduled
                                                unscheduledCourses = 0;
                                            } else if (selectedTimetable.data?.stats) {
                                                // Legacy format
                                                unscheduledCourses = selectedTimetable.data.stats.unscheduledCourses || 0;
                                            }
                                            
                                            return unscheduledCourses;
                                        })()}
                                    </p>
                                </div>
                            </div>

                            {/* Student Statistics Section */}
                            {renderStudentStatistics(selectedTimetable)}

                            {/* Timetable Grid */}
                            {renderTimetable(selectedTimetable)}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ViewTimeTables;