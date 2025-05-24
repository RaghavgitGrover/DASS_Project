import { useState, useEffect, useRef } from 'react';
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

const GenerateInvigilation = () => {
  const [seatingArrangements, setSeatingArrangements] = useState([]);
  const [selectedSeatingArrangement, setSelectedSeatingArrangement] = useState(null);
  const [pendingSeatingArrangementId, setPendingSeatingArrangementId] = useState(null);
  const [isLoadingSeatingArrangement, setIsLoadingSeatingArrangement] = useState(false);
  const [isLoadingInvigilators, setIsLoadingInvigilators] = useState(false);
  const [invigilatorsData, setInvigilatorsData] = useState({ faculty: [], staff: [] });
  const [invigilation, setInvigilation] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dutyCount, setDutyCount] = useState({});
  const [warnings, setWarnings] = useState([]);
  const [dutySummary, setDutySummary] = useState({ faculty: {}, staff: {} });

  // State for dialog-based save
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [assignmentName, setAssignmentName] = useState('');

  // When a seating arrangement is selected, setup a default name for the invigilation assignment
  useEffect(() => {
    if (selectedSeatingArrangement) {
      setAssignmentName(`Invigilation for ${selectedSeatingArrangement.name || `Seating Plan ${selectedSeatingArrangement.id}`}`);
    }
  }, [selectedSeatingArrangement]);

  useEffect(() => {
    fetchSeatingArrangements();
  }, []);

  const fetchSeatingArrangements = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/seatingArrangements');
      if (!response.ok) throw new Error('Failed to fetch seating arrangements');
      const data = await response.json();
      setSeatingArrangements(data);
    } catch (error) {
      console.error('Error fetching seating arrangements:', error);
      toast.error('Failed to load seating arrangements');
    }
  };

  const fetchInvigilators = async () => {
    setIsLoadingInvigilators(true);
    try {
      const response = await fetch('http://localhost:3000/api/invigilators');
      if (!response.ok) throw new Error('Failed to fetch invigilators');
      const data = await response.json();
      console.log("Invigilators data:", data);

      // Convert objects to arrays if needed
      const facultyArray = Array.isArray(data.Faculty) ? data.Faculty :
                          Object.values(data.Faculty || {});
      const staffArray = Array.isArray(data.Staff) ? data.Staff :
                        Object.values(data.Staff || {});

      setInvigilatorsData({
        faculty: facultyArray,
        staff: staffArray
      });

      console.log("Updated invigilatorsData:", {
        faculty: facultyArray,
        staff: staffArray
      });

      toast.success('Invigilators loaded successfully');
    } catch (error) {
      console.error('Error fetching invigilators:', error);
      toast.error('Failed to load invigilators');
    } finally {
      setIsLoadingInvigilators(false);
    }
  };

  const loadSeatingArrangementDetails = async (seatingId) => {
    setIsLoadingSeatingArrangement(true);
    try {
      const response = await fetch(`http://localhost:3000/api/seatingArrangement/${seatingId}`);
      if (!response.ok) throw new Error('Failed to fetch seating arrangement details');
      const data = await response.json();
      setSelectedSeatingArrangement(data);
      console.log("Selected Seating Arrangement:", data);
      toast.success('Seating arrangement loaded successfully');
    } catch (error) {
      console.error('Error loading seating arrangement:', error);
      toast.error('Failed to load seating arrangement details');
    } finally {
      setIsLoadingSeatingArrangement(false);
    }
  };

  const generateInvigilation = async () => {
    if (!selectedSeatingArrangement || !invigilatorsData.faculty.length || !invigilatorsData.staff.length) {
      toast.error('Please load both seating arrangement and invigilators first');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('http://localhost:3000/api/assign-invigilators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          seatingId: selectedSeatingArrangement.id
        })
      });

      if (!response.ok) throw new Error('Failed to generate invigilation assignment');

      const data = await response.json();
      setInvigilation(data.data.assigned);
      setDutyCount(data.data.dutyCount);
      setWarnings(data.data.warnings);
      setDutySummary(data.data.dutySummary);

      toast.success('Invigilation assignment generated successfully');
    } catch (error) {
      console.error('Error generating invigilation assignment:', error);
      toast.error('Failed to generate invigilation assignment');
    } finally {
      setIsGenerating(false);
    }
  };

  const generatePDF = () => {
    try {
      const doc = new jsPDF();
      const tableRows = [];

      // Convert invigilation data to table rows
      for (const date of Object.keys(invigilation)) {
        const slots = invigilation[date];

        for (const slot of Object.keys(slots)) {
          const rooms = slots[slot];

          for (const roomId of Object.keys(rooms)) {
            const { roomName, invigilators } = rooms[roomId];

            const invigilatorList = invigilators
              .map(inv => `${inv.name} (${inv.type})`)
              .join(', ');

            tableRows.push([
              date,
              slot,
              `${roomName} (${roomId})`,
              invigilatorList
            ]);
          }
        }
      }

      autoTable(doc, {
        head: [['Date', 'Slot', 'Room No', 'Invigilators']],
        body: tableRows,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [0, 102, 204] },
        margin: { top: 20 },
      });

      // Add a summary page
      doc.addPage();
      doc.setFontSize(16);
      doc.text('Invigilation Duty Summary', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });

      // Faculty summary
      doc.setFontSize(14);
      doc.text('Faculty', 20, 40);

      const facultyRows = Object.entries(dutySummary.faculty).map(([name, count]) => [name, count]);
      autoTable(doc, {
        startY: 45,
        head: [['Faculty Name', 'Number of Duties']],
        body: facultyRows,
        margin: { left: 20, right: 20 },
        headStyles: { fillColor: [0, 102, 204] },
      });

      // Staff summary
      doc.setFontSize(14);
      const staffStartY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : 150;
      doc.text('Staff', 20, staffStartY);

      const staffRows = Object.entries(dutySummary.staff).map(([name, count]) => [name, count]);
      autoTable(doc, {
        startY: staffStartY + 5,
        head: [['Staff Name', 'Number of Duties']],
        body: staffRows,
        margin: { left: 20, right: 20 },
        headStyles: { fillColor: [0, 102, 204] },
      });

      // Add warnings page if there are any
      if (warnings.length > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.text('Warnings & Notices', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });

        const warningRows = warnings.map(warning => [warning]);
        autoTable(doc, {
          startY: 30,
          head: [['Warning Message']],
          body: warningRows,
          styles: { cellWidth: 'auto', fontSize: 8 },
          headStyles: { fillColor: [255, 87, 34] },
          margin: { left: 20, right: 20 },
        });
      }

      return doc;
    } catch (error) {
      console.error('Error generating PDF:', error);
      return null;
    }
  };

  const handleDownloadPDF = () => {
    try {
      const doc = generatePDF();
      if (doc) {
        doc.save(`invigilation-assignment-${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success('PDF downloaded successfully');
      } else {
        throw new Error('Failed to generate PDF');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  // Save invigilation assignment
  const handleSave = async () => {
    if (!selectedSeatingArrangement || !invigilation) {
      toast.error('Please generate an invigilation assignment and select a seating arrangement first.');
      return;
    }
    try {
      // Ensure invigilator names are full names from the invigilatorsData mapping
      const getFullName = (id, type) => {
        let invObj = null;
        if (type === 'faculty') {
          invObj = invigilatorsData.faculty.find(fac => fac.id === id);
        } else if (type === 'staff') {
          invObj = invigilatorsData.staff.find(st => st.id === id);
        }
        return invObj ? `${invObj.firstName || ''} ${invObj.lastName || ''}`.trim() : id;
      };

      // Deep clone invigilation object and update invigilator names
      const updatedInvigilation = JSON.parse(JSON.stringify(invigilation));
      Object.keys(updatedInvigilation).forEach(dateKey => {
        const slots = updatedInvigilation[dateKey];
        Object.keys(slots).forEach(slotKey => {
          const rooms = slots[slotKey];
          Object.keys(rooms).forEach(roomId => {
            const room = rooms[roomId];
            if (Array.isArray(room.invigilators)) {
              room.invigilators = room.invigilators.map(inv => ({
                ...inv,
                name: getFullName(inv.id, inv.type)
              }));
            }
          });
        });
      });

      // Generate a unique ID and createdAt timestamp
      const id = selectedSeatingArrangement.id + '_' + (new Date().getTime());
      const createdAt = new Date().toISOString();
      const response = await fetch('http://localhost:3000/api/saveInvigilationAssignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: assignmentName,
          seatingArrangementId: selectedSeatingArrangement.id,
          invigilation: updatedInvigilation,
          dutyCount,
          warnings,
          dutySummary,
          createdAt
        })
      });
      const responseBody = await response.json();
      if (!response.ok) throw new Error(responseBody.message || 'Failed to save assignment');
      toast.success('Invigilation assignment saved successfully!');
      setSaveDialogOpen(false);
    } catch (error) {
      console.error('Error saving assignment:', error);
      toast.error('Failed to save assignment');
    }
  };

  // Component for displaying duty summary
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const [popupSearchQuery, setPopupSearchQuery] = useState("");
  const popupInputRef = useRef(null);
  const mainInputRef = useRef(null);

  const handleDutySearch = (query, triggerPopup = false) => {
    if (triggerPopup) {
      setPopupSearchQuery(query);
      setShowSearchPopup(true);
      doPopupSearch(query);
      return;
    }
    setSearchQuery(query);
  };

  useEffect(() => {
    if (showSearchPopup && popupInputRef.current) {
      popupInputRef.current.focus();
    }
  }, [showSearchPopup]);

  const doPopupSearch = (query) => {
    const q = query.trim().toLowerCase();
    let results = [];
    const seen = new Set();
    Object.entries(dutySummary?.faculty || {}).forEach(([name, count]) => {
      const faculty = invigilatorsData.faculty.find(f => f.name.toLowerCase().includes(q) || (f.email && f.email.toLowerCase().includes(q)));
      if (faculty && !seen.has(faculty.email || faculty.name)) {
        seen.add(faculty.email || faculty.name);
        let assignments = [];
        Object.entries(invigilation || {}).forEach(([date, slots]) => {
          Object.entries(slots).forEach(([slot, rooms]) => {
            Object.entries(rooms).forEach(([roomId, roomData]) => {
              if (roomData.invigilators.some(inv => inv.name === faculty.name || (inv.email && inv.email === faculty.email))) {
                assignments.push({ date, slot, roomName: roomData.roomName });
              }
            });
          });
        });
        results.push({ ...faculty, type: 'faculty', count, assignments });
      }
    });
    Object.entries(dutySummary?.staff || {}).forEach(([name, count]) => {
      const staff = invigilatorsData.staff.find(s => s.name.toLowerCase().includes(q) || (s.email && s.email.toLowerCase().includes(q)));
      if (staff && !seen.has(staff.email || staff.name)) {
        seen.add(staff.email || staff.name);
        let assignments = [];
        Object.entries(invigilation || {}).forEach(([date, slots]) => {
          Object.entries(slots).forEach(([slot, rooms]) => {
            Object.entries(rooms).forEach(([roomId, roomData]) => {
              if (roomData.invigilators.some(inv => inv.name === staff.name || (inv.email && inv.email === staff.email))) {
                assignments.push({ date, slot, roomName: roomData.roomName });
              }
            });
          });
        });
        results.push({ ...staff, type: 'staff', count, assignments });
      }
    });
    setSearchResults(results);
  };

  const DutySummaryDisplay = ({ summary }) => {
    if (!summary || (!summary.faculty && !summary.staff)) {
      return (
        <div className="mt-4 space-y-4 border-t pt-4">
          <p className="text-gray-600 text-center">No duty summary available</p>
        </div>
      );
    }

    return (
      <div className="mt-4 space-y-4 border-t pt-4">
        {/* Search Bar */}
        <form className="mb-4 flex items-center gap-2 w-full" onSubmit={e => { e.preventDefault(); handleDutySearch(searchQuery, true); }}>
          <input
            ref={mainInputRef}
            type="text"
            className="border rounded px-3 py-2 w-full"
            style={{ width: '100%' }}
            placeholder="Search invigilator by name or email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <Button type="submit">Search</Button>
        </form>
        {/* Popup for search results */}
        {showSearchPopup && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full relative">
              <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-800" onClick={() => setShowSearchPopup(false)}>&times;</button>
              <h4 className="text-lg font-semibold mb-4">Search Results</h4>
              <input
                ref={popupInputRef}
                type="text"
                className="border rounded px-3 py-2 w-full mb-4"
                style={{ width: '100%' }}
                placeholder="Refine search..."
                value={popupSearchQuery}
                onChange={e => { setPopupSearchQuery(e.target.value); doPopupSearch(e.target.value); }}
              />
              <ul className="space-y-4 max-h-96 overflow-y-auto">
                {searchResults.length === 0 && <li className="text-gray-500">No results found.</li>}
                {searchResults.map((result, idx) => (
                  <li key={idx} className={`rounded p-3 ${result.type === 'faculty' ? 'bg-blue-50' : 'bg-green-50'}`}>
                    <div className="font-medium">{result.name} <span className="text-xs ml-2 px-2 py-1 rounded-full bg-gray-200">{result.type}</span></div>
                    <div className="text-sm text-gray-500">Email: {result.email || 'N/A'}</div>
                    <div className="text-sm text-gray-500">Total Duties: {result.count}</div>
                    <div className="mt-2">
                      <div className="font-semibold text-sm mb-1">Assignments:</div>
                      <ul className="list-disc pl-5 text-sm">
                        {result.assignments.map((a, i) => (
                          <li key={i}>{a.roomName} | {a.date} | {a.slot}</li>
                        ))}
                      </ul>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <h6 className="text-sm font-medium text-blue-700">Faculty Duties</h6>
            <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
              {Object.entries(summary.faculty)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count], index) => (
                  <div key={index} className="text-sm">
                    <span className="font-medium">{name}:</span>
                    <span className="text-gray-600"> {count} duties</span>
                  </div>
                ))}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <h6 className="text-sm font-medium text-green-700">Staff Duties</h6>
            <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
              {Object.entries(summary.staff)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count], index) => (
                  <div key={index} className="text-sm">
                    <span className="font-medium">{name}:</span>
                    <span className="text-gray-600"> {count} duties</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  DutySummaryDisplay.propTypes = {
    summary: PropTypes.shape({
      faculty: PropTypes.object,
      staff: PropTypes.object
    })
  };

  // Component for displaying warnings
  const WarningsDisplay = ({ warnings }) => {
    if (!warnings || warnings.length === 0) {
      return (
        <div className="mt-4 space-y-4 border-t pt-4">
          <p className="text-gray-600 text-center">No warnings found - all assignments are optimal!</p>
        </div>
      );
    }

    return (
      <div className="mt-4 space-y-4 border-t pt-4">
        <div className="bg-red-50 rounded-lg p-4">
          <h6 className="text-sm font-medium text-red-700">Warnings</h6>
          <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
            {warnings.map((warning, index) => (
              <div key={index} className="text-sm text-red-600">
                {warning}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  WarningsDisplay.propTypes = {
    warnings: PropTypes.arrayOf(PropTypes.string)
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] mt-16 bg-gray-100 p-4">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-center mb-8">Generate Invigilation Assignment</h1>

        {/* Seating Arrangement Selection */}
        <Card className="bg-white">
          <CardContent className="p-6">
            <div className="space-y-4">
              <label className="text-sm font-medium">Select Seating Arrangement</label>
              <Select onValueChange={(value) => setPendingSeatingArrangementId(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a seating arrangement" />
                </SelectTrigger>
                <SelectContent>
                  {seatingArrangements.map((seating) => (
                    <SelectItem key={seating.id} value={seating.id}>
                      {seating.name || `Seating Plan ${seating.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => {
                  const selected = seatingArrangements.find(s => s.id === parseInt(pendingSeatingArrangementId) || s.id === pendingSeatingArrangementId);
                  setSelectedSeatingArrangement(selected);
                  if (selected) loadSeatingArrangementDetails(selected.id);
                }}
                disabled={!pendingSeatingArrangementId || isLoadingSeatingArrangement}
                className="w-full"
              >
                {isLoadingSeatingArrangement ? 'Loading Seating Arrangement...' : 'Load Seating Arrangement'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Seating Arrangement Details */}
        {selectedSeatingArrangement && (
          <Card className="bg-white">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Seating Arrangement Details</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="text-lg font-medium">{selectedSeatingArrangement.name || `Seating Plan ${selectedSeatingArrangement.id}`}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Year</p>
                  <p className="text-lg font-medium">{selectedSeatingArrangement.metadata?.examDetails?.year || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Semester</p>
                  <p className="text-lg font-medium">{selectedSeatingArrangement.metadata?.examDetails?.semester || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Exam Type</p>
                  <p className="text-lg font-medium">{selectedSeatingArrangement.metadata?.examDetails?.examType || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total Rooms Used</p>
                  <p className="text-lg font-medium">{selectedSeatingArrangement.metadata?.totalRoomsSelectedAndAvailable || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Load Invigilators Button */}
        <Button
          onClick={fetchInvigilators}
          disabled={isLoadingInvigilators}
          className="w-full"
        >
          {isLoadingInvigilators ? 'Loading Invigilators...' : 'Load Invigilator Details'}
        </Button>

        {/* Invigilators Details */}
        {((Array.isArray(invigilatorsData.faculty) && invigilatorsData.faculty.length > 0) ||
          (Array.isArray(invigilatorsData.staff) && invigilatorsData.staff.length > 0)) && (
          <Card className="bg-white">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-6">Available Invigilators</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-medium mb-3 text-blue-900">Faculty ({Array.isArray(invigilatorsData.faculty) ? invigilatorsData.faculty.length : 0})</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {Array.isArray(invigilatorsData.faculty) && invigilatorsData.faculty.map((faculty, index) => (
                      <div key={index} className="bg-blue-50 text-blue-900 rounded p-2 text-sm">
                        {faculty.name}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="font-medium mb-3 text-green-900">Staff ({Array.isArray(invigilatorsData.staff) ? invigilatorsData.staff.length : 0})</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {Array.isArray(invigilatorsData.staff) && invigilatorsData.staff.map((staff, index) => (
                      <div key={index} className="bg-green-50 text-green-900 rounded p-2 text-sm">
                        {staff.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Generate Invigilation Assignment Button */}
        <Button
          onClick={generateInvigilation}
          disabled={!selectedSeatingArrangement ||
                    invigilatorsData.faculty.length === 0 ||
                    invigilatorsData.staff.length === 0 ||
                    isGenerating}
          className="w-full"
        >
          {isGenerating ? 'Generating...' : 'Generate Invigilation Assignment'}
        </Button>

        {/* Loading State */}
        {isGenerating && (
          <Card className="bg-white">
            <CardContent className="p-6 flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-gray-500 mb-4" />
              <h3 className="text-lg font-medium text-center">Generating Invigilation Assignment</h3>
              <p className="text-sm text-gray-500 text-center mt-2">
                This may take a few moments. Please wait while we assign invigilators to exam rooms...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Invigilation Assignment Display */}
        {invigilation && !isGenerating && (
          <Card className="bg-white">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Invigilation Assignment</h2>
                <Button
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-2"
                >
                  <FileDown className="w-4 h-4" />
                  Download PDF
                </Button>
              </div>

              {/* Show duty summary */}
              {dutySummary && <DutySummaryDisplay summary={dutySummary} />}

              {/* Show warnings */}
              {warnings && <WarningsDisplay warnings={warnings} />}

              {/* Hierarchical Dropdowns for Invigilation Assignment */}
              <div className="max-h-[70vh] overflow-y-auto pr-4 mt-6" style={{ scrollbarWidth: 'thin' }}>
                {Object.entries(invigilation).map(([date, slots]) => (
                  <details key={date} className="mb-4 border rounded-lg">
                    <summary className="cursor-pointer py-2 px-4 font-semibold bg-gray-100 rounded-t-lg">{date}</summary>
                    <div className="pl-4">
                      {Object.entries(slots).map(([slot, rooms]) => (
                        <details key={slot} className="mb-2 border rounded-lg">
                          <summary className="cursor-pointer py-2 px-4 font-medium bg-gray-50 rounded-t-lg">{slot}</summary>
                          <div className="pl-4">
                            {Object.entries(rooms).map(([roomId, roomData]) => (
                              <div key={roomId} className="bg-gray-50 rounded-lg p-4 mb-2">
                                <div className="flex justify-between items-center">
                                  <h5 className="font-medium">{roomData.roomName}</h5>
                                </div>
                                <div className="mt-4">
                                  <h6 className="text-sm font-medium text-gray-600 mb-2">Assigned Invigilators:</h6>
                                  <div className="space-y-2">
                                    {roomData.invigilators.map((invigilator, idx) => (
                                      <div key={idx} className="bg-white p-2 rounded border flex justify-between items-center">
                                        <span className="font-medium">{invigilator.name}</span>
                                        <span className={`text-xs px-2 py-1 rounded ${
                                          invigilator.type === 'faculty' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                        }`}>
                                          {invigilator.type}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {invigilation && !isGenerating && (
          <div className="flex gap-4 mt-6">
            <Button onClick={handleSave} className="flex-1">
              Save Invigilation Assignment
            </Button>
          </div>
        )}
      </div>

      {/* Save Dialog */}
      {selectedSeatingArrangement && (
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Invigilation Assignment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Invigilation Assignment Name</Label>
                <Input
                  id="name"
                  value={assignmentName}
                  onChange={(e) => setAssignmentName(e.target.value)}
                  placeholder={`Invigilation for ${selectedSeatingArrangement.name || `Seating Plan ${selectedSeatingArrangement.id}`}`}
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

export default GenerateInvigilation;