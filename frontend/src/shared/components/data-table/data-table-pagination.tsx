import type { Table } from "@tanstack/react-table";

import {
  ArrowLeft,
  ArrowLeftToLine,
  ArrowRight,
  ArrowRightToLine,
} from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

import { useDataTablePagination } from "./hooks/use-data-table-pagination";

export const DataTablePagination = <TData,>({
  table,
  summary,
}: {
  table: Table<TData>;
  /** Доп. контент сразу после "Найдено: N" (например, сумма по отфильтрованным строкам) */
  summary?: React.ReactNode;
}) => {
  const { currentPage, pages } = useDataTablePagination({ table });
  // getRowCount() сам учитывает контекст: при серверной пагинации — переданный
  // rowCount (т.е. уже с учётом ?search=), при клиентской — длину
  // отфильтрованной (getFilteredRowModel) строковой модели. Отдельно различать
  // "поиск применён/не применён" не нужно — в обоих случаях это правильное
  // число "найдено".
  const rowCount = table.getRowCount();

  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-3">
        <span>Найдено: {rowCount}</span>
        {summary}
      </div>
      <div className="flex items-center space-x-1.5">
        <span>Показывать по:</span>
        <Select
          value={String(table.getState().pagination.pageSize)}
          onValueChange={(e) => table.setPageSize(Number(e))}>
          <SelectTrigger size="sm" className="cursor-pointer">
            <SelectValue placeholder="10" />
          </SelectTrigger>
          <SelectContent className="min-w-full">
            {[10, 20, 50, 100].map((pageSize) => (
              <SelectItem
                key={pageSize}
                value={pageSize.toString()}
                className="cursor-pointer">
                {pageSize}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="xs"
          className="cursor-pointer"
          onClick={() => table.firstPage()}
          disabled={!table.getCanPreviousPage()}>
          <ArrowLeftToLine />
        </Button>
        <Button
          variant="outline"
          size="xs"
          className="cursor-pointer"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}>
          <ArrowLeft />
        </Button>
        {pages.map((page) => (
          <Button
            key={page}
            variant={page === currentPage ? "default" : "outline"}
            size="xs"
            onClick={(e) => {
              e.preventDefault();
              table.setPageIndex(Number(page) - 1);
            }}
            className="w-6 cursor-pointer"
            disabled={page === "..."}>
            {page}
          </Button>
        ))}
        <Button
          variant="outline"
          size="xs"
          className="cursor-pointer"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}>
          <ArrowRight />
        </Button>
        <Button
          variant="outline"
          size="xs"
          className="cursor-pointer"
          onClick={() => table.lastPage()}
          disabled={!table.getCanNextPage()}>
          <ArrowRightToLine />
        </Button>
      </div>
    </div>
  );
};
