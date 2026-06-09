import { useNavigate } from "react-router"

import { ROUTES } from "@/shared/model/routes"
import { Button } from "@/shared/ui/kit/button"

export const TableActions = () => {
  const navigate = useNavigate()

  const handleAddProcurement = () => {
    navigate(ROUTES.PROCUREMENT_ADD)
  }

  return (
    <div>
      <input type="file" accept=".xlsx, .csv" />
      <Button>Обновить финансы</Button>
      <Button onClick={handleAddProcurement}>Добавить запись</Button>
    </div>
  )
}
