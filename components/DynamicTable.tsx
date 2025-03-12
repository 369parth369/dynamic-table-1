"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, X, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  restrictToHorizontalAxis,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import dynamic from "next/dynamic";

interface Column {
  id: string;
  name: string;
}

interface Row {
  id: string;
  cells: { [key: string]: string };
}

interface TableState {
  version: number;
  columns: Column[];
  rows: Row[];
}

const STORAGE_KEY = "tableState";
const CURRENT_VERSION = 1;

const DraggableHeader = ({
  column,
  onDelete,
}: {
  column: Column;
  onDelete: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: column.id });

  const style = {
    transform: transform ? `translateX(${transform.x}px)` : undefined,
    transition,
    width: "300px",
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className="border px-4 py-2 bg-secondary"
    >
      <div className="flex items-center gap-2">
        <button
          className="cursor-grab hover:opacity-70 transition-opacity"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="font-medium">{column.name}</span>
        <button
          onClick={onDelete}
          className="ml-auto text-destructive hover:text-destructive/70 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </th>
  );
};

const DraggableRow = ({
  row,
  columns,
  onCellChange,
  onDelete,
  index,
}: {
  row: Row;
  columns: Column[];
  onCellChange: (rowId: string, columnId: string, value: string) => void;
  onDelete: () => void;
  index: number;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: row.id });

  const style = {
    transform: transform ? `translateY(${transform.y}px)` : undefined,
    transition,
  };

  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const handleKeyPress = (
    e: React.KeyboardEvent<HTMLInputElement>,
    columnId: string
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();

      const currentColumn = columns.findIndex((col) => col.id === columnId);
      const nextColumn = columns[currentColumn + 1];
      if (nextColumn) {
        inputRefs.current[nextColumn.id]?.focus();
      }
    }
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="hover:bg-muted/50 transition-colors"
    >
      <td className="border px-4 py-2 w-[60px] text-center text-muted-foreground">
        {index + 1}
      </td>
      <td className="border px-4 py-2 w-[100px]">
        <div className="flex items-center gap-2">
          <button
            className="cursor-grab hover:opacity-70 transition-opacity"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="text-destructive hover:text-destructive/70 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </td>
      {columns.map((column) => (
        <td
          key={column.id}
          className="border px-4 py-2"
          style={{ width: "300px" }}
        >
          <Input
            ref={(el) => (inputRefs.current[column.id] = el)}
            value={row.cells[column.id] || ""}
            onChange={(e) => onCellChange(row.id, column.id, e.target.value)}
            onKeyPress={(e) => handleKeyPress(e, column.id)}
            onBlur={(e) => onCellChange(row.id, column.id, e.target.value)}
            className="w-full border-none focus-visible:ring-1"
          />
        </td>
      ))}
    </tr>
  );
};

const initialState: TableState = {
  version: CURRENT_VERSION,
  columns: [],
  rows: [],
};

const getInitialState = (): TableState => {
  if (typeof window === "undefined") return initialState;

  try {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      const parsedState = JSON.parse(savedState);
      const migratedState = migrateState(parsedState);

      if (validateState(migratedState)) {
        return migratedState;
      } else {
        console.warn("Invalid state found in localStorage");
      }
    }
  } catch (error) {
    console.error("Error loading initial table state:", error);
  }

  // If no valid state found in localStorage, check if we have a default state
  const defaultState = initialState;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState));
  } catch (error) {
    console.error("Error saving initial state:", error);
  }

  return defaultState;
};

const migrateState = (state: any): TableState => {
  if (!state || typeof state !== "object") {
    return initialState;
  }

  if (!state.version) {
    return {
      version: CURRENT_VERSION,
      columns: Array.isArray(state.columns) ? state.columns : [],
      rows: Array.isArray(state.rows) ? state.rows : [],
    };
  }

  return state;
};

const validateState = (state: TableState): boolean => {
  if (!state || typeof state !== "object") return false;
  if (!Array.isArray(state.columns) || !Array.isArray(state.rows)) return false;

  const validColumns = state.columns.every(
    (col) => col && typeof col.id === "string" && typeof col.name === "string"
  );
  if (!validColumns) return false;

  const validRows = state.rows.every(
    (row) =>
      row &&
      typeof row.id === "string" &&
      typeof row.cells === "object" &&
      Object.entries(row.cells).every(
        ([key, value]) => typeof key === "string" && typeof value === "string"
      )
  );
  if (!validRows) return false;

  return true;
};

interface TableContentProps {
  tableState: TableState;
  setTableState: React.Dispatch<React.SetStateAction<TableState | null>>;
  newColumnName: string;
  setNewColumnName: React.Dispatch<React.SetStateAction<string>>;
  sensors: any;
  isLoading?: boolean;
}

const TableLoader = () => (
  <div className="absolute fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-100">
    <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full" />
  </div>
);

