import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast, ToastContainer } from 'react-toastify';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'react-toastify/dist/ReactToastify.css';
import { Download, FileDown, Loader2, Eye, Trash2 } from 'lucide-react';
import PropTypes from 'prop-types';
import JSZip from 'jszip';

// Room preferences constant for sorting display order
const ROOM_PREFERENCES = {
    "H-101": 1, "H-102": 2, "H-103": 3, "H-104": 4,
    "H-201": 5, "H-202": 6, "H-203": 7, "H-204": 8,
    "H-301": 9, "H-302": 10, "H-303": 11, "H-304": 12,
    "SH1": 13, "SH2": 14, "H-105": 15, "H-205": 16,
    "CR1": 17, "303": 18, "319": 19, "A3 301": 20,
    "B4 301": 21, "B4 304": 22, "B6 309": 23, "Seminar Hall": 24
};

// Helper function for sorting rooms based on preference
const getRoomPreference = (roomNameInput) => {
    // Handle potential undefined/null input defensively
    const roomName = typeof roomNameInput === 'string' ? roomNameInput : '';

    if (ROOM_PREFERENCES[roomName] !== undefined) return ROOM_PREFERENCES[roomName];

    // Normalize: If the room name starts with "H " then replace with "H-"
    if (roomName.startsWith("H ")) {
        const normalized = roomName.replace("H ", "H-");
        if (ROOM_PREFERENCES[normalized] !== undefined) return ROOM_PREFERENCES[normalized];
    }

    // Normalize any extra spaces and convert to uppercase for potential matches
    const norm2 = roomName.trim().toUpperCase();
    if (ROOM_PREFERENCES[norm2] !== undefined) return ROOM_PREFERENCES[norm2];

    // Fallback: return a high number to push unknown names to the end
    return Infinity;
};


const sortRoomsByPreference = (arrangements) => {
    if (!Array.isArray(arrangements)) return [];
    return [...arrangements].sort((a, b) => {
        // Ensure roomName exists before accessing it
        const nameA = a?.roomName || '';
        const nameB = b?.roomName || '';
        const prefA = getRoomPreference(nameA);
        const prefB = getRoomPreference(nameB);
        if (prefA !== prefB) return prefA - prefB;
        // If preferences are the same (or both are Infinity), sort alphabetically by name
        return nameA.localeCompare(nameB);
    });
};


