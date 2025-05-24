import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Loader2, Mail, Calendar, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Eye, Trash2 } from 'lucide-react';
import './scrollbar-colored.css';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ViewInvigilation = () => {
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedAssignmentForEmail, setSelectedAssignmentForEmail] = useState(null);
  const [dates, setDates] = useState([]);
  const [slotTimes, setSlotTimes] = useState({});
  const [isMidsem, setIsMidsem] = useState(false);
  const [scheduledEmailsDialogOpen, setScheduledEmailsDialogOpen] = useState(false);
  const [scheduledEmails, setScheduledEmails] = useState([]);
  const [loadingScheduledEmails, setLoadingScheduledEmails] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/invigilation-assignments');
      if (!response.ok) throw new Error('Failed to fetch assignments');
      const data = await response.json();
      const assignmentsArray = Array.isArray(data.data) ? data.data : Object.values(data.data);
      setAssignments(assignmentsArray);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast.error('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!window.confirm('Are you sure you want to delete this invigilation assignment?')) return;
    try {
      const response = await fetch(`http://localhost:3000/api/invigilation-assignment/${assignmentId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete assignment');
      toast.success('Invigilation assignment deleted successfully');
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast.error('Failed to delete assignment');
    }
  };

  const handleFinalizeEmail = (assignment) => {
    setSelectedAssignmentForEmail(assignment);
    setEmailDialogOpen(true);

    // Determine exam type based on number of days in the assignment
    const numDays = Object.keys(assignment.invigilation).length;
    const midsem = numDays <= 4;
    setIsMidsem(midsem);

    // Initialize dates array based on exam type
    setDates(Array(midsem ? 4 : 7).fill(''));
    setSlotTimes({});
  };

  const handleSendEmails = async () => {
    try {
      console.log('Starting email scheduling process...');
      console.log('Selected assignment:', selectedAssignmentForEmail);

      // Validate all dates and times are filled
      if (dates.some(date => !date) || Object.keys(slotTimes).length === 0) {
        console.log('Validation failed: Missing dates or slot times');
        toast.error('Please fill all dates and slot times');
        return;
      }

      // Create a map of invigilator to their assignments
      const invigilatorAssignments = new Map();
      console.log('Processing assignments...');

      // Create a mapping of IDs to names for lookup (since invigilator.name is now full name, but we need to reverse lookup ID)
      const idToNameMap = {};
      Object.entries(selectedAssignmentForEmail.dutySummary.faculty).forEach(([name, _], index) => {
        const id = (52 + index).toString();
        idToNameMap[id] = name;
      });
      Object.entries(selectedAssignmentForEmail.dutySummary.staff).forEach(([name, _], index) => {
        const id = (1 + index).toString();
        idToNameMap[id] = name;
      });

      // Create a mapping of names to IDs for backward compatibility (if needed)
      const nameToIdMap = {};
      Object.entries(idToNameMap).forEach(([id, name]) => {
        nameToIdMap[name] = id;
      });

      console.log('ID to Name mapping:', idToNameMap);
      console.log('Name to ID mapping:', nameToIdMap);
      console.log('Slot times:', slotTimes);

      // Process each day and slot
      console.log('Invigilation data structure:', selectedAssignmentForEmail.invigilation);

      // Check if we're using the right key format - the structure might be using actual dates instead of day1, day2, etc.
      const invigKeys = Object.keys(selectedAssignmentForEmail.invigilation);
      console.log('Invigilation keys:', invigKeys);

      // Create a list of available IDs for each type
      const availableFacultyIds = [];
      const availableStaffIds = [];

      // Populate available IDs from the duty summary
      Object.entries(selectedAssignmentForEmail.dutySummary.faculty || {}).forEach(([name, _], index) => {
        availableFacultyIds.push((52 + index).toString());
      });

      Object.entries(selectedAssignmentForEmail.dutySummary.staff || {}).forEach(([name, _], index) => {
        availableStaffIds.push((1 + index).toString());
      });

      console.log('Available faculty IDs:', availableFacultyIds);
      console.log('Available staff IDs:', availableStaffIds);

      // Keep track of used IDs to avoid duplicates
      const usedFacultyIds = new Set();
      const usedStaffIds = new Set();

      // Try both formats - either day1, day2 or actual date strings
      dates.forEach((date, dayIndex) => {
        // Try both key formats - either "day{index+1}" or the actual date string
        const dayKey = `day${dayIndex + 1}`;
        const dateKey = date; // Use the actual date string as a key too

        console.log(`Trying keys: dayKey=${dayKey}, dateKey=${dateKey}`);

        // Try both key formats
        let daySlots = selectedAssignmentForEmail.invigilation[dayKey] ||
                       selectedAssignmentForEmail.invigilation[dateKey] || {};

        console.log(`Found slots for ${dayKey}/${dateKey}:`, daySlots);

        Object.entries(daySlots).forEach(([slot, rooms]) => {
          console.log(`Processing slot: ${slot}, rooms:`, rooms);

          // Extract the slot number from the slot key (e.g., "slot1" -> 1)
          const slotNumber = parseInt(slot.replace('slot', ''));
          const slotTime = slotTimes[`slot${slotNumber}`];

          console.log(`Slot ${slotNumber} time: ${slotTime}`);

          if (!slotTime) {
            console.log(`No time found for slot ${slotNumber}, skipping`);
            return;
          }

          Object.entries(rooms).forEach(([roomId, roomData]) => {
            console.log(`Processing room: ${roomId}, roomData:`, roomData);

            if (!Array.isArray(roomData.invigilators)) {
              console.log(`No invigilators array for room ${roomId}, skipping`);
              return;
            }

            console.log(`Invigilators for room ${roomId}:`, roomData.invigilators);

            roomData.invigilators.forEach(invigilator => {
              console.log(`Processing invigilator:`, invigilator);

              // Handle empty invigilator objects by assigning an available ID based on type
              if (!invigilator || (!invigilator.id && (!invigilator.name || invigilator.name.trim() === ''))) {
                console.log('Empty invigilator object detected, assigning an available ID based on type');

                let id = null;
                let name = null;

                if (invigilator && invigilator.type === 'faculty') {
                  // Find an available faculty ID that hasn't been used yet
                  for (const facultyId of availableFacultyIds) {
                    if (!usedFacultyIds.has(facultyId)) {
                      id = facultyId;
                      name = idToNameMap[id] || `Faculty ${id}`;
                      usedFacultyIds.add(id);
                      break;
                    }
                  }
                } else if (invigilator && invigilator.type === 'staff') {
                  // Find an available staff ID that hasn't been used yet
                  for (const staffId of availableStaffIds) {
                    if (!usedStaffIds.has(staffId)) {
                      id = staffId;
                      name = idToNameMap[id] || `Staff ${id}`;
                      usedStaffIds.add(id);
                      break;
                    }
                  }
                }

                if (!id) {
                  console.log(`No available ${invigilator?.type || 'unknown'} ID found, skipping`);
                  return;
                }

                console.log(`Assigned ID ${id} (${name}) to empty ${invigilator?.type || 'unknown'} invigilator`);

                if (!invigilatorAssignments.has(id)) {
                  invigilatorAssignments.set(id, []);
                }

                const assignment = {
                  id,
                  name,
                  date,
                  time: slotTime,
                  roomNumber: roomData.roomName,
                  recipient: name
                };

                console.log('Created assignment for empty invigilator:', assignment);
                invigilatorAssignments.get(id).push(assignment);
                return;
              }

              // Regular processing for non-empty invigilators
              let id = invigilator.id || nameToIdMap[invigilator.name];

              // If still not found, try to find by matching full name (case-insensitive)
              if (!id && invigilator.name) {
                console.log(`Trying to find ID for name: ${invigilator.name}`);

                // Try direct lookup first
                Object.entries(nameToIdMap).forEach(([name, nameId]) => {
                  if (name.toLowerCase() === invigilator.name.toLowerCase()) {
                    console.log(`Found ID ${nameId} for ${invigilator.name} via direct match`);
                    id = nameId;
                  }
                });

                // If still not found, try partial match
                if (!id) {
                  for (const [name, nameId] of Object.entries(nameToIdMap)) {
                    if (name.toLowerCase().includes(invigilator.name.toLowerCase()) ||
                        invigilator.name.toLowerCase().includes(name.toLowerCase())) {
                      console.log(`Found ID ${nameId} for ${invigilator.name} via partial match with ${name}`);
                      id = nameId;
                      break;
                    }
                  }
                }
              }

              if (!id) {
                console.error(`Could not find ID for invigilator:`, invigilator);
                return;
              }

              console.log(`Successfully mapped invigilator ${invigilator.name} to ID ${id}`);

              if (!invigilatorAssignments.has(id)) {
                invigilatorAssignments.set(id, []);
              }

              const assignment = {
                id,
                name: invigilator.name || idToNameMap[id] || `Invigilator ${id}`,
                date,
                time: slotTime,
                roomNumber: roomData.roomName,
                recipient: invigilator.name || idToNameMap[id] || `Invigilator ${id}`
              };

              console.log('Created assignment:', assignment);
              invigilatorAssignments.get(id).push(assignment);
            });
          });
        });
      });

      // Convert assignments map to array format
      const allAssignments = [];
      for (const assignments of invigilatorAssignments.values()) {
        allAssignments.push(...assignments);
      }
      console.log('Total assignments to schedule:', allAssignments.length);
      console.log('Assignments data:', allAssignments);

      if (allAssignments.length === 0) {
        console.error('No assignments were created. Check the data structure above.');
        toast.error('No assignments were found to schedule');
        return;
      }

      // Schedule emails for all assignments
      console.log('Sending request to schedule emails...');
      const response = await fetch('http://localhost:3000/api/schedule-invigilation-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assignments: allAssignments,
          scheduleTime: new Date(Date.now() + 60000).toISOString(),
          emailSubject: 'Invigilation Duty Assignment',
          emailBody: '',
        }),
      });

      if (!response.ok) {
        console.error('Failed to schedule emails:', await response.text());
        throw new Error('Failed to schedule emails');
      }

      console.log('Email scheduling request successful');
      toast.success('Emails scheduled successfully');
      setEmailDialogOpen(false);
    } catch (error) {
      console.error('Error scheduling emails:', error);
      toast.error('Failed to schedule emails');
    }
  };

  // const fetchScheduledEmails = async () => {
  //   setLoadingScheduledEmails(true);
  //   try {
  //     const response = await fetch('http://localhost:3000/api/scheduled-emails');
  //     if (!response.ok) throw new Error('Failed to fetch scheduled emails');
  //     const data = await response.json();
  //     setScheduledEmails(data.scheduledEmails);
  //   } catch (error) {
  //     console.error('Error fetching scheduled emails:', error);
  //     toast.error('Failed to load scheduled emails');
  //   } finally {
  //     setLoadingScheduledEmails(false);
  //   }
  // };
  // Update the fetchScheduledEmails function to properly handle cancelled emails
const fetchScheduledEmails = async () => {
  setLoadingScheduledEmails(true);
  try {
    const response = await fetch('http://localhost:3000/api/scheduled-emails');
    if (!response.ok) throw new Error('Failed to fetch scheduled emails');
    const data = await response.json();

    // Filter out cancelled emails or update to show only pending ones
    const activeEmails = data.scheduledEmails.filter(email => email.status === 'pending');
    setScheduledEmails(activeEmails);
  } catch (error) {
    console.error('Error fetching scheduled emails:', error);
    toast.error('Failed to load scheduled emails');
  } finally {
    setLoadingScheduledEmails(false);
  }
};

  // const handleCancelAllEmails = async () => {
  //   if (!window.confirm('Are you sure you want to cancel all scheduled emails?')) return;

  //   try {
  //     const response = await fetch('http://localhost:3000/api/cancel-scheduled-emails', {
  //       method: 'POST'
  //     });
  //     if (!response.ok) throw new Error('Failed to cancel emails');

  //     const data = await response.json();
  //     toast.success(`Successfully cancelled ${data.cancelledCount} emails`);
  //     fetchScheduledEmails(); // Refresh the list
  //   } catch (error) {
  //     console.error('Error cancelling emails:', error);
  //     toast.error('Failed to cancel emails');
  //   }
  // };

  const handleCancelAllEmails = async () => {
    if (!window.confirm('Are you sure you want to cancel all scheduled emails?')) return;

    try {
      const response = await fetch('http://localhost:3000/api/cancel-scheduled-emails', {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to cancel emails');

      const data = await response.json();
      toast.success(`Successfully cancelled ${data.cancelledCount} emails`);

      // Immediately refresh the email list to show updated statuses
      await fetchScheduledEmails();
    } catch (error) {
      console.error('Error cancelling emails:', error);
      toast.error('Failed to cancel emails');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] mt-16 bg-gray-100 p-4">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Saved Invigilation Assignments</h1>
          <Button
            onClick={() => {
              setScheduledEmailsDialogOpen(true);
              fetchScheduledEmails();
            }}
            className="bg-purple-600 text-white hover:bg-purple-700"
          >
            <Calendar className="w-4 h-4 mr-2" />
            View Scheduled Emails
          </Button>
        </div>
        {/* Assignments List */}
        {loading ? (
          <div className="flex justify-center items-center min-h-[200px]">
            <Loader2 className="h-12 w-12 animate-spin text-gray-500 mb-4" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[65vh] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#a0aec0 #f7fafc' }}>
            {assignments.length > 0 ? (
              assignments.map((assignment) => (
                <Card key={assignment.id} className="bg-white hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <h2 className="text-xl font-semibold mb-2 truncate" title={assignment.name}>{assignment.name}</h2>
                    <div className="space-y-2 text-sm text-gray-600">
                      <p>Seating Arrangement ID: {assignment.seatingArrangementId}</p>
                      <p>Created: {assignment.createdAt ? new Date(assignment.createdAt).toLocaleDateString() : 'Not available'}</p>
                      <p>Total Faculty Duties: {Object.values(assignment.dutySummary?.faculty || {}).reduce((a, b) => a + b, 0)}</p>
                      <p>Total Staff Duties: {Object.values(assignment.dutySummary?.staff || {}).reduce((a, b) => a + b, 0)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      <Button
                        onClick={() => setSelectedAssignment(assignment)}
                        className="flex-1 bg-gray-900 text-white hover:bg-gray-700"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                      <Button
                        onClick={() => handleFinalizeEmail(assignment)}
                        className="flex-1 bg-blue-600 text-white hover:bg-blue-500"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Finalize to Send Email
                      </Button>
                      <Button
                        onClick={() => handleDeleteAssignment(assignment.id)}
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
                <p className="text-gray-500">No saved invigilation assignments found.</p>
              </div>
            )}
          </div>
        )}
        {/* Email Dialog */}
        <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Finalize Email Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <Label>Exam Dates</Label>
                {dates.map((_, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Label className="w-20">Day {index + 1}:</Label>
                    <Input
                      type="date"
                      value={dates[index]}
                      onChange={(e) => {
                        const newDates = [...dates];
                        newDates[index] = e.target.value;
                        setDates(newDates);
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <Label>Slot Times</Label>
                {isMidsem ? (
                  // Midsem: 4 slots per day
                  <>
                    <div className="flex items-center gap-2">
                      <Label className="w-20">Slot 1:</Label>
                      <Input
                        type="time"
                        value={slotTimes['slot1'] || ''}
                        onChange={(e) => setSlotTimes({ ...slotTimes, slot1: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="w-20">Slot 2:</Label>
                      <Input
                        type="time"
                        value={slotTimes['slot2'] || ''}
                        onChange={(e) => setSlotTimes({ ...slotTimes, slot2: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="w-20">Slot 3:</Label>
                      <Input
                        type="time"
                        value={slotTimes['slot3'] || ''}
                        onChange={(e) => setSlotTimes({ ...slotTimes, slot3: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="w-20">Slot 4:</Label>
                      <Input
                        type="time"
                        value={slotTimes['slot4'] || ''}
                        onChange={(e) => setSlotTimes({ ...slotTimes, slot4: e.target.value })}
                      />
                    </div>
                  </>
                ) : (
                  // Endsem: 2 slots per day
                  <>
                    <div className="flex items-center gap-2">
                      <Label className="w-20">Slot 1:</Label>
                      <Input
                        type="time"
                        value={slotTimes['slot1'] || ''}
                        onChange={(e) => setSlotTimes({ ...slotTimes, slot1: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="w-20">Slot 2:</Label>
                      <Input
                        type="time"
                        value={slotTimes['slot2'] || ''}
                        onChange={(e) => setSlotTimes({ ...slotTimes, slot2: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendEmails}>
                Send Emails
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Details Dialog */}
        <Dialog open={!!selectedAssignment} onOpenChange={() => setSelectedAssignment(null)}>
          <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">{selectedAssignment?.name}</DialogTitle>
            </DialogHeader>
            {selectedAssignment && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <span className="text-md text-gray-600">Seating Arrangement ID: {selectedAssignment.seatingArrangementId}</span>
                  <span className="text-md text-gray-600">Created: {selectedAssignment.createdAt ? new Date(selectedAssignment.createdAt).toLocaleString() : 'Not available'}</span>
                  <span className="text-md text-gray-600">Total Faculty Duties: {Object.values(selectedAssignment.dutySummary?.faculty || {}).reduce((a, b) => a + b, 0)}</span>
                  <span className="text-md text-gray-600">Total Staff Duties: {Object.values(selectedAssignment.dutySummary?.staff || {}).reduce((a, b) => a + b, 0)}</span>
                </div>
                {/* Duty Summary Scrollable Display with Slot/Room Details */}
                {selectedAssignment.dutySummary && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Faculty Scrollable */}
                    <div>
                      <h3 className="text-md font-semibold mb-2">Faculty Duties</h3>
                      <div className="max-h-48 overflow-y-auto bg-blue-50 rounded-lg p-3 border scrollbar-colored">
                        <DutyAssignmentDetails
                          invigilation={selectedAssignment.invigilation}
                          type="faculty"
                          dutySummary={selectedAssignment.dutySummary}
                        />
                      </div>
                    </div>
                    {/* Staff Scrollable */}
                    <div>
                      <h3 className="text-md font-semibold mb-2">Staff Duties</h3>
                      <div className="max-h-48 overflow-y-auto bg-green-50 rounded-lg p-3 border scrollbar-colored">
                        <DutyAssignmentDetails
                          invigilation={selectedAssignment.invigilation}
                          type="staff"
                          dutySummary={selectedAssignment.dutySummary}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {/* Pretty Invigilation Schedule Display */}
                {selectedAssignment.invigilation && (
                  <div className="max-h-[70vh] overflow-y-auto pr-4 mt-6 bg-gray-50 rounded-lg scrollbar-colored" style={{ scrollbarWidth: 'thin' }}>
                    {Object.entries(selectedAssignment.invigilation).map(([date, slots]) => (
                      <details key={date} className="mb-4 border rounded-lg">
                        <summary className="cursor-pointer py-2 px-4 font-semibold bg-gray-100 rounded-t-lg">{date}</summary>
                        <div className="pl-4">
                          {Object.entries(slots).map(([slot, rooms]) => (
                            <details key={slot} className="mb-2 border rounded-lg">
                              <summary className="cursor-pointer py-2 px-4 font-medium bg-gray-50 rounded-t-lg">{slot}</summary>
                              <div className="pl-4">
                                {Object.entries(rooms).map(([roomId, roomData]) => (
                                  <div key={roomId} className="bg-gray-100 rounded-lg p-4 mb-2">
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
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
        {/* Add new Scheduled Emails Dialog */}
        <Dialog open={scheduledEmailsDialogOpen} onOpenChange={setScheduledEmailsDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Scheduled Email Reminders</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {loadingScheduledEmails ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                </div>
              ) : scheduledEmails.length > 0 ? (
                <>
                  <div className="flex justify-end">
                    <Button
                      onClick={handleCancelAllEmails}
                      variant="destructive"
                      className="bg-red-600 text-white hover:bg-red-700"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Cancel All Emails
                    </Button>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto">
                    {scheduledEmails.map((email, index) => (
                      <Card key={index} className="mb-4">
                        <CardContent className="p-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-semibold text-gray-600">Recipient</p>
                              <p>{email.recipientName || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-600">Email</p>
                              <p>{email.recipientEmail}</p>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-600">Room</p>
                              <p>{email.roomNumber}</p>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-600">Date</p>
                              <p>{email.date}</p>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-600">Time</p>
                              <p>{email.time}</p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-sm font-semibold text-gray-600">Scheduled For</p>
                              <p>{new Date(email.scheduledFor).toLocaleString()}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No scheduled emails found
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setScheduledEmailsDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

// Helper component for slot/room breakdown in faculty/staff duties
function DutyAssignmentDetails({ invigilation, type, dutySummary }) {
  const [search, setSearch] = useState("");
  // Build a map: name -> [{ date, slot, room }]
  const assignments = {};
  if (invigilation) {
    Object.entries(invigilation).forEach(([date, slots]) => {
      Object.entries(slots).forEach(([slot, rooms]) => {
        Object.entries(rooms).forEach(([roomId, roomData]) => {
          roomData.invigilators.forEach(invigilator => {
            if (invigilator.type === type) {
              if (!assignments[invigilator.name]) assignments[invigilator.name] = [];
              assignments[invigilator.name].push({ date, slot, room: roomData.roomName });
            }
          });
        });
      });
    });
  }
  // Get sorted names from dutySummary for order
  const names = Object.keys(dutySummary?.[type] || {});
  const filteredNames = names.filter(name => name.toLowerCase().includes(search.toLowerCase()));
  if (names.length === 0) return <span className="text-gray-400">No {type} duties</span>;
  return (
    <div className="space-y-2">
      <input
        type="text"
        className="mb-2 w-full px-2 py-1 border rounded"
        placeholder={`Search ${type} by name...`}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      {filteredNames.length === 0 ? (
        <span className="text-gray-400">No {type} found for this search.</span>
      ) : (
        filteredNames.map(name => (
          <div key={name} className="mb-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">{name}</span>
              <span className={`text-xs px-2 py-1 rounded ${type === 'faculty' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{dutySummary[type][name]}</span>
            </div>
            {/* Slot/room breakdown */}
            {assignments[name] && (
              <div className="ml-2 mt-1 space-y-1 text-xs text-gray-700">
                {assignments[name].map((a, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="font-semibold">{a.date}</span>
                    <span className="">Slot: {a.slot}</span>
                    <span className="">Room: {a.room}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

export default ViewInvigilation;