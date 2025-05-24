import express from 'express';
import fs from 'fs';
import fetch from 'node-fetch';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import path from 'path';

const router = express.Router();

const MAX_DUTIES = 2;
const MAX_DUTIES_WITH_RELAXATION = 3;

// Helper function to fetch invigilators
async function fetchInvigilators() {
  const response = await fetch('https://ims-dev.iiit.ac.in/exam_schedule_api.php?typ=getInvigilators&key=IMS&secret=ExamDegunGts');
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
}

// Helper function to get seating arrangement by ID
async function getSeatingArrangementById(inputId) {
  const rawData = JSON.parse(fs.readFileSync('./data/seatingArrangements.json'));
  const selected = rawData[inputId.toString()];
  if (!selected || !selected.seatingArrangement) {
    throw new Error(`❌ Seating arrangement with id=${inputId} not found.`);
  }
  return selected.seatingArrangement;
}

// Helper function to generate PDF
function generatePDF(assignments, filePath = './data/invigilation_assignments.pdf') {
  const doc = new jsPDF();
  const tableRows = [];

  for (const date of Object.keys(assignments)) {
    const slots = assignments[date];

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

  doc.save(filePath);
  console.log(`📄 PDF generated: ${filePath}`);
  return filePath;
}

// Main API endpoint for assigning invigilators
router.post('/assign-invigilators', async (req, res) => {
  try {
    const { seatingId } = req.body;

    if (!seatingId) {
      return res.status(400).json({ success: false, message: 'Seating plan ID is required' });
    }

    const warnings = [];
    const assigned = {};
    const dutyCount = {};
    const slotAssigned = {};  // slot -> Set of already assigned names

    const invigilatorsData = await fetchInvigilators();
    const faculty = Object.values(invigilatorsData.Faculty).map(f => ({ name: f.name, type: 'faculty' }));
    const staff = Object.values(invigilatorsData.Staff).map(s => ({ name: s.name, type: 'staff' }));
    const allInvigilators = [...faculty, ...staff];

    const seatingArrangements = await getSeatingArrangementById(seatingId);

    const allSlots = new Set();
    for (const date in seatingArrangements) {
      for (const slot in seatingArrangements[date]) {
        allSlots.add(slot);
      }
    }

    const slotAvailability = {};
    for (const slot of allSlots) {
      slotAvailability[slot] = allInvigilators;
    }

    function isAvailable(slot, name) {
      return !slotAssigned[slot]?.has(name);
    }

    for (const date in seatingArrangements) {
      assigned[date] = {};

      const slotsForDate = Object.entries(seatingArrangements[date])
        .filter(([_, slotData]) => slotData && slotData.arrangements);

      for (const [slot, slotData] of slotsForDate) {
        console.log(`Processing Date: ${date}, Slot: ${slot}`);

        assigned[date][slot] = {};
        slotAssigned[slot] = new Set();

        const availableList = slotAvailability[slot] || [];
        const peoplePool = new Map(availableList.map(p => [p.name, p.type]));

        const activeRooms = slotData.arrangements.filter(room =>
          Object.values(room.sections).some(section => section.length > 0)
        );

        if (activeRooms.length === 0) {
          console.log(`No active arrangements for Date: ${date}, Slot: ${slot}`);
          continue;
        }

        const shuffledRooms = [...activeRooms].sort(() => Math.random() - 0.5);

        for (const room of shuffledRooms) {
          const { roomId, roomName } = room;
          let invigilators = [];

          const shuffledPool = [...peoplePool.entries()].sort(() => Math.random() - 0.5);

          let facultyAssigned = false;
          for (const [name, type] of shuffledPool) {
            if (type === 'faculty' && (dutyCount[name] || 0) < MAX_DUTIES && isAvailable(slot, name)) {
              invigilators.push(name);
              dutyCount[name] = (dutyCount[name] || 0) + 1;
              slotAssigned[slot].add(name);
              facultyAssigned = true;
              break;
            }
          }

          if (!facultyAssigned) {
            for (const [name, type] of shuffledPool) {
              if (type === 'faculty' && (dutyCount[name] || 0) < MAX_DUTIES_WITH_RELAXATION && isAvailable(slot, name)) {
                invigilators.push(name);
                dutyCount[name] = (dutyCount[name] || 0) + 1;
                slotAssigned[slot].add(name);
                warnings.push(`Date ${date}, Slot ${slot}, Room ${roomName}: Assigned faculty ${name} with ${dutyCount[name]} duties`);
                facultyAssigned = true;
                break;
              }
            }
          }

          let staffAssigned = false;
          for (const [name, type] of shuffledPool) {
            if (!invigilators.includes(name) && type === 'staff' && (dutyCount[name] || 0) < MAX_DUTIES && isAvailable(slot, name)) {
              invigilators.push(name);
              dutyCount[name] = (dutyCount[name] || 0) + 1;
              slotAssigned[slot].add(name);
              staffAssigned = true;
              break;
            }
          }

          if (!staffAssigned && invigilators.length > 0) {
            for (const [name, type] of shuffledPool) {
              if (!invigilators.includes(name) && type === 'staff' && (dutyCount[name] || 0) < MAX_DUTIES_WITH_RELAXATION && isAvailable(slot, name)) {
                invigilators.push(name);
                dutyCount[name] = (dutyCount[name] || 0) + 1;
                slotAssigned[slot].add(name);
                warnings.push(`Date ${date}, Slot ${slot}, Room ${roomName}: Assigned staff ${name} with ${dutyCount[name]} duties`);
                staffAssigned = true;
                break;
              }
            }
          }

          if (invigilators.length < 2) {
            for (const [name, type] of shuffledPool) {
              if (!invigilators.includes(name) && (dutyCount[name] || 0) < MAX_DUTIES && isAvailable(slot, name)) {
                invigilators.push(name);
                dutyCount[name] = (dutyCount[name] || 0) + 1;
                slotAssigned[slot].add(name);
                break;
              }
            }

            if (invigilators.length < 2) {
              for (const [name, type] of shuffledPool) {
                if (!invigilators.includes(name) && (dutyCount[name] || 0) < MAX_DUTIES_WITH_RELAXATION && isAvailable(slot, name)) {
                  invigilators.push(name);
                  dutyCount[name] = (dutyCount[name] || 0) + 1;
                  slotAssigned[slot].add(name);
                  warnings.push(`Date ${date}, Slot ${slot}, Room ${roomName}: Assigned ${type} ${name} with ${dutyCount[name]} duties`);
                  break;
                }
              }
            }
          }

          if (invigilators.length < 2) {
            warnings.push(`[WARNING] Date ${date}, Slot ${slot}, Room ${roomName}: Only ${invigilators.length} invigilator(s) assigned`);
          }

          if (!invigilators.some(name => peoplePool.get(name) === 'faculty')) {
            warnings.push(`[WARNING] Date ${date}, Slot ${slot}, Room ${roomName}: No faculty assigned`);
          }

          assigned[date][slot][roomId] = {
            roomName,
            invigilators: invigilators.map(name => ({
              name,
              type: peoplePool.get(name) || 'unknown'
            }))
          };
        }
      }
    }

    const dutySummary = { faculty: {}, staff: {} };
    for (const [person, count] of Object.entries(dutyCount)) {
      const type = allInvigilators.find(p => p.name === person)?.type || 'unknown';
      if (type === 'faculty') dutySummary.faculty[person] = count;
      else if (type === 'staff') dutySummary.staff[person] = count;
    }

    // Ensure data directory exists
    if (!fs.existsSync('./data')) {
      fs.mkdirSync('./data', { recursive: true });
    }

    // Write output files
    fs.writeFileSync('./data/generated_invigilation_assignments.json', JSON.stringify(assigned, null, 2));
    fs.writeFileSync('./data/duty_counts.json', JSON.stringify(dutyCount, null, 2));
    fs.writeFileSync('./data/warnings.json', JSON.stringify(warnings, null, 2));
    fs.writeFileSync('./data/duty_summary.json', JSON.stringify(dutySummary, null, 2));

    // Generate PDF
    const pdfPath = generatePDF(assigned);

    // Return response
    res.status(200).json({
      success: true,
      message: '✅ Invigilation assignment complete!',
      data: {
        assigned,
        dutyCount,
        warnings,
        dutySummary,
        files: {
          assignments: '/data/generated_invigilation_assignments.json',
          dutyCounts: '/data/duty_counts.json',
          warnings: '/data/warnings.json',
          dutySummary: '/data/duty_summary.json',
          pdf: pdfPath
        }
      }
    });

  } catch (error) {
    console.error('Error in assign-invigilators endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign invigilators',
      error: error.message
    });
  }
});

