import "./App.css";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

function App() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <h1 className="text-4xl font-bold mb-6">Welcome to the Exam Scheduler</h1>
      <div className="flex space-x-4">
        <Link to="/generateTimeTables">
          <Button className="px-6 py-3 text-lg">Generate Timetable</Button>
        </Link>
        <Link to="/viewTimeTables">
          <Button className="px-6 py-3 text-lg">View Timetables</Button>
        </Link>
      </div>
    </div>
  );
}

export default App;