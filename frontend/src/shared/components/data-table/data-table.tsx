import type {
  ColumnDef,
  ColumnFiltersState,
  ExpandedState,
  OnChangeFn,
  PaginationState,
  RowData,
  SortingState,
  Table as ReactTable,
  VisibilityState,
} from "@tanstack/react-table";

// `header` в columns.tsx — это JSX (иногда с <br/> для переноса в две строки),
// не строка, поэтому его нельзя переиспользовать как подпись в меню "Вид
// колонок" (там нужен обычный текст в одну строку). `meta.label` — явная
// текстовая подпись для таких мест; задаётся по желанию в columns.tsx, не
// обязательна для каждой колонки.
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TData/TValue обязательны для сигнатуры расширяемого интерфейса, хотя сами не используются
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string;
  }
}

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
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { useLocalStorageState } from "@/shared/lib/react/use-local-storage-state";

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
  /** Внешние колоночные фильтры (например, серверные — значения уходят в query-параметры) */
  columnFilters?: ColumnFiltersState;
  /** Поднять колоночные фильтры наружу: без него живут во внутреннем стейте таблицы */
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
  /** Серверный поиск/фильтрация: строки уже отфильтрованы бэкендом, повторно не фильтровать */
  manualFiltering?: boolean;
  cellClassName?: string;
  actions?: (table: ReactTable<TData>) => React.ReactNode;
  /**
   * Таблица растягивается на всю доступную высоту родителя (flexbox) вместо
   * фиксированной max-h-[Nvh]. Нужно для страниц-списков верхнего уровня,
   * где родитель сам — flex-колонка на всю высоту экрана (Card с flex-1
   * min-h-0 внутри <main>). Для таблиц, вложенных в формы/вкладки без
   * такого родителя, оставлять выключенным (по умолчанию) — иначе таблица
   * схлопнется до нулевой высоты.
   */
  fillAvailableHeight?: boolean;
  /**
   * Ключ для сохранения видимости колонок в localStorage — переживает
   * переход на другую страницу и обратно (без этого меню "Вид колонок"
   * сбрасывалось при каждом размонтировании таблицы). Без ключа — обычный
   * useState, ничего не сохраняется.
   */
  persistenceKey?: string;
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
  fillAvailableHeight = false,
  persistenceKey,
  ...props
}: DataTableProps<TData>) => {
  "use no memo";

  const [sorting, setSorting] = useState<SortingState>([]);
  const [innerColumnFilters, setInnerColumnFilters] =
    useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] =
    useLocalStorageState<VisibilityState>(
      persistenceKey ? `data-table:${persistenceKey}:column-visibility` : null,
      {},
    );
  const [rowSelection, setRowSelection] = useState({});
  const [innerGlobalFilter, setInnerGlobalFilter] = useState<string>("");
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const globalFilter = props.globalFilter ?? innerGlobalFilter;
  const columnFilters = props.columnFilters ?? innerColumnFilters;

  const manualPagination = pagination === false ? undefined : pagination.manual;

  const table = useReactTable({
    data: props.data,
    columns: props.columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: (updater) => {
      const next =
        typeof updater === "function"
          ? (updater(columnFilters) as ColumnFiltersState)
          : (updater as ColumnFiltersState);

      (props.onColumnFiltersChange ?? setInnerColumnFilters)(next);
    },
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
    <div
      className={
        fillAvailableHeight ? "flex min-h-0 w-full flex-1 flex-col" : "w-full"
      }>
      {actions && <>{actions(table)}</>}
      {/*
        Горизонтальный и вертикальный скролл — на ОДНОМ контейнере (а не на
        отдельном внутреннем div, как в обычном <Table>) — иначе горизонтальный
        скроллбар "прилипает" к нижнему краю ВСЕЙ таблицы, а не к видимой
        области, и для длинных списков до него нужно долго скроллить вниз.

        fillAvailableHeight=true: вместо фиксированного max-h-[Nvh] (который
        не учитывает высоту чужого контента над и под таблицей на конкретной
        странице и может "вытолкнуть" пагинацию за пределы экрана) контейнер
        растягивается на всю доступную высоту родителя через flex-1 min-h-0
        и сам решает, сколько строк показать без скролла — скроллбар всегда
        остаётся в видимой области.
      */}
      <div
        className={
          fillAvailableHeight
            ? "min-h-0 flex-1 overflow-auto rounded-md border bg-white"
            : "max-h-[85vh] overflow-auto rounded-md border bg-white"
        }>
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-10 bg-white">
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
        </table>
      </div>
      {pagination !== false && (
        <div className="mt-2 shrink-0">
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