const TableContent = ({
  tableState,
  setTableState,
  newColumnName,
  setNewColumnName,
  sensors,
  isLoading = false,
}: TableContentProps) => {
  const [warning, setWarning] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addColumn = () => {
    if (!newColumnName.trim()) {
      setWarning("Please provide a column name.");
      inputRef.current?.focus();
      return;
    }
    setWarning(""); // Clear warning after successful entry

    setTableState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: [
          ...prev.columns,
          {
            id: crypto.randomUUID(),
            name: newColumnName.trim(),
          },
        ],
      };
    });
    setNewColumnName("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      addColumn();
    }
  };

  const deleteColumn = (columnId: string) => {
    setTableState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.filter((col) => col.id !== columnId),
        rows: prev.rows.map((row) => {
          const { [columnId]: _, ...rest } = row.cells;
          return { ...row, cells: rest };
        }),
      };
    });
  };

  const addRow = () => {
    setTableState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: [
          ...prev.rows,
          {
            id: crypto.randomUUID(),
            cells: {},
          },
        ],
      };
    });
  };

  const deleteRow = (rowId: string) => {
    setTableState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.filter((row) => row.id !== rowId),
      };
    });
  };

  const updateCell = (rowId: string, columnId: string, value: string) => {
    setTableState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((row) =>
          row.id === rowId
            ? { ...row, cells: { ...row.cells, [columnId]: value } }
            : row
        ),
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setTableState((prev) => {
      if (!prev) return prev;

      const isColumn = prev.columns.some((col) => col.id === active.id);

      if (isColumn) {
        const oldIndex = prev.columns.findIndex((col) => col.id === active.id);
        const newIndex = prev.columns.findIndex((col) => col.id === over.id);
        return {
          ...prev,
          columns: arrayMove(prev.columns, oldIndex, newIndex),
        };
      } else {
        const oldIndex = prev.rows.findIndex((row) => row.id === active.id);
        const newIndex = prev.rows.findIndex((row) => row.id === over.id);
        return {
          ...prev,
          rows: arrayMove(prev.rows, oldIndex, newIndex),
        };
      }
    });
  };

  if (tableState.columns.length === 0 && tableState.rows.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
          <Input
          ref={inputRef}
          placeholder="Enter column name"
          value={newColumnName}
          onChange={(e) => {
            setNewColumnName(e.target.value);
            setWarning(""); // Clear warning when user types
          }}
          onKeyPress={handleKeyPress}
          className="w-full"
        />  
          </div>
          <Button
            onClick={addColumn}
            // disabled={!newColumnName.trim()}
            className="whitespace-nowrap"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Column
          </Button>
          <Button
            onClick={addRow}
            variant="secondary"
            className="whitespace-nowrap"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Row
          </Button>
        </div>
        <div className="">
      {warning && <p className="text-red-500 text-sm mt-1 lg:mt-2">{warning}</p>}
      </div>
        <div className="text-center text-muted-foreground py-8 bg-muted/10 rounded-lg border">
          Add a column or row to get started
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <Input
            ref={inputRef}
            placeholder="Enter column name"
            value={newColumnName}
            onChange={(e) => {
              setNewColumnName(e.target.value);
              setWarning(""); // Clear warning when user types
            }}
            className="w-full"
          />
        </div>
        <Button
          onClick={addColumn}
          // disabled={!newColumnName.trim()}
          className="whitespace-nowrap"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Column
        </Button>
        <Button
          onClick={addRow}
          variant="secondary"
          className="whitespace-nowrap"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Row
        </Button>
      </div>
      <div className="">
      {warning && <p className="text-red-500 text-sm mt-2">{warning}</p>}
      </div>
      <div className="rounded-md border shadow-sm overflow-x-auto relative">
        {isLoading && <TableLoader />}
        <table className="w-full border-collapse relative">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToHorizontalAxis]}
          >
            <thead>
              <tr>
                <th className="border px-4 py-2 bg-secondary font-medium text-left w-[60px]">
                  Sr. No.
                </th>
                <th className="border px-4 py-2 bg-secondary font-medium text-left w-[100px]">
                  Actions
                </th>
                <SortableContext
                  items={tableState.columns.map((col) => col.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  {tableState.columns.map((column) => (
                    <DraggableHeader
                      key={column.id}
                      column={column}
                      onDelete={() => deleteColumn(column.id)}
                    />
                  ))}
                </SortableContext>
              </tr>
            </thead>
          </DndContext>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <tbody>
              <SortableContext
                items={tableState.rows.map((row) => row.id)}
                strategy={verticalListSortingStrategy}
              >
                {tableState.rows.map((row, index) => (
                  <DraggableRow
                    key={row.id}
                    row={row}
                    columns={tableState.columns}
                    onCellChange={updateCell}
                    onDelete={() => deleteRow(row.id)}
                    index={index}
                  />
                ))}
              </SortableContext>
            </tbody>
          </DndContext>
        </table>
      </div>
    </div>
  );
};

const DynamicTableContent = dynamic(() => Promise.resolve(TableContent), {
  ssr: false,
});

export default function DynamicTable() {
  const [tableState, setTableState] = useState<TableState | null>(null);
  const [newColumnName, setNewColumnName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Update the initial load effect
  useEffect(() => {
    setIsLoading(true);
    const savedState = getInitialState();
    setTableState(savedState);
    setIsLoading(false);
  }, []);

  // Update the save effect
  useEffect(() => {
    if (tableState) {
      setIsLoading(true);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tableState));
      } catch (error) {
        console.error("Error saving table state:", error);
      }
      setIsLoading(false);
    }
  }, [tableState]);

  if (!tableState) {
    return null;
  }

  return (
    <DynamicTableContent
      tableState={tableState}
      setTableState={setTableState}
      newColumnName={newColumnName}
      setNewColumnName={setNewColumnName}
      sensors={sensors}
      isLoading={isLoading}
    />
  );
}