// Statistics Display Component (Needs stats for a SINGLE slot)
const StatisticsDisplay = ({ stats }) => {
    if (!stats || !Array.isArray(stats.roomsUsed)) {
        return (
            <div className="mt-4 space-y-4 border-t pt-4">
                <p className="text-gray-600 text-center">Statistics not available for this slot.</p>
            </div>
        );
    }
    // Sort rooms based on preference for display consistency
    const sortedRooms = sortRoomsByPreference(stats.roomsUsed);
    const unassignedDetails = stats.unassignedDetails || [];

    return (
        <div className="mt-4 space-y-4 border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Rooms Utilization */}
                <div className="bg-blue-50 rounded-lg p-4">
                    <h6 className="text-sm font-semibold text-blue-800 mb-2">Room Utilization ({sortedRooms.length} rooms)</h6>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-2 text-xs">
                        {sortedRooms.map((room, index) => {
                            // Provide default values if properties are missing
                            const capacity = room?.capacity ?? 0;
                            const studentsPlaced = room?.studentsPlaced ?? 0;
                            const roomName = room?.name ?? 'Unknown Room';
                            const utilizationPercent = capacity > 0 ? ((studentsPlaced / capacity) * 100) : 0;
                            return (
                                <div key={index} className="flex justify-between items-center border-b border-blue-100 py-1">
                                    <span className="font-medium truncate pr-2">{roomName}</span>
                                    <span className="text-gray-700 whitespace-nowrap">
                                        {studentsPlaced} / {capacity} ({utilizationPercent.toFixed(0)}%)
                                    </span>
                                </div>
                            );
                        })}
                        {sortedRooms.length === 0 && <p className="text-gray-500">No rooms used.</p>}
                    </div>
                </div>
                {/* Unassigned Students */}
                <div className="bg-red-50 rounded-lg p-4">
                    <h6 className="text-sm font-semibold text-red-800 mb-2">Unassigned Students ({stats.unassignedCount ?? 0})</h6>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 text-xs">
                        {unassignedDetails.length > 0 ? (
                            unassignedDetails.map((course, index) => (
                                <div key={index} className="border-b border-red-100 pb-1 mb-1">
                                    <div className="font-medium">{course.courseCode || 'N/A'} ({course.students?.length || 0}):</div>
                                    <div className="text-gray-700 break-words">
                                        {(course.students || []).join(', ')}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-gray-600">All students were assigned successfully!</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Prop types for StatisticsDisplay
StatisticsDisplay.propTypes = {
    stats: PropTypes.shape({
        roomsUsed: PropTypes.arrayOf(PropTypes.shape({
            name: PropTypes.string,
            capacity: PropTypes.number,
            studentsPlaced: PropTypes.number
        })),
        unassignedCount: PropTypes.number,
        unassignedDetails: PropTypes.arrayOf(PropTypes.shape({
            courseCode: PropTypes.string,
            courseName: PropTypes.string,
            students: PropTypes.arrayOf(PropTypes.string)
        }))
    })
};

// PDF Generation function FOR A SINGLE SLOT (Adapted from GenerateSeatingArrangements)
const generatePDFForSlot = (date, slot, slotData, arrangementName, examDetails, createdAt) => {
    if (!slotData || !Array.isArray(slotData.arrangements)) {
        toast.error(`Cannot generate PDF for Slot ${slot}: Invalid data.`);
        return null;
    }

    try {
        const doc = new jsPDF('landscape');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
        let yOffset = margin + 10;

        // --- Header ---
        doc.setFontSize(16);
        doc.text(`Seating Arrangement: ${arrangementName || 'N/A'}`, pageWidth / 2, yOffset, { align: 'center' });
        yOffset += 8;
        doc.setFontSize(12);
        doc.text(`Exam: ${examDetails?.examType || 'N/A'} / Semester: ${examDetails?.semester || 'N/A'} / Year: ${examDetails?.year || 'N/A'}`, pageWidth / 2, yOffset, { align: 'center' });
        yOffset += 8;
        doc.setFontSize(14);
        doc.text(`Date: ${date} - Slot: ${slot}`, pageWidth / 2, yOffset, { align: 'center' });
        yOffset += 10;

        // --- Room Arrangements for the Slot (SORTED) ---
        const sortedArrangements = sortRoomsByPreference(slotData.arrangements);

        for (const roomArrangement of sortedArrangements) {
            if (!roomArrangement || typeof roomArrangement.sections !== 'object') {
                console.warn("Skipping invalid room arrangement in slot PDF:", roomArrangement);
                continue;
            }

            // Estimate height and check page break
            let estimatedHeight = 15; // Room header
            ['A', 'B', 'C', 'D'].forEach(secId => { if (roomArrangement.sections?.[secId]?.length > 0) estimatedHeight += 8 + (roomArrangement.sections[secId].length * 6); });
            if (yOffset + estimatedHeight > pageHeight - 20) {
                doc.addPage('landscape');
                yOffset = margin + 10; // Reset Y
                // Optional: Redraw Slot header on new page?
                doc.setFontSize(14);
                doc.text(`Date: ${date} - Slot: ${slot} (cont.)`, pageWidth / 2, yOffset, { align: 'center' });
                yOffset += 10;
            }

            // Room Header
            doc.setFontSize(12);
            const roomName = roomArrangement.roomName || 'Unknown Room';
            const roomBlock = roomArrangement.block || 'N/A';
            const roomCap = roomArrangement.totalCalcCapacity ?? roomArrangement.capacity ?? 'N/A';
            doc.text(`Room: ${roomName} (Block: ${roomBlock}, Capacity: ${roomCap})`, margin, yOffset);
            yOffset += 7;

            // Sections Table
            ['A', 'B', 'C', 'D'].forEach(sectionId => {
                const section = roomArrangement.sections?.[sectionId];
                if (section && Array.isArray(section) && section.length > 0) {
                    const sectionData = section.map(seat => [
                        seat?.seatNumber || `${sectionId}?`,
                        seat?.student || 'N/A',
                        seat?.courseCode || 'N/A',
                        seat?.courseName || 'N/A'
                    ]);

                    autoTable(doc, {
                        startY: yOffset,
                        head: [[`Section ${sectionId}`, 'Roll No / ID', 'Course Code', 'Course Name']],
                        body: sectionData,
                        margin: { left: margin },
                        theme: 'grid',
                        headStyles: { fillColor: [220, 220, 220], textColor: 0, fontSize: 9, fontStyle: 'bold', cellPadding: 2 },
                        styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
                        columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 45 }, 2: { cellWidth: 35 }, 3: { cellWidth: 'auto' } },
                        didDrawPage: (data) => { yOffset = data.cursor.y + 5; } // Update yOffset after table draw
                    });
                    yOffset = doc.lastAutoTable.finalY + 5; // Ensure yOffset is updated correctly
                }
            });
            yOffset += 5; // Space between rooms
        } // End room loop

        // --- Footer --- (Add to each page)
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, pageHeight - 10);
            // Use the main arrangement's createdAt time
            doc.text(`Arrangement Saved: ${new Date(createdAt).toLocaleString()}`, margin, pageHeight - 10);
        }

        return doc;
    } catch (error) {
        console.error(`Error generating PDF for Slot ${slot}:`, error);
        toast.error(`PDF Generation Error (Slot ${slot}): ${error.message}`);
        return null;
    }
};

// --- Main Component ---
const ViewSeatingArrangement = () => {
    const [savedArrangements, setSavedArrangements] = useState([]);
    const [selectedArrangement, setSelectedArrangement] = useState(null); // Stores the full arrangement object
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false); // Ensure this line is present!

    useEffect(() => {
        fetchSavedArrangements();
    }, []);

    const fetchSavedArrangements = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('http://localhost:3000/api/seatingArrangements');
            if (!response.ok) throw new Error('Failed to fetch saved arrangements list');
            const data = await response.json();
            setSavedArrangements(data || []);
        } catch (error) {
            console.error('Error fetching saved arrangements list:', error);
            toast.error('Failed to load list of saved arrangements');
            setSavedArrangements([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Load details for dialog
    const handleViewDetails = async (arrangementId) => {
        setIsLoadingDetails(true);
        setSelectedArrangement(null);
        try {
            const response = await fetch(`http://localhost:3000/api/seatingArrangement/${arrangementId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to fetch details (${response.status})`);
            }
            const data = await response.json();
            if (!data || !data.seatingArrangement || !data.metadata || !data.statistics) {
                throw new Error("Loaded data structure is incomplete or invalid.");
            }
            setSelectedArrangement(data);
        } catch (error) {
            console.error('Error loading arrangement details:', error);
            toast.error(`Failed to load arrangement: ${error.message}`);
            setSelectedArrangement(null);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    // Delete arrangement
    const handleDeleteArrangement = async (arrangementId) => {
        if (!window.confirm('Are you sure you want to delete this seating arrangement?')) return;
        try {
            const response = await fetch(`http://localhost:3000/api/seatingArrangements/${arrangementId}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete arrangement');
            toast.success('Seating arrangement deleted successfully');
            setSavedArrangements((prev) => prev.filter((arr) => arr.id !== arrangementId));
        } catch (error) {
            console.error('Error deleting arrangement:', error);
            toast.error('Failed to delete arrangement');
        }
    };

    // PDF handlers (reuse existing handlers for per-slot and all-slot downloads)
    const handleDownloadSingleSlotPDF = (date, slot, slotData, arrangement) => {
        if (!arrangement || !slotData) {
            toast.error("Cannot generate PDF: Arrangement or slot data missing.");
            return;
        }
        const arrangementName = arrangement.name || 'UnknownArrangement';
        const examDetails = arrangement.metadata?.examDetails || {};
        const createdAt = arrangement.createdAt;

        console.log(`Generating PDF for: Date=${date}, Slot=${slot}`);
        const doc = generatePDFForSlot(date, slot, slotData, arrangementName, examDetails, createdAt);

        if (doc) {
            // Sanitize filename components
            const safeName = arrangementName.replace(/[^a-z0-9]/gi, '_');
            const safeDate = date.replace(/[^a-z0-9]/gi, '-');
            const safeSlot = slot.replace(/[^a-z0-9]/gi, '');
            doc.save(`Seating-${safeName}-${safeDate}-Slot-${safeSlot}.pdf`);
            toast.success(`PDF for Slot ${slot} (${date}) downloaded.`);
        }
        // Errors handled within generatePDFForSlot and show a toast
    };

    // --- ZIP Download Handler ---
    const handleDownloadZIPofAllPDFs = async (arrangement) => {
        if (!arrangement || !arrangement.seatingArrangement) {
            toast.error('No arrangement data loaded to download all PDFs.');
            return;
        }
        setIsDownloading(true); // Indicate download process start
        const arrangementName = arrangement.name || 'UnknownArrangement';
        const examDetails = arrangement.metadata?.examDetails || {};
        const createdAt = arrangement.createdAt;
        let successCount = 0;
        let failCount = 0;
        const zip = new JSZip();
        const pdfPromises = [];
        try {
            Object.entries(arrangement.seatingArrangement).forEach(([date, slots], dateIdx) => {
                Object.entries(slots).forEach(([slot, slotData], slotIdx) => {
                    pdfPromises.push(
                        new Promise((resolve) => {
                            try {
                                let printableDate = (date && !isNaN(new Date(date))) ? new Date(date).toLocaleDateString() : `Day${dateIdx+1}`;
                                let printableSlot = (slot && !isNaN(Number(slot))) ? `Slot${slot}` : `Slot${slotIdx+1}`;
                                const doc = generatePDFForSlot(printableDate, printableSlot, slotData, arrangementName, examDetails, createdAt);
                                if (doc) {
                                    const safeName = arrangementName.replace(/[^a-z0-9]/gi, '_');
                                    const safeDate = printableDate.replace(/[^a-z0-9]/gi, '-');
                                    const safeSlot = printableSlot.replace(/[^a-z0-9]/gi, '');
                                    const fileName = `Seating-${safeName}-${safeDate}-${safeSlot}.pdf`;
                                    const pdfBlob = doc.output('blob');
                                    zip.file(fileName, pdfBlob);
                                    successCount++;
                                    resolve();
                                } else {
                                    failCount++;
                                    resolve();
                                }
                            } catch (error) {
                                console.error(`Error generating PDF for ${date} ${slot}:`, error);
                                failCount++;
                                resolve();
                            }
                        })
                    );
                });
            });
            Promise.all(pdfPromises).then(async () => {
                if (successCount > 0) {
                    const zipBlob = await zip.generateAsync({ type: 'blob' });
                    const url = window.URL.createObjectURL(zipBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'seating-arrangements.zip';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    toast.success(`Successfully downloaded ZIP with ${successCount} PDFs`);
                }
                if (failCount > 0) {
                    toast.error(`Failed to generate ${failCount} PDFs`);
                }
                setIsDownloading(false);
            });
        } catch (error) {
            console.error('Error during ZIP download process:', error);
            toast.error('An unexpected error occurred during the ZIP download process.');
            setIsDownloading(false);
        }
    };

    // --- UI Rendering ---
    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-[calc(100vh-4rem)] mt-16">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-lg">Loading seating arrangements...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] mt-16 bg-gray-100 p-4">
            <ToastContainer position="top-right" autoClose={3000} />
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold">Saved Seating Arrangements</h1>
                </div>

                {/* Arrangement cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {savedArrangements.length > 0 ? (
                        savedArrangements.map((arr) => (
                            <Card key={arr.id} className="bg-white hover:shadow-md transition-shadow">
                                <CardContent className="p-6">
                                    <h2 className="text-xl font-semibold mb-2 truncate" title={arr.name}>{arr.name}</h2>
                                    <div className="space-y-2 text-sm text-gray-600">
                                        <p>Year: {arr.metadata?.examDetails?.year || 'N/A'}</p>
                                        <p>Semester: {arr.metadata?.examDetails?.semester || 'N/A'}</p>
                                        <p>Exam Type: {arr.metadata?.examDetails?.examType || 'N/A'}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-4">
                                        <Button
                                            onClick={() => handleViewDetails(arr.id)}
                                            className="flex-1 bg-gray-900 text-white hover:bg-gray-700"
                                        >
                                            <Eye className="w-4 h-4 mr-2" />
                                            View Details
                                        </Button>
                                        <Button
                                            onClick={() => handleDeleteArrangement(arr.id)}
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
                            <p className="text-gray-500">No seating arrangements found. Generate one first!</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Arrangement Details Dialog */}
            <Dialog open={!!selectedArrangement} onOpenChange={(open) => !open && setSelectedArrangement(null)}>
                <DialogContent className="max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">{selectedArrangement?.name}</DialogTitle>
                    </DialogHeader>
                    {isLoadingDetails ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                        </div>
                    ) : selectedArrangement && (
                        <div className="space-y-6">
                            {/* Metadata Display */}
                            <div className="flex flex-wrap items-center gap-4 mb-4">
                                <span className="text-lg font-semibold">{selectedArrangement.name}</span>
                                <span className="text-md text-gray-600">Exam: {selectedArrangement.metadata?.examDetails?.examType ?? 'N/A'}</span>
                                <span className="text-md text-gray-600">Semester: {selectedArrangement.metadata?.examDetails?.semester ?? 'N/A'}</span>
                                <span className="text-md text-gray-600">Year: {selectedArrangement.metadata?.examDetails?.year ?? 'N/A'}</span>
                                <span className="text-md text-gray-600">Rooms Used: {Object.values(selectedArrangement.statistics || {}).reduce((acc, day) => acc + Object.values(day || {}).reduce((a, s) => a + (s.roomsUsed?.length || 0), 0), 0)}</span>
                                <Button
                                    onClick={() => handleDownloadZIPofAllPDFs(selectedArrangement)}
                                    className="flex items-center gap-2 bg-black hover:bg-gray-900 text-white ml-auto"
                                    disabled={isDownloading || !selectedArrangement}
                                    size="sm"
                                >
                                    {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                                    {isDownloading ? 'Downloading...' : 'Download ZIP of All PDFs'}
                                </Button>
                            </div>
                            {/* Scrollable Slots Area (reuse previous detailed view) */}
                            <div className="max-h-[75vh] overflow-y-auto pr-2 space-y-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#a0aec0 #f7fafc' }}>
                                {selectedArrangement.seatingArrangement && Object.entries(selectedArrangement.seatingArrangement)
                                    .sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB))
                                    .map(([date, slots]) => (
                                        <div key={date} className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
                                            <h3 className="text-lg font-semibold bg-gray-100 px-4 py-3 border-b text-gray-700">{new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                                            {slots && Object.entries(slots)
                                                .sort(([slotA], [slotB]) => parseInt(slotA) - parseInt(slotB))
                                                .map(([slot, slotData]) => {
                                                    if (!slotData || !Array.isArray(slotData.arrangements)) {
                                                        return <div key={slot} className="p-4 text-gray-500">Invalid data for Slot {slot}</div>;
                                                    }
                                                    const slotStats = selectedArrangement.statistics?.[date]?.[slot];
                                                    const sortedSlotArrangements = sortRoomsByPreference(slotData.arrangements);
                                                    return (
                                                        <details key={slot} className="border-b last:border-b-0" open>
                                                            <summary className="px-4 py-3 cursor-pointer hover:bg-gray-50 flex justify-between items-center gap-4">
                                                                <div className="flex-grow">
                                                                    <h4 className="text-md font-semibold inline-block mr-4">Slot: {slot}</h4>
                                                                    <span className="text-xs text-gray-500 mr-2">Students: {slotData.totalStudents ?? 'N/A'}</span>
                                                                    <span className="text-xs text-gray-500 mr-2">Util: {(slotData.utilizationRate ?? 0).toFixed(0)}%</span>
                                                                    <span className={`text-xs px-2 py-0.5 rounded ${slotData.allocationMode?.includes('Partial') ? 'bg-red-100 text-red-700' : (slotData.allocationMode?.includes('Capacity') ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700')}`}>Mode: {slotData.allocationMode ?? 'N/A'}</span>
                                                                </div>
                                                                <Button
                                                                    onClick={e => { e.stopPropagation(); handleDownloadSingleSlotPDF(date, slot, slotData, selectedArrangement); }}
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="flex items-center gap-1 flex-shrink-0"
                                                                >
                                                                    <Download className="w-3 h-3" /> PDF
                                                                </Button>
                                                            </summary>
                                                            <div className="bg-gray-50 p-4">
                                                                {slotStats ? <StatisticsDisplay stats={slotStats} /> : <p className="text-sm text-gray-500">Statistics not found for this slot.</p>}
                                                                <div className="space-y-3 mt-4">
                                                                    {sortedSlotArrangements.length > 0 ? sortedSlotArrangements.map((roomArrangement, roomIndex) => (
                                                                        <details key={roomIndex} className="bg-white rounded border shadow-sm">
                                                                            <summary className="p-3 cursor-pointer hover:bg-gray-50 text-sm font-medium">
                                                                                Room: {roomArrangement.roomName || 'N/A'} (Block: {roomArrangement.block ?? 'N/A'})
                                                                            </summary>
                                                                            <div className="p-3 border-t grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                                                {['A', 'B', 'C', 'D'].map(sectionId => {
                                                                                    const section = roomArrangement.sections?.[sectionId];
                                                                                    const sectionLength = Array.isArray(section) ? section.length : 0;
                                                                                    return (
                                                                                        <div key={sectionId} className="border rounded p-2 bg-gray-50">
                                                                                            <h6 className="font-semibold text-xs mb-2 text-gray-600">Section {sectionId} ({sectionLength})</h6>
                                                                                            <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
                                                                                                {sectionLength > 0 ? section.map((seat, seatIndex) => (
                                                                                                    <div key={seatIndex} className="bg-white p-1.5 rounded border border-gray-200">
                                                                                                        <p className="font-medium">{seat?.seatNumber || `${sectionId}?`}: {seat?.student || 'N/A'}</p>
                                                                                                        <p className="text-gray-500">{seat?.courseCode || 'N/A'}</p>
                                                                                                    </div>
                                                                                                )) : <p className="text-gray-400 italic text-center py-2">Empty</p>}
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </details>
                                                                    )) : <p className="text-center text-gray-500 py-4">No rooms assigned for this slot.</p>}
                                                                </div>
                                                            </div>
                                                        </details>
                                                    );
                                                })}
                                        </div>
                                    ))}
                                {Object.keys(selectedArrangement.seatingArrangement || {}).length === 0 && (
                                    <p className="text-center text-gray-500 py-6">No seating data found in this arrangement.</p>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ViewSeatingArrangement;