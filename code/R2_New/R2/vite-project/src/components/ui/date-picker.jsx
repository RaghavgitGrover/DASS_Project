import PropTypes from "prop-types";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function MultiDatePicker({ selectedDates = [], onSelect, className }) {
  // Convert string dates to Date objects
  const convertedDates = selectedDates.map(date => {
    if (date instanceof Date) return date;
    if (typeof date === 'string') return new Date(date);
    return null;
  }).filter(date => date !== null);

  const formatDates = (dates) => {
    if (!dates || !Array.isArray(dates) || dates.length === 0) return "";
    
    const sortedDates = dates
      .filter(date => date instanceof Date && !isNaN(date))
      .sort((a, b) => a.getTime() - b.getTime());

    if (sortedDates.length <= 2) {
      return sortedDates.map(date => format(date, "MMM dd, yyyy")).join(", ");
    } else {
      return `${sortedDates.length} dates selected`;
    }
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal truncate",
              !convertedDates?.length && "text-muted-foreground"
            )}
            title={convertedDates?.length > 2 ? convertedDates.map(date => format(date, "MMM dd, yyyy")).join(", ") : undefined}
          >
            <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
            {convertedDates?.length ? (
              <span className="truncate">{formatDates(convertedDates)}</span>
            ) : (
              <span>Pick exam dates</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="multiple"
            selected={convertedDates}
            onSelect={onSelect}
            initialFocus
            numberOfMonths={1}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

MultiDatePicker.propTypes = {
  selectedDates: PropTypes.arrayOf(PropTypes.oneOfType([
    PropTypes.instanceOf(Date),
    PropTypes.string
  ])),
  onSelect: PropTypes.func.isRequired,
  className: PropTypes.string
};

MultiDatePicker.defaultProps = {
  selectedDates: [],
  className: ""
}; 