import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast, ToastContainer } from 'react-toastify';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'react-toastify/dist/ReactToastify.css';
import { Download, FileDown, Loader2 } from 'lucide-react';
import PropTypes from 'prop-types';

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
        doc.text(`Date: ${new Date(date).toLocaleDateString()} - Slot: ${slot}`, pageWidth / 2, yOffset, { align: 'center' });
        yOffset += 10;

        // --- Slot Statistics Summary ---
        doc.setFontSize(10);
        const statsY = yOffset;
        doc.text(`Total Students: ${slotData.totalStudents ?? 'N/A'}`, margin, statsY);
        // Note: Individual slot capacity might not be directly in slotData, depends on backend structure.
        // Using overall capacity or recalculating might be needed if per-slot capacity is required here.
        // doc.text(`Total Capacity Available: ...`, margin + 70, statsY); // Example if needed
        doc.text(`Slot Utilization: ${(slotData.utilizationRate ?? 0).toFixed(1)}%`, margin + 70, statsY);
        doc.text(`Allocation Mode: ${slotData.allocationMode ?? 'N/A'}`, margin + 140, statsY);
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
                doc.text(`Date: ${new Date(date).toLocaleDateString()} - Slot: ${slot} (cont.)`, pageWidth / 2, yOffset, { align: 'center' });
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

// --- End Copied/Adapted Components & Helpers ---


