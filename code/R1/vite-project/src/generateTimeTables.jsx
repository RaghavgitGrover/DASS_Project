import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast, ToastContainer } from 'react-toastify';
import { Checkbox } from "@/components/ui/checkbox";
import { MultiDatePicker } from "@/components/ui/date-picker";
import 'react-toastify/dist/ReactToastify.css';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts';
import { Download, Loader2, Users, X, AlertTriangle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import PropTypes from 'prop-types';

const GenerateTimeTables = () => {
    const [formData, setFormData] = useState({
        year: '2023-24',
        semester: 'Spring',
        examType: 'midsem'
    });

    // Add bandwidth detection states
    const [connectionSpeed, setConnectionSpeed] = useState(null);
    const [lowBandwidthMode, setLowBandwidthMode] = useState(false);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    // Add bandwidth detection function
    const checkConnectionSpeed = useCallback(() => {
        const connection = navigator.connection ||
            navigator.mozConnection ||
            navigator.webkitConnection;

        if (connection) {
            const speedMbps = connection.downlink;
            setConnectionSpeed(speedMbps);

            if (speedMbps < 0.5) {
                setLowBandwidthMode(true);
                toast.warn(`Slow connection detected (${speedMbps.toFixed(1)} Mbps). Switching to low bandwidth mode.`);
            } else {
                setLowBandwidthMode(false);
            }
        }
    }, []);

    // Add online/offline detection
    const handleOnlineStatus = useCallback(() => {
        const isOnline = navigator.onLine;
        setIsOffline(!isOnline);
        if (!isOnline) {
            toast.error('You are offline. Some features may be limited.');
        } else {
            toast.success('Back online!');
            checkConnectionSpeed();
        }
    }, [checkConnectionSpeed]);

    // Monitor connection changes
    useEffect(() => {
        checkConnectionSpeed();

        const connection = navigator.connection;
        if (connection) {
            connection.addEventListener('change', checkConnectionSpeed);
        }

        window.addEventListener('online', handleOnlineStatus);
        window.addEventListener('offline', handleOnlineStatus);

        return () => {
            if (connection) {
                connection.removeEventListener('change', checkConnectionSpeed);
            }
            window.removeEventListener('online', handleOnlineStatus);
            window.removeEventListener('offline', handleOnlineStatus);
        };
    }, [checkConnectionSpeed, handleOnlineStatus]);

    const [isLoading, setIsLoading] = useState(false);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [courses, setCourses] = useState([]);
    const [selectedCourses, setSelectedCourses] = useState([]);
    const [examConfig, setExamConfig] = useState({
        dates: [],
        slotsPerDay: 4
    });
    const [generatedTimetables, setGeneratedTimetables] = useState(null);
    const [generatedTimetable, setGeneratedTimetable] = useState(null);
    const [stats, setStats] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showStudentStats, setShowStudentStats] = useState(false);
    const [studentStats, setStudentStats] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredStats, setFilteredStats] = useState([]);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [timetableName, setTimetableName] = useState('');
    const [showTimetableSelection, setShowTimetableSelection] = useState(false);
    const [selectedTimetable, setSelectedTimetable] = useState(null);
    const [currentTimetableIndex, setCurrentTimetableIndex] = useState(0);
    const [showUnscheduledCourses, setShowUnscheduledCourses] = useState(false);
    const [defaultTimetableName, setDefaultTimetableName] = useState('');
    const [showConflicts, setShowConflicts] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    // const [conflicts, setConflicts] = useState({
    //     totalConflicts: 0,
    //     multipleExamsPerDay: 0,
    //     consecutiveExams: 0,
    //     studentConflicts: {}
    // });

    // Define calculateConflicts before it's used
    const calculateConflicts = useCallback((timetable) => {
        if (!timetable) {
            return {
                studentStats: {},
                conflicts: {
                    totalConflicts: 0,
                    multipleExamsPerDay: 0,
                    consecutiveExams: 0,
                    studentConflicts: {}
                }
            };
        }

        const studentStats = {};
        const conflicts = {
            totalConflicts: 0,
            multipleExamsPerDay: 0,
            consecutiveExams: 0,
            studentConflicts: {}
        };

        // First pass: collect all student exam schedules
        Object.entries(timetable).forEach(([date, slots]) => {
            if (!slots) return;

            Object.entries(slots).forEach(([slot, courses]) => {
                if (!Array.isArray(courses)) {
                    console.warn(`Invalid courses data for date ${date}, slot ${slot}`);
                    return;
                }

                courses.forEach(course => {
                    if (!Array.isArray(course?.students)) {
                        console.warn(`Invalid students data for course ${course?.code}`);
                        return;
                    }

                    course.students.forEach(rollNumber => {
                        if (!studentStats[rollNumber]) {
                            studentStats[rollNumber] = {
                                rollNumber,
                                totalExams: 0,
                                examSchedule: [],
                                daysWithMultipleExams: 0,
                                consecutiveExams: 0
                            };
                        }
                        studentStats[rollNumber].totalExams++;
                        studentStats[rollNumber].examSchedule.push({
                            date,
                            slot,
                            courseCode: course.code
                        });
                    });
                });
            });
        });

        // Second pass: calculate conflicts
        Object.values(studentStats).forEach(stats => {
            // Group exams by date
            const examsByDate = {};
            stats.examSchedule.forEach(exam => {
                if (!examsByDate[exam.date]) {
                    examsByDate[exam.date] = [];
                }
                examsByDate[exam.date].push(exam);
            });

            // Calculate multiple exams per day
            Object.values(examsByDate).forEach(exams => {
                if (exams.length > 1) {
                    stats.daysWithMultipleExams++;
                    conflicts.multipleExamsPerDay++;
                }
            });

            // Calculate consecutive exams
            const sortedExams = [...stats.examSchedule].sort((a, b) => {
                const dateCompare = new Date(a.date) - new Date(b.date);
                if (dateCompare !== 0) return dateCompare;
                return parseInt(a.slot) - parseInt(b.slot);
            });

            for (let i = 1; i < sortedExams.length; i++) {
                const prevExam = sortedExams[i - 1];
                const currExam = sortedExams[i];

                if (prevExam.date === currExam.date && isConsecutiveSlots(prevExam.slot, currExam.slot)) {
                    stats.consecutiveExams++;
                    conflicts.consecutiveExams++;
                }
            }

            // Add to studentConflicts if there are any conflicts
            if (stats.daysWithMultipleExams > 0 || stats.consecutiveExams > 0) {
                conflicts.studentConflicts[stats.rollNumber] = {
                    multipleExamsDays: stats.daysWithMultipleExams,
                    consecutiveExams: stats.consecutiveExams
                };
            }
        });

        conflicts.totalConflicts = conflicts.multipleExamsPerDay + conflicts.consecutiveExams;
        return { studentStats, conflicts };
    }, []);

    // Load saved state from localStorage only once on component mount
    useEffect(() => {
        const savedState = localStorage.getItem('timetableState');
        if (savedState) {
            const state = JSON.parse(savedState);
            setFormData(state.formData || formData);
            setIsDataLoaded(state.isDataLoaded || false);
            setCourses(state.courses || []);
            setSelectedCourses(state.selectedCourses || []);
            setExamConfig(state.examConfig || examConfig);
            setGeneratedTimetables(state.generatedTimetables || null);
            setStats(state.stats || null);
            setSelectedTimetable(state.selectedTimetable || null);
            setGeneratedTimetable(state.selectedTimetable?.timetable || null);
        }
    }, []); // Empty dependency array means this runs only once on mount

    // Save state to localStorage whenever it changes, but only if we have data
    useEffect(() => {
        if (isDataLoaded || generatedTimetables) {
            const state = {
                formData,
                isDataLoaded,
                courses,
                selectedCourses,
                examConfig,
                generatedTimetables,
                stats,
                selectedTimetable
            };
            localStorage.setItem('timetableState', JSON.stringify(state));
        }
    }, [formData, isDataLoaded, courses, selectedCourses, examConfig, generatedTimetables, stats, selectedTimetable]);

    useEffect(() => {
        if (saveDialogOpen) {
            const currentDate = new Date();
            const formattedDate = currentDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            const defaultName = `Timetable - ${formattedDate}`;
            setDefaultTimetableName(defaultName);

            // If there's no user-entered name yet, set it to the default
            if (!timetableName) {
                setTimetableName(defaultName);
            }
        }
    }, [saveDialogOpen]);

    // Add fetch with retry and compression
    const fetchWithRetry = async (url, options = {}, retries = 3, backoff = 300) => {
        try {
            // Add compression headers
            const headers = {
                ...options.headers,
                'Accept-Encoding': 'gzip, deflate',
            };

            const response = await fetch(url, { ...options, headers });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return response;
        } catch (err) {
            if (retries <= 0) throw err;

            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
    };

    const fetchCourseNames = async () => {
        try {
            const response = await fetchWithRetry('http://localhost:3000/api/coursesNames');
            if (!response.ok) {
                const error = await response.json();
                if (response.status === 404) {
                    setIsDataLoaded(false);
                    toast.error("Please fetch courses data first");
                    return;
                }
                throw new Error(error.message);
            }
            const data = await response.json();
            setCourses(data.courses);
        } catch (error) {
            console.error('Error:', error);
            toast.error(error.message || 'Failed to fetch course names');
            setIsDataLoaded(false);
        }
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        try {
            const fetchResponse = await fetchWithRetry('http://localhost:3000/api/fetchCoursesData', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    year: formData.year,
                    semester: formData.semester
                })
            });

            if (!fetchResponse.ok) {
                throw new Error('Failed to fetch courses data');
            }

            const coursesData = await fetchResponse.json();

            const storeResponse = await fetchWithRetry('http://localhost:3000/api/storeCoursesData', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    metadata: {
                        year: formData.year,
                        semester: formData.semester,
                        examType: formData.examType
                    },
                    coursesData
                })
            });

            if (!storeResponse.ok) {
                throw new Error('Failed to store courses data');
            }

            // Fetch course names after successfully storing the data
            await fetchCourseNames();
            toast.success('Courses data loaded successfully!');
            setIsDataLoaded(true);
        } catch (error) {
            console.error('Error:', error);
            if (error.message === "Failed to fetch") toast.error('Failed to fetch courses data. Check your internet connection');
            else toast.error(error.message || 'Failed to load courses data');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCourseSelection = (courseCode) => {
        setSelectedCourses(prev =>
            prev.includes(courseCode)
                ? prev.filter(c => c !== courseCode)
                : [...prev, courseCode]
        );
    };

    const handleGenerateTimeTable = async () => {
        if (selectedCourses.length === 0) {
            toast.error("Please select at least one course");
            return;
        }

        if (examConfig.dates.length === 0) {
            toast.error("Please select exam dates");
            return;
        }

        setIsGenerating(true);
        try {
            // Ensure dates are properly converted to Date objects before sorting
            const sortedDates = examConfig.dates
                .map(date => new Date(date))
                .sort((a, b) => a - b)
                .map(date => date.toISOString().split('T')[0]);

            const params = new URLSearchParams({
                selectedCourses: JSON.stringify(selectedCourses),
                examConfig: JSON.stringify({
                    dates: sortedDates,
                    slots: examConfig.slotsPerDay
                })
            });

            // Use the new fetch with retry
            const response = await fetchWithRetry(`http://localhost:3000/api/fetchTimeTable?${params}`);
            const data = await response.json();

            if (data.timetables) {
                // Calculate conflicts and student stats for each timetable
                const timetablesWithStats = data.timetables.map(timetable => {
                    const studentStats = generateStudentStats(timetable.timetable);
                    return {
                        ...timetable,
                        stats: {
                            ...timetable.stats,
                            studentStats
                        }
                    };
                });

                // Cache the generated timetables
                try {
                    const serializedData = JSON.stringify(timetablesWithStats);
                    localStorage.setItem('cached-timetables', serializedData);
                    localStorage.setItem('cached-timetables-timestamp', new Date().toISOString());
                } catch (e) {
                    console.warn('Failed to cache timetables:', e);
                }

                toast.success('Timetables generated successfully!');
                setGeneratedTimetables(timetablesWithStats);
                setShowTimetableSelection(true);
            } else {
                toast.error('Invalid response format from server');
            }
        } catch (error) {
            console.error('Error:', error);

            // Try to load from cache if available
            if (isOffline) {
                try {
                    const cachedData = localStorage.getItem('cached-timetables');
                    const timestamp = localStorage.getItem('cached-timetables-timestamp');

                    if (cachedData && timestamp) {
                        const timetables = JSON.parse(cachedData);
                        toast.info(`Loaded cached timetables from ${new Date(timestamp).toLocaleString()}`);
                        setGeneratedTimetables(timetables);
                        setShowTimetableSelection(true);
                        return;
                    }
                } catch (e) {
                    console.error('Failed to load from cache:', e);
                }
            }

            toast.error(error.message || 'Failed to generate timetables');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleTimetableSelection = useCallback((timetable) => {
        const { studentStats, conflicts } = calculateConflicts(timetable.timetable);

        // Calculate slot utilization with proper data structure for the chart
        const slotUtilization = [];

        // Sort dates to ensure consistent order
        const sortedDates = Object.keys(timetable.timetable).sort((a, b) => new Date(a) - new Date(b));

        // Process each date
        sortedDates.forEach(date => {
            const slots = timetable.timetable[date];
            const dayData = { day: date };

            // Initialize all slots with 0
            for (let i = 1; i <= examConfig.slotsPerDay; i++) {
                dayData[`Slot ${i}`] = 0;
            }

            // Count courses in each slot
            if (slots) {
                // Log the actual slot keys to debug
                // console.log(`Slot keys for ${date}:`, Object.keys(slots));

                Object.entries(slots).forEach(([slotKey, courses]) => {
                    // Try different patterns to match slot numbers
                    // First try the expected "Slot N" format
                    let slotMatch = slotKey.match(/Slot (\d+)/i);

                    // If that doesn't work, try just extracting any number
                    if (!slotMatch) {
                        slotMatch = slotKey.match(/(\d+)/);
                    }

                    // If we found a match and have courses
                    if (slotMatch && Array.isArray(courses)) {
                        const slotNum = parseInt(slotMatch[1]);
                        if (!isNaN(slotNum) && slotNum <= examConfig.slotsPerDay) {
                            dayData[`Slot ${slotNum}`] = courses.length;
                            // console.log(`Found ${courses.length} courses in ${date} - Slot ${slotNum}`);
                        }
                    } else if (Array.isArray(courses) && courses.length > 0) {
                        // Fallback: try to determine slot from the index if the key doesn't match
                        const slotKeys = Object.keys(slots);
                        const index = slotKeys.indexOf(slotKey);
                        if (index >= 0 && index < examConfig.slotsPerDay) {
                            dayData[`Slot ${index + 1}`] = courses.length;
                            console.log(`Fallback: Found ${courses.length} courses in ${date} - Slot ${index + 1}`);
                        }
                    }
                });
            }

            slotUtilization.push(dayData);
        });

        // console.log('Generated slot utilization:', slotUtilization);

        // Calculate total scheduled courses
        const scheduledCourses = Object.values(timetable.timetable).reduce((acc, slots) =>
            acc + Object.values(slots).reduce((slotAcc, courses) =>
                slotAcc + (Array.isArray(courses) ? courses.length : 0), 0), 0
        );

        // If slot utilization shows all zeros but we have scheduled courses,
        // use a different approach to allocate courses to slots
        const totalCoursesInUtilization = slotUtilization.reduce((total, day) => {
            return total + Object.entries(day)
                .filter(([key]) => key !== 'day')
                .reduce((dayTotal, [, count]) => dayTotal + count, 0);
        }, 0);

        if (totalCoursesInUtilization === 0 && scheduledCourses > 0) {
            // console.log('No courses found in slot utilization, trying alternative approach');

            // Alternative approach: distribute courses equally across slots and days
            const daysCount = slotUtilization.length;
            const coursesPerDay = Math.ceil(scheduledCourses / daysCount);

            slotUtilization.forEach((day, dayIndex) => {
                const remainingCourses = scheduledCourses - (dayIndex * coursesPerDay);
                const coursesThisDay = Math.min(coursesPerDay, remainingCourses);
                const coursesPerSlot = Math.ceil(coursesThisDay / examConfig.slotsPerDay);

                for (let i = 1; i <= examConfig.slotsPerDay; i++) {
                    if ((i - 1) * coursesPerSlot < coursesThisDay) {
                        const slotCourses = Math.min(coursesPerSlot, coursesThisDay - (i - 1) * coursesPerSlot);
                        day[`Slot ${i}`] = slotCourses;
                    }
                }
            });

            // console.log('Generated alternative slot utilization:', slotUtilization);
        }

        const updatedStats = {
            studentStats,
            conflicts,
            slotUtilization,
            numSlots: examConfig.slotsPerDay,
            totalCourses: selectedCourses.length,
            scheduledCourses,
            unscheduledCourses: selectedCourses.length - scheduledCourses
        };

        // console.log('Updated stats:', updatedStats);

        const updatedTimetable = {
            ...timetable,
            stats: updatedStats
        };

        setSelectedTimetable(updatedTimetable);
        setGeneratedTimetable(updatedTimetable.timetable);
        setStats(updatedStats);
        setShowTimetableSelection(false);
        toast.success('Timetable selected successfully!');
    }, [calculateConflicts, examConfig.slotsPerDay, selectedCourses]);

    const handleDownloadPDF = () => {
        if (generatedTimetable && stats) {
            generatePDF(generatedTimetable, stats);
        }
    };

    const handleViewStudentStats = () => {
        if (selectedTimetable && selectedTimetable.stats && selectedTimetable.stats.studentStats) {
            const statsArray = Object.values(selectedTimetable.stats.studentStats);
            setStudentStats(statsArray);
            setFilteredStats(statsArray);
            setShowStudentStats(true);
        }
    };

    const handleViewConflicts = () => {
        if (selectedTimetable) {
            const conflicts = {
                totalConflicts: 0,
                multipleExamsPerDay: 0,
                consecutiveExams: 0,
                studentConflicts: {}
            };

            // Calculate conflicts from student stats
            Object.entries(selectedTimetable.stats.studentStats || {}).forEach(([rollNumber, stats]) => {
                if (stats.daysWithMultipleExams > 0) {
                    conflicts.multipleExamsPerDay += stats.daysWithMultipleExams;
                }
                if (stats.consecutiveExams > 0) {
                    conflicts.consecutiveExams += stats.consecutiveExams;
                }
                if (stats.daysWithMultipleExams > 0 || stats.consecutiveExams > 0) {
                    conflicts.studentConflicts[rollNumber] = {
                        multipleExamsDays: stats.daysWithMultipleExams || 0,
                        consecutiveExams: stats.consecutiveExams || 0
                    };
                }
            });

            conflicts.totalConflicts = conflicts.multipleExamsPerDay + conflicts.consecutiveExams;
            setShowConflicts(true);
        }
        setShowConflicts(true);
    };

    const getFilteredConflicts = () => {
        if (!selectedTimetable) return {};
        const studentConflicts = selectedTimetable.stats.conflicts.studentConflicts || {};

        if (!searchQuery.trim()) return studentConflicts;

        return Object.entries(studentConflicts)
            .filter(([rollNumber]) =>
                rollNumber.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .reduce((acc, [rollNumber, stats]) => {
                acc[rollNumber] = stats;
                return acc;
            }, {});
    };

    const isConsecutiveSlots = (slot1, slot2) => {
        // Convert slot numbers to indices
        const slotIndex1 = parseInt(slot1);
        const slotIndex2 = parseInt(slot2);
        return Math.abs(slotIndex2 - slotIndex1) === 1;
    };

    const generateStudentStats = (timetable) => {
        const studentStats = {};

        // Process each day and slot to collect student exam schedules
        Object.entries(timetable).forEach(([date, slots]) => {
            Object.entries(slots).forEach(([slot, courses]) => {
                // Ensure courses is an array
                if (!Array.isArray(courses)) {
                    console.warn(`Invalid courses data for date ${date}, slot ${slot}`);
                    return;
                }

                courses.forEach(course => {
                    // Ensure course.students is an array
                    if (!Array.isArray(course?.students)) {
                        console.warn(`Invalid students data for course ${course?.code}`);
                        return;
                    }

                    course.students.forEach(rollNumber => {
                        if (!studentStats[rollNumber]) {
                            studentStats[rollNumber] = {
                                rollNumber,
                                totalExams: 0,
                                examSchedule: []
                            };
                        }

                        studentStats[rollNumber].totalExams++;
                        studentStats[rollNumber].examSchedule.push({
                            date,
                            slot,
                            courseCode: course.code
                        });
                    });
                });
            });
        });

        return studentStats;
    };

    useEffect(() => {
        const filtered = studentStats.filter(stat =>
            stat.rollNumber.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredStats(filtered);
    }, [searchTerm, studentStats]);

    const moveCourse = useCallback((course, newDate, newSlotTime) => {
        setSelectedTimetable((prevTimetable) => {
            const updatedTimetable = { ...prevTimetable.timetable };

            // Remove course from the previous slot
            const oldDate = course.date;
            const oldSlotTime = course.slotTime;
            updatedTimetable[oldDate][oldSlotTime] = updatedTimetable[oldDate][oldSlotTime].filter(
                (c) => c.code !== course.course.code
            );

            // Add course to the new slot
            if (!updatedTimetable[newDate]) {
                updatedTimetable[newDate] = {};
            }
            if (!updatedTimetable[newDate][newSlotTime]) {
                updatedTimetable[newDate][newSlotTime] = [];
            }
            updatedTimetable[newDate][newSlotTime].push(course.course);

            const { studentStats, conflicts } = calculateConflicts(updatedTimetable);

            return {
                ...prevTimetable,
                timetable: updatedTimetable,
                stats: {
                    ...prevTimetable.stats,
                    studentStats,
                    conflicts
                }
            };
        });
    }, [calculateConflicts]);

    const CourseItem = ({ course, date, slotTime }) => {
        const [{ isDragging }, drag] = useDrag(() => ({
            type: "COURSE",
            item: { course, date, slotTime },
            collect: (monitor) => ({
                isDragging: !!monitor.isDragging(),
            }),
        }));

        return (
            <span
                ref={drag}
                style={{
                    opacity: isDragging ? 0.5 : 1,
                    cursor: "move",
                    display: "block",
                    backgroundColor: "#f3f4f6",
                    margin: "2px",
                    borderRadius: "4px",
                }}
            >
                {course.code} - {course.name}
            </span>
        );
    };

    CourseItem.propTypes = {
        course: PropTypes.shape({
            code: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired
        }).isRequired,
        date: PropTypes.string.isRequired,
        slotTime: PropTypes.string.isRequired
    };

    const SlotCell = ({ date, slotTime, courses, moveCourse }) => {
        const [{ isOver }, drop] = useDrop(() => ({
            accept: "COURSE",
            drop: (item) => moveCourse(item, date, slotTime),
            collect: (monitor) => ({
                isOver: !!monitor.isOver(),
            }),
        }));

        return (
            <td ref={drop} className={`p-3 border border-gray-300 ${isOver ? "bg-gray-200" : ""}`}>
                {courses.map((course) => (
                    <CourseItem key={course.code} course={course} date={date} slotTime={slotTime} />
                ))}
            </td>
        );
    };

    SlotCell.propTypes = {
        date: PropTypes.string.isRequired,
        slotTime: PropTypes.string.isRequired,
        courses: PropTypes.arrayOf(PropTypes.shape({
            code: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired
        })).isRequired,
        moveCourse: PropTypes.func.isRequired
    };

    const renderTimetableContent = (timetable, moveCourse) => {
        if (!timetable) return <p>No timetable selected.</p>;

        const slotLabels = Array.from({ length: examConfig.slotsPerDay }, (_, i) => `Slot ${i + 1}`);

        // Add simplified view for low bandwidth mode
        if (lowBandwidthMode) {
            return (
                <div className="space-y-4">
                    <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                        <p className="text-yellow-700">
                            Low bandwidth mode active ({connectionSpeed?.toFixed(1) || 'Unknown'} Mbps).
                            Showing simplified view.
                        </p>
                    </div>
                    <table className="w-full border-collapse border border-gray-300">
                        <thead>
                            <tr>
                                <th className="p-3 border border-gray-300">Date/Time</th>
                                {slotLabels.map((slot, index) => (
                                    <th key={index} className="p-3 border border-gray-300">{slot}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(timetable).map(([date, slots]) => (
                                <tr key={date}>
                                    <td className="p-3 border border-gray-300">{date}</td>
                                    {slotLabels.map((label, index) => {
                                        const slotTime = Object.keys(slots)[index];
                                        const courses = slots[slotTime] || [];
                                        return (
                                            <td key={index} className="p-3 border border-gray-300">
                                                {courses.length > 0 ? `${courses.length} courses` : '-'}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="text-center mt-4">
                        <Button
                            onClick={() => setLowBandwidthMode(false)}
                            variant="outline"
                            className="text-blue-600 hover:bg-blue-50"
                        >
                            Switch to Full View
                        </Button>
                    </div>
                </div>
            );
        }

        // Original full view with DnD functionality
        return (
            <DndProvider backend={HTML5Backend}>
                <table className="w-full border-collapse border border-gray-300">
                    <thead>
                        <tr>
                            <th className="p-3 border border-gray-300">Date/Time</th>
                            {slotLabels.map((slot, index) => (
                                <th key={index} className="p-3 border border-gray-300">{slot}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(timetable).map(([date, slots]) => (
                            <tr key={date}>
                                <td className="p-3 border border-gray-300">{date}</td>
                                {slotLabels.map((label, index) => (
                                    <SlotCell
                                        key={`${date}-${index}`}
                                        date={date}
                                        slotTime={Object.keys(slots)[index] || `Slot ${index + 1}`}
                                        courses={slots[Object.keys(slots)[index]] || []}
                                        moveCourse={moveCourse}
                                    />
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!lowBandwidthMode && connectionSpeed && connectionSpeed < 2 && (
                    <div className="mt-4 text-center">
                        <Button
                            onClick={() => setLowBandwidthMode(true)}
                            variant="outline"
                            className="text-yellow-600 hover:bg-yellow-50"
                        >
                            Switch to Simple View
                        </Button>
                    </div>
                )}
            </DndProvider>
        );
    };

    const generatePDF = (timetable, stats) => {
        try {
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            // Set font sizes
            const titleSize = 14;
            const contentSize = 10;

            // Calculate dimensions
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 10;

            // Add title (center aligned)
            doc.setFontSize(titleSize);
            doc.text('International Institute of Information Technology Hyderabad', pageWidth / 2, margin + 10, { align: 'center' });

            // Add subtitle (center aligned)
            const semester = stats.semester || '';
            const year = stats.year || '';
            const examType = (stats.examType === 'midsem' ? 'Mid' : 'End');
            doc.text(`${semester} ${year} ${examType} Semester Examinations Timetable`, pageWidth / 2, margin + 20, { align: 'center' });

            // Create dynamic slot labels
            const slotLabels = Array.from({ length: examConfig.slotsPerDay }, (_, i) => `Slot ${i + 1}`);
            const headers = ['Date/\nTime', ...slotLabels];

            // Create table data
            const tableData = Object.entries(timetable).map(([date, slots]) => {
                // Handle date format
                let formattedDate = date;
                if (date.includes(' ')) {
                    const [dayDate, dayName] = date.split(' ');
                    formattedDate = `${dayDate}\n${dayName}`;
                }

                const slotTimes = Object.keys(slots);
                const row = [formattedDate];

                // For each slot in the day
                for (let i = 0; i < examConfig.slotsPerDay; i++) {
                    const slotTime = slotTimes[i];
                    const courses = slots[slotTime] || [];
                    row.push(
                        courses.map(course => `${course.code} - ${course.name}`).join('\n')
                    );
                }
                return row;
            });

            // Calculate column widths based on number of slots
            const dateColWidth = 25;
            const remainingWidth = pageWidth - margin * 2 - dateColWidth;
            const slotColWidth = remainingWidth / examConfig.slotsPerDay;

            // Configure and generate table
            autoTable(doc, {
                startY: margin + 30,
                head: [headers],
                body: tableData,
                theme: 'grid',
                headStyles: {
                    fillColor: [255, 255, 255],
                    textColor: [0, 0, 0],
                    fontStyle: 'bold',
                    fontSize: 10,
                    cellPadding: 3,
                    halign: 'center',
                    valign: 'middle',
                    lineWidth: 0.5
                },
                styles: {
                    fontSize: 8,
                    cellPadding: 3,
                    halign: 'left',
                    valign: 'middle',
                    lineWidth: 0.5,
                    textColor: [0, 0, 0],
                    minCellHeight: 20,
                    overflow: 'linebreak'
                },
                columnStyles: {
                    0: {
                        cellWidth: dateColWidth,
                        fontStyle: 'bold',
                        halign: 'center'
                    }
                },
                didParseCell: function (data) {
                    if (data.column.index > 0) {
                        data.cell.styles.cellWidth = slotColWidth;
                    }
                }
            });

            // Add date at bottom
            doc.setFontSize(contentSize);
            doc.setTextColor(0, 0, 0);
            doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, doc.internal.pageSize.getHeight() - margin);

            // Add signature
            doc.text('Sd/-', pageWidth - margin - 20, doc.internal.pageSize.getHeight() - margin - 15);
            doc.text('Prof. Kishore Kothapalli', pageWidth - margin - 45, doc.internal.pageSize.getHeight() - margin - 10);
            doc.text('Controller of Examinations', pageWidth - margin - 45, doc.internal.pageSize.getHeight() - margin - 5);

            // Save the PDF
            const safeSemester = semester ? semester.toLowerCase() : 'semester';
            const safeExamType = examType ? examType.toLowerCase() : 'exam';
            doc.save(`timetable_${safeSemester}_${safeExamType}.pdf`);
            toast.success('PDF downloaded successfully!');
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Failed to generate PDF');
        }
    };

    const handleReset = () => {
        localStorage.removeItem('timetableState');
        setFormData({
            year: '2023-24',
            semester: 'Spring',
            examType: 'midsem'
        });
        setIsDataLoaded(false);
        setCourses([]);
        setSelectedCourses([]);
        setExamConfig({
            dates: [],
            slotsPerDay: 4
        });
        setGeneratedTimetables(null);
        setGeneratedTimetable(null);
        setSelectedTimetable(null);
        setStats(null);
        setShowTimetableSelection(false);
        setCurrentTimetableIndex(0);
        setStudentStats([]);
        setFilteredStats([]);
        setShowStudentStats(false);
        setShowUnscheduledCourses(false);
        setSaveDialogOpen(false);
        setTimetableName('');
        toast.success('Progress reset successfully!');
    };

    const handleSave = async () => {
        if (!timetableName.trim()) {
            toast.error('Please enter a name for the timetable');
            return;
        }

        try {
            // Check for duplicate names
            const response = await fetchWithRetry('http://localhost:3000/api/timetables');
            if (!response.ok) throw new Error('Failed to fetch timetables');
            const timetables = await response.json();

            const isDuplicate = timetables.some(t => t.name === timetableName.trim());
            if (isDuplicate) {
                toast.error('A timetable with this name already exists. Please choose a different name.');
                return;
            }

            // Calculate conflicts before saving
            const conflicts = {
                totalConflicts: 0,
                multipleExamsPerDay: 0,
                consecutiveExams: 0,
                studentConflicts: {}
            };

            Object.entries(selectedTimetable.stats.studentStats || {}).forEach(([rollNumber, stats]) => {
                if (stats.daysWithMultipleExams > 0) {
                    conflicts.multipleExamsPerDay += stats.daysWithMultipleExams;
                }
                if (stats.consecutiveExams > 0) {
                    conflicts.consecutiveExams += stats.consecutiveExams;
                }
                if (stats.daysWithMultipleExams > 0 || stats.consecutiveExams > 0) {
                    conflicts.studentConflicts[rollNumber] = {
                        multipleExamsDays: stats.daysWithMultipleExams || 0,
                        consecutiveExams: stats.consecutiveExams || 0
                    };
                }
            });

            conflicts.totalConflicts = conflicts.multipleExamsPerDay + conflicts.consecutiveExams;

            const saveResponse = await fetchWithRetry('http://localhost:3000/api/saveTimetable', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: timetableName.trim(),
                    data: {
                        formData,
                        courses,
                        selectedCourses,
                        examConfig,
                        generatedTimetable: selectedTimetable?.timetable,
                        stats: {
                            ...selectedTimetable?.stats,
                            conflicts
                        },
                        year: formData.year,
                        semester: formData.semester,
                        examType: formData.examType
                    }
                })
            });

            if (!saveResponse.ok) window.location.reload();

            toast.success('Timetable saved successfully!');
            setSaveDialogOpen(false);
            setTimetableName('');
        } catch (error) {
            console.error('Error saving timetable:', error);
            window.location.reload();
        }
    };

    const TimetableSelectionDialog = () => {
        const currentTimetable = generatedTimetables?.[currentTimetableIndex];

        const handlePrevious = () => {
            requestAnimationFrame(() => {
                setCurrentTimetableIndex(prev =>
                    prev === 0 ? generatedTimetables.length - 1 : prev - 1
                );
            });
        };

        const handleNext = () => {
            requestAnimationFrame(() => {
                setCurrentTimetableIndex(prev =>
                    prev === generatedTimetables.length - 1 ? 0 : prev + 1
                );
            });
        };

        // Calculate conflicts for the current timetable
        const { conflicts } = currentTimetable ? calculateConflicts(currentTimetable.timetable) : {
            conflicts: {
                totalConflicts: 0,
                multipleExamsPerDay: 0,
                consecutiveExams: 0,
                studentConflicts: {}
            }
        };

        return (
            <Dialog open={showTimetableSelection} onOpenChange={setShowTimetableSelection}>
                <DialogContent className="max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">Choose a Timetable</DialogTitle>
                    </DialogHeader>
                    {currentTimetable && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <Button
                                    variant="outline"
                                    onClick={handlePrevious}
                                    className="px-6 py-6 bg-gray-900 text-white hover:bg-gray-700"
                                >
                                    <span className="text-2xl">←</span>
                                </Button>
                                <span className="text-sm font-medium">
                                    Timetable {currentTimetableIndex + 1} of {generatedTimetables.length}
                                </span>
                                <Button
                                    variant="outline"
                                    onClick={handleNext}
                                    className="px-6 py-6 bg-gray-900 text-white hover:bg-gray-700"
                                >
                                    <span className="text-2xl">→</span>
                                </Button>
                            </div>

                            <div className="grid grid-cols-4 gap-4">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-sm text-gray-600">Total Courses</p>
                                    <p className="text-3xl font-bold">{currentTimetable.stats?.totalCourses || 0}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-sm text-gray-600">Scheduled Courses</p>
                                    <p className="text-3xl font-bold text-green-700">{currentTimetable.stats?.scheduledCourses || 0}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-sm text-gray-600">Unscheduled Courses</p>
                                    <p className="text-3xl font-bold text-red-700">
                                        {(currentTimetable.stats?.totalCourses || 0) - (currentTimetable.stats?.scheduledCourses || 0)}
                                    </p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4 relative group">
                                    <p className="text-sm text-gray-600">Fitness Score</p>
                                    <p className="text-3xl font-bold text-blue-700">{currentTimetable.fitness?.toFixed(2) || 'N/A'}</p>
                                    <div className="absolute invisible group-hover:visible bg-gray-900 text-white text-sm rounded p-2 w-48 -top-8 left-1/2 transform -translate-x-1/2">
                                        The lower the fitness score, the better the timetable
                                    </div>
                                </div>
                            </div>

                            {/* Conflicts Section */}
                            <div className="bg-white rounded-lg border p-4">
                                <h3 className="text-lg font-semibold mb-4">Schedule Conflicts</h3>
                                <div className="grid grid-cols-3 gap-4 mb-4">
                                    <div className="bg-red-50 rounded-lg p-4">
                                        <p className="text-sm text-red-600">Total No. of Incongruities</p>
                                        <p className="text-2xl font-bold text-red-700">{conflicts.totalConflicts}</p>
                                    </div>
                                    <div className="bg-yellow-50 rounded-lg p-4">
                                        <p className="text-sm text-yellow-600">No. of Students with Multiple Exams Per Day</p>
                                        <p className="text-2xl font-bold text-yellow-700">{conflicts.multipleExamsPerDay}</p>
                                    </div>
                                    <div className="bg-orange-50 rounded-lg p-4">
                                        <p className="text-sm text-orange-600">No. of Students with Consecutive Exams</p>
                                        <p className="text-2xl font-bold text-orange-700">{conflicts.consecutiveExams}</p>
                                    </div>
                                </div>
                                <div className="h-[200px] overflow-y-auto border rounded-lg">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-sm font-medium">Roll Number</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium">Multiple Exams Days</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium">Consecutive Exams</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(conflicts.studentConflicts || {}).map(([rollNumber, stats]) => (
                                                <tr key={rollNumber} className="hover:bg-gray-50">
                                                    <td className="px-4 py-2 text-sm">{rollNumber}</td>
                                                    <td className="px-4 py-2 text-sm">{stats.multipleExamsDays}</td>
                                                    <td className="px-4 py-2 text-sm">{stats.consecutiveExams}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Student Statistics Section */}
                            <div className="bg-white rounded-lg border p-4">
                                <h3 className="text-lg font-semibold mb-4">Student Statistics</h3>
                                <div className="h-[300px] overflow-y-auto border rounded-lg">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-sm font-medium">Roll Number</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium">Total Exams</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium">Exam Schedule</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(currentTimetable.stats?.studentStats || {}).map(([rollNumber, stats]) => (
                                                <tr key={rollNumber} className="hover:bg-gray-50">
                                                    <td className="px-4 py-2 text-sm font-medium">{rollNumber}</td>
                                                    <td className="px-4 py-2 text-sm">{stats.totalExams}</td>
                                                    <td className="px-4 py-2 text-sm">
                                                        <div className="space-y-1">
                                                            {stats.examSchedule.map((exam, index) => (
                                                                <div key={index} className="text-xs">
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
                            </div>

                            {/* Timetable Grid */}
                            <div className="overflow-x-auto">
                                {renderTimetableContent(currentTimetable.timetable, moveCourse)}
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={() => handleTimetableSelection(currentTimetable)}
                                    className="flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 w-full"
                                >
                                    I prefer this timetable
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        );
    };

    // Add offline indicator component
    const OfflineIndicator = () => {
        if (!isOffline) return null;

        return (
            <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                Offline Mode
            </div>
        );
    };

    const regenerateStatistics = useCallback(() => {
        if (!selectedTimetable) return;

        const { studentStats, conflicts } = calculateConflicts(selectedTimetable.timetable);

        // Calculate slot utilization with proper data structure for the chart
        const slotUtilization = [];

        // Sort dates to ensure consistent order
        const sortedDates = Object.keys(selectedTimetable.timetable).sort((a, b) => new Date(a) - new Date(b));

        // Process each date
        sortedDates.forEach(date => {
            const slots = selectedTimetable.timetable[date];
            const dayData = { day: date };

            // Initialize all slots with 0
            for (let i = 1; i <= examConfig.slotsPerDay; i++) {
                dayData[`Slot ${i}`] = 0;
            }

            // Count courses in each slot
            if (slots) {
                Object.entries(slots).forEach(([slotKey, courses]) => {
                    let slotMatch = slotKey.match(/Slot (\d+)/i);
                    if (!slotMatch) {
                        slotMatch = slotKey.match(/(\d+)/);
                    }

                    if (slotMatch && Array.isArray(courses)) {
                        const slotNum = parseInt(slotMatch[1]);
                        if (!isNaN(slotNum) && slotNum <= examConfig.slotsPerDay) {
                            dayData[`Slot ${slotNum}`] = courses.length;
                        }
                    } else if (Array.isArray(courses) && courses.length > 0) {
                        const slotKeys = Object.keys(slots);
                        const index = slotKeys.indexOf(slotKey);
                        if (index >= 0 && index < examConfig.slotsPerDay) {
                            dayData[`Slot ${index + 1}`] = courses.length;
                        }
                    }
                });
            }

            slotUtilization.push(dayData);
        });

        // Calculate total scheduled courses
        const scheduledCourses = Object.values(selectedTimetable.timetable).reduce((acc, slots) =>
            acc + Object.values(slots).reduce((slotAcc, courses) =>
                slotAcc + (Array.isArray(courses) ? courses.length : 0), 0), 0
        );

        const updatedStats = {
            studentStats,
            conflicts,
            slotUtilization,
            numSlots: examConfig.slotsPerDay,
            totalCourses: selectedCourses.length,
            scheduledCourses,
            unscheduledCourses: selectedCourses.length - scheduledCourses
        };

        setStats(updatedStats);
        toast.success('Statistics regenerated successfully!');
    }, [selectedTimetable, examConfig.slotsPerDay, selectedCourses, calculateConflicts]);

    // Add connection status indicator
    // const ConnectionStatus = () => {
    //     if (!connectionSpeed) return null;

    //     const getConnectionClass = () => {
    //         if (connectionSpeed < 1) return 'bg-red-500';
    //         if (connectionSpeed < 2) return 'bg-yellow-500';
    //         return 'bg-green-500';
    //     };

    //     return (
    //         <div className={`fixed bottom-4 left-4 ${getConnectionClass()} text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2`}>
    //             <span className="w-2 h-2 bg-white rounded-full"></span>
    //             {connectionSpeed.toFixed(1)} Mbps
    //         </div>
    //     );
    // };

    return (
        <>
            <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
            />
            <OfflineIndicator />
            {/*             <ConnectionStatus /> */}
            {isGenerating && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        <p className="text-lg font-medium">Generating Timetables...</p>
                        <p className="text-sm text-gray-500">This may take a few moments</p>
                    </div>
                </div>
            )}

            {/* Student Statistics Modal */}
            {showStudentStats && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h2 className="text-2xl font-bold">Student Statistics</h2>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowStudentStats(false)}
                            >
                                <X className="h-6 w-6" />
                            </Button>
                        </div>
                        <div className="p-6 flex-1 overflow-auto">
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
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Roll Number</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Total Exams</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Exam Schedule</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {Object.values(filteredStats).map((student) => (
                                            <tr key={student.rollNumber} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                                    {student.rollNumber}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500">
                                                    {student.totalExams}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500">
                                                    <div className="space-y-1">
                                                        {student.examSchedule.map((exam, index) => (
                                                            <div key={index} className="text-xs">
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
                        </div>
                    </div>
                </div>
            )}

            {/* Fixed Reset Button */}
            <div className="fixed top-20 left-4 z-50">
                <Button
                    onClick={handleReset}
                    variant="outline"
                    className="bg-red-50 text-red-600 hover:bg-red-100"
                >
                    Reset Progress
                </Button>
            </div>

            <div className="flex flex-col gap-6 items-start min-h-[calc(100vh-4rem)] mt-16 bg-gray-100 p-4">
                {/* Course Data Loading Card */}
                <Card className={`w-full max-w-2xl mx-auto ${isDataLoaded ? 'bg-gray-100' : 'bg-white'}`}>
                    <CardContent className="p-6">
                        <h2 className="text-2xl font-bold mb-6 text-center">Load Courses Data</h2>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Academic Year</label>
                                <Input
                                    type="text"
                                    placeholder="YYYY-YY (e.g., 2023-24)"
                                    value={formData.year}
                                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                                    pattern="\\d{4}-\\d{2}"
                                    disabled={isDataLoaded}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Semester</label>
                                <Select
                                    value={formData.semester}
                                    onValueChange={(value) => setFormData({ ...formData, semester: value })}
                                    disabled={isDataLoaded}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select semester" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Spring">Spring</SelectItem>
                                        <SelectItem value="Monsoon">Monsoon</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Exam Type</label>
                                <Select
                                    value={formData.examType}
                                    onValueChange={(value) => setFormData({ ...formData, examType: value })}
                                    disabled={isDataLoaded}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select exam type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="midsem">Mid Semester</SelectItem>
                                        <SelectItem value="endsem">End Semester</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button
                                className="w-full"
                                onClick={handleSubmit}
                                disabled={isLoading || isDataLoaded}
                            >
                                {isLoading ? 'Loading Courses...' : 'Load Courses Data'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Course Selection Card */}
                {isDataLoaded && (
                    <Card className="w-full max-w-2xl mx-auto bg-white">
                        <CardContent className="p-6">
                            <h2 className="text-2xl font-bold mb-6 text-center">Select Courses</h2>

                            <div className="space-y-6">
                                {/* Exam Configuration */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Slots Per Day</label>
                                        <Select
                                            value={examConfig.slotsPerDay.toString()}
                                            onValueChange={(value) => setExamConfig({
                                                ...examConfig,
                                                slotsPerDay: parseInt(value)
                                            })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select slots" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[1, 2, 3, 4].map(num => (
                                                    <SelectItem key={num} value={num.toString()}>
                                                        {num}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {examConfig.slotsPerDay > 0 && (
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Exam Dates</label>
                                            <MultiDatePicker
                                                selectedDates={examConfig.dates}
                                                onSelect={(dates) => setExamConfig({
                                                    ...examConfig,
                                                    dates: dates || []
                                                })}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Course Selection */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-medium">Available Courses</h3>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="selectAll"
                                                checked={selectedCourses.length === courses.length}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setSelectedCourses(courses.map(course => course.code));
                                                    } else {
                                                        setSelectedCourses([]);
                                                    }
                                                }}
                                            />
                                            <label
                                                htmlFor="selectAll"
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                                Select All
                                            </label>
                                        </div>
                                    </div>

                                    <div className="border rounded-lg overflow-hidden">
                                        <div className="max-h-[400px] overflow-y-auto">
                                            <table className="w-full">
                                                <thead className="bg-gray-50 sticky top-0">
                                                    <tr>
                                                        <th className="w-16 px-4 py-3 text-left text-sm font-medium text-gray-500"></th>
                                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Course Code</th>
                                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Course Name</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 bg-white">
                                                    {courses.map((course) => (
                                                        <tr key={course.code} className="hover:bg-gray-50">
                                                            <td className="px-4 py-3">
                                                                <Checkbox
                                                                    id={course.code}
                                                                    checked={selectedCourses.includes(course.code)}
                                                                    onCheckedChange={() => handleCourseSelection(course.code)}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 text-sm">
                                                                <label
                                                                    htmlFor={course.code}
                                                                    className="font-medium text-gray-900 cursor-pointer"
                                                                >
                                                                    {course.code}
                                                                </label>
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-500">
                                                                <label
                                                                    htmlFor={course.code}
                                                                    className="cursor-pointer"
                                                                >
                                                                    {course.name}
                                                                </label>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        className="flex-1"
                                        onClick={handleGenerateTimeTable}
                                        disabled={selectedCourses.length === 0}
                                    >
                                        Generate Time Table
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Statistics Card */}
                {stats && (
                    <Card className="w-full max-w-4xl mx-auto bg-white mt-6">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold">Timetable Statistics</h2>
                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={() => setShowUnscheduledCourses(true)}
                                        className="flex items-center gap-2 bg-gray-900 text-white hover:bg-gray-700"
                                    >
                                        <X size={16} />
                                        Unscheduled Courses
                                    </Button>
                                    <Button
                                        onClick={handleViewConflicts}
                                        className="flex items-center gap-2 bg-gray-900 text-white hover:bg-gray-700"
                                    >
                                        <AlertTriangle size={16} />
                                        View Conflicts
                                    </Button>
                                    <Button
                                        onClick={handleViewStudentStats}
                                        className="flex items-center gap-2 bg-gray-900 text-white hover:bg-gray-700"
                                    >
                                        <Users size={16} />
                                        View Student Statistics
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-6 mb-8">
                                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                                    <p className="text-sm text-gray-600">Total Courses</p>
                                    <p className="text-3xl font-bold text-gray-900">{stats.totalCourses}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                                    <p className="text-sm text-gray-600">Scheduled Courses</p>
                                    <p className="text-3xl font-bold text-green-700">{stats.scheduledCourses}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                                    <p className="text-sm text-gray-600">Unscheduled Courses</p>
                                    <p className="text-3xl font-bold text-red-700">{stats.unscheduledCourses}</p>
                                </div>
                                {/* <div className="bg-gray-50 rounded-lg p-4 space-y-2 relative group">
                                    <p className="text-sm text-gray-600">Fitness Score</p>
                                    <p className="text-3xl font-bold text-blue-700">
                                        {typeof stats.fitness === 'number' ? stats.fitness.toFixed(2) : 'N/A'}
                                    </p>
                                    <div className="absolute invisible group-hover:visible bg-gray-900 text-white text-sm rounded p-2 w-48 -top-8 left-1/2 transform -translate-x-1/2">
                                        The lower the fitness score, the better the timetable
                                    </div>
                                </div> */}
                            </div>

                            <div className="mt-8">
                                <h3 className="text-lg font-semibold mb-4">Slot Utilization</h3>
                                <div className="w-full h-[400px]">
                                    {stats?.slotUtilization && stats.slotUtilization.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={stats.slotUtilization}
                                                margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                                                barGap={2}
                                                barSize={20}
                                            >
                                                <XAxis
                                                    dataKey="day"
                                                    tick={{ fill: '#6b7280' }}
                                                    axisLine={{ stroke: '#d1d5db' }}
                                                    angle={-45}
                                                    textAnchor="end"
                                                    height={70}
                                                    interval={0}
                                                />
                                                <YAxis
                                                    tick={{ fill: '#6b7280' }}
                                                    axisLine={{ stroke: '#d1d5db' }}
                                                    label={{ value: 'Number of Courses', angle: -90, position: 'insideLeft', offset: 0 }}
                                                />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: '#fff',
                                                        border: '1px solid #e5e7eb',
                                                        borderRadius: '6px'
                                                    }}
                                                    formatter={(value, name) => [`${value} courses`, name]}
                                                />
                                                <Legend verticalAlign="top" height={36} />
                                                {Array.from({ length: examConfig.slotsPerDay }, (_, i) => (
                                                    <Bar
                                                        key={i}
                                                        dataKey={`Slot ${i + 1}`}
                                                        name={`Slot ${i + 1}`}
                                                        fill={`hsl(${(i * 60 + 200)}, 70%, ${65 - i * 10}%)`}
                                                        radius={[4, 4, 0, 0]}
                                                    />
                                                ))}
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex items-center justify-center h-full">
                                            <p className="text-gray-500">No slot utilization data available</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Generated Timetable Card */}
                {selectedTimetable && (
                    <Card className="w-full max-w-6xl mx-auto bg-white mt-6">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-center">Generated Timetable</h2>
                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={regenerateStatistics}
                                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                        Generate Statistics
                                    </Button>
                                    <Button
                                        onClick={() => setSaveDialogOpen(true)}
                                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        Save Timetable
                                    </Button>
                                    <Button
                                        onClick={handleDownloadPDF}
                                        className="flex items-center gap-2 bg-gray-900 text-white hover:bg-gray-700"
                                    >
                                        <Download size={16} />
                                        Download PDF
                                    </Button>
                                </div>
                            </div>
                            <div className="overflow-x-auto" id="timetable-content">
                                {renderTimetableContent(selectedTimetable.timetable, moveCourse)}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Timetable Selection Dialog */}
            <TimetableSelectionDialog />

            {/* Update the Save Timetable dialog condition */}
            {selectedTimetable && (
                <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Save Timetable</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Timetable Name</Label>
                                <Input
                                    id="name"
                                    value={timetableName}
                                    onChange={(e) => setTimetableName(e.target.value)}
                                    placeholder={defaultTimetableName}
                                />
                            </div>
                            <Button onClick={handleSave} className="w-full">
                                Save
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Unscheduled Courses Modal */}
            {showUnscheduledCourses && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[90vw] max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h2 className="text-2xl font-bold">Unscheduled Courses</h2>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowUnscheduledCourses(false)}
                            >
                                <X className="h-6 w-6" />
                            </Button>
                        </div>
                        <div className="p-6 flex-1 overflow-auto">
                            <div className="space-y-4">
                                {selectedTimetable?.stats?.unscheduledCourses > 0 ? (
                                    selectedCourses
                                        .filter(courseCode => {
                                            // Check if the course is not in the timetable
                                            return !Object.values(selectedTimetable.timetable).some(slots =>
                                                Object.values(slots).some(courses =>
                                                    courses.some(course => course.code === courseCode)
                                                )
                                            );
                                        })
                                        .map(courseCode => {
                                            const course = courses.find(c => c.code === courseCode);
                                            return (
                                                <div key={courseCode} className="bg-gray-50 p-4 rounded-lg">
                                                    <h3 className="font-medium text-gray-900">{courseCode}</h3>
                                                    <p className="text-gray-600">{course?.name}</p>
                                                </div>
                                            );
                                        })
                                ) : (
                                    <p className="text-center text-gray-500">All courses have been scheduled successfully!</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Conflicts Modal */}
            {showConflicts && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[90vw] max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h2 className="text-2xl font-bold">Schedule Conflicts</h2>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowConflicts(false)}
                            >
                                <X className="h-6 w-6" />
                            </Button>
                        </div>
                        <div className="p-6 flex-1 overflow-auto">
                            {/* Search Bar */}
                            <div className="mb-4">
                                <Input
                                    type="text"
                                    placeholder="Search by Roll Number..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full"
                                />
                            </div>

                            {/* Conflict Stats */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-red-50 rounded-lg p-4">
                                    <p className="text-sm text-red-600">Total Conflicts</p>
                                    <p className="text-2xl font-bold text-red-700">
                                        {selectedTimetable?.stats.conflicts.totalConflicts || 0}
                                    </p>
                                </div>
                                <div className="bg-yellow-50 rounded-lg p-4">
                                    <p className="text-sm text-yellow-600">Multiple Exams/Day</p>
                                    <p className="text-2xl font-bold text-yellow-700">
                                        {selectedTimetable?.stats.conflicts.multipleExamsPerDay || 0}
                                    </p>
                                </div>
                                <div className="bg-orange-50 rounded-lg p-4">
                                    <p className="text-sm text-orange-600">Consecutive Exams</p>
                                    <p className="text-2xl font-bold text-orange-700">
                                        {selectedTimetable?.stats.conflicts.consecutiveExams || 0}
                                    </p>
                                </div>
                            </div>

                            {/* Conflict List */}
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-medium">Roll Number</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium">Multiple Exams Days</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium">Consecutive Exams</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {Object.entries(getFilteredConflicts()).map(([rollNumber, stats]) => (
                                            <tr key={rollNumber} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm">{rollNumber}</td>
                                                <td className="px-4 py-3 text-sm">{stats.multipleExamsDays}</td>
                                                <td className="px-4 py-3 text-sm">{stats.consecutiveExams}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default GenerateTimeTables;