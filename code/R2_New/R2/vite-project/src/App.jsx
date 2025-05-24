import "./App.css";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

function App() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <h1 className="text-4xl font-bold mb-10">Welcome to the Exam Scheduler</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
        <Link to="/generateTimeTables">
          <Button className="w-full px-10 py-6 text-xl rounded-xl shadow-lg">Generate Timetable</Button>
        </Link>
        <Link to="/viewTimeTables">
          <Button className="w-full px-10 py-6 text-xl rounded-xl shadow-lg">View Timetables</Button>
        </Link>
        <Link to="/generateSeatingArrangement">
          <Button className="w-full px-10 py-6 text-xl rounded-xl shadow-lg">Generate Seating Arrangement</Button>
        </Link>
        <Link to="/viewSeatingArrangement">
          <Button className="w-full px-10 py-6 text-xl rounded-xl shadow-lg">View Seating Arrangements</Button>
        </Link>
        <Link to="/generateInvigilation">
          <Button className="w-full px-10 py-6 text-xl rounded-xl shadow-lg">Generate Invigilation Assignment</Button>
        </Link>
        <Link to="/viewInvigilation">
          <Button className="w-full px-10 py-6 text-xl rounded-xl shadow-lg">View Invigilation Assignments</Button>
        </Link>
      </div>
    </div>
  );
}

export default App;