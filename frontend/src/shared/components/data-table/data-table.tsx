import type {
  ColumnDef,
  ColumnFiltersState,
  ExpandedState,
  OnChangeFn,
  PaginationState,
  Table as ReactTable,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";

import { useState } from "react";

import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

import { DataTablePagination } from "./data-table-pagination";

type DataTableProps<TData> = {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  isLoading?: boolean;
  getRow?: (row: TData) => void;
  /** Вложенные строки (expanding): вернуть дочерние узлы строки */
  getSubRows?: (row: TData) => TData[] | undefined;
  /** Принудительно раскрыть все группы (например, на время поиска) */
  forceExpanded?: boolean;
  /** Внешний глобальный поиск (клиентская фильтрация средствами tanstack-table) */
  globalFilter?: string;
  /** Поднять ввод поиска наружу: без него поиск живёт во внутреннем стейте таблицы */
  onGlobalFilterChange?: (value: string) => void;
  /** Серверный поиск/фильтрация: строки уже отфильтрованы бэкендом, повторно не фильтровать */
  manualFiltering?: boolean;
  cellClassName?: string;
  actions?: (table: ReactTable<TData>) => React.ReactNode;
  pagination?:
    | false
    | {
        type?: "default" | "custom";
        render?: (table: ReactTable<TData>) => React.ReactNode;
        /**
         * Серверная пагинация: данные уже нарезаны бэкендом.
         * Если передан — таблица не режет строки сама, а количество страниц
         * считает из `rowCount` (общее число записей на сервере).
         */
        manual?: {
          pageIndex: number;
          pageSize: number;
          rowCount: number;
          onChange: OnChangeFn<PaginationState>;
        };
      };
};

export const DataTable = <TData,>({
  isLoading = false,
  pagination = { type: "default" },
  actions,
  ...props
}: DataTableProps<TData>) => {
  "use no memo";

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [innerGlobalFilter, setInnerGlobalFilter] = useState<string>("");
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const globalFilter = props.globalFilter ?? innerGlobalFilter;

  const manualPagination = pagination === false ? undefined : pagination.manual;

  const table = useReactTable({
    data: props.data,
    columns: props.columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    // Клиентская нарезка строк — только когда пагинация не серверная
    ...(pagination &&
      !manualPagination && {
        getPaginationRowModel: getPaginationRowModel(),
      }),
    ...(manualPagination && {
      manualPagination: true,
      rowCount: manualPagination.rowCount,
      onPaginationChange: manualPagination.onChange,
    }),
    ...(props.getSubRows && {
      getSubRows: props.getSubRows,
      getExpandedRowModel: getExpandedRowModel(),
      onExpandedChange: setExpanded,
      // Раскрытые дочерние строки остаются на странице родителя
      paginateExpandedRows: false,
      // Фильтрация снизу вверх: родитель остаётся, если подошёл любой потомок
      filterFromLeafRows: true,
    }),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: (updater) => {
      const next =
        typeof updater === "function"
          ? (updater(globalFilter) as string)
          : (updater as string);

      (props.onGlobalFilterChange ?? setInnerGlobalFilter)(next);
    },
    ...(props.manualFiltering && { manualFiltering: true }),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      ...(manualPagination && {
        pagination: {
          pageIndex: manualPagination.pageIndex,
          pageSize: manualPagination.pageSize,
        },
      }),
      // true — раскрыть всё дерево целиком, игнорируя пользовательский стейт
      ...(props.getSubRows && {
        expanded: props.forceExpanded ? true : expanded,
      }),
    },
  });

  return (
    <div className="w-full">
      {actions && <>{actions(table)}</>}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      style={
                        header.column.columnDef.size !== undefined
                          ? { width: header.getSize() }
                          : undefined
                      }
                      className={props.cellClassName}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {props.columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={() => props.getRow?.(row.original)}
                  className={props.getRow ? "cursor-pointer" : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={props.cellClassName}
                      style={
                        cell.column.columnDef.size !== undefined
                          ? { width: cell.column.getSize() }
                          : undefined
                      }>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={props.columns.length}
                  className="h-24 text-center">
                  Нет результатов.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {pagination !== false && (
        <div className="mt-4">
          {pagination.render ? (
            pagination.render(table)
          ) : (
            <DataTablePagination table={table} />
          )}
        </div>
      )}
    </div>
  );
};
