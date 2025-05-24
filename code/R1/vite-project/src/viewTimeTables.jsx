import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast, ToastContainer } from 'react-toastify';
import { Download, Eye, Trash2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'react-toastify/dist/ReactToastify.css';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ViewTimeTables = () => {
    const [timetables, setTimetables] = useState([]);
    const [selectedTimetable, setSelectedTimetable] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchAllTimetableDetails();
    }, []);

    const fetchAllTimetableDetails = async () => {
        try {
            // Fetch list of timetables
            const listResponse = await fetch('http://localhost:3000/api/timetables');
            if (!listResponse.ok) throw new Error('Failed to fetch timetable list');
            let timetableList = await listResponse.json();

            // Filter valid entries
            timetableList = timetableList.filter(t => t.id && t.name?.trim());

            // Fetch details for each timetable
            const detailedTimetables = await Promise.all(
                timetableList.map(async (timetable) => {
                    const detailsResponse = await fetch(
                        `http://localhost:3000/api/timetable/${timetable.id}`
                    );
                    if (!detailsResponse.ok) throw new Error(`Failed to fetch details for ${timetable.id}`);
                    return detailsResponse.json();
                })
            );

            setTimetables(detailedTimetables);
        } catch (error) {
            console.error('Error:', error);
            window.location.reload();
            //toast.error('Failed to load timetables');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteTimetable = async (id) => {
        if (!window.confirm('Are you sure you want to delete this timetable?')) return;

        try {
            const response = await fetch(`http://localhost:3000/api/timetable/${id}`, { method: 'DELETE' });
            if (!response.ok) window.location.reload();
            //toast.success('Timetable deleted successfully');
            window.location.reload();
            fetchAllTimetableDetails();
        } catch (error) {
            console.error('Error deleting timetable:', error);
            window.location.reload()
            //toast.error('Failed to delete timetable');
        }
    };

    const handleDownloadPDF = (timetable) => {
        try {
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            // PDF creation logic
            const titleSize = 14;
            const contentSize = 10;
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 10;

            // Title
            doc.setFontSize(titleSize);
            doc.text('International Institute of Information Technology Hyderabad', pageWidth / 2, margin + 10, { align: 'center' });

            // Subtitle
            const semester = timetable.data?.semester || '';
            const year = timetable.data?.year || '';
            const examType = (timetable.data?.examType === 'midsem' ? 'Mid' : 'End');
            doc.text(`${semester} ${year} ${examType} Semester Examinations Timetable`, pageWidth / 2, margin + 20, { align: 'center' });

            // Table setup
            const slotLabels = Array.from({ length: timetable.data?.examConfig?.slotsPerDay || 0 }, (_, i) => `Slot ${i + 1}`);
            const headers = ['Date/Time', ...slotLabels];

            const tableData = Object.entries(timetable.data?.generatedTimetable || {}).map(([date, slots]) => {
                let formattedDate = date;
                if (date.includes(' ')) {
                    const [dayDate, dayName] = date.split(' ');
                    formattedDate = `${dayDate}\n${dayName}`;
                }

                const row = [formattedDate];
                const slotTimes = Object.keys(slots || {});

                for (let i = 0; i < (timetable.data?.examConfig?.slotsPerDay || 0); i++) {
                    const slotTime = slotTimes[i];
                    const courses = slots[slotTime] || [];
                    row.push(courses.map(course => `${course.code} - ${course.name}`).join('\n'));
                }
                return row;
            });

            // Table formatting
            const dateColWidth = 25;
            const remainingWidth = pageWidth - margin * 2 - dateColWidth;
            const slotColWidth = remainingWidth / (timetable.data?.examConfig?.slotsPerDay || 1);

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
                didParseCell: function(data) {
                    if (data.column.index > 0) {
                        data.cell.styles.cellWidth = slotColWidth;
                    }
                }
            });

            // Footer
            doc.setFontSize(contentSize);
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, margin, doc.internal.pageSize.getHeight() - margin);
            doc.text(`Total Courses: ${timetable.data?.stats?.totalCourses || 0}`, margin, doc.internal.pageSize.getHeight() - margin - 5);
            doc.text(`Scheduled Courses: ${timetable.data?.stats?.scheduledCourses || 0}`, margin, doc.internal.pageSize.getHeight() - margin - 10);

            // Signature
            doc.text('Sd/-', pageWidth - margin - 20, doc.internal.pageSize.getHeight() - margin - 15);
            doc.text('Prof. Kishore Kothapalli', pageWidth - margin - 45, doc.internal.pageSize.getHeight() - margin - 10);
            doc.text('Controller of Examinations', pageWidth - margin - 45, doc.internal.pageSize.getHeight() - margin - 5);

            doc.save(`${timetable.name}.pdf`);
            toast.success('PDF downloaded successfully!');
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Failed to generate PDF');
        }
    };

    const handleDownloadExcel = (timetable) => {
        try {
            const wb = XLSX.utils.book_new();
            const wsData = [];

            // Headers
            const slotLabels = Array.from({ length: timetable.data?.examConfig?.slotsPerDay || 0 }, (_, i) => `Slot ${i + 1}`);
            const headers = ['Date/Time', ...slotLabels];
            wsData.push(headers);

            // Data
            Object.entries(timetable.data?.generatedTimetable || {}).forEach(([date, slots]) => {
                const row = [date];
                const slotTimes = Object.keys(slots || {});

                for (let i = 0; i < (timetable.data?.examConfig?.slotsPerDay || 0); i++) {
                    const slotTime = slotTimes[i];
                    const courses = slots[slotTime] || [];
                    // Use array format for multi-line cell content
                    row.push(courses.map(course => `${course.code} - ${course.name}`).join("\n"));
                }
                wsData.push(row);
            });

            // Create worksheet and add it to workbook
            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // Set cell properties for better formatting
            for (let i = 1; i < wsData.length; i++) { // Skip header row
                for (let j = 1; j < wsData[i].length; j++) { // Skip date column
                    const cellRef = XLSX.utils.encode_cell({r: i, c: j});
                    if (!ws[cellRef]) continue;

                    // Enable text wrapping
                    if (!ws[cellRef].s) ws[cellRef].s = {};
                    ws[cellRef].s.alignment = {
                        vertical: 'top',
                        horizontal: 'left',
                        wrapText: true
                    };
                }
            }

            // Set column widths
            const colWidths = [{ wch: 15 }]; // Date column
            for (let i = 0; i < slotLabels.length; i++) {
                colWidths.push({ wch: 40 }); // Slot columns
            }
            ws['!cols'] = colWidths;

            // Set row heights to accommodate multiple lines
            const rowHeights = [{ hpt: 25 }]; // Header row
            for (let i = 1; i < wsData.length; i++) {
                // Calculate height based on maximum number of courses in any slot
                let maxLines = 1;
                for (let j = 1; j < wsData[i].length; j++) {
                    const cellContent = wsData[i][j] || '';
                    const lineCount = (cellContent.match(/\n/g) || []).length + 1;
                    maxLines = Math.max(maxLines, lineCount);
                }
                // Set row height (approximately 18pts per line)
                rowHeights.push({ hpt: Math.max(25, maxLines * 18) });
            }
            ws['!rows'] = rowHeights;

            // Add the worksheet to the workbook
            XLSX.utils.book_append_sheet(wb, ws, 'Timetable');

            // Save the file
            XLSX.writeFile(wb, `${timetable.name}.xlsx`);
            toast.success('Excel downloaded successfully!');
        } catch (error) {
            console.error('Error generating Excel:', error);
            toast.error('Failed to generate Excel');
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-[calc(100vh-4rem)] mt-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] mt-16 bg-gray-100 p-4">
            <ToastContainer position="top-right" autoClose={3000} />

            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">Saved Timetables</h1>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {timetables.map((timetable) => (
                        <Card key={timetable.id} className="bg-white">
                            <CardContent className="p-6">
                                <h2 className="text-xl font-semibold mb-2">{timetable.name}</h2>
                                <div className="space-y-2 text-sm text-gray-600">
                                    <p>Year: {timetable.data?.year || 'N/A'}</p>
                                    <p>Semester: {timetable.data?.semester || 'N/A'}</p>
                                    <p>Exam Type: {timetable.data?.examType === 'midsem' ? 'Mid Semester' : 'End Semester'}</p>
                                    <p>Created: {new Date(timetable.createdAt).toLocaleDateString()}</p>
                                    <p>Total Courses: {timetable.data?.stats?.totalCourses || 0}</p>
                                    <p>Scheduled Courses: {timetable.data?.stats?.scheduledCourses || 0}</p>
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
                                        Download PDF
                                    </Button>
                                    <Button
                                        onClick={() => handleDownloadExcel(timetable)}
                                        className="flex-1 min-w-[120px] bg-green-600 text-white hover:bg-green-500"
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Download Excel
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
                    ))}
                </div>

                {timetables.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-gray-500">No timetables found. Generate a timetable first!</p>
                    </div>
                )}
            </div>

            {/* Timetable Details Dialog */}
            <Dialog open={!!selectedTimetable} onOpenChange={() => setSelectedTimetable(null)}>
                <DialogContent className="max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">{selectedTimetable?.name}</DialogTitle>
                    </DialogHeader>
                    {selectedTimetable && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-sm text-gray-600">Total Courses</p>
                                    <p className="text-3xl font-bold">{selectedTimetable.data?.stats?.totalCourses || 0}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-sm text-gray-600">Scheduled Courses</p>
                                    <p className="text-3xl font-bold text-green-700">{selectedTimetable.data?.stats?.scheduledCourses || 0}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-sm text-gray-600">Unscheduled Courses</p>
                                    <p className="text-3xl font-bold text-red-700">{selectedTimetable.data?.stats?.unscheduledCourses || 0}</p>
                                </div>
                            </div>

                            {/* Unscheduled Courses Section */}
                            <div className="bg-white rounded-lg border p-4">
                                <h3 className="text-lg font-semibold mb-4">Unscheduled Courses</h3>
                                <div className="space-y-4">
                                    {selectedTimetable.data?.stats?.unscheduledCourses > 0 ? (
                                        selectedTimetable.data?.selectedCourses
                                            ?.filter(courseCode => {
                                                return !Object.values(selectedTimetable.data?.generatedTimetable || {}).some(slots =>
                                                    Object.values(slots).some(courses =>
                                                        courses.some(course => course.code === courseCode)
                                                    )
                                                );
                                            })
                                            .map(courseCode => {
                                                const course = selectedTimetable.data?.courses?.find(c => c.code === courseCode);
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

                            {/* Conflicts Section */}
                            <div className="bg-white rounded-lg border p-4">
                                <h3 className="text-lg font-semibold mb-4">Schedule Conflicts</h3>
                                <div className="grid grid-cols-3 gap-4 mb-4">
                                    <div className="bg-red-50 rounded-lg p-4">
                                        <p className="text-sm text-red-600">Total No. of Conflicts</p>
                                        <p className="text-2xl font-bold text-red-700">
                                            {Object.values(selectedTimetable.data?.stats?.studentStats || {}).reduce((acc, stats) => 
                                                acc + (stats.daysWithMultipleExams || 0) + (stats.consecutiveExams || 0), 0
                                            )}
                                        </p>
                                    </div>
                                    <div className="bg-yellow-50 rounded-lg p-4">
                                        <p className="text-sm text-yellow-600">No. of Students with Multiple Exams Per Day</p>
                                        <p className="text-2xl font-bold text-yellow-700">
                                            {Object.values(selectedTimetable.data?.stats?.studentStats || {}).reduce((acc, stats) => 
                                                acc + (stats.daysWithMultipleExams || 0), 0
                                            )}
                                        </p>
                                    </div>
                                    <div className="bg-orange-50 rounded-lg p-4">
                                        <p className="text-sm text-orange-600">No. of Students with Consecutive Exams</p>
                                        <p className="text-2xl font-bold text-orange-700">
                                            {Object.values(selectedTimetable.data?.stats?.studentStats || {}).reduce((acc, stats) => 
                                                acc + (stats.consecutiveExams || 0), 0
                                            )}
                                        </p>
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
                                            {Object.entries(selectedTimetable.data?.stats?.studentStats || {}).map(([rollNumber, stats]) => (
                                                <tr key={rollNumber} className="hover:bg-gray-50">
                                                    <td className="px-4 py-2 text-sm">{rollNumber}</td>
                                                    <td className="px-4 py-2 text-sm">{stats.daysWithMultipleExams || 0}</td>
                                                    <td className="px-4 py-2 text-sm">{stats.consecutiveExams || 0}</td>
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
                                            {Object.entries(selectedTimetable.data?.stats?.studentStats || {}).map(([rollNumber, stats]) => (
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

                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold">Timetable Details</h3>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={() => handleDownloadPDF(selectedTimetable)}
                                        className="flex items-center gap-2"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download PDF
                                    </Button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="border p-2 font-semibold">Date/Time</th>
                                            {Array.from({ length: selectedTimetable.data?.examConfig?.slotsPerDay || 0 }, (_, i) => (
                                                <th key={i} className="border p-2 font-semibold">Slot {i + 1}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(selectedTimetable.data?.generatedTimetable || {}).map(([date, slots]) => (
                                            <tr key={date} className="hover:bg-gray-50">
                                                <td className="border p-2 font-medium">{date}</td>
                                                {Array.from({ length: selectedTimetable.data?.examConfig?.slotsPerDay || 0 }, (_, i) => {
                                                    const slotTimes = Object.keys(slots || {});
                                                    const slotTime = slotTimes[i];
                                                    const courses = slots[slotTime] || [];
                                                    return (
                                                        <td key={i} className="border p-2">
                                                            {courses.map(course => (
                                                                <div key={course.code} className="mb-1">
                                                                    <span className="font-medium">{course.code}</span>
                                                                    <span className="text-gray-600"> - {course.name}</span>
                                                                </div>
                                                            ))}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ViewTimeTables;
