import type { Table } from "@tanstack/react-table"

export const useDataTablePagination = <TData,>({
  table,
  maxVisiblePage = 3,
}: {
  table: Table<TData>
  maxVisiblePage?: number
}) => {
  const totalPages = table.getPageCount()
  const currentPage = table.getState().pagination.pageIndex + 1
  const maxVisible = maxVisiblePage
  const pages: (number | string)[] = []

  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    const start = Math.max(2, currentPage - 2)
    const end = Math.min(totalPages - 1, currentPage + 2)

    pages.push(1)

    if (start > 2) pages.push("...")

    for (let i = start; i <= end; i++) pages.push(i)

    if (end < totalPages - 1) pages.push("...")

    pages.push(totalPages)
  }
  return { pages, currentPage, totalPages }
}