// --- Main Component ---
const ViewSeatingArrangement = () => {
    const [savedArrangements, setSavedArrangements] = useState([]);
    const [selectedArrangementId, setSelectedArrangementId] = useState('');
    const [loadedArrangementData, setLoadedArrangementData] = useState(null); // Stores the full object { id, name, seatingArrangement, metadata, statistics, ... }
    const [isLoadingList, setIsLoadingList] = useState(false);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false); // State for bulk download

    // Fetch list of saved arrangements on component mount
    useEffect(() => {
        fetchSavedArrangements();
    }, []);

    const fetchSavedArrangements = async () => {
        setIsLoadingList(true);
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
            setIsLoadingList(false);
        }
    };

    // Load details when the button is clicked
    const handleLoadDetails = async () => {
        if (!selectedArrangementId) {
            toast.warn('Please select a seating arrangement.');
            return;
        }
        setIsLoadingDetails(true);
        setLoadedArrangementData(null); // Clear previous
        try {
            const response = await fetch(`http://localhost:3000/api/seatingArrangement/${selectedArrangementId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to fetch details (${response.status})`);
            }
            const data = await response.json();
            // Basic validation of the loaded data structure
            if (!data || !data.seatingArrangement || !data.metadata || !data.statistics) {
                throw new Error("Loaded data structure is incomplete or invalid.");
            }
            setLoadedArrangementData(data);
            toast.success(`Loaded arrangement: ${data.name}`);
        } catch (error) {
            console.error('Error loading arrangement details:', error);
            toast.error(`Failed to load arrangement: ${error.message}`);
            setLoadedArrangementData(null);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    // --- PDF Download Handlers (NEW) ---

    // Handler for downloading a SINGLE slot's PDF
    const handleDownloadSingleSlotPDF = (date, slot, slotData) => {
        if (!loadedArrangementData || !slotData) {
            toast.error("Cannot generate PDF: Arrangement or slot data missing.");
            return;
        }
        const arrangementName = loadedArrangementData.name || 'UnknownArrangement';
        const examDetails = loadedArrangementData.metadata?.examDetails || {};
        const createdAt = loadedArrangementData.createdAt;

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

    // Handler for downloading ALL slots as separate PDFs
    const handleDownloadAllPDFs = () => {
        if (!loadedArrangementData || !loadedArrangementData.seatingArrangement) {
            toast.error('No arrangement data loaded to download all PDFs.');
            return;
        }
        setIsDownloading(true); // Indicate download process start
        const arrangementName = loadedArrangementData.name || 'UnknownArrangement';
        const examDetails = loadedArrangementData.metadata?.examDetails || {};
        const createdAt = loadedArrangementData.createdAt;
        let successCount = 0;
        let failCount = 0;
        let generatedDocs = []; // Store generated docs temporarily

        console.log("Starting download all PDFs process...");

        try {
            Object.entries(loadedArrangementData.seatingArrangement).forEach(([date, slots]) => {
                Object.entries(slots).forEach(([slot, slotData]) => {
                    if (!slotData || !Array.isArray(slotData.arrangements)) {
                        console.warn(`Skipping PDF generation for ${date} - Slot ${slot} due to missing/invalid data.`);
                        failCount++;
                        return; // Skip this slot
                    }
                    try {
                        console.log(`Generating PDF for: Date=${date}, Slot=${slot}`);
                        const doc = generatePDFForSlot(date, slot, slotData, arrangementName, examDetails, createdAt);
                        if (doc) {
                            const safeName = arrangementName.replace(/[^a-z0-9]/gi, '_');
                            const safeDate = date.replace(/[^a-z0-9]/gi, '-');
                            const safeSlot = slot.replace(/[^a-z0-9]/gi, '');
                            generatedDocs.push({ doc, filename: `Seating-${safeName}-${safeDate}-Slot-${safeSlot}.pdf` });
                            successCount++;
                        } else {
                            console.error(`Failed to generate PDF document object for ${date} - Slot ${slot}`);
                            failCount++;
                        }
                    } catch (error) {
                        console.error(`Error generating PDF for ${date} - Slot ${slot}:`, error);
                        toast.error(`Error for ${date} Slot ${slot}: ${error.message}`);
                        failCount++;
                    }
                });
            });

            // Trigger downloads with a slight delay to avoid browser blocking popups
            if (generatedDocs.length > 0) {
                toast.info(`Starting download of ${generatedDocs.length} PDFs...`);
                generatedDocs.forEach((item, index) => {
                    setTimeout(() => {
                        try {
                            item.doc.save(item.filename);
                            // Optional: More granular success toast here if needed
                        } catch (saveError) {
                            console.error(`Error saving PDF ${item.filename}:`, saveError);
                            toast.error(`Failed to save ${item.filename}`);
                            // Decrement success/increment fail if needed, although generation already succeeded
                        }
                    }, index * 300); // Stagger downloads
                });
            }

            // Final summary toast (might appear before all staggered downloads finish)
            setTimeout(() => {
                if (successCount > 0) {
                    toast.success(`Successfully generated ${successCount} slot PDFs.`);
                }
                if (failCount > 0) {
                    toast.warn(`Failed to generate ${failCount} slot PDFs. Check console for details.`);
                }
                if (successCount === 0 && failCount === 0) {
                    toast.info("No valid slots found to generate PDFs for.");
                }
                setIsDownloading(false); // Reset download state
            }, generatedDocs.length * 300 + 500); // Wait until after last potential download


        } catch (error) {
            console.error('Error during bulk PDF download process:', error);
            toast.error('An unexpected error occurred during the download process.');
            setIsDownloading(false); // Reset download state on error
        }
    };

    // REMOVED: Original combined PDF download handler
    // const handleDownloadCombinedPDF = () => { ... }


    return (
        <div className="min-h-[calc(100vh-4rem)] mt-16 bg-gray-100 p-4 md:p-6">
            <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="light" />
            <div className="max-w-7xl mx-auto space-y-6">
                <h1 className="text-2xl md:text-3xl font-bold text-center text-gray-800 mb-8">View Saved Seating Arrangements</h1>

                {/* Selection Card */}
                <Card className="bg-white shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row items-center gap-4">
                            <div className="flex-1 w-full md:w-auto">
                                <label htmlFor="arrangement-select" className="block text-sm font-medium text-gray-700 mb-1">Select Saved Arrangement</label>
                                <Select
                                    onValueChange={(value) => setSelectedArrangementId(value)}
                                    value={selectedArrangementId}
                                    disabled={isLoadingList}
                                >
                                    <SelectTrigger id="arrangement-select">
                                        <SelectValue placeholder={isLoadingList ? "Loading list..." : "Choose an arrangement..."} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {savedArrangements.length > 0 ? savedArrangements.map((arr) => (
                                            <SelectItem key={arr.id} value={arr.id.toString()}>
                                                {arr.name} ({arr.examType} / {arr.semester} / {arr.year}) - Created: {new Date(arr.createdAt).toLocaleDateString()}
                                            </SelectItem>
                                        )) : <SelectItem value="none" disabled>No saved arrangements found</SelectItem>}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button
                                onClick={handleLoadDetails}
                                disabled={!selectedArrangementId || isLoadingDetails}
                                className="w-full md:w-auto mt-4 md:mt-0 md:self-end"
                            >
                                {isLoadingDetails ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                {isLoadingDetails ? 'Loading...' : 'Load Selected Arrangement'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Loading State */}
                {isLoadingDetails && (
                    <Card className="bg-white shadow">
                        <CardContent className="p-10 flex flex-col items-center justify-center text-center">
                            <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mb-4" />
                            <h3 className="text-lg font-medium text-gray-700">Loading Arrangement Details...</h3>
                        </CardContent>
                    </Card>
                )}

                {/* Display Area */}
                {loadedArrangementData && !isLoadingDetails && (
                    <Card className="bg-white shadow-lg">
                        <CardContent className="p-6">
                            {/* Header Section */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b">
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-800">{loadedArrangementData.name}</h2>
                                    <p className="text-sm text-gray-500">Linked to Timetable ID: {loadedArrangementData.timetableId}</p>
                                    <p className="text-sm text-gray-500">Saved On: {new Date(loadedArrangementData.createdAt).toLocaleString()}</p>
                                </div>
                                {/* --- MODIFIED BUTTON SECTION --- */}
                                <div className="flex gap-2 mt-4 md:mt-0">
                                    <Button
                                        onClick={handleDownloadAllPDFs} // Call new handler for all slots
                                        size="sm"
                                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                                        disabled={isDownloading} // Disable while downloading
                                    >
                                        {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                                        {isDownloading ? 'Downloading...' : 'Download All Slot PDFs'}
                                    </Button>
                                    {/* REMOVED the single combined PDF button */}
                                </div>
                                {/* --- END MODIFIED BUTTON SECTION --- */}
                            </div>

                            {/* Metadata Display */}
                            <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs text-gray-500 uppercase tracking-wider">Rooms Used</p>
                                    <p className="text-xl font-semibold">{loadedArrangementData.metadata?.totalRoomsSelectedAndAvailable || 'N/A'}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs text-gray-500 uppercase tracking-wider">Exam Type</p>
                                    <p className="text-xl font-semibold">{loadedArrangementData.metadata?.examDetails?.examType || 'N/A'}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs text-gray-500 uppercase tracking-wider">Semester</p>
                                    <p className="text-xl font-semibold">{loadedArrangementData.metadata?.examDetails?.semester || 'N/A'}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs text-gray-500 uppercase tracking-wider">Year</p>
                                    <p className="text-xl font-semibold">{loadedArrangementData.metadata?.examDetails?.year || 'N/A'}</p>
                                </div>
                            </div>

                            {/* Scrollable Slots Area */}
                            <div className="max-h-[75vh] overflow-y-auto pr-2 space-y-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#a0aec0 #f7fafc' }}>
                                {/* Check if seatingArrangement exists before mapping */}
                                {loadedArrangementData.seatingArrangement && Object.entries(loadedArrangementData.seatingArrangement)
                                    .sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB)) // Sort dates
                                    .map(([date, slots]) => (
                                        <div key={date} className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
                                            <h3 className="text-lg font-semibold bg-gray-100 px-4 py-3 border-b text-gray-700">{new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                                            {/* Check if slots exists before mapping */}
                                            {slots && Object.entries(slots)
                                                .sort(([slotA], [slotB]) => parseInt(slotA) - parseInt(slotB)) // Sort slots numerically
                                                .map(([slot, slotData]) => {
                                                    // Ensure slotData and necessary nested properties exist
                                                    if (!slotData || !Array.isArray(slotData.arrangements)) {
                                                        return <div key={slot} className="p-4 text-gray-500">Invalid data for Slot {slot}</div>;
                                                    }

                                                    const slotStats = loadedArrangementData.statistics?.[date]?.[slot];
                                                    const sortedSlotArrangements = sortRoomsByPreference(slotData.arrangements);

                                                    return (
                                                        <details key={slot} className="border-b last:border-b-0" open>
                                                            {/* --- MODIFIED SLOT SUMMARY --- */}
                                                            <summary className="px-4 py-3 cursor-pointer hover:bg-gray-50 flex justify-between items-center gap-4">
                                                                {/* Display Slot Summary Info */}
                                                                <div className="flex-grow"> {/* Allow text to take space */}
                                                                    <h4 className="text-md font-semibold inline-block mr-4">Slot: {slot}</h4>
                                                                    <span className="text-xs text-gray-500 mr-2">Students: {slotData.totalStudents ?? 'N/A'}</span>
                                                                    <span className="text-xs text-gray-500 mr-2">Util: {(slotData.utilizationRate ?? 0).toFixed(0)}%</span>
                                                                    <span className={`text-xs px-2 py-0.5 rounded ${slotData.allocationMode?.includes('Partial') ? 'bg-red-100 text-red-700' : (slotData.allocationMode?.includes('Capacity') ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700')}`}>
                                                                        Mode: {slotData.allocationMode ?? 'N/A'}
                                                                    </span>
                                                                </div>
                                                                {/* ADDED per-slot download button */}
                                                                <Button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation(); // Prevent details toggle on button click
                                                                        handleDownloadSingleSlotPDF(date, slot, slotData);
                                                                    }}
                                                                    size="sm"
                                                                    variant="outline" // Less prominent style
                                                                    className="flex items-center gap-1 flex-shrink-0" // Prevent button shrinking
                                                                >
                                                                    <Download className="w-3 h-3" /> PDF
                                                                </Button>
                                                            </summary>
                                                            {/* --- END MODIFIED SLOT SUMMARY --- */}
                                                            <div className="bg-gray-50 p-4">
                                                                {/* Slot Statistics Display */}
                                                                {slotStats ? <StatisticsDisplay stats={slotStats} /> : <p className="text-sm text-gray-500">Statistics not found for this slot.</p>}

                                                                {/* Display Sorted Rooms and Sections */}
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
                                {/* Handle case where seatingArrangement might be empty */}
                                {Object.keys(loadedArrangementData.seatingArrangement || {}).length === 0 && (
                                    <p className="text-center text-gray-500 py-6">No seating data found in this arrangement.</p>
                                )}
                            </div>

                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default ViewSeatingArrangement;