import { useLocation } from "react-router"

const ProcurementDetailPage = () => {
  const location = useLocation()

  return (
    <div>
      <span>{location.state.id}</span>
    </div>
  )
}

export const Component = ProcurementDetailPage
