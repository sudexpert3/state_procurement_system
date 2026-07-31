# TanStack Table v8 — best practices

## Обязательная мемоизация

```ts
// data и columns ВСЕГДА мемоизировать — нестабильные ссылки = бесконечные ре-рендеры
const data    = useMemo(() => response?.items ?? [], [response]);
const columns = useMemo<ColumnDef<Contract>[]>(() => [...], []);
// useReactTable() НЕ мемоизировать
```

## Column definitions

```ts
const columns: ColumnDef<Contract>[] = [
  {
    accessorKey: "title",         // для плоских полей (TypeScript проверяет ключ)
    header: "Наименование",
    cell: ({ getValue }) => <span>{getValue<string>()}</span>,
  },
  {
    accessorFn: row => row.amount * 1.2,  // для вычисляемых/вложенных — требует id
    id: "amountWithTax",
    header: ({ column }) => (
      <button onClick={column.getToggleSortingHandler()}>Сумма</button>
    ),
  },
];
```

## Серверная vs клиентская обработка

| Режим      | Когда                        | Настройка                                               |
| ---------- | ---------------------------- | ------------------------------------------------------- |
| Клиентская | < 1000 строк                 | `getSortedRowModel()`, `getPaginationRowModel()`        |
| Серверная  | > 1000 строк, API пагинирует | `manualSorting/Pagination/Filtering: true` + `rowCount` |

```ts
// Серверный режим
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  manualSorting: true,
  manualPagination: true,
  manualFiltering: true,
  rowCount: totalCount, // обязательно для серверной пагинации
  state: { sorting, pagination, columnFilters },
  onSortingChange: setSorting, // изменение → новый запрос к API
  onPaginationChange: setPagination,
});
```

## Row selection (стандартный паттерн)

```ts
const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

// Колонка-чекбокс
{
  id: "select",
  header: ({ table }) => (
    <Checkbox checked={table.getIsAllPageRowsSelected()}
      onCheckedChange={v => table.toggleAllPageRowsSelected(!!v)} />
  ),
  cell: ({ row }) => (
    <Checkbox checked={row.getIsSelected()} disabled={!row.getCanSelect()}
      onCheckedChange={row.getToggleSelectedHandler()} />
  ),
}

// Получить выбранные строки:
table.getSelectedRowModel().rows.map(r => r.original)
```

- Подключать только нужные row models — каждый влияет на бандл
- Всегда типизировать: `ColumnDef<T>`, не `ColumnDef<unknown>`