// GET endpoint to retrieve assignment results
router.get('/invigilation-assignments/:seatingId?', (req, res) => {
  try {
    let assignments;

    if (req.params.seatingId) {
      // If a specific seating ID is requested, filter assignments (implementation depends on how you store this)
      // This is a placeholder - you would implement the actual filtering logic
      const allAssignments = JSON.parse(fs.readFileSync('./data/generated_invigilation_assignments.json'));
      assignments = allAssignments; // Replace with filtered data when implemented
    } else {
      // Return all assignments
      assignments = JSON.parse(fs.readFileSync('./data/generated_invigilation_assignments.json'));
    }

    res.status(200).json({
      success: true,
      data: assignments
    });
  } catch (error) {
    console.error('Error retrieving invigilation assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve invigilation assignments',
      error: error.message
    });
  }
});

// Download endpoint for PDF
router.get('/download/invigilation-pdf', (req, res) => {
  try {
    const pdfPath = path.resolve('./data/invigilation_assignments.pdf');

    if (fs.existsSync(pdfPath)) {
      res.download(pdfPath, 'invigilation_assignments.pdf');
    } else {
      res.status(404).json({
        success: false,
        message: 'PDF file not found'
      });
    }
  } catch (error) {
    console.error('Error downloading PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download PDF',
      error: error.message
    });
  }
});

// Delete an invigilation assignment by ID
router.delete('/invigilation-assignments/:id', (req, res) => {
  try {
    const { id } = req.params;
    const filePath = path.join('./data', 'saved_invigilation_assignments.json');

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'No assignments found' });
    }

    let assignments = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    // Ensure assignments is an array
    if (!Array.isArray(assignments)) {
      assignments = [];
    }
    const initialLength = assignments.length;

    // Filter out the assignment with the given ID
    assignments = assignments.filter(a => a.id !== id);

    if (assignments.length === initialLength) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Write the updated assignments back to the file
    fs.writeFileSync(filePath, JSON.stringify(assignments, null, 2));

    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Error deleting invigilation assignment:', error);
    res.status(500).json({ message: 'Failed to delete invigilation assignment' });
  }
});

export default router;