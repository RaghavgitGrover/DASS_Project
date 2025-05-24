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
import { Download, Loader2, Users, X, AlertTriangle, Check } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import PropTypes from 'prop-types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DraggableCourse = ({ course, day, slotNum }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: 'COURSE',
        item: { course, sourceDay: day, sourceSlot: slotNum },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    }));

return (
        <div
            ref={drag}
            className={`text-sm ${isDragging ? 'opacity-50' : ''}`}
        >
            <div className="font-medium">{course.code}</div>
            <div className="text-xs text-gray-500">{course.name}</div>
        </div>
    );
};

// Add DroppableSlot component
const DroppableSlot = ({ day, slotNum, courses, onDrop }) => {
    const [{ isOver }, drop] = useDrop(() => ({
        accept: 'COURSE',
        drop: (item) => {
            if (item.sourceDay !== day || item.sourceSlot !== slotNum) {
                onDrop(item, day, slotNum);
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver(),
        }),
    }));

    return (
        <td
            ref={drop}
            className={`border p-2 ${isOver ? 'bg-blue-50' : ''}`}
        >
            {courses ? (
                <div className="space-y-1">
                    {courses.map(course => (
                        <DraggableCourse
                            key={course.code}
                            //key={`${course.code}-${day}-${slotNum}`}
                            course={course}
                            day={day}
                            slotNum={slotNum}
                        />
                    ))}
                </div>
            ) : '-'}
        </td>
    );
};

    // Update the FinalTimetableView component
    const FinalTimetableView = ({
        finalTimetable,
        slotTimes,
        setSlotTimes,
        examConfig,
        saveDialogOpen,
        setSaveDialogOpen,
        timetableName,
        setTimetableName,
        handleSaveTimetable,
        defaultTimetableName
      }) => {
      
        if (!finalTimetable) return null;

        // Set default timetable name when dialog opens
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
                setTimetableName(`Timetable - ${formattedDate}`);
            }
        }, [saveDialogOpen]);

        // Prepare data for visualizations
        const prepareStatsData = () => {
            const stats = finalTimetable.stats?.totalStudents || {};
            return [
                { name: '2 Consecutive', value: stats.twoConsecutive || 0 },
                { name: '3 Consecutive', value: stats.threeConsecutive || 0 },
                { name: '4 Consecutive', value: stats.fourConsecutive || 0 },
                { name: '2 Exams/Day', value: stats.twoExamsPerDay || 0 },
                { name: '3 Exams/Day', value: stats.threeExamsPerDay || 0 }
            ];
        };

        const prepareSlotUtilizationData = () => {
            const utilization = {};
            const timetable = finalTimetable.timetable?.timetable || {};
            const maxSlots = Math.max(...Object.values(timetable).map(day => day.slots.length));

            // Initialize all slots
            for (let slotNum = 1; slotNum <= maxSlots; slotNum++) {
                utilization[`Slot ${slotNum}`] = 0;
            }

            // Count courses in each slot
            Object.values(timetable).forEach(day => {
                day.slots.forEach((slot, index) => {
                    if (slot.courses) {
                        utilization[`Slot ${index + 1}`] += slot.courses.length;
                    }
                });
            });

            return Object.entries(utilization).map(([slot, count]) => ({
                name: slot,
                value: count
            }));
        };

        const prepareStudentScheduleData = () => {
            const students = finalTimetable.students || {};
            const days = Object.keys(finalTimetable.timetable?.timetable || {}).sort();
            const maxSlots = Math.max(...days.map(day =>
                finalTimetable.timetable.timetable[day].slots.length
            ));

            return Object.entries(students).map(([rollNumber, schedule]) => {
                const examCount = Object.values(schedule).reduce((total, day) => {
                    return total + Object.values(day).filter(slot => slot.length > 0).length;
                }, 0);
                return { rollNumber, examCount };
            });
        };

        const handleDrop = async (item, targetDay, targetSlot) => {
            const sourceDay = item.sourceDay;
            const sourceSlot = item.sourceSlot;
            const course = item.course;

            // Create a deep copy of the timetable
            const updatedTimetable = JSON.parse(JSON.stringify(finalTimetable));

            // Remove course from source slot
            const sourceSlotCourses = updatedTimetable.timetable.timetable[sourceDay].slots[sourceSlot - 1].courses;
            const sourceIndex = sourceSlotCourses.findIndex(c => c.code === course.code);
            if (sourceIndex !== -1) {
                sourceSlotCourses.splice(sourceIndex, 1);
            }

            // Add course to target slot
            if (!updatedTimetable.timetable.timetable[targetDay].slots[targetSlot - 1]) {
                updatedTimetable.timetable.timetable[targetDay].slots[targetSlot - 1] = { courses: [] };
            }
            updatedTimetable.timetable.timetable[targetDay].slots[targetSlot - 1].courses.push(course);

            // Check for student conflicts via backend API

            try {
                const response = await  fetch('http://localhost:3000/api/checkConflicts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                    timetable: updatedTimetable.timetable,
                    day: targetDay,
                    slot: targetSlot
                    })
                });

                // ✅ Fix: Add 'await' before response.json()
                const data = await response.json();

                if (data.conflicts.length > 0) {
                    toast.warning(`Overlap detected for students: ${data.conflicts.join(", ")}`);
                    // Revert the timetable state to the original
                     const revertTimetable = JSON.parse(JSON.stringify(finalTimetable));

                    // Remove course from the target slot
                    const targetSlotCourses = revertTimetable.timetable.timetable[targetDay].slots[targetSlot - 1].courses;
                    const targetIndex = targetSlotCourses.findIndex(c => c.code === course.code);
                    if (targetIndex !== -1) {
                        targetSlotCourses.splice(targetIndex, 1);
                    }

                    // Restore the course to the original position (source slot)
                    // revertTimetable.timetable.timetable[sourceDay].slots[sourceSlot - 1].courses.push(course);
                    // const sourceSlotCourses = revertTimetable.timetable[sourceDay].slots[sourceSlot - 1].courses;
                    // const existingIndex = sourceSlotCourses.findIndex(c => c.code === course.code);
                    const sourceSlotCourses = revertTimetable.timetable.timetable[sourceDay].slots[sourceSlot - 1].courses;
                    const existingIndex = sourceSlotCourses.findIndex(c => c.code === course.code);

                    if (existingIndex === -1) {
                        // Add back to original position
                        sourceSlotCourses.push(course);
                    }
                    // Update the final timetable state to reflect the reverted timetable
                    setFinalTimetable(revertTimetable);

                    return; // Stop further processing as we have reverted the change
                }
            } catch (error) {
                console.error('Error checking conflicts:', error);
                toast.error('Failed to check conflicts');
            }

            //update the stats and students before updating the timetable
            const stats = await fetch('http://localhost:3000/api/stats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    timetable: updatedTimetable.timetable,
                    examType: formData.examType
                })
            });
            const students = await fetch('http://localhost:3000/api/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ timetable: updatedTimetable.timetable })
            });
            const data = await stats.json();
            const studentsData = await students.json();
            updatedTimetable.stats = data;
            updatedTimetable.students = studentsData;
            // Update the final timetable state
            setFinalTimetable(updatedTimetable);
        };

        const handleSlotTimeChange = useCallback((slotKey, field, value) => {
            setSlotTimes(prev => ({
              ...prev,
              [slotKey]: {
                ...prev[slotKey],
                [field]: value
              }
            }));
          }, []);
          

        return (
            <DndProvider backend={HTML5Backend}>
                <Card className="w-full max-w-6xl mx-auto mt-6">
                    <CardContent className="p-6">
                        <div className="space-y-6">
                            {/* Header with actions */}
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold">Final Timetable</h3>
                                <div className="space-x-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDownloadData(finalTimetable.stats, `final_timetable_stats.json`)}
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        Download Stats
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDownloadData(finalTimetable.students, `final_timetable_students.json`)}
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        Download Student Data
                                    </Button>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => setSaveDialogOpen(true)}
                                    >
                                        <Check className="h-4 w-4 mr-2" />
                                        Save Timetable
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowFinalTimetable(false)}
                                    >
                                        <X className="h-4 w-4 mr-2" />
                                        Change Selection
                                    </Button>
                                </div>
                            </div>

                            {/* Statistics Dashboard */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="border rounded-lg p-4">
                                    <h4 className="font-medium mb-4">Exam Conflicts</h4>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={prepareStatsData()}>
                                                <XAxis dataKey="name" />
                                                <YAxis />
                                                <Tooltip />
                                                <Legend />
                                                <Bar dataKey="value" fill="#8884d8" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="border rounded-lg p-4">
                                    <h4 className="font-medium mb-4">Slot Utilization</h4>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={prepareSlotUtilizationData()}>
                                                <XAxis dataKey="name" />
                                                <YAxis />
                                                <Tooltip />
                                                <Legend />
                                                <Bar dataKey="value" fill="#82ca9d" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Student Schedule Heatmap */}
                            <div className="border rounded-lg p-4">
                                <h4 className="font-medium mb-4">Student Exam Load</h4>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={prepareStudentScheduleData()}>
                                            <XAxis dataKey="rollNumber" />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            <Bar dataKey="examCount" fill="#ffc658" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Timetable Grid */}
                            <div className="border rounded-lg p-4">
                                <h4 className="font-medium mb-4">Timetable</h4>
                                <div className="overflow-x-auto">
                                    {(() => {
                                        const timetable = finalTimetable?.timetable.timetable;
                                        if (!timetable) {
                                            return (
                                                <div className="text-center py-4 text-gray-500">
                                                    No timetable data available
                                                </div>
                                            );
                                        }

                                        const days = Object.keys(timetable).sort();
                                        const maxSlots = Math.max(...days.map(day => timetable[day].slots.length));

                                        return (
                                <table className="w-full border-collapse">
                                                <thead>
                                                    <tr>
                                                        <th className="border p-2 bg-gray-100">Day</th>
                                                        {Array.from({ length: maxSlots }, (_, i) => i + 1).map(slotNum => {
                                                            const slotKey = `slot-${slotNum}`;
                                                            const current = slotTimes[slotKey] || { startHour: '', startMin: '', startPeriod: 'AM', endHour: '', endMin: '', endPeriod: 'AM' };

                                                            return (
                                                                <th key={slotNum} className="border p-2 bg-gray-100 text-left">
                                                                    <div className="text-sm font-semibold">Slot {slotNum}</div>
                                                                    <div className="flex flex-wrap gap-1 text-xs mt-1">
                                                                        <input
                                                                            type="number"
                                                                            min="1"
                                                                            max="12"
                                                                            placeholder="HH"
                                                                            className="w-12 border px-1 py-0.5 rounded"
                                                                            value={current.startHour}
                                                                            onChange={(e) => handleSlotTimeChange(slotKey, 'startHour', e.target.value)}
                                                                        />
                                                                        <span>:</span>
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            max="59"
                                                                            placeholder="MM"
                                                                            className="w-12 border px-1 py-0.5 rounded"
                                                                            value={current.startMin}
                                                                            onChange={(e) => handleSlotTimeChange(slotKey, 'startMin', e.target.value)}
                                                                        />
                                                                        <select
                                                                            className="border rounded px-1 py-0.5"
                                                                            value={current.startPeriod}
                                                                            onChange={(e) => handleSlotTimeChange(slotKey, 'startPeriod', e.target.value)}
                                                                        >
                                                                            <option value="AM">AM</option>
                                                                            <option value="PM">PM</option>
                                                                        </select>

                                                                        <span className="mx-1">to</span>

                                                                        <input
                                                                            type="number"
                                                                            min="1"
                                                                            max="12"
                                                                            placeholder="HH"
                                                                            className="w-12 border px-1 py-0.5 rounded"
                                                                            value={current.endHour}
                                                                            onChange={(e) => handleSlotTimeChange(slotKey, 'endHour', e.target.value)}
                                                                        />
                                                                        <span>:</span>
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            max="59"
                                                                            placeholder="MM"
                                                                            className="w-12 border px-1 py-0.5 rounded"
                                                                            value={current.endMin}
                                                                            onChange={(e) => handleSlotTimeChange(slotKey, 'endMin', e.target.value)}
                                                                        />
                                                                        <select
                                                                            className="border rounded px-1 py-0.5"
                                                                            value={current.endPeriod}
                                                                            onChange={(e) => handleSlotTimeChange(slotKey, 'endPeriod', e.target.value)}

                                                                        >
                                                                            <option value="AM">AM</option>
                                                                            <option value="PM">PM</option>
                                                                        </select>
                                                                    </div>
                                                                </th>
                                                            );
                                                        })}

                                        </tr>
                                    </thead>
                                                <tbody>
                                                    {days.map((day) => (
                                                        <tr key={day}>
                                                            <td className="border p-2 font-medium">
                                                            {(() => {
                                                                    const index = parseInt(day.replace('day', '')) - 1;
                                                                    const examDate = examConfig.dates[index]
                                                                        ? new Date(examConfig.dates[index]).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                                                        : '';
                                                                    return `Day ${index + 1}${examDate ? `: ${examDate}` : ''}`;
                                                                    })()}

                                                </td>
                                                            {Array.from({ length: maxSlots }, (_, i) => i + 1).map((slotNum) => (
                                                                <DroppableSlot
                                                                    key={`${day}-${slotNum}`}
                                                                    day={day}
                                                                    slotNum={slotNum}
                                                                    courses={timetable[day].slots[slotNum - 1]?.courses}
                                                                    onDrop={handleDrop}
                                                                />
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Save Timetable Dialog */}
                <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Save Timetable</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="timetableName">Timetable Name</Label>
                                <Input
                                    value={timetableName}
                                    onChange={(e) => setTimetableName(e.target.value)}
                                    placeholder={defaultTimetableName}
                                />

                            </div>
                            <Button
                                onClick={handleSaveTimetable}
                                className="w-full"
                            >
                                Save Timetable
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </DndProvider>
        );
    };

const GenerateTimeTables = () => {
    const [formData, setFormData] = useState({
        year: '2023-24',
        semester: 'Spring',
        examType: 'midsem'
    });

    // Add new state for lecture timetable
    const [lectureTimetable, setLectureTimetable] = useState(null);
    const [lectureTimetableError, setLectureTimetableError] = useState('');
    const [slotTimes, setSlotTimes] = useState({});

    const handleSlotTimeChange = (slotKey, field, value) => {
        setSlotTimes((prevSlotTimes) => ({
          ...prevSlotTimes,
          [slotKey]: {
            ...prevSlotTimes[slotKey],
            [field]: value,
          },
        }));
      };
      

    const normalizeSlotTimes = (slotTimes) => {
        const newSlotTimes = {};
        for (const [slotKey, s] of Object.entries(slotTimes)) {
          newSlotTimes[slotKey] = {
            startHour: s.startHour || '',
            startMin: s.startMin || '',
            startPeriod: s.startPeriod || 'AM',
            endHour: s.endHour || '',
            endMin: s.endMin || '',
            endPeriod: s.endPeriod || 'AM',
          };
        }
        return newSlotTimes;
      };
      


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
    const [defaultTimetableName, setDefaultTimetableName] = useState(`Timetable - ${new Date().toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    })}`);
    
      
    const [timetableName, setTimetableName] = useState("");  
    const [showTimetableSelection, setShowTimetableSelection] = useState(false);
    const [selectedTimetable, setSelectedTimetable] = useState(null);
    const [currentTimetableIndex, setCurrentTimetableIndex] = useState(0);
    const [showUnscheduledCourses, setShowUnscheduledCourses] = useState(false);
    //const [defaultTimetableName, setDefaultTimetableName] = useState('');
    const [showConflicts, setShowConflicts] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [viewingTimetable, setViewingTimetable] = useState(false);
    const [currentTimetableData, setCurrentTimetableData] = useState(null);
    const [currentTimetableStats, setCurrentTimetableStats] = useState(null);
    const [currentTimetableStudents, setCurrentTimetableStudents] = useState(null);
    const [finalTimetable, setFinalTimetable] = useState(null);
    const [showFinalTimetable, setShowFinalTimetable] = useState(false);

    // Add new state for adding course
    const [addCourseDialogOpen, setAddCourseDialogOpen] = useState(false);
    const [newCourseCode, setNewCourseCode] = useState('');
    const [isAddingCourse, setIsAddingCourse] = useState(false);

    // Add new state for timetable selection dialog
    const [timetableData, setTimetableData] = useState({
        version1: null,
        version2: null,
        version3: null
    });
    const [activeTab, setActiveTab] = useState("1");

    // Add new state for error dialog
    const [errorDialogOpen, setErrorDialogOpen] = useState(false);
    const [errorData, setErrorData] = useState(null);

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
            setDefaultTimetableName(`Timetable - ${formattedDate}`);

            // If there's no user-entered name yet, set it to the default
            if (!timetableName) {
                setTimetableName(defaultTimetableName);
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
            const response = await fetchWithRetry('http://localhost:3000/api/courses');
            if (!response.ok) {
                const error = await response.json();
                if (response.status === 404) {
                    setIsDataLoaded(false);
                    toast.error("Please process exam data first");
                    return;
                }
                throw new Error(error.message);
            }
            const data = await response.json();
            if (data.success && data.data && data.data.courses) {
                setCourses(data.data.courses);
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('Error:', error);
            toast.error(error.message || 'Failed to fetch course names');
            setIsDataLoaded(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            // First call process-exam-data endpoint
            const processResponse = await fetch('http://localhost:3001/api/process-exam-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: lectureTimetable,
                    year: formData.year,
                    semester: formData.semester
                })
            });

            if (!processResponse.ok) {
                const errorData = await processResponse.json();
                throw new Error(errorData.message || 'Failed to process exam data');
            }

            // Then fetch courses
            await fetchCourseNames();
            setIsDataLoaded(true);
            toast.success('Data loaded successfully!');
        } catch (error) {
            console.error('Error:', error);
            toast.error(error.message || 'Failed to load data');
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

            // Get unselected courses (courses that are not in selectedCourses)
            const unselectedCourses = courses
                .map(course => course.code)
                .filter(code => !selectedCourses.includes(code));

            const response = await fetch('http://localhost:3000/api/generate-timetable', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: formData.examType,
                    selectedCourses,
                    unselectedCourses,
                    examConfig: {
                        dates: sortedDates,
                        slots: examConfig.slotsPerDay
                    }
                })
            });

            const data = await response.json();
            console.log(data);
            if (data.success) {
                toast.success('Timetables generated successfully!');
                setShowTimetableSelection(true);

                // Fetch data for all three versions
                const version1Data = await fetchTimetableData(1);
                const version2Data = await fetchTimetableData(2);
                const version3Data = await fetchTimetableData(3);

                setTimetableData({
                    version1: version1Data,
                    version2: version2Data,
                    version3: version3Data
                });
            } else {
                toast.error(data.message);
                setErrorData(data.data);
                setErrorDialogOpen(true);
            }
        } catch (error) {
            console.error('Error:', error);
            toast.error(error.message || 'Failed to generate timetables');
        } finally {
            setIsGenerating(false);
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

    // Add file input handler
    const handleFileInput = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (file.type !== 'text/plain') {
                setLectureTimetableError('Please upload a text file');
                setLectureTimetable(null);
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target.result;
                    setLectureTimetable(content);
                    setLectureTimetableError('');
                    toast.success('Lecture timetable loaded successfully');
                } catch (error) {
                    setLectureTimetableError('Error reading file');
                    setLectureTimetable(null);
                    toast.error('Error reading file');
                }
            };
            reader.readAsText(file);
        }
    };

    // Add function to handle adding a course
    const handleAddCourse = async () => {
        if (!newCourseCode.trim()) {
            toast.error('Please enter a course code');
            return;
        }

        setIsAddingCourse(true);
        try {
            const response = await fetch('http://localhost:3000/api/add-course', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    year: formData.year,
                    semester: formData.semester,
                    courseCode: newCourseCode.trim()
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to add course');
            }

            // Refresh courses list
            await fetchCourseNames();

            // Add the new course to selected courses if it's not already selected
            if (!selectedCourses.includes(newCourseCode.trim())) {
                setSelectedCourses(prev => [...prev, newCourseCode.trim()]);
            }

            toast.success('Course added successfully!');
            setAddCourseDialogOpen(false);
            setNewCourseCode('');
        } catch (error) {
            console.error('Error adding course:', error);
            toast.error(error.message || 'Failed to add course');
        } finally {
            setIsAddingCourse(false);
        }
    };

    // Add function to fetch timetable data
    const fetchTimetableData = async (version) => {
        try {
            const response = await fetch(`http://localhost:3000/api/timetable_version/${version}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch timetable version ${version}`);
            }
            const data = await response.json();
            console.log(data.data);
            return data.data;
        } catch (error) {
            console.error(`Error fetching timetable version ${version}:`, error);
            return null;
        }
    };

    // Add function to download data
    const handleDownloadData = (content, filename) => {
        if (!content) return;

        const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    // Add DraggableCourse component after the FinalTimetableView component
    

    // Add function to handle saving timetable
    const handleSaveTimetable = async () => {
        if (!timetableName.trim()) {
            toast.error('Please enter a name for the timetable');
            return;
        }
        try {
            const response = await fetch('http://localhost:3000/api/saveTimetable', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: timetableName || defaultTimetableName.trim(),
                    data: {
                        timetable: finalTimetable.timetable,
                        stats: finalTimetable.stats,
                        students: finalTimetable.students,
                        year: formData.year,
                        semester: formData.semester,
                        examType: formData.examType,
                        examDates: examConfig.dates,            
                        slotTimes: normalizeSlotTimes(slotTimes)                
                      }
                      
                })
            });
            if (!response.ok) {
                throw new Error('Failed to save timetable');
            }
            toast.success('Timetable saved successfully!');
            setSaveDialogOpen(false);
            setTimetableName('');
            // Do NOT reload the page or clear timetable data here. Keep timetable visible.
        } catch (error) {
            console.error('Error saving timetable:', error);
            toast.error('Failed to save timetable');
        }
    };


    // Add TimetableTabs component
    const TimetableTabs = () => {
        if (!timetableData.version1) return null;

    return (
            <Card className="w-full max-w-4xl mx-auto mt-6">
                <CardContent className="p-6">
                    <Tabs defaultValue="1" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="1">Version 1</TabsTrigger>
                            <TabsTrigger value="2">Version 2</TabsTrigger>
                            <TabsTrigger value="3">Version 3</TabsTrigger>
                        </TabsList>

                        {[1, 2, 3].map((version) => (
                            <TabsContent key={version} value={version.toString()}>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-lg font-semibold">Timetable Version {version}</h3>
                                        <div className="space-x-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDownloadData(timetableData[`version${version}`].stats, `timetable_v${version}_stats.json`)}
                                            >
                                                <Download className="h-4 w-4 mr-2" />
                                                Download Stats
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDownloadData(timetableData[`version${version}`].students, `timetable_v${version}_students.json`)}
                                            >
                                                <Download className="h-4 w-4 mr-2" />
                                                Download Student Data
                                            </Button>
                                            <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedTimetable(version);
                                                    setFinalTimetable(timetableData[`version${version}`]);
                                                    setShowTimetableSelection(false);
                                                    setShowFinalTimetable(true);
                                                    toast.success(`Timetable version ${version} selected as final`);
                                                }}
                                            >
                                                <Check className="h-4 w-4 mr-2" />
                                                I Prefer This Timetable
                                            </Button>
                                        </div>
                                    </div>

                                    {timetableData[`version${version}`] && (
                                        <div className="space-y-4">
                                            <div className="border rounded-lg p-4">
                                                <h4 className="font-medium mb-4">Statistics</h4>
                            <div className="overflow-x-auto">
                                                    {(() => {
                                                        const stats = timetableData[`version${version}`]?.stats;
                                                        if (!stats) {
                                                            return (
                                                                <div className="text-center py-4 text-gray-500">
                                                                    No statistics available
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <div className="space-y-4">
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div className="border p-3 rounded">
                                                                        <div className="space-y-2">
                                                                            {stats.totalStudents.twoConsecutive !== undefined && (
                                                                                <p>Students with 2 consecutive exams: {stats.totalStudents.twoConsecutive}</p>
                                                                            )}
                                                                            {stats.totalStudents.threeConsecutive !== undefined && (
                                                                                <p>Students with 3 consecutive exams: {stats.totalStudents.threeConsecutive}</p>
                                                                            )}
                                                                            {stats.totalStudents.fourConsecutive !== undefined && (
                                                                                <p>Students with 4 consecutive exams: {stats.totalStudents.fourConsecutive}</p>
                                                                            )}
                                                                            {stats.totalStudents.twoExamsPerDay !== undefined && (
                                                                                <p>Students with 2 exams per day: {stats.totalStudents.twoExamsPerDay}</p>
                                                                            )}
                                                                            {stats.totalStudents.threeExamsPerDay !== undefined && (
                                                                                <p>Students with 3 exams per day: {stats.totalStudents.threeExamsPerDay}</p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>

                                            <div className="border rounded-lg p-4">
                                                <h4 className="font-medium mb-4">Timetable</h4>
                                                <div className="overflow-x-auto">
                                                    {(() => {
                                                        const timetable = timetableData[`version${version}`]?.timetable.timetable;
                                                        if (!timetable) {
                                                            return (
                                                                <div className="text-center py-4 text-gray-500">
                                                                    No timetable data available
                                                                </div>
                                                            );
                                                        }

                                                        const days = Object.keys(timetable).sort();
                                                        const maxSlots = Math.max(...days.map(day => timetable[day].slots.length));

                                                        return (
                                <table className="w-full border-collapse">
                                                                <thead>
                                                                    <tr>
                                                                        <th className="border p-2 bg-gray-100">Day</th>
                                                                        {Array.from({ length: maxSlots }, (_, i) => i + 1).map(slotNum => (
                                                                            <th key={slotNum} className="border p-2 bg-gray-100">
                                                                                Slot {slotNum}
                                                                            </th>
                                                                        ))}
                                        </tr>
                                    </thead>
                                                                <tbody>
                                                                    {days.map((day) => (
                                                                        <tr key={day}>
                                                                            <td className="border p-2 font-medium">
                                                                                {(() => {
                                                                                    const index = parseInt(day.replace('day', '')) - 1;
                                                                                    const examDate = examConfig.dates[index]
                                                                                        ? new Date(examConfig.dates[index]).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                                                                        : '';
                                                                                    return `Day ${index + 1}${examDate ? `: ${examDate}` : ''}`;
                                                                                })()}
                                                                            </td>

                                                                            {Array.from({ length: maxSlots }, (_, i) => i + 1).map((slotNum) => {
                                                                                const slot = timetable[day].slots[slotNum - 1];
                                                                                return (
                                                                                    <td key={`${day}-${slotNum}`} className="border p-2">
                                                                                        {slot ? (
                                                    <div className="space-y-1">
                                                                                                {slot.courses.map(course => (
                                                                                                    <div key={course.code} className="text-sm">
                                                                                                        <div className="font-medium">{course.code}</div>
                                                                                                        <div className="text-xs text-gray-500">{course.name}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                                                        ) : '-'}
                                                </td>
                                                                                );
                                                                            })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                                        );
                                                    })()}
                            </div>
                        </div>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        ))}
                    </Tabs>
                </CardContent>
            </Card>
        );
    };

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
            {isGenerating && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        <p className="text-lg font-medium">Generating Timetables...</p>
                        <p className="text-sm text-gray-500">This may take a few moments</p>
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
                                <Select
                                    value={formData.year}
                                    onValueChange={(value) => setFormData({ ...formData, year: value })}
                                    disabled={isDataLoaded}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select academic year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="2023-24">2023-24</SelectItem>
                                        <SelectItem value="2024-25">2024-25</SelectItem>
                                        <SelectItem value="2025-26">2025-26</SelectItem>
                                        <SelectItem value="2026-27">2026-27</SelectItem>
                                    </SelectContent>
                                </Select>
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

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Lecture Timetable</label>
                                <Input
                                    type="file"
                                    accept=".txt"
                                    onChange={handleFileInput}
                                    disabled={isDataLoaded}
                                />
                                {lectureTimetableError && (
                                    <p className="text-sm text-red-500">{lectureTimetableError}</p>
                                )}
                            </div>

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

                            <Button
                                className="w-full"
                                onClick={handleSubmit}
                                disabled={isLoading || isDataLoaded || !lectureTimetable}
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
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-center">Select Courses</h2>
                                <Button
                                    onClick={() => setAddCourseDialogOpen(true)}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                    Add Course
                                </Button>
                            </div>

                            <div className="space-y-6">
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

                {/* Add TimetableTabs after the course selection card */}
                {isDataLoaded && (
                    <>
                        <Card className="w-full max-w-2xl mx-auto bg-white">
                            {/* ... existing course selection card content ... */}
                    </Card>
                    {showFinalTimetable ? (
                        <FinalTimetableView
                            finalTimetable={finalTimetable}
                            slotTimes={slotTimes}
                            setSlotTimes={setSlotTimes}
                            examConfig={examConfig}
                            handleSlotTimeChange={handleSlotTimeChange}
                            saveDialogOpen={saveDialogOpen}
                            setSaveDialogOpen={setSaveDialogOpen}
                            timetableName={timetableName}
                            setTimetableName={setTimetableName}
                            handleSaveTimetable={handleSaveTimetable}
                            defaultTimetableName={defaultTimetableName}
                        />
                        ) : (
                        <TimetableTabs />
                        )}

                    </>
                )}
                            </div>

            {/* Add Course Dialog */}
            <Dialog open={addCourseDialogOpen} onOpenChange={setAddCourseDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Course</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="courseCode">Course Code</Label>
                            <Input
                                id="courseCode"
                                value={newCourseCode}
                                onChange={(e) => setNewCourseCode(e.target.value)}
                                placeholder="Enter course code"
                                disabled={isAddingCourse}
                            />
                        </div>
                        <Button
                            onClick={handleAddCourse}
                            className="w-full"
                            disabled={isAddingCourse}
                        >
                            {isAddingCourse ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Adding Course...
                                </>
                            ) : (
                                'Add Course'
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add Error Dialog */}
            <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>Student Conflicts</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="border rounded-lg p-4 bg-gray-50 overflow-y-auto max-h-[70vh]">
                            {errorData && Array.isArray(errorData) ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead className="bg-gray-100 sticky top-0">
                                            <tr>
                                                <th className="border p-2 text-left">Student ID</th>
                                                <th className="border p-2 text-left">Day</th>
                                                <th className="border p-2 text-left">Slot</th>
                                                <th className="border p-2 text-left">Conflicting Courses</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {errorData.map((item, index) => (
                                                <tr key={index} className="hover:bg-gray-50">
                                                    <td className="border p-2">{item.student}</td>
                                                    <td className="border p-2">Day {item.day}</td>
                                                    <td className="border p-2">Slot {item.slot}</td>
                                                    <td className="border p-2">
                                                        <div className="space-y-1">
                                                            {item.courses.map((course, courseIndex) => (
                                                                <div key={courseIndex} className="text-sm">
                                                                    <span className="font-medium">{course.code}</span>
                                                                    <span className="text-gray-600 ml-2">{course.name}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <pre className="whitespace-pre-wrap text-sm">
                                    {JSON.stringify(errorData, null, 2)}
                                </pre>
                            )}
                        </div>
                        <Button
                            onClick={() => setErrorDialogOpen(false)}
                            className="w-full"
                        >
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default GenerateTimeTables;