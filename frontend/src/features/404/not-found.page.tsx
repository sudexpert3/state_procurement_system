import { useNavigate } from "react-router"

import { ROUTES } from "@/shared/model/routes"
import { Button } from "@/shared/ui/kit/button"

const NotFoundPage = () => {
  const navigate = useNavigate()

  const handleClick = () => navigate(ROUTES.HOME)

  return (
    <div className="mt-10 grid place-items-center gap-2.5">
      <h1 className="text-3xl">404 - Not Found </h1>
      <p>Страница, которую ты ищешь, не существует :(</p>
      <Button onClick={handleClick}>Перейти на главную</Button>
    </div>
  )
}

export const Component = NotFoundPage
