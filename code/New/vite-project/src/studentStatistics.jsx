import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from 'lucide-react';

const StudentStatistics = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [studentStats, setStudentStats] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredStats, setFilteredStats] = useState([]);

    useEffect(() => {
        if (location.state?.timetable) {
            generateStudentStats(location.state.timetable);
        } else {
            // If no data is passed, redirect back to timetable generation
            navigate('/generate');
        }
    }, [location.state, navigate]);

    const generateStudentStats = (timetable) => {
        const studentStats = new Map();

        // Process each day and slot to collect student exam schedules
        Object.entries(timetable).forEach(([date, slots]) => {
            Object.entries(slots).forEach(([slot, courses]) => {
                courses.forEach(course => {
                    course.students.forEach(rollNumber => {
                        if (!studentStats.has(rollNumber)) {
                            studentStats.set(rollNumber, {
                                rollNumber,
                                totalExams: 0,
                                multipleExamsPerDay: 0,
                                consecutiveExams: 0,
                                examSchedule: [],
                                examsByDay: new Map()
                            });
                        }

                        const studentStat = studentStats.get(rollNumber);
                        studentStat.totalExams++;
                        studentStat.examSchedule.push({
                            date,
                            slot,
                            courseCode: course.code
                        });

                        // Track exams by day for conflict detection
                        if (!studentStat.examsByDay.has(date)) {
                            studentStat.examsByDay.set(date, []);
                        }
                        studentStat.examsByDay.get(date).push({ slot, courseCode: course.code });
                    });
                });
            });
        });

        // Calculate conflicts for each student
        const studentStatsArray = Array.from(studentStats.values()).map(stats => {
            // Sort exam schedule by date and slot
            stats.examSchedule.sort((a, b) => {
                const dateCompare = new Date(a.date) - new Date(b.date);
                if (dateCompare === 0) {
                    return a.slot.localeCompare(b.slot);
                }
                return dateCompare;
            });

            // Calculate multiple exams per day
            for (const [, exams] of stats.examsByDay) {
                if (exams.length > 2) {
                    stats.multipleExamsPerDay += exams.length - 2;
                }
            }

            // Calculate consecutive exams
            for (const [, exams] of stats.examsByDay) {
                const sortedSlots = exams.sort((a, b) => a.slot.localeCompare(b.slot));
                for (let i = 0; i < sortedSlots.length - 1; i++) {
                    if (isConsecutiveSlots(sortedSlots[i].slot, sortedSlots[i + 1].slot)) {
                        stats.consecutiveExams++;
                    }
                }
            }

            // Remove temporary data structure
            delete stats.examsByDay;
            return stats;
        });

        setStudentStats(studentStatsArray);
        setFilteredStats(studentStatsArray);
    };

    const isConsecutiveSlots = (slot1, slot2) => {
        const slotTimes = [
            "8:30 AM - 10:00 AM",
            "11:00 AM - 12:30 PM",
            "2:00 PM - 3:30 PM",
            "4:30 PM - 6:00 PM"
        ];
        const index1 = slotTimes.indexOf(slot1);
        const index2 = slotTimes.indexOf(slot2);
        return index2 - index1 === 1;
    };

    useEffect(() => {
        const filtered = studentStats.filter(stat => 
            stat.rollNumber.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredStats(filtered);
    }, [searchTerm, studentStats]);

    return (
        <div className="flex flex-col gap-6 items-start min-h-[calc(100vh-4rem)] mt-16 bg-gray-100 p-4">
            <Card className="w-full max-w-6xl mx-auto bg-white">
                <CardContent className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <Button
                            onClick={() => navigate(-1)}
                            className="flex items-center gap-2 bg-gray-900 text-white hover:bg-gray-700"
                        >
                            <ArrowLeft size={16} />
                            Back to Timetable
                        </Button>
                        <h2 className="text-2xl font-bold">Student-wise Statistics</h2>
                    </div>

                    <div className="mb-6">
                        <Input
                            type="text"
                            placeholder="Search by Roll Number..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-md"
                        />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Roll Number</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Total Exams</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Multiple Exams/Day</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Consecutive Exams</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Exam Schedule</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredStats.map((student) => (
                                    <tr key={student.rollNumber} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                            {student.rollNumber}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            {student.totalExams}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            {student.multipleExamsPerDay}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            {student.consecutiveExams}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            <div className="space-y-1">
                                                {student.examSchedule.map((exam, index) => (
                                                    <div key={index}>
                                                        {`${exam.date} - ${exam.slot}: ${exam.courseCode}`}
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default StudentStatistics; 