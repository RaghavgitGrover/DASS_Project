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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import JSZip from 'jszip';

// Room preferences (as provided)
const ROOM_PREFERENCES = {
  "H-101": 1, "H-102": 2, "H-103": 3, "H-104": 4,
  "H-201": 5, "H-202": 6, "H-203": 7, "H-204": 8,
  "H-301": 9, "H-302": 10, "H-303": 11, "H-304": 12,
  "SH1": 13, "SH2": 14, "H-105": 15, "H-205": 16,
  "CR1": 17, "303": 18, "319": 19, "A3 301": 20,
  "B4 301": 21, "B4 304": 22, "B6 309": 23, "Seminar Hall": 24
};

/**
 * Helper function to get the preference value for a room.
 * This function normalizes the room name by converting
 * names like "H 101" to "H-101" before checking the mapping.
 */
const getRoomPreference = (roomName) => {
  // Direct match
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

const GenerateSeatingArrangements = () => {
  const [timetables, setTimetables] = useState([]);
  const [selectedTimetable, setSelectedTimetable] = useState(null);
  const [isLoadingTimetable, setIsLoadingTimetable] = useState(false);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [seatingArrangement, setSeatingArrangement] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statistics, setStatistics] = useState(null);
  const [metadata, setMetadata] = useState(null);

  // State for dialog-based save
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [timetableName, setTimetableName] = useState('');

  // When a timetable is selected, setup a default name for the seating arrangement
  useEffect(() => {
    if (selectedTimetable) {
      setTimetableName(`Seating for ${selectedTimetable.name || `Timetable ${selectedTimetable.id}`}`);
    }
  }, [selectedTimetable]);

  useEffect(() => {
    fetchTimetables();
  }, []);

  const fetchTimetables = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/timetables');
      if (!response.ok) throw new Error('Failed to fetch timetables');
      const data = await response.json();
      setTimetables(data);
    } catch (error) {
      console.error('Error fetching timetables:', error);
      toast.error('Failed to load timetables');
    }
  };

  const fetchRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const response = await fetch('http://localhost:3000/api/rooms');
      if (!response.ok) throw new Error('Failed to fetch rooms');
      const data = await response.json();
      // Sort rooms based on the normalized preference value
      const sortedRooms = [...data].sort((a, b) => getRoomPreference(a.name) - getRoomPreference(b.name));
      setRooms(sortedRooms);
      toast.success('Rooms loaded successfully');
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const loadTimetableDetails = async (timetableId) => {
    setIsLoadingTimetable(true);
    try {
      const response = await fetch(`http://localhost:3000/api/timetable/${timetableId}`);
      if (!response.ok) throw new Error('Failed to fetch timetable details');
      const data = await response.json();
      // Use data.id and data.name for selectedTimetable
      setSelectedTimetable({
        ...data,
        id: data.id || data._id, // fallback to _id if id is missing
        name: data.name || data.timetableName || ''
      });
      console.log("Selected Timetable:", data);
      toast.success('Timetable loaded successfully');
    } catch (error) {
      console.error('Error loading timetable:', error);
      toast.error('Failed to load timetable details');
    } finally {
      setIsLoadingTimetable(false);
    }
  };

  const generateSeatingArrangement = async () => {
    if (!selectedTimetable || rooms.length === 0) {
      toast.error('Please load both timetable and rooms first');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('http://localhost:3000/api/generateSeatingArrangement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timetableId: selectedTimetable.id, // ensure this is a string
          roomIds: rooms.map(room => room.id)
        })
      });
      if (!response.ok) throw new Error('Failed to generate seating arrangement');
      const data = await response.json();
      setSeatingArrangement(data.seatingArrangement);
      setStatistics(data.statistics);
      setMetadata(data.metadata);
      toast.success('Seating arrangement generated successfully');
    } catch (error) {
      console.error('Error generating seating arrangement:', error);
      toast.error('Failed to generate seating arrangement');
    } finally {
      setIsGenerating(false);
    }
  };

  // Updated PDF generation function to use normalized room preference sorting
  const generatePDF = (date, slot, slotData) => {
    try {
      const doc = new jsPDF('landscape');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;

      // Add header
      doc.setFontSize(16);
      doc.text('IIIT Hyderabad - Seating Arrangement', pageWidth / 2, margin + 10, { align: 'center' });
      doc.setFontSize(14);
      doc.text(`Date: ${date} - Slot: ${slot}`, pageWidth / 2, margin + 20, { align: 'center' });

      // Add statistics
      doc.setFontSize(10);
      doc.text(`Total Students: ${slotData.totalStudents}`, margin, margin + 30);
      doc.text(`Total Capacity: ${slotData.totalCapacity}`, margin + 80, margin + 30);
      doc.text(`Utilization: ${slotData.utilizationRate.toFixed(1)}%`, margin + 160, margin + 30);

      let yOffset = margin + 40;

      // Sort room arrangements by normalized preference
      const sortedArrangements = [...slotData.arrangements].sort(
        (a, b) => getRoomPreference(a.roomName) - getRoomPreference(b.roomName)
      );

      // Add room arrangements
      sortedArrangements.forEach(roomArrangement => {
        // Check if we need a new page
        if (yOffset > pageHeight - 20) {
          doc.addPage('landscape');
          yOffset = margin;
        }

        // Room header
        doc.setFontSize(12);
        doc.text(
          `Room: ${roomArrangement.roomName} (Block: ${roomArrangement.block}, Capacity: ${roomArrangement.capacity})`,
          margin,
          yOffset
        );
        yOffset += 10;

        // Process each section
        ['A', 'B', 'C', 'D'].forEach(section => {
          if (roomArrangement.sections[section].length > 0) {
            const sectionData = roomArrangement.sections[section].map(seat => [
              `${section}${seat.seatNumber}`,
              seat.student,
              seat.courseCode,
              seat.courseName
            ]);

            autoTable(doc, {
              startY: yOffset,
              head: [[`Section ${section}`, 'Student', 'Course Code', 'Course Name']],
              body: sectionData,
              margin: { left: margin },
              theme: 'grid',
              headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
              styles: {
                fontSize: 8,
                cellPadding: 2
              },
              columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: 40 },
                2: { cellWidth: 30 },
                3: { cellWidth: 'auto' }
              }
            });

            yOffset = doc.lastAutoTable.finalY + 5;
          }
        });

        yOffset += 10;
      });

      // Add footer
      doc.setFontSize(8);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, pageHeight - 10);

      return doc;
    } catch (error) {
      console.error('Error generating PDF:', error);
      return null;
    }
  };

  const handleDownloadPDF = (date, slot, slotData) => {
    try {
      const doc = generatePDF(date, slot, slotData);
      if (doc) {
        doc.save(`seating-arrangement-${date}-${slot}.pdf`);
        toast.success('PDF downloaded successfully');
      } else {
        throw new Error('Failed to generate PDF');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  // --- ZIP Download Handler ---
  const handleDownloadZIPofAllPDFs = async () => {
    if (!seatingArrangement) {
      toast.error('No seating arrangement to download');
      return;
    }
    try {
      const zip = new JSZip();
      let successCount = 0;
      let failCount = 0;
      const pdfPromises = [];
      Object.entries(seatingArrangement).forEach(([date, slots]) => {
        Object.entries(slots).forEach(([slot, slotData]) => {
          pdfPromises.push(
            new Promise((resolve) => {
              try {
                const doc = generatePDF(date, slot, slotData);
                if (doc) {
                  // jsPDF's output() is synchronous for 'blob' type
                  const pdfBlob = doc.output('blob');
                  const fileName = `seating-arrangement-${date}-${slot}.pdf`;
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
      });
    } catch (error) {
      console.error('Error downloading ZIP:', error);
      toast.error('Failed to download ZIP');
    }
  };

  // --- Modified Save Functions ---
  // When clicking the button to save, open the dialog.
  const handleSaveSeatingArrangement = async () => {
    // Check that all required data is present
    if (!selectedTimetable || !selectedTimetable.id) {
      toast.error('No timetable selected.');
      return;
    }
    if (!seatingArrangement) {
      toast.error('No seating arrangement generated to save.');
      return;
    }
    if (!metadata) {
      toast.error('Metadata is missing. Cannot save.');
      return;
    }
    if (!statistics) {
      toast.error('Statistics are missing. Cannot save.');
      return;
    }

    setSaveDialogOpen(true);
  };

  // Actual saving happens when the user clicks the Save button in the dialog.
  const handleSave = async () => {
    // Use the current value of timetableName (which may have been edited)
    const arrangementName = timetableName;
    // Defensive: ensure arrangement is not null and is valid
    if (!selectedTimetable || !selectedTimetable.id) {
      toast.error('No timetable selected.');
      return;
    }
    if (!seatingArrangement || typeof seatingArrangement !== 'object') {
      toast.error('No valid seating arrangement to save.');
      return;
    }
    if (!metadata) {
      toast.error('Metadata is missing. Cannot save.');
      return;
    }
    if (!statistics) {
      toast.error('Statistics are missing. Cannot save.');
      return;
    }
    // Defensive: ensure arrangement is serializable
    let arrangementToSave = seatingArrangement;
    try {
      JSON.stringify(arrangementToSave);
    } catch (e) {
      toast.error('Seating arrangement is not serializable.');
      return;
    }
    console.log("Attempting to save arrangement with data:", {
      name: arrangementName,
      id: selectedTimetable.id,
      seatingArrangement: arrangementToSave,
      metadata,
      statistics
    });

    try {
      // Send ALL required fields in the body
      const response = await fetch('http://localhost:3000/api/saveSeatingArrangement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: arrangementName,
          id: selectedTimetable.id,
          seatingArrangement: arrangementToSave,
          metadata,
          statistics
        })
      });

      const responseBody = await response.json(); // Read body for success/error message

      if (!response.ok) {
        console.error("Save failed:", response.status, responseBody);
        throw new Error(responseBody.message || `Failed to save seating arrangement (${response.status})`);
      }

      toast.success(`Seating arrangement saved successfully (ID: ${responseBody.id || responseBody.data?.id || 'N/A'})`);
      // Close the dialog on success
      setSaveDialogOpen(false);
    } catch (error) {
      console.error('Error saving seating arrangement:', error);
      toast.error(`Failed to save seating arrangement: ${error.message}`);
    }
  };
  // --- End Modified Save Functions ---

  const StatisticsDisplay = ({ stats }) => {
    if (!stats || !stats.roomsUsed) {
      return (
        <div className="mt-4 space-y-4 border-t pt-4">
          <p className="text-gray-600 text-center">No statistics available</p>
        </div>
      );
    }

    // Sort rooms in statistics using normalized preference
    const sortedRooms = [...stats.roomsUsed].sort((a, b) => getRoomPreference(a.name) - getRoomPreference(b.name));

    return (
      <div className="mt-4 space-y-4 border-t pt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <h6 className="text-sm font-medium text-blue-700">Rooms Utilization</h6>
            <div className="mt-2 space-y-2">
              {sortedRooms.map((room, index) => (
                <div key={index} className="text-sm">
                  <span className="font-medium">{room.name}:</span>
                  <span className="text-gray-600"> {room.studentsPlaced}/{room.capacity} students</span>
                  <span className="text-gray-500"> ({((room.studentsPlaced / room.capacity) * 100).toFixed(1)}%)</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <h6 className="text-sm font-medium text-red-700">Unassigned Students</h6>
            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
              {stats.unassignedDetails && stats.unassignedDetails.map((course, index) => (
                <div key={index} className="text-sm">
                  <div className="font-medium">{course.courseCode}:</div>
                  <div className="text-gray-600 text-xs">
                    {course.students.map((student, idx) => (
                      <span key={idx} className="inline-block mr-2">{student}</span>
                    ))}
                  </div>
                </div>
              ))}
              {(!stats.unassignedDetails || stats.unassignedDetails.length === 0) && (
                <p className="text-sm text-gray-600">All students assigned successfully!</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  StatisticsDisplay.propTypes = {
    stats: PropTypes.shape({
      roomsUsed: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string,
        capacity: PropTypes.number,
        studentsPlaced: PropTypes.number
      })),
      unassignedDetails: PropTypes.arrayOf(PropTypes.shape({
        courseCode: PropTypes.string,
        students: PropTypes.arrayOf(PropTypes.string)
      }))
    })
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] mt-16 bg-gray-100 p-4">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-center mb-8">Generate Seating Arrangement</h1>

        {/* Timetable Selection */}
        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="space-y-4">
              <label className="text-sm font-medium">Select Timetable</label>
              <Select onValueChange={(value) => setSelectedTimetable(timetables.find(t => t.id === value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a timetable" />
                </SelectTrigger>
                <SelectContent>
                  {timetables.map((timetable) => (
                    <SelectItem key={timetable.id} value={timetable.id}>
                      {timetable.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={() => selectedTimetable && loadTimetableDetails(selectedTimetable.id)}
                disabled={!selectedTimetable || isLoadingTimetable}
                className="w-full"
              >
                {isLoadingTimetable ? 'Loading Timetable...' : 'Load Timetable'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Timetable Details */}
        {selectedTimetable && selectedTimetable.data && (
          <Card className="bg-white">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-6">Timetable</h2>
              {/* Timetable Grid */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border p-2 font-semibold">Date/Time</th>
                      {!(selectedTimetable.data?.examType === "endsem") && <th className="border p-2 font-semibold">Slot 1</th>}
                      {!(selectedTimetable.data?.examType === "endsem") && <th className="border p-2 font-semibold">Slot 2</th>}
                      {!(selectedTimetable.data?.examType === "endsem") && <th className="border p-2 font-semibold">Slot 3</th>}
                      {!(selectedTimetable.data?.examType === "endsem") && <th className="border p-2 font-semibold">Slot 4</th>}
                      {(selectedTimetable.data?.examType === "endsem") && <th className="border p-2 font-semibold">Slot 1</th>}
                      {(selectedTimetable.data?.examType === "endsem") && <th className="border p-2 font-semibold">Slot 2</th>}
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
                              {!(selectedTimetable.data?.examType === "endsem") &&
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
                              {(selectedTimetable.data?.examType === "endsem") &&
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
                        return null;
                      }
                    })()}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Load Rooms Button */}
        <Button
          onClick={fetchRooms}
          disabled={isLoadingRooms}
          className="w-full"
        >
          {isLoadingRooms ? 'Loading Rooms...' : 'Load Room Details'}
        </Button>

        {/* Rooms Details */}
        {rooms.length > 0 && (
          <Card className="bg-white">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-6">Available Rooms</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.map(room => (
                  <div key={room.id} className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium">{room.name}</h3>
                    <p className="text-sm text-gray-600">Capacity: {room.capacity}</p>
                    <p className="text-sm text-gray-600">Block: {room.block}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Generate Seating Arrangement Button */}
        <Button
          onClick={generateSeatingArrangement}
          disabled={!selectedTimetable || rooms.length === 0 || isGenerating}
          className="w-full"
        >
          {isGenerating ? 'Generating...' : 'Generate Seating Arrangement'}
        </Button>

        {/* Loading State */}
        {isGenerating && (
          <Card className="bg-white">
            <CardContent className="p-6 flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-gray-500 mb-4" />
              <h3 className="text-lg font-medium text-center">Generating Seating Arrangement</h3>
              <p className="text-sm text-gray-500 text-center mt-2">
                This may take a few moments. Please wait while we optimize the seating arrangements...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Seating Arrangement Display */}
        {seatingArrangement && !isGenerating && (
          <Card className="bg-white">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Seating Arrangement</h2>
                <Button
                  onClick={handleDownloadZIPofAllPDFs}
                  className="flex items-center gap-2"
                >
                  <FileDown className="w-4 h-4" />
                  Download ZIP of All PDFs
                </Button>
              </div>

              {metadata && (
                <div className="mb-6 grid grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Total Rooms</p>
                    <p className="text-2xl font-bold">{metadata.totalRoomsSelectedAndAvailable || 0}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Exam Type</p>
                    <p className="text-2xl font-bold">{metadata.examDetails?.examType || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Semester</p>
                    <p className="text-2xl font-bold">{metadata.examDetails?.semester || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Year</p>
                    <p className="text-2xl font-bold">{metadata.examDetails?.year || 'N/A'}</p>
                  </div>
                </div>
              )}

              <div className="max-h-[70vh] overflow-y-auto pr-4" style={{ scrollbarWidth: 'thin' }}>
                {Object.entries(seatingArrangement).map(([date, slots]) => (
                  <div key={date} className="mb-6">
                    <h3 className="text-lg font-medium sticky top-0 bg-white py-2 z-10">{date}</h3>
                    {Object.entries(slots).map(([slot, slotData]) => {
                      // Sort room arrangements for display using the helper
                      const sortedArrangements = [...slotData.arrangements].sort(
                        (a, b) => getRoomPreference(a.roomName) - getRoomPreference(b.roomName)
                      );

                      return (
                        <div key={slot} className="mb-6 border rounded-lg p-4">
                          <div className="flex justify-between items-center mb-4 sticky top-10 bg-white py-2 z-10">
                            <h4 className="text-lg font-medium">{slot}</h4>
                            <div className="flex items-center gap-4">
                              <div className="text-sm text-gray-600">
                                <span className="mr-4">Total Students: {slotData.totalStudents}</span>
                                <span>Utilization: {slotData.utilizationRate.toFixed(1)}%</span>
                              </div>
                              <Button
                                onClick={() => handleDownloadPDF(date, slot, slotData)}
                                size="sm"
                                className="flex items-center gap-2"
                              >
                                <Download className="w-4 h-4" />
                                Download PDF
                              </Button>
                            </div>
                          </div>

                          {/* Add Statistics Display */}
                          {statistics && statistics[date] && statistics[date][slot] && (
                            <StatisticsDisplay stats={statistics[date][slot]} />
                          )}

                          <div className="space-y-4 mt-4">
                            {sortedArrangements.map((roomArrangement, roomIndex) => (
                              <details key={roomIndex} className="bg-gray-50 rounded-lg">
                                <summary className="p-4 cursor-pointer hover:bg-gray-100">
                                  <div className="flex justify-between items-center">
                                    <h5 className="font-medium">{roomArrangement.roomName}</h5>
                                    <span className="text-sm text-gray-600">
                                      Block: {roomArrangement.block}
                                    </span>
                                  </div>
                                </summary>
                                <div className="p-4 border-t">
                                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                                    {['A', 'B', 'C', 'D'].map(section => (
                                      <div key={section} className="border rounded-lg p-4">
                                        <h6 className="font-medium mb-4">Section {section}</h6>
                                        <div className="space-y-2">
                                          {roomArrangement.sections[section].map((seat, seatIndex) => (
                                            <div key={seatIndex} className="text-sm bg-white p-2 rounded border">
                                              <p className="font-medium">{seat.seatNumber}</p>
                                              <p>{seat.student}</p>
                                              <p className="text-gray-600">{seat.courseCode}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </details>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {seatingArrangement && !isGenerating && (
          <div className="flex gap-4">
            <Button onClick={handleSaveSeatingArrangement} className="flex-1">
              Save Seating Arrangement
            </Button>
          </div>
        )}
      </div>

      {/* Save Dialog */}
      {selectedTimetable && (
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Seating Arrangement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Seating Arrangement Name</Label>
                <Input
                  id="name"
                  value={timetableName}
                  onChange={(e) => setTimetableName(e.target.value)}
                  placeholder={`Seating for ${selectedTimetable.name || `Timetable ${selectedTimetable.id}`}`}
                />
              </div>
              <Button onClick={handleSave} className="w-full">
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default GenerateSeatingArrangements;
